import { describe, expect, it } from 'vitest'

import { applyPreflightStatusToNodes } from './agent-flow-node-status'
import type { AgentFlowRunIssue } from './agent-flow-run-preflight'

const node = (id: string, status: 'idle' | 'running' | 'done' | 'blocked' = 'idle') => ({
  id,
  data: { title: id, status },
})

const issue = (
  code: AgentFlowRunIssue['code'],
  severity: AgentFlowRunIssue['severity'],
  nodeId?: string,
): AgentFlowRunIssue => ({
  code,
  severity,
  nodeId,
  message: `${code} message`,
})

describe('applyPreflightStatusToNodes', () => {
  it('marks nodes with preflight errors as blocked and leaves unrelated nodes idle', () => {
    const next = applyPreflightStatusToNodes({
      nodes: [node('input-1', 'done'), node('tool-1', 'done'), node('artifact-1', 'done')],
      edges: [{ source: 'input-1', target: 'tool-1' }],
      preflight: {
        ready: false,
        issues: [issue('software_command_missing', 'error', 'tool-1')],
      },
    })

    expect(next.map((item) => [item.id, item.data.status])).toEqual([
      ['input-1', 'idle'],
      ['tool-1', 'blocked'],
      ['artifact-1', 'idle'],
    ])
  })

  it('marks connected nodes as done after a passing preflight and leaves disconnected nodes idle', () => {
    const next = applyPreflightStatusToNodes({
      nodes: [node('input-1'), node('agent-1'), node('artifact-1'), node('scratch-1')],
      edges: [
        { source: 'input-1', target: 'agent-1' },
        { source: 'agent-1', target: 'artifact-1' },
      ],
      preflight: {
        ready: true,
        issues: [issue('node_disconnected', 'warning', 'scratch-1')],
      },
    })

    expect(next.map((item) => [item.id, item.data.status])).toEqual([
      ['input-1', 'done'],
      ['agent-1', 'done'],
      ['artifact-1', 'done'],
      ['scratch-1', 'idle'],
    ])
  })

  it('keeps node object data while only changing status', () => {
    const next = applyPreflightStatusToNodes({
      nodes: [{ id: 'agent-1', data: { title: 'Writer', status: 'running' as const, outputs: ['report'] } }],
      edges: [],
      preflight: {
        ready: false,
        issues: [issue('no_edges', 'error')],
      },
    })

    expect(next[0].data).toEqual({ title: 'Writer', status: 'idle', outputs: ['report'] })
  })
})
