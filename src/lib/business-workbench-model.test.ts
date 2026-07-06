import { describe, expect, it } from 'vitest'

import { inferBusinessWorkbenchProfile } from './business-workbench-model'

describe('business workbench model', () => {
  it('recognizes content production work', () => {
    expect(inferBusinessWorkbenchProfile('剪映 视频 素材 CapCut').name).toBe('内容生产工作台')
  })

  it('recognizes customer communication work', () => {
    expect(inferBusinessWorkbenchProfile('微信 客户 消息 跟进').name).toBe('客户沟通工作台')
  })

  it('recognizes project development work', () => {
    expect(inferBusinessWorkbenchProfile('代码 GitHub bug 测试 部署').name).toBe('项目研发工作台')
  })

  it('recognizes data operations work', () => {
    expect(inferBusinessWorkbenchProfile('数据 表格 报表 指标 运营').name).toBe('数据运营工作台')
  })

  it('falls back to a general business workbench', () => {
    expect(inferBusinessWorkbenchProfile('安排今天的任务').name).toBe('综合业务工作台')
  })
})
