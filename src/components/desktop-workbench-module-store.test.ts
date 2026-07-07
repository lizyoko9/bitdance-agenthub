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

  it('wires available module blocks to the add-module action instead of only navigating', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/desktop-workbench.tsx'), 'utf8')

    expect(source).toContain('onEnableModule')
    expect(source).toContain('onDisableModule')
    expect(source).toContain('fetchAppModuleManagerView(enabledModuleIds)')
    expect(source).toContain('prioritizeWorkbenchActiveModules')
    expect(source).toContain('module.active && !module.defaultEnabled')
    expect(source).toContain('? onDisableModule')
  })

  it('uses plain task-progress wording instead of engineering run-site wording', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/desktop-workbench.tsx'), 'utf8')

    expect(source).toContain('任务进度')
    expect(source).not.toContain('运行现场')
  })
})
