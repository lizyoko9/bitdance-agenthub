import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('agent canvas routing', () => {
  it('uses the Langflow-style React Flow canvas as the primary orchestration surface', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/modules/app-modules.tsx'), 'utf8')

    expect(source).toContain("import { LangflowAgentCanvas }")
    expect(source).toContain("<LangflowAgentCanvas initialWorkflowId={canvasWorkflowId ?? undefined} />")
    expect(source).not.toContain("import { AgentWorkflowCanvas }")
  })
})
