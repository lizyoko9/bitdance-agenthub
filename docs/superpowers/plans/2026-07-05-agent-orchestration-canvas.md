# Agent Orchestration Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the modular canvas core that makes nodes, output artifacts, and typed edges predictable, so downstream nodes receive only the artifact selected by the edge.

**Architecture:** Extract canvas artifact rules from the large React component into a pure library, then make the existing canvas UI call that library. Keep model, CLI, MCP, and permission configuration out of the canvas; the canvas only selects already configured agents and capabilities.

**Tech Stack:** TypeScript, React, Next.js, Vitest, existing workflow node/edge API.

## Global Constraints

- AgentHub product UI is free-only: no paid tiers, no membership gating, no paywalled modules, and no upsell UI.
- External model/API/CLI costs may be shown only as third-party usage reminders, not AgentHub pricing.
- The canvas must be business-level, not a low-level CLI/MCP/model configuration form.
- Each workflow edge must carry exactly one artifact type.
- A downstream node sees only artifact types selected by incoming edges unless the user explicitly configures broader input types.
- Keep edits scoped; do not rewrite unrelated modules.

---

### Task 1: Pure Canvas Artifact Model

**Files:**
- Create: `src/lib/agent-canvas-artifacts.test.ts`
- Create: `src/lib/agent-canvas-artifacts.ts`

**Interfaces:**
- Produces:
  - `CanvasArtifactType`
  - `CanvasArtifactPort`
  - `CanvasArtifactEdgeMapping`
  - `AgentCanvasNodeLike`
  - `AgentCanvasEdgeLike`
  - `CANVAS_ARTIFACT_TYPES`
  - `CANVAS_ARTIFACT_LABELS`
  - `normalizeCanvasArtifactType(value, fallback?)`
  - `getNodeOutputPorts(node)`
  - `getNodeAcceptedInputTypes(node)`
  - `createArtifactEdgeMapping(output, overrides?)`
  - `getEdgeArtifactType(edge, source?)`
  - `getIncomingArtifactTypes(targetNode, edges, nodes)`
  - `doesEdgeMatchTargetInput(edge, targetNode, source?)`
  - `deleteNodeAndConnectedEdges(nodeId, nodes, edges)`

- [ ] **Step 1: Write failing tests**

Create tests proving:

```ts
const writer = node({ id: 'writer', outputContract: { outputs: [
  { key: 'video', type: 'video', label: 'Video' },
  { key: 'code', type: 'code', label: 'Code' },
] } })
const reviewer = node({ id: 'reviewer', inputMapping: {} })
const edge = edge({
  sourceNodeId: 'writer',
  targetNodeId: 'reviewer',
  mapping: createArtifactEdgeMapping(getNodeOutputPorts(writer)[0]),
})

expect(getEdgeArtifactType(edge, writer)).toBe('video')
expect(getIncomingArtifactTypes(reviewer, [edge], [writer, reviewer])).toEqual(['video'])
```

Also test explicit input compatibility and deleting a node removes connected edges.

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules\vitest\vitest.mjs run src/lib/agent-canvas-artifacts.test.ts`

Expected: FAIL because `src/lib/agent-canvas-artifacts.ts` does not exist.

- [ ] **Step 3: Implement minimal pure library**

Implement only pure functions and exported constants. Do not import React.

- [ ] **Step 4: Run test to verify it passes**

Run: `node node_modules\vitest\vitest.mjs run src/lib/agent-canvas-artifacts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-canvas-artifacts.ts src/lib/agent-canvas-artifacts.test.ts docs/superpowers/plans/2026-07-05-agent-orchestration-canvas.md
git commit -m "feat: add agent canvas artifact model"
```

### Task 2: Canvas UI Uses Typed Artifact Rules

**Files:**
- Modify: `src/components/agent-workflow-canvas.tsx`

**Interfaces:**
- Consumes all exports from Task 1.
- Produces UI behavior:
  - output ports use normalized artifact labels
  - edge mappings carry `artifactType`, `outputKey`, `targetInputKey`, `customerVisible`, and `waitForSource`
  - Delete/Backspace deletes the selected node and connected edges

- [ ] **Step 1: Write or extend a focused test if a component-level test harness exists**

If no practical component harness exists, Task 1 pure tests are the guardrail and this task must be verified by browser smoke.

- [ ] **Step 2: Replace duplicated artifact helpers with library calls**

Use the pure helpers for output port derivation, input type derivation, edge type derivation, edge mapping, and node deletion.

- [ ] **Step 3: Replace mojibake canvas labels with readable Chinese**

Use labels:
- `agent_employee`: `智能体`
- `software_command`: `软件命令`
- `human_approval`: `人工确认`
- `artifact_transform`: `产物处理`
- `webhook_trigger`: `触发器`
- `condition`: `条件判断`

- [ ] **Step 4: Run focused tests**

Run: `node node_modules\vitest\vitest.mjs run src/lib/agent-canvas-artifacts.test.ts`

Expected: PASS.

- [ ] **Step 5: Run filtered typecheck**

Run: `node node_modules\typescript\bin\tsc --noEmit --pretty false 2>&1 | Select-String -Pattern "agent-canvas-artifacts|agent-workflow-canvas"`

Expected: no output for these files. Existing unrelated project errors may still exist.

- [ ] **Step 6: Browser smoke**

Open `http://localhost:3102`, enter `编排画布`, and verify:
- canvas renders without console errors
- background can pan
- selecting a node and pressing Delete removes it
- an edge can carry one visible artifact type

- [ ] **Step 7: Commit**

```bash
git add src/components/agent-workflow-canvas.tsx
git commit -m "feat: connect canvas UI to typed artifact rules"
```

### Task 3: Evidence and Progress

**Files:**
- Create: `docs/superpowers/evidence/2026-07-05-agent-orchestration-canvas.md`

**Interfaces:**
- Produces human-readable evidence of tests and remaining risk.

- [ ] **Step 1: Record verification**

Include commands, pass/fail results, known unrelated errors, and smoke screenshot path.

- [ ] **Step 2: Commit evidence**

```bash
git add docs/superpowers/evidence/2026-07-05-agent-orchestration-canvas.md
git commit -m "docs: record canvas artifact verification"
```
