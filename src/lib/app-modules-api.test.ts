import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchAppModuleManagerView } from './api'

describe('app modules api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches the default module manager view', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          moduleManager: {
            activeModules: [{ id: 'workbench' }],
            availableModules: [],
            blockers: [],
          },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const view = await fetchAppModuleManagerView()

    expect(fetchMock).toHaveBeenCalledWith('/api/app-modules')
    expect(view.activeModules).toEqual([{ id: 'workbench' }])
  })

  it('fetches a preview for explicitly enabled modules', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          moduleManager: {
            activeModules: [{ id: 'models' }, { id: 'agents' }, { id: 'memory' }],
            availableModules: [],
            blockers: [],
          },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchAppModuleManagerView(['memory'])

    expect(fetchMock).toHaveBeenCalledWith('/api/app-modules?enabled=memory')
  })
})
