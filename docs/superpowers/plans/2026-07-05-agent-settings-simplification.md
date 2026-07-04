# Agent Settings Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the low-level factory-style Agent settings view with a simple employee settings panel that lets users select configured models, Skills, MCP, CLI, permissions, memory posture, and output expectations without creating infrastructure there.

**Architecture:** Add a pure settings section model first, then render a focused React panel from it. Keep model creation in Model Management, software/CLI/MCP creation in Tool Connections, and Skills installation in Skills Management.

**Tech Stack:** TypeScript, React, Vitest, existing Agent API.

## Global Constraints

- AgentHub itself is free; do not add paid tiers, memberships, subscriptions, or paywall copy.
- Agent settings must not expose infrastructure creation forms for network outlets, model profiles, CLI profiles, MCP servers, software profiles, prompt templates, or style guides.
- Agent settings may assign already configured model profiles, Skills, MCP servers, and CLI profiles.
- Keep edits scoped to Agent settings and shared helper code.

---

### Task 1: Agent Settings Section Model

**Files:**
- Create: `src/lib/agent-employee-settings.test.ts`
- Create: `src/lib/agent-employee-settings.ts`

**Interfaces:**
- Produces:
  - `AGENT_EMPLOYEE_SETTING_SECTIONS`
  - `FORBIDDEN_AGENT_SETTINGS_INFRASTRUCTURE_LABELS`
  - `assertSimpleAgentSettingsLabels(labels)`
  - `buildAgentSettingsCapabilitySummary(args)`

- [ ] **Step 1: Write failing tests**

Tests must prove:
- visible sections are business-level: basic, model, toolkit, permissions, memory, output
- forbidden infrastructure labels are rejected
- counts summarize selected Skills, MCP servers, CLI profiles, and built-in tools

- [ ] **Step 2: Run failing test**

Run: `node node_modules\vitest\vitest.mjs run src/lib/agent-employee-settings.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement pure module**

Implement with no React imports.

- [ ] **Step 4: Run passing test**

Run: `node node_modules\vitest\vitest.mjs run src/lib/agent-employee-settings.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-employee-settings.ts src/lib/agent-employee-settings.test.ts docs/superpowers/plans/2026-07-05-agent-settings-simplification.md
git commit -m "feat: add simple agent settings model"
```

### Task 2: Simple Agent Settings Panel

**Files:**
- Create: `src/components/agent-employee-settings-panel.tsx`
- Modify: `src/components/agent-library.tsx`

**Interfaces:**
- Consumes:
  - `AGENT_EMPLOYEE_SETTING_SECTIONS`
  - `buildAgentSettingsCapabilitySummary`
  - `updateAgent`
  - `fetchModelProfiles`
  - `fetchSkillsCenterData`
  - `fetchMcpServers`
  - `fetchCliProfiles`

- Produces UI:
  - Select configured model
  - Toggle installed Skills
  - Toggle existing MCP servers
  - Toggle existing CLI profiles
  - Show permissions, memory, and output as plain employee-level cards
  - No low-level creation forms

- [ ] **Step 1: Implement panel**
- [ ] **Step 2: Replace `EmployeeAgentFactory` embedded settings in `AgentLibrary` with the new panel**
- [ ] **Step 3: Run targeted tests**

Run:

```powershell
node node_modules\vitest\vitest.mjs run src/lib/agent-employee-settings.test.ts
node node_modules\typescript\bin\tsc --noEmit --pretty false 2>&1 | Select-String -Pattern "agent-employee-settings|agent-library"
```

- [ ] **Step 4: Browser smoke**

Open Agent page and verify:
- clicking an Agent opens settings
- the right panel contains employee-level sections
- it does not contain `Network Profile`, `CLI Profile`, `MCP Server`, `Prompt Template`, or `Style Guide`

- [ ] **Step 5: Commit**

```bash
git add src/components/agent-employee-settings-panel.tsx src/components/agent-library.tsx
git commit -m "feat: simplify agent settings panel"
```
