# Tools

## Purpose

Defines AgentHub-managed tools, approval boundaries, and adapter-specific tool ownership. Detailed tool specs live in `specs/07-tools.md`.

## Requirements

### Requirement: Tool definitions SHALL be registered centrally

AgentHub-managed tools MUST be registered through `toolRegistry` with name, description, JSON schema, and handler.

#### Scenario: Custom agent enables a tool
- **WHEN** an agent's `toolNames` includes `fs_read`
- **THEN** CustomAgentAdapter resolves the tool definition from `toolRegistry`.

### Requirement: Attachments SHALL be read through safe tool extraction

`read_attachment` MUST read user-uploaded attachments scoped to the current conversation. Text-like files and PDFs with extractable text SHALL return plain text with bounded length; unsupported binary formats SHALL return metadata instead of raw bytes.

#### Scenario: Agent reads a PDF attachment
- **WHEN** `read_attachment` receives an attachment whose MIME type, filename, or file header identifies it as a PDF
- **THEN** AgentHub extracts local PDF text before returning the tool result
- **AND** truncates the returned text at the same bounded length used for text files
- **AND** returns a clear note when the PDF has no extractable text and likely needs OCR.

### Requirement: File tools SHALL enforce workspace boundaries

`fs_read`, `fs_write`, and `bash` MUST resolve paths under the conversation effective cwd and reject access outside that tree.

#### Scenario: Agent attempts path traversal
- **WHEN** a tool receives `../../.ssh/id_rsa`
- **THEN** the path check rejects the operation.

### Requirement: Bash SHALL enforce platform blacklist

The bash tool MUST reject commands that match the platform-specific banned pattern list before execution.

#### Scenario: POSIX destructive command is requested
- **WHEN** the command matches `rm -rf /`
- **THEN** the tool refuses to run it.

#### Scenario: POSIX background process inherits stdio
- **WHEN** a bash command starts a background process and the shell script exits
- **THEN** the bash tool MUST NOT wait forever on inherited stdout or stderr
- **AND** it SHOULD clean up the command process group before returning.

### Requirement: Key bash commands SHALL require user approval

AgentHub MUST require explicit user approval before executing bash commands that are not banned but can materially change dependencies, discard files, or affect host-level runtime state. This approval gate MUST apply to AgentHub's `bash` tool and SDK command hooks where the adapter exposes a pre-execution permission callback.

#### Scenario: Agent installs dependencies
- **WHEN** an agent requests `pnpm install`
- **THEN** AgentHub records a pending bash command
- **AND** emits it through the conversation event stream
- **AND** executes the command only after user approval.

### Requirement: Review mode SHALL require write approval

In review mode, file write effects managed by AgentHub MUST create pending approvals instead of directly mutating workspace files.

#### Scenario: Agent proposes a file write
- **WHEN** `fs_write` is called in review mode
- **THEN** AgentHub records a pending write
- **AND** waits for explicit user approval.

### Requirement: SDK tool sets SHALL be documented separately

Claude Code and Codex SDK adapters MUST document their built-in tool ownership and any approval bridge limitations instead of pretending those tools are AgentHub `toolRegistry` tools.

#### Scenario: Codex agent runs in review mode
- **WHEN** a Codex agent is selected
- **THEN** Codex uses read-only sandbox mode
- **AND** AgentHub exposes only the allowlisted AgentHub MCP tools to Codex.

### Requirement: AgentHub SHALL inject tool-call guidance for available tools

AgentHub MUST append usage guidance and concrete examples for the AgentHub-managed tools available to the current run. Guidance MUST be scoped to the actual tool set, and MUST call out common argument-shape mistakes for tools whose schemas are often confused.

#### Scenario: Custom agent has file and artifact tools
- **WHEN** a custom agent run is built with `fs_read`, `fs_write`, `read_artifact`, and `write_artifact`
- **THEN** the injected system prompt includes examples for those tools
- **AND** it does not instruct the agent to call unavailable tools such as `plan_tasks`.

#### Scenario: Agent can write artifacts
- **WHEN** a run includes `write_artifact`
- **THEN** the injected guidance warns against empty `write_artifact({})` calls
- **AND** includes a complete document artifact template with `type`, `title`, and `content`.

#### Scenario: SDK adapter receives AgentHub MCP tools
- **WHEN** a Claude Code or Codex run is built
- **THEN** the injected guidance includes the allowlisted AgentHub MCP tools exposed by that adapter
- **AND** examples use the exact camelCase argument names accepted by the tool schemas.

#### Scenario: Local workspace code task has file tools
- **WHEN** a run is built for a local workspace
- **AND** the agent has AgentHub file tools or SDK local file tools
- **THEN** the injected guidance tells the agent to prefer direct workspace file/command tools for project source work
- **AND** tells the agent not to use `write_artifact` for source files that should be written to disk.

### Requirement: Agents SHALL be able to ask structured user questions

AgentHub MUST provide an `ask_user` tool for finite user choices. The tool SHALL accept 1-4 questions, each with 2-4 options, and SHALL suspend the run until the user answers or the run is aborted.

#### Scenario: Agent needs a blocking finite choice
- **WHEN** an available agent tool call submits `ask_user` with valid questions
- **THEN** AgentHub records a pending user question
- **AND** emits the pending question through the conversation event stream
- **AND** returns the selected answers to the agent after the user responds.

#### Scenario: Orchestrator plan has a key ambiguity
- **WHEN** the Orchestrator plan stage needs a blocking clarification expressible as 2-4 options
- **THEN** the plan stage may call `ask_user` before `plan_tasks`
- **AND** the aggregate stage does not expose `ask_user`.

### Requirement: Web app artifacts SHALL be deployable to preview URLs

AgentHub MUST provide a `deploy_artifact` tool that accepts a web app artifact id and returns a deployment status record with a preview path. The tool MUST create a local static deployment and SHOULD additionally publish it to a configured external static directory.

#### Scenario: Agent deploys a web app artifact
- **WHEN** `deploy_artifact` receives a valid `web_app` artifact id
- **THEN** it returns a ready deployment record
- **AND** the record points at the local deployment preview route when no external publish target is configured.

#### Scenario: Agent deploys with external static publishing configured
- **WHEN** `deployment_publish_enabled` is true
- **AND** `deployment_publish_dir` and `deployment_public_base_url` are set
- **THEN** the tool publishes public deployment files to the configured directory
- **AND** returns the public URL as the primary preview path
- **AND** includes a local preview fallback.

#### Scenario: Agent deploys a non-web artifact
- **WHEN** `deploy_artifact` receives a document, image, or missing artifact id
- **THEN** it returns a failed deployment record with a user-visible reason.

### Requirement: Workspace static directories SHALL be deployable to preview URLs

AgentHub MUST provide a `deploy_workspace` tool that accepts a static output directory inside the current workspace and returns a deployment status record. The tool MUST copy existing static files only; it MUST NOT run build commands. Workspace deployments MUST enforce workspace path isolation, reject missing or non-directory sources, require an HTML entry file, and exclude private or dependency directories such as `.agenthub`, `.git`, and `node_modules`.

#### Scenario: Agent deploys a built local project
- **WHEN** `deploy_workspace` receives `path="dist"` and `dist/index.html` exists inside the conversation workspace
- **THEN** it creates a ready deployment record
- **AND** the record has `sourceType="workspace"` and `workspacePath="dist"`.

#### Scenario: Slash deploy has no artifact candidates
- **WHEN** a user sends `/deploy`
- **AND** the conversation has no `web_app` artifact candidates
- **AND** a common static output directory such as `dist`, `build`, `out`, or `client/dist` exists with `index.html`
- **THEN** AgentHub deploys that workspace directory and inserts a `deploy_status` message part.

### Requirement: Child tasks SHALL report semantic task outcomes

AgentHub MUST provide a `report_task_result` tool for Orchestrator-dispatched child runs. The tool SHALL accept `status`, `summary`, optional `acceptanceResults`, and optional `blockers`, and SHALL not create artifacts or mutate workspace files.

#### Scenario: Child reports completion
- **WHEN** a child run calls `report_task_result` with `status="complete"`
- **THEN** AgentRunner can use that structured report as the semantic task outcome.

#### Scenario: Child reports blocked work
- **WHEN** a child run calls `report_task_result` with `status="blocked"`
- **THEN** the dispatch task is treated as not complete
- **AND** blocker details remain available to aggregation.


### Requirement: Tool results SHALL preserve obtained execution failures

The successful-result branch of ToolResult SHALL accept optional boolean isError metadata while retaining value. ok=true SHALL mean a tool result was obtained; isError=true SHALL mark a failed underlying action. Omitting isError MUST retain existing behavior. Tool failure without an obtained result SHALL retain ok=false and an error string.

#### Scenario: A command returns a nonzero exit
- **WHEN** Bash obtains a result with a nonzero exit code
- **THEN** it retains the complete bounded output and numeric exit code
- **AND** the successful-result wrapper carries isError=true.

### Requirement: Bash SHALL classify process outcomes consistently

Bash MUST compute failure from a nonzero or unknown exit code, a terminating signal, timeout or cancellation. The same classification MUST reach wrapper metadata, model-visible isError and failed/completed status, and command evidence. Existing result fields MUST remain available, with aborted and signal observations added. Failed obtained results MUST additionally contain failure with a stable kind and an observed-fact message; successful results MUST omit failure. Kinds SHALL be timeout, aborted, signal, nonzero_exit and unknown_exit in that precedence. The same message MUST be used for command evidence and supervisor diagnostics, with historical-result fallbacks retained. Exit codes MUST remain numeric or null, and output MUST not be rewritten to carry the explanation. A failed command MUST remain available for subsequent model reasoning. Cancellation known before execution MUST prevent spawning; each command MUST record and settle at most once.

#### Scenario: Success-shaped text accompanies a failed process
- **WHEN** a process emits success text and exits with code 23
- **THEN** text and exit code remain unchanged
- **AND** payload status is failed, payload and wrapper isError are true, and recorded command evidence isError is true.

#### Scenario: Cancellation ends with zero
- **WHEN** a cancelled or timed-out process eventually closes with exit code zero
- **THEN** the execution remains classified as failed.

#### Scenario: Successful command completes
- **WHEN** a process exits with code zero without interruption or a signal
- **THEN** status is completed and execution error metadata is false.

#### Scenario: Child error and close both fire
- **WHEN** process lifecycle callbacks overlap after an execution error
- **THEN** only the first settled outcome is recorded and returned.


#### Scenario: Different commands return nonzero codes
- **WHEN** a command returns any nonzero integer exit code without interruption
- **THEN** failure.kind is nonzero_exit and its message states the observed code
- **AND** no program-specific cause is inferred from that number.

#### Scenario: Multiple interruption observations coexist
- **WHEN** timeout, cancellation and signal metadata overlap
- **THEN** a single failure object follows the declared precedence and all original observations remain available.

#### Scenario: No exit status was observed
- **WHEN** exitCode is null without an observed timeout, cancellation or signal
- **THEN** failure.kind is unknown_exit and the message states that successful completion could not be confirmed.

### Requirement: Native Bash SHALL preserve observed stdout and stderr provenance

Obtained results from AgentHub's native Bash implementation MUST include string `stdout` and `stderr` fields captured from their respective child pipes, plus boolean `stdoutTruncated` and `stderrTruncated` fields. Existing `output`, global `truncated`, process/lifecycle fields, error classification and wrapper branches MUST retain their meanings. Pipe labels MUST describe observations after shell redirection, without inferred or retrospective provenance. Stderr content alone MUST NOT classify a process as failed. SDK-owned shell tools are outside this native contract.

#### Scenario: Both pipes emit during a successful command
- **WHEN** a process writes text to stdout and stderr and exits zero without interruption
- **THEN** each named field contains only text retained from its respective pipe
- **AND** output remains the merged compatibility view and the command remains completed.

#### Scenario: The shell redirects a diagnostic
- **WHEN** shell redirection routes diagnostic text through the stdout pipe
- **THEN** the retained text belongs to stdout, even if its wording resembles an error
- **AND** the tool does not invent an original stderr source.

#### Scenario: No child output was observed
- **WHEN** an obtained result has empty streams, including cancellation before spawning
- **THEN** both named strings are empty and neither stream is marked truncated without observed size omissions
- **AND** existing exit and interruption facts distinguish successful completion from cancellation or unknown status.

### Requirement: Native Bash SHALL apply one shared bounded capture across both pipes

The raw merged capture and its stdout/stderr partition MUST share the existing 10,000-UTF-16-code-unit limit. After the first observed omission, no later text SHALL enter any retained buffer. Capture MUST avoid cutting a surrogate pair. Each stream truncation flag MUST identify observed decoded text omitted from that pipe because of this size cap. The global truncated flag MUST retain its capture-cap meaning. Synthetic tool annotations MUST appear only in output, never in stdout or stderr; the flags MUST NOT promise recovery of unobserved data after interrupted or forced cleanup.

#### Scenario: Output exactly fills the capture allowance
- **WHEN** decoded output reaches the shared allowance without any additional text
- **THEN** all raw text is retained and the size-truncation flags remain false.

#### Scenario: A pipe emits after the shared allowance is exhausted
- **WHEN** stdout fills the allowance and stderr subsequently emits additional text
- **THEN** stderr text is omitted, stderrTruncated and global truncated are true
- **AND** stdoutTruncated is true only if stdout also has observed omitted text.

#### Scenario: A supplementary character straddles the cap
- **WHEN** the next Unicode character requires two UTF-16 units but only one unit remains
- **THEN** that character is omitted intact and capture freezes with the unused unit
- **AND** later callbacks do not fill the gap or break the retained merged prefix.

#### Scenario: Execution is interrupted with partial output
- **WHEN** a timeout, abort or inherited-stdio cleanup finalizes partial captured streams
- **THEN** retained named text remains attributable to its pipe and existing lifecycle facts remain available
- **AND** interruption/cleanup notes are present only in output and do not alone set size-truncation flags.

### Requirement: Native Bash SHALL decode pipe text incrementally and settle once

Native Bash MUST decode UTF-8 independently for each pipe across Buffer chunks and finalize each decoder at most once. A pipe end event and result-finalization fallback MUST NOT duplicate text. Finalization MUST NOT depend on receiving end after forced destruction. Existing single result, single command-evidence, spawn-failure, timeout, abort and orphan-cleanup guarantees MUST be preserved. Merged output order SHALL represent decoded callback observations rather than claim a total ordering of writes across pipes.

#### Scenario: UTF-8 bytes cross chunk boundaries
- **WHEN** Chinese or supplementary-character bytes are split across chunks on either pipe
- **THEN** each pipe reconstructs its own text without mixing decoder state or introducing chunk-boundary corruption.

#### Scenario: Stream and process finalization callbacks overlap
- **WHEN** end, close, error or interruption callbacks overlap or late data arrives after settlement
- **THEN** decoders finalize at most once, the command records and resolves at most once, and returned text is not duplicated or mutated later.

### Requirement: Native Bash provenance SHALL survive existing result transport

New obtained Bash fields MUST remain available in the Custom model-visible tool-result JSON, AgentRunner message-result persistence and streaming/detail result payloads through the existing generic JSON contract. Existing output-only previews and diagnostic consumers MUST remain usable. Historical results without named fields MUST remain readable. Canonical trace projection MUST preserve fresh named observations without changing the existing content alias, official scoring rules or retained evidence.

#### Scenario: A native result reaches its consumers
- **WHEN** a fresh native Bash result is sent through tool execution and generic result transport
- **THEN** its named streams and truncation flags remain equal to the captured values in the next Custom request, persisted/streamed result and detail JSON
- **AND** existing output consumers still receive their compatibility value.

#### Scenario: A fresh result enters canonical evaluation projection
- **WHEN** a fresh result containing actual stderr provenance passes through the existing canonical adapter
- **THEN** its named fields remain attributable to that new observation and content retains its existing output alias
- **AND** no historical trace is relabeled or benchmark score is implied by this transport check.
