import { describe, expect, it } from 'vitest'

import {
  buildPortCompatibilityHint,
  canConnectPortKinds,
  summarizeNodePorts,
  type LangflowPortKind,
} from './langflow-port-contracts'

describe('langflow port contracts', () => {
  it('only allows edges between the same artifact kind', () => {
    expect(canConnectPortKinds('video', 'video')).toBe(true)
    expect(canConnectPortKinds('code', 'code')).toBe(true)
    expect(canConnectPortKinds('video', 'code')).toBe(false)
    expect(canConnectPortKinds(null, 'code')).toBe(false)
  })

  it('explains why a connection can or cannot be made', () => {
    expect(buildPortCompatibilityHint('image', 'image')).toContain('可以连接')
    expect(buildPortCompatibilityHint('image', 'document')).toContain('只能连接同类型产物')
  })

  it('summarizes node input and output ports for the inspector', () => {
    const inputs: LangflowPortKind[] = ['document', 'video']
    const outputs: LangflowPortKind[] = ['report', 'file_bundle', 'code']

    expect(summarizeNodePorts(inputs, outputs)).toEqual({
      inputCount: 2,
      outputCount: 3,
      accepts: '文档、视频',
      produces: '报告、文件包、代码',
    })
  })
})
