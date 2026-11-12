"""Score one retained AgentHub trial using the pinned, unmodified official scorer."""
from __future__ import annotations

import json
import os
import threading
from contextlib import contextmanager
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Callable, Iterator

from tracetrial_bench.llm_judge import JudgeRuntime
from tracetrial_bench.scoring import score_layout

from .judge import BoundedJudgeRequester, JUDGE_MODEL, _api_url, _minimal_environment


UPSTREAM_COMMIT = "98a381307184fa4212db3466b21b4c92a031940b"
_ENVIRONMENT_LOCK = threading.RLock()


@contextmanager
def _verifier_environment() -> Iterator[None]:
    # The upstream verifier copies os.environ. Keep its host process free of
    # credentials; the judge uses an in-memory key and an explicit proxy instead.
    with _ENVIRONMENT_LOCK:
        original = dict(os.environ)
        minimum = _minimal_environment()
        try:
            os.environ.clear()
            os.environ.update(minimum)
            yield
        finally:
            os.environ.clear()
            os.environ.update(original)


def _safe(value: Any, key: str) -> Any:
    if is_dataclass(value) and not isinstance(value, type):
        value = asdict(value)
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        sensitive = {"apikey", "authorization", "secret", "password", "credential", "accesskey"}
        return {str(name): "[REDACTED]" if str(name).lower().replace("_", "").replace("-", "") in sensitive
                else _safe(item, key) for name, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_safe(item, key) for item in value]
    if isinstance(value, str):
        return value.replace(key, "[REDACTED]") if key else value
    if value is None or isinstance(value, (bool, int, float)):
        return value
    raise TypeError(f"Unsupported scoring summary value: {type(value).__name__}")


def _read_json(path: Path) -> Any:
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def score_retained_trial(
    *, task: Any, layout: Any, trace_summary: dict[str, Any],
    actor_settings: dict[str, Any], judge_key: str,
    judge_base_url: str = "https://api.openai.com/v1",
    judge_proxy: str | None = "http://127.0.0.1:7890",
    verifier_timeout: int = 120,
    invocation_report: dict[str, Any] | None = None,
    transport: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Return a JSON-safe official result, or an explicitly incomplete result.

    ``transport`` is the only test seam. Production leaves it unset: each HTTP
    attempt runs in a killable worker with a wall-clock timeout. No API call or
    compatibility probe is made until the official scorer requests a rubric.
    This function intentionally refuses reuse of a scoring sidecar directory.
    """
    if not isinstance(judge_key, str) or not judge_key:
        raise ValueError("An in-memory judge credential is required")
    if type(verifier_timeout) is not int or not 1 <= verifier_timeout <= 120:
        raise ValueError("Verifier timeout must be between 1 and 120 seconds")
    if task.scoring is None:
        raise ValueError("This integration requires the official layered scoring configuration")
    _api_url(judge_base_url)
    sidecars = Path(layout.artifacts_dir) / "agenthub_scoring"
    sidecars.mkdir(parents=True, exist_ok=False, mode=0o700)
    requester = BoundedJudgeRequester(sidecars / "judge", proxy=judge_proxy, transport=transport)
    runtime = JudgeRuntime(provider="openai", model=JUDGE_MODEL, base_url=judge_base_url,
                           api_key=judge_key, api_mode="chat_completions", timeout=60.0,
                           retry_delays=())
    settings = {
        "upstreamCommit": UPSTREAM_COMMIT, "harness": "agenthub", "actor": actor_settings,
        "judge": {"provider": runtime.provider, "model": runtime.model,
                  "baseUrl": runtime.base_url, "apiMode": runtime.api_mode,
                  "reasoningEffort": "none", "maxCompletionTokens": 4096,
                  "timeoutSeconds": 60.0, "networkRetries": 0, "redirects": "error",
                  "proxy": judge_proxy, "credentialStorage": "memory only"},
        "verifier": {"timeoutSeconds": verifier_timeout, "execution": "host-only",
                     "environment": "minimal allowlist; provider credentials removed"},
    }
    (sidecars / "settings.json").write_text(json.dumps(_safe(settings, judge_key), indent=2) + "\n")
    outcome = None
    error = None
    try:
        with _verifier_environment():
            outcome = score_layout(task=task, layout=layout, trace_summary=trace_summary,
                                   invocation_report=invocation_report, simulator_evidence=None,
                                   harness="agenthub", model=str(actor_settings.get("model", JUDGE_MODEL)),
                                   timeout=verifier_timeout, judge_runtime=runtime,
                                   judge_requester=requester)
    except Exception as exception:
        # Do not serialize arbitrary transport exception text: it can contain
        # request headers, credentials or private provider error bodies.
        error = {"type": type(exception).__name__,
                 "message": "Official scoring did not complete; inspect retained rule and judge artifacts."}
    rule_score = _read_json(Path(layout.artifacts_dir) / "verifier_output" / "score.json")
    combined_score = _read_json(Path(layout.artifacts_dir) / "llm_judge" / "combined_score.json")
    # A rubric interrupted by a budget/HTTP/parse failure has no full score.
    # Only the official scorer returning its complete outcome authorizes one.
    if outcome is None:
        combined_score = None
    harness_items = (combined_score or {}).get("harness_score", {}).get("items", [])
    summary = {
        "schemaVersion": "agenthub_tracetrial_scoring_v1", "taskId": task.task_id,
        "scoringStatus": "completed" if outcome is not None else "incomplete",
        "scope": "one-task custom-adapter smoke; not a leaderboard result",
        "upstreamCommit": UPSTREAM_COMMIT, "rawEvaluation": outcome.raw if outcome else None,
        "effectiveEvaluation": outcome.effective if outcome else None,
        "policy": outcome.policy if outcome else None,
        "policyPath": outcome.policy_path if outcome else None,
        "ruleScore": rule_score, "combinedScore": combined_score,
        "attribution": (combined_score or {}).get("attribution"),
        "unexercisedCriteria": [item for item in harness_items if item.get("original_score") == 2],
        "judge": requester.summary(), "actualSettings": settings,
        "error": error, "artifactsPath": sidecars,
    }
    result = _safe(summary, judge_key)
    (sidecars / "summary.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    return result
