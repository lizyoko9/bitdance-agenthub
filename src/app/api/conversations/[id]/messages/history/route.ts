import { NextRequest, NextResponse } from 'next/server'

import { InvalidMessageHistoryCursor, listMessageHistory, messageHistoryQuerySchema } from '@/server/message-history'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const params = req.nextUrl.searchParams
  const query = messageHistoryQuerySchema.safeParse({
    before: params.get('before') ?? undefined,
    after: params.get('after') ?? undefined,
    around: params.get('around') ?? undefined,
  })
  if (!query.success) return NextResponse.json({ error: 'Invalid message history query' }, { status: 400 })
  try {
    const page = listMessageHistory(id, query.data)
    if (!page) return NextResponse.json({ error: 'History message not found' }, { status: 404 })
    return NextResponse.json(page)
  } catch (error) {
    if (error instanceof InvalidMessageHistoryCursor) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }
}
