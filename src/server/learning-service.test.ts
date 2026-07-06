import type {
  AgentProfileRow,
  JsonObject,
  LearningEventRow,
  PlaybookRow,
  PlaybookVersionRow,
  RunReflectionRow,
} from '@/db/schema'
import type { AgentMemoryEvolutionPlan } from '@/lib/agent-psm-memory-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  insertedLearningEvents: [] as LearningEventRow[],
  learningEvents: [] as LearningEventRow[],
  insertedPlaybooks: [] as PlaybookRow[],
  insertedPlaybookVersions: [] as PlaybookVersionRow[],
}))

const schemaMock = vi.hoisted(() => ({
  learningEvents: { table: 'learning_events' },
  playbooks: { table: 'playbooks' },
  playbookVersions: { table: 'playbook_versions' },
}))

vi.mock('@/db/client', () => ({
  db: {
    insert: vi.fn((table: { table: string }) => ({
      values: vi.fn(async (row: LearningEventRow | PlaybookRow | PlaybookVersionRow) => {
        if (table === schemaMock.learningEvents) {
          store.learningEvents.push(row as LearningEventRow)
          store.insertedLearningEvents.push(row as LearningEventRow)
        }
        if (table === schemaMock.playbooks) {
          store.insertedPlaybooks.push(row as PlaybookRow)
        }
        if (table === schemaMock.playbookVersions) {
          store.insertedPlaybookVersions.push(row as PlaybookVersionRow)
        }
      }),
    })),
    query: {
      learningEvents: {
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => store.learningEvents[0] ?? null),
      },
      playbooks: {
        findMany: vi.fn(async () => []),
      },
      playbookVersions: {
        findMany: vi.fn(async () => []),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn((updates: Partial<LearningEventRow>) => ({
        where: vi.fn(async () => {
          if (store.learningEvents[0]) {
            store.learningEvents[0] = { ...store.learningEvents[0], ...updates }
          }
        }),
      })),
    })),
  },
  schema: schemaMock,
}))

import { approveLearningEvent, proposeLearningEventsFromRuntimeLearning } from './learning-service'

describe('learning service runtime PSM proposals', () => {
  beforeEach(() => {
    store.insertedLearningEvents = []
    store.learningEvents = []
    store.insertedPlaybooks = []
    store.insertedPlaybookVersions = []
  })

  it('persists PSM playbook drafts and approval requests as reviewable agent learning events', async () => {
    const reflection = runReflection({
      reusableProcedure: ['reproduce the task', 'verify the artifact', 'handoff with evidence'],
      whatWorked: ['The agent reused a stable delivery loop.'],
      futureWarnings: ['Do not skip artifact verification.'],
    })
    const evolution: AgentMemoryEvolutionPlan = {
      memoryUpdates: [],
      newMemories: [],
      playbookDraft: {
        id: 'run_1:playbook_draft',
        agentId: 'agent_clip',
        projectId: 'project_video',
        scope: 'agent_private',
        type: 'playbook',
        title: 'Video delivery work manual draft',
        content: '1. collect material\n2. edit video\n3. export final file',
        cues: ['video'],
        tags: ['work manual'],
        importance: 0.86,
        confidence: 0.78,
        successCount: 3,
        failureCount: 0,
        reviewStatus: 'pending_review',
        sourceRunId: reflection.runId,
        createdAt: 1,
        updatedAt: 1,
      },
      approvalRequests: [
        {
          kind: 'activate_playbook',
          targetId: 'run_1:playbook_draft',
          reason: 'Review before this becomes a long-term work manual.',
        },
        {
          kind: 'share_memory',
          targetId: 'run_1:failure_lesson',
          reason: 'Keep private first, then share after review.',
        },
      ],
    }

    const proposal = await proposeLearningEventsFromRuntimeLearning({
      reflection,
      agent: agentProfile(),
      memoryEvolution: evolution,
    })

    expect(proposal.learningEvents).toHaveLength(2)
    expect(proposal.learningEvent).toBe(proposal.learningEvents[0])
    expect(store.insertedLearningEvents).toHaveLength(2)
    expect(store.insertedLearningEvents[0]).toMatchObject({
      runId: reflection.runId,
      agentProfileId: 'agent_clip',
      reflectionId: reflection.id,
      type: 'playbook_proposal',
      title: 'Video delivery work manual draft',
      summary: 'Review before this becomes a long-term work manual.',
      status: 'pending_review',
    })
    expect(store.insertedLearningEvents[0].proposedPlaybook).toMatchObject({
      source: 'agent_psm_evolution',
      memoryBlockId: 'run_1:playbook_draft',
      reviewStatus: 'pending_review',
      approvalRequests: [
        expect.objectContaining({
          kind: 'activate_playbook',
          targetId: 'run_1:playbook_draft',
        }),
      ],
      steps: ['collect material', 'edit video', 'export final file'],
      whatWorked: ['The agent reused a stable delivery loop.'],
      futureWarnings: ['Do not skip artifact verification.'],
    })
    expect(store.insertedLearningEvents[1]).toMatchObject({
      type: 'memory_share_review',
      title: 'Agent 记忆共享审核',
      summary: 'Keep private first, then share after review.',
      status: 'pending_review',
    })
    expect(store.insertedLearningEvents[1].proposedPlaybook).toMatchObject({
      source: 'agent_psm_evolution',
      kind: 'share_memory',
      targetId: 'run_1:failure_lesson',
      privateFirst: true,
      reviewBeforeSharing: true,
    })
  })

  it('approves memory sharing reviews without creating a playbook', async () => {
    store.learningEvents.push(learningEvent({
      id: 'evt_memory_share',
      type: 'memory_share_review',
      title: '剪映失败教训共享审核',
      summary: '确认后再共享给项目。',
      proposedPlaybook: {
        source: 'agent_psm_evolution',
        kind: 'share_memory',
        targetId: 'run_1:failure_lesson',
        privateFirst: true,
        reviewBeforeSharing: true,
      },
    }))

    const result = await approveLearningEvent('evt_memory_share', '允许共享这条经验')

    expect(result.learningEvent).toMatchObject({
      id: 'evt_memory_share',
      status: 'approved',
      reviewerNote: '允许共享这条经验',
    })
    expect(result.playbook).toBeNull()
    expect(result.playbookVersion).toBeNull()
    expect(store.insertedPlaybooks).toHaveLength(0)
    expect(store.insertedPlaybookVersions).toHaveLength(0)
  })
})

function agentProfile(overrides: Partial<AgentProfileRow> = {}): AgentProfileRow {
  return {
    id: 'agent_clip',
    name: 'Clip Agent',
    role: 'Video employee',
    description: '',
    modelProfileId: null,
    fallbackModelProfileIds: [],
    skillIds: [],
    mcpServerIds: [],
    cliProfileIds: [],
    softwareProfileIds: [],
    memoryPolicy: { enabled: true, privateFirst: true },
    autonomyPolicy: {},
    workstationPolicy: {},
    permissionPolicy: {},
    inputContract: {},
    outputContract: { artifactType: 'video' },
    persona: {
      avatar: 'A',
      tone: 'friendly',
      language: 'zh-CN',
      communicationStyle: {
        useEmoji: false,
        useCodeBlocks: true,
        preferBulletPoints: true,
        showThinkingProcess: false,
        selfReference: 'Clip Agent',
      },
      personalityTraits: {
        cautious: 0.7,
        creative: 0.55,
        thorough: 0.8,
        efficient: 0.7,
      },
    },
    systemPrompt: '',
    behaviorRules: [],
    successCriteria: [],
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function runReflection(overrides: Partial<RunReflectionRow> = {}): RunReflectionRow {
  return {
    id: 'reflection_1',
    runId: 'run_1',
    agentProfileId: 'agent_clip',
    whatWorked: [],
    whatFailed: [],
    newKnowledge: [],
    reusableProcedure: [],
    suggestedSkillUpdates: [],
    futureWarnings: [],
    createdAt: 1,
    ...overrides,
  }
}

function learningEvent(overrides: Partial<LearningEventRow> = {}): LearningEventRow {
  return {
    id: 'evt_1',
    runId: 'run_1',
    agentProfileId: 'agent_clip',
    reflectionId: 'reflection_1',
    type: 'playbook_proposal',
    title: 'Work manual draft',
    summary: 'Review this draft.',
    proposedPlaybook: {} as JsonObject,
    status: 'pending_review',
    reviewerNote: null,
    createdAt: 1,
    reviewedAt: null,
    ...overrides,
  }
}
