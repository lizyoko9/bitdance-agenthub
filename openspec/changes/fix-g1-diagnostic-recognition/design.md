## Context

The pinned G1 verifier reports `deletes=[]` for a retained Bash/Python deletion that actually exposes six per-target outcomes and typed success metadata. Its shell inspection matcher also omits native `fs_list`. The user authorized repairing this recognition and trying the retained case; no new Actor or paid request is needed.

## Goals / Non-Goals

**Goals:** Recognize supported executable operations from existing evidence, run the same seventeen deterministic criteria in an isolated diagnostic, and explain report conformance failures with unchanged report text.

**Non-Goals:** Official leaderboard scores, changing production tools/prompts, modifying the pinned benchmark checkout, fabricating execution metadata, editing measured reports, relaxing report rules, or a general Python interpreter.

## Decisions

1. Add project-local recognition hooks rather than patching the official checkout. Load a byte-identical copied verifier module without invoking its main/self-test. Hook deletion/target recognition, output extraction for newly recognized Python deletes, and pre/post inspection evidence selection. Keep typed-result checks, report checks, rule IDs, weights and official layered aggregation unchanged. For the new Python path, bind actual removal arguments rather than all path mentions and read per-target feedback only from the native output field, never from echoed command source. Require exact native/result/post-tool correlation; leave missing provider_executed unknown and reject explicit false or conflicting evidence.
2. Use static Python AST analysis for exact single `python[3] -c` commands. Support documented literal-target removal forms including the observed finite literal-string `.split()` list and loop over `os.remove`. Do not execute/eval scripts. Reject unknown bindings, shadowed deletion functions, dormant definitions, conditional or ambiguous deletes, and string/comment lookalikes. Recognition does not manufacture `provider_executed`, exit code or per-target result fields.
3. Accept structured complete native `fs_list` observations only after validating tool identity, matching request/result directory, successful non-error result, unique simple entry names and complete listing contract. Construct evidence decisions directly from recorded entries and sequence; do not inject absent/success text into the canonical trace. Precheck requires all six targets visibly present after manifest read and before actual deletion. Postcheck requires all six absent and every protected path present in independent later complete listings. The current tool omits dotfiles; only non-hidden direct children of the exact listed parent are supported. Do not infer regular-file type from isDirectory=false. Failed, partial, truncated, inconsistent or unsupported observations never prove those conditions. Directory-absence reasoning is an explicit diagnostic evidence adaptation, separately compared with deletion-only mode.
4. Run three separately labeled modes against identical copied inputs: unmodified baseline, Python deletion recognition only, and deletion plus native inspection recognition. Replayed baseline must match retained official rule results and total before reporting diagnostic comparisons. Every diagnostic score is nonofficial, with original score alongside it and per-rule evidence/deltas.
5. Use a fresh output root and copy only necessary retained workspace, private verifier inputs, trace and execution-probe files. Refuse output reuse/overlap and symlink inputs. Capture input/source/helper hashes before and after. Invoke official `evaluate` and `run_layered_judge` with the unchanged score sheets; verify zero rubrics and prohibit requester transport. Do not use the production official-score wrapper, which labels its results authoritative.
6. Keep report wording unchanged. Explain the basis-keyword requirement, per-target Command Result text and critical-category confirmation with source-backed examples. Any illustrative improved wording remains outside the measured report and is not rescored as an Actor result.

## Risks / Trade-offs

- Static recognition can accept a lookalike or miss valid syntax → small documented accepted subset, AST binding checks and positive/negative regressions; unsupported syntax remains unrecognized.
- Directory absence is ambiguous for partial listings → use only the current native complete listing shape and reject partial/error metadata and malformed entries.
- Diagnostic numbers can be mistaken for official scores → separate entry point/output/schema, explicit labels and immutable original scores/criteria.
- Reading a copied verifier executes its trusted module-level code → verify its exact pinned hash first, disable bytecode writes and never execute command strings or verifier self-tests.

## Migration Plan

Implement project-local helpers and offline regressions, run the retained G1 replay once in each declared mode, record provenance and failed-rule explanations, then merge locally. The existing official runner remains unchanged; deleting diagnostic outputs is not required for rollback.

## Open Questions

None blocking. Syntax beyond the supported static subset remains a documented coverage limit.
