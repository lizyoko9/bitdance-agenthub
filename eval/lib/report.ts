import { TASK_CATEGORIES } from './fixtures.ts'
import { EVAL_GROUPS, type CaseResult } from './metrics.ts'

interface GroupStats {
  cases: number
  passed: number
  medianWallMs: number
  meanTokens: number
  meanDispatches: number
  meanFailedDispatches: number
  meanReplans: number
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
}

export function totalTokens(result: CaseResult): number {
  return result.tokens.inputTokens + result.tokens.outputTokens
}

export function groupStats(results: CaseResult[]): GroupStats {
  return {
    cases: results.length,
    passed: results.filter((r) => r.passed).length,
    medianWallMs: median(results.map((r) => r.wallMs)),
    meanTokens: mean(results.map(totalTokens)),
    meanDispatches: mean(results.map((r) => r.dispatchCount)),
    meanFailedDispatches: mean(results.map((r) => r.failedDispatches)),
    // 第一次 dispatch.plan 是初始计划，之后每一次都是一轮 replan
    meanReplans: mean(results.map((r) => Math.max(0, r.plans - 1))),
  }
}

const pct = (passed: number, cases: number) => (cases === 0 ? '—' : `${((passed / cases) * 100).toFixed(0)}% (${passed}/${cases})`)
const fixed = (n: number, digits = 1) => n.toFixed(digits)

export function renderSummary(results: CaseResult[]): string {
  const groups = EVAL_GROUPS.filter((g) => results.some((r) => r.group === g))
  const byGroup = (group: string) => results.filter((r) => r.group === group)
  const lines: string[] = ['# AgentHub Eval Summary', '', `共 ${results.length} 个用例。token = input + output（不含缓存）。`, '']

  lines.push('## 总览', '')
  lines.push('| 组 | 通过率 | 中位耗时 (s) | 平均 token | 平均派发 | 平均失败派发 | 平均 replan |')
  lines.push('|---|---|---|---|---|---|---|')
  for (const group of groups) {
    const s = groupStats(byGroup(group))
    lines.push(
      `| ${group} | ${pct(s.passed, s.cases)} | ${fixed(s.medianWallMs / 1000)} | ${Math.round(s.meanTokens)} | ${fixed(s.meanDispatches)} | ${fixed(s.meanFailedDispatches)} | ${fixed(s.meanReplans)} |`,
    )
  }

  lines.push('', '## 按题型通过率', '')
  lines.push(`| 题型 | ${groups.join(' | ')} |`)
  lines.push(`|---|${groups.map(() => '---').join('|')}|`)
  for (const category of TASK_CATEGORIES) {
    const cells = groups.map((group) => {
      const s = groupStats(byGroup(group).filter((r) => r.category === category))
      return pct(s.passed, s.cases)
    })
    if (cells.every((c) => c === '—')) continue
    lines.push(`| ${category} | ${cells.join(' | ')} |`)
  }

  const taskIds = [...new Set(results.map((r) => r.taskId))].sort()
  lines.push('', '## 按题目通过次数', '')
  lines.push(`| 题目 | ${groups.join(' | ')} |`)
  lines.push(`|---|${groups.map(() => '---').join('|')}|`)
  for (const taskId of taskIds) {
    const cells = groups.map((group) => {
      const rows = byGroup(group).filter((r) => r.taskId === taskId)
      return rows.length === 0 ? '—' : `${rows.filter((r) => r.passed).length}/${rows.length}`
    })
    lines.push(`| ${taskId} | ${cells.join(' | ')} |`)
  }

  const broken = results.filter((r) => r.error || r.timedOut || r.rootRunStatus !== 'complete')
  if (broken.length > 0) {
    lines.push('', '## 异常用例', '')
    for (const r of broken) {
      const reason = r.error ?? (r.timedOut ? 'timed out' : `root run ${r.rootRunStatus}`)
      lines.push(`- \`${r.caseId}\`：${reason}`)
    }
  }

  return lines.join('\n') + '\n'
}
