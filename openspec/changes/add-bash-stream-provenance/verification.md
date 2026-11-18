# Native Bash stream provenance verification — 2026-11-18

Implementation commit: `b46911b`. Planning: `9bd37d9`; synchronized contract: `d0b9982`. All checks below cover the implementation subsequently delivered as that commit.

## Result and scope

Native `bash` now returns actual retained `stdout` and `stderr` plus `stdoutTruncated` / `stderrTruncated`. Previously both pipes shared one unlabelled callback, so their text survived but its source did not. Each pipe now uses its own incremental UTF-8 decoder and text accumulator, while preserving the legacy merged `output` and one shared 10,000-UTF-16-unit capture cap.

Process classification remains based on exit/interruption observations: nonempty stderr does not imply failure. Labels describe the pipes after shell redirection. Size flags report observed text omitted by the cap; interrupted or force-closed pipes can still have unobserved data. Tool annotations remain exclusively in `output`. The capture freezes after its first omission, including a Unicode-safe boundary that leaves one unit unused.

The generic result contract needs no database migration. Production changes are limited to native capture and tool-description wording; SDK-owned shells, history policy, request guards, canonical production functions and official scoring code retain their behavior. No old benchmark trace is relabeled, rerun or rescored. The new transport and consumer probes made zero model requests and zero network requests.

## Checks

| Check | Observed result |
|---|---|
| Full `pnpm test` with explicit pinned source/Python | 66 files passed; 604 tests passed, 2 Windows-only tests skipped |
| Focused native Bash suite within the full run | 32 tests passed |
| New actual-service transport integration suite | 2 tests passed, including the pinned pure-consumer check without a skip |
| Existing Python trace adapter / conversation trace / transport projection suites | 40 tests passed |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| `openspec validate add-bash-stream-provenance --strict` | Passed |
| `git diff --check` | Passed |
| Independent capture and consumer review | No blocking findings; static review kept distinct from executed tests |

The two skipped tests cover Windows case-insensitive paths and Windows system/UNC path rejection, not the added pipe regressions. Native real-process tests were executed on macOS; Windows execution was not tested.

Meaningful capture checks cover real dual-pipe zero/nonzero exits and redirection, empty observations, interleaving, independent split UTF-8 characters, exact/exceeded shared allowance, late omissions, intact surrogate pairs, timeout/abort/orphan partial text, end/close/error overlap and unchanged single settlement/evidence. Received stderr is retained even for a successful process. Decoder cleanup does not wait indefinitely for end after destruction.

## Actual production transport without a model

The integration test uses ConversationService → AgentRunner → Custom adapter → registry/tool execution → actual safe Bash `printf`, with exactly two local fake SDK responses per run. It checks equality of the resulting stream fields in:

- the next actual serialized Custom request body;
- SQLite message parts read through the existing persistence path;
- SSE Route Handler serialization, invoked directly without a network server;
- the existing store reducer result;
- detail-compatible JSON serialization. Interactive browser rendering was not tested.

For one safe Unicode/diagnostic sample, retained raw text was 183 UTF-16 units. Its current next-request body was 5,875 bytes; the same body with only the four new result fields removed was 5,596 bytes, a 279-byte field delta. This comparison retains the current tool description and is not a complete pre-change request baseline. No request guard was increased.

The local detailed receipt is `.agenthub-data/bash-stream-consumer-receipt-20261118-final.json` in the implementation worktree. The complete Vitest JSON report is `.agenthub-data/bash-stream-vitest-20261118.json` there. Temporary test databases and command workspaces were cleaned up.

## Existing canonical / official-consumer compatibility

A fresh one-tool native observation passed through the unchanged `_normalize_single_trace` and `_project_content` functions. The named fields matched `native_tool_result` and the original raw result, and `content` remained exactly `output` without a duplicate diagnostic. The native input bytes were unchanged.

The test-only bridge verifies the official checkout revision and checks the consumer file against its pinned Git blob before invoking only `diagnostic_has_explicit_stderr_provenance` and `result_text`. It observed `(true, "typed-stderr")`; no official score function, official fixture or ten-turn benchmark run was executed.

- Official revision: `98a381307184fa4212db3466b21b4c92a031940b`
- Official consumer SHA-256: `bd7c0e6b0e71f6bf1998c2f2f8daa191d42bdd8c7a34b868025a493c49dc27c7`
- Consumer scope: `single-run-consumer-regression`; `benchmarkScored=false`

This verifies that newly captured provenance is usable by the existing consumer. It does not establish a new E2 score or resolve previously observed early/repeated model execution and report-content errors.

## Reproduction and environment

Run from the repository with the existing local pinned source and Python environment:

```sh
AGENTHUB_TRACETRIAL_TEST_SOURCE=/Users/lizg/Documents/Projects/bytedance-agenthub/.agenthub-data/benchmarks/tracetrial-source-98a3813 AGENTHUB_TRACETRIAL_TEST_PYTHON=/private/tmp/agenthub-tracetrial-venv/bin/python pnpm test
AGENTHUB_TRACETRIAL_TEST_SOURCE=/Users/lizg/Documents/Projects/bytedance-agenthub/.agenthub-data/benchmarks/tracetrial-source-98a3813 /private/tmp/agenthub-tracetrial-venv/bin/python -B -m unittest eval.tracetrial.test_trace_adapter eval.tracetrial.test_conversation_trace eval.tracetrial.test_transport_projection
pnpm typecheck
pnpm lint
openspec validate add-bash-stream-provenance --strict
```

The worktree initially lacked its ignored mobile `node_modules` link, and the existing temporary Python environment lacked `pyvenv.cfg` plus its pinned-source import path. Typecheck and one existing cross-language test initially failed for those environment reasons. The existing mobile dependencies were linked; `uv venv --allow-existing --offline --no-python-downloads --no-cache --no-project` restored the Python environment without clearing it, and a `.pth` file inside that isolated environment links the already pinned local source. No application or Python dependency was added, no global Python package was modified, and no source or scoring rule was changed to bypass a failing test. The completed checks above passed after restoration.
