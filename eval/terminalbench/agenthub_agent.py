import asyncio
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import tarfile
import tempfile

from harbor.agents.installed.base import BaseInstalledAgent, NonZeroAgentExitCodeError
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

from eval.terminalbench.request_contract import TASK_ID, build_trial_request
from eval.terminalbench.build_proxy import validate_build_proxy


RUNTIME_ROOT = "/installed-agent/agenthub"
NODE_PREFIX = "/installed-agent/node"
DATASET = "terminal-bench/terminal-bench-cpu@4.1.0"
IMAGE_DIGEST = "sha256:fdc3d9dd3cfc15ed5097316e5e304a3c694677015c536456358d1320a8733b6d"
OUTPUT_FILES = ("result.json", "manifest.json", "requests.jsonl", "events.jsonl", "cli.log")


class AgentHubAgent(BaseInstalledAgent):
    DEFAULT_SETUP_TIMEOUT_SEC = 900.0

    def __init__(self, *args, runtime_archive: str, task_sha256: str, group: str = "single",
                 task_id: str = TASK_ID, timeout_sec: int = 600, setup_proxy: str | None = None,
                 api_proxy: str | None = None, **kwargs):
        self.runtime_archive = Path(runtime_archive).expanduser().resolve(strict=True)
        self.archive_sha256 = hashlib.sha256(self.runtime_archive.read_bytes()).hexdigest()
        with tarfile.open(self.runtime_archive, "r:gz") as archive:
            manifest_file = archive.extractfile("runtime-source.json")
            if manifest_file is None:
                raise ValueError("Runtime archive has no source manifest")
            self.source_commit = json.load(manifest_file)["agenthubCommit"]
        if not re.fullmatch(r"[a-f0-9]{40}", self.source_commit):
            raise ValueError("Runtime manifest must contain the AgentHub source commit")
        if not re.fullmatch(r"[a-f0-9]{64}", task_sha256):
            raise ValueError("task_sha256 must be the SHA-256 of the fixed official task.toml")
        self.task_sha256 = task_sha256
        self.setup_proxy = validate_build_proxy(setup_proxy) if setup_proxy is not None else None
        self.api_proxy = validate_build_proxy(api_proxy) if api_proxy is not None else None
        if group not in {"single", "orch-nogate", "orch-gate"}:
            raise ValueError(f"Unsupported AgentHub evaluation group: {group}")
        if task_id != TASK_ID or not 1 <= int(timeout_sec) <= 600:
            raise ValueError("This fixed smoke integration only accepts bun-sourcemap-leak with a 1–600s budget")
        self.group = group
        self.task_id = task_id
        self.timeout_sec = int(timeout_sec)
        super().__init__(*args, **kwargs)

    @staticmethod
    def name() -> str:
        return "agenthub"

    @staticmethod
    def _parse_model_name_for_connection(model_name: str, *, skip_model_parsing: bool = False):
        model_id = model_name.removeprefix("openai/")
        if model_id != "gpt-6-luna":
            raise ValueError("This approved smoke profile requires gpt-6-luna")
        return "openai", model_id

    def version(self) -> str:
        return self.archive_sha256[:16]

    async def install(self, environment: BaseEnvironment) -> None:
        await self.exec_as_root(environment, "mkdir -p /installed-agent")
        remote_archive = "/installed-agent/agenthub-source.tar.gz"
        installer = Path(__file__).with_name("install-runtime.sh")
        await environment.upload_file(self.runtime_archive, remote_archive)
        await environment.upload_file(installer, "/installed-agent/install-agenthub.sh")
        await self.exec_as_root(
            environment,
            f"sh /installed-agent/install-agenthub.sh {shlex.quote(remote_archive)} {RUNTIME_ROOT}",
            env=({name: self.setup_proxy for name in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy")}
                 if self.setup_proxy else None),
            timeout_sec=900,
        )
        for name in ("runtime-source.json", "runtime-platform.json"):
            self.logs_dir.mkdir(parents=True, exist_ok=True)
            await environment.download_file(f"{RUNTIME_ROOT}/{name}", self.logs_dir / name)

    async def run(self, instruction: str, environment: BaseEnvironment, context: AgentContext) -> None:
        model_id = (self.model_name or "openai/gpt-6-luna").removeprefix("openai/")
        if model_id != "gpt-6-luna":
            raise ValueError("This approved smoke profile requires gpt-6-luna; model fallback is disabled")
        key = self.extra_env.get("OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY")
        if not key:
            raise ValueError("AgentHub smoke requires the explicitly authorized OPENAI_API_KEY")
        cwd_result = await environment.exec("pwd")
        cwd = (cwd_result.stdout or "").strip()
        if cwd_result.return_code != 0 or cwd != "/app":
            raise ValueError(f"Approved task cwd must be /app, got {cwd!r}")

        output_dir = "/installed-agent/agenthub-trial"
        request = build_trial_request(instruction, cwd, self.group, model_id, self.timeout_sec, output_dir)
        await environment.exec(f"mkdir -p {output_dir} /installed-agent/agenthub-home", user="root")
        with tempfile.TemporaryDirectory(prefix="agenthub-request-") as temporary:
            request_file = Path(temporary) / "request.json"
            request_file.write_text(json.dumps(request), encoding="utf-8")
            request_file.chmod(0o600)
            await environment.upload_file(request_file, "/installed-agent/agenthub-request.json")

        metadata_env = {
            "AGENTHUB_EVAL_SOURCE_SHA": self.source_commit,
            "AGENTHUB_EVAL_PACKAGE_SHA256": self.archive_sha256,
            "AGENTHUB_EVAL_HARBOR_VERSION": "0.25.0",
            "AGENTHUB_EVAL_DATASET_VERSION": DATASET,
            "AGENTHUB_EVAL_IMAGE_DIGEST": IMAGE_DIGEST,
            "AGENTHUB_EVAL_TASK_SHA256": self.task_sha256,
        }
        metadata_assignments = " ".join(f"{name}={shlex.quote(value)}" for name, value in metadata_env.items())
        api_proxy_env = ({"NODE_USE_ENV_PROXY": "1", "HTTP_PROXY": self.api_proxy,
                          "HTTPS_PROXY": self.api_proxy} if self.api_proxy else {})
        api_proxy_assignments = " ".join(f"{name}={shlex.quote(value)}" for name, value in api_proxy_env.items())
        invocation = (
            f"timeout --signal=TERM --kill-after=15s {self.timeout_sec + 30}s "
            f"env -i PATH={NODE_PREFIX}/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin "
            "HOME=/installed-agent/agenthub-home LANG=C.UTF-8 "
            'OPENAI_API_KEY="$OPENAI_API_KEY" '
            f"{metadata_assignments} {api_proxy_assignments} "
            f"{NODE_PREFIX}/bin/node --import tsx eval/terminalbench/run-agenthub.ts "
            f"--request /installed-agent/agenthub-request.json > {output_dir}/cli.log 2>&1"
        )
        execution_error = None
        exit_code = None
        try:
            result = await environment.exec(invocation, cwd=RUNTIME_ROOT,
                                            env={"OPENAI_API_KEY": key},
                                            timeout_sec=self.timeout_sec + 60)
            exit_code = result.return_code
        except Exception as error:
            execution_error = type(error).__name__
        finally:
            await asyncio.wait_for(self._collect(environment, output_dir, key), timeout=45)

        status_file = self.logs_dir / "result.json"
        status = json.loads(status_file.read_text()) if status_file.exists() else {}
        usage = status.get("usage", {})
        if usage.get("complete") is True:
            context.n_input_tokens = usage.get("inputTokens")
            context.n_output_tokens = usage.get("outputTokens")
            context.n_cache_tokens = usage.get("cacheReadTokens")
        context.metadata = {
            "scope": "integration-smoke", "dataset": DATASET, "taskId": self.task_id,
            "officialTaskVersion": "2.2.0",
            "officialTaskName": f"terminal-bench/{self.task_id}",
            "group": self.group, "agentTimeoutSeconds": self.timeout_sec,
            "officialAgentTimeoutSeconds": 28800, "runtimeArchiveSha256": self.archive_sha256,
            "sourceCommit": self.source_commit, "taskTomlSha256": self.task_sha256,
            "imageIndexDigest": IMAGE_DIGEST,
            "setupProxy": self.setup_proxy,
            "apiProxy": self.api_proxy,
            "instructionSha256": hashlib.sha256(instruction.encode()).hexdigest(),
            "exitCode": exit_code, "executionError": execution_error,
            "runStatus": status.get("runStatus", "unknown"),
            "timedOut": status.get("timedOut"), "budgetExhausted": status.get("budgetExhausted"),
            "usageComplete": usage.get("complete", False),
        }
        (self.logs_dir / "harbor-agenthub.json").write_text(json.dumps(context.metadata, indent=2) + "\n")
        if execution_error:
            raise RuntimeError(f"AgentHub CLI execution failed (exit={exit_code}, error={execution_error}); retained logs contain execution status")
        if exit_code != 0:
            raise NonZeroAgentExitCodeError(f"AgentHub CLI exited {exit_code}; retained partial artifacts remain eligible for official verification")
        if not status_file.exists():
            raise RuntimeError("AgentHub CLI returned success without result.json; retained logs contain execution status")

    async def _collect(self, environment: BaseEnvironment, output_dir: str, key: str) -> None:
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        for name in OUTPUT_FILES:
            local = self.logs_dir / name
            try:
                await environment.download_file(f"{output_dir}/{name}", local)
            except Exception:
                continue
            local.write_text(local.read_text(encoding="utf-8").replace(key, "[REDACTED]"), encoding="utf-8")
