import { describe, expect, it } from 'vitest'

import {
  agentFlowNodeTemplates,
  cloneTemplatePorts,
  getAgentFlowNodeTemplate,
} from './agent-flow-node-templates'

describe('agentFlowNodeTemplates', () => {
  it('ships business-ready nodes with stable input and output ports', () => {
    expect(agentFlowNodeTemplates.map((template) => template.id)).toEqual([
      'customer-request',
      'employee-agent',
      'software-command',
      'human-approval',
      'customer-deliverable',
    ])

    expect(getAgentFlowNodeTemplate('employee-agent')?.outputs.map((port) => port.type)).toEqual([
      'report',
      'code',
      'document',
    ])
    expect(getAgentFlowNodeTemplate('software-command')?.outputs.map((port) => port.type)).toContain('file_bundle')
  })

  it('clones template ports so node edits do not mutate the reusable template', () => {
    const template = getAgentFlowNodeTemplate('employee-agent')
    expect(template).toBeTruthy()

    const ports = cloneTemplatePorts(template!.outputs)
    ports[0].label = 'edited'

    expect(template!.outputs[0].label).not.toBe('edited')
  })
})
