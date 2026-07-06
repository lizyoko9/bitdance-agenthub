import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('desktop workbench module store preview', () => {
  it('shows enabled and available product modules as building blocks on the workbench', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/desktop-workbench.tsx'), 'utf8')

    expect(source).toContain('fetchAppModuleManagerView')
    expect(source).toContain('moduleManager')
    expect(source).toContain('<ModuleStorePreview')
    expect(source).toContain('function ModuleStorePreview')
    expect(source).toContain('模块积木')
    expect(source).toContain('已启用模块')
    expect(source).toContain('可加入模块')
  })
})
