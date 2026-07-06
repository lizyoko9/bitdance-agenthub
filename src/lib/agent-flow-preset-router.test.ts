import { describe, expect, it } from 'vitest'

import { selectCanvasWorkflowPresetId } from './agent-flow-preset-router'

describe('agent flow preset router', () => {
  it('routes video and Jianying goals to the video delivery workflow', () => {
    expect(selectCanvasWorkflowPresetId('帮我做一个剪映短视频交付流程')).toBe('content-video')
    expect(selectCanvasWorkflowPresetId('客户要视频成片和素材处理')).toBe('content-video')
  })

  it('routes coding goals to the code delivery workflow', () => {
    expect(selectCanvasWorkflowPresetId('写一个桌面程序并交付源码')).toBe('code-delivery')
    expect(selectCanvasWorkflowPresetId('修复代码 bug 然后输出 diff')).toBe('code-delivery')
  })

  it('uses the report workflow as the safe default', () => {
    expect(selectCanvasWorkflowPresetId('整理一份客户调研结论')).toBe('report-delivery')
    expect(selectCanvasWorkflowPresetId('')).toBe('report-delivery')
  })
})
