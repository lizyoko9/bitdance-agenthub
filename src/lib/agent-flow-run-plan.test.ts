import { describe, expect, it } from 'vitest'

import { buildAgentFlowRunPlan } from './agent-flow-run-plan'

describe('buildAgentFlowRunPlan', () => {
  it('orders nodes by dependency stage and attaches incoming and outgoing handoff contracts', () => {
    const plan = buildAgentFlowRunPlan({
      nodes: [
        { id: 'customer', data: { title: '客户输入', kind: 'input' } },
        { id: 'writer', data: { title: '写作 Agent', kind: 'agent' } },
        { id: 'delivery', data: { title: '交付物', kind: 'artifact' } },
      ],
      edges: [
        {
          id: 'customer-writer',
          source: 'customer',
          target: 'writer',
          data: { handoffContract: '消息: 客户需求 -> 任务输入' },
        },
        {
          id: 'writer-delivery',
          source: 'writer',
          target: 'delivery',
          data: { handoffContract: '报告: 写作报告 -> 客户交付' },
        },
      ],
    })

    expect(plan.map((step) => step.nodeId)).toEqual(['customer', 'writer', 'delivery'])
    expect(plan.map((step) => step.stage)).toEqual([1, 2, 3])
    expect(plan[1].incomingContracts).toEqual(['消息: 客户需求 -> 任务输入'])
    expect(plan[1].outgoingContracts).toEqual(['报告: 写作报告 -> 客户交付'])
    expect(plan[2].incomingContracts).toEqual(['报告: 写作报告 -> 客户交付'])
  })
})
