# Agent Memory Learning Report

The Agent memory learning report is the data source for one employee Agent's internal brain. 用户看到的是“员工大脑”，不是一个独立的 memory product surface. The report is side-effect free: it does not write memories, approve learning events, or change Playbooks.

## API

```http
GET /api/agent-profiles/:id/memory-learning-report?q=optional-goal
```

The optional `q` query is used as a sample retrieval goal. Without `q`, the service builds a default goal from the Agent role and output contract.

## What It Shows

The report includes:

- memory policy
- owned memory count and active/expired split
- counts by memory type and scope
- average confidence and importance
- high-importance memories
- sensitive and encrypted memory counts
- mistake/procedural/semantic memory counts
- expiring-soon memories
- sample retrieval candidates with scores and matched terms
- reflection coverage
- pending/approved/rejected learning events
- active/draft/archived Playbooks
- Playbook version count
- human-review needs
- recommendations

## Readiness

```ts
type AgentMemoryLearningReadiness =
  | 'ready'
  | 'needs_review'
  | 'empty'
  | 'disabled'
```

`ready` means the Agent has usable memory/learning state for runtime retrieval.

`needs_review` means memory is enabled but there are pending learning events, expiring memories, or governance issues that should be reviewed by the user.

`empty` means memory is enabled but no useful memories, learning events, or Playbooks exist yet.

`disabled` means `memoryPolicy.enabled === false`, so runtime retrieval and post-run learning should be skipped.

## Learning Safety

The report intentionally does not auto-promote new lessons. Runtime reflection can produce learning events, but those events remain `pending_review` until a user approves them into Playbooks.

This matches the v1 policy:

- ordinary task memories can be written by runtime policy
- reusable procedures become learning events
- Playbooks require human review
- mistakes are preserved so future planning can avoid repeated failures
- sensitive memories are counted and expected to be encrypted

## UI Usage

Agent settings can show the readiness score inside the employee brain card. The same report highlights:

- pending learning reviews
- missing seed memories
- useful mistake memories
- active Playbooks
- expiring memories
- retrieval candidates for the current task goal

Runtime can use the report as a pre-run explanation of what memory context is likely to be available before it calls `retrieveRelevantMemories`.

Memory and learning should stay attached to the Agent that owns them:

- private Agent memory is visible only to that Agent by default
- project, team, and global tool knowledge require an explicit sharing path
- reusable procedures become Playbook drafts before they are activated
- failed lessons remain visible to the owning Agent so the next run can avoid the same mistake
- the UI should label this area as employee brain, Agent memory, Agent experience, learning, Playbooks, failed lessons, 自我校准, and 反思学习
