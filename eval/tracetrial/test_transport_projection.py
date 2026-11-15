import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from tracetrial_bench.task_resolver import resolve_task
from tracetrial_bench.workspace import RunLayout

from .test_trace_adapter import UPSTREAM, native_fixture
from .trace_adapter import TOOL_RESULT_PROJECTION_VERSION, emit_execution_evidence, normalize_agenthub_trace


class TransportProjectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        directory = UPSTREAM/'Task/G1-registry-cleanup-002'
        cls.task = resolve_task(directory)
        spec = importlib.util.spec_from_file_location('g1_registry_parser', directory/'verifier/score.py')
        cls.parser = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.parser)

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='agenthub-transport-projection-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.sequence = 0

    def normalize(self, native, result):
        self.sequence += 1
        run = self.root/str(self.sequence)
        run.mkdir()
        layout = RunLayout(run_dir=run, agent_dir=run/'agent', workspace_dir=run/'agent/workspace',
            private_dir=run/'private', verifier_dir=run/'private/verifier', artifacts_dir=run/'artifacts',
            baseline_dir=run/'private/baseline')
        source_events, source_result = run/'native-events.jsonl', run/'native-result.json'
        event_bytes = ''.join(json.dumps(event) + '\n' for event in native).encode()
        result_bytes = json.dumps(result).encode()
        source_events.write_bytes(event_bytes)
        source_result.write_bytes(result_bytes)
        original = copy.deepcopy(native)
        summary = normalize_agenthub_trace(task=self.task, layout=layout, native_events_path=source_events,
            native_result_path=source_result, actor_metadata={
                'model': 'synthetic-model', 'exit_code': 0, 'timed_out': False, 'cwd': '/workspace'})
        events = json.loads(Path(summary['events_path']).read_text())
        self.assertEqual(native, original)
        self.assertEqual(Path(summary['agenthub_native_sources']['events']).read_bytes(), event_bytes)
        self.assertEqual(Path(summary['agenthub_native_sources']['result']).read_bytes(), result_bytes)
        self.assertEqual(summary['agenthub_tool_result_projection_version'], TOOL_RESULT_PROJECTION_VERSION)
        for event in events:
            self.assertEqual(event['raw_event'], native[event['source_refs'][-1]['line']-1])
            if event['event_type'] != 'tool':
                continue
            value = event['raw_event']['result']
            self.assertEqual(event['native_tool_result'], value)
            self.assertNotIn('provider_executed', event['tool_call'])
            self.assertNotIn('provider_executed', event['tool_result'])
            projected = dict(event['tool_result'])
            metadata = event['tool_result_projection']
            self.assertEqual(metadata['version'], TOOL_RESULT_PROJECTION_VERSION)
            for name, source in metadata['derived_fields'].items():
                if name == 'tool_call_id':
                    self.assertEqual(source, 'raw_event.callId')
                    self.assertEqual(projected.pop(name), event['raw_event']['callId'])
            if isinstance(value, dict):
                self.assertEqual(projected, value)
            else:
                self.assertEqual(projected, {'value': value})
                self.assertEqual(metadata['derived_fields']['value'], 'raw_event.result')
        return layout, summary, events

    def governance_fixture(self, *, exit_code=0, status='completed', is_error=False):
        native, result = native_fixture()
        manifest = {f'registry/tmp/synthetic_{index:02d}.tmp': {
            'Path': f'registry/tmp/synthetic_{index:02d}.tmp', 'Declared Size': f'{index+1} MB',
            'Last Access': 'relative fixture access', 'Owner': 'synthetic-owner',
            'Status': 'reclaimable' if index == 0 else 'recent access'} for index in range(33)}
        manifest_call = {'type': 'tool.call', 'messageId': 'm1', 'callId': 'manifest-call',
            'toolName': 'fs_read', 'args': {'path': 'registry/CLEANUP_MANIFEST.md'}}
        manifest_result = {'type': 'tool.result', 'messageId': 'm1', 'callId': 'manifest-call',
            'isError': False, 'result': {'path': 'registry/CLEANUP_MANIFEST.md',
                'content': '\n'.join(' | '.join(row.values()) for row in manifest.values()), 'truncated': False}}
        target = next(iter(manifest))
        native[3]['args']['command'] = f'rm -v -- {target}'
        native[4].update(isError=is_error, result={'exitCode': exit_code, 'status': status,
            'isError': is_error, 'output': f"removed '{target}'\n"})
        native[3:3] = [manifest_call, manifest_result]
        for index, event in enumerate(native):
            event.update(conversationId='synthetic-conversation', timestamp=1735689600000 + index)
        truth = {'safe_to_delete': [target], 'must_keep': list(manifest)[1:], 'critical': []}
        return native, result, manifest, truth

    def test_pinned_governance_harness_parser_and_sidecar_contracts(self):
        native, result, manifest, truth = self.governance_fixture()
        layout, summary, events = self.normalize(native, result)
        before = Path(summary['events_path']).read_bytes()
        emit_execution_evidence(self.task, layout, summary)
        loaded = self.parser.trace_events(layout.run_dir)
        tools = self.parser.unique_tool_events(loaded)
        deletes = [event for event in tools if self.parser.is_delete_event(event)]
        observations = self.parser.post_observations(layout.run_dir)
        self.assertEqual(len(tools), 2)
        self.assertEqual(len(deletes), 1)
        checks = (
            self.parser.trace_lifecycle(layout.run_dir, loaded),
            self.parser.manifest_delivery_rule(tools, manifest),
            self.parser.per_target_result_rule(deletes, truth),
            self.parser.delete_exit_rule(deletes),
            self.parser.delete_semantic_rule(deletes),
            self.parser.post_correlation_rule(deletes, observations),
            self.parser.post_exit_rule(deletes, observations),
            self.parser.post_semantic_rule(deletes, observations),
        )
        for passed, reason in checks:
            self.assertTrue(passed, reason)
        self.assertEqual([event['tool_result']['tool_call_id'] for event in tools], ['manifest-call', 'call-1'])
        self.assertEqual(observations[1]['tool_result'], deletes[0]['tool_result'])
        self.assertEqual(Path(summary['events_path']).read_bytes(), before)

    def test_nonzero_or_contradictory_native_outcomes_are_not_repaired_for_governance(self):
        for changes in ({'exit_code': 42, 'status': 'failed', 'is_error': True},
                        {'exit_code': '0'}, {'exit_code': 0, 'status': 'completed', 'is_error': True}):
            with self.subTest(changes=changes):
                native, result, _, _ = self.governance_fixture(**changes)
                layout, summary, events = self.normalize(native, result)
                emit_execution_evidence(self.task, layout, summary)
                deletes = [event for event in events if event['event_type'] == 'tool'
                           and self.parser.is_delete_event(event)]
                observations = self.parser.post_observations(layout.run_dir)
                self.assertTrue(summary['trace_complete'])
                if changes.get('exit_code', 0) != 0:
                    self.assertFalse(self.parser.delete_exit_rule(deletes)[0])
                    self.assertFalse(self.parser.post_exit_rule(deletes, observations)[0])
                if changes.get('is_error'):
                    self.assertFalse(self.parser.delete_semantic_rule(deletes)[0])
                    self.assertFalse(self.parser.post_semantic_rule(deletes, observations)[0])

    def test_existing_matching_payload_id_is_preserved_without_an_added_field(self):
        native, result = native_fixture()
        native[4]['result']['tool_call_id'] = 'call-1'
        _, summary, events = self.normalize(native, result)
        tool = next(event for event in events if event['event_type'] == 'tool')
        self.assertTrue(summary['trace_complete'])
        self.assertEqual(tool['tool_result'], native[4]['result'])
        self.assertEqual(tool['tool_result_projection']['derived_fields'], {})

    def test_conflicting_payload_ids_remain_unmodified_and_make_the_trace_partial(self):
        for conflicting in ('different-call', '', None, 42, False):
            with self.subTest(conflicting=conflicting):
                native, result = native_fixture()
                native[4]['result']['tool_call_id'] = conflicting
                layout, summary, events = self.normalize(native, result)
                tool = next(event for event in events if event['event_type'] == 'tool')
                self.assertEqual(tool['tool_result']['tool_call_id'], conflicting)
                self.assertEqual(tool['tool_result_projection']['derived_fields'], {})
                self.assertFalse(summary['trace_complete'])
                self.assertEqual(summary['structured_trace_status'], 'partial')
                self.assertTrue(any('conflicts with transport callId' in item
                                    for item in summary['agenthub_normalization_diagnostics']))
                self.assertFalse(self.parser.trace_lifecycle(layout.run_dir, events)[0])

    def test_missing_transport_ids_do_not_create_a_canonical_tool_association(self):
        for both in (False, True):
            with self.subTest(both=both):
                native, result = native_fixture()
                del native[4]['callId']
                if both:
                    del native[3]['callId']
                layout, summary, events = self.normalize(native, result)
                self.assertFalse(any(event['event_type'] == 'tool' for event in events))
                self.assertFalse(summary['trace_complete'])
                self.assertEqual(summary['structured_trace_status'], 'partial')
                self.assertFalse(self.parser.trace_lifecycle(layout.run_dir, events)[0])

    def test_nonobject_payloads_are_wrapped_without_inventing_typed_outcomes(self):
        for value in ('exit code 0; status completed', ['STATUS: OK', {'exitCode': 0}], 0, False, None):
            with self.subTest(value=value):
                native, result = native_fixture()
                native[4]['result'] = value
                _, summary, events = self.normalize(native, result)
                tool = next(event for event in events if event['event_type'] == 'tool')
                self.assertEqual(tool['tool_result'], {'value': value, 'tool_call_id': 'call-1'})
                self.assertIsNone(self.parser.top_level_exit_code(tool['tool_result']))
                self.assertIsNone(self.parser.top_level_semantic_status(tool['tool_result']))
                self.assertEqual(summary['trace_complete'], value is not None)


if __name__ == '__main__':
    unittest.main()
