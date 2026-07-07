import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('autonomy policy CLI profile contract', () => {
  it('treats CLI Profile risk as profile-controlled and honors the current commands permission path', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/server/autonomy-policy-service.ts'), 'utf8')

    expect(source).toContain("if (actionType === 'cli_profile') return 'low'")
    expect(source).toContain("['commands', 'run']")
  })
})
