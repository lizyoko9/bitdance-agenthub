const OPENAI_COMPATIBLE_KEY_RE = /^sk-[A-Za-z0-9_-]{12,}$/
const EXPLICIT_REFERENCE_RE = /^(env|secret|vault):/i
const LONG_OPAQUE_TOKEN_RE = /^[A-Za-z0-9_-]{24,}$/

export function redactSecretReference(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? ''

  if (!trimmed) return '未设置'
  if (EXPLICIT_REFERENCE_RE.test(trimmed)) return trimmed
  if (OPENAI_COMPATIBLE_KEY_RE.test(trimmed)) return 'sk-***隐藏'

  const compact = trimmed.replace(/[^A-Za-z0-9_-]/g, '')
  if (LONG_OPAQUE_TOKEN_RE.test(compact)) return '已隐藏密钥'

  return trimmed
}
