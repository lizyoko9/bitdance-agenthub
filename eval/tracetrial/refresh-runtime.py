#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import tarfile


NODE_VERSION = '24.13.1'
PNPM_VERSION = '10.29.3'
DEPENDENCY_INPUTS = ('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'eval/package.json',
                     'scripts/ensure-node-sqlite.mjs', 'scripts/sqlite-abi-utils.mjs')
EXPLICIT_FILES = {*DEPENDENCY_INPUTS, 'tsconfig.json', 'src/lib/artifact-preview.ts',
                  'eval/terminalbench/install-runtime.sh'}
SOURCE_PREFIXES = ('src/server/', 'src/db/', 'src/shared/', 'eval/terminalbench/', 'eval/tracetrial/')


def source_name(name):
    if not isinstance(name, str):
        raise ValueError('Runtime source path is unsafe')
    path = PurePosixPath(name)
    if (str(path) != name or path.is_absolute()
            or any(part in {'.', '..', 'node_modules'} or part.startswith('.') for part in path.parts)):
        raise ValueError('Runtime source path is unsafe')
    if name not in EXPLICIT_FILES and not (name.startswith(SOURCE_PREFIXES) and name.endswith('.ts')
                                          and not name.endswith('.test.ts')):
        raise ValueError(f'Runtime source is outside the source allowlist: {name}')
    return path


def read_manifest(data):
    manifest = json.loads(data)
    if not isinstance(manifest, dict) or manifest.get('schemaVersion') != 1 or not isinstance(manifest.get('files'), dict):
        raise ValueError('Runtime source manifest is invalid')
    for name, digest in manifest['files'].items():
        source_name(name)
        if not isinstance(digest, str) or len(digest) != 64 or any(char not in '0123456789abcdef' for char in digest):
            raise ValueError(f'Runtime source digest is invalid: {name}')
    if not all(name in manifest['files'] for name in DEPENDENCY_INPUTS):
        raise ValueError('Runtime source manifest is missing dependency inputs')
    if manifest.get('lockfileSha256') != manifest['files']['pnpm-lock.yaml']:
        raise ValueError('Runtime source lockfile digest is inconsistent')
    return manifest


def read_archive(path):
    files = {}
    with tarfile.open(path, 'r:gz') as archive:
        for entry in archive:
            if not entry.isfile() or entry.mode & 0o7000 or entry.name in files:
                raise ValueError('Runtime archive requires unique regular source files')
            if entry.name != 'runtime-source.json':
                source_name(entry.name)
            files[entry.name] = (archive.extractfile(entry).read(), entry.mode & 0o755)
    if 'runtime-source.json' not in files:
        raise ValueError('Runtime archive lacks its source manifest')
    manifest = read_manifest(files['runtime-source.json'][0])
    if set(files) != {*manifest['files'], 'runtime-source.json'}:
        raise ValueError('Runtime archive members differ from its source manifest')
    for name, digest in manifest['files'].items():
        if hashlib.sha256(files[name][0]).hexdigest() != digest:
            raise ValueError(f'Runtime archive source hash does not match: {name}')
    return manifest, files


def validate_dependencies(old, new):
    for manifest in (old, new):
        if manifest.get('nodeVersion') != NODE_VERSION or manifest.get('pnpmVersion') != PNPM_VERSION:
            raise ValueError('Runtime source requires the exact approved Node and pnpm versions')
    changed = [name for name in DEPENDENCY_INPUTS if old['files'][name] != new['files'][name]]
    if changed:
        raise ValueError('Dependency inputs changed; use a clean runtime build: ' + ', '.join(changed))
    return {name: new['files'][name] for name in DEPENDENCY_INPUTS}


def target_path(root, name):
    current = root
    for part in PurePosixPath(name).parts:
        current = current / part
        if current.is_symlink():
            raise ValueError(f'Runtime source target must not traverse a symlink: {name}')
        if current.exists() and current.is_file() and current.stat().st_nlink != 1:
            raise ValueError(f'Runtime source target must not be a hard link: {name}')
    if not current.resolve().is_relative_to(root):
        raise ValueError('Runtime source target escapes the installed runtime')
    return current


def refresh_runtime(archive, destination, baseline_manifest, *, node_version, pnpm_version):
    root = Path(destination)
    if root.is_symlink() or root.resolve() != root.absolute() or not root.is_dir():
        raise ValueError('Installed runtime must be a real canonical directory')
    if node_version != 'v' + NODE_VERSION or pnpm_version != PNPM_VERSION:
        raise ValueError('Installed Node or pnpm version differs from the approved runtime')
    baseline_data = Path(baseline_manifest).read_bytes()
    installed_manifest = target_path(root, 'runtime-source.json')
    if installed_manifest.read_bytes() != baseline_data:
        raise ValueError('Installed runtime source manifest differs from the retained baseline')
    old = read_manifest(baseline_data)
    new, files = read_archive(archive)
    validate_dependencies(old, new)
    for name, digest in old['files'].items():
        target = target_path(root, name)
        if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            raise ValueError(f'Installed baseline source hash does not match: {name}')
    removed = sorted(set(old['files']) - set(new['files']))
    for name in files:
        target = target_path(root, name)
        if target.exists() and not target.is_file():
            raise ValueError(f'Runtime source target is not a regular file: {name}')
        if any(parent.exists() and not parent.is_dir() for parent in target.parents if parent != root and parent.is_relative_to(root)):
            raise ValueError(f'Runtime source target has a non-directory parent: {name}')
    for name in removed:
        target_path(root, name).unlink()
    for name, (data, mode) in files.items():
        target = target_path(root, name)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        target.chmod(mode)
    return {'node': node_version, 'pnpm': pnpm_version, 'sourceFiles': len(new['files']),
            'agenthubCommit': new.get('agenthubCommit'), 'removedSources': removed,
            'dependenciesReinstalled': False}


def main():
    parser = argparse.ArgumentParser(description='Refresh only verified sources over a pinned dependency image')
    parser.add_argument('archive', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('baseline_manifest', type=Path)
    args = parser.parse_args()
    if args.destination != Path('/installed-agent/agenthub'):
        parser.error('destination must be /installed-agent/agenthub')
    node = subprocess.check_output(['/installed-agent/node/bin/node', '--version'], text=True).strip()
    pnpm = subprocess.check_output(['pnpm', '--version'], text=True).strip()
    print(json.dumps(refresh_runtime(args.archive, args.destination, args.baseline_manifest,
                                    node_version=node, pnpm_version=pnpm)))


if __name__ == '__main__':
    main()
