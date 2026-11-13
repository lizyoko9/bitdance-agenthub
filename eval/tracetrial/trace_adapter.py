import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from harness_tracer.summary import build_summary
from harness_tracer.writer import EventWriter
from tracetrial_bench.execution_capabilities import persist_execution_probe_evidence


CAPABILITIES = ("native_exec_v1", "post_tool_v1")


def _write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _timestamp(value: Any) -> str | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            return datetime.fromtimestamp(value / 1000, timezone.utc).isoformat().replace("+00:00", "Z")
        except (ValueError, OverflowError, OSError):
            pass
    return None


def _archive_source(source: Path, destination: Path, diagnostics: list[str]) -> bytes | None:
    if source.is_symlink():
        diagnostics.append(f"Source must not be a symlink: {source.name}")
        return None
    try:
        data = source.read_bytes()
    except OSError:
        diagnostics.append(f"Native source is missing or unreadable: {source.name}")
        return None
    destination.write_bytes(data)
    return data


def _read_events(data: bytes | None, diagnostics: list[str]) -> list[tuple[int, dict]]:
    if data is None:
        return []
    try:
        lines = data.decode("utf-8").splitlines()
    except UnicodeError:
        diagnostics.append("Native events are not valid UTF-8")
        return []
    events = []
    for line, text in enumerate(lines, 1):
        if not text.strip():
            continue
        try:
            event = json.loads(text)
        except json.JSONDecodeError:
            diagnostics.append(f"Invalid native JSON at line {line}")
            continue
        if not isinstance(event, dict) or not isinstance(event.get("type"), str):
            diagnostics.append(f"Invalid native event at line {line}")
            continue
        events.append((line, event))
    return events


def _identifier(event: dict, key: str) -> str | None:
    value = event.get(key)
    return value if isinstance(value, str) and value else None


def normalize_agenthub_trace(*, task, layout, native_events_path: Path,
                            native_result_path: Path, actor_metadata: dict) -> dict:
    trace_dir = layout.artifacts_dir / "trace" / "agenthub"
    trace_dir.mkdir(parents=True, exist_ok=False)
    diagnostics = []
    source_events = trace_dir / "source-events.jsonl"
    source_result = trace_dir / "source-result.json"
    event_data = _archive_source(Path(native_events_path), source_events, diagnostics)
    result_data = _archive_source(Path(native_result_path), source_result, diagnostics)
    native = _read_events(event_data, diagnostics)
    try:
        result = json.loads(result_data.decode("utf-8")) if result_data is not None else {}
        if not isinstance(result, dict):
            raise ValueError("object required")
    except (UnicodeError, json.JSONDecodeError, ValueError):
        result = {}
        diagnostics.append("Native result is not a valid JSON object")

    root_starts = [(line, event) for line, event in native
                   if event["type"] == "run.start" and not event.get("parentRunId")]
    root_id = _identifier(root_starts[0][1], "runId") if root_starts else None
    run_id = root_id or str(actor_metadata.get("run_id") or layout.run_dir.name)
    if len(root_starts) != 1 or root_id is None:
        diagnostics.append("Expected exactly one identified native root run.start")
    start_ms = root_starts[0][1].get("timestamp") if root_starts else None
    root_ends = []
    started_runs = set()
    ended_runs = set()
    run_statuses = {}
    calls = {}
    completed_calls = set()
    messages = {}
    previous_timestamp = None
    prelude = []
    writer = EventWriter(trace_dir / "events.json", run_id=run_id)

    def emit(kind, line, event, **payload):
        source_lines = payload.pop("source_lines", [line])
        writer.write(kind, timestamp=_timestamp(event.get("timestamp")),
                     source="agenthub.native", native_event_type=event["type"],
                     source_refs=[{"path": str(source_events.resolve()), "line": value}
                                  for value in dict.fromkeys(source_lines)],
                     raw_event=event, **payload)

    for line, event in native:
        kind = event["type"]
        timestamp = event.get("timestamp")
        if _timestamp(timestamp) is not None:
            if previous_timestamp is not None and timestamp < previous_timestamp:
                diagnostics.append(f"Native timestamp order regressed at line {line}")
            previous_timestamp = timestamp
        # The persisted user message is an input prelude, before the native actor run.
        if not started_runs and kind == "message.added" and isinstance(event.get("message"), dict) and event["message"].get("role") == "user":
            prelude.append({"path": str(source_events.resolve()), "line": line})
            continue
        if root_ends:
            diagnostics.append(f"Native actor event follows root run.end at line {line}")
        if kind == "run.start":
            identifier = _identifier(event, "runId")
            if identifier is None or identifier in started_runs:
                diagnostics.append(f"Missing or duplicate native run.start ID at line {line}")
            else:
                started_runs.add(identifier)
            emit("run_started" if identifier == root_id else "native_event", line, event,
                 native_run_id=identifier)
        elif kind == "tool.call":
            identifier = _identifier(event, "callId")
            message = messages.get(_identifier(event, "messageId"))
            if message is None or message["closed"]:
                diagnostics.append(f"Native tool call has no open message at line {line}")
            if identifier is None or identifier in calls:
                diagnostics.append(f"Missing or duplicate native tool call ID at line {line}")
            else:
                calls[identifier] = (line, event)
            emit("native_event", line, event)
        elif kind == "tool.result":
            identifier = _identifier(event, "callId")
            message = messages.get(_identifier(event, "messageId"))
            if message is None or message["closed"]:
                diagnostics.append(f"Native tool result has no open message at line {line}")
            if identifier not in calls or identifier in completed_calls:
                diagnostics.append(f"Unmatched or duplicate native tool result at line {line}")
                emit("native_event", line, event)
                continue
            completed_calls.add(identifier)
            call_line, call = calls[identifier]
            if call.get("messageId") != event.get("messageId"):
                diagnostics.append(f"Native tool message correlation differs at line {line}")
            if "result" not in event or event["result"] is None:
                diagnostics.append(f"Native tool result value is absent at line {line}")
            if not isinstance(event.get("isError"), bool):
                diagnostics.append(f"Native tool result lacks a boolean isError at line {line}")
            emit("tool", line, event,
                 tool_call={"tool_call_id": identifier, "tool_name": call.get("toolName"),
                            "arguments": call.get("args")},
                 tool_result=event.get("result"),
                 source_lines=[call_line, line],
                 native_call_source={"path": str(source_events.resolve()), "line": call_line},
                 native_tool_call=call)
        elif kind == "message.start":
            identifier = _identifier(event, "messageId")
            if identifier is None or identifier in messages:
                diagnostics.append(f"Missing or duplicate message.start at line {line}")
            else:
                messages[identifier] = {"parts": {}, "part_states": {}, "lines": [line], "closed": False}
            emit("native_event", line, event)
        elif kind in {"part.start", "part.delta", "part.end"}:
            message = messages.get(_identifier(event, "messageId"))
            if message is None or message["closed"]:
                diagnostics.append(f"Unmatched native message part at line {line}")
            else:
                index = event.get("partIndex")
                valid_index = isinstance(index, int) and not isinstance(index, bool) and index >= 0
                if not valid_index:
                    diagnostics.append(f"Invalid native part index at line {line}")
                else:
                    state = message["part_states"].get(index)
                    if kind == "part.start":
                        part = event.get("part")
                        if state is not None:
                            diagnostics.append(f"Duplicate native part.start at line {line}")
                        elif not isinstance(part, dict) or not isinstance(part.get("type"), str):
                            diagnostics.append(f"Invalid native part.start at line {line}")
                        else:
                            message["part_states"][index] = {
                                "streaming": part["type"] in {"text", "thinking", "code"}, "closed": False}
                    elif state is None:
                        diagnostics.append(f"Native part event has no matching start at line {line}")
                    elif kind == "part.end":
                        if state["closed"]:
                            diagnostics.append(f"Duplicate native part.end at line {line}")
                        state["closed"] = True
                    elif state["closed"] and state["streaming"]:
                        diagnostics.append(f"Native streaming part delta follows its end at line {line}")
                if valid_index and kind == "part.start" and isinstance(event.get("part"), dict) and event["part"].get("type") == "text":
                    content = event["part"].get("content")
                    if index in message["parts"] or not isinstance(content, str):
                        diagnostics.append(f"Invalid or duplicate native text part.start at line {line}")
                    else:
                        message["parts"][index] = content
                elif valid_index and kind == "part.delta" and isinstance(event.get("delta"), dict) and event["delta"].get("type") == "text.append":
                    if index not in message["parts"]:
                        diagnostics.append(f"Text delta without native text part.start at line {line}")
                    text = event["delta"].get("text")
                    if isinstance(text, str):
                        message["parts"][index] = message["parts"].get(index, "") + text
                    else:
                        diagnostics.append(f"Native text delta is not a string at line {line}")
                message["lines"].append(line)
            emit("native_event", line, event)
        elif kind == "message.end":
            message = messages.get(_identifier(event, "messageId"))
            if message is None or message["closed"]:
                diagnostics.append(f"Unmatched or duplicate native message.end at line {line}")
                emit("native_event", line, event)
            else:
                if any(part["streaming"] and not part["closed"] for part in message["part_states"].values()):
                    diagnostics.append(f"Native message closes with an open streaming part at line {line}")
                message["closed"] = True
                content = "".join(text for _, text in sorted(message["parts"].items()))
                if content:
                    emit("assistant_message", line, event, content=content,
                         message_id=event.get("messageId"), content_kind="text",
                         source_lines=[*message["lines"], line],
                         native_part_lines=message["lines"])
                else:
                    emit("native_event", line, event)
        elif kind == "run.end":
            identifier = _identifier(event, "runId")
            if event.get("status") == "complete" and event.get("error"):
                diagnostics.append(f"Native complete run carries an error at line {line}")
            if identifier not in started_runs or identifier in ended_runs:
                diagnostics.append(f"Unmatched or duplicate native run.end at line {line}")
            if identifier is not None:
                ended_runs.add(identifier)
                run_statuses[identifier] = event.get("status")
            if identifier == root_id:
                root_ends.append(event)
                if event.get("status") != "complete":
                    emit("run_failed", line, event, error_type=result.get("terminationReason"),
                         error_message=event.get("error"))
                emit("run_finished", line, event, native_status=event.get("status"))
            else:
                emit("native_event", line, event)
        else:
            emit("native_event", line, event)

    if set(calls) != completed_calls:
        diagnostics.append("Native tool calls remain without a matching result")
    if any(not message["closed"] for message in messages.values()):
        diagnostics.append("Native messages remain open")
    if len(root_ends) != 1 or started_runs != ended_runs:
        diagnostics.append("Native run lifecycle is not closed")
    if result.get("allRunsSettled") is not True:
        diagnostics.append("Native result does not confirm allRunsSettled")
    if result.get("rootRunIds") != [root_id]:
        diagnostics.append("Native result rootRunIds do not match the event root")
    if result.get("runStatus") == "complete" and (
            result.get("terminationReason") != "completed" or result.get("budgetExhausted") is True
            or result.get("error") or result.get("timedOut") is True):
        diagnostics.append("Native result completion contradicts its termination evidence")
    result_runs = result.get("runs")
    if not isinstance(result_runs, list) or any(not isinstance(run, dict) for run in result_runs):
        diagnostics.append("Native result runs is not a list of run objects")
    else:
        result_statuses = {_identifier(run, "runId"): run.get("status") for run in result_runs}
        if len(result_statuses) != len(result_runs) or result_statuses != run_statuses:
            diagnostics.append("Native result run statuses do not match the events")
    if not writer.events or writer.events[0]["event_type"] != "run_started" or writer.events[-1]["event_type"] != "run_finished":
        diagnostics.append("Canonical actor lifecycle lacks native start/end boundaries")
    native_complete = len(root_ends) == 1 and root_ends[0].get("status") == "complete"
    exit_code = actor_metadata.get("exit_code")
    timed_out = actor_metadata.get("timed_out") is True or result.get("timedOut") is True
    finished = (not diagnostics and native_complete and result.get("runStatus") == "complete"
                and type(exit_code) is int and exit_code == 0 and not timed_out
                and result.get("terminationReason") == "completed" and not result.get("error")
                and result.get("budgetExhausted") is not True)
    # A native end alone cannot establish completeness before all evidence is validated.
    for event in writer.events:
        if event["event_type"] == "run_finished":
            event["trace_complete"] = finished
    writer.close()
    end_ms = root_ends[-1].get("timestamp") if root_ends else None
    duration_ms = end_ms - start_ms if _timestamp(end_ms) and _timestamp(start_ms) else None
    summary = build_summary(
        writer=writer, run_id=run_id, run_dir=trace_dir.resolve(), harness="agenthub",
        model=str(actor_metadata.get("model") or result.get("modelId") or "unknown"),
        input_query=task.prompt, status="finished" if finished else "failed",
        trace_complete=finished, structured_trace_status="available" if not diagnostics else "partial",
        exit_code=exit_code, timed_out=timed_out,
        error_type=None if finished else ("normalization_incomplete" if diagnostics else result.get("terminationReason") or "actor_failed"),
        error_message="; ".join(diagnostics) or result.get("error"),
        started_at=actor_metadata.get("started_at") or _timestamp(start_ms),
        finished_at=actor_metadata.get("finished_at") or _timestamp(end_ms),
        duration_ms=duration_ms, session_id=None, cwd=actor_metadata.get("cwd"),
        argv=[], environment={}, summary_path=(trace_dir / "summary.json").resolve(),
    )
    summary["agenthub_native_sources"] = {
        "events": str(source_events.resolve()), "result": str(source_result.resolve()),
        "events_sha256": hashlib.sha256(event_data).hexdigest() if event_data is not None else None,
        "result_sha256": hashlib.sha256(result_data).hexdigest() if result_data is not None else None,
    }
    summary["agenthub_normalization_diagnostics"] = diagnostics
    summary["agenthub_actor_usage"] = result.get("usage")
    summary["agenthub_input_prelude_sources"] = prelude
    summary["agenthub_native_termination_reason"] = result.get("terminationReason")
    _write_json(trace_dir / "summary.json", summary)
    return summary


def emit_execution_evidence(task, layout, summary):
    required = list(task.execution_probe.requires) if task.execution_probe is not None else []
    capability = {
        "schema_version": "harnessbench_execution_capabilities_v1", "harness": "agenthub",
        "probe_version": task.execution_probe.version if task.execution_probe is not None else None,
        "required": required, "available": list(CAPABILITIES),
        "missing": [name for name in required if name not in CAPABILITIES],
        "default_path_unchanged": task.execution_probe is None,
    }
    capability["compatible"] = not capability["missing"]
    directory = layout.artifacts_dir / "execution_probe"
    directory.mkdir(parents=True, exist_ok=True)
    _write_json(directory / "capabilities.json", capability)
    if not capability["compatible"]:
        raise ValueError("AgentHub trace adapter lacks required capabilities: " + ", ".join(capability["missing"]))
    evidence = persist_execution_probe_evidence(task, harness="agenthub", layout=layout,
                                              trace_summary=summary, capability=capability)
    summary["execution_probe_evidence"] = evidence
    _write_json(layout.artifacts_dir / "trace" / "agenthub" / "summary.json", summary)
    return evidence
