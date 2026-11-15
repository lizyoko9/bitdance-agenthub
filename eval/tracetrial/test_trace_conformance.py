import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from tracetrial_bench.evidence_finder import EvidenceFinder
from tracetrial_bench.task_resolver import resolve_task
from tracetrial_bench.workspace import RunLayout

from .test_trace_adapter import UPSTREAM, native_fixture
from .trace_adapter import emit_execution_evidence, normalize_agenthub_trace


class TerminalConformanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tasks = {}
        cls.parsers = {}
        for identifier in ('E7-failed-command-stale-artifact-002', 'E8-lintgate-exit-masked-002'):
            directory = UPSTREAM/'Task'/identifier
            cls.tasks[identifier] = resolve_task(directory)
            spec = importlib.util.spec_from_file_location(identifier, directory/'verifier/score.py')
            parser = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(parser)
            cls.parsers[identifier] = parser

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='agenthub-terminal-conformance-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.sequence = 0

    def normalize(self, native=None, result=None, metadata=None, task=None):
        original, original_result = native_fixture()
        native = original if native is None else native
        result = original_result if result is None else result
        task = task or self.tasks['E8-lintgate-exit-masked-002']
        self.sequence += 1
        run = self.root/str(self.sequence)
        run.mkdir()
        layout = RunLayout(run_dir=run, agent_dir=run/'agent', workspace_dir=run/'agent/workspace',
            private_dir=run/'private', verifier_dir=run/'private/verifier', artifacts_dir=run/'artifacts',
            baseline_dir=run/'private/baseline')
        source_events, source_result = run/'events.jsonl', run/'result.json'
        event_bytes = ''.join(json.dumps(event) + '\n' for event in native).encode()
        result_bytes = json.dumps(result).encode()
        source_events.write_bytes(event_bytes)
        source_result.write_bytes(result_bytes)
        summary = normalize_agenthub_trace(task=task, layout=layout, native_events_path=source_events,
            native_result_path=source_result, actor_metadata=metadata or {
                'model': 'synthetic-model', 'exit_code': 0, 'timed_out': False, 'cwd': '/workspace'})
        events = json.loads(Path(summary['events_path']).read_text())
        self.assertEqual(Path(summary['agenthub_native_sources']['events']).read_bytes(), event_bytes)
        self.assertEqual(Path(summary['agenthub_native_sources']['result']).read_bytes(), result_bytes)
        for event in events:
            self.assertEqual(event['raw_event'], native[event['source_refs'][-1]['line']-1])
            if event['event_type'] == 'tool':
                original = event['raw_event']['result']
                self.assertEqual(event['native_tool_result'], original)
                expected = {**original, 'tool_call_id': event['raw_event']['callId']}
                self.assertEqual(event['tool_result'], expected)
                self.assertEqual(event['tool_result_projection'], {
                    'version': 'agenthub_transport_v2', 'derived_fields': {'tool_call_id': 'raw_event.callId'}})
        for event in events:
            if event['event_type'] == 'run_finished':
                self.assertIs(event['trace_complete'], summary['trace_complete'])
                self.assertNotIn('trace_complete', event['raw_event'])
        return layout, summary, events

    def test_pinned_e7_terminal_and_sidecar_correlation_contract(self):
        task = self.tasks['E7-failed-command-stale-artifact-002']
        parser = self.parsers[task.task_id]
        native, result = native_fixture()
        native[3]['args']['command'] = 'bash /workspace/tools/write_then_fail.sh'
        native[4].update(isError=True, result={'exitCode': 42, 'output': 'WROTE_STALE_SUCCESS_ARTIFACT\n',
                                             'status': 'failed', 'isError': True})
        native[8]['delta']['text'] = 'E4A_'
        layout, summary, events = self.normalize(native, result, task=task)
        before = Path(summary['events_path']).read_bytes()
        sidecar = json.loads(Path(emit_execution_evidence(task, layout, summary)).read_text())
        loaded_events, loaded_summary = parser.trace_data(layout.run_dir, sidecar)
        self.assertTrue(parser.lifecycle_complete(loaded_events, loaded_summary))
        probes = [event for event in loaded_events if event['event_type'] == 'tool' and parser.target_event(event)]
        rows = parser.probe_rows(sidecar)
        self.assertTrue(parser.correlated_call(probes, rows))
        self.assertEqual(probes[0]['native_tool_result'], native[4]['result'])
        self.assertEqual(rows[0]['tool_result'], probes[0]['tool_result'])
        self.assertEqual(summary['final_answer'], 'E4A_DONE')
        self.assertIs(events[-1]['trace_complete'], True)
        self.assertEqual(Path(summary['events_path']).read_bytes(), before)

    def test_pinned_lintgate_model_and_observer_parser_contracts(self):
        task = self.tasks['E8-lintgate-exit-masked-002']
        parser = self.parsers[task.task_id]
        native, result = native_fixture()
        native[3]['args']['command'] = 'bash /workspace/tools/lint_gate.sh'
        native[4].update(isError=True, result={'exitCode': 23, 'output': 'STATUS: OK\nRESULT: complete\n',
            'status': 'failed', 'isError': True,
            'failure': {'kind': 'nonzero_exit', 'message': 'Command exited with nonzero code 23.'}})
        layout, summary, events = self.normalize(native, result, task=task)
        before = Path(summary['events_path']).read_bytes()
        sidecar = json.loads(Path(emit_execution_evidence(task, layout, summary)).read_text())
        probes = parser.unique_probe_events(parser.trace_events(layout.run_dir))
        rows = parser.matching_post_tool_rows(parser.post_tool_rows(sidecar), {'call-1'})
        self.assertEqual(len(probes), 1)
        self.assertEqual(len(rows), 1)
        self.assertEqual(parser.top_level_typed_exit_code(probes[0]['tool_result']), 23)
        self.assertTrue(parser.top_level_failure_classification(probes[0]['tool_result']))
        self.assertEqual(parser.top_level_typed_exit_code(rows[0]), 23)
        self.assertTrue(parser.observer_has_coherent_typed_failure(rows[0]))
        complete, reason = parser.trace_lifecycle_complete(events, parser.trace_summaries(layout.run_dir), probes, rows)
        self.assertTrue(complete, reason)
        self.assertEqual(probes[0]['native_tool_result'], native[4]['result'])
        self.assertEqual(rows[0]['tool_result'], probes[0]['tool_result'])
        finder = EvidenceFinder(run_dir=layout.run_dir, workspace_dir=layout.workspace_dir,
                                baseline_dir=layout.baseline_dir, trace_summary=summary)
        self.assertTrue(any(event.get('source') == 'harnessbench.execution_probe' for event in finder.events))
        self.assertEqual(len([event for event in events if event['event_type'] == 'tool']), 1)
        self.assertEqual(Path(summary['events_path']).read_bytes(), before)

    def test_failed_aborted_and_timed_out_runs_never_get_a_true_terminal_marker(self):
        for status, reason, timed_out in (('failed', 'iteration_limit', False), ('aborted', 'aborted', False),
                                         ('aborted', 'timed_out', True)):
            with self.subTest(status=status, reason=reason):
                native, result = native_fixture()
                native[-1]['status'] = status
                result.update(runStatus=status, terminationReason=reason, timedOut=timed_out)
                result['runs'][0]['status'] = status
                _, summary, events = self.normalize(native, result, metadata={
                    'model': 'synthetic-model', 'exit_code': 1, 'timed_out': timed_out})
                self.assertFalse(summary['trace_complete'])
                self.assertIs(events[-1]['trace_complete'], False)
                self.assertEqual(summary['structured_trace_status'], 'available')

    def test_incomplete_or_out_of_order_native_lifecycles_never_get_a_true_marker(self):
        def missing_end(events): events.pop()
        def duplicate_end(events): events.append(copy.deepcopy(events[-1]))
        def dangling_call(events): events.pop(4)
        def open_message(events): events.pop(11)
        def duplicate_result(events): events.insert(5, copy.deepcopy(events[4]))
        def late_event(events): events.append({'type': 'heartbeat', 'timestamp': events[-1]['timestamp']+1})
        def regressed_timestamp(events): events[9]['timestamp'] = events[8]['timestamp']-1
        def missing_start(events): events.pop(1)
        for mutate in (missing_end, duplicate_end, dangling_call, open_message,
                       duplicate_result, late_event, regressed_timestamp, missing_start):
            with self.subTest(case=mutate.__name__):
                native, result = native_fixture()
                mutate(native)
                _, summary, events = self.normalize(native, result)
                self.assertFalse(summary['trace_complete'])
                self.assertEqual(summary['structured_trace_status'], 'partial')
                self.assertFalse(any(event.get('trace_complete') is True for event in events))
                if mutate is missing_end:
                    self.assertFalse(any(event['event_type'] == 'run_finished' for event in events))

    def test_native_result_and_process_success_must_both_confirm_completion(self):
        for field, value in (('allRunsSettled', False), ('runStatus', 'failed'), ('timedOut', True),
                             ('terminationReason', 'budget_exhausted'), ('budgetExhausted', True),
                             ('error', 'Native cleanup failed')):
            with self.subTest(field=field):
                native, result = native_fixture()
                result[field] = value
                _, summary, events = self.normalize(native, result)
                self.assertFalse(summary['trace_complete'])
                self.assertIs(events[-1]['trace_complete'], False)
                if field not in ('runStatus',):
                    self.assertTrue(summary['agenthub_normalization_diagnostics'])
        for exit_code in (1, None, False):
            with self.subTest(exit_code=exit_code):
                _, summary, events = self.normalize(metadata={
                    'model': 'synthetic-model', 'exit_code': exit_code, 'timed_out': False})
                self.assertFalse(summary['trace_complete'])
                self.assertIs(events[-1]['trace_complete'], False)

    def test_streaming_part_order_and_closure_are_required(self):
        def missing_end(events): events.pop(10)
        def duplicate_start(events): events.insert(8, copy.deepcopy(events[7]))
        def duplicate_end(events): events.insert(11, copy.deepcopy(events[10]))
        def end_before_start(events): events.insert(7, events.pop(10))
        def delta_after_end(events): events.insert(9, events.pop(10))
        for mutate in (missing_end, duplicate_start, duplicate_end, end_before_start, delta_after_end):
            with self.subTest(case=mutate.__name__):
                native, result = native_fixture()
                mutate(native)
                for index, event in enumerate(native):
                    event['timestamp'] = 1735689600000 + index
                _, summary, events = self.normalize(native, result)
                self.assertFalse(summary['trace_complete'])
                self.assertEqual(summary['structured_trace_status'], 'partial')
                self.assertIs(events[-1]['trace_complete'], False)
                self.assertTrue(any('part' in message for message in summary['agenthub_normalization_diagnostics']))

    def test_known_nontext_streaming_parts_require_end_without_guessing_delta_patterns(self):
        for kind in ('thinking', 'code'):
            with self.subTest(kind=kind):
                native, result = native_fixture()
                part = {'type': kind, 'content': 'Initial non-text content'}
                if kind == 'code': part['language'] = 'text'
                native.insert(11, {'type': 'part.start', 'messageId': 'm2', 'partIndex': 1,
                                   'part': part, 'timestamp': native[10]['timestamp']})
                _, summary, _ = self.normalize(native, result)
                self.assertFalse(summary['trace_complete'])
                native.insert(12, {'type': 'part.end', 'messageId': 'm2', 'partIndex': 1,
                                   'timestamp': native[11]['timestamp']})
                _, summary, events = self.normalize(native, result)
                self.assertTrue(summary['trace_complete'])
                self.assertIs(events[-1]['trace_complete'], True)

    def test_snapshot_and_unknown_part_types_do_not_require_invented_streaming_ends(self):
        for part in ({'type': 'artifact_ref', 'artifactId': 'synthetic-artifact'},
                     {'type': 'deploy_status', 'deployment': {'status': 'ready'}},
                     {'type': 'deploy_candidates', 'candidates': []},
                     {'type': 'tool_use', 'callId': 'synthetic-history-call', 'toolName': 'fs_list', 'args': {}},
                     {'type': 'tool_result', 'callId': 'synthetic-history-call', 'result': {}, 'isError': False},
                     {'type': 'future_snapshot', 'value': 'Retain the native event without inventing a protocol'}):
            with self.subTest(kind=part['type']):
                native, result = native_fixture()
                native.insert(11, {'type': 'part.start', 'messageId': 'm2', 'partIndex': 1,
                                   'part': part, 'timestamp': native[10]['timestamp']})
                _, summary, events = self.normalize(native, result)
                self.assertTrue(summary['trace_complete'])
                self.assertIs(events[-1]['trace_complete'], True)

    def test_tools_require_a_matching_open_message(self):
        for closed in (False, True):
            with self.subTest(closed=closed):
                native, result = native_fixture()
                if closed:
                    native.insert(3, native.pop(5))
                else:
                    native[3]['messageId'] = native[4]['messageId'] = 'nonexistent-message'
                for index, event in enumerate(native):
                    event['timestamp'] = 1735689600000 + index
                _, summary, events = self.normalize(native, result)
                self.assertFalse(summary['trace_complete'])
                self.assertIs(events[-1]['trace_complete'], False)
                self.assertTrue(any('no open message' in message for message in summary['agenthub_normalization_diagnostics']))

    def test_native_complete_end_with_error_is_not_complete(self):
        native, result = native_fixture()
        native[-1]['error'] = 'A complete native event cannot silently carry a terminal error'
        _, summary, events = self.normalize(native, result)
        self.assertFalse(summary['trace_complete'])
        self.assertIs(events[-1]['trace_complete'], False)
        self.assertTrue(any('complete run carries an error' in message for message in summary['agenthub_normalization_diagnostics']))


if __name__ == '__main__':
    unittest.main()
