import { describe, expect, it } from 'vitest'

import type { CliRunRow } from '@/db/schema'

import { buildEmployeeRunCliExecutionSummary } from './employee-run-cli-execution-summary'

function cliRun(overrides: Partial<CliRunRow>): CliRunRow {
  return {
    id: 'cli_run_1',
    cliProfileId: 'cli_profile_1',
    agentProfileId: 'agent_1',
    employeeRunId: 'run_1',
    mode: 'dry_run',
    status: 'planned',
    command: 'node',
    renderedArgs: '-v',
    cwd: 'C:/agenthub/workspaces/run_1',
    envKeys: [],
    stdinPreview: null,
    output: {
      dryRun: true,
      commandLine: 'node -v',
    },
    error: null,
    requiresApproval: false,
    approvalRequestId: null,
    createdAt: 1,
    finishedAt: 2,
    ...overrides,
  }
}

describe('employee run cli execution summary', () => {
  it('turns cli runs into delivery evidence with execution counts and previews', () => {
    const summary = buildEmployeeRunCliExecutionSummary([
      cliRun({
        id: 'cli_success',
        cliProfileId: 'codex_cli',
        mode: 'execute',
        status: 'complete',
        command: 'codex',
        renderedArgs: 'exec --json',
        output: {
          commandRunner: 'agenthub',
          commandLine: 'codex exec --json',
          exitCode: 0,
          stdout: 'created file: D:/AgentHub/output/report.md\nall checks passed',
          stderr: '',
          timedOut: false,
        },
      }),
      cliRun({
        id: 'cli_failed',
        cliProfileId: 'video_cli',
        mode: 'execute',
        status: 'failed',
        command: 'jianying-cli',
        renderedArgs: 'export draft',
        output: {
          commandRunner: 'agenthub',
          commandLine: 'jianying-cli export draft',
          exitCode: 2,
          stdout: '',
          stderr: 'draft path missing',
          timedOut: false,
        },
        error: 'draft path missing',
      }),
      cliRun({
        id: 'cli_blocked',
        cliProfileId: 'wechat_cli',
        mode: 'execute',
        status: 'blocked',
        command: 'wechat-cli',
        renderedArgs: 'send',
        output: null,
        error: 'CLI execution is waiting for approval.',
        requiresApproval: true,
        approvalRequestId: 'approval_1',
      }),
    ])

    expect(summary).toMatchObject({
      title: 'CLI 执行证据',
      total: 3,
      counts: {
        planned: 0,
        executed: 2,
        completed: 1,
        failed: 1,
        blocked: 1,
      },
      hasExecutableEvidence: true,
      needsReview: true,
      evidenceCandidates: [
        {
          cliRunId: 'cli_success',
          cliProfileId: 'codex_cli',
          status: 'complete',
          commandLine: 'codex exec --json',
          preview: 'created file: D:/AgentHub/output/report.md\nall checks passed',
        },
      ],
      issues: [
        {
          cliRunId: 'cli_failed',
          status: 'failed',
          message: 'draft path missing',
        },
        {
          cliRunId: 'cli_blocked',
          status: 'blocked',
          message: 'CLI execution is waiting for approval.',
        },
      ],
    })
  })
})
