import { describe, expect, it } from 'vitest'

import type { CaseResult } from './metrics.ts'
import { groupStats, renderSummary } from './report.ts'

function result(overrides: Partial<CaseResult>): CaseResult {
  return {
    caseId: 'c',
    taskId: 'sf-slugify',
    category: 'single-file',
    group: 'single',
    repeat: 1,
    passed: true,
    acceptExitCode: 0,
    acceptOutput: '',
    rootRunStatus: 'complete',
    timedOut: false,
    wallMs: 1000,
    planTasks: 0,
    plans: 0,
    dispatchCount: 0,
    failedDispatches: 0,
    questions: 0,
    bashApprovals: 0,
    tokens: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheCreationTokens: 0 },
    ...overrides,
  }
}

describe('groupStats', () => {
  it('computes pass count, median wall time and replans', () => {
    const stats = groupStats([
      result({ wallMs: 1000, plans: 1 }),
      result({ wallMs: 3000, passed: false, plans: 3 }),
      result({ wallMs: 2000, plans: 2 }),
    ])
    expect(stats).toMatchObject({ cases: 3, passed: 2, medianWallMs: 2000, meanTokens: 150, meanReplans: 1 })
  })
})

describe('renderSummary', () => {
  it('renders one column per group present and lists broken cases', () => {
    const md = renderSummary([
      result({ caseId: 'a', group: 'single' }),
      result({ caseId: 'b', group: 'orch-gate', passed: false, timedOut: true }),
    ])
    expect(md).toContain('| 题型 | single | orch-gate |')
    expect(md).toContain('| single-file | 100% (1/1) | 0% (0/1) |')
    expect(md).not.toContain('orch-nogate')
    expect(md).toContain('`b`：timed out')
  })
})
