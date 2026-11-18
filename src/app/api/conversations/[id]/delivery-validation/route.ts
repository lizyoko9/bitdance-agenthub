import { z } from 'zod'

import {
  activateDeliveryRevision,
  createDeliveryDraft,
  DeliveryValidationError,
  listDeliveryValidation,
  revokeDeliveryRevision,
  validateDeliveryRevision,
} from '@/server/delivery-validation-service'

export const runtime = 'nodejs'

const idSchema = z.string().min(1).max(128)
const inputAlias = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/)
const bodySchema = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('draft'),
    title: z.string().trim().min(1).max(120),
    agentId: idSchema,
    requirements: z.array(z.strictObject({
      messageId: idSchema,
      quote: z.string().min(1).max(16 * 1024).refine((quote) => quote.trim().length > 0),
    })).min(1).max(12),
    inputs: z.array(z.strictObject({
      alias: inputAlias,
      path: z.string().trim().min(1).max(512),
      format: z.enum(['json', 'markdown', 'text']),
    })).min(1).max(8),
    previousRevisionId: idSchema.optional(),
  }),
  z.strictObject({
    action: z.literal('activate'),
    revisionId: idSchema,
    reviewed: z.literal(true),
    fixtures: z.array(z.strictObject({
      ruleId: idSchema,
      expected: z.enum(['pass', 'fail']),
      inputs: z.record(inputAlias, z.string().max(8192)),
    })).max(64),
  }),
  z.strictObject({ action: z.literal('revoke'), revisionId: idSchema }),
  z.strictObject({ action: z.literal('validate'), revisionId: idSchema }),
])

interface RouteContext {
  params: Promise<{ id: string }>
}

const MAX_BODY_BYTES = 320 * 1024

async function readBody(request: Request): Promise<unknown> {
  const body = request.body?.getReader()
  if (!body) throw new DeliveryValidationError('请求缺少内容')
  const bytes = new Uint8Array(MAX_BODY_BYTES)
  let length = 0
  try {
    for (;;) {
      const chunk = await body.read()
      if (chunk.done) break
      if (length + chunk.value.byteLength > bytes.length) {
        await body.cancel()
        throw new DeliveryValidationError('请求内容超过 320 KiB')
      }
      bytes.set(chunk.value, length)
      length += chunk.value.byteLength
    }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length))
    return JSON.parse(decoded)
  } catch (error) {
    if (error instanceof DeliveryValidationError) throw error
    throw new DeliveryValidationError('请求需要有效的 UTF-8 JSON')
  } finally {
    body.releaseLock()
  }
}

function reportError(error: unknown, signal: AbortSignal) {
  if (signal.aborted) return Response.json({ error: '已取消' }, { status: 409 })
  if (error instanceof DeliveryValidationError) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ error: '交付校验服务暂时无法完成请求' }, { status: 500 })
}

export async function GET(request: Request, context: RouteContext) {
  try {
    return Response.json(listDeliveryValidation((await context.params).id))
  } catch (error) {
    return reportError(error, request.signal)
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const origin = request.headers.get('origin')
    if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(request.url).origin)) {
      return Response.json({ error: '交付校验仅接受来自当前应用的请求' }, { status: 403 })
    }
    if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      return Response.json({ error: '请求需要 application/json' }, { status: 415 })
    }
    const { id } = await context.params
    const parsed = bodySchema.safeParse(await readBody(request))
    if (!parsed.success) return Response.json({ error: '请求字段无效，请核对需求、文件路径和规则版本' }, { status: 400 })
    request.signal.throwIfAborted()
    const body = parsed.data
    switch (body.action) {
      case 'draft':
        return Response.json({ plan: await createDeliveryDraft(id, body, request.signal) })
      case 'activate':
        return Response.json({ plan: activateDeliveryRevision(id, body) })
      case 'revoke':
        return Response.json({ plan: revokeDeliveryRevision(id, body.revisionId) })
      case 'validate':
        return Response.json({ receipt: await validateDeliveryRevision(id, body.revisionId, request.signal) })
    }
  } catch (error) {
    return reportError(error, request.signal)
  }
}
