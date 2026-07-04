# Free Product Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AgentHub a free product at the product-policy layer so future modules do not reintroduce paid tiers, subscriptions, memberships, or paywalls.

**Architecture:** Add a small pure product-policy module with tests, then point visible product copy at that module. Do not remove model/API usage cost analytics because those represent external provider costs paid by the user to their own vendors.

**Tech Stack:** TypeScript, Vitest, React copy integration.

## Global Constraints

- AgentHub itself is free.
- No paid tiers, subscriptions, memberships, paywalled modules, trial limits, billing copy, or upsell UI.
- External model/API/CLI costs can be shown only as user-owned provider usage, not AgentHub pricing.
- Do not delete database tables in this task; legacy commercial tables may stay for migration compatibility but must not be visible product strategy.

---

### Task 1: Free Product Policy Module

**Files:**
- Create: `src/lib/free-product-policy.test.ts`
- Create: `src/lib/free-product-policy.ts`

**Interfaces:**
- Produces:
  - `AGENTHUB_FREE_PRODUCT_NOTICE`
  - `FORBIDDEN_PRODUCT_MONETIZATION_TERMS`
  - `containsForbiddenProductMonetization(text)`
  - `assertFreeProductCopy(text)`

- [ ] **Step 1: Write failing tests**

Tests must prove:
- notice says AgentHub is free
- notice allows external provider costs
- paid tier terms are rejected
- external model cost language is allowed

- [ ] **Step 2: Run failing test**

Run: `node node_modules\vitest\vitest.mjs run src/lib/free-product-policy.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement policy module**

Implement pure functions only.

- [ ] **Step 4: Run passing test**

Run: `node node_modules\vitest\vitest.mjs run src/lib/free-product-policy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/free-product-policy.ts src/lib/free-product-policy.test.ts docs/superpowers/plans/2026-07-05-free-product-policy.md
git commit -m "feat: add free product policy"
```

### Task 2: Visible Copy Uses Free Policy

**Files:**
- Modify: `src/lib/software-capability-store.ts`
- Modify as needed: visible module copy files

**Interfaces:**
- Consumes `AGENTHUB_FREE_PRODUCT_NOTICE`.

- [ ] **Step 1: Use the shared free notice**
- [ ] **Step 2: Run affected tests**
- [ ] **Step 3: Commit**
