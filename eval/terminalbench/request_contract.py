TASK_ID = "bun-sourcemap-leak"


def validate_trial_limits(max_turns=32, max_requests=8, max_total_request_bytes=256 * 1024,
                          max_request_bytes=64 * 1024, max_completion_tokens=2048) -> dict:
    selected = {"maxTurns": (max_turns, 10000), "maxRequests": (max_requests, 1000),
                "maxTotalRequestBytes": (max_total_request_bytes, 64 * 1024 * 1024),
                "maxRequestBytes": (max_request_bytes, 256 * 1024),
                "maxCompletionTokens": (max_completion_tokens, 8192)}
    limits = {}
    for name, (value, maximum) in selected.items():
        if isinstance(value, str) and value.isascii() and value.isdecimal():
            value = int(value)
        if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= maximum:
            raise ValueError(f"{name} must be an integer between 1 and {maximum}")
        limits[name] = value
    return limits


def build_trial_request(instruction: str, cwd: str, group: str, model_id: str,
                        timeout_sec: int, output_dir: str, max_turns=32,
                        max_requests=8, max_total_request_bytes=256 * 1024,
                        max_request_bytes=64 * 1024, max_completion_tokens=2048) -> dict:
    limits = validate_trial_limits(max_turns, max_requests, max_total_request_bytes,
                                  max_request_bytes, max_completion_tokens)
    return {
        "taskId": TASK_ID,
        "instruction": instruction,
        "cwd": cwd,
        "group": group,
        "modelId": model_id,
        "timeoutMs": timeout_sec * 1000,
        "outputDir": output_dir,
        "maxTurns": limits["maxTurns"],
        "requestLimits": {"maxRequests": limits["maxRequests"],
                          "maxTotalRequestBytes": limits["maxTotalRequestBytes"],
                          "maxRequestBytes": limits["maxRequestBytes"],
                          "maxCompletionTokens": limits["maxCompletionTokens"]},
    }
