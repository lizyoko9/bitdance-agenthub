import { describe, expect, it } from 'vitest'

import {
  localizeAgentHubDisplayText,
  localizeGeneratedConversationTitle,
  localizeGeneratedAgentProfileName,
} from '@/lib/agenthub-display-text'

describe('agenthub display text localization', () => {
  it('localizes old generated runtime event copy before rendering it to users', () => {
    expect(localizeAgentHubDisplayText('Runtime lifecycle complete')).toBe('运行流程已完成')
    expect(localizeAgentHubDisplayText('Agent diary and continuation plan were saved.')).toBe('员工工作记录和续办计划已保存。')
    expect(localizeAgentHubDisplayText('Output contract validation completed.')).toBe('交付物要求校验已完成。')
    expect(localizeAgentHubDisplayText('continuity_saved')).toBe('续办计划已保存')
  })

  it('localizes generated agent template names and descriptions without hiding user text', () => {
    expect(localizeGeneratedAgentProfileName('API Bug Fix 1782007076692')).toBe('接口修复员工 1782007076692')
    expect(localizeGeneratedAgentProfileName('API Frontend Template Employee 1782000541090')).toBe('前端模板员工 1782000541090')
    expect(localizeGeneratedAgentProfileName('PM 小灰')).toBe('PM 小灰')
    expect(localizeAgentHubDisplayText('Fixes bugs and prepares code patches.')).toBe('修复问题并准备代码补丁。')
    expect(localizeAgentHubDisplayText('Frontend Developer preset for the Agent employee factory.')).toBe('前端工程师员工模板，可用于创建前端开发员工。')
  })

  it('localizes default role names inside summaries and historical conversation titles', () => {
    expect(localizeGeneratedAgentProfileName('Orchestrator')).toBe('任务协调员')
    expect(localizeGeneratedAgentProfileName('Reviewer')).toBe('审查员')
    expect(localizeAgentHubDisplayText('主 Agent 协调器。理解用户意图，拆解任务，分派给合适的 Agent，并聚合结果。')).toBe(
      '主协调智能体。理解用户意图，拆解任务，分派给合适的智能体，并聚合结果。',
    )
    expect(localizeGeneratedConversationTitle('Orchestrator / PM 小灰 / UI 设计师 / 前端工程师 / Reviewer')).toBe(
      '任务协调员 / PM 小灰 / UI 设计师 / 前端工程师 / 审查员',
    )
    expect(localizeGeneratedConversationTitle('与 Reviewer 的对话')).toBe('与 审查员 的对话')
    expect(localizeAgentHubDisplayText('Reviewer 的对话执行')).toBe('审查员 的对话执行')
  })
})
