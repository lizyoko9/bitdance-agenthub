export const COUPONS = [
  { code: 'SAVE10', type: 'percent', value: 10 },
  { code: 'MINUS500', type: 'fixed', value: 500, minSubtotal: 2000 },
  { code: 'HALF', type: 'percent', value: 50, minSubtotal: 10000 },
]

export function findCoupon(code) {
  const wanted = String(code).toUpperCase()
  return COUPONS.find((c) => c.code === wanted) ?? null
}
