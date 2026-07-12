import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { importSkills } from '@/server/skill-service'

const DraftSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().min(1).max(280),
  category: z.string().min(1).max(32),
  instruction: z.string().min(1).max(20_000),
  requiredToolNames: z.array(z.string()).default([]),
})

const ImportBody = z.object({
  skills: z.array(DraftSchema).min(1).max(50),
})

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null)
  const parsed = ImportBody.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 })
  }

  const result = await importSkills(parsed.data.skills)
  return NextResponse.json(result, { status: 201 })
}
