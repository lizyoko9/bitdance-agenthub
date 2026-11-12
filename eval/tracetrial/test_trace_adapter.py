import importlib.util
import json
import os
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from tracetrial_bench.evidence_finder import EvidenceFinder
from tracetrial_bench.task_resolver import resolve_task
from tracetrial_bench.workspace import RunLayout

from eval.tracetrial.trace_adapter import emit_execution_evidence, normalize_agenthub_trace


UPSTREAM = Path(os.environ.get("TRACETRIAL_SOURCE", "/private/tmp/agenthub-tracetrial-source"))
TASK_DIR = UPSTREAM / "Task" / "E8-exit-code-masked-by-output-001"


def native_fixture():
    data = [
        {"type": "message.added", "message": {"id": "user", "role": "user"}},
        {"type": "run.start", "runId": "root", "agentId": "actor"},
        {"type": "message.start", "messageId": "m1", "runId": "root", "agentId": "actor"},
        {"type": "tool.call", "messageId": "m1", "callId": "call-1", "toolName": "bash",
         "args": {"command": "bash /workspace/tools/ok_then_fail.sh"}},
        {"type": "tool.result", "messageId": "m1", "callId": "call-1", "isError": False,
         "result": {"exitCode": 23, "output": "STATUS: OK\nRESULT: complete\n"}},
        {"type": "message.end", "messageId": "m1"},
        {"type": "message.start", "messageId": "m2", "runId": "root", "agentId": "actor"},
        {"type": "part.start", "messageId": "m2", "partIndex": 0,
         "part": {"type": "text", "content": ""}},
        {"type": "part.delta", "messageId": "m2", "partIndex": 0,
         "delta": {"type": "text.append", "text": "E4B_"}},
        {"type": "part.delta", "messageId": "m2", "partIndex": 0,
         "delta": {"type": "text.append", "text": "DONE"}},
        {"type": "part.end", "messageId": "m2", "partIndex": 0},
        {"type": "message.end", "messageId": "m2"},
        {"type": "run.usage", "runId": "root", "usage": {"inputTokens": 120, "outputTokens": 40}},
        {"type": "run.end", "runId": "root", "status": "complete"},
    ]
    for index, event in enumerate(data):
        event.update(conversationId="synthetic-conversation", timestamp=1735689600000 + index)
    result = {"runStatus": "complete", "terminationReason": "completed", "rootRunIds": ["root"],
              "runs": [{"runId": "root", "status": "complete"}], "allRunsSettled": True,
              "timedOut": False, "modelId": "synthetic-model",
              "usage": {"complete": True, "observedRequests": 2, "inputTokens": 120, "outputTokens": 40}}
    return data, result


class TraceAdapterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.task = resolve_task(TASK_DIR)
        spec = importlib.util.spec_from_file_location("e8_official_parser", TASK_DIR / "verifier" / "score.py")
        cls.parser = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.parser)

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="agenthub-trace-synthetic-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.layout = RunLayout(**{name: self.root / value for name, value in {
            "run_dir": "run", "agent_dir": "run/agent", "workspace_dir": "run/agent/workspace",
            "private_dir": "private", "verifier_dir": "private/verifier",
            "artifacts_dir": "run/artifacts", "baseline_dir": "run/baseline",
        }.items()})
        self.events_path = self.root / "native-events.jsonl"
        self.result_path = self.root / "native-result.json"
        self.actor_metadata = {"model": "synthetic-model", "exit_code": 0, "timed_out": False,
                               "cwd": "/workspace"}

    def normalize(self, events=None, result=None):
        default_events, default_result = native_fixture()
        events = default_events if events is None else events
        result = default_result if result is None else result
        self.events_path.write_text("".join(json.dumps(event) + "\n" for event in events), encoding="utf-8")
        self.result_path.write_text(json.dumps(result), encoding="utf-8")
        summary = normalize_agenthub_trace(task=self.task, layout=self.layout,
                                          native_events_path=self.events_path, native_result_path=self.result_path,
                                          actor_metadata=self.actor_metadata)
        normalized = json.loads(Path(summary["events_path"]).read_text())
        return summary, normalized

    def test_native_values_and_lifecycle_reach_official_e8_parsers(self):
        summary, events = self.normalize()
        evidence_path = emit_execution_evidence(self.task, self.layout, summary)
        evidence = json.loads(Path(evidence_path).read_text())
        self.assertEqual(summary["status"], "finished")
        self.assertTrue(summary["trace_complete"])
        self.assertEqual(summary["structured_trace_status"], "available")
        self.assertEqual(summary["final_answer"], "E4B_DONE")
        self.assertEqual(events[0]["event_type"], "run_started")
        self.assertEqual(events[-1]["event_type"], "run_finished")
        self.assertEqual([event["seq"] for event in events], list(range(1, len(events) + 1)))
        self.assertEqual(summary["tool_stats"]["total_tool_calls"], 1)
        self.assertEqual(summary["tool_stats"]["total_tool_results"], 1)
        probes = self.parser.unique_probe_events(self.parser.trace_events(self.layout.run_dir))
        self.assertEqual(len(probes), 1)
        self.assertEqual(probes[0]["tool_result"], native_fixture()[0][4]["result"])
        self.assertFalse(probes[0]["raw_event"]["isError"])
        self.assertNotIn("stdout", probes[0]["tool_result"])
        self.assertNotIn("stderr", probes[0]["tool_result"])
        self.assertEqual(self.parser.typed_exit_code(probes[0]["tool_result"]), 23)
        self.assertTrue(self.parser.final_response_exact(events))
        rows = evidence["post_tool_observations"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["tool_call_id"], "call-1")
        self.assertEqual(rows[0]["exit_code"], 23)
        self.assertIs(rows[0]["error"], False)
        # This contradiction must remain measurable, rather than repaired by normalization.
        self.assertFalse(self.parser.observer_has_coherent_typed_failure(rows[0]))
        lifecycle, reason = self.parser.trace_lifecycle_complete(events, [summary], probes, rows)
        self.assertTrue(lifecycle, reason)
        self.assertEqual(evidence["capability_report"]["available"], ["native_exec_v1", "post_tool_v1"])
        self.assertEqual(json.loads(Path(summary["summary_path"]).read_text())["execution_probe_evidence"], evidence_path)
        finder = EvidenceFinder(run_dir=self.layout.run_dir, workspace_dir=self.layout.workspace_dir,
                                baseline_dir=self.layout.baseline_dir, trace_summary=summary)
        self.assertTrue(any(event.get("source") == "harnessbench.execution_probe" for event in finder.events))

    def test_original_source_and_text_fragment_provenance_are_retained(self):
        summary, events = self.normalize()
        sources = summary["agenthub_native_sources"]
        self.assertEqual(Path(sources["events"]).read_bytes(), self.events_path.read_bytes())
        self.assertEqual(Path(sources["result"]).read_bytes(), self.result_path.read_bytes())
        final = [event for event in events if event["event_type"] == "assistant_message"][-1]
        self.assertEqual([ref["line"] for ref in final["source_refs"]], [7, 8, 9, 10, 11, 12])
        self.assertEqual(final["timestamp"], "2025-01-01T00:00:00.011000Z")
        self.assertEqual(summary["agenthub_input_prelude_sources"][0]["line"], 1)
        self.assertEqual(summary["agenthub_actor_usage"]["observedRequests"], 2)
        self.assertEqual(summary["token_usage"]["call_count"], 0)
        self.assertEqual(summary["token_usage"]["input_tokens"], "unknown")

    def test_duplicate_result_is_not_counted_twice(self):
        native, result = native_fixture()
        native.insert(5, dict(native[4]))
        summary, events = self.normalize(native, result)
        self.assertEqual(len([event for event in events if event["event_type"] == "tool"]), 1)
        self.assertEqual(summary["tool_stats"]["total_tool_calls"], 1)
        self.assertFalse(summary["trace_complete"])
        self.assertEqual(summary["structured_trace_status"], "partial")
        self.assertTrue(any("duplicate native tool result" in message for message in summary["agenthub_normalization_diagnostics"]))

    def test_missing_result_is_incomplete_despite_zero_process_exit(self):
        native, result = native_fixture()
        del native[4]
        summary, events = self.normalize(native, result)
        self.assertFalse(summary["trace_complete"])
        self.assertEqual(summary["structured_trace_status"], "partial")
        self.assertEqual(summary["tool_stats"]["total_tool_results"], 0)
        self.assertFalse(any(event["event_type"] == "tool" for event in events))
        self.assertTrue(any("without a matching result" in message for message in summary["agenthub_normalization_diagnostics"]))

    def test_missing_native_close_is_not_structured_available(self):
        native, result = native_fixture()
        native.pop()
        summary, _ = self.normalize(native, result)
        self.assertFalse(summary["trace_complete"])
        self.assertEqual(summary["structured_trace_status"], "partial")
        self.assertEqual(summary["error_type"], "normalization_incomplete")

    def test_open_message_and_result_status_mismatch_are_incomplete(self):
        native, result = native_fixture()
        del native[11]
        result["runs"][0]["status"] = "failed"
        summary, _ = self.normalize(native, result)
        self.assertFalse(summary["trace_complete"])
        self.assertIsNone(summary["final_answer"])
        diagnostics = summary["agenthub_normalization_diagnostics"]
        self.assertTrue(any("messages remain open" in message for message in diagnostics))
        self.assertTrue(any("run statuses do not match" in message for message in diagnostics))

    def test_native_failure_keeps_closed_trace_and_original_reason(self):
        native, result = native_fixture()
        native[-1].update(status="failed", error="iteration_limit: no final answer")
        result.update(runStatus="failed", terminationReason="iteration_limit", error=native[-1]["error"])
        result["runs"][0]["status"] = "failed"
        self.actor_metadata["exit_code"] = 1
        summary, events = self.normalize(native, result)
        self.assertEqual(summary["status"], "failed")
        self.assertFalse(summary["trace_complete"])
        self.assertEqual(summary["structured_trace_status"], "available")
        self.assertEqual(summary["error_type"], "iteration_limit")
        self.assertEqual(summary["agenthub_native_termination_reason"], "iteration_limit")
        self.assertEqual(events[-1]["raw_event"]["status"], "failed")
        self.assertTrue(any(event["event_type"] == "run_failed" for event in events))

    def test_malformed_native_source_stays_partial(self):
        self.events_path.write_text('{"type":"run.start","runId":[]}\ninvalid-json\n', encoding="utf-8")
        self.result_path.write_text("null", encoding="utf-8")
        summary = normalize_agenthub_trace(task=self.task, layout=self.layout,
                                          native_events_path=self.events_path, native_result_path=self.result_path,
                                          actor_metadata=self.actor_metadata)
        self.assertFalse(summary["trace_complete"])
        self.assertEqual(summary["structured_trace_status"], "partial")
        self.assertTrue(any("Invalid native JSON" in message for message in summary["agenthub_normalization_diagnostics"]))

    def test_capability_admission_does_not_claim_unimplemented_features(self):
        summary, _ = self.normalize()
        task = replace(self.task, execution_probe=replace(self.task.execution_probe,
                       requires=("native_exec_v1", "native_child_delegation_v1")))
        with self.assertRaisesRegex(ValueError, "native_child_delegation_v1"):
            emit_execution_evidence(task, self.layout, summary)
        capability = json.loads((self.layout.artifacts_dir / "execution_probe" / "capabilities.json").read_text())
        self.assertFalse(capability["compatible"])
        self.assertEqual(capability["available"], ["native_exec_v1", "post_tool_v1"])


if __name__ == "__main__":
    unittest.main()
