#!/usr/bin/env python3
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile


SOURCE_DIRS = ("src/server", "src/db", "src/shared", "eval/terminalbench", "eval/tracetrial")
EXPLICIT_FILES = (
    "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.json",
    "eval/package.json",
    "src/lib/artifact-preview.ts", "scripts/ensure-node-sqlite.mjs",
    "scripts/sqlite-abi-utils.mjs", "eval/terminalbench/install-runtime.sh",
    "eval/terminalbench/run-agenthub.ts",
)


def source_files(root: Path) -> list[Path]:
    selected = {root / name for name in EXPLICIT_FILES}
    for directory in SOURCE_DIRS:
        selected.update(
            file for file in (root / directory).rglob("*.ts")
            if not file.name.endswith(".test.ts")
            and not any(part.startswith(".") for part in file.relative_to(root).parts)
        )
    for file in selected:
        relative = file.relative_to(root)
        if not file.is_file() or any((root / Path(*relative.parts[:i])).is_symlink()
                                     for i in range(1, len(relative.parts) + 1)):
            raise ValueError(f"Runtime allowlist entry must be a regular non-symlink file: {relative}")
        if not file.resolve().is_relative_to(root.resolve()):
            raise ValueError(f"Runtime source escapes repository: {relative}")
    return sorted(selected)


def prepare(root: Path, output: Path) -> dict:
    files = source_files(root)
    contents = {file.relative_to(root).as_posix(): file.read_bytes() for file in files}
    runtime_package = json.loads(contents["package.json"])
    runtime_package["type"] = "module"
    contents["package.json"] = (json.dumps(runtime_package, indent=2) + "\n").encode()
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    manifest = {
        "schemaVersion": 1,
        "agenthubCommit": revision,
        "nodeVersion": "24.13.1",
        "pnpmVersion": "10.29.3",
        "lockfileSha256": hashlib.sha256(contents["pnpm-lock.yaml"]).hexdigest(),
        "files": {name: hashlib.sha256(data).hexdigest() for name, data in contents.items()},
        "containsDependencies": False,
        "evaluationOnlyOverrides": {"package.json": {"type": "module"}},
    }
    contents["runtime-source.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as zipped:
        with tarfile.open(fileobj=zipped, mode="w") as archive:
            for name, data in sorted(contents.items()):
                entry = tarfile.TarInfo(name)
                entry.size = len(data)
                entry.mode = 0o755 if name.endswith(".sh") else 0o644
                archive.addfile(entry, io.BytesIO(data))
    return {"archive": str(output), "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
            "bytes": output.stat().st_size, "sourceFiles": len(files), "agenthubCommit": revision}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pack only allowlisted AgentHub runtime sources, never host dependencies or credentials.")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--out", type=Path, required=True)
    arguments = parser.parse_args()
    print(json.dumps(prepare(arguments.root.resolve(), arguments.out.resolve()), indent=2))
