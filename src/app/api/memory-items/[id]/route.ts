import { NextRequest, NextResponse } from 'next/server'

import { errorResponse, getRouteId, parseJsonBody } from '@/app/api/control-plane-utils'
import { deleteMemoryItem, updateMemoryItem } from '@/server/agent-memory-service'
import { MemoryItemPatchBody } from '@/server/control-plane-validators'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const parsed = await parseJsonBody(req, MemoryItemPatchBody)
  if (!parsed.ok) return parsed.response
  try {
    const memoryItem = await updateMemoryItem(await getRouteId(ctx), parsed.data)
    return NextResponse.json({ memoryItem })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    return NextResponse.json(await deleteMemoryItem(await getRouteId(ctx)))
  } catch (err) {
    return errorResponse(err)
  }
}
