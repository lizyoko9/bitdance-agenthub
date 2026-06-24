import { NextRequest } from 'next/server'

import { GET as getCanvasReport } from '../src/app/api/workflows/[id]/canvas-report/route'
import { GET as getAudit } from '../src/app/api/implementation-audit/route'
import {
  createAgentProfile,
  createWorkflow,
} from '../src/server/control-plane-service'

async function readJson(response: Response) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }
  return response.json()
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const researcher = await createAgentProfile({
    name: 'Smoke Canvas Researcher',
    role: 'Researcher',
    workstationPolicy: { mode: 'browser_context' },
    permissionPolicy: { canUseBrowser: true, canUseNetwork: true },
    outputContract: {
      artifactType: 'report',
      requiredFiles: ['research.md'],
      validationRules: ['includes evidence'],
    },
    successCriteria: ['Research report is complete.'],
    status: 'active',
  })
  const writer = await createAgentProfile({
    name: 'Smoke Canvas Writer',
    role: 'Writer',
    workstationPolicy: { mode: 'browser_context' },
    permissionPolicy: { canReadFiles: true, canWriteFiles: true },
    outputContract: {
      artifactType: 'document',
      requiredFiles: ['draft.md'],
      validationRules: ['uses research'],
    },
    successCriteria: ['Draft is complete.'],
    status: 'active',
  })

  const suffix = Math.random().toString(36).slice(2)
  const researchNodeId = `smoke_canvas_research_${suffix}`
  const approvalNodeId = `smoke_canvas_approval_${suffix}`
  const writerNodeId = `smoke_canvas_writer_${suffix}`
  const workflow = await createWorkflow({
    name: 'Smoke Canvas Workflow',
    status: 'active',
    nodes: [
      {
        id: researchNodeId,
        type: 'agent_employee',
        agentProfileId: researcher.id,
        position: { x: 0, y: 0 },
        inputMapping: { brief: '$workflow.input.brief' },
      },
      {
        id: approvalNodeId,
        type: 'human_approval',
        position: { x: 260, y: 0 },
        inputMapping: { report: `$nodes.${researchNodeId}.output` },
        approvalPolicy: { requiresApproval: true },
      },
      {
        id: writerNodeId,
        type: 'agent_employee',
        agentProfileId: writer.id,
        position: { x: 520, y: 0 },
        inputMapping: { approvedReport: `$nodes.${approvalNodeId}.output` },
      },
    ],
    edges: [
      {
        sourceNodeId: researchNodeId,
        targetNodeId: approvalNodeId,
        sourceHandle: 'artifact:artifact',
        targetHandle: 'input',
        mapping: {
          report: 'artifact',
          outputKey: 'artifact',
          targetInputKey: 'report',
          artifactType: 'report',
          artifactOnly: true,
        },
      },
      {
        sourceNodeId: approvalNodeId,
        targetNodeId: writerNodeId,
        sourceHandle: 'artifact:artifact',
        targetHandle: 'input',
        mapping: {
          approvedReport: 'approval.output',
          outputKey: 'artifact',
          targetInputKey: 'approvedReport',
          artifactType: 'approval_decision',
          artifactOnly: true,
        },
      },
    ],
  })

  const canvasPayload = await readJson(
    await getCanvasReport(
      new NextRequest(`http://local/api/workflows/${workflow.id}/canvas-report`),
      { params: Promise.resolve({ id: workflow.id }) },
    ),
  )
  const audit = await readJson(await getAudit())

  assert(canvasPayload.report.readiness === 'ready', 'Expected ready Canvas report.')
  assert(canvasPayload.report.summary.agentNodeCount === 2, 'Expected two Agent nodes.')
  assert(canvasPayload.report.summary.approvalNodeCount === 1, 'Expected one approval node.')
  assert(canvasPayload.report.executionPlan.orderedNodeIds.join(',') === [
    researchNodeId,
    approvalNodeId,
    writerNodeId,
  ].join(','), 'Expected deterministic node order.')
  assert(
    canvasPayload.report.artifactFlow.some(
      (row: { sourceNodeId: string; targetNodeId: string; artifactType: string | null }) =>
        row.sourceNodeId === researchNodeId &&
        row.targetNodeId === approvalNodeId &&
        row.artifactType === 'report',
    ),
    'Expected research artifact flow.',
  )
  assert(
    canvasPayload.report.artifactFlow.some(
      (row: { sourceNodeId: string; targetNodeId: string; mappingKeys: string[] }) =>
        row.sourceNodeId === researchNodeId &&
        row.targetNodeId === approvalNodeId &&
        row.mappingKeys.includes('outputKey') &&
        row.mappingKeys.includes('artifactType'),
    ),
    'Expected artifact-channel mapping keys.',
  )
  assert(
    audit.summary.implementedBaselineSections === 210 &&
      audit.summary.partialSections === 0 &&
      audit.summary.pendingSections === 0,
    `Unexpected audit summary: ${JSON.stringify(audit.summary)}`,
  )
  assert(
    audit.sections.find((section: { sectionNumber: number }) => section.sectionNumber === 13)
      ?.implementationStatus === 'baseline_plus',
    'Expected section 13 to be promoted.',
  )

  console.log(JSON.stringify({
    workflowId: workflow.id,
    readiness: canvasPayload.report.readiness,
    orderedNodeIds: canvasPayload.report.executionPlan.orderedNodeIds,
    artifactFlowCount: canvasPayload.report.artifactFlow.length,
    auditSummary: audit.summary,
  }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
