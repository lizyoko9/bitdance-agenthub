import { describe, expect, it } from 'vitest'

import { buildWorkflowNodeBrainStatuses } from './workflow-node-brain-status'

describe('workflow node brain status', () => {
  it('maps employee run learning evidence back to the workflow node run output', () => {
    const statuses = buildWorkflowNodeBrainStatuses({
      nodeRuns: [
        {
          id: 'node_run_1',
          nodeId: 'node_clip',
          output: { employeeRunId: 'employee_run_1' },
        },
      ],
      employeeRuns: [
        {
          id: 'employee_run_1',
        },
      ],
      reflections: [
        {
          runId: 'employee_run_1',
          whatFailed: ['导出路径不存在'],
        },
      ],
      memories: [
        {
          sourceRunId: 'employee_run_1',
          type: 'mistake',
        },
      ],
      learningEvents: [
        {
          runId: 'employee_run_1',
          status: 'pending_review',
        },
      ],
    })

    expect(statuses).toEqual([
      {
        nodeRunId: 'node_run_1',
        nodeId: 'node_clip',
        employeeRunId: 'employee_run_1',
        status: 'failure_lesson',
        label: '有失败教训',
      },
    ])
  })

  it('keeps non-agent node runs explicit instead of pretending they learned', () => {
    const statuses = buildWorkflowNodeBrainStatuses({
      nodeRuns: [{ id: 'node_run_2', nodeId: 'node_gate', output: {} }],
      employeeRuns: [],
      reflections: [],
      memories: [],
      learningEvents: [],
    })

    expect(statuses).toEqual([
      {
        nodeRunId: 'node_run_2',
        nodeId: 'node_gate',
        employeeRunId: null,
        status: 'not_applicable',
        label: '无员工运行',
      },
    ])
  })
})
