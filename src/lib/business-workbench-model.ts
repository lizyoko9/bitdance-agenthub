export type BusinessWorkbenchKind =
  | 'content_production'
  | 'customer_communication'
  | 'project_development'
  | 'data_operations'
  | 'general_business'

export type BusinessWorkbenchProfile = {
  kind: BusinessWorkbenchKind
  name: string
  signal: string
  focus: string
}

const businessProfiles: BusinessWorkbenchProfile[] = [
  {
    kind: 'content_production',
    name: '内容生产工作台',
    signal: '视频、素材、剪辑和交付结果优先',
    focus: '先看素材、草稿、导出结果和卡点',
  },
  {
    kind: 'customer_communication',
    name: '客户沟通工作台',
    signal: '客户消息、跟进任务和人工确认优先',
    focus: '先看沟通状态、待回复对象和交付证明',
  },
  {
    kind: 'project_development',
    name: '项目研发工作台',
    signal: '代码任务、测试结果和部署产物优先',
    focus: '先看失败原因、修改进度、测试和可预览结果',
  },
  {
    kind: 'data_operations',
    name: '数据运营工作台',
    signal: '指标、表格、报告和异常提醒优先',
    focus: '先看关键数字、异常项和下一步动作',
  },
  {
    kind: 'general_business',
    name: '综合业务工作台',
    signal: '根据会话、任务和运行记录自动决定展示内容',
    focus: '先看任务状态、关键结果和下一步',
  },
]

export function inferBusinessWorkbenchProfile(corpus: string): BusinessWorkbenchProfile {
  const normalized = corpus.toLowerCase()

  if (/剪映|视频|capcut|素材|脚本|剪辑|抖音|短视频|movie|film/.test(normalized)) {
    return businessProfiles[0]
  }

  if (/微信|客户|销售|私域|客服|飞书|notion|消息|群|联系人/.test(normalized)) {
    return businessProfiles[1]
  }

  if (/代码|项目|修复|bug|github|codex|claude|opencode|仓库|测试|部署|前端/.test(normalized)) {
    return businessProfiles[2]
  }

  if (/数据|表格|报表|分析|指标|运营|订单|财务/.test(normalized)) {
    return businessProfiles[3]
  }

  return businessProfiles[4]
}
