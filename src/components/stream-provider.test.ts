import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PendingSkillInstall } from '@/shared/types'
import { useAppStore } from '@/stores/app-store'

const api = vi.hoisted(() => ({
  fetchConversations: vi.fn(async () => []),
  fetchMessagesSnapshot: vi.fn(async () => ({ messages: [], eventId: 'boot-10' })),
  fetchPendingWrites: vi.fn(async () => []),
  fetchPendingBashCommands: vi.fn(async () => []),
  fetchPendingQuestions: vi.fn(async () => []),
  fetchPendingDispatchPlans: vi.fn(async () => []),
  fetchPendingSkillInstalls: vi.fn<() => Promise<PendingSkillInstall[]>>(async () => []),
}))

vi.mock('@/lib/api', () => api)

import { resyncFromSnapshot } from './stream-provider'

const pending: PendingSkillInstall = {
  id: 'psi_missed',
  conversationId: 'conv_1',
  agentId: 'ag_1',
  runId: 'run_1',
  sourceUrl: 'https://github.com/example/skills/blob/main/SKILL.md',
  name: 'Review',
  description: 'Review changes',
  category: 'imported',
  instruction: 'Read the code',
  createdAt: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  useAppStore.setState(useAppStore.getInitialState(), true)
  useAppStore.getState().setActiveConversation('conv_1')
})

describe('skill approval gap recovery', () => {
  it('restores an approval whose pending event was lost before reconnect', async () => {
    api.fetchPendingSkillInstalls.mockResolvedValueOnce([pending])

    await resyncFromSnapshot()

    expect(api.fetchPendingSkillInstalls).toHaveBeenCalledWith('conv_1')
    expect(useAppStore.getState().pendingSkillInstallsByConv.conv_1).toEqual([pending])
  })

  it('removes stale current approvals and uncached background conversation approvals', async () => {
    useAppStore.getState().setPendingSkillInstallsForConversation('conv_1', [pending])
    useAppStore.getState().setPendingSkillInstallsForConversation('conv_2', [
      { ...pending, id: 'psi_old', conversationId: 'conv_2' },
    ])

    await resyncFromSnapshot()

    expect(useAppStore.getState().pendingSkillInstallsByConv).toEqual({})
  })

  it('clears only the ended run approvals while preserving parallel approvals', () => {
    const parallel = { ...pending, id: 'psi_parallel', runId: 'run_2' }
    useAppStore.getState().setPendingSkillInstallsForConversation('conv_1', [pending, parallel])

    useAppStore.getState().applyEvent({
      type: 'run.end', conversationId: 'conv_1', runId: 'run_1', status: 'aborted', timestamp: 2,
    })

    expect(useAppStore.getState().pendingSkillInstallsByConv.conv_1).toEqual([parallel])
  })

  it('does not let a slower previous resync replace newer approval state', async () => {
    let finishOld!: (list: PendingSkillInstall[]) => void
    const oldSnapshot = new Promise<PendingSkillInstall[]>((resolve) => { finishOld = resolve })
    api.fetchPendingSkillInstalls.mockReturnValueOnce(oldSnapshot).mockResolvedValueOnce([])

    const first = resyncFromSnapshot()
    await resyncFromSnapshot()
    finishOld([pending])
    await first

    expect(useAppStore.getState().pendingSkillInstallsByConv).toEqual({})
  })
})
