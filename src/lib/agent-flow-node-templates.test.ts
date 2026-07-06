import { describe, expect, it } from 'vitest'

import {
  agentFlowNodeTemplates,
  cloneTemplatePorts,
  getAgentFlowNodeTemplateGroups,
  getAgentFlowNodeTemplate,
} from './agent-flow-node-templates'

describe('agentFlowNodeTemplates', () => {
  it('ships business-ready nodes with stable input and output ports', () => {
    expect(agentFlowNodeTemplates.map((template) => template.id)).toEqual([
      'customer-request',
      'prompt-template',
      'model-profile',
      'memory-context',
      'employee-agent',
      'software-command',
      'human-approval',
      'customer-deliverable',
      'video-deliverable',
      'image-deliverable',
      'code-deliverable',
      'file-bundle-deliverable',
    ])

    expect(getAgentFlowNodeTemplate('employee-agent')?.inputs.map((port) => [port.id, port.type])).toEqual([
      ['message', 'any'],
    ])
    expect(getAgentFlowNodeTemplate('employee-agent')?.outputs.map((port) => [port.id, port.type])).toEqual([
      ['report', 'report'],
    ])
    expect(getAgentFlowNodeTemplate('software-command')?.outputs.map((port) => port.type)).toContain('file_bundle')
    expect(getAgentFlowNodeTemplate('video-deliverable')?.inputs.map((port) => port.type)).toEqual(['video'])
    expect(getAgentFlowNodeTemplate('image-deliverable')?.inputs.map((port) => port.type)).toEqual(['image'])
    expect(getAgentFlowNodeTemplate('file-bundle-deliverable')?.inputs.map((port) => port.type)).toEqual(['file_bundle'])
  })

  it('groups canvas components by the same mental model as Langflow', () => {
    const groups = getAgentFlowNodeTemplateGroups(agentFlowNodeTemplates)

    expect(groups.map((group) => group.category)).toEqual([
      '输入',
      '提示词',
      '模型',
      '记忆',
      '智能体',
      '工具',
      '审批',
      '交付',
    ])
    expect(groups.find((group) => group.category === '模型')?.templates.map((template) => template.id)).toEqual([
      'model-profile',
    ])
    expect(groups.find((group) => group.category === '智能体')?.templates.map((template) => template.id)).toEqual([
      'employee-agent',
    ])
  })

  it('clones template ports so node edits do not mutate the reusable template', () => {
    const template = getAgentFlowNodeTemplate('employee-agent')
    expect(template).toBeTruthy()

    const ports = cloneTemplatePorts(template!.outputs)
    ports[0].label = 'edited'

    expect(template!.outputs[0].label).not.toBe('edited')
  })
})
