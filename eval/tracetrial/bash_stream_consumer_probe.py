"""Test-only bridge from a fresh offline native run to unchanged projection/consumer functions."""

import argparse
import copy
import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace


PINNED_REVISION = '98a381307184fa4212db3466b21b4c92a031940b'
CONSUMER_PATH = 'Task/E2-shard-stderr-003/verifier/score.py'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source', 'events', 'result', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    revision = subprocess.check_output(['git', '-C', str(args.source), 'rev-parse', 'HEAD'], text=True).strip()
    if revision != PINNED_REVISION:
        raise ValueError('Consumer probe requires the pinned official source revision')
    official_bytes = (args.source / CONSUMER_PATH).read_bytes()
    if official_bytes != subprocess.check_output(['git', '-C', str(args.source), 'show', 'HEAD:' + CONSUMER_PATH]):
        raise ValueError('Consumer probe rejects a modified official consumer')
    sys.path[:0] = [str(Path(__file__).resolve().parents[2]), str(args.source.resolve())]
    from eval.tracetrial.conversation_trace import _project_content
    from eval.tracetrial.trace_adapter import _normalize_single_trace

    args.output.mkdir(parents=True, exist_ok=False)
    native_bytes, result_bytes = args.events.read_bytes(), args.result.read_bytes()
    summary = _normalize_single_trace(
        task=SimpleNamespace(prompt='Offline dual-pipe consumer regression; not an E2 trial'),
        layout=SimpleNamespace(artifacts_dir=args.output, run_dir=args.output),
        native_events_path=args.events, native_result_path=args.result,
        actor_metadata={'model': 'offline-pipe-model', 'cwd': str(args.output)},
        require_process_success=False)
    if not summary['trace_complete']:
        raise ValueError('Fresh offline native lifecycle did not normalize: ' + json.dumps(
            summary['agenthub_normalization_diagnostics']))
    events = json.loads(Path(summary['events_path']).read_text())
    tools = [event for event in events if event['event_type'] == 'tool']
    if len(tools) != 1:
        raise ValueError('Consumer probe requires exactly one actually observed tool result')
    event = tools[0]
    original = copy.deepcopy(event)
    diagnostics = []
    _project_content(event, diagnostics)
    if diagnostics:
        raise ValueError('Fresh result projection conflicts: ' + json.dumps(diagnostics))
    native = event['native_tool_result']
    assert native == original['native_tool_result'] == event['raw_event']['result']
    for field in ('stdout', 'stderr', 'stdoutTruncated', 'stderrTruncated'):
        assert event['tool_result'][field] == native[field]
    assert event['tool_result']['content'] == native['output']
    spec = importlib.util.spec_from_file_location('pinned_e2_provenance_consumer', args.source / CONSUMER_PATH)
    consumer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(consumer)
    provenance = consumer.diagnostic_has_explicit_stderr_provenance(
        event, '02', consumer.EXPECTED_FAILURES['shard-02'], 'ABCDEF12')
    assert provenance == (True, 'typed-stderr')
    assert consumer.result_text(event) == native['output']
    assert consumer.result_text(event).count('verification_code=ABCDEF12') == 1
    assert args.events.read_bytes() == native_bytes and args.result.read_bytes() == result_bytes
    report = {'scope': 'single-run-consumer-regression', 'modelRequests': 0, 'networkRequests': 0,
        'benchmarkScored': False, 'officialSourceRevision': revision,
        'officialConsumerSha256': hashlib.sha256(official_bytes).hexdigest(),
        'nativeEventsSha256': hashlib.sha256(native_bytes).hexdigest(),
        'nativeResultSha256': hashlib.sha256(result_bytes).hexdigest(),
        'projectedToolResultSha256': hashlib.sha256(json.dumps(event['tool_result'], sort_keys=True,
            separators=(',', ':'), ensure_ascii=False).encode()).hexdigest(),
        'nativeUnchanged': True, 'provenance': provenance, 'aliasEqualsNativeOutput': True}
    (args.output / 'consumer-check.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
