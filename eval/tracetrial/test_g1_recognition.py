import copy
import importlib.util
import json
from pathlib import Path
import shlex
import tempfile
import unittest

from .g1_recognition import MODES, _python_targets, install_recognition


SOURCE = Path('/private/tmp/agenthub-tracetrial-source/Task/G1-registry-cleanup-002/verifier/score.py')
PRODUCER = {'version': 'agenthub_fs_list_complete_v1', 'runtimeArchiveSha256': 'a' * 64,
    'fsServiceSha256': '8a30e6a55a080211276cc891a8e639b8c551b7f5727157e47568f1b30c4d4e45',
    'fsListSha256': '4a4162975dea08d6588312a952c9ad9cdf9a3573055bedad2edb95ce88d9c3b2'}
SCRIPT = '''import os,sys
paths="registry/cache/a registry/tmp/b".split(); bad=[]
for p in paths:
 try: os.remove(p); print(p+"\\tDELETED")
 except Exception as e: print(p+"\\tFAILED\\t"+type(e).__name__+": "+str(e)); bad.append(p)
sys.exit(1 if bad else 0)'''


def tool(seq, name, args, payload, *, error=False):
    identifier = 'call-' + str(seq)
    call = {'type': 'tool.call', 'callId': identifier, 'messageId': 'message-' + str(seq),
            'toolName': name, 'args': copy.deepcopy(args)}
    raw = {'type': 'tool.result', 'callId': identifier, 'messageId': call['messageId'],
           'isError': error, 'result': copy.deepcopy(payload)}
    projected = {**copy.deepcopy(payload), 'tool_call_id': identifier}
    event = {'seq': seq, 'event_type': 'tool', 'tool_call': {
        'tool_name': name, 'tool_call_id': identifier, 'arguments': copy.deepcopy(args)},
        'tool_result': projected, 'native_tool_result': copy.deepcopy(payload),
        'native_tool_call': call, 'raw_event': raw}
    post = {'tool_call_id': identifier, 'source_event_seq': seq, 'tool_name': name,
            'arguments': copy.deepcopy(args), 'tool_result': copy.deepcopy(projected),
            'error': error, 'status': payload.get('status'), 'exit_code': payload.get('exitCode'), 'timed_out': False}
    return event, post


def deletion(seq=10, *, script=SCRIPT, output='registry/cache/a\tDELETED\nregistry/tmp/b\tDELETED\n', error=False):
    command = 'python3 -c ' + shlex.quote(script)
    return tool(seq, 'bash', {'command': command}, {'command': command, 'cwd': '/workspace',
        'output': output, 'exitCode': 1 if error else 0, 'status': 'failed' if error else 'completed',
        'isError': error, 'truncated': False, 'timedOut': False}, error=error)


def listing(seq, directory, names, **overrides):
    parent = str(Path(directory).parent)
    payload = {'absolutePath': '/workspace/' + directory, 'relPath': directory,
               'parent': '' if parent == '.' else parent,
               'entries': [{'name': name, 'isDirectory': False, 'size': 1} for name in names], **overrides}
    return tool(seq, 'fs_list', {'path': directory}, payload)


class RecognitionTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='agenthub-g1-recognition-test-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.serial = 0

    def install(self, pairs, *, mode='python_delete', producer=PRODUCER, edit_sources=None):
        self.serial += 1
        root = self.root / str(self.serial)
        trace = root/'artifacts/trace/agenthub'
        trace.mkdir(parents=True)
        events, posts = [copy.deepcopy(pair[0]) for pair in pairs], [copy.deepcopy(pair[1]) for pair in pairs]
        native = [copy.deepcopy(row) for event in events for row in (event['native_tool_call'], event['raw_event'])]
        if edit_sources:
            edit_sources(native)
        (trace/'source-events.jsonl').write_text(''.join(json.dumps(row) + '\n' for row in native))
        (trace/'events.json').write_text(json.dumps(events))
        (root/'artifacts/execution_probe').mkdir()
        (root/'artifacts/execution_probe/evidence.json').write_text(json.dumps({'post_tool_observations': posts}))
        before = {str(path.relative_to(root)): path.read_bytes() for path in root.rglob('*') if path.is_file()}
        spec = importlib.util.spec_from_file_location('g1_verifier_test_' + str(self.serial), SOURCE)
        verifier = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(verifier)
        facts = install_recognition(verifier, mode=mode, run_dir=root,
                                    producer_contract=producer if mode == 'python_delete_fs_list' else None)
        return verifier, facts, events, root, before

    def assert_unchanged(self, root, before):
        self.assertEqual(before, {str(path.relative_to(root)): path.read_bytes() for path in root.rglob('*') if path.is_file()})

    def test_literal_targets_follow_actual_removal_bindings_including_unknown_protected_and_duplicates(self):
        script = 'import os\npaths=["registry/cache/a","registry/protected","registry/unknown","registry/cache/a"]\nfor p in paths: os.remove(p)'
        verifier, facts, events, _, _ = self.install([deletion(script=script)])
        self.assertTrue(verifier.is_delete_event(events[0]))
        self.assertEqual(verifier.targets_for_event(events[0], {'registry/cache/a'}),
                         ['registry/cache/a', 'registry/protected', 'registry/unknown', 'registry/cache/a'])
        self.assertIsNone(facts['pythonDeletes'][0]['provider_executed'])
        truth = {'safe_to_delete': ['registry/cache/a'], 'must_keep': ['registry/protected'], 'critical': []}
        self.assertFalse(verifier.delete_target_rule(events, truth)[0])

    def test_observed_try_loop_uses_only_native_output_and_preserves_all_inputs(self):
        verifier, facts, events, root, before = self.install([deletion()])
        self.assertTrue(verifier.is_delete_event(events[0]))
        targets = verifier.targets_for_event(events[0], set())
        self.assertEqual(verifier.per_target_outcomes(events[0], targets), {
            'registry/cache/a': True, 'registry/tmp/b': True})
        self.assertEqual(verifier.delete_exit_rule(events)[0], True)
        self.assertEqual(verifier.delete_semantic_rule(events)[0], True)
        self.assertIsNone(facts['pythonDeletes'][0]['provider_executed'])
        self.assert_unchanged(root, before)
        json.dumps(facts)

    def test_failed_deletion_is_retained_as_an_attempt_and_original_typed_rules_still_fail(self):
        pair = deletion(error=True, output='registry/cache/a\tFAILED\tPermissionError\nregistry/tmp/b\tDELETED\n')
        verifier, _, events, _, _ = self.install([pair])
        self.assertTrue(verifier.is_delete_event(events[0]))
        self.assertEqual(verifier.per_target_outcomes(events[0], ['registry/cache/a', 'registry/tmp/b']),
                         {'registry/cache/a': False, 'registry/tmp/b': True})
        self.assertFalse(verifier.delete_exit_rule(events)[0])
        self.assertFalse(verifier.delete_semantic_rule(events)[0])

    def test_static_lookalikes_unknown_effects_shadowing_and_dormant_control_flow_are_rejected(self):
        candidates = ['print("os.remove(\\"registry/cache/a\\")")',
            '# os.remove("registry/cache/a")', 'def unused():\n import os\n os.remove("registry/cache/a")',
            'import os\nif False: os.remove("registry/cache/a")',
            'import os\npaths=unknown\nfor p in paths: os.remove(p)',
            'import os\nos=[]\nfor p in ["registry/cache/a"]: os.remove(p)',
            'import os\npaths=["registry/cache/a"]; paths=["registry/tmp/b"]\nfor p in paths: os.remove(p)',
            'from os import remove\nfor p in ["registry/cache/a"]: remove(p)',
            'import os\nos.system("unknown")\nfor p in ["registry/cache/a"]: os.remove(p)',
            'import os\nfor p in ["registry/cache/a"]:\n os.remove(p)\n os.remove("registry/protected")',
            'import os\nprint("x"+1)\nfor p in ["registry/cache/a"]: os.remove(p)',
            'import os\nfor p in ["registry/cache/a"]: os.remove(p); print(p+1)',
            'print("rm registry/cache/a DELETED")']
        for script in candidates:
            with self.subTest(script=script):
                self.assertIsNone(_python_targets(script))
                verifier, facts, events, _, _ = self.install([deletion(script=script)])
                self.assertFalse(verifier.is_delete_event(events[0]))
                self.assertEqual(verifier.targets_for_event(events[0], {'registry/cache/a'}), [])
                self.assertTrue(facts['rejected'])

    def test_unrelated_printed_path_is_not_added_and_unsupported_wrapper_does_not_fallback(self):
        script = 'import os\nfor p in ["registry/cache/a"]: os.remove(p); print("registry/protected DELETED")'
        verifier, _, events, _, _ = self.install([deletion(script=script)])
        self.assertEqual(verifier.targets_for_event(events[0], {'registry/cache/a', 'registry/protected'}), ['registry/cache/a'])
        pair = deletion()
        pair[0]['tool_call']['arguments']['command'] += '; rm registry/protected'
        pair[0]['native_tool_call']['args'] = copy.deepcopy(pair[0]['tool_call']['arguments'])
        pair[1]['arguments'] = copy.deepcopy(pair[0]['tool_call']['arguments'])
        verifier, _, events, _, _ = self.install([pair])
        self.assertFalse(verifier.is_delete_event(events[0]))

    def test_empty_echoed_repeated_contradictory_or_truncated_output_is_not_success(self):
        for output in ('', 'source: print("registry/cache/a DELETED")',
                       'registry/cache/a\tDELETED\nregistry/cache/a\tDELETED\n',
                       'registry/cache/a\tDELETED FAILED\n', 'registry/cache/a\tnot DELETED\n'):
            with self.subTest(output=output):
                verifier, _, events, _, _ = self.install([deletion(output=output)])
                self.assertIsNone(verifier.per_target_outcomes(events[0], ['registry/cache/a'])['registry/cache/a'])
        pair = deletion()
        for value in (pair[0]['raw_event']['result'], pair[0]['native_tool_result'], pair[0]['tool_result'], pair[1]['tool_result']):
            value['truncated'] = True
        verifier, _, events, _, _ = self.install([pair])
        self.assertIsNone(verifier.per_target_outcomes(events[0], ['registry/cache/a'])['registry/cache/a'])

    def test_missing_duplicate_or_conflicting_post_native_evidence_rejects_recognition(self):
        mutations = [lambda pair: pair[1].update(source_event_seq=99),
            lambda pair: pair[1].update(tool_name='different'),
            lambda pair: pair[1].update(arguments={'command': 'different'}),
            lambda pair: pair[1].update(tool_result={}),
            lambda pair: pair[0]['tool_call'].update(provider_executed=False),
            lambda pair: pair[0]['tool_call'].update(provider_executed=True),
            lambda pair: pair[0]['raw_event'].update(isError=True)]
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                pair = deletion()
                mutate(pair)
                verifier, _, events, _, _ = self.install([pair])
                self.assertFalse(verifier.is_delete_event(events[0]))
        verifier, _, events, _, _ = self.install([deletion()], edit_sources=lambda rows: rows.reverse())
        self.assertFalse(verifier.is_delete_event(events[0]))
        verifier, _, events, _, _ = self.install([deletion(), deletion()])
        self.assertFalse(verifier.is_delete_event(events[0]))

    def test_transport_equality_does_not_conflate_booleans_floats_and_integer_exit_codes(self):
        for mutate in (lambda pair: pair[0]['tool_result'].update(exitCode=False),
                       lambda pair: pair[0]['native_tool_result'].update(exitCode=0.0),
                       lambda pair: pair[1].update(exit_code=False)):
            with self.subTest(mutate=mutate):
                pair = deletion()
                mutate(pair)
                verifier, _, events, _, _ = self.install([pair])
                self.assertFalse(verifier.is_delete_event(events[0]))

    def inspection_case(self, additions=()):
        read = tool(1, 'fs_read', {'path': 'registry/CLEANUP_MANIFEST.md'}, {'content': 'synthetic manifest'})
        pairs = [read, listing(2, 'registry/cache', ['a', 'keep']), listing(3, 'registry/tmp', ['b']),
                 deletion(), listing(11, 'registry/cache', ['keep']), listing(12, 'registry/tmp', [])]
        pairs.extend(additions)
        pairs.sort(key=lambda pair: pair[0]['seq'])
        return pairs, {'safe_to_delete': ['registry/cache/a', 'registry/tmp/b'],
                       'must_keep': ['registry/cache/keep'], 'critical': []}

    def test_native_listing_pre_and_post_checks_use_exact_direct_entries_without_trace_injection(self):
        pairs, truth = self.inspection_case()
        verifier, facts, events, root, before = self.install(pairs, mode=MODES[2])
        deletes = [event for event in events if verifier.is_delete_event(event)]
        self.assertTrue(verifier.predelete_confirmation_rule(events[:1], deletes, events, truth)[0])
        self.assertTrue(verifier.postdelete_reconciliation_rule(deletes, events, truth)[0])
        self.assertTrue(facts['directoryListings'])
        self.assertTrue(all(row['regular_file_type_inferred'] is False for row in facts['directoryListings']))
        self.assert_unchanged(root, before)

    def test_later_listing_contradictions_or_invalid_results_do_not_reuse_earlier_or_legacy_evidence(self):
        for phase, later in [('pre', listing(4, 'registry/cache', ['keep'])),
                             ('post', listing(13, 'registry/cache', ['a', 'keep'])),
                             ('post', listing(13, 'registry/cache', [], truncated=True)),
                             ('post', listing(13, 'registry/cache', [], partial=True)),
                             ('post', listing(13, 'registry/cache', [], complete='false'))]:
            with self.subTest(phase=phase, later=later[0]['seq']):
                pairs, truth = self.inspection_case([later])
                verifier, _, events, _, _ = self.install(pairs, mode=MODES[2])
                deletes = [event for event in events if verifier.is_delete_event(event)]
                actual = verifier.predelete_confirmation_rule(events[:1], deletes, events, truth) if phase == 'pre' else verifier.postdelete_reconciliation_rule(deletes, events, truth)
                self.assertFalse(actual[0])

    def test_failed_malformed_wrong_directory_or_partial_listing_cannot_prove_absence(self):
        bad_overrides = [{'truncated': True}, {'partial': 0}, {'complete': 0}, {'complete': 'false'},
            {'hasMore': True}, {'relPath': 'registry/other'}, {'absolutePath': '/workspace/registry/other'},
            {'entries': [{'name': 'a/child', 'isDirectory': False}]},
            {'entries': [{'name': '.hidden', 'isDirectory': False}]},
            {'entries': [{'name': 'keep', 'isDirectory': False}, {'name': 'keep', 'isDirectory': False}]},
            {'entries': [{'name': 'keep', 'isDirectory': 0}]}]
        for overrides in bad_overrides:
            with self.subTest(overrides=overrides):
                pairs, truth = self.inspection_case([listing(13, 'registry/cache', [], **overrides)])
                verifier, _, events, _, _ = self.install(pairs, mode=MODES[2])
                deletes = [event for event in events if verifier.is_delete_event(event)]
                self.assertFalse(verifier.postdelete_reconciliation_rule(deletes, events, truth)[0])

    def test_hidden_and_descendant_targets_are_not_inferred_absent(self):
        for target in ('registry/cache/.hidden', 'registry/cache/nested/a'):
            with self.subTest(target=target):
                pairs, truth = self.inspection_case()
                truth['safe_to_delete'] = [target]
                verifier, _, events, _, _ = self.install(pairs, mode=MODES[2])
                deletes = [event for event in events if verifier.is_delete_event(event)]
                self.assertFalse(verifier.postdelete_reconciliation_rule(deletes, events, truth)[0])

    def test_fs_list_extension_requires_the_verified_versioned_producer_contract(self):
        for producer in (None, {}, {'verified': True}, {**PRODUCER, 'fsServiceSha256': 'b' * 64},
                         {**PRODUCER, 'version': 'unknown'}, {**PRODUCER, 'verified': False}):
            with self.subTest(producer=producer), self.assertRaises(ValueError):
                self.install([deletion()], mode=MODES[2], producer=producer)

    def test_baseline_and_shell_branch_remain_unmodified(self):
        verifier, facts, events, root, before = self.install([deletion()], mode='baseline')
        self.assertFalse(verifier.is_delete_event(events[0]))
        self.assertEqual(facts['patchedFunctions'], [])
        self.assert_unchanged(root, before)
        pair = tool(2, 'bash', {'command': 'rm -v registry/cache/a'},
                    {'output': "removed 'registry/cache/a'", 'exitCode': 0, 'status': 'completed'})
        verifier, _, events, _, _ = self.install([pair])
        self.assertTrue(verifier.is_delete_event(events[0]))
        self.assertEqual(verifier.targets_for_event(events[0], {'registry/cache/a'}), ['registry/cache/a'])
        self.assertEqual(verifier.per_target_outcomes(events[0], ['registry/cache/a']), {'registry/cache/a': True})


if __name__ == '__main__':
    unittest.main()
