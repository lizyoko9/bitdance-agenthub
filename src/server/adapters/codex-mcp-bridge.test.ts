import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (args: unknown) => Promise<unknown>>(),
  connect: vi.fn(),
}))

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    registerTool(name: string, _config: unknown, handler: (args: unknown) => Promise<unknown>) {
      mocks.handlers.set(name, handler)
    }
    connect = mocks.connect
  },
}))

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({ StdioServerTransport: class {} }))

describe('Codex AgentHub MCP result bridge', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.handlers.clear()
    vi.stubEnv('AGENTHUB_INTERNAL_BASE_URL', 'http://127.0.0.1:3000')
    vi.stubEnv('AGENTHUB_INTERNAL_TOOL_TOKEN', 'fixture-token')
    vi.stubEnv('AGENTHUB_CONVERSATION_ID', 'fixture-conversation')
    vi.stubEnv('AGENTHUB_AGENT_ID', 'fixture-agent')
    vi.stubEnv('AGENTHUB_RUN_ID', 'fixture-run')
    vi.stubEnv('AGENTHUB_ALLOWED_TOOLS', 'read_artifact')
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await import('../../../../scripts/agenthub-codex-mcp.mjs' as string)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each([true, false, undefined])('preserves obtained value and error metadata %s', async (isError) => {
    const value = { exitCode: 23, output: 'STATUS: OK\nRESULT: complete\n', status: 'failed' }
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, value, ...(isError === undefined ? {} : { isError }) })))

    await expect(mocks.handlers.get('read_artifact')!({ artifactId: 'fixture' })).resolves.toStrictEqual({
      content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value,
      ...(isError === undefined ? {} : { isError }),
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mocks.handlers.size).toBe(1)
  })

  it('keeps string content and omitted metadata unchanged', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, value: 'fixture text' })))

    await expect(mocks.handlers.get('read_artifact')!({ artifactId: 'fixture' })).resolves.toStrictEqual({
      content: [{ type: 'text', text: JSON.stringify('fixture text') }], structuredContent: undefined,
    })
  })

  it.each([200, 503])('keeps API and HTTP failures on the existing error path with status %s', async (status) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: 'fixture unavailable' }), { status }))

    await expect(mocks.handlers.get('read_artifact')!({ artifactId: 'fixture' })).resolves.toEqual({
      content: [{ type: 'text', text: 'Error: fixture unavailable' }], isError: true,
    })
  })
})
