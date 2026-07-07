import { describe, expect, it } from 'vitest'

import { resolveEmployeeRunCliMode } from './employee-run-cli-mode'

describe('employee run CLI mode', () => {
  it('executes CLI profiles only when the agent can run commands and autonomy allows safe execution', () => {
    expect(
      resolveEmployeeRunCliMode({
        autonomyPolicy: { level: 'execute_low_risk' },
        permissionPolicy: { commands: { run: true } },
      }),
    ).toBe('execute')

    expect(
      resolveEmployeeRunCliMode({
        autonomyPolicy: { level: 'fully_autonomous' },
        permissionPolicy: { canRunCommands: true },
      }),
    ).toBe('execute')
  })

  it('keeps CLI profiles in dry-run mode when command permission or autonomy is not open', () => {
    expect(
      resolveEmployeeRunCliMode({
        autonomyPolicy: { level: 'execute_low_risk' },
        permissionPolicy: { commands: { run: false } },
      }),
    ).toBe('dry_run')

    expect(
      resolveEmployeeRunCliMode({
        autonomyPolicy: { level: 'execute_with_approval' },
        permissionPolicy: { commands: { run: true } },
      }),
    ).toBe('dry_run')

    expect(
      resolveEmployeeRunCliMode({
        autonomyPolicy: { level: 'propose_only' },
        permissionPolicy: { commands: { run: true } },
      }),
    ).toBe('dry_run')
  })
})
