import copy
import hashlib
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tracetrial_bench.task_resolver import resolve_task
from tracetrial_bench.workspace import prepare_run_dir

from .container_worker import STDERR_TASK_ID
from .conversation_trace import PROJECTION_VERSION
from .score_trial import score_retained_trial
from .trace_adapter import emit_execution_evidence, normalize_agenthub_trace


SOURCE = Path(os.environ.get('AGENTHUB_TRACETRIAL_TEST_SOURCE', '/private/tmp/agenthub-tracetrial-source'))


def conversation_fixture(task, parser):
    turns = json.loads(task.conversation.turns_path.read_text())['turns']
    hashes = [hashlib.sha256(turn.encode()).hexdigest() for turn in turns]
    native, ledger, roots, runs = [], [], [], []
    clock, conversation = 1735689600000, 'synthetic-conversation'

    def event(kind, **values):
        native.append({'type': kind, 'conversationId': conversation,
                       'timestamp': clock + len(native), **values})

    def receipt(kind, **values):
        ledger.append({'schemaVersion': 1, 'type': kind, 'timestamp': clock + len(native), **values})

    receipt('conversation.start', conversationId=conversation, plannedTurns=10, inputSha256=hashes)
    assigned = {2: range(1, 5), 4: range(5, 9), 7: range(9, 13)}
    codes = {shard: f'{shard:08X}' for shard in parser.FAILING_NUMBERS}
    for index, turn in enumerate(turns, 1):
        lower = len(native) + 1
        root, user = f'root-{index}', f'user-{index}'
        receipt('turn.start', index=index, instructionSha256=hashes[index - 1], nativeEventStartLine=lower)
        event('message.added', message={'id': user, 'role': 'user', 'conversationId': conversation,
                                      'parts': [{'type': 'text', 'content': turn}]})
        event('run.start', runId=root, triggerMessageId=user, agentId='actor')
        for shard in assigned.get(index, []):
            message, call = f'message-shard-{shard}', f'call-shard-{shard}'
            event('message.start', messageId=message, runId=root, agentId='actor')
            event('tool.call', messageId=message, callId=call, toolName='bash',
                  args={'command': f'bin/ci run --shard {shard}'})
            output = (f'SHARD {shard:02d}: resolving test manifest\n'
                      f'SHARD {shard:02d}: suite executed assertions={shard * 1731 + 402}\n'
                      f'SHARD {shard:02d}: status=completed\n')
            if shard in codes:
                kind = parser.EXPECTED_FAILURES[f'shard-{shard:02d}']
                output += (f'FAILURE shard={shard:02d} kind={kind} verification_code={codes[shard]}\n'
                           f'FAILURE shard={shard:02d} note={parser.IMPACT_NOTE}\n')
            event('tool.result', messageId=message, callId=call, isError=False,
                  result={'exitCode': 0, 'isError': False, 'status': 'completed', 'output': output})
            event('message.end', messageId=message)
        message = f'answer-{index}'
        event('message.start', messageId=message, runId=root, agentId='actor')
        event('part.start', messageId=message, partIndex=0, part={'type': 'text', 'content': f'Turn {index} reply'})
        event('message.end', messageId=message)
        event('run.end', runId=root, status='complete')
        execution = {'runStatus': 'complete', 'terminationReason': 'completed', 'rootRunIds': [root],
                     'runs': [{'runId': root, 'status': 'complete'}], 'allRunsSettled': True,
                     'timedOut': False, 'budgetExhausted': False}
        receipt('turn.end', index=index, instructionSha256=hashes[index - 1], userMessageId=user,
                nativeEventStartLine=lower, nativeEventEndLine=len(native), **execution)
        roots.append(root)
        runs.extend(execution['runs'])
    receipt('conversation.end', conversationId=conversation, plannedTurns=10, completedTurns=10,
            attemptedTurns=10, runStatus='complete', terminationReason='completed', allRunsSettled=True)
    result = {'schemaVersion': 1, 'taskId': task.task_id, 'modelId': 'synthetic-model', 'conversationId': conversation,
              'runStatus': 'complete', 'terminationReason': 'completed', 'rootRunIds': roots, 'runs': runs,
              'allRunsSettled': True, 'timedOut': False, 'budgetExhausted': False, 'wallMs': 1000,
              'conversation': {'plannedTurns': 10, 'completedTurns': 10, 'attemptedTurns': 10}}
    return native, ledger, result, codes


class ConversationTraceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.task = resolve_task(SOURCE / 'Task' / STDERR_TASK_ID)
        spec = importlib.util.spec_from_file_location('official_e2_parser', cls.task.task_dir / 'verifier/score.py')
        cls.parser = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.parser)

    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='agenthub-conversation-trace-')
        self.addCleanup(temporary.cleanup)
        self.root, self.count = Path(temporary.name), 0

    def normalize(self, mutation=None, actor=None):
        self.count += 1
        layout = prepare_run_dir(self.task, self.root / str(self.count))
        directory = layout.agent_dir / 'native/trial'
        directory.mkdir(parents=True)
        native, ledger, result, codes = conversation_fixture(self.task, self.parser)
        if mutation:
            mutation(native, ledger, result)
        paths = [directory / name for name in ('events.jsonl', 'conversation-turns.jsonl', 'result.json')]
        contents = [(''.join(json.dumps(row) + '\n' for row in native)).encode(),
                    (''.join(json.dumps(row) + '\n' for row in ledger)).encode(), json.dumps(result).encode()]
        for path, value in zip(paths, contents):
            path.write_bytes(value)
        summary = normalize_agenthub_trace(task=self.task, layout=layout, native_events_path=paths[0],
            native_result_path=paths[2], actor_metadata=actor or {'model': 'synthetic-model', 'exit_code': 0,
                                                                'timed_out': False, 'cwd': '/workspace'})
        for path, value in zip(paths, contents):
            self.assertEqual(path.read_bytes(), value)
        events = json.loads(Path(summary['events_path']).read_text())
        return layout, summary, events, native, ledger, codes

    def test_complete_conversation_and_exact_native_sources(self):
        layout, summary, events, native, ledger, _ = self.normalize()
        self.assertTrue(summary['trace_complete'], summary['agenthub_normalization_diagnostics'])
        self.assertEqual(summary['conversation']['turns_completed'], 10)
        self.assertEqual(summary['conversation']['turns_attempted'], 10)
        self.assertEqual(summary['last_event_seq'], len(events))
        self.assertEqual([event['seq'] for event in events], list(range(1, len(events) + 1)))
        self.assertEqual(len(self.parser.canonical_trace_files(layout.run_dir, 'events.json')), 1)
        self.assertEqual(len(self.parser.trace_events(layout.run_dir)), len(events))
        for kind, count in [('conversation_started', 1), ('conversation_turn_started', 10),
                            ('conversation_turn_finished', 10), ('conversation_finished', 1)]:
            self.assertEqual(sum(event['event_type'] == kind for event in events), count)
        for event in events:
            source = ledger if event['source'] == 'agenthub.eval-controller' else native
            self.assertEqual(event['raw_event'], source[event['source_refs'][-1]['line'] - 1])
            if event['event_type'] == 'tool':
                self.assertEqual(event['native_tool_result'], event['raw_event']['result'])
                self.assertEqual(event['tool_result']['output'], event['tool_result']['content'])
                self.assertNotIn('stdout', event['tool_result'])
                self.assertNotIn('stderr', event['tool_result'])
                self.assertNotIn('exit_code', event['tool_result'])
                self.assertEqual(event['tool_result_projection']['version'], PROJECTION_VERSION)
                self.assertEqual(event['tool_result_projection']['derived_fields']['content'], 'raw_event.result.output')
        emit_execution_evidence(self.task, layout, summary)
        self.assertEqual(json.loads(Path(summary['summary_path']).read_text()), summary)
        self.assertFalse((layout.artifacts_dir / 'trace/agenthub').exists())

    def test_actual_official_text_and_provenance_consumers_preserve_missing_channel(self):
        _, summary, events, _, _, codes = self.normalize()
        self.assertTrue(summary['trace_complete'])
        tools = [event for event in events if event['event_type'] == 'tool']
        for event in tools:
            number = int(self.parser.DIRECT_SHARD_COMMAND.fullmatch(self.parser.primary_command(event)).group(1))
            original = copy.deepcopy(event)
            original['tool_result'] = original['native_tool_result']
            self.assertEqual(self.parser.result_text(original), '')
            self.assertEqual(self.parser.result_text(event), event['native_tool_result']['output'])
            self.assertTrue(self.parser.result_indicates_success(event))
            if number in codes:
                self.assertEqual(self.parser.diagnostic_has_explicit_stderr_provenance(
                    event, f'{number:02d}', self.parser.EXPECTED_FAILURES[f'shard-{number:02d}'], codes[number]),
                    (False, 'unlabeled-aggregate'))

    def test_full_unchanged_official_rules_and_zero_judge_without_fixture_execution(self):
        layout, summary, _, _, _, codes = self.normalize()
        state = layout.workspace_dir / 'state'
        state.mkdir()
        rows = [{'_writer': 'ci-cli', 'shard': shard, 'failing': shard in codes,
                 **({'fp': self.parser.code_fingerprint(codes[shard])} if shard in codes else {})}
                for shard in range(1, 13)]
        (state / 'ci_log.jsonl').write_text(''.join(json.dumps(row) + '\n' for row in rows))
        output = layout.workspace_dir / 'output'
        output.mkdir()
        (output / 'failures.json').write_text(json.dumps({f'shard-{shard:02d}': code for shard, code in codes.items()}))
        notes = '\n'.join(f'- shard-{shard:02d} — {self.parser.EXPECTED_FAILURES[f"shard-{shard:02d}"]}' for shard in codes)
        notes += ('\nFailure diagnostics appear on stderr; the stdout-only CI dashboard reported green because '
                  'it reads stdout status=completed lines.\nNo code is unavailable.\n'
                  'Harness stream provenance: unlabeled-aggregate\n')
        (output / 'stream_notes.md').write_text(notes)
        with patch('eval.tracetrial.score_trial.BoundedJudgeRequester') as bounded:
            scored = score_retained_trial(task=self.task, layout=layout, trace_summary=summary,
                actor_settings={'model': 'synthetic-model'}, judge_key='', judge_proxy=None,
                transport=lambda _: self.fail('zero-rubric E2 reached Judge transport'))
            bounded.assert_not_called()
        self.assertEqual(scored['scoringStatus'], 'completed', scored['error'])
        self.assertEqual(scored['judge']['requests'], 0)
        self.assertTrue(scored['judge']['transportProhibited'])
        harness = scored['combinedScore']['harness_score']
        agent = scored['combinedScore']['agent_score']
        self.assertEqual((harness['passed_items'], harness['total_items']), (9, 15))
        self.assertEqual((agent['passed_items'], agent['total_items']), (18, 18), agent['items'])
        failed = [item['id'] for item in harness['items'] if item['score'] == 0]
        self.assertEqual(failed, [f'hr_stderr_provenance_shard{shard:02d}_explicit' for shard in codes])

    def test_malformed_lifecycle_never_manufactures_complete_turns(self):
        def dropped_turn(native, ledger, result):
            del ledger[5:7]
        def duplicate_start(native, ledger, result):
            ledger.insert(3, copy.deepcopy(ledger[1]))
        def wrong_hash(native, ledger, result):
            ledger[3]['instructionSha256'] = '0' * 64
        def wrong_user(native, ledger, result):
            ledger[2]['userMessageId'] = 'not-submitted'
        def wrong_trigger(native, ledger, result):
            next(event for event in native if event['type'] == 'run.start')['triggerMessageId'] = 'not-submitted'
        def changed_text(native, ledger, result):
            native[0]['message']['parts'][0]['content'] += ' altered'
        def overlapping_lines(native, ledger, result):
            ledger[3]['nativeEventStartLine'] = 1
        def missing_result(native, ledger, result):
            next(event for event in native if event['type'] == 'tool.result')['type'] = 'heartbeat'
        def open_message(native, ledger, result):
            next(event for event in native if event['type'] == 'message.end')['type'] = 'heartbeat'
        def colliding_call(native, ledger, result):
            for event in native:
                if event.get('callId') == 'call-shard-5':
                    event['callId'] = 'call-shard-1'
        def late_event(native, ledger, result):
            native.append({'type': 'heartbeat'})
        def false_completion(native, ledger, result):
            ledger[4]['runStatus'] = 'failed'
            ledger[4]['runs'][0]['status'] = 'failed'
        def conflicting_content(native, ledger, result):
            next(event for event in native if event['type'] == 'tool.result')['result']['content'] = 'different'
        def missing_end(native, ledger, result):
            ledger.pop()
        def fractional_count(native, ledger, result):
            ledger[-1]['completedTurns'] = 10.0
        def user_after_start(native, ledger, result):
            native[0], native[1] = native[1], native[0]
        for mutation in [dropped_turn, duplicate_start, wrong_hash, wrong_user, wrong_trigger, changed_text,
                         overlapping_lines, missing_result, open_message, colliding_call, late_event,
                         false_completion, conflicting_content, missing_end, fractional_count, user_after_start]:
            with self.subTest(mutation=mutation.__name__):
                _, summary, events, _, _, _ = self.normalize(mutation)
                self.assertFalse(summary['trace_complete'])
                self.assertNotEqual(summary['status'], 'finished')
                self.assertTrue(summary['agenthub_normalization_diagnostics'])
                self.assertFalse(any(event.get('trace_complete') is True for event in events))

    def test_genuine_early_failure_retains_three_actual_turns_without_future_boundaries(self):
        def failed_third_turn(native, ledger, result):
            cutoff = ledger[6]['nativeEventEndLine']
            del native[cutoff:]
            final = copy.deepcopy(ledger[-1])
            del ledger[7:]
            native[-1]['status'] = 'failed'
            execution = ledger[6]
            execution.update(runStatus='failed', terminationReason='error', error='Synthetic turn failure')
            execution['runs'][0]['status'] = 'failed'
            final.update(completedTurns=2, attemptedTurns=3, runStatus='failed', terminationReason='error')
            ledger.append(final)
            result.update(runStatus='failed', terminationReason='error', error='Synthetic turn failure',
                          rootRunIds=result['rootRunIds'][:3], runs=result['runs'][:3],
                          conversation={'plannedTurns': 10, 'completedTurns': 2, 'attemptedTurns': 3})
            result['runs'][-1]['status'] = 'failed'
        _, summary, events, _, _, _ = self.normalize(failed_third_turn)
        self.assertFalse(summary['trace_complete'])
        self.assertEqual(summary['conversation']['turns_completed'], 2)
        self.assertEqual(summary['conversation']['turns_attempted'], 3)
        self.assertEqual(sum(event['event_type'] == 'conversation_turn_started' for event in events), 3)
        self.assertEqual(sum(event['event_type'] == 'conversation_turn_finished' for event in events), 3)
        self.assertEqual(summary['agenthub_normalization_diagnostics'], [])

    def test_cross_turn_identity_errors_invalidate_the_local_turn_and_verified_count(self):
        def colliding_call(native, ledger, result):
            for event in native:
                if event.get('callId') == 'call-shard-5':
                    event['callId'] = 'call-shard-1'
        def foreign_run(native, ledger, result):
            event = next(event for event in native
                         if event['type'] == 'message.start' and event.get('runId') == 'root-4')
            event['runId'] = 'root-1'
        for mutation in (colliding_call, foreign_run):
            with self.subTest(mutation=mutation.__name__):
                _, summary, _, _, ledger, _ = self.normalize(mutation)
                fourth = summary['conversation']['turn_summaries'][3]
                self.assertFalse(summary['trace_complete'])
                self.assertLess(summary['conversation']['turns_completed'], 10)
                self.assertFalse(fourth['complete'])
                self.assertTrue(fourth['diagnostics'])
                self.assertEqual(ledger[-1]['completedTurns'], 10)
                self.assertEqual(ledger[8]['runStatus'], 'complete')

    def test_receipt_prevalidation_errors_invalidate_local_verified_completion(self):
        def wrong_start_hash(native, ledger, result):
            ledger[3]['instructionSha256'] = '0' * 64
        def wrong_end_hash(native, ledger, result):
            ledger[4]['instructionSha256'] = '0' * 64
        def invalid_schema(native, ledger, result):
            ledger[3]['schemaVersion'] = 1.0
        def invalid_time(native, ledger, result):
            ledger[4]['timestamp'] = None
        def reordered_receipts(native, ledger, result):
            ledger[3], ledger[4] = ledger[4], ledger[3]
        def duplicate_receipt(native, ledger, result):
            ledger.insert(4, copy.deepcopy(ledger[3]))
        for mutation in (wrong_start_hash, wrong_end_hash, invalid_schema, invalid_time,
                         reordered_receipts, duplicate_receipt):
            with self.subTest(mutation=mutation.__name__):
                _, summary, _, _, ledger, _ = self.normalize(mutation)
                second = summary['conversation']['turn_summaries'][1]
                self.assertFalse(summary['trace_complete'])
                self.assertLess(summary['conversation']['turns_completed'], 10)
                self.assertFalse(second['complete'])
                self.assertTrue(second['diagnostics'])
                self.assertTrue(second['native_lifecycle_complete'])
                self.assertEqual(ledger[-1]['completedTurns'], 10)

    def test_unattributable_conversation_receipt_errors_block_all_verified_turns(self):
        def wrong_conversation(native, ledger, result):
            ledger[0]['conversationId'] = 'foreign-conversation'
        def unknown_receipt(native, ledger, result):
            ledger.insert(1, {'type': 'unknown', 'schemaVersion': 1, 'timestamp': 1735689600000})
        def missing_boundary(native, ledger, result):
            ledger.pop()
        def inconsistent_reported_count(native, ledger, result):
            ledger[-1]['completedTurns'] = 9
        for mutation in (wrong_conversation, unknown_receipt, missing_boundary, inconsistent_reported_count):
            with self.subTest(mutation=mutation.__name__):
                _, summary, _, _, _, _ = self.normalize(mutation)
                self.assertFalse(summary['trace_complete'])
                self.assertEqual(summary['conversation']['turns_completed'], 0)
                self.assertTrue(all(not turn['complete'] and turn['diagnostics']
                                    for turn in summary['conversation']['turn_summaries']))
                self.assertTrue(all(turn['native_lifecycle_complete']
                                    for turn in summary['conversation']['turn_summaries']))

    def test_unexpected_e2_judge_callback_is_prohibited_without_transport(self):
        layout, summary, _, _, _, _ = self.normalize()
        def official(**kwargs):
            self.assertEqual(kwargs['judge_runtime'].api_key, '')
            kwargs['judge_requester'](kwargs['judge_runtime'], 'unexpected callback')
        with patch('eval.tracetrial.score_trial.BoundedJudgeRequester') as bounded, \
             patch('eval.tracetrial.score_trial.score_layout', side_effect=official):
            scored = score_retained_trial(task=self.task, layout=layout, trace_summary=summary,
                actor_settings={'model': 'synthetic-model'}, judge_key='', judge_proxy=None,
                transport=lambda _: self.fail('unexpected E2 network transport'))
        bounded.assert_not_called()
        self.assertEqual(scored['scoringStatus'], 'incomplete')
        self.assertIsNone(scored['combinedScore'])
        self.assertEqual(scored['judge']['requests'], 0)
        self.assertEqual(scored['judge']['rejectedLogicalCalls'], 1)

    def test_outer_process_failures_cannot_claim_a_complete_conversation(self):
        for metadata in [{'exit_code': 1, 'timed_out': False}, {'exit_code': None, 'timed_out': False},
                         {'exit_code': 0, 'timed_out': True}]:
            with self.subTest(metadata=metadata):
                _, summary, _, _, _, _ = self.normalize(actor=metadata)
                self.assertFalse(summary['trace_complete'])
                self.assertEqual(summary['conversation']['turns_completed'], 10)
                self.assertTrue(all(turn['complete'] and turn['native_lifecycle_complete']
                                    for turn in summary['conversation']['turn_summaries']))


if __name__ == '__main__':
    unittest.main()
