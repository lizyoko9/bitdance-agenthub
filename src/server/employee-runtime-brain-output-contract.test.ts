import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('employee runtime brain output contract', () => {
  it('writes employee brain context and learning summaries into run output', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/server/employee-runtime-service.ts'), 'utf8')

    expect(source).toContain('buildEmployeeRuntimeBrainOutput')
    expect(source).toContain('memoryContextPack: AgentMemoryContextPack | null')
    expect(source).toContain('context.memoryContextPack = compileRuntimeMemoryContextPack')
    expect(source).toContain('employeeBrain: buildEmployeeRuntimeBrainOutput({')
    expect(source).toContain('agentName: agent.name')
    expect(source).toContain('role: agent.role')
    expect(source).toContain("recordEmployeeEvent(runId, 'phase', 'employee_brain'")
    expect(source).not.toContain('PSM')
  })

  it('writes CLI execution evidence into run output', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/server/employee-runtime-service.ts'), 'utf8')

    expect(source).toContain('buildEmployeeRunCliExecutionSummary')
    expect(source).toContain('const cliExecutionSummary = buildEmployeeRunCliExecutionSummary(cliRuns)')
    expect(source).toContain('cliExecutionSummary: cliExecutionSummary as unknown as JsonObject')
    expect(source).toContain("'cli_execution_summary'")
  })
})
