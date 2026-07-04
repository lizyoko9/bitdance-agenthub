export const AGENTHUB_FREE_PRODUCT_NOTICE =
  'AgentHub 本体永久免费；模型、API 或第三方 CLI 的费用只来自用户自己的服务商。'

export const FORBIDDEN_PRODUCT_MONETIZATION_TERMS = [
  '付费墙',
  '会员',
  '订阅',
  '套餐',
  '购买',
  '付费解锁',
  '升级解锁',
  'paywall',
  'pricing',
  'subscription',
  'subscribe',
  'paid tier',
  'paid plan',
  'professional plan',
  'premium',
] as const

const externalCostAllowList = [
  '外部费用',
  '服务商',
  '用户自己的',
  '模型 API',
  'token 用量',
  'third-party',
  'provider',
  'external',
] as const

export function containsForbiddenProductMonetization(text: string): boolean {
  const normalized = text.toLowerCase()
  if (mentionsOnlyExternalCost(normalized)) return false
  return FORBIDDEN_PRODUCT_MONETIZATION_TERMS.some((term) =>
    normalized.includes(term.toLowerCase()),
  )
}

export function assertFreeProductCopy(text: string): void {
  if (!containsForbiddenProductMonetization(text)) return
  throw new Error('AgentHub product copy must stay free-only.')
}

function mentionsOnlyExternalCost(normalized: string): boolean {
  const hasCostWord =
    normalized.includes('费用') ||
    normalized.includes('成本') ||
    normalized.includes('cost') ||
    normalized.includes('billing')
  if (!hasCostWord) return false
  return externalCostAllowList.some((term) => normalized.includes(term.toLowerCase()))
}
