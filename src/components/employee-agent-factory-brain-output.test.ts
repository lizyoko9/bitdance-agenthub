import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('employee agent factory brain output', () => {
  it('renders the employee brain output from the selected run', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/employee-agent-factory.tsx'), 'utf8')

    expect(source).toContain('EmployeeRuntimeBrainOutputCard')
    expect(source).toContain('employeeBrainFromRunOutput(selectedRun.output)')
    expect(source).toContain('大脑边界')
    expect(source).toContain('brain.memoryBoundary.privateScopeLabel')
    expect(source).toContain('brain.owner.label')
    expect(source).toContain('脑内上下文')
    expect(source).toContain('下次开工提示')
    expect(source).toContain('上下文缓存')
    expect(source).toContain('brain.contextCache')
    expect(source).toContain('brain.contextCache.stablePrefix')
    expect(source).toContain('brain.contextCache.byteLength')
    expect(source).toContain('逐字节复用')
    expect(source).not.toContain('PSM')
  })

  it('keeps selected run controls Chinese-first for desktop users', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/employee-agent-factory.tsx'), 'utf8')

    expect(source).toContain('title="已选运行"')
    expect(source).toContain('暂停')
    expect(source).toContain('继续')
    expect(source).toContain('停止')
    expect(source).toContain('还没有事件记录。')
    expect(source).toContain('选择一次运行后查看事件。')
    expect(source).not.toContain('title="Selected Run"')
    expect(source).not.toMatch(/>\s*Pause\s*</)
    expect(source).not.toMatch(/>\s*Resume\s*</)
    expect(source).not.toMatch(/>\s*Stop\s*</)
    expect(source).not.toContain('No events loaded.')
    expect(source).not.toContain('Select a run to inspect events.')
  })

  it('keeps run diagnostics readable in Chinese', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/employee-agent-factory.tsx'), 'utf8')

    expect(source).toContain('预算和审计')
    expect(source).toContain('安全审计')
    expect(source).toContain('恢复事件')
    expect(source).toContain('产物验证')
    expect(source).toContain('多模态输入输出')
    expect(source).toContain('学习建议')
    expect(source).toContain('运行复盘')
    expect(source).toContain('记忆写入')
    expect(source).toContain('本次运行没有电脑会话。')
    expect(source).toContain('本次运行没有上下文快照。')
    expect(source).toContain('拒绝')
    expect(source).toContain('发布')
    expect(source).not.toContain('Budget and audit')
    expect(source).not.toContain('Security audit')
    expect(source).not.toContain('Recovery events')
    expect(source).not.toContain('Artifact validations')
    expect(source).not.toContain('Multimodal IO')
    expect(source).not.toContain('Learning proposals')
    expect(source).not.toContain('Learning reflection')
    expect(source).not.toContain('Memory writes')
    expect(source).not.toMatch(/>\s*Reject\s*</)
    expect(source).not.toMatch(/>\s*Publish\s*</)
    expect(source).not.toContain('No security audit records for this run.')
    expect(source).not.toContain('No recovery events for this run.')
    expect(source).not.toContain('No artifact validations for this run.')
    expect(source).not.toContain('No multimodal IO registered for this run.')
    expect(source).not.toContain('No learning proposals for this run.')
    expect(source).not.toContain('No reflection written for this run.')
    expect(source).not.toContain('No memory writes for this run.')
    expect(source).not.toContain('No computer sessions for this run.')
    expect(source).not.toContain('No context snapshots for this run.')
  })

  it('renders CLI execution evidence from the selected run output', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/employee-agent-factory.tsx'), 'utf8')

    expect(source).toContain('EmployeeRunCliExecutionSummaryCard')
    expect(source).toContain('cliExecutionSummaryFromRunOutput(selectedRun.output)')
    expect(source).toContain('CLI 执行证据')
    expect(source).toContain('证据候选')
    expect(source).toContain('需要复核')
  })
})
