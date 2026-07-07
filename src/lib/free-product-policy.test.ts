import { describe, expect, it } from 'vitest'

import {
  AGENTHUB_FREE_PRODUCT_NOTICE,
  assertFreeProductCopy,
  containsForbiddenProductMonetization,
} from './free-product-policy'

describe('free product policy', () => {
  it('states that AgentHub itself is free while allowing external provider costs', () => {
    expect(AGENTHUB_FREE_PRODUCT_NOTICE).toContain('AgentHub 本体永久免费')
    expect(AGENTHUB_FREE_PRODUCT_NOTICE).toContain('模型、API 或第三方 CLI')
    expect(() => assertFreeProductCopy(AGENTHUB_FREE_PRODUCT_NOTICE)).not.toThrow()
  })

  it('rejects paid product gating language', () => {
    expect(containsForbiddenProductMonetization('升级到会员后解锁高级模块')).toBe(true)
    expect(containsForbiddenProductMonetization('Professional plan subscription')).toBe(true)
    expect(containsForbiddenProductMonetization('付费墙后才可以使用')).toBe(true)
    expect(containsForbiddenProductMonetization('这里是商业化配置入口')).toBe(true)
    expect(containsForbiddenProductMonetization('收费后才能启用自动化')).toBe(true)
    expect(containsForbiddenProductMonetization('Commercial strategy and monetization setup')).toBe(true)
  })

  it('allows model usage cost language when it is clearly external', () => {
    expect(containsForbiddenProductMonetization('这里显示用户自己的模型 API 外部费用和 token 用量')).toBe(false)
    expect(() => assertFreeProductCopy('外部模型服务商可能产生费用，AgentHub 不收取产品费用。')).not.toThrow()
  })
})
