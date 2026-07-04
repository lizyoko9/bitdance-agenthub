import { describe, expect, it } from 'vitest'

import { redactSecretReference } from './secret-redaction'

describe('redactSecretReference', () => {
  it('keeps environment and vault references visible', () => {
    expect(redactSecretReference('env:DEEPSEEK_API_KEY')).toBe('env:DEEPSEEK_API_KEY')
    expect(redactSecretReference('secret:model-primary')).toBe('secret:model-primary')
    expect(redactSecretReference('vault:team/deepseek')).toBe('vault:team/deepseek')
  })

  it('redacts OpenAI-compatible raw API keys', () => {
    const rawKey = `sk-${'a'.repeat(44)}`

    expect(redactSecretReference(rawKey)).not.toContain(rawKey)
    expect(redactSecretReference(rawKey)).toBe('sk-***隐藏')
  })

  it('redacts long opaque token-like values', () => {
    const rawToken = 'deepseek_' + 'b'.repeat(40)

    expect(redactSecretReference(rawToken)).toBe('已隐藏密钥')
  })

  it('uses a neutral empty value label', () => {
    expect(redactSecretReference('')).toBe('未设置')
    expect(redactSecretReference('   ')).toBe('未设置')
  })
})
