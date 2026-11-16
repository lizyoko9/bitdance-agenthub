import hashlib
import json
from pathlib import Path
from typing import Any

import tracetrial_bench.evidence_finder as finder_module
import tracetrial_bench.llm_judge as official_judge
from tracetrial_bench.evidence_finder import EvidenceFinder
from tracetrial_bench.score_config import load_score_sheet

from . import judge as requester_module
from .judge import BoundedJudgeRequester, JudgeRequestError, serialize_judge_body


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _reference(path: Path) -> dict[str, Any]:
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise JudgeRequestError('Judge plan source must be a regular retained file')
    data = path.read_bytes()
    return {'path': str(path.resolve()), 'sha256': _sha(data), 'bytes': len(data)}


class PlannedJudgeRequester:
    def __init__(self, *, task: Any, layout: Any, trace_summary: dict[str, Any],
                 requester: BoundedJudgeRequester, plan_path: Path):
        self.task, self.layout, self.trace_summary = task, layout, trace_summary
        self.requester, self.plan_path = requester, Path(plan_path)
        self.prompts: list[str] = []
        self.bodies: list[bytes] = []
        self.current = 0
        self.counts: list[int] = []
        self.failed = False
        self.plan: dict[str, Any] = {
            'schemaVersion': 'agenthub_judge_input_plan_v1', 'taskId': task.task_id,
            'status': 'awaiting_first_official_prompt', 'rubrics': [], 'sources': [],
            'limits': {'maxRequests': requester.max_requests, 'maxRequestBytes': requester.max_request_bytes,
                       'maxTotalRequestBytes': requester.max_total_request_bytes},
            'authorizedLogicalCalls': [],
        }
        self._persist()

    def _persist(self) -> None:
        self.plan_path.write_text(json.dumps(self.plan, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    def _reject(self, reason: str, *, budget: bool = False) -> None:
        self.failed = True
        self.plan.update(status='rejected', rejectionReason=reason)
        self._persist()
        if budget:
            self.requester._reject('judge input plan: ' + reason)
        raise JudgeRequestError('Judge input plan: ' + reason)

    def _prepare(self) -> None:
        sheets = [load_score_sheet(self.task.scoring.harness_score_path, expected_layer='harness'),
                  load_score_sheet(self.task.scoring.agent_score_path, expected_layer='agent')]
        harness, agent = sheets
        if len(harness.rubric_items) != 2 or agent.rubric_items:
            self._reject('unsupported selected-case rubric shape')
        rules_path = Path(self.layout.artifacts_dir) / 'verifier_output/score.json'
        rules = official_judge._load_rule_payload(rules_path)
        agent_score = official_judge._finalize_layer(agent, official_judge._score_rules(agent, rules))
        finder = EvidenceFinder(run_dir=self.layout.run_dir, workspace_dir=self.layout.workspace_dir,
                                baseline_dir=self.layout.baseline_dir, trace_summary=self.trace_summary)
        for item in harness.rubric_items:
            evidence = finder.find(item.evidence, focus='trajectory').to_dict()
            prompt = official_judge._judge_prompt(task_prompt=self.task.prompt, layer='harness', item=item,
                evidence=evidence, evidence_focus='trajectory', agent_score=agent_score)
            body = serialize_judge_body(prompt).encode('utf-8')
            self.prompts.append(prompt)
            self.bodies.append(body)
            self.plan['rubrics'].append({'id': item.id, 'layer': 'harness', 'maxCalls': 2,
                'promptSha256': _sha(prompt.encode('utf-8')), 'promptBytes': len(prompt.encode('utf-8')),
                'bodySha256': _sha(body), 'bodyBytes': len(body),
                'evidenceSha256': _sha(json.dumps(evidence, ensure_ascii=False, sort_keys=True,
                    separators=(',', ':')).encode('utf-8'))})
        paths = [self.task.task_dir / 'task.yaml', self.task.task_dir / 'prompt.md',
                 self.task.scoring.harness_score_path, self.task.scoring.agent_score_path,
                 rules_path, Path(official_judge.__file__), Path(finder_module.__file__),
                 Path(__file__), Path(requester_module.__file__)]
        for key in ('events_path', 'summary_path', 'execution_probe_evidence'):
            if self.trace_summary.get(key):
                paths.append(Path(self.trace_summary[key]))
        native = self.trace_summary.get('agenthub_native_sources', {})
        for key in ('events', 'result'):
            if native.get(key):
                paths.append(Path(native[key]))
        for directory in (self.layout.workspace_dir, self.layout.baseline_dir):
            paths.extend(path for path in Path(directory).rglob('*') if path.is_file() or path.is_symlink())
        self.plan['sources'] = [_reference(path) for path in sorted(set(paths))]
        sizes = [len(body) for body in self.bodies]
        self.plan.update(peakBodyBytes=max(sizes), normalTotalBytes=sum(sizes),
                         worstCorrectionTotalBytes=2 * sum(sizes), worstLogicalCalls=2 * len(sizes))
        self.counts = [0] * len(sizes)
        self._persist()
        if len(set(self.prompts)) != len(self.prompts):
            self._reject('ambiguous duplicate planned prompts')
        if max(sizes) > self.requester.max_request_bytes:
            self._reject('planned single request bytes exceed guard', budget=True)
        if 2 * sum(sizes) > self.requester.max_total_request_bytes:
            self._reject('planned correction total bytes exceed guard', budget=True)
        if 2 * len(sizes) > self.requester.max_requests:
            self._reject('planned correction request count exceeds guard', budget=True)
        self.plan['status'] = 'ready'
        self._persist()

    def __call__(self, runtime: Any, prompt: str) -> str:
        if self.failed:
            self._reject('plan already rejected')
        if not self.prompts:
            try:
                self._prepare()
            except Exception as error:
                if self.failed:
                    raise
                self.plan['preparationErrorType'] = type(error).__name__
                self._reject('retained evidence planning failed')
        matches = [index for index, planned in enumerate(self.prompts) if prompt == planned]
        if len(matches) != 1:
            self._reject('actual prompt is not a planned rubric')
        index = matches[0]
        if index != self.current:
            if index == self.current + 1 and self.counts[self.current]:
                self.current = index
            else:
                self._reject('actual prompt order differs from plan')
        body = serialize_judge_body(prompt).encode('utf-8')
        if body != self.bodies[index] or _sha(body) != self.plan['rubrics'][index]['bodySha256']:
            self._reject('actual serialized body differs from plan')
        if self.counts[index] >= 2:
            self._reject('rubric requested more than one correction')
        for reference in self.plan['sources']:
            try:
                unchanged = _reference(Path(reference['path'])) == reference
            except (OSError, JudgeRequestError):
                unchanged = False
            if not unchanged:
                self._reject('retained plan source changed')
        self.counts[index] += 1
        self.plan['authorizedLogicalCalls'].append({'rubricId': self.plan['rubrics'][index]['id'],
            'callForRubric': self.counts[index], 'promptSha256': _sha(prompt.encode('utf-8')),
            'bodySha256': _sha(body), 'bodyBytes': len(body)})
        self._persist()
        return self.requester(runtime, prompt)

    def finish(self, completed: bool) -> None:
        self.plan['scoringComplete'] = completed
        self.plan['status'] = 'completed' if completed else ('rejected' if self.failed else 'incomplete')
        self._persist()
