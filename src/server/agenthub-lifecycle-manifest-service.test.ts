import { describe, expect, it } from 'vitest'

import { createLifecycleManifest, deriveLifecycleManifestFromWorkflow } from './agenthub-lifecycle-manifest-service'

describe('agenthub lifecycle manifest service', () => {
  it('creates a local manifest from explicit inputs', () => {
    const manifest = createLifecycleManifest({
      name: 'Customer delivery workflow',
      workflowId: 'wf_1',
      agentIds: ['agent_writer'],
      capabilityRefs: [{ kind: 'cli', id: 'cli_codex', name: 'Codex CLI', required: true }],
      evalCases: [],
      now: '2026-07-06T00:00:00.000Z',
    })

    expect(manifest.name).toBe('Customer delivery workflow')
    expect(manifest.currentPhase).toBe('spec')
    expect(manifest.workflowId).toBe('wf_1')
    expect(manifest.agentIds).toEqual(['agent_writer'])
    expect(manifest.capabilityRefs).toHaveLength(1)
  })

  it('derives capabilities from workflow nodes without adding extra UI modules', () => {
    const manifest = deriveLifecycleManifestFromWorkflow({
      workflow: { id: 'wf_canvas', name: 'Canvas Flow' },
      nodes: [
        { id: 'node_agent', type: 'agent_employee', agentProfileId: 'agent_pm', label: 'PM Agent' },
        { id: 'node_cli', type: 'cli_command', cliProfileId: 'cli_codex', label: 'Codex CLI' },
      ],
      now: '2026-07-06T00:00:00.000Z',
    })

    expect(manifest.workflowId).toBe('wf_canvas')
    expect(manifest.agentIds).toEqual(['agent_pm'])
    expect(manifest.capabilityRefs).toEqual([
      { kind: 'agent', id: 'agent_pm', name: 'PM Agent', required: true },
      { kind: 'cli', id: 'cli_codex', name: 'Codex CLI', required: true },
    ])
  })
})
