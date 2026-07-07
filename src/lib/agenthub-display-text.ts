const EXACT_TEXT_MAP: Record<string, string> = {
  'Runtime lifecycle complete': '运行流程已完成',
  'Understanding goal and constraints': '正在理解目标和约束',
  'Employee run was queued with scoped Agent profile permissions.': '员工任务已进入队列，并按权限范围准备执行。',
  'Employee run completed deterministic lifecycle.': '员工运行流程已完成。',
  'Output contract validation completed.': '交付物要求校验已完成。',
  'Runtime reflection and memory write completed.': '反思学习和记忆写入已完成。',
  'Agent diary and continuation plan were saved.': '员工工作记录和续办计划已保存。',
  'Paused by user': '用户已暂停',
  'Canceled by user': '用户已取消',
  'Fixes bugs and prepares code patches.': '修复问题并准备代码补丁。',
  'Fixes bugs and prepares patches.': '修复问题并准备补丁。',
  'Analyzes GitHub issues and classifies bug or feature requests.': '分析 GitHub 议题，判断是问题修复还是功能需求。',
  'Analyzes GitHub issues, code changes, and bug reports.': '分析 GitHub 议题、代码变更和问题报告。',
  'Frontend Developer preset for the Agent employee factory.': '前端工程师员工模板，可用于创建前端开发员工。',
  '主 Agent 协调器。理解用户意图，拆解任务，分派给合适的 Agent，并聚合结果。': '主协调智能体。理解用户意图，拆解任务，分派给合适的智能体，并聚合结果。',
  queued: '等待分配',
  running: '正在执行',
  complete: '已完成',
  failed: '失败',
  aborted: '已停止',
  paused: '已暂停',
  understand_goal: '理解目标',
  retrieve_memory: '检索记忆',
  create_plan: '制定计划',
  execute_action: '调用工具',
  verify_result: '验证结果',
  produce_artifact: '生成产物',
  reflect: '总结学习',
  artifact_validation: '产物校验',
  reflect_and_learn: '反思学习',
  continuity_saved: '续办计划已保存',
  verification: '验证结果',
  phase: '运行阶段',
  budget: '预算检查',
}

const GENERATED_AGENT_NAME_PATTERNS: Array<[RegExp, string]> = [
  [/^Orchestrator$/i, '任务协调员'],
  [/^Reviewer$/i, '审查员'],
  [/^UI Designer$/i, 'UI 设计师'],
  [/^API Bug Fix(?: Employee)?\s*(.*)$/i, '接口修复员工'],
  [/^API Code Analysis(?: Employee)?\s*(.*)$/i, '接口代码分析员工'],
  [/^API Frontend Template Employee\s*(.*)$/i, '前端模板员工'],
  [/^Frontend Template Employee\s*(.*)$/i, '前端模板员工'],
  [/^Frontend Developer\s*(.*)$/i, '前端工程师'],
  [/^Backend Developer\s*(.*)$/i, '后端工程师'],
  [/^Full-stack Developer\s*(.*)$/i, '全栈工程师'],
  [/^Code Reviewer\s*(.*)$/i, '代码审查员'],
]

export function localizeAgentHubDisplayText(value: string | null | undefined, fallback = ''): string {
  const text = value?.trim() ?? ''
  if (!text) return fallback
  const exact = EXACT_TEXT_MAP[text]
  if (exact) return exact

  const presetMatch = text.match(/^(.+?) preset for the Agent employee factory\.$/i)
  if (presetMatch?.[1]) {
    return `${localizeGeneratedAgentProfileName(presetMatch[1])}员工模板，可用于创建对应岗位员工。`
  }

  return localizeGeneratedRoleTokens(text)
}

export function localizeGeneratedAgentProfileName(value: string | null | undefined, fallback = '未命名员工'): string {
  const text = value?.trim() ?? ''
  if (!text) return fallback
  for (const [pattern, label] of GENERATED_AGENT_NAME_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      const suffix = match[1]?.trim()
      return suffix ? `${label} ${suffix}` : label
    }
  }
  return text
}

export function localizeGeneratedConversationTitle(value: string | null | undefined, fallback = '未命名会话'): string {
  const text = value?.trim() ?? ''
  if (!text) return fallback

  const direct = localizeAgentHubDisplayText(text, text)
  if (direct !== text) return direct

  return text
    .split(' / ')
    .map((part) => localizeConversationTitlePart(part))
    .join(' / ')
}

function localizeConversationTitlePart(part: string): string {
  return localizeGeneratedRoleTokens(part)
}

function localizeGeneratedRoleTokens(text: string): string {
  return text.replace(/\b(?:Orchestrator|Reviewer|UI Designer)\b/g, (name) =>
    localizeGeneratedAgentProfileName(name),
  )
}
