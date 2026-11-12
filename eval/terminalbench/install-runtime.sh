#!/bin/sh
set -eu
umask 077

archive=${1:?source archive path required}
runtime=${2:-/installed-agent/agenthub}
node_version=24.13.1
pnpm_version=10.29.3
node_prefix=/installed-agent/node

test "$(uname -s)" = Linux || { echo 'AgentHub evaluation runtime requires Linux' >&2; exit 1; }
case "$(uname -m)" in
  aarch64|arm64) node_arch=arm64 ;;
  x86_64|amd64) node_arch=x64 ;;
  *) echo 'Unsupported Linux architecture' >&2; exit 1 ;;
esac
case "$runtime" in /installed-agent/*) ;; *) echo 'Runtime must stay under /installed-agent' >&2; exit 1 ;; esac

if ! command -v apt-get >/dev/null 2>&1; then
  echo 'This fixed smoke installer expects the approved Debian task image' >&2
  exit 1
fi
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates curl xz-utils python3 make g++ git

scratch=$(mktemp -d /tmp/agenthub-node.XXXXXX)
trap 'rm -rf "$scratch"' EXIT HUP INT TERM
filename="node-v${node_version}-linux-${node_arch}.tar.xz"
curl --fail --location --retry 0 --max-time 120 "https://nodejs.org/dist/v${node_version}/${filename}" -o "$scratch/$filename"
curl --fail --location --retry 0 --max-time 60 "https://nodejs.org/dist/v${node_version}/SHASUMS256.txt" -o "$scratch/SHASUMS256.txt"
(cd "$scratch" && awk -v file="$filename" '$2 == file {print; found=1} END {if (!found) exit 1}' SHASUMS256.txt | sha256sum -c -)
mkdir -p "$node_prefix" "$runtime"
tar -xJf "$scratch/$filename" --strip-components=1 -C "$node_prefix"
export PATH="$node_prefix/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

python3 - "$archive" "$runtime" <<'PY'
from pathlib import Path, PurePosixPath
import sys
import tarfile
destination = Path(sys.argv[2]).resolve()
with tarfile.open(sys.argv[1], 'r:gz') as archive:
    for entry in archive:
        name = PurePosixPath(entry.name)
        if not entry.isfile() or name.is_absolute() or '..' in name.parts:
            raise ValueError(f'Unsafe runtime archive entry: {entry.name}')
        target = destination / entry.name
        if not target.resolve().is_relative_to(destination):
            raise ValueError(f'Runtime entry escapes destination: {entry.name}')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(archive.extractfile(entry).read())
        target.chmod(entry.mode & 0o755)
PY

cd "$runtime"
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export npm_config_update_notifier=false
export npm_config_fund=false
export npm_config_audit=false
npm install --global "pnpm@$pnpm_version" --ignore-scripts --no-audit --no-fund
pnpm install --frozen-lockfile --ignore-workspace
node scripts/ensure-node-sqlite.mjs
node -e 'const Database = require("better-sqlite3"); const db = new Database(":memory:"); db.prepare("select 1").get(); db.close(); console.log(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,sqlite:"ok"}))'
node --import tsx -e 'console.log("AgentHub TypeScript loader ready")'
node --import tsx --input-type=module -e 'const entry = await import("./eval/terminalbench/run-agenthub.ts"); if (typeof entry.runHeadlessTrial !== "function") throw new Error("Headless CLI ESM export missing"); console.log("AgentHub headless entry ready (no model call)")'
node --import tsx --input-type=module -e 'const fs=await import("node:fs"); const outputDir=fs.mkdtempSync("/tmp/agenthub-profile-probe-"); try { const {createIsolatedProfile}=await import("./eval/terminalbench/profile.ts"); const profile=await createIsolatedProfile({outputDir,group:"single",modelId:"gpt-6-luna"},()=>{}); profile.close(); console.log("AgentHub application profile ready (no model call)"); } finally {fs.rmSync(outputDir,{recursive:true,force:true});}'
node -e 'const fs=require("node:fs"); fs.writeFileSync("runtime-platform.json",JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,pnpm:"10.29.3"})+"\n")'
chmod -R a+rX "$runtime" "$node_prefix"
