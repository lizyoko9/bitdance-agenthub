import hashlib
import io
import json
import os
import shutil
import tempfile
import tarfile
import types
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

from tracetrial_bench.types import EvaluationResult, LayeredScoringSpec, TaskSpec, VerifierSpec
from tracetrial_bench.workspace import RunLayout, persist_scoring_inputs

from . import diagnose_g1 as diagnostic


class RecognitionDiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.source = self.root / 'source'
        self.trial = self.root / 'retained'
        self.output = self.root / 'diagnostic'
        task_dir = self.source / 'Task' / diagnostic.TASK_ID
        verifier = task_dir / 'verifier'
        verifier.mkdir(parents=True)
        self.payload = {'schema_version': 'harnessbench_rule_results_v1', 'rule_results': {
            layer: [{'id': f'{layer}_{index}', 'score': 0, 'reason': 'retained baseline rule'} for index in range(count)]
            for layer, count in (('harness', 8), ('agent', 9))}}
        (verifier / 'score.py').write_text('import json\nPAYLOAD = ' + repr(self.payload) + '\n'
            'def evaluate(workspace, run_dir):\n    return json.loads(json.dumps(PAYLOAD))\n'
            'def self_test():\n    raise AssertionError("self-test must not execute")\n'
            'if __name__ == "__main__":\n    raise AssertionError("main must not execute")\n')
        (verifier / 'run.sh').write_text('#!/bin/sh\nexit 99\n')
        (verifier / 'truth.json').write_text('{}\n')
        for layer in ('harness', 'agent'):
            items = ''.join(f'  - id: {row["id"]}\n    type: rule\n    criterion: fixture rule\n'
                            for row in self.payload['rule_results'][layer])
            (verifier / f'{layer}_score.yaml').write_text(f'version: score_v1\nlayer: {layer}\nitems:\n{items}')
        (task_dir / 'workspace').mkdir()
        (task_dir / 'workspace/protected.txt').write_text('protected fixture\n')
        for name in ('task.yaml', 'turns.json', 'isolation.yaml', 'prompt.md'):
            (task_dir / name).write_text('{}\n')
        for package in ('tracetrial_bench', 'harness_tracer'):
            (self.source / package).mkdir()
            (self.source / package / '__init__.py').write_text('# fixture package\n')
        self.task = TaskSpec(diagnostic.TASK_ID, task_dir, 'fixture prompt', task_dir / 'workspace',
            VerifierSpec('verifier/run.sh'), scoring=LayeredScoringSpec('score_v1',
                verifier / 'harness_score.yaml', verifier / 'agent_score.yaml'))
        for relative in diagnostic.COPIED_DIRECTORIES:
            (self.trial / relative).mkdir(parents=True)
        for relative in diagnostic.COPIED_FILES:
            diagnostic._write_json(self.trial / relative, {})
        shutil.copytree(verifier, self.trial / 'private/verifier')
        shutil.copytree(task_dir / 'workspace', self.trial / 'private/.baseline_workspace')
        for name in ('task.yaml', 'turns.json', 'isolation.yaml'):
            shutil.copy2(task_dir / name, self.trial / 'private' / name)
        shutil.copy2(task_dir / 'prompt.md', self.trial / 'agent/prompt.md')
        self.report = self.trial / 'agent/workspace/report.md'
        self.report.write_text('original measured report\n')
        self.layout = RunLayout(self.trial, self.trial / 'agent', self.trial / 'agent/workspace',
            self.trial / 'private', self.trial / 'private/verifier', self.trial / 'artifacts',
            self.trial / 'private/.baseline_workspace')
        persist_scoring_inputs(self.task, self.layout)
        task_hashes = diagnostic._source_state(self.source, self.task)['task']
        diagnostic._write_json(self.trial / 'artifacts/admission.json', {'taskId': diagnostic.TASK_ID,
            'sourceRevision': diagnostic.SOURCE_REVISION, 'sourceTaskHashes': task_hashes})
        diagnostic._write_json(self.trial / 'artifacts/source-integrity.json',
                              {'unchanged': True, 'before': task_hashes, 'after': task_hashes})
        diagnostic._write_json(self.trial / 'artifacts/protocol.json', {'taskId': diagnostic.TASK_ID,
            'upstream': diagnostic.SOURCE_REVISION, 'sourceTaskHashesBefore': task_hashes})
        self.producer_files = {name: ('fixture producer ' + name).encode() for name in diagnostic.EXPECTED_FS_PRODUCERS}
        self.producer_hashes = {name: hashlib.sha256(data).hexdigest() for name, data in self.producer_files.items()}
        self.archive = self.root / 'runtime.tar.gz'
        self._write_runtime_archive()
        native = self.trial / 'agent/native/trial'
        diagnostic._write_json(native / 'manifest.json', {'taskId': diagnostic.TASK_ID,
            'sourceRevision': diagnostic.SOURCE_REVISION, 'benchmark': 'tracetrial'})
        (native / 'events.jsonl').write_text('{"command":"never execute this shell text"}\n')
        diagnostic._write_json(native / 'result.json', {'runStatus': 'complete'})
        trace = self.trial / 'artifacts/trace/agenthub'
        shutil.copy2(native / 'events.jsonl', trace / 'source-events.jsonl')
        shutil.copy2(native / 'result.json', trace / 'source-result.json')
        diagnostic._write_json(trace / 'events.json', [{'seq': 1, 'event_type': 'run_finished'}])
        diagnostic._write_json(trace / 'summary.json', {'last_event_seq': 1,
            'events_path': str(trace / 'events.json'), 'summary_path': str(trace / 'summary.json'),
            'agenthub_native_sources': {'events': str(trace / 'source-events.jsonl'),
                'result': str(trace / 'source-result.json'), 'events_sha256': diagnostic._sha(native / 'events.jsonl'),
                'result_sha256': diagnostic._sha(native / 'result.json')}})
        diagnostic._write_json(self.trial / 'artifacts/execution_probe/evidence.json', {})
        self.combined = {'score': 0.0}
        self.official_summary = {'taskId': diagnostic.TASK_ID, 'upstreamCommit': diagnostic.SOURCE_REVISION,
            'scoringStatus': 'completed', 'error': None, 'ruleScore': self.payload,
            'combinedScore': self.combined, 'rawEvaluation': {'score': 0.0}, 'effectiveEvaluation': {'score': 0.0}}
        for key, value in (('rules.json', self.payload), ('combined.json', self.combined),
                           ('summary.json', self.official_summary)):
            diagnostic._write_json(self.trial / diagnostic.OFFICIAL_FILES[key], value)
        self.modes = []
        self.install = self.install_hook
        self.aggregate = self.layered_result
        self.check_source = lambda _source: self.source
        self.hash_processors = lambda: {'runner': 'fixture', 'helper': 'fixture'}

    def _write_runtime_archive(self, *, duplicate=False, invalid_member=False):
        commit = '0' * 40
        manifest = {'schemaVersion': 1, 'agenthubCommit': commit, 'files': self.producer_hashes}
        members = {**self.producer_files, 'runtime-source.json': json.dumps(manifest).encode()}
        with tarfile.open(self.archive, 'w:gz') as archive:
            for name, data in members.items():
                entry = tarfile.TarInfo(name)
                entry.size = len(data)
                archive.addfile(entry, io.BytesIO(data))
            if duplicate:
                name, data = next(iter(members.items()))
                entry = tarfile.TarInfo(name)
                entry.size = len(data)
                archive.addfile(entry, io.BytesIO(data))
            if invalid_member:
                entry = tarfile.TarInfo('../escape')
                entry.size = 0
                archive.addfile(entry, io.BytesIO())
        path = self.trial / 'artifacts/protocol.json'
        protocol = diagnostic._read_json(path)
        protocol.update(agenthubCommit=commit, runtime={'runtime': {'archive': str(self.archive),
            'sha256': diagnostic._sha(self.archive), 'bytes': self.archive.stat().st_size,
            'sourceFiles': len(self.producer_files), 'agenthubCommit': commit}})
        diagnostic._write_json(path, protocol)

    def install_hook(self, verifier, *, mode, run_dir, producer_contract=None):
        self.modes.append(mode)
        if mode == 'python_delete_fs_list':
            self.assertEqual(producer_contract['runtimeArchiveSha256'], diagnostic._sha(self.archive))
        else:
            self.assertIsNone(producer_contract)
        if mode != 'baseline':
            verifier.PAYLOAD['rule_results']['harness'][0].update(score=1, reason='recognized fixture operation')
        if mode == 'python_delete_fs_list':
            verifier.PAYLOAD['rule_results']['agent'][0].update(score=1, reason='recognized fixture listing')
        return {'mode': mode, 'patchedFunctions': [] if mode == 'baseline' else ['fixture recognition']}

    def layered_result(self, *, task, layout, objective, trace_summary, runtime, requester):
        self.assertEqual(runtime.api_key, '')
        self.assertNotIn('OPENAI_API_KEY', os.environ)
        self.assertNotIn('DEEPSEEK_API_KEY', os.environ)
        self.assertEqual(trace_summary['events_path'], str(layout.artifacts_dir / 'trace/agenthub/events.json'))
        payload = diagnostic._read_json(objective.score_path)
        score = sum(row['score'] for row in payload['rule_results']['harness']) * 50 / 8
        score += sum(row['score'] for row in payload['rule_results']['agent']) * 50 / 9
        path = layout.artifacts_dir / 'llm_judge/combined_score.json'
        diagnostic._write_json(path, {'score': score, 'judge_runtime': {'logical_calls': 0}})
        return EvaluationResult('fail', score, 1, path.parent / 'stdout.log', path.parent / 'stderr.log', path)

    def run_diagnostic(self):
        helper = types.SimpleNamespace(install_recognition=lambda *args, **kwargs: self.install(*args, **kwargs))
        with ExitStack() as stack:
            stack.enter_context(patch.object(diagnostic, 'checked_source', side_effect=lambda source: self.check_source(source)))
            stack.enter_context(patch.object(diagnostic, 'check_installed_benchmark'))
            stack.enter_context(patch.object(diagnostic, 'resolve_task', return_value=self.task))
            stack.enter_context(patch.object(diagnostic, 'EXPECTED_FS_PRODUCERS', self.producer_hashes))
            stack.enter_context(patch.object(diagnostic, '_processor_hashes', side_effect=lambda: self.hash_processors()))
            stack.enter_context(patch.dict('sys.modules', {'eval.tracetrial.g1_recognition': helper}))
            stack.enter_context(patch.object(diagnostic, 'run_layered_judge', side_effect=lambda **kwargs: self.aggregate(**kwargs)))
            stack.enter_context(patch('subprocess.run', side_effect=AssertionError('No command may execute')))
            stack.enter_context(patch('socket.create_connection', side_effect=AssertionError('No network may execute')))
            return diagnostic.diagnose(source=self.source, trial=self.trial, output=self.output)

    def test_all_three_modes_copy_identical_inputs_and_keep_original_scores_and_reports(self):
        before = diagnostic._tree(self.trial)
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture-key', 'DEEPSEEK_API_KEY': 'fixture-other-key'}):
            result = self.run_diagnostic()
            self.assertEqual(os.environ['OPENAI_API_KEY'], 'fixture-key')
        self.assertEqual(self.modes, list(diagnostic.MODES))
        self.assertTrue(result['nonofficial'])
        self.assertTrue(result['diagnosticScoresReported'])
        self.assertTrue(result['originalInputsUnchanged'])
        self.assertTrue(result['benchmarkSourceUnchanged'])
        self.assertEqual(before, diagnostic._tree(self.trial))
        self.assertEqual(self.report.read_text(), 'original measured report\n')
        for mode in diagnostic.MODES:
            record = result['modes'][mode]
            self.assertEqual(record['originalScore'], 0.0)
            self.assertEqual(record['judgeRequests'], 0)
            self.assertFalse(record['actorRunHere'])
            self.assertTrue(record['copiedInputsUnchanged'])
            self.assertEqual(sum(len(rows) for rows in record['ruleResults']['rule_results'].values()), 17)
            copied = self.output / mode / 'artifacts/trace/agenthub/summary.json'
            self.assertEqual(copied.read_bytes(), (self.trial / 'artifacts/trace/agenthub/summary.json').read_bytes())

    def test_baseline_mismatch_stops_before_any_patched_score(self):
        original = self.aggregate
        def mismatch(**kwargs):
            result = original(**kwargs)
            return EvaluationResult(result.status, 1.0, result.exit_code, result.stdout_path, result.stderr_path, result.score_path)
        self.aggregate = mismatch
        with self.assertRaisesRegex(ValueError, 'baseline'):
            self.run_diagnostic()
        result = diagnostic._read_json(self.output / 'diagnostic.json')
        self.assertEqual(self.modes, ['baseline'])
        self.assertFalse(result['diagnosticScoresReported'])
        self.assertFalse((self.output / 'python_delete').exists())

    def test_reused_or_overlapping_output_is_rejected_without_running_scoring(self):
        self.output.mkdir()
        with self.assertRaises(FileExistsError):
            self.run_diagnostic()
        self.output = self.trial / 'nested-output'
        with self.assertRaisesRegex(ValueError, 'overlap'):
            self.run_diagnostic()
        self.assertEqual(self.modes, [])

    def test_symlink_inside_copied_inputs_is_rejected_before_reading_subject_metadata(self):
        (self.trial / 'agent/workspace/alias').symlink_to(self.report)
        with patch.object(diagnostic, '_read_json', side_effect=AssertionError('Input must be rejected before JSON reads')):
            with self.assertRaisesRegex(ValueError, 'symlink'):
                self.run_diagnostic()
        self.assertFalse(self.output.exists())

    def test_task_hash_drift_is_rejected_before_importing_verifier(self):
        admission = self.trial / 'artifacts/admission.json'
        value = diagnostic._read_json(admission)
        value['sourceTaskHashes']['prompt.md'] = 'wrong'
        diagnostic._write_json(admission, value)
        with self.assertRaisesRegex(ValueError, 'pinned G1 task'):
            self.run_diagnostic()
        self.assertEqual(self.modes, [])

    def test_native_archive_hash_drift_is_rejected(self):
        (self.trial / 'artifacts/trace/agenthub/source-events.jsonl').write_text('changed archive')
        with self.assertRaisesRegex(ValueError, 'native archive provenance'):
            self.run_diagnostic()
        self.assertEqual(self.modes, [])

    def test_hook_cannot_mutate_its_copied_report_silently(self):
        original = self.install
        def mutating(verifier, *, mode, run_dir, producer_contract=None):
            (run_dir / 'agent/workspace/report.md').write_text('changed copy')
            return original(verifier, mode=mode, run_dir=run_dir, producer_contract=producer_contract)
        self.install = mutating
        with self.assertRaisesRegex(ValueError, 'copied measurement'):
            self.run_diagnostic()
        mode = diagnostic._read_json(self.output / 'baseline/diagnostic.json')
        self.assertFalse(mode['copiedInputsUnchanged'])
        self.assertEqual(self.report.read_text(), 'original measured report\n')

    def test_no_model_requester_rejects_even_an_unexpected_logical_call(self):
        def prohibited(**kwargs):
            return kwargs['requester'](kwargs['runtime'], 'must not be sent')
        self.aggregate = prohibited
        with self.assertRaisesRegex(RuntimeError, 'prohibited'):
            self.run_diagnostic()
        result = diagnostic._read_json(self.output / 'diagnostic.json')
        self.assertFalse(result['diagnosticScoresReported'])
        self.assertEqual(result['judgeRequests'], 0)

    def test_final_source_check_failure_still_persists_failed_diagnostic(self):
        original = self.install
        def dirty_after_baseline(verifier, *, mode, run_dir, producer_contract=None):
            metadata = original(verifier, mode=mode, run_dir=run_dir, producer_contract=producer_contract)
            if mode == 'python_delete_fs_list':
                (self.task.task_dir / 'prompt.md').write_text('changed source')
            return metadata
        self.install = dirty_after_baseline
        with self.assertRaisesRegex(ValueError, 'protected inputs'):
            self.run_diagnostic()
        result = diagnostic._read_json(self.output / 'diagnostic.json')
        self.assertEqual(result['status'], 'failed')
        self.assertFalse(result['benchmarkSourceUnchanged'])
        self.assertFalse(result['diagnosticScoresReported'])

    def test_unknown_native_listing_producer_is_not_authorized_by_current_local_code(self):
        self.producer_files['src/server/fs-service.ts'] = b'future possibly paginated producer'
        self.producer_hashes = {name: hashlib.sha256(data).hexdigest() for name, data in self.producer_files.items()}
        self._write_runtime_archive()
        known_hashes = dict(self.producer_hashes)
        known_hashes['src/server/fs-service.ts'] = 'f' * 64
        with patch.object(self, 'producer_hashes', known_hashes):
            with self.assertRaisesRegex(ValueError, 'audited complete-listing'):
                self.run_diagnostic()
        self.assertEqual(self.modes, ['baseline', 'python_delete'])

    def test_runtime_archive_hash_is_bound_to_retained_protocol(self):
        with self.archive.open('ab') as stream:
            stream.write(b'changed archive bytes')
        with self.assertRaisesRegex(ValueError, 'retained verified runtime archive'):
            self.run_diagnostic()
        self.assertEqual(self.modes, ['baseline', 'python_delete'])

    def test_runtime_archive_rejects_unsafe_or_duplicate_members(self):
        for duplicate, invalid in ((True, False), (False, True)):
            with self.subTest(duplicate=duplicate, invalid=invalid):
                self._write_runtime_archive(duplicate=duplicate, invalid_member=invalid)
                self.output = self.root / ('duplicate' if duplicate else 'unsafe')
                with self.assertRaisesRegex(ValueError, 'unique safe regular'):
                    self.run_diagnostic()

    def test_final_checkout_guard_exception_is_persisted_without_losing_failed_status(self):
        checks = 0
        def source_check(_source):
            nonlocal checks
            checks += 1
            if checks > 1:
                raise ValueError('checkout no longer matches the pinned revision')
            return self.source
        self.check_source = source_check
        with self.assertRaisesRegex(ValueError, 'pinned revision'):
            self.run_diagnostic()
        result = diagnostic._read_json(self.output / 'diagnostic.json')
        self.assertEqual(result['status'], 'failed')
        self.assertFalse(result['benchmarkSourceUnchanged'])
        self.assertEqual(result['benchmarkSourceAuditErrorType'], 'ValueError')
        self.assertFalse(result['diagnosticScoresReported'])

    def test_changed_processor_hashes_withhold_diagnostic_scores(self):
        checks = 0
        def processor_hashes():
            nonlocal checks
            checks += 1
            return {'runner': 'fixture', 'helper': 'fixture' if checks == 1 else 'changed'}
        self.hash_processors = processor_hashes
        with self.assertRaisesRegex(ValueError, 'protected inputs or processors'):
            self.run_diagnostic()
        result = diagnostic._read_json(self.output / 'diagnostic.json')
        self.assertFalse(result['processorsUnchanged'])
        self.assertFalse(result['diagnosticScoresReported'])


if __name__ == '__main__':
    unittest.main()
