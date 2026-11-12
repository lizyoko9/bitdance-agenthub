# AgentHub × Terminal-Bench integration smoke

This evaluation runs the real AgentHub Application Services inside the original
task container through a headless CLI. It starts neither Next.js nor Electron.
Harbor owns task creation, artifact collection, the separate verifier, and reward.
The first trial is one task, `single`, one attempt, with a ten-minute agent budget;
it is an integration smoke test and is not a Terminal-Bench leaderboard score.

The completed first run is documented in [2026-11-12 smoke results](results/2026-11-12-smoke.md):
oracle reward 1.0; AgentHub reward 0.0. The report retains the failed task result
and distinguishes execution completion from task success.

Fixed inputs:

- Harbor `0.25.0` in a separate Python environment (Python 3.12+).
- Dataset `terminal-bench/terminal-bench-cpu@4.1.0`.
- Task `terminal-bench/bun-sourcemap-leak`, package version `2.2.0`.
- Model `gpt-6-luna`, `reasoning_effort=none`; unsupported access stops the trial.
- Linux Node `24.13.1`, pnpm `10.29.3`, application dependencies from the existing
  root lockfile, and its existing `tsx` loader.

## Prerequisites and source package

Have a working Docker engine, Docker Compose plugin, and Docker Buildx plugin.
`docker info`, `docker compose version`, and `docker buildx version` should work
with the same Docker environment passed to Harbor. Colima users should place job
output under a path shared with the VM, usually under the home directory.
An isolated `DOCKER_CONFIG` can supply plugin search paths without changing the
user's global Docker configuration; configure its location for your machine.

If image builds need a local proxy, use the optional evaluation-only Docker
environment instead of modifying the task Dockerfiles or Docker daemon config:

```sh
# Use a host address reachable from containers, not their own 127.0.0.1.
# On an existing Lima user-network route, inspect `colima ssh -- cat /etc/hosts`
# for host.lima.internal's IP and test that IP before running a build.
export AGENTHUB_BUILD_PROXY="http://CONTAINER_REACHABLE_HOST:7890"
# Replace -e docker in either oracle or model commands below with:
# -e eval.terminalbench.build_proxy:BuildProxyDockerEnvironment
```

This fixed Harbor subclass only replaces its generic Compose build template with
one that supplies Docker's predefined proxy build arguments. It applies to both
the Agent image and the separately created verifier image, leaves their official
Dockerfiles unchanged, and adds no runtime environment or network-policy override.
Do not add a proxy to Docker daemon settings or the global Docker configuration.
Proxy credentials are rejected. Docker's built-in proxy arguments are excluded
from image history/cache metadata unless a Dockerfile explicitly references them.
This option affects image builds only, not the AgentHub runtime installer or model
process. If setup downloads also need the already tested route, add the explicit
Agent option `--ak "setup_proxy=http://CONTAINER_REACHABLE_HOST:7890"`. This
passes only the HTTP(S) proxy variables to the installer command, records the URL
in `harbor-agenthub.json`, and does not select a model API proxy.

If the task container cannot reach the model API directly, explicitly add
`--ak "api_proxy=http://CONTAINER_REACHABLE_HOST:7890"` to the model command.
This uses the fixed Node 24.13.1 runtime's built-in environment-proxy support:
the CLI's `env -i` adds only `NODE_USE_ENV_PROXY=1`, `HTTP_PROXY`, and `HTTPS_PROXY`
for this option. The proxy URL must be HTTP(S) with an explicit port and no
credentials, path, query, or fragment, using the same validator as the build/setup
proxy. It is recorded as `apiProxy` in `harbor-agenthub.json`; it is not placed in
the task request JSON. Without this option, the CLI keeps its direct API route
and does not inherit the host's proxy or Node settings. Replace
`CONTAINER_REACHABLE_HOST` with the already tested container-reachable host address.

`AGENTHUB_BUILD_PROXY` affects image builds, `setup_proxy` affects runtime
installation downloads, and `api_proxy` affects the Node model CLI and tool
subprocesses that inherit its environment. Select each independently as needed;
none modifies global configuration or the official task.

Install the approved Python evaluation dependency into an isolated environment:

```sh
uv venv --python 3.13 /path/to/agenthub-terminalbench-venv
uv pip install --python /path/to/agenthub-terminalbench-venv/bin/python \
  -r eval/terminalbench/requirements.txt
```

Prepare the source archive from this checkout, including uncommitted runtime
changes and a per-file content manifest:

```sh
python3 eval/terminalbench/prepare-runtime.py \
  --out /path/shared-with-docker/agenthub-runtime-source.tar.gz
```

The allowlist includes non-test TypeScript under `src/server`, `src/db`,
`src/shared`, and `eval/terminalbench`, plus `src/lib/artifact-preview.ts`, root
package/lock/workspace and TS config, the SQLite ABI probe, and the installer.
`eval/package.json` preserves the headless CLI's ESM module boundary.
Symlinks are rejected. It never includes host `node_modules`, `.env*`, databases,
`.git`, benchmark solutions/tests, or the old self-built eval fixtures.
The archive is sources only; it is normally well below 1 MB.
Its generated `package.json` adds evaluation-only `type: "module"` so `tsx` can
load ESM-only SDK dependencies through the actual adapter registry. Application
dependency versions and the lockfile remain unchanged; the source manifest records
this override and hashes the generated package bytes. The ordinary app's package
file is not modified.

The installed-agent integration uploads that archive and executes:

```sh
sh /installed-agent/install-agenthub.sh \
  /installed-agent/agenthub-source.tar.gz /installed-agent/agenthub
```

The installer is intentionally limited to the approved Debian task. It downloads
the fixed Linux Node archive, verifies it against Node's `SHASUMS256.txt`, installs
pnpm, installs the frozen application lockfile, and checks `better-sqlite3` with
that Node executable. Electron/browser binary downloads are disabled and no
Electron rebuild or application build is called. Native dependencies are installed
on Linux rather than copied from macOS. Installation is not timed as agent work.
It imports the actual headless entry without running a model to check the packaged
ESM and TypeScript dependency closure.
It also creates and closes a fresh temporary Application Services profile to test
the full registry/SQLite import path without starting a model run.
The first install can be comparatively slow; installed-agent setup has a 900s
limit. A setup error is an infrastructure error, not a model score.

## Independent oracle, then a fresh model trial

Use the fixed task package downloaded by Harbor, or a checkout at the exact
`v4.1.0` tag. Never edit its instruction, Dockerfiles, artifacts list, oracle, or
verifier to make a failing local run pass.

Launch both commands from the AgentHub checkout. Harbor 0.25.0's installed
console script needs the explicit host-side `PYTHONPATH="$PWD"` to import
`eval.terminalbench.agenthub_agent` or the optional custom Docker environment.
The prefix affects this Harbor process only; the model CLI's filtered container
environment does not inherit it.

```sh
# No provider key is needed for this infrastructure check.
env -u OPENAI_API_KEY PYTHONPATH="$PWD" /path/to/agenthub-terminalbench-venv/bin/harbor run \
  --path /path/to/terminal-bench-4.1.0/tasks/bun-sourcemap-leak \
  -a oracle -e docker -n 1 -k 1 \
  --max-retries 0 --job-name agenthub-bun-oracle-smoke-01 \
  --jobs-dir /path/shared-with-docker/oracle-jobs
```

Only after the oracle and official verifier succeed, run a new job with fresh
containers:

```sh
# Supply the previously authorized OPENAI_API_KEY through the process environment.
PYTHONPATH="$PWD" /path/to/agenthub-terminalbench-venv/bin/harbor run \
  --path /path/to/terminal-bench-4.1.0/tasks/bun-sourcemap-leak \
  -a eval.terminalbench.agenthub_agent:AgentHubAgent \
  -m openai/gpt-6-luna \
  --ak runtime_archive=/path/shared-with-docker/agenthub-runtime-source.tar.gz \
  --ak task_sha256=REPLACE_WITH_TASK_TOML_SHA256 \
  --ak group=single --ak timeout_sec=600 \
  -e docker -n 1 -k 1 \
  --max-retries 0 --job-name agenthub-bun-model-smoke-01 \
  --jobs-dir /path/shared-with-docker/agent-jobs
```

These flags follow Harbor 0.25.0: `--path` selects a local task directory;
`-t` selects a registry task name. `-n 1` sets one concurrent trial, `-k 1`
sets one attempt, and `--max-retries 0` disables failed-trial retries. Choose a
new `--job-name` for each invocation and keep oracle/model jobs separate.
Replace `REPLACE_WITH_TASK_TOML_SHA256` with the actual fixed task file hash.

Do not supply a key in command-line arguments, request JSON, source packages, or
task files. Only `OPENAI_API_KEY` and explicitly selected runtime basics reach the
CLI; no host environment or database is copied. Built-in AgentHub commands still
inherit that in-container credential, so this does not claim process-level secret
isolation from model-generated shell commands.

Compute `task_sha256` from the unchanged official `task.toml` with `shasum -a 256`
or `sha256sum`. The wrapper forwards source commit, runtime archive hash, fixed
Harbor/dataset versions, image index digest, and this task file hash through an
explicit non-secret metadata allowlist, so the CLI manifest can retain them.

The wrapper leaves the official eight-hour task configuration intact and applies
the CLI's explicit 600s smoke limit. An external `timeout` allows 30s for shutdown,
then sends TERM with a 15s kill grace; Harbor's environment command has a separate
finite backstop. No automatic model fallback or additional trial is requested.

## Turn limits and future trial budgets

CustomAgentAdapter now uses a finite default of **32 model turns per run**.
Ordinary application runs can set `AGENTHUB_CUSTOM_MAX_TURNS=64`; an explicit
constructor option such as `new CustomAgentAdapter({ maxTurns: 64 })` takes
precedence. Values must be integers between 1 and 10000. A turn is one model
response and can contain several tool calls. The default is an adjustable
fallback, not a validated optimum for Terminal-Bench.

The evaluation profile always supplies its explicit `maxTurns`, so unrelated host
environment settings cannot change its recorded budget. Python Agent options are:

| Option | Default | Accepted range |
|---|---:|---:|
| `max_turns` | 32 per run | 1–10000 |
| `max_requests` | 8 across the trial | 1–1000 |
| `max_request_bytes` | 65536 per request | 1–262144 |
| `max_total_request_bytes` | 262144 across the trial | 1–67108864 |
| `max_completion_tokens` | 2048 per request | 1–8192 |

The first smoke's default request count, cumulative input allowance, per-request
64KiB bound, and per-request 2048 output-token limit remain unchanged. Each bound
is now explicitly configurable, so changing the loop limit alone does not increase
the other allowances. A trial can explicitly select these additional arguments:

```text
--ak max_turns=32 --ak max_requests=32 --ak max_request_bytes=262144
--ak max_total_request_bytes=4194304 --ak max_completion_tokens=8192
```

Select and authorize the new budget before sending more model requests. The CLI
JSON equivalents are `maxTurns` and `requestLimits: { maxRequests, maxRequestBytes,
maxTotalRequestBytes, maxCompletionTokens }`. Input validation fills omitted
request limits with the existing defaults. The manifest records the effective
values, and the Python wrapper retains the selected settings in
`harbor-agenthub.json`. A one-task rerun is diagnostic and is not a controlled
comparison when multiple budgets and termination behavior change together.

The Custom adapter completes normally only when the model explicitly returns
`stop` without tools. If the final allowed response still asks for tools, those
tools finish, usage is retained, and Runner records `failed` with an
`iteration_limit:` error. A `length` response becomes `output_limit` and incomplete
tool arguments are not executed. A model that stops voluntarily on its last
allowed request still completes normally; reaching a count does not itself mean
failure. Planning stages that intentionally close the stream after `plan_tasks`
are not treated as exhausted loops.

## Records and interpretation

AgentHub code lives at `/installed-agent/agenthub`, its CLI output at
`/installed-agent/agenthub-trial`, and the task stays at `/app`. The wrapper retrieves
`result.json`, `manifest.json`, `requests.jsonl`, `events.jsonl`, and `cli.log` into
Harbor's agent log directory, plus source/platform manifests and
`harbor-agenthub.json`. It redacts the known credential during retrieval.

The wrapper populates Harbor token totals only when the request ledger reports
complete usage. Unknown usage remains unset, and no USD cost is invented.
Execution status, budget exhaustion, timeout, and Harbor's official reward are
separate fields. A completed AgentHub run is not itself a passed task.
New results also record `terminationReason`: `completed`, `iteration_limit`,
`output_limit`, `content_filter`, `model_interrupted`, `budget_exhausted`,
`timed_out`, `aborted`, `error`, or `unknown`. Classification follows the actual
terminal event or stable error prefix, not request-count equality. `completed`
describes completed service execution; the official reward remains independent.
Historical first-run results retain their original records and interpretation.

The task's declared source artifacts go to its official separate verifier image;
AgentHub does not upload hidden tests or solutions into the model environment.
Oracle and model jobs must not reuse each other's containers or output files.
ARM64 variants have been verified in the Bun and uv image indexes, but successful
local oracle execution is still required before claiming architecture compatibility.

For later `single / orch-nogate / orch-gate` comparisons, fix task IDs, model,
permissions, per-trial limits, repeats, and architecture. First smoke results and
custom task subsets must not be compared as full-dataset leaderboard scores.

Sources: [Harbor 0.25.0 installed agent](https://github.com/harbor-framework/harbor/blob/v0.25.0/src/harbor/agents/installed/base.py),
[Terminal-Bench 4.1.0 release](https://github.com/harbor-framework/terminal-bench/releases/tag/v4.1.0),
[fixed task](https://github.com/harbor-framework/terminal-bench/tree/v4.1.0/tasks/bun-sourcemap-leak).
