import type {
  DeliveryCatalog,
  DeliveryValidationRequest,
  DeliveryValidationResponse,
} from '@/shared/delivery-validation'

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      throw new Error(body.error)
    }
    throw new Error(`无法完成交付校验请求（HTTP ${response.status}）`)
  }
  return response.json() as Promise<T>
}

function url(conversationId: string) {
  return `/api/conversations/${encodeURIComponent(conversationId)}/delivery-validation`
}

export async function fetchDeliveryValidation(conversationId: string, signal: AbortSignal) {
  return readResponse<DeliveryCatalog>(await fetch(url(conversationId), { signal }))
}

export async function submitDeliveryValidation(
  conversationId: string,
  body: DeliveryValidationRequest,
  signal: AbortSignal,
) {
  return readResponse<DeliveryValidationResponse>(await fetch(url(conversationId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  }))
}
