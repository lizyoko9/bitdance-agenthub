"""Replay retained G1 evidence with nonofficial recognition extensions only."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import shutil
import stat
import sys
import tarfile
from contextlib import contextmanager
from dataclasses import replace
from pathlib import Path
from typing import Any

from tracetrial_bench.llm_judge import JudgeRuntime, run_layered_judge
from tracetrial_bench.score_config import load_score_sheet
from tracetrial_bench.task_resolver import resolve_task
from tracetrial_bench.types import EvaluationResult
from tracetrial_bench.workspace import RunLayout, load_persisted_baseline

from .judge import _minimal_environment
from .run_trial import SOURCE_REVISION, checked_source, check_installed_benchmark


TASK_ID = 'G1-registry-cleanup-002'
MODES = ('baseline', 'python_delete', 'python_delete_fs_list')
COPIED_DIRECTORIES = ('agent/workspace', 'artifacts/trace/agenthub', 'artifacts/execution_probe')
COPIED_FILES = ('agent/prompt.md', 'agent/native/trial/events.jsonl', 'agent/native/trial/result.json',
                'agent/native/trial/manifest.json', 'agent/native/trial/requests.jsonl',
                'artifacts/admission.json', 'artifacts/source-integrity.json', 'artifacts/protocol.json')
OFFICIAL_FILES = {'rules.json': 'artifacts/verifier_output/score.json',
                  'combined.json': 'artifacts/llm_judge/combined_score.json',
                  'summary.json': 'artifacts/agenthub_scoring/summary.json'}
EXPECTED_FS_PRODUCERS = {
    'src/server/fs-service.ts': '8a30e6a55a080211276cc891a8e639b8c551b7f5727157e47568f1b30c4d4e45',
    'src/server/tools/fs-list.ts': '4a4162975dea08d6588312a952c9ad9cdf9a3573055bedad2edb95ce88d9c3b2',
}


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def _safe_path(value: Path, *, exists: bool = True) -> Path:
    if '..' in Path(value).parts:
        raise ValueError('Diagnostic paths must not contain parent traversal')
    candidate = Path(os.path.abspath(value))
    for node in (candidate, *candidate.parents):
        if node.is_symlink():
            raise ValueError('Diagnostic paths must not traverse symlinks')
    return candidate.resolve(strict=exists)


def _tree(root: Path, *, reject_links: bool = False) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for folder, directories, files in os.walk(root, followlinks=False):
        for name in sorted([*directories, *files]):
            path = Path(folder) / name
            info = path.lstat()
            relative = path.relative_to(root).as_posix()
            if stat.S_ISLNK(info.st_mode):
                if reject_links:
                    raise ValueError('Diagnostic input trees must not contain symlinks')
                result[relative] = {'symlink': os.readlink(path)}
            elif stat.S_ISREG(info.st_mode):
                result[relative] = {'sha256': _sha(path), 'mode': stat.S_IMODE(info.st_mode)}
            elif not stat.S_ISDIR(info.st_mode):
                raise ValueError('Diagnostic input trees require regular files and directories')
    return result


def _file_hashes(root: Path) -> dict[str, str]:
    return {name: value['sha256'] for name, value in _tree(root, reject_links=True).items()
            if '__pycache__' not in Path(name).parts and not name.endswith(('.pyc', '.pyo'))}


def _source_state(source: Path, task: Any) -> dict[str, Any]:
    return {'task': _file_hashes(task.task_dir), 'packages': {
        package: {name: digest for name, digest in _file_hashes(source / package).items() if name.endswith('.py')}
        for package in ('tracetrial_bench', 'harness_tracer')}}


@contextmanager
def _isolated_environment():
    original = dict(os.environ)
    bytecode = sys.dont_write_bytecode
    minimum = _minimal_environment()
    try:
        os.environ.clear()
        os.environ.update(minimum)
        sys.dont_write_bytecode = True
        yield
    finally:
        os.environ.clear()
        os.environ.update(original)
        sys.dont_write_bytecode = bytecode


class _NoModelRequester:
    def __init__(self, record_path: Path):
        self.attempts = 0
        self.record_path = record_path
        self._persist()

    def _persist(self):
        _write_json(self.record_path, {'transportProhibited': True, 'modelRequests': 0,
                                     'logicalAttempts': self.attempts})

    def __call__(self, *_arguments):
        self.attempts += 1
        self._persist()
        raise RuntimeError('Model requests are prohibited in recognition diagnostics')


def _rule_items(payload: dict[str, Any], expected: dict[str, set[str]]) -> dict[str, dict[str, Any]]:
    layers = payload.get('rule_results')
    if payload.get('schema_version') != 'harnessbench_rule_results_v1' or not isinstance(layers, dict) or set(layers) != set(expected):
        raise ValueError('Diagnostic requires a complete two-layer deterministic rule payload')
    result = {}
    for layer, identities in expected.items():
        rows = layers[layer]
        if not isinstance(rows, list) or len(rows) != len(identities):
            raise ValueError('Diagnostic requires all seventeen original deterministic rules')
        keyed = {}
        for row in rows:
            if not isinstance(row, dict) or row.get('id') in keyed or row.get('id') not in identities:
                raise ValueError('Diagnostic rule identities must match the original score sheets')
            if type(row.get('score')) not in (int, float) or row['score'] not in (0, 1) or not isinstance(row.get('reason'), str):
                raise ValueError('Diagnostic rules require binary scores and explicit reasons')
            keyed[row['id']] = row
        result[layer] = keyed
    return result


def _validate_subject(source: Path, trial: Path) -> dict[str, Any]:
    for relative in COPIED_DIRECTORIES:
        path = _safe_path(trial / relative)
        if not path.is_dir():
            raise ValueError('Retained diagnostic directory is missing')
        _tree(path, reject_links=True)
    for relative in (*COPIED_FILES, *OFFICIAL_FILES.values(), 'artifacts/private_evidence/scoring_inputs/manifest.json'):
        if not _safe_path(trial / relative).is_file():
            raise ValueError('Retained diagnostic file is missing')
    checked_source(source)
    check_installed_benchmark(source)
    task = resolve_task(source / 'Task' / TASK_ID)
    if task.task_id != TASK_ID or task.scoring is None:
        raise ValueError('Recognition diagnostics only support the pinned layered G1 task')
    sheets = {layer: load_score_sheet(path, expected_layer=layer) for layer, path in (
        ('harness', task.scoring.harness_score_path), ('agent', task.scoring.agent_score_path))}
    expected = {layer: {item.id for item in sheet.items} for layer, sheet in sheets.items()}
    if any(sheet.rubric_items for sheet in sheets.values()) or len(expected['harness']) != 8 or len(expected['agent']) != 9:
        raise ValueError('Recognition diagnostics require exactly seventeen rules and zero rubrics')
    source_state = _source_state(source, task)
    for relative, digest in source_state['task'].items():
        if relative.startswith(('verifier/', 'runtime/')) or relative in ('task.yaml', 'turns.json', 'isolation.yaml'):
            retained = _safe_path(trial / 'private' / relative)
            if _sha(retained) != digest:
                raise ValueError('Retained private task inputs differ from the pinned source')
    if _sha(trial / 'agent/prompt.md') != source_state['task']['prompt.md']:
        raise ValueError('Retained original prompt differs from the pinned task')
    admission = _read_json(trial / 'artifacts/admission.json')
    integrity = _read_json(trial / 'artifacts/source-integrity.json')
    protocol = _read_json(trial / 'artifacts/protocol.json')
    if admission.get('taskId') != TASK_ID or admission.get('sourceRevision') != SOURCE_REVISION or admission.get('sourceTaskHashes') != source_state['task']:
        raise ValueError('Retained admission is not bound to the pinned G1 task files')
    if integrity.get('unchanged') is not True or integrity.get('before') != source_state['task'] or integrity.get('after') != source_state['task']:
        raise ValueError('Retained source-integrity evidence does not match the pinned task')
    if protocol.get('taskId') != TASK_ID or protocol.get('upstream') != SOURCE_REVISION or protocol.get('sourceTaskHashesBefore') != source_state['task']:
        raise ValueError('Retained protocol does not match the pinned G1 source')
    official = {name: _read_json(trial / relative) for name, relative in OFFICIAL_FILES.items()}
    summary = official['summary.json']
    if summary.get('taskId') != TASK_ID or summary.get('upstreamCommit') != SOURCE_REVISION or summary.get('scoringStatus') != 'completed' or summary.get('error') is not None:
        raise ValueError('Retained official scoring did not complete for the pinned G1 task')
    if summary.get('ruleScore') != official['rules.json'] or summary.get('combinedScore') != official['combined.json']:
        raise ValueError('Retained official scoring artifacts disagree')
    for field in ('rawEvaluation', 'effectiveEvaluation'):
        if not isinstance(summary.get(field), dict) or summary[field].get('score') != official['combined.json'].get('score'):
            raise ValueError('Retained official scores disagree with the layered result')
    original_rules = _rule_items(official['rules.json'], expected)
    trace = _read_json(trial / 'artifacts/trace/agenthub/summary.json')
    events = _read_json(trial / 'artifacts/trace/agenthub/events.json')
    if not isinstance(events, list) or not events or trace.get('last_event_seq') != events[-1].get('seq'):
        raise ValueError('Retained canonical trace and summary disagree')
    for field, filename in (('events_path', 'events.json'), ('summary_path', 'summary.json')):
        if _safe_path(Path(trace.get(field, ''))) != trial / 'artifacts/trace/agenthub' / filename:
            raise ValueError('Retained canonical summary points outside its archived trace')
    native_sources = trace.get('agenthub_native_sources', {})
    for label, filename in (('events', 'source-events.jsonl'), ('result', 'source-result.json')):
        archive = trial / 'artifacts/trace/agenthub' / filename
        native = trial / 'agent/native/trial' / ('events.jsonl' if label == 'events' else 'result.json')
        if _safe_path(Path(native_sources.get(label, ''))) != archive or native_sources.get(label + '_sha256') != _sha(archive) or _sha(archive) != _sha(native):
            raise ValueError('Retained native archive provenance does not match its original bytes')
    native_manifest = _read_json(trial / 'agent/native/trial/manifest.json')
    if native_manifest.get('benchmark') != 'tracetrial' or native_manifest.get('taskId') != TASK_ID or native_manifest.get('sourceRevision') != SOURCE_REVISION:
        raise ValueError('Retained native manifest has a different task or benchmark source')
    baseline = load_persisted_baseline(trial / 'artifacts/private_evidence/scoring_inputs/manifest.json', trial, task)
    _tree(baseline, reject_links=True)
    return {'task': task, 'sourceState': source_state, 'trace': trace, 'official': official,
            'originalRules': original_rules, 'expected': expected, 'baseline': baseline}


def _copy_directory(source: Path, target: Path) -> dict[str, Any]:
    before = _tree(source, reject_links=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, target)
    if before != _tree(target, reject_links=True) or before != _tree(source, reject_links=True):
        raise ValueError('Diagnostic copied inputs differ from their retained bytes')
    return before


def _copy_file(source: Path, target: Path) -> str:
    _safe_path(source)
    before = _sha(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    if _sha(target) != before or _sha(source) != before:
        raise ValueError('Diagnostic copied input changed during copying')
    return before


def _copy_mode(trial: Path, mode_dir: Path, subject: dict[str, Any]) -> tuple[RunLayout, dict[str, Any]]:
    mode_dir.mkdir(mode=0o700)
    copied = {}
    for relative in COPIED_DIRECTORIES:
        copied[relative] = _copy_directory(trial / relative, mode_dir / relative)
    for relative in COPIED_FILES:
        copied[relative] = _copy_file(trial / relative, mode_dir / relative)
    copied['private/verifier'] = _copy_directory(subject['task'].task_dir / 'verifier', mode_dir / 'private/verifier')
    copied['private/.baseline_workspace'] = _copy_directory(subject['baseline'], mode_dir / 'private/.baseline_workspace')
    for name, relative in OFFICIAL_FILES.items():
        copied['baseline_scores/' + name] = _copy_file(trial / relative, mode_dir / 'baseline_scores' / name)
    layout = RunLayout(mode_dir, mode_dir / 'agent', mode_dir / 'agent/workspace', mode_dir / 'private',
                       mode_dir / 'private/verifier', mode_dir / 'artifacts', mode_dir / 'private/.baseline_workspace')
    return layout, copied


def _comparison(original: dict[str, dict[str, Any]], current: dict[str, dict[str, Any]], trial: Path, mode_dir: Path) -> list[dict[str, Any]]:
    differences = []
    for layer, rows in original.items():
        for identity, before in rows.items():
            after = current[layer][identity]
            normalized = after['reason'].replace(str(mode_dir), str(trial))
            if before['score'] != after['score'] or before['reason'] != normalized:
                differences.append({'layer': layer, 'id': identity, 'originalScore': before['score'],
                                    'diagnosticScore': after['score'], 'originalReason': before['reason'],
                                    'diagnosticReason': after['reason'], 'scoreChanged': before['score'] != after['score']})
    return differences


def _verified_producer(trial: Path, layout: RunLayout, subject: dict[str, Any]) -> dict[str, str]:
    protocol = _read_json(trial / 'artifacts/protocol.json')
    runtime = protocol.get('runtime', {}).get('runtime', {})
    archive_path = _safe_path(Path(runtime.get('archive', '')))
    if not archive_path.is_file() or _sha(archive_path) != runtime.get('sha256'):
        raise ValueError('Native listing completeness requires the retained verified runtime archive')
    subject['externalInputs'][str(archive_path)] = runtime['sha256']
    members = {}
    with tarfile.open(archive_path, 'r:gz') as archive:
        for entry in archive:
            path = Path(entry.name)
            if (not entry.isfile() or not path.parts or path.is_absolute() or '..' in path.parts
                    or '\\' in entry.name or path.as_posix() != entry.name or entry.name in members):
                raise ValueError('Runtime producer archive requires unique safe regular members')
            members[entry.name] = archive.extractfile(entry).read()
    manifest = json.loads(members.get('runtime-source.json', b'null'))
    if not isinstance(manifest, dict) or manifest.get('schemaVersion') != 1 or not isinstance(manifest.get('files'), dict):
        raise ValueError('Runtime producer archive has no valid source manifest')
    if set(members) != {*manifest['files'], 'runtime-source.json'}:
        raise ValueError('Runtime producer archive members differ from the source manifest')
    if any(hashlib.sha256(members[name]).hexdigest() != digest for name, digest in manifest['files'].items()):
        raise ValueError('Runtime producer archive member hashes differ from the manifest')
    if manifest.get('agenthubCommit') != runtime.get('agenthubCommit') or manifest.get('agenthubCommit') != protocol.get('agenthubCommit'):
        raise ValueError('Runtime producer source commit differs from the retained protocol')
    if runtime.get('sourceFiles') != len(manifest['files']) or runtime.get('bytes') != archive_path.stat().st_size:
        raise ValueError('Runtime producer archive metadata differs from the retained protocol')
    for name, digest in EXPECTED_FS_PRODUCERS.items():
        if manifest['files'].get(name) != digest or hashlib.sha256(members.get(name, b'')).hexdigest() != digest:
            raise ValueError('Native fs_list producer is outside the audited complete-listing contract')
    copied = layout.run_dir / 'inputs/runtime.tar.gz'
    subject.setdefault('modeExternalInputs', {})[layout.run_dir.name] = {'inputs/runtime.tar.gz': runtime['sha256']}
    if _copy_file(archive_path, copied) != runtime['sha256']:
        raise ValueError('Runtime producer archive changed during diagnostic copying')
    return {'version': 'agenthub_fs_list_complete_v1', 'runtimeArchiveSha256': runtime['sha256'],
            'fsServiceSha256': EXPECTED_FS_PRODUCERS['src/server/fs-service.ts'],
            'fsListSha256': EXPECTED_FS_PRODUCERS['src/server/tools/fs-list.ts']}


def _evaluate_mode(mode: str, trial: Path, layout: RunLayout, subject: dict[str, Any]) -> dict[str, Any]:
    from .g1_recognition import install_recognition

    verifier_path = layout.verifier_dir / 'score.py'
    if _sha(verifier_path) != subject['sourceState']['task']['verifier/score.py']:
        raise ValueError('Diagnostic verifier copy differs from its pinned source')
    spec = importlib.util.spec_from_file_location('g1_diagnostic_' + mode, verifier_path)
    verifier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(verifier)
    contract = _verified_producer(trial, layout, subject) if mode == 'python_delete_fs_list' else None
    recognition = install_recognition(verifier, mode=mode, run_dir=layout.run_dir, producer_contract=contract)
    payload = verifier.evaluate(layout.workspace_dir, layout.run_dir)
    rules = _rule_items(payload, subject['expected'])
    rule_dir = layout.artifacts_dir / 'diagnostic_rule_output'
    rule_dir.mkdir()
    _write_json(rule_dir / 'score.json', payload)
    _write_json(rule_dir / 'stdout.log', payload)
    (rule_dir / 'stderr.log').write_text('')
    objective = EvaluationResult('pass', None, 0, rule_dir / 'stdout.log', rule_dir / 'stderr.log', rule_dir / 'score.json')
    derived = dict(subject['trace'])
    derived.update(events_path=str(layout.artifacts_dir / 'trace/agenthub/events.json'),
                   summary_path=str(layout.artifacts_dir / 'trace/agenthub/summary.json'))
    _write_json(layout.artifacts_dir / 'derived-trace-summary.json', derived)
    requester = _NoModelRequester(layout.artifacts_dir / 'diagnostic-model-guard.json')
    runtime = JudgeRuntime(provider='openai', model='gpt-6-luna', base_url='https://api.openai.com/v1',
                           api_key='', api_mode='chat_completions', timeout=60, retry_delays=())
    copied_scoring = replace(subject['task'].scoring,
        harness_score_path=layout.verifier_dir / subject['task'].scoring.harness_score_path.name,
        agent_score_path=layout.verifier_dir / subject['task'].scoring.agent_score_path.name)
    copied_task = replace(subject['task'], scoring=copied_scoring)
    outcome = run_layered_judge(task=copied_task, layout=layout, objective=objective,
                                trace_summary=derived, runtime=runtime, requester=requester)
    if requester.attempts:
        raise RuntimeError('Diagnostic aggregation attempted a prohibited model request')
    combined = _read_json(outcome.score_path)
    result = {'schemaVersion': 'agenthub_g1_recognition_diagnostic_mode_v1', 'nonofficial': True,
              'mode': mode, 'actorRunHere': False, 'judgeRequests': 0, 'judgeLogicalAttempts': requester.attempts,
              'originalScore': subject['official']['combined.json']['score'], 'diagnosticScore': outcome.score,
              'diagnosticStatus': outcome.status, 'recognition': recognition,
              'producerContract': contract,
              'ruleResults': payload, 'perRuleDifferences': _comparison(subject['originalRules'], rules, trial, layout.run_dir),
              'diagnosticLayeredResult': combined}
    return result


def _copied_state(mode_dir: Path, original: dict[str, Any]) -> dict[str, Any]:
    return {relative: _tree(mode_dir / relative, reject_links=True) if isinstance(value, dict)
            else _sha(_safe_path(mode_dir / relative)) for relative, value in original.items()}


def _score_mode(mode: str, source: Path, trial: Path, mode_dir: Path, subject: dict[str, Any]) -> dict[str, Any]:
    layout, copied = _copy_mode(trial, mode_dir, subject)
    result = {'schemaVersion': 'agenthub_g1_recognition_diagnostic_mode_v1', 'nonofficial': True,
              'mode': mode, 'status': 'failed', 'actorRunHere': False, 'judgeRequests': 0,
              'copiedInputHashesBefore': copied}
    error = None
    try:
        result.update(_evaluate_mode(mode, trial, layout, subject))
        result['status'] = 'completed'
    except Exception as exception:
        error = exception
        result['errorType'] = type(exception).__name__
    finally:
        guard = layout.artifacts_dir / 'diagnostic-model-guard.json'
        try:
            if guard.is_file():
                result['judgeLogicalAttempts'] = _read_json(guard)['logicalAttempts']
        except Exception as exception:
            result.update(status='failed', guardAuditErrorType=type(exception).__name__)
            error = error or exception
        copied.update(subject.get('modeExternalInputs', {}).get(mode, {}))
        try:
            after = _copied_state(mode_dir, copied)
            result.update(copiedInputHashesAfter=after, copiedInputsUnchanged=copied == after)
            if copied != after:
                raise ValueError('Diagnostic hooks changed copied measurement inputs')
        except Exception as exception:
            result.update(status='failed', copiedInputsUnchanged=False, copyAuditErrorType=type(exception).__name__)
            error = error or exception
        _write_json(mode_dir / 'diagnostic.json', result)
    if error is not None:
        raise error
    return result


def _processor_hashes() -> dict[str, str]:
    return {name: _sha(Path(__file__).with_name(name)) for name in ('diagnose_g1.py', 'g1_recognition.py')}


def diagnose(*, source: Path, trial: Path, output: Path) -> dict[str, Any]:
    source = _safe_path(source)
    trial = _safe_path(trial)
    output = _safe_path(output, exists=False)
    if output.exists():
        raise FileExistsError('Diagnostic output already exists; use a fresh directory')
    for protected in (source, trial):
        if output.is_relative_to(protected) or protected.is_relative_to(output):
            raise ValueError('Diagnostic output must not overlap source or retained trial')
    before = _tree(trial)
    subject = _validate_subject(source, trial)
    subject['externalInputs'] = {}
    source_before = subject['sourceState']
    output.mkdir(parents=True, mode=0o700)
    result = {'schemaVersion': 'agenthub_g1_recognition_diagnostic_v1', 'taskId': TASK_ID,
              'nonofficial': True, 'scope': 'offline retained-evidence recognition diagnostic; not an official score',
              'actorRunHere': False, 'judgeRequests': 0, 'status': 'failed', 'sourceRevision': SOURCE_REVISION,
              'originalTrial': str(trial), 'originalScore': subject['official']['combined.json']['score'],
              'inputHashesBefore': before, 'sourceHashesBefore': source_before,
              'externalInputHashesBefore': subject['externalInputs'],
              'processorHashesBefore': _processor_hashes(), 'modes': {}, 'diagnosticScoresReported': False}
    error = None
    try:
        with _isolated_environment():
            for mode in MODES:
                mode_result = _score_mode(mode, source, trial, output / mode, subject)
                result['modes'][mode] = mode_result
                if mode == 'baseline' and (mode_result['perRuleDifferences'] or mode_result['diagnosticScore'] != result['originalScore']):
                    raise ValueError('Unmodified replay differs from the retained official baseline; patched scores are withheld')
        result.update(status='completed', diagnosticScoresReported=True)
    except Exception as exception:
        error = exception
        result['errorType'] = type(exception).__name__
    finally:
        for label, after_key, read, expected in (
            ('originalInputs', 'inputHashesAfter', lambda: _tree(trial), before),
            ('benchmarkSource', 'sourceHashesAfter', lambda: (checked_source(source), check_installed_benchmark(source),
                                         _source_state(source, subject['task']))[-1], source_before),
            ('processors', 'processorHashesAfter', _processor_hashes, result['processorHashesBefore']),
            ('externalInputs', 'externalInputHashesAfter',
                lambda: {name: _sha(_safe_path(Path(name))) for name in subject['externalInputs']},
                subject['externalInputs']),
        ):
            try:
                observed = read()
                result[after_key] = observed
                result[label + 'Unchanged'] = observed == expected
                if observed != expected:
                    raise ValueError('Recognition diagnostics changed protected inputs or processors')
            except Exception as exception:
                result.update(status='failed', diagnosticScoresReported=False)
                result[label + 'Unchanged'] = False
                result[label + 'AuditErrorType'] = type(exception).__name__
                error = error or exception
        _write_json(output / 'diagnostic.json', result)
    if error is not None:
        raise error
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description='Nonofficial zero-model retained G1 recognition diagnostic')
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--trial', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    try:
        result = diagnose(source=args.source, trial=args.trial, output=args.out)
    except Exception as exception:
        print(json.dumps({'nonofficial': True, 'status': 'failed', 'errorType': type(exception).__name__,
                          'message': 'Diagnostic did not complete; no corrected score is authorized.'}))
        return 1
    print(json.dumps({'nonofficial': True, 'status': result['status'], 'originalScore': result['originalScore'],
                      'diagnosticScores': {mode: value['diagnosticScore'] for mode, value in result['modes'].items()},
                      'actorRunHere': False, 'judgeRequests': 0, 'output': str(args.out)}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
