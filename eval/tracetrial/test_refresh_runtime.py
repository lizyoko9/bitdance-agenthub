import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest


spec = importlib.util.spec_from_file_location('refresh_runtime', Path(__file__).with_name('refresh-runtime.py'))
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)


def manifest(files, **updates):
    value = {'schemaVersion': 1, 'agenthubCommit': 'synthetic-committed-revision',
             'nodeVersion': refresh.NODE_VERSION, 'pnpmVersion': refresh.PNPM_VERSION,
             'files': {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}}
    value['lockfileSha256'] = value['files']['pnpm-lock.yaml']
    value.update(updates)
    return value


class RefreshRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='agenthub-refresh-offline-')
        self.addCleanup(self.temporary.cleanup)
        self.folder = Path(self.temporary.name).resolve()
        self.root = self.folder/'runtime'
        self.root.mkdir()
        self.old = {name: ('dependency:' + name).encode() for name in refresh.DEPENDENCY_INPUTS}
        self.old.update({'src/server/current.ts': b'old source', 'src/server/removed.ts': b'removed source'})
        self.new = {**self.old, 'src/server/current.ts': b'fixed source', 'src/server/added.ts': b'new source'}
        del self.new['src/server/removed.ts']
        for name, data in self.old.items():
            path = self.root/name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        self.baseline = self.folder/'baseline.json'
        self.baseline.write_text(json.dumps(manifest(self.old)))
        (self.root/'runtime-source.json').write_bytes(self.baseline.read_bytes())
        (self.root/'node_modules').mkdir()
        self.sentinel = self.root/'node_modules/do-not-reinstall'
        self.sentinel.write_bytes(b'installed dependency')
        self.archive = self.folder/'runtime.tar.gz'

    def write_archive(self, *, files=None, metadata=None, extra=None):
        files = self.new if files is None else files
        payload = {**files, 'runtime-source.json': json.dumps(metadata or manifest(files)).encode()}
        with tarfile.open(self.archive, 'w:gz') as archive:
            for name, data in payload.items():
                info = tarfile.TarInfo(name)
                info.size = len(data)
                info.mode = 0o644
                archive.addfile(info, io.BytesIO(data))
            if extra:
                info, data = extra
                archive.addfile(info, io.BytesIO(data) if data is not None else None)

    def run_refresh(self, **updates):
        return refresh.refresh_runtime(self.archive, self.root, self.baseline,
            **{'node_version': 'v24.13.1', 'pnpm_version': '10.29.3', **updates})

    def test_overlays_sources_removes_old_allowlist_and_preserves_dependencies(self):
        self.write_archive()
        before_inode = self.sentinel.stat().st_ino
        result = self.run_refresh()
        self.assertEqual((self.root/'src/server/current.ts').read_bytes(), b'fixed source')
        self.assertEqual((self.root/'src/server/added.ts').read_bytes(), b'new source')
        self.assertFalse((self.root/'src/server/removed.ts').exists())
        self.assertEqual(self.sentinel.read_bytes(), b'installed dependency')
        self.assertEqual(self.sentinel.stat().st_ino, before_inode)
        self.assertEqual(result['removedSources'], ['src/server/removed.ts'])
        self.assertFalse(result['dependenciesReinstalled'])
        self.assertEqual(json.loads((self.root/'runtime-source.json').read_text()), manifest(self.new))

    def test_dependency_change_requires_clean_build_before_any_source_write(self):
        files = {**self.new, 'eval/package.json': b'changed dependencies'}
        self.write_archive(files=files)
        with self.assertRaisesRegex(ValueError, 'clean runtime build'):
            self.run_refresh()
        self.assertEqual((self.root/'src/server/current.ts').read_bytes(), b'old source')
        self.assertTrue((self.root/'src/server/removed.ts').exists())

    def test_exact_installed_and_manifest_versions_are_required(self):
        self.write_archive()
        with self.assertRaisesRegex(ValueError, 'Installed Node'):
            self.run_refresh(node_version='v24.14.0')
        with self.assertRaisesRegex(ValueError, 'Installed Node'):
            self.run_refresh(pnpm_version='10.30.0')
        self.write_archive(metadata=manifest(self.new, nodeVersion='24.14.0'))
        with self.assertRaisesRegex(ValueError, 'exact approved'):
            self.run_refresh()

    def test_archive_payload_must_match_its_manifest(self):
        self.write_archive(metadata=manifest({**self.new, 'src/server/current.ts': b'other source'}))
        with self.assertRaisesRegex(ValueError, 'source hash does not match'):
            self.run_refresh()

    def test_archive_must_contain_exactly_its_manifest_sources(self):
        info = tarfile.TarInfo('src/server/unlisted.ts')
        info.size = 1
        self.write_archive(extra=(info, b'x'))
        with self.assertRaisesRegex(ValueError, 'members differ'):
            self.run_refresh()

    def test_archive_rejects_traversal_dependency_targets_and_hidden_paths(self):
        for name in ('/etc/passwd', '../escape.ts', 'src/server/../../escape.ts',
                     'src/server/node_modules/escape.ts', 'src/server/.secret.ts'):
            with self.subTest(name=name):
                info = tarfile.TarInfo(name)
                info.size = 1
                self.write_archive(extra=(info, b'x'))
                with self.assertRaises(ValueError):
                    self.run_refresh()
        self.assertEqual(self.sentinel.read_bytes(), b'installed dependency')

    def test_archive_rejects_links_directories_and_duplicate_members(self):
        for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.DIRTYPE):
            with self.subTest(kind=kind):
                info = tarfile.TarInfo('src/server/link.ts')
                info.type, info.linkname = kind, '/etc/passwd'
                self.write_archive(extra=(info, None))
                with self.assertRaisesRegex(ValueError, 'unique regular'):
                    self.run_refresh()
        info = tarfile.TarInfo('src/server/current.ts')
        info.size = 1
        self.write_archive(extra=(info, b'x'))
        with self.assertRaisesRegex(ValueError, 'unique regular'):
            self.run_refresh()

    def test_installed_symlink_cannot_redirect_overlay_outside_runtime(self):
        target = self.root/'src/server/current.ts'
        target.unlink()
        outside = self.folder/'outside'
        outside.write_bytes(b'old source')
        target.symlink_to(outside)
        self.write_archive()
        with self.assertRaisesRegex(ValueError, 'symlink'):
            self.run_refresh()
        self.assertEqual(outside.read_bytes(), b'old source')

    def test_installed_drift_and_wrong_baseline_are_rejected(self):
        self.write_archive()
        (self.root/'src/server/current.ts').write_bytes(b'unexpected drift')
        with self.assertRaisesRegex(ValueError, 'baseline source hash'):
            self.run_refresh()
        self.baseline.write_text(json.dumps(manifest(self.old), indent=2))
        with self.assertRaisesRegex(ValueError, 'retained baseline'):
            self.run_refresh()


if __name__ == '__main__':
    unittest.main()
