import type { Options } from '@anthropic-ai/claude-agent-sdk'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AdapterInput } from './types'

const mocks = vi.hoisted(() => ({
  query: vi.fn<(args: { prompt: string; options: Options }) => AsyncIterable<never>>(),
  workspace: vi.fn(),
  conversation: vi.fn(),
}))

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  AbortError: class extends Error {},
  query: mocks.query,
  tool: (name: string) => ({ name }),
  createSdkMcpServer: () => ({}),
}))

vi.mock('@/db/client', async () => ({
  schema: await import('@/db/schema'),
  db: { query: { workspaces: { findFirst: mocks.workspace }, conversations: { findFirst: mocks.conversation } } },
}))

vi.mock('@/server/tools/registry', () => ({ toolRegistry: { execute: vi.fn() } }))

import { ClaudeCodeAdapter } from './claude-code-adapter'

async function* emptySdkStream(): AsyncIterable<never> {
  yield* []
}

describe('ClaudeCodeAdapter skill isolation', () => {
  let root: string
  let cwd: string

  beforeEach(() => {
    vi.clearAllMocks()
    root = realpathSync(mkdtempSync(path.join(tmpdir(), 'agenthub-claude-adapter-')))
    cwd = path.join(root, 'workspace')
    mkdirSync(cwd)
    mocks.workspace.mockResolvedValue({ mode: 'local', boundPath: cwd, rootPath: cwd })
    mocks.conversation.mockResolvedValue({ fsWriteApprovalMode: 'review' })
    mocks.query.mockImplementation(emptySdkStream)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(root, { recursive: true, force: true })
  })

  function input(patch: Partial<AdapterInput> = {}): AdapterInput {
    return {
      agentId: 'agent-skill-test',
      conversationId: 'conv-skill-test',
      runId: 'run-skill-test',
      prompt: 'Test skill isolation',
      workspacePath: cwd,
      systemPrompt: 'Test system prompt',
      apiKey: null,
      apiBaseUrl: null,
      modelId: null,
      toolNames: [],
      ...patch,
    }
  }

  async function run(adapterInput: AdapterInput): Promise<void> {
    const events = []
    for await (const event of new ClaudeCodeAdapter().stream(adapterInput, new AbortController().signal)) {
      events.push(event)
    }
    expect(events.map((event) => event.type)).toEqual(['message.start', 'message.end'])
  }

  it('explicitly disables discovered skills when none are bound', async () => {
    await run(input())
    expect(mocks.query.mock.calls[0][0].options.skills).toEqual([])
  })

  it('explicitly disables skills during the plan stage even when skills are bound', async () => {
    await run(input({
      toolNames: ['plan_tasks'],
      skills: [{ name: 'review', description: 'Review method', instruction: 'Review carefully' }],
    }))
    expect(mocks.query.mock.calls[0][0].options.skills).toEqual([])
    expect(existsSync(path.join(cwd, '.claude'))).toBe(false)
  })

  it('keeps the SDK filter empty after skill materialization fails', async () => {
    const outside = path.join(root, 'outside')
    mkdirSync(outside)
    symlinkSync(outside, path.join(cwd, '.claude'), process.platform === 'win32' ? 'junction' : 'dir')
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await run(input({ skills: [{ name: 'review', description: 'Review method', instruction: 'Review carefully' }] }))
    expect(warning).toHaveBeenCalled()
    expect(mocks.query.mock.calls[0][0].options.skills).toEqual([])
  })

  it('passes the unique materialized name to the SDK and cleans up after streaming', async () => {
    let skillPath = ''
    mocks.query.mockImplementation(({ options }) => {
      const name = options.skills?.[0]
      expect(name).toMatch(/^agenthub-[a-f0-9-]+-0$/)
      skillPath = path.join(cwd, '.claude', 'skills', name!, 'SKILL.md')
      expect(readFileSync(skillPath, 'utf8')).toContain(`name: ${name}\n`)
      return emptySdkStream()
    })

    await run(input({ skills: [{ name: 'review', description: 'Review method', instruction: 'Review carefully' }] }))
    expect(existsSync(skillPath)).toBe(false)
  })
})
