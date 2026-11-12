import asyncio
import importlib.util
import io
import json
from pathlib import Path
import shlex
import tarfile
import tempfile
import unittest
from unittest.mock import patch

from harbor.models.agent.context import AgentContext
from harbor.environments.base import ExecResult

from agenthub_agent import AgentHubAgent, NonZeroAgentExitCodeError


spec = importlib.util.spec_from_file_location("prepare_runtime", Path(__file__).with_name("prepare-runtime.py"))
packaging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packaging)


class RuntimePackagingTests(unittest.TestCase):
    def test_archive_excludes_credentials_host_dependencies_and_answers(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for filename in packaging.EXPLICIT_FILES:
                target = root / filename
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("{}\n")
            for filename in ("src/server/service.ts", ".env.local", "node_modules/x.js",
                             "eval/tasks/example/solution/solve.ts", "src/server/service.test.ts"):
                target = root / filename
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("host-secret-canary")
            with patch.object(packaging.subprocess, "check_output", return_value="test-commit\n"):
                metadata = packaging.prepare(root, root / "runtime.tar.gz")
            with tarfile.open(metadata["archive"]) as archive:
                names = archive.getnames()
                bundled_package = json.load(archive.extractfile("package.json"))
                manifest = json.load(archive.extractfile("runtime-source.json"))
            self.assertEqual(bundled_package["type"], "module")
            self.assertEqual(manifest["evaluationOnlyOverrides"], {"package.json": {"type": "module"}})
            self.assertIn("src/server/service.ts", names)
            self.assertNotIn(".env.local", names)
            self.assertNotIn("node_modules/x.js", names)
            self.assertNotIn("eval/tasks/example/solution/solve.ts", names)
            self.assertNotIn("src/server/service.test.ts", names)

    def test_rejects_source_symlink_to_secret(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for filename in packaging.EXPLICIT_FILES:
                target = root / filename
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("{}\n")
            secret = root / ".env.local"
            secret.write_text("secret")
            (root / "src/server").mkdir(parents=True, exist_ok=True)
            (root / "src/server/escape.ts").symlink_to(secret)
            with self.assertRaisesRegex(ValueError, "non-symlink"):
                packaging.source_files(root)


class FakeEnvironment:
    def __init__(self, status, exit_code=0):
        self.commands = []
        self.uploaded_request = None
        self.status = status
        self.exit_code = exit_code

    async def exec(self, command, **kwargs):
        self.commands.append((command, kwargs))
        return ExecResult(stdout="/app\n" if command == "pwd" else "", stderr="",
                          return_code=0 if command == "pwd" or command.startswith("mkdir") else self.exit_code)

    async def upload_file(self, source, target):
        self.uploaded_request = json.loads(Path(source).read_text())

    async def download_file(self, source, target):
        filename = source.rsplit("/", 1)[-1]
        Path(target).write_text(json.dumps(self.status) if filename == "result.json" else "test-secret")


class InstalledAgentTests(unittest.TestCase):
    def test_preserves_instruction_and_sets_unknown_usage_without_cost(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "source.tar.gz"
            self._write_source_archive(archive)
            logs = Path(temporary) / "logs"
            agent = AgentHubAgent(logs_dir=logs, runtime_archive=str(archive), task_sha256="0" * 64,
                                  model_name="openai/gpt-6-luna")
            environment = FakeEnvironment({"runStatus": "complete", "usage": {"complete": False}})
            context = AgentContext()
            with patch.dict("os.environ", {"OPENAI_API_KEY": "test-secret"}, clear=True):
                asyncio.run(agent.run("Exact official instruction\n", environment, context))
            self.assertEqual(environment.uploaded_request["instruction"], "Exact official instruction\n")
            self.assertNotIn("apiKey", environment.uploaded_request)
            self.assertEqual(environment.uploaded_request["taskId"], "bun-sourcemap-leak")
            command, kwargs = environment.commands[-1]
            self.assertIn("timeout --signal=TERM --kill-after=15s 630s", command)
            self.assertNotIn("test-secret", command)
            self.assertIn("AGENTHUB_EVAL_SOURCE_SHA=" + "a" * 40, command)
            self.assertIn("AGENTHUB_EVAL_TASK_SHA256=" + "0" * 64, command)
            self.assertEqual(kwargs["env"], {"OPENAI_API_KEY": "test-secret"})
            self.assertNotIn("NODE_USE_ENV_PROXY=", command)
            self.assertNotIn("HTTP_PROXY=", command)
            self.assertNotIn("HTTPS_PROXY=", command)
            self.assertIsNone(context.n_input_tokens)
            self.assertIsNone(context.cost_usd)
            self.assertEqual(context.metadata["scope"], "integration-smoke")
            self.assertIsNone(context.metadata["apiProxy"])
            self.assertEqual((logs / "events.jsonl").read_text(), "[REDACTED]")

    def test_explicit_api_proxy_is_scoped_to_the_filtered_node_invocation(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "source.tar.gz"
            self._write_source_archive(archive)
            agent = AgentHubAgent(logs_dir=Path(temporary) / "logs", runtime_archive=str(archive),
                                  task_sha256="0" * 64, api_proxy="http://192.168.5.2:7890/",
                                  setup_proxy="http://192.168.5.2:7891")
            environment = FakeEnvironment({"runStatus": "complete", "usage": {"complete": False}})
            context = AgentContext()
            with patch.dict("os.environ", {"OPENAI_API_KEY": "test-secret", "ALL_PROXY": "socks5://host-only:9999",
                                            "NO_PROXY": "api.openai.com", "NODE_OPTIONS": "--host-option"}, clear=True):
                asyncio.run(agent.run("task", environment, context))
            command, kwargs = environment.commands[-1]
            tokens = shlex.split(command)
            self.assertIn("env", tokens)
            self.assertIn("-i", tokens)
            self.assertIn("NODE_USE_ENV_PROXY=1", tokens)
            self.assertIn("HTTP_PROXY=http://192.168.5.2:7890", tokens)
            self.assertIn("HTTPS_PROXY=http://192.168.5.2:7890", tokens)
            self.assertNotIn("7891", command)
            self.assertNotIn("ALL_PROXY=", command)
            self.assertNotIn("NO_PROXY=", command)
            self.assertNotIn("NODE_OPTIONS=", command)
            self.assertNotIn("test-secret", command)
            self.assertEqual(kwargs["env"], {"OPENAI_API_KEY": "test-secret"})
            self.assertNotIn("api_proxy", environment.uploaded_request)
            self.assertEqual(context.metadata["apiProxy"], "http://192.168.5.2:7890")
            self.assertEqual(context.metadata["setupProxy"], "http://192.168.5.2:7891")
            retained = json.loads((agent.logs_dir / "harbor-agenthub.json").read_text())
            self.assertEqual(retained["apiProxy"], context.metadata["apiProxy"])

    def test_setup_proxy_does_not_implicitly_route_the_model_api(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "source.tar.gz"
            self._write_source_archive(archive)
            agent = AgentHubAgent(logs_dir=Path(temporary) / "logs", runtime_archive=str(archive),
                                  task_sha256="0" * 64, setup_proxy="http://192.168.5.2:7890")
            environment = FakeEnvironment({"runStatus": "complete", "usage": {"complete": False}})
            with patch.dict("os.environ", {"OPENAI_API_KEY": "test-secret", "HTTP_PROXY": "http://host-only:1234"}, clear=True):
                asyncio.run(agent.run("task", environment, AgentContext()))
            command, _ = environment.commands[-1]
            self.assertNotIn("NODE_USE_ENV_PROXY=", command)
            self.assertNotIn("HTTP_PROXY=", command)
            self.assertNotIn("HTTPS_PROXY=", command)
            self.assertNotIn("host-only", command)

    def test_api_proxy_rejects_embedded_credentials_and_invalid_proxy_urls(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "source.tar.gz"
            self._write_source_archive(archive)
            for proxy in ("http://user:secret@192.168.5.2:7890", "socks5://192.168.5.2:7890",
                          "http://192.168.5.2:7890/path", "http://192.168.5.2:7890?token=x",
                          "http://192.168.5.2:7890#fragment", "http://192.168.5.2"):
                with self.subTest(proxy=proxy), self.assertRaises(ValueError):
                    AgentHubAgent(logs_dir=Path(temporary) / "logs", runtime_archive=str(archive),
                                  task_sha256="0" * 64, api_proxy=proxy)

    def test_maps_only_complete_reported_usage(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "source.tar.gz"
            self._write_source_archive(archive)
            agent = AgentHubAgent(logs_dir=Path(temporary) / "logs", runtime_archive=str(archive), task_sha256="0" * 64)
            context = AgentContext()
            environment = FakeEnvironment({"usage": {"complete": True, "inputTokens": 42,
                                                       "outputTokens": 7, "cacheReadTokens": 3}})
            with patch.dict("os.environ", {"OPENAI_API_KEY": "test-secret"}, clear=True):
                asyncio.run(agent.run("task", environment, context))
            self.assertEqual((context.n_input_tokens, context.n_output_tokens, context.n_cache_tokens), (42, 7, 3))

    def _write_source_archive(self, destination):
        payload = json.dumps({"agenthubCommit": "a" * 40}).encode()
        with tarfile.open(destination, "w:gz") as archive:
            entry = tarfile.TarInfo("runtime-source.json")
            entry.size = len(payload)
            archive.addfile(entry, io.BytesIO(payload))

    def test_cli_failure_uses_harbor_exception_that_still_runs_verification(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "source.tar.gz"
            self._write_source_archive(archive)
            agent = AgentHubAgent(logs_dir=Path(temporary) / "logs", runtime_archive=str(archive), task_sha256="0" * 64)
            environment = FakeEnvironment({"runStatus": "failed", "budgetExhausted": True,
                                           "usage": {"complete": False}}, exit_code=1)
            context = AgentContext()
            with patch.dict("os.environ", {"OPENAI_API_KEY": "test-secret"}, clear=True):
                with self.assertRaises(NonZeroAgentExitCodeError):
                    asyncio.run(agent.run("task", environment, context))
            self.assertTrue(context.metadata["budgetExhausted"])
            self.assertEqual(context.metadata["exitCode"], 1)


if __name__ == "__main__":
    unittest.main()
