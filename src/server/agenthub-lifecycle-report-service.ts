import type { AgentHubLifecycleManifest } from '@/lib/agenthub-lifecycle-types'

import type { AgentHubCapabilityReadinessReport } from './agenthub-capability-readiness-service'
import type { AgentHubEvalResult } from './agenthub-eval-service'

export type AgentHubLifecycleReportStatus = 'blocked' | 'needs_eval' | 'ready'

export type AgentHubLifecycleReport = {
  manifestId: string
  workflowId?: string
  status: AgentHubLifecycleReportStatus
  summary: string
  blockers: string[]
  warnings: string[]
  evalPassed: number
  evalTotal: number
}

export type BuildLifecycleReportInput = {
  manifest: AgentHubLifecycleManifest
  readiness: AgentHubCapabilityReadinessReport
  evalResults: AgentHubEvalResult[]
}

export function buildLifecycleReport(input: BuildLifecycleReportInput): AgentHubLifecycleReport {
  const evalPassed = input.evalResults.filter((result) => result.passed).length
  const evalTotal = input.evalResults.length

  if (!input.readiness.ready) {
    return {
      manifestId: input.manifest.id,
      workflowId: input.manifest.workflowId,
      status: 'blocked',
      summary: `${input.manifest.name} is blocked by ${input.readiness.blockers.length} missing capability.`,
      blockers: input.readiness.blockers,
      warnings: input.readiness.warnings,
      evalPassed,
      evalTotal,
    }
  }

  if (evalTotal === 0 || evalPassed < evalTotal) {
    return {
      manifestId: input.manifest.id,
      workflowId: input.manifest.workflowId,
      status: 'needs_eval',
      summary: `${input.manifest.name} needs eval before it is trusted.`,
      blockers: [],
      warnings: input.readiness.warnings,
      evalPassed,
      evalTotal,
    }
  }

  return {
    manifestId: input.manifest.id,
    workflowId: input.manifest.workflowId,
    status: 'ready',
    summary: `${input.manifest.name} is ready. ${evalPassed}/${evalTotal} eval cases passed.`,
    blockers: [],
    warnings: input.readiness.warnings,
    evalPassed,
    evalTotal,
  }
}
