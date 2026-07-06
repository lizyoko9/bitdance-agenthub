import { NextRequest, NextResponse } from 'next/server'
import type { z } from 'zod'

export async function parseJsonBody<S extends z.ZodTypeAny>(
  req: NextRequest,
  schema: S,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: NextResponse }> {
  const raw = await req.json().catch(() => null)
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid body', issues: parsed.error.issues },
        { status: 400 },
      ),
    }
  }
  return { ok: true, data: parsed.data }
}

export function errorResponse(err: unknown, status = 400): NextResponse {
  const message = err instanceof Error ? err.message : String(err)
  return NextResponse.json({ error: message }, { status })
}

export async function getRouteId(ctx: { params: Promise<{ id: string }> }): Promise<string> {
  return (await ctx.params).id
}

export function getRequestApiKey(req: NextRequest): string | null {
  const explicit = req.headers.get('x-reasonix-api-key')?.trim()
  if (explicit) return explicit
  const authorization = req.headers.get('authorization')?.trim() ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(authorization)
  return match?.[1]?.trim() || null
}
