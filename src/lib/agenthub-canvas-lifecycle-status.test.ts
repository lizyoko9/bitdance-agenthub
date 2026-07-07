import { describe, expect, it } from 'vitest'

import { deriveCanvasLifecycleStatus } from './agenthub-canvas-lifecycle-status'

describe('agenthub canvas lifecycle status', () => {
  it('asks the user to complete capabilities when preflight has blocking errors', () => {
    const status = deriveCanvasLifecycleStatus({
      preflight: {
        ready: false,
        errorCount: 2,
        warningCount: 1,
        connectedNodeCount: 1,
        disconnectedNodeCount: 1,
        issues: [],
      },
      hasRun: false,
    })

    expect(status.state).toBe('needs_capability')
    expect(status.phaseLabel).toBe('运行前检查')
    expect(status.statusLabel).toBe('需补能力')
    expect(status.detail).toBe('2 个阻塞 · 1 个提醒')
  })

  it('marks a clean draft as ready for a local dry run', () => {
    const status = deriveCanvasLifecycleStatus({
      preflight: {
        ready: true,
        errorCount: 0,
        warningCount: 0,
        connectedNodeCount: 3,
        disconnectedNodeCount: 0,
        issues: [],
      },
      hasRun: false,
    })

    expect(status.state).toBe('ready_to_run')
    expect(status.statusLabel).toBe('可试运行')
    expect(status.detail).toBe('能力已补齐')
  })

  it('surfaces observed status after a local dry run exists', () => {
    const status = deriveCanvasLifecycleStatus({
      preflight: {
        ready: true,
        errorCount: 0,
        warningCount: 0,
        connectedNodeCount: 3,
        disconnectedNodeCount: 0,
        issues: [],
      },
      hasRun: true,
    })

    expect(status.state).toBe('observed')
    expect(status.statusLabel).toBe('已试运行')
    expect(status.detail).toBe('可查看运行结果')
  })

  it('uses lifecycle report blockers before the local preflight state', () => {
    const status = deriveCanvasLifecycleStatus({
      preflight: {
        ready: true,
        errorCount: 0,
        warningCount: 0,
        connectedNodeCount: 3,
        disconnectedNodeCount: 0,
        issues: [],
      },
      hasRun: false,
      lifecycleReport: {
        status: 'blocked',
        blockers: ['Missing required cli: Codex CLI'],
        warnings: [],
        evalPassed: 0,
        evalTotal: 0,
      },
    })

    expect(status.state).toBe('needs_capability')
    expect(status.statusLabel).toBe('需补能力')
    expect(status.detail).toBe('1 个能力缺口')
  })

  it('shows lifecycle eval progress when the flow is configured but not trusted yet', () => {
    const status = deriveCanvasLifecycleStatus({
      preflight: {
        ready: true,
        errorCount: 0,
        warningCount: 0,
        connectedNodeCount: 3,
        disconnectedNodeCount: 0,
        issues: [],
      },
      hasRun: false,
      lifecycleReport: {
        status: 'needs_eval',
        blockers: [],
        warnings: [],
        evalPassed: 1,
        evalTotal: 3,
      },
    })

    expect(status.state).toBe('ready_to_run')
    expect(status.statusLabel).toBe('待评测')
    expect(status.detail).toBe('评测 1/3 通过')
  })
})
