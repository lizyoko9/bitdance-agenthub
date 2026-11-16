import importlib.util
import copy
import hashlib
import json
import os
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

from tracetrial_bench.evidence_finder import EvidenceFinder
from tracetrial_bench.task_resolver import resolve_task
from tracetrial_bench.workspace import RunLayout

from eval.tracetrial.container_worker import CONFIRMATION_TASK_ID, TIMEOUT_TASK_ID
from eval.tracetrial import trace_adapter as adapter
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


def process_receipt():
    def process(pid, start_ticks, state='S'):
        return {'pid': pid, 'start_ticks': start_ticks, 'ppid': 1, 'pgid': pid, 'sid': pid,
                'state': state, 'uids': [0, 0, 0, 0] if pid < 3 else [1000, 1000, 1000, 1000]}
    def digest(records):
        identities = sorted([[record['pid'], record['start_ticks']] for record in records])
        return hashlib.sha256(json.dumps(identities, separators=(',', ':')).encode('ascii')).hexdigest()
    baseline, observed = [process(1, 10), process(2, 20)], [process(3, 30)]
    return {'schema_version': 'agenthub-process-observation-v1', 'scope': 'isolated_container_pid_delta',
        'measurement_only': True, 'observer_did_signal': False, 'natural_actor_exit': True, 'forced_stop': False,
        'tracking_failed': False, 'tracking_errors': [], 'baseline_verified': True, 'pid_namespace': 'pid:[123]',
        'private_pid_namespace': True, 'namespace_verification': 'driver_private_pidns_and_self_proc',
        'baseline_processes': baseline, 'actor_identity': {'pid': 3, 'start_ticks': 30},
        'observed_new_processes': observed, 'observed_new_process_count': 1, 'observed_new_count_is_lower_bound': True,
        'observed_identity_sha256': digest(observed), 'baseline_identity_sha256': digest(baseline),
        'sample_count': 12, 'final_census_count': 2, 'final_live_counts': [0, 0], 'final_censuses_complete': True,
        'residual_process_count': 0, 'residual_processes': [], 'zombie_process_count': 0,
        'sampling_interval_seconds': 0.01, 'final_census_interval_seconds': 0.01,
        'started_at': '2025-01-01T00:00:00+00:00', 'frozen_at': '2025-01-01T00:00:03+00:00',
        'descendant_cleanup_valid': True}


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

    def write_process(self, receipt):
        source = self.layout.agent_dir / 'native' / 'actor_process.json'
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text(json.dumps({'exit_code': 0, 'timed_out': False, 'process_containment': receipt}), encoding='utf-8')
        return source

    def timeout_case(self, payload, *, index=0, tool_name='bash'):
        self.task = resolve_task(UPSTREAM / 'Task' / TIMEOUT_TASK_ID)
        self.layout = replace(self.layout, artifacts_dir=self.root / ('artifacts-' + str(index)))
        native, result = native_fixture()
        native[3].update(toolName=tool_name, args={'command': 'bash /workspace/tools/sleep_timeout.sh', 'timeoutMs': 2000})
        native[4].update(result=payload, isError=payload.get('isError', False))
        summary, events = self.normalize(native, result)
        self.write_process(process_receipt())
        return summary, events

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
        original = native_fixture()[0][4]["result"]
        self.assertEqual(probes[0]["native_tool_result"], original)
        self.assertEqual(probes[0]["tool_result"], {**original, "tool_call_id": "call-1"})
        self.assertEqual(probes[0]["tool_result_projection"], {
            "version": "agenthub_transport_v2", "derived_fields": {"tool_call_id": "raw_event.callId"}})
        self.assertFalse(probes[0]["raw_event"]["isError"])
        self.assertNotIn("stdout", probes[0]["tool_result"])
        self.assertNotIn("stderr", probes[0]["tool_result"])
        self.assertEqual(self.parser.typed_exit_code(probes[0]["tool_result"]), 23)
        self.assertTrue(self.parser.final_response_exact(events))
        rows = evidence["post_tool_observations"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["tool_call_id"], "call-1")
        self.assertEqual(rows[0]["tool_result"], probes[0]["tool_result"])
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

    def test_e6_native_timeout_and_exact_worker_receipt_reach_official_evidence(self):
        self.task = resolve_task(UPSTREAM / 'Task' / TIMEOUT_TASK_ID)
        native, result = native_fixture()
        native[3]['args'] = {'command': 'bash /workspace/tools/sleep_timeout.sh', 'timeoutMs': 2000}
        native[4].update(isError=True, result={'exitCode': None, 'output': 'E3D_TIMEOUT_STARTED\n',
            'timedOut': True, 'aborted': False, 'signal': 'SIGTERM', 'status': 'failed', 'isError': True,
            'failure': {'kind': 'timeout', 'message': 'Command timed out after 2000ms'}})
        summary, events = self.normalize(native, result)
        receipt = process_receipt()
        source = self.write_process(receipt)
        evidence = json.loads(Path(emit_execution_evidence(self.task, self.layout, summary)).read_text())
        self.assertEqual(summary['process_containment'], receipt)
        self.assertEqual(evidence['process_containment'], receipt)
        self.assertEqual(summary['agenthub_process_containment_source'], {
            'path': str(source.resolve()), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'field': 'process_containment'})
        self.assertEqual(evidence['capability_report']['available'], ['native_exec_v1', 'post_tool_v1',
            'timeout_observation_v1', 'process_containment_v1'])
        event = next(event for event in events if event['event_type'] == 'tool')
        self.assertEqual(event['native_tool_result'], native[4]['result'])
        self.assertEqual(event['raw_event'], native[4])
        self.assertIs(event['tool_result']['timedOut'], True)
        self.assertNotIn('timed_out', event['tool_result'])
        self.assertNotIn('provider_executed', event['tool_result'])
        row = evidence['post_tool_observations'][0]
        self.assertEqual(row['arguments'], native[3]['args'])
        self.assertIs(row['error'], True)
        self.assertIs(row['tool_result']['timedOut'], True)
        self.assertIs(row['timed_out'], True)

    def test_confirmation_preserves_native_states_receipt_and_exact_helper_bytes_without_timeout_projection(self):
        self.task = resolve_task(UPSTREAM / 'Task' / CONFIRMATION_TASK_ID)
        helper = adapter.persist_execution_probe_evidence
        captured = []
        def capture(*args, **kwargs):
            path = helper(*args, **kwargs)
            captured.append(Path(path).read_bytes())
            return path
        for index, (code, status) in enumerate(((0, 'completed'), (75, 'failed'))):
            with self.subTest(code=code):
                self.layout = replace(self.layout, artifacts_dir=self.root / ('confirmation-' + str(index)))
                native, result = native_fixture()
                native[3]['args'] = {'command': 'bin/deployctl run --job DP-2026-07-3108'}
                terminal = {'job': 'DP-2026-07-3108', 'operation_id': 'synthetic-op',
                    'state': 'confirmed' if code == 0 else 'submitted'}
                terminal.update({'rows': 3, 'downstream_ms': 500} if code == 0 else
                    {'confirmation': 'unavailable', 'reason': 'channel_wait_window_elapsed'})
                payload = {'exitCode': code, 'status': status, 'isError': code != 0,
                    'timedOut': False, 'output': '\n'.join(json.dumps(record) for record in (
                        {'job': 'DP-2026-07-3108', 'operation_id': 'synthetic-op',
                            'state': 'submitted', 'accepted': True}, terminal))}
                native[4].update(result=payload, isError=code != 0)
                summary, events = self.normalize(native, result)
                receipt = process_receipt()
                source = self.write_process(receipt)
                with patch.object(adapter, 'persist_execution_probe_evidence', side_effect=capture), \
                        patch.object(adapter, '_project_timeout_observations') as timeout_bridge:
                    path = Path(emit_execution_evidence(self.task, self.layout, summary))
                    timeout_bridge.assert_not_called()
                self.assertEqual(path.read_bytes(), captured[-1])
                evidence = json.loads(path.read_bytes())
                self.assertEqual(summary['process_containment'], receipt)
                self.assertEqual(evidence['process_containment'], receipt)
                self.assertEqual(summary['agenthub_process_containment_source'], {
                    'path': str(source.resolve()), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                    'field': 'process_containment'})
                self.assertEqual(evidence['capability_report']['available'],
                    ['native_exec_v1', 'post_tool_v1', 'process_containment_v1'])
                event = next(row for row in events if row['event_type'] == 'tool')
                self.assertEqual(event['native_tool_result'], payload)
                self.assertEqual(event['raw_event'], native[4])
                self.assertEqual(event['tool_result'], {**payload, 'tool_call_id': 'call-1'})
                row = evidence['post_tool_observations'][0]
                self.assertEqual(row['tool_result'], event['tool_result'])
                self.assertEqual((row['source_event_seq'], row['tool_call_id'], row['arguments']),
                    (event['seq'], 'call-1', native[3]['args']))
                self.assertIs(type(row['exit_code']), int)
                self.assertEqual(row['exit_code'], code)
                self.assertIs(row['error'], code != 0)
                self.assertNotIn('agenthub_timeout_observer_projection', summary)
                self.assertFalse((path.parent / 'timeout-observer-projection.json').exists())
                self.assertEqual(list(path.parent.glob('evidence-official-helper-*.json')), [])

    def test_confirmation_missing_conflicting_and_malformed_process_evidence_cannot_be_claimed(self):
        self.task = resolve_task(UPSTREAM / 'Task' / CONFIRMATION_TASK_ID)
        clean, _ = self.normalize()
        with self.assertRaisesRegex(ValueError, 'apparatus source is missing'):
            emit_execution_evidence(self.task, self.layout, copy.deepcopy(clean))
        for changes in ({'private_pid_namespace': False}, {'residual_process_count': False},
                        {'observed_identity_sha256': '0' * 64}):
            with self.subTest(changes=changes):
                receipt = process_receipt()
                receipt.update(changes)
                self.write_process(receipt)
                summary = copy.deepcopy(clean)
                with self.assertRaisesRegex(ValueError, 'Invalid AgentHub process containment receipt'):
                    emit_execution_evidence(self.task, self.layout, summary)
                self.assertNotIn('process_containment', summary)
        self.write_process(process_receipt())
        for key, value in (('process_containment', process_receipt()),
                           ('agenthub_process_containment_source', {'path': '/untrusted'})):
            with self.subTest(competing=key):
                summary = {**copy.deepcopy(clean), key: value}
                with self.assertRaisesRegex(ValueError, 'competing receipt evidence'):
                    emit_execution_evidence(self.task, self.layout, summary)

    def test_confirmation_failed_or_unknown_measurements_retain_capability_and_exact_failures(self):
        self.task = resolve_task(UPSTREAM / 'Task' / CONFIRMATION_TASK_ID)
        clean, _ = self.normalize()
        residual = process_receipt()
        residual.update(descendant_cleanup_valid=False, residual_process_count=1,
            residual_processes=copy.deepcopy(residual['observed_new_processes']), final_live_counts=[1, 0])
        unknown = process_receipt()
        unknown.update(tracking_failed=True, tracking_errors=['scan:PermissionError'], final_census_count=1,
            final_live_counts=[0, None], final_censuses_complete=False, residual_process_count=None,
            residual_processes=None, zombie_process_count=None, descendant_cleanup_valid=False)
        for receipt in (residual, unknown):
            with self.subTest(receipt=receipt):
                summary = copy.deepcopy(clean)
                self.write_process(receipt)
                with patch.object(adapter, '_project_timeout_observations') as timeout_bridge:
                    path = emit_execution_evidence(self.task, self.layout, summary)
                    timeout_bridge.assert_not_called()
                evidence = json.loads(Path(path).read_bytes())
                self.assertEqual(evidence['process_containment'], receipt)
                self.assertTrue(evidence['capability_report']['compatible'])
                self.assertNotIn('timeout_observation_v1', evidence['capability_report']['available'])
                self.assertIs(evidence['process_containment']['descendant_cleanup_valid'], False)

    def test_e6_timeout_bridge_is_symmetric_and_archives_exact_helper_bytes_without_other_changes(self):
        helper = adapter.persist_execution_probe_evidence
        captured = []
        def capture(*args, **kwargs):
            path = helper(*args, **kwargs)
            captured.append(Path(path).read_bytes())
            return path
        for index, value in enumerate((True, False)):
            with self.subTest(value=value):
                payload = {'exitCode': None if value else 0, 'output': 'partial', 'timedOut': value,
                           'isError': value, 'status': 'failed' if value else 'completed'}
                if not value:
                    payload['timed_out'] = False
                summary, _ = self.timeout_case(payload, index=index)
                native_path = Path(summary['agenthub_native_sources']['events'])
                canonical_path = Path(summary['events_path'])
                before = (native_path.read_bytes(), canonical_path.read_bytes())
                with patch.object(adapter, 'persist_execution_probe_evidence', side_effect=capture):
                    path = emit_execution_evidence(self.task, self.layout, summary)
                evidence = json.loads(Path(path).read_bytes())
                original = json.loads(captured[-1])
                projection = summary['agenthub_timeout_observer_projection']
                self.assertEqual(Path(projection['raw_helper_evidence']['path']).read_bytes(), captured[-1])
                self.assertEqual(projection['raw_helper_evidence']['sha256'], hashlib.sha256(captured[-1]).hexdigest())
                self.assertEqual(projection['version'], 'agenthub_timeout_observer_v1')
                self.assertEqual(projection['status'], 'projected')
                self.assertEqual(projection['sha256'], hashlib.sha256(Path(projection['path']).read_bytes()).hexdigest())
                row = projection['rows'][0]
                self.assertEqual(row['original_helper_value'], False)
                self.assertIs(row['mapped_value'], value)
                self.assertEqual(row['source']['pointers'], ['/result/timedOut'] if value
                                 else ['/result/timedOut', '/result/timed_out'])
                self.assertEqual(row['source']['raw_line'], 5)
                self.assertEqual((row['source_event_seq'], row['tool_call_id']),
                                 (evidence['post_tool_observations'][0]['source_event_seq'], 'call-1'))
                self.assertIs(evidence['post_tool_observations'][0]['timed_out'], value)
                original['post_tool_observations'][0]['timed_out'] = value
                self.assertEqual(evidence, original)
                self.assertEqual((native_path.read_bytes(), canonical_path.read_bytes()), before)
                self.assertIn('no production gate execution asserted', projection['gate_decisions'])

    def test_e6_timeout_bridge_missing_fields_are_not_inferred(self):
        summary, _ = self.timeout_case({'written': True}, tool_name='fs_write')
        path = emit_execution_evidence(self.task, self.layout, summary)
        evidence = json.loads(Path(path).read_bytes())
        projection = summary['agenthub_timeout_observer_projection']
        raw = json.loads(Path(projection['raw_helper_evidence']['path']).read_bytes())
        self.assertEqual(evidence, raw)
        self.assertEqual(projection['rows'][0]['status'], 'not_applicable')
        self.assertEqual(projection['rows'][0]['reason'], 'source_missing')
        self.assertEqual(projection['rows'][0]['source']['pointers'], [])
        self.assertIs(projection['rows'][0]['mapped_value'], False)

    def test_e6_timeout_bridge_rejects_nonboolean_or_conflicting_aliases_after_raw_archive(self):
        payloads = ({'timedOut': 'true'}, {'timed_out': 'true'}, {'timedOut': 1},
                    {'timedOut': None}, {'timedOut': True, 'timed_out': False})
        for index, payload in enumerate(payloads):
            with self.subTest(payload=payload):
                summary, _ = self.timeout_case(payload, index=index)
                with self.assertRaisesRegex(ValueError, 'native timeout alias'):
                    emit_execution_evidence(self.task, self.layout, summary)
                projection = summary['agenthub_timeout_observer_projection']
                original = Path(projection['raw_helper_evidence']['path']).read_bytes()
                self.assertEqual(Path(self.layout.artifacts_dir / 'execution_probe/evidence.json').read_bytes(), original)
                self.assertEqual(projection['status'], 'rejected')
                self.assertEqual(projection['raw_helper_evidence']['sha256'], hashlib.sha256(original).hexdigest())
                self.assertEqual(projection['rows'][0]['status'], 'rejected')
                self.assertIsNone(projection['rows'][0]['mapped_value'])
                self.assertTrue(projection['rows'][0]['source']['pointers'])

    def test_e6_timeout_bridge_rejects_mismatched_duplicate_or_type_changed_evidence(self):
        helper = adapter.persist_execution_probe_evidence
        def corrupt(kind):
            def mutate(*args, **kwargs):
                path = helper(*args, **kwargs)
                evidence = json.loads(Path(path).read_text())
                row = evidence['post_tool_observations'][0]
                if kind == 'call':
                    row['tool_call_id'] = 'another-call'
                elif kind == 'args':
                    row['arguments']['timeoutMs'] = 2000.0
                elif kind == 'result':
                    row['tool_result']['timedOut'] = 1
                elif kind == 'duplicate_post':
                    evidence['post_tool_observations'].append(copy.deepcopy(row))
                elif kind == 'duplicate_canonical':
                    source = Path(kwargs['trace_summary']['events_path'])
                    events = json.loads(source.read_text())
                    events.append(copy.deepcopy(next(event for event in events if event['event_type'] == 'tool')))
                    source.write_text(json.dumps(events))
                elif kind == 'duplicate_native':
                    summary = kwargs['trace_summary']
                    source = Path(summary['agenthub_native_sources']['events'])
                    data = source.read_bytes()
                    source.write_bytes(data + data.splitlines(keepends=True)[4])
                    summary['agenthub_native_sources']['events_sha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
                Path(path).write_text(json.dumps(evidence))
                return path
            return mutate
        for index, kind in enumerate(('call', 'args', 'result', 'duplicate_post', 'duplicate_canonical', 'duplicate_native')):
            with self.subTest(kind=kind):
                summary, _ = self.timeout_case({'timedOut': True}, index=index)
                with patch.object(adapter, 'persist_execution_probe_evidence', side_effect=corrupt(kind)):
                    with self.assertRaisesRegex(ValueError, 'E6 timeout observer apparatus failed'):
                        emit_execution_evidence(self.task, self.layout, summary)
                projection = summary['agenthub_timeout_observer_projection']
                original = Path(projection['raw_helper_evidence']['path']).read_bytes()
                self.assertEqual(Path(self.layout.artifacts_dir / 'execution_probe/evidence.json').read_bytes(), original)
                self.assertEqual(projection['status'], 'rejected')

    def test_real_fakeproc_observer_receipts_pass_the_same_host_validator(self):
        from .test_process_observer import ProcessObserverTests
        for case in ('clean', 'leak', 'unknown', 'baseline_failure', 'missing_contract', 'baseline_confirmation'):
            with self.subTest(case=case):
                fixture = ProcessObserverTests(methodName='runTest')
                fixture.setUp()
                try:
                    if case in ('baseline_failure', 'missing_contract', 'baseline_confirmation'):
                        if case == 'missing_contract':
                            fixture.observer = type(fixture.observer)(proc_root=fixture.proc, worker_pid=10,
                                private_pid_namespace=False, sleeper=lambda _: None)
                        elif case == 'baseline_failure':
                            fixture.process(99)
                        else:
                            original = fixture.observer._snapshot
                            calls = 0
                            def arrives(**kwargs):
                                nonlocal calls
                                calls += 1
                                if calls == 2:
                                    fixture.process(99)
                                return original(**kwargs)
                            fixture.patch('_snapshot', arrives, fixture.observer)
                        with self.assertRaises(RuntimeError):
                            fixture.observer.start()
                        receipt = fixture.observer.freeze(natural_exit=False)
                        if case == 'baseline_confirmation':
                            self.assertTrue(any(row['pid'] == 99 for row in receipt['observed_new_processes']))
                            self.assertFalse(any('TypeError' in item for item in receipt['tracking_errors']))
                    else:
                        fixture.start_actor()
                        fixture.remove(20)
                        if case == 'leak':
                            fixture.process(30, ppid=1, uids=(0, 0, 0, 0))
                        if case == 'unknown':
                            with patch.object(fixture.observer, '_read_record', side_effect=PermissionError):
                                receipt = fixture.observer.freeze(natural_exit=True)
                        else:
                            receipt = fixture.observer.freeze(natural_exit=True)
                    self.assertEqual(adapter._validate_process_receipt(receipt), receipt)
                finally:
                    fixture.doCleanups()

    def test_e6_failed_and_unknown_receipts_stay_measured_failures_with_available_capabilities(self):
        self.task = resolve_task(UPSTREAM / 'Task' / TIMEOUT_TASK_ID)
        clean, _ = self.normalize()
        residual = process_receipt()
        residual.update(natural_actor_exit=False, forced_stop=True, descendant_cleanup_valid=False,
            residual_process_count=1, residual_processes=copy.deepcopy(residual['observed_new_processes']), final_live_counts=[1, 0])
        unknown = process_receipt()
        unknown.update(tracking_failed=True, tracking_errors=['scan:PermissionError'], final_census_count=1,
            final_live_counts=[0, None], final_censuses_complete=False, residual_process_count=None,
            residual_processes=None, zombie_process_count=None, descendant_cleanup_valid=False)
        baseline_failed = copy.deepcopy(unknown)
        baseline_failed.update(natural_actor_exit=False, baseline_verified=False, actor_identity=None,
            baseline_processes=[], baseline_identity_sha256=None, pid_namespace=None, private_pid_namespace=False,
            observed_new_processes=[],
            observed_new_process_count=0, observed_identity_sha256=hashlib.sha256(b'[]').hexdigest(),
            final_census_count=0, final_live_counts=[None, None])
        for receipt in (residual, unknown, baseline_failed):
            with self.subTest(receipt=receipt):
                summary = copy.deepcopy(clean)
                self.write_process(receipt)
                evidence = json.loads(Path(emit_execution_evidence(self.task, self.layout, summary)).read_text())
                self.assertEqual(evidence['process_containment'], receipt)
                self.assertTrue(evidence['capability_report']['compatible'])
                self.assertIs(evidence['process_containment']['descendant_cleanup_valid'], False)
                self.assertEqual(evidence['process_containment']['residual_process_count'], receipt['residual_process_count'])

    def test_e6_missing_or_malformed_process_evidence_is_an_apparatus_error(self):
        self.task = resolve_task(UPSTREAM / 'Task' / TIMEOUT_TASK_ID)
        summary, _ = self.normalize()
        with self.assertRaisesRegex(ValueError, 'apparatus source is missing'):
            emit_execution_evidence(self.task, self.layout, summary)
        source = self.write_process(process_receipt())
        for data in ('null', '{}', '{', '{"process_containment":null}'):
            with self.subTest(data=data):
                source.write_text(data)
                with self.assertRaisesRegex(ValueError, 'process containment'):
                    emit_execution_evidence(self.task, self.layout, summary)
        source.unlink()
        source.symlink_to(self.result_path)
        with self.assertRaisesRegex(ValueError, 'must not be a symlink'):
            emit_execution_evidence(self.task, self.layout, summary)
        self.assertNotIn('process_containment', summary)

    def test_e6_receipt_types_and_counts_are_strict_before_official_evidence_is_emitted(self):
        self.task = resolve_task(UPSTREAM / 'Task' / TIMEOUT_TASK_ID)
        summary, _ = self.normalize()
        changes = ({'schema_version': 'other'}, {'scope': 'host'}, {'observer_did_signal': True},
            {'measurement_only': 1}, {'descendant_cleanup_valid': 1}, {'observed_new_process_count': True},
            {'observed_new_process_count': 0}, {'observed_identity_sha256': '0' * 64},
            {'residual_process_count': False}, {'final_census_count': True}, {'final_live_counts': [0, False]},
            {'residual_process_count': 1}, {'final_censuses_complete': False}, {'natural_actor_exit': False},
            {'forced_stop': True}, {'tracking_failed': True}, {'baseline_verified': False},
            {'private_pid_namespace': False}, {'private_pid_namespace': 1}, {'namespace_verification': 'assumed'},
            {'observed_new_processes': [{'pid': 3}]}, {'extra': 'not the installed schema'})
        for changeset in changes:
            with self.subTest(changes=changeset):
                receipt = process_receipt()
                receipt.update(changeset)
                self.write_process(receipt)
                with self.assertRaisesRegex(ValueError, 'Invalid AgentHub process containment receipt'):
                    emit_execution_evidence(self.task, self.layout, summary)
                self.assertNotIn('process_containment', summary)

    def test_existing_tasks_ignore_unrelated_process_receipts(self):
        summary, _ = self.normalize()
        self.write_process({'not': 'a receipt'})
        evidence = json.loads(Path(emit_execution_evidence(self.task, self.layout, summary)).read_text())
        self.assertIsNone(evidence['process_containment'])
        self.assertNotIn('agenthub_process_containment_source', summary)


if __name__ == "__main__":
    unittest.main()
