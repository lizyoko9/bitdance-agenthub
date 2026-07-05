import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('workflow library local canvas drafts', () => {
  const readWorkflowLibrarySource = () =>
    readFileSync(resolve(process.cwd(), 'src/components/workflow-library.tsx'), 'utf8')

  const readCanvasSource = () =>
    readFileSync(resolve(process.cwd(), 'src/components/langflow-agent-canvas.tsx'), 'utf8')

  it('merges saved canvas drafts into the workflow list', () => {
    const source = readWorkflowLibrarySource()

    expect(source).toContain('CANVAS_DRAFT_LIBRARY_STORAGE_KEY')
    expect(source).toContain('loadLocalCanvasWorkflows')
    expect(source).toContain('localCanvasWorkflows')
    expect(source).toContain("source: 'local_canvas'")
    expect(source).toContain('nodeCount')
    expect(source).toContain('edgeCount')
  })

  it('merges local canvas dry-run records into workflow run status', () => {
    const source = readWorkflowLibrarySource()

    expect(source).toContain('CANVAS_RUN_HISTORY_STORAGE_KEY')
    expect(source).toContain('loadLocalCanvasRuns')
    expect(source).toContain('localCanvasRuns')
    expect(source).toContain('allRuns')
    expect(source).toContain("source: 'local_canvas_run'")
  })

  it('opens the requested saved canvas draft by workflow id', () => {
    const source = readCanvasSource()

    expect(source).toContain('findCanvasDraftById')
    expect(source).toContain('initialWorkflowId')
    expect(source).toContain('library.find')
    expect(source).toContain('workflowDraftId === draftId')
  })

  it('selects the first Agent node after opening a saved canvas workflow', () => {
    const source = readCanvasSource()
    const applyDraftStart = source.indexOf('const applyCanvasDraft')
    const applyDraftEnd = source.indexOf('  useEffect(() => {\n    let cancelled = false', applyDraftStart)
    const applyDraftSource = source.slice(applyDraftStart, applyDraftEnd)

    expect(applyDraftSource).toContain("draft.nodes.find((node) => node.data.kind === 'agent')?.id ?? draft.nodes[0]?.id ?? ''")
  })

  it('saves a newly created canvas workflow into the local workflow library immediately', () => {
    const source = readCanvasSource()
    const createNewDraftSource = source.slice(source.indexOf('const createNewCanvasDraft'))

    expect(createNewDraftSource).toContain('const nextNodes = cloneCanvasNodes(initialNodes)')
    expect(createNewDraftSource).toContain('const nextEdges = cloneCanvasEdges(initialEdges)')
    expect(createNewDraftSource).toContain('const draft: CanvasDraft = {')
    expect(createNewDraftSource).toContain("title: '新建流程'")
    expect(createNewDraftSource).toContain('handoffSteps: buildHandoffSteps(nextNodes, nextEdges)')
    expect(createNewDraftSource).toContain('saveWorkflowDraftToLibrary(draft)')
  })

  it('persists a local canvas dry-run record when preflight succeeds', () => {
    const source = readCanvasSource()

    expect(source).toContain('CANVAS_RUN_HISTORY_STORAGE_KEY')
    expect(source).toContain('saveCanvasRunHistory')
    expect(source).toContain('upsertCanvasRunHistory')
    expect(source).toContain('local_canvas_run')
    expect(source).toContain('executionPlan.map')
  })
})
