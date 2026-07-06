# Agents CLI Lifecycle Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the useful architecture ideas from `google/agents-cli` into AgentHub without adding more confusing product surfaces.

**Architecture:** Keep AgentHub's existing desktop app, module registry, agent canvas, workflow runner, control plane, and observability services. Add a local lifecycle layer that turns a user's goal into a reusable manifest, validates CLI/MCP/software capability readiness, runs workflow evals, and produces observe/debug summaries. Do not make Google Cloud, Gemini Enterprise, or ADK Python runtime part of the core app.

**Tech Stack:** Next.js 16, React 19, Electron, TypeScript, Vitest, Drizzle/SQLite, existing AgentHub services, optional inspiration from Apache-2.0 `google/agents-cli`.

## Global Constraints

- Desktop-first and local-first.
- Free-only product surface; no paid tiers, usage gates, premium copy, or subscription affordances.
- Do not add extra visible navigation entries for lifecycle/eval unless a later product decision explicitly asks for it.
- Existing orchestration entries must normalize to one canonical canvas: `agent-canvas`.
- Canvas remains business-level: users configure Agent, artifact outputs, and routes; low-level model/CLI/MCP forms stay in Agent or Tool settings.
- Each workflow edge should route one selected artifact kind to the downstream node.
- Do not expose Google Cloud deployment as the default path.
- Do not store user API keys in fixtures, tests, docs, or seed data.
- Do not mutate unrelated UI text, seed data, or smoke fixtures while implementing this plan.

---

## Existing Code To Reuse

- `src/modules/app-modules.tsx`
  - Keep as the module registry.
  - Do not add another visible canvas or lifecycle module.

- `src/lib/app-module-navigation.ts`
  - Reuse `CANONICAL_ORCHESTRATION_MODULE_ID = 'agent-canvas'`.
  - Keep `workflows`, `agent-orchestration`, `langflow-native`, and `infinite-canvas` hidden/normalized.

- `src/server/control-plane-service.ts`
  - Reuse model, network, CLI, MCP, software, skill, memory, workflow, and approval management functions.

- `src/server/workflow-runner-service.ts`
  - Reuse workflow execution, node ordering, artifact routing, approval pause/resume, software command execution, and resource locks.

- `src/server/observability-service.ts`
  - Reuse debug package, replay snapshot, metric points, run summaries, and tool-call history.

- `src/components/langflow-agent-canvas.tsx`
  - Keep as the single orchestration UI surface.
  - Add lifecycle status and eval readiness only if it fits the current canvas header/panel.

- `src/components/tool-control-center.tsx`
  - Reuse for CLI/MCP/software capability setup.
  - Keep the "software first, detail page second" interaction.

- `src/components/model-control-center.tsx`
  - Reuse for model and network outlet setup.

## What To Borrow From `google/agents-cli`

- Lifecycle sequence:
  - Spec
  - Scaffold
  - Build
  - Orchestrate
  - Evaluate
  - Observe

- Manifest idea:
  - A project-level file or database record should say what a workflow expects, which Agents/tools it uses, and how to validate it.

- Lazy command registry idea:
  - Register CLI/MCP/software commands by capability, then resolve only when used.

- Runner idea:
  - One safe command runner owns cwd, env, timeout, streaming/capture, process cleanup, and detached process behavior.

- Eval idea:
  - Use small datasets and rubric metrics to test whether an Agent/workflow actually completes the job.

- Observe idea:
  - Every run should explain which node ran, which tool/model was used, what artifact was produced, where it failed, and what to fix next.

## What Not To Borrow

- Do not make Google Cloud deploy/publish part of the main flow.
- Do not require ADK Python agent projects.
- Do not require BigQuery, Cloud Trace, or Gemini Enterprise.
- Do not iframe or embed the external agents-cli UI. There is no user-facing UI to embed.

---

### Task 1: Add Lifecycle Types

**Files:**
- Create: `src/lib/agenthub-lifecycle-types.ts`
- Test: `src/lib/agenthub-lifecycle-types.test.ts`

**Interfaces:**
- Produces:
  - `AgentHubLifecyclePhase`
  - `AgentHubLifecycleManifest`
  - `AgentHubLifecycleCapabilityRef`
  - `AgentHubEvalMetric`
  - `AgentHubEvalCase`
  - `normalizeLifecyclePhase(value: string): AgentHubLifecyclePhase`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { normalizeLifecyclePhase } from './agenthub-lifecycle-types'

describe('agenthub lifecycle types', () => {
  it('normalizes known lifecycle phases', () => {
    expect(normalizeLifecyclePhase('spec')).toBe('spec')
    expect(normalizeLifecyclePhase('scaffold')).toBe('scaffold')
    expect(normalizeLifecyclePhase('build')).toBe('build')
    expect(normalizeLifecyclePhase('orchestrate')).toBe('orchestrate')
    expect(normalizeLifecyclePhase('evaluate')).toBe('evaluate')
    expect(normalizeLifecyclePhase('observe')).toBe('observe')
  })

  it('falls back to spec for unknown phase values', () => {
    expect(normalizeLifecyclePhase('google-cloud-deploy')).toBe('spec')
    expect(normalizeLifecyclePhase('')).toBe('spec')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/lib/agenthub-lifecycle-types.test.ts`

Expected: FAIL because `src/lib/agenthub-lifecycle-types.ts` does not exist.

- [ ] **Step 3: Add lifecycle type implementation**

```ts
export type AgentHubLifecyclePhase = 'spec' | 'scaffold' | 'build' | 'orchestrate' | 'evaluate' | 'observe'

export type AgentHubLifecycleCapabilityKind = 'agent' | 'model' | 'cli' | 'mcp' | 'software' | 'skill'

export type AgentHubLifecycleCapabilityRef = {
  kind: AgentHubLifecycleCapabilityKind
  id: string
  name: string
  required: boolean
}

export type AgentHubEvalMetricKind =
  | 'task_success'
  | 'artifact_contract'
  | 'tool_use'
  | 'instruction_following'
  | 'safety'
  | 'handoff_quality'

export type AgentHubEvalMetric = {
  kind: AgentHubEvalMetricKind
  weight: number
  passingScore: number
}

export type AgentHubEvalCase = {
  id: string
  name: string
  input: Record<string, unknown>
  expectedArtifacts: string[]
  metrics: AgentHubEvalMetric[]
}

export type AgentHubLifecycleManifest = {
  id: string
  name: string
  version: number
  source: 'manual' | 'canvas' | 'agenthub'
  currentPhase: AgentHubLifecyclePhase
  workflowId?: string
  agentIds: string[]
  capabilityRefs: AgentHubLifecycleCapabilityRef[]
  evalCases: AgentHubEvalCase[]
  createdAt: string
  updatedAt: string
}

const lifecyclePhases = new Set<AgentHubLifecyclePhase>([
  'spec',
  'scaffold',
  'build',
  'orchestrate',
  'evaluate',
  'observe',
])

export function normalizeLifecyclePhase(value: string): AgentHubLifecyclePhase {
  return lifecyclePhases.has(value as AgentHubLifecyclePhase) ? (value as AgentHubLifecyclePhase) : 'spec'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/lib/agenthub-lifecycle-types.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agenthub-lifecycle-types.ts src/lib/agenthub-lifecycle-types.test.ts
git commit -m "feat: add AgentHub lifecycle types"
```

---

### Task 2: Add Manifest Service Without New Database Tables

**Files:**
- Create: `src/server/agenthub-lifecycle-manifest-service.ts`
- Test: `src/server/agenthub-lifecycle-manifest-service.test.ts`

**Interfaces:**
- Consumes:
  - `AgentHubLifecycleManifest` from `src/lib/agenthub-lifecycle-types.ts`
- Produces:
  - `createLifecycleManifest(input): AgentHubLifecycleManifest`
  - `deriveLifecycleManifestFromWorkflow(input): AgentHubLifecycleManifest`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { createLifecycleManifest, deriveLifecycleManifestFromWorkflow } from './agenthub-lifecycle-manifest-service'

describe('agenthub lifecycle manifest service', () => {
  it('creates a local manifest from explicit inputs', () => {
    const manifest = createLifecycleManifest({
      name: 'Customer delivery workflow',
      workflowId: 'wf_1',
      agentIds: ['agent_writer'],
      capabilityRefs: [
        { kind: 'cli', id: 'cli_codex', name: 'Codex CLI', required: true },
      ],
      evalCases: [],
      now: '2026-07-06T00:00:00.000Z',
    })

    expect(manifest.name).toBe('Customer delivery workflow')
    expect(manifest.currentPhase).toBe('spec')
    expect(manifest.workflowId).toBe('wf_1')
    expect(manifest.agentIds).toEqual(['agent_writer'])
    expect(manifest.capabilityRefs).toHaveLength(1)
  })

  it('derives capabilities from workflow nodes without adding extra UI modules', () => {
    const manifest = deriveLifecycleManifestFromWorkflow({
      workflow: { id: 'wf_canvas', name: 'Canvas Flow' },
      nodes: [
        { id: 'node_agent', type: 'agent_employee', agentProfileId: 'agent_pm', label: 'PM Agent' },
        { id: 'node_cli', type: 'cli_command', cliProfileId: 'cli_codex', label: 'Codex CLI' },
      ],
      now: '2026-07-06T00:00:00.000Z',
    })

    expect(manifest.workflowId).toBe('wf_canvas')
    expect(manifest.agentIds).toEqual(['agent_pm'])
    expect(manifest.capabilityRefs).toEqual([
      { kind: 'agent', id: 'agent_pm', name: 'PM Agent', required: true },
      { kind: 'cli', id: 'cli_codex', name: 'Codex CLI', required: true },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/server/agenthub-lifecycle-manifest-service.test.ts`

Expected: FAIL because service file does not exist.

- [ ] **Step 3: Add manifest service**

```ts
import { nanoid } from 'nanoid'

import type {
  AgentHubEvalCase,
  AgentHubLifecycleCapabilityRef,
  AgentHubLifecycleManifest,
} from '@/lib/agenthub-lifecycle-types'

export type CreateLifecycleManifestInput = {
  name: string
  workflowId?: string
  agentIds?: string[]
  capabilityRefs?: AgentHubLifecycleCapabilityRef[]
  evalCases?: AgentHubEvalCase[]
  now?: string
}

export type DeriveLifecycleManifestFromWorkflowInput = {
  workflow: { id: string; name: string }
  nodes: Array<Record<string, unknown>>
  now?: string
}

export function createLifecycleManifest(input: CreateLifecycleManifestInput): AgentHubLifecycleManifest {
  const now = input.now ?? new Date().toISOString()

  return {
    id: `life_${nanoid(10)}`,
    name: input.name.trim() || 'Untitled lifecycle',
    version: 1,
    source: 'agenthub',
    currentPhase: 'spec',
    workflowId: input.workflowId,
    agentIds: input.agentIds ?? [],
    capabilityRefs: input.capabilityRefs ?? [],
    evalCases: input.evalCases ?? [],
    createdAt: now,
    updatedAt: now,
  }
}

export function deriveLifecycleManifestFromWorkflow(
  input: DeriveLifecycleManifestFromWorkflowInput,
): AgentHubLifecycleManifest {
  const agentIds: string[] = []
  const capabilityRefs: AgentHubLifecycleCapabilityRef[] = []

  for (const node of input.nodes) {
    const type = String(node.type ?? '')
    const label = String(node.label ?? node.name ?? node.id ?? 'Capability')

    if (type === 'agent_employee' && typeof node.agentProfileId === 'string') {
      agentIds.push(node.agentProfileId)
      capabilityRefs.push({ kind: 'agent', id: node.agentProfileId, name: label, required: true })
    }

    if (type === 'cli_command' && typeof node.cliProfileId === 'string') {
      capabilityRefs.push({ kind: 'cli', id: node.cliProfileId, name: label, required: true })
    }

    if (type === 'mcp_tool' && typeof node.mcpServerId === 'string') {
      capabilityRefs.push({ kind: 'mcp', id: node.mcpServerId, name: label, required: true })
    }

    if (type === 'software_command' && typeof node.softwareProfileId === 'string') {
      capabilityRefs.push({ kind: 'software', id: node.softwareProfileId, name: label, required: true })
    }
  }

  return createLifecycleManifest({
    name: input.workflow.name,
    workflowId: input.workflow.id,
    agentIds,
    capabilityRefs,
    evalCases: [],
    now: input.now,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/server/agenthub-lifecycle-manifest-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/agenthub-lifecycle-manifest-service.ts src/server/agenthub-lifecycle-manifest-service.test.ts
git commit -m "feat: derive lifecycle manifests from workflows"
```

---

### Task 3: Add Central Command Runner Inspired By agents-cli Runner

**Files:**
- Create: `src/server/agenthub-command-runner.ts`
- Test: `src/server/agenthub-command-runner.test.ts`

**Interfaces:**
- Produces:
  - `runAgentHubCommand(input): Promise<AgentHubCommandResult>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { runAgentHubCommand } from './agenthub-command-runner'

describe('agenthub command runner', () => {
  it('runs a command and captures stdout', async () => {
    const result = await runAgentHubCommand({
      command: process.execPath,
      args: ['-e', 'console.log("agenthub")'],
      cwd: process.cwd(),
      timeoutMs: 5_000,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('agenthub')
    expect(result.timedOut).toBe(false)
  })

  it('times out long-running commands', async () => {
    const result = await runAgentHubCommand({
      command: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 10000)'],
      cwd: process.cwd(),
      timeoutMs: 50,
    })

    expect(result.exitCode).not.toBe(0)
    expect(result.timedOut).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/server/agenthub-command-runner.test.ts`

Expected: FAIL because runner file does not exist.

- [ ] **Step 3: Add command runner**

```ts
import { spawn } from 'node:child_process'

export type AgentHubCommandInput = {
  command: string
  args?: string[]
  cwd: string
  env?: Record<string, string | undefined>
  timeoutMs: number
}

export type AgentHubCommandResult = {
  command: string
  args: string[]
  cwd: string
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  startedAt: string
  finishedAt: string
}

export async function runAgentHubCommand(input: AgentHubCommandInput): Promise<AgentHubCommandResult> {
  const args = input.args ?? []
  const startedAt = new Date().toISOString()

  return await new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const child = spawn(input.command, args, {
      cwd: input.cwd,
      env: { ...process.env, ...(input.env ?? {}) },
      windowsHide: true,
      shell: false,
    })

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, input.timeoutMs)

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({
        command: input.command,
        args,
        cwd: input.cwd,
        exitCode: 1,
        stdout,
        stderr: stderr + error.message,
        timedOut,
        startedAt,
        finishedAt: new Date().toISOString(),
      })
    })

    child.on('close', (exitCode) => {
      clearTimeout(timer)
      resolve({
        command: input.command,
        args,
        cwd: input.cwd,
        exitCode: timedOut ? 124 : exitCode,
        stdout,
        stderr,
        timedOut,
        startedAt,
        finishedAt: new Date().toISOString(),
      })
    })
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/server/agenthub-command-runner.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/agenthub-command-runner.ts src/server/agenthub-command-runner.test.ts
git commit -m "feat: add central AgentHub command runner"
```

---

### Task 4: Add Capability Readiness Checks

**Files:**
- Create: `src/server/agenthub-capability-readiness-service.ts`
- Test: `src/server/agenthub-capability-readiness-service.test.ts`

**Interfaces:**
- Consumes:
  - `AgentHubLifecycleManifest`
- Produces:
  - `evaluateLifecycleCapabilityReadiness(manifest, inventory): AgentHubCapabilityReadinessReport`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { evaluateLifecycleCapabilityReadiness } from './agenthub-capability-readiness-service'

describe('agenthub capability readiness service', () => {
  it('marks missing required capabilities as blocking', () => {
    const report = evaluateLifecycleCapabilityReadiness(
      {
        id: 'life_1',
        name: 'Flow',
        version: 1,
        source: 'agenthub',
        currentPhase: 'spec',
        workflowId: 'wf_1',
        agentIds: [],
        capabilityRefs: [{ kind: 'cli', id: 'cli_missing', name: 'Missing CLI', required: true }],
        evalCases: [],
        createdAt: '2026-07-06T00:00:00.000Z',
        updatedAt: '2026-07-06T00:00:00.000Z',
      },
      { agentIds: [], modelIds: [], cliIds: [], mcpIds: [], softwareIds: [], skillIds: [] },
    )

    expect(report.ready).toBe(false)
    expect(report.blockers).toEqual(['Missing required cli: Missing CLI'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/server/agenthub-capability-readiness-service.test.ts`

Expected: FAIL because service file does not exist.

- [ ] **Step 3: Add readiness service**

```ts
import type {
  AgentHubLifecycleCapabilityKind,
  AgentHubLifecycleManifest,
} from '@/lib/agenthub-lifecycle-types'

export type AgentHubCapabilityInventory = {
  agentIds: string[]
  modelIds: string[]
  cliIds: string[]
  mcpIds: string[]
  softwareIds: string[]
  skillIds: string[]
}

export type AgentHubCapabilityReadinessReport = {
  ready: boolean
  blockers: string[]
  warnings: string[]
}

const inventoryKeyByKind: Record<AgentHubLifecycleCapabilityKind, keyof AgentHubCapabilityInventory> = {
  agent: 'agentIds',
  model: 'modelIds',
  cli: 'cliIds',
  mcp: 'mcpIds',
  software: 'softwareIds',
  skill: 'skillIds',
}

export function evaluateLifecycleCapabilityReadiness(
  manifest: AgentHubLifecycleManifest,
  inventory: AgentHubCapabilityInventory,
): AgentHubCapabilityReadinessReport {
  const blockers: string[] = []
  const warnings: string[] = []

  for (const capability of manifest.capabilityRefs) {
    const inventoryKey = inventoryKeyByKind[capability.kind]
    const exists = inventory[inventoryKey].includes(capability.id)

    if (!exists && capability.required) {
      blockers.push(`Missing required ${capability.kind}: ${capability.name}`)
    }

    if (!exists && !capability.required) {
      warnings.push(`Optional ${capability.kind} is not configured: ${capability.name}`)
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/server/agenthub-capability-readiness-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/agenthub-capability-readiness-service.ts src/server/agenthub-capability-readiness-service.test.ts
git commit -m "feat: add lifecycle capability readiness checks"
```

---

### Task 5: Add Local Eval Service

**Files:**
- Create: `src/server/agenthub-eval-service.ts`
- Test: `src/server/agenthub-eval-service.test.ts`

**Interfaces:**
- Consumes:
  - `AgentHubEvalCase`
- Produces:
  - `gradeLifecycleEvalCase(evalCase, observed): AgentHubEvalResult`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { gradeLifecycleEvalCase } from './agenthub-eval-service'

describe('agenthub eval service', () => {
  it('grades artifact contract and task success from observed outputs', () => {
    const result = gradeLifecycleEvalCase(
      {
        id: 'case_1',
        name: 'Generate delivery report',
        input: { goal: 'make report' },
        expectedArtifacts: ['report'],
        metrics: [
          { kind: 'artifact_contract', weight: 0.6, passingScore: 1 },
          { kind: 'task_success', weight: 0.4, passingScore: 1 },
        ],
      },
      {
        completed: true,
        artifactTypes: ['report'],
        safetyBlocked: false,
        toolCalls: 2,
        handoffCount: 1,
      },
    )

    expect(result.passed).toBe(true)
    expect(result.score).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/server/agenthub-eval-service.test.ts`

Expected: FAIL because service file does not exist.

- [ ] **Step 3: Add eval service**

```ts
import type { AgentHubEvalCase, AgentHubEvalMetricKind } from '@/lib/agenthub-lifecycle-types'

export type AgentHubObservedEvalRun = {
  completed: boolean
  artifactTypes: string[]
  safetyBlocked: boolean
  toolCalls: number
  handoffCount: number
}

export type AgentHubEvalResult = {
  evalCaseId: string
  passed: boolean
  score: number
  metricScores: Record<AgentHubEvalMetricKind, number>
  notes: string[]
}

export function gradeLifecycleEvalCase(
  evalCase: AgentHubEvalCase,
  observed: AgentHubObservedEvalRun,
): AgentHubEvalResult {
  const metricScores = {} as Record<AgentHubEvalMetricKind, number>
  const notes: string[] = []
  let weightedScore = 0
  let totalWeight = 0

  for (const metric of evalCase.metrics) {
    const score = scoreMetric(metric.kind, evalCase, observed)
    metricScores[metric.kind] = score
    weightedScore += score * metric.weight
    totalWeight += metric.weight

    if (score < metric.passingScore) {
      notes.push(`${metric.kind} scored ${score}, expected at least ${metric.passingScore}`)
    }
  }

  const score = totalWeight === 0 ? 0 : Number((weightedScore / totalWeight).toFixed(4))

  return {
    evalCaseId: evalCase.id,
    passed: notes.length === 0,
    score,
    metricScores,
    notes,
  }
}

function scoreMetric(
  kind: AgentHubEvalMetricKind,
  evalCase: AgentHubEvalCase,
  observed: AgentHubObservedEvalRun,
): number {
  if (kind === 'artifact_contract') {
    return evalCase.expectedArtifacts.every((artifactType) => observed.artifactTypes.includes(artifactType)) ? 1 : 0
  }

  if (kind === 'task_success') {
    return observed.completed ? 1 : 0
  }

  if (kind === 'safety') {
    return observed.safetyBlocked ? 0 : 1
  }

  if (kind === 'tool_use') {
    return observed.toolCalls > 0 ? 1 : 0
  }

  if (kind === 'handoff_quality') {
    return observed.handoffCount >= 0 ? 1 : 0
  }

  if (kind === 'instruction_following') {
    return observed.completed && !observed.safetyBlocked ? 1 : 0
  }

  return 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/server/agenthub-eval-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/agenthub-eval-service.ts src/server/agenthub-eval-service.test.ts
git commit -m "feat: add local lifecycle eval service"
```

---

### Task 6: Add Lifecycle Report Aggregator

**Files:**
- Create: `src/server/agenthub-lifecycle-report-service.ts`
- Test: `src/server/agenthub-lifecycle-report-service.test.ts`

**Interfaces:**
- Consumes:
  - `AgentHubLifecycleManifest`
  - `AgentHubCapabilityReadinessReport`
  - `AgentHubEvalResult[]`
- Produces:
  - `buildLifecycleReport(input): AgentHubLifecycleReport`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { buildLifecycleReport } from './agenthub-lifecycle-report-service'

describe('agenthub lifecycle report service', () => {
  it('summarizes readiness and eval results for UI display', () => {
    const report = buildLifecycleReport({
      manifest: {
        id: 'life_1',
        name: 'Delivery Flow',
        version: 1,
        source: 'agenthub',
        currentPhase: 'evaluate',
        workflowId: 'wf_1',
        agentIds: ['agent_1'],
        capabilityRefs: [],
        evalCases: [],
        createdAt: '2026-07-06T00:00:00.000Z',
        updatedAt: '2026-07-06T00:00:00.000Z',
      },
      readiness: { ready: true, blockers: [], warnings: [] },
      evalResults: [{ evalCaseId: 'case_1', passed: true, score: 1, metricScores: {}, notes: [] }],
    })

    expect(report.status).toBe('ready')
    expect(report.summary).toBe('Delivery Flow is ready. 1/1 eval cases passed.')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/server/agenthub-lifecycle-report-service.test.ts`

Expected: FAIL because service file does not exist.

- [ ] **Step 3: Add report service**

```ts
import type { AgentHubLifecycleManifest } from '@/lib/agenthub-lifecycle-types'
import type { AgentHubCapabilityReadinessReport } from './agenthub-capability-readiness-service'
import type { AgentHubEvalResult } from './agenthub-eval-service'

export type AgentHubLifecycleReportStatus = 'blocked' | 'needs_eval' | 'ready'

export type AgentHubLifecycleReport = {
  manifestId: string
  workflowId?: string
  status: AgentHubLifecycleReportStatus
  summary: string
  blockers: string[]
  warnings: string[]
  evalPassed: number
  evalTotal: number
}

export type BuildLifecycleReportInput = {
  manifest: AgentHubLifecycleManifest
  readiness: AgentHubCapabilityReadinessReport
  evalResults: AgentHubEvalResult[]
}

export function buildLifecycleReport(input: BuildLifecycleReportInput): AgentHubLifecycleReport {
  const evalPassed = input.evalResults.filter((result) => result.passed).length
  const evalTotal = input.evalResults.length

  if (!input.readiness.ready) {
    return {
      manifestId: input.manifest.id,
      workflowId: input.manifest.workflowId,
      status: 'blocked',
      summary: `${input.manifest.name} is blocked by ${input.readiness.blockers.length} missing capability.`,
      blockers: input.readiness.blockers,
      warnings: input.readiness.warnings,
      evalPassed,
      evalTotal,
    }
  }

  if (evalTotal === 0 || evalPassed < evalTotal) {
    return {
      manifestId: input.manifest.id,
      workflowId: input.manifest.workflowId,
      status: 'needs_eval',
      summary: `${input.manifest.name} needs eval before it is trusted.`,
      blockers: [],
      warnings: input.readiness.warnings,
      evalPassed,
      evalTotal,
    }
  }

  return {
    manifestId: input.manifest.id,
    workflowId: input.manifest.workflowId,
    status: 'ready',
    summary: `${input.manifest.name} is ready. ${evalPassed}/${evalTotal} eval cases passed.`,
    blockers: [],
    warnings: input.readiness.warnings,
    evalPassed,
    evalTotal,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/server/agenthub-lifecycle-report-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/agenthub-lifecycle-report-service.ts src/server/agenthub-lifecycle-report-service.test.ts
git commit -m "feat: summarize lifecycle readiness reports"
```

---

### Task 7: Surface Lifecycle Status In Existing Canvas Header

**Files:**
- Modify: `src/components/langflow-agent-canvas.tsx`
- Test: `src/components/langflow-agent-canvas-lifecycle.test.ts`

**Interfaces:**
- Consumes:
  - `AgentHubLifecycleReport`
- Produces:
  - A small non-blocking status chip in the existing canvas header.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('LangflowAgentCanvas lifecycle UI', () => {
  it('keeps lifecycle status inside the existing canvas instead of adding a new module', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

    expect(source).toContain('生命周期')
    expect(source).toContain('运行前检查')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/components/langflow-agent-canvas-lifecycle.test.ts`

Expected: FAIL until the canvas header contains lifecycle status copy.

- [ ] **Step 3: Add one compact lifecycle chip to the existing header**

Implementation rule:
- Do not add a left-nav module.
- Do not add a large new panel.
- Put status beside the existing save/preflight/run controls.
- Copy should be short:
  - `生命周期`
  - `运行前检查`
  - `可试运行`
  - `需补能力`

Example TSX shape:

```tsx
<div className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs text-muted-foreground">
  <CheckCircle2 className="size-3.5 text-emerald-500" />
  <span>生命周期</span>
  <span className="font-medium text-foreground">运行前检查</span>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/components/langflow-agent-canvas-lifecycle.test.ts`

Expected: PASS.

- [ ] **Step 5: Run canvas tests**

Run: `corepack pnpm vitest run src/components/agent-workflow-canvas-outputs.test.ts src/modules/app-modules-routing.test.ts src/components/langflow-agent-canvas-lifecycle.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/langflow-agent-canvas.tsx src/components/langflow-agent-canvas-lifecycle.test.ts
git commit -m "feat: show lifecycle status in canvas"
```

---

### Task 8: Verify Module Navigation Stays Simple

**Files:**
- Modify: `src/modules/app-modules-routing.test.ts`
- Possibly Modify: `src/modules/app-modules.tsx`

**Interfaces:**
- Consumes:
  - Existing module registry.
- Produces:
  - Tests that prevent duplicate visible orchestration entries.

- [ ] **Step 1: Add test assertions**

Add this test to `src/modules/app-modules-routing.test.ts`:

```ts
import { appModules, getPrimaryAppModules } from './app-modules'

describe('visible app module simplicity', () => {
  it('does not expose separate lifecycle or langflow canvas modules in primary navigation', () => {
    const primaryIds = getPrimaryAppModules().map((module) => module.id)

    expect(primaryIds).toContain('agent-canvas')
    expect(primaryIds).not.toContain('workflows')
    expect(primaryIds).not.toContain('agent-orchestration')
    expect(primaryIds).not.toContain('langflow-native')
    expect(primaryIds).not.toContain('infinite-canvas')
    expect(appModules.some((module) => module.id === 'agenthub-lifecycle')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test**

Run: `corepack pnpm vitest run src/modules/app-modules-routing.test.ts`

Expected: PASS. If it fails, keep only `agent-canvas` in primary navigation and move lifecycle information into the canvas/workbench UI.

- [ ] **Step 3: Commit**

```bash
git add src/modules/app-modules-routing.test.ts src/modules/app-modules.tsx
git commit -m "test: guard against duplicate orchestration navigation"
```

---

### Task 9: Add Reference Documentation

**Files:**
- Create: `docs/reference/agenthub-lifecycle.md`

**Interfaces:**
- Produces:
  - Human-readable architecture note explaining what was borrowed from `google/agents-cli` and what was intentionally not copied.

- [ ] **Step 1: Add reference doc**

```md
# AgentHub Lifecycle

AgentHub borrows the lifecycle shape from google/agents-cli but keeps the product local-first and desktop-first.

## Lifecycle

1. Spec: capture the user's goal, required Agents, tools, and deliverables.
2. Scaffold: create or update the workflow draft.
3. Build: configure Agents, model profiles, CLI/MCP/software capabilities, and artifact contracts.
4. Orchestrate: run the workflow through the existing AgentHub canvas runner.
5. Evaluate: grade the run against local eval cases and artifact contracts.
6. Observe: summarize traces, tool calls, artifacts, failures, and next fixes.

## Reused AgentHub Modules

- Module registry: `src/modules/app-modules.tsx`
- Canvas normalization: `src/lib/app-module-navigation.ts`
- Control plane: `src/server/control-plane-service.ts`
- Workflow runner: `src/server/workflow-runner-service.ts`
- Observability: `src/server/observability-service.ts`

## Borrowed Ideas From google/agents-cli

- Manifest-driven project state.
- Central command runner.
- Eval generate/grade/compare/analyze loop.
- Observe/debug loop.

## Not Included In Core

- Google Cloud deployment.
- Gemini Enterprise-only behavior.
- ADK Python runtime as a requirement.
- BigQuery or Cloud Trace as required dependencies.
```

- [ ] **Step 2: Commit**

```bash
git add docs/reference/agenthub-lifecycle.md
git commit -m "docs: document AgentHub lifecycle architecture"
```

---

### Task 10: Final Verification

**Files:**
- No new source files unless previous tasks require fixes.

- [ ] **Step 1: Run focused tests**

Run:

```bash
corepack pnpm vitest run \
  src/lib/agenthub-lifecycle-types.test.ts \
  src/server/agenthub-lifecycle-manifest-service.test.ts \
  src/server/agenthub-command-runner.test.ts \
  src/server/agenthub-capability-readiness-service.test.ts \
  src/server/agenthub-eval-service.test.ts \
  src/server/agenthub-lifecycle-report-service.test.ts \
  src/components/langflow-agent-canvas-lifecycle.test.ts \
  src/modules/app-modules-routing.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `corepack pnpm typecheck`

Expected: PASS.

- [ ] **Step 3: Run lint**

Run: `corepack pnpm lint`

Expected: PASS or only pre-existing unrelated lint failures. Any new failures from lifecycle files must be fixed.

- [ ] **Step 4: Manual UI check**

Run: `corepack pnpm electron:dev`

Check:
- Left navigation still has one orchestration entry: `编排画布`.
- No visible `Langflow 原生`, `无限画布`, `Agent 编排`, or `Lifecycle` duplicate entry.
- Canvas header shows a compact lifecycle/readiness status.
- Tool connection stays software-first.
- No Google Cloud deployment controls are shown in normal flow.

- [ ] **Step 5: Commit final verification notes**

If a docs/evidence file is used in this repo, append the commands and results there. Do not invent pass results.

```bash
git status --short
git commit -m "chore: verify lifecycle integration"
```

## Self-Review

- Spec coverage: This plan covers the requested `google/agents-cli` architecture adoption through lifecycle, manifest, CLI runner, eval, observe, and local module integration.
- Product simplification: It explicitly avoids adding more visible modules and keeps the single canvas entry.
- Code reuse: It reuses the existing AgentHub module registry, canvas, control plane, workflow runner, and observability services.
- Risk control: It avoids Google Cloud lock-in and API key exposure.
- Placeholder scan: No task uses TBD/TODO/fill-later language.
- Type consistency: Lifecycle types are defined first and consumed by all later services.

