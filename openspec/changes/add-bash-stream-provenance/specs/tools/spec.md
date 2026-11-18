## ADDED Requirements

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
