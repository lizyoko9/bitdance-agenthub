import {
  createWorkflow,
  getWorkflowRunSnapshot,
  startWorkflowRun,
} from '../src/server/control-plane-service'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function main() {
  const suffix = Math.random().toString(36).slice(2)
  const sourceNodeId = `smoke_artifact_source_${suffix}`
  const approvalNodeId = `smoke_artifact_approval_${suffix}`
  const workflow = await createWorkflow({
    name: 'Smoke Artifact Channel Workflow',
    status: 'active',
    nodes: [
      {
        id: sourceNodeId,
        type: 'artifact_transform',
        position: { x: 0, y: 0 },
        outputContract: {
          artifactType: 'code',
          outputs: [
            {
              key: 'code',
              type: 'code',
              label: '代码文件',
              description: '源代码或补丁',
              customerVisible: true,
            },
            {
              key: 'video',
              type: 'video',
              label: '视频成片',
              description: '客户验收的视频文件',
              customerVisible: true,
            },
          ],
        },
      },
      {
        id: approvalNodeId,
        type: 'human_approval',
        position: { x: 260, y: 0 },
        approvalPolicy: { required: true, riskLevel: 'low' },
      },
    ],
    edges: [
      {
        sourceNodeId,
        targetNodeId: approvalNodeId,
        sourceHandle: 'artifact:video',
        targetHandle: 'input',
        mapping: {
          handoffMode: 'fixed_artifact',
          outputKey: 'video',
          targetInputKey: 'video',
          artifactType: 'video',
          artifactOnly: true,
        },
      },
    ],
  })

  const run = await startWorkflowRun(workflow.id, { goal: 'Smoke artifact channel routing' })
  const snapshot = await getWorkflowRunSnapshot(run.id)
  const approvalRun = snapshot.nodeRuns.find((nodeRun) => nodeRun.nodeId === approvalNodeId)
  assert(approvalRun, 'Expected approval node run.')
  assert(approvalRun.status === 'paused', `Expected approval node to pause, got ${approvalRun.status}.`)

  const output = asRecord(approvalRun.output)
  const upstreamOutputs = asRecord(output.upstreamOutputs)
  const sourceInput = asRecord(upstreamOutputs[sourceNodeId])
  const selectedArtifact = asRecord(sourceInput.selectedArtifact)
  assert(sourceInput.outputKey === 'video', 'Expected downstream input to use video output key.')
  assert(sourceInput.artifactType === 'video', 'Expected downstream input to use video artifact type.')
  assert(sourceInput.artifactOnly === true, 'Expected downstream input to be artifact-only.')
  assert(selectedArtifact.outputKey === 'video', 'Expected selected artifact to be video.')
  assert(!('code' in sourceInput), 'Expected code output not to be passed through this edge.')

  console.log(JSON.stringify({
    workflowId: workflow.id,
    runId: run.id,
    routedOutputKey: sourceInput.outputKey,
    routedArtifactType: sourceInput.artifactType,
    approvalStatus: approvalRun.status,
  }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
