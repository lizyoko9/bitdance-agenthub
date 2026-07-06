import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('agent brain sharing policy panel', () => {
  it('keeps memory sharing rules inside the agent settings brain card', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/agent-employee-settings-panel.tsx'), 'utf8')

    expect(source).toContain('<MemorySharingPolicyPanel />')
    expect(source).toContain('function MemorySharingPolicyPanel')
    expect(source).toContain('记忆共享规则')
    expect(source).toContain('默认先保存在这个员工自己的大脑里')
    expect(source).toContain('确认后再共享给项目、团队或全局工具经验')
    expect(source).not.toContain('PSM')
  })
})
