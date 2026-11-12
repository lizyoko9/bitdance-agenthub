TASK_ID = "bun-sourcemap-leak"


def build_trial_request(instruction: str, cwd: str, group: str, model_id: str,
                        timeout_sec: int, output_dir: str) -> dict:
    return {
        "taskId": TASK_ID,
        "instruction": instruction,
        "cwd": cwd,
        "group": group,
        "modelId": model_id,
        "timeoutMs": timeout_sec * 1000,
        "outputDir": output_dir,
    }
