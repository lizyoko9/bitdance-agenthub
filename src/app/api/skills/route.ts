import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { countSkillUsage, createSkill, listAllSkills, listEnabledSkills } from '@/server/skill-service'

export async function GET(req: NextRequest) {
  // ?all=1 返回全部（含停用）+ 使用计数，供 Skills 库/市场管理界面；默认只返回启用中（供 agent 选用）。
  const all = req.nextUrl.searchParams.get('all') === '1'
  if (all) {
    const [skills, usage] = await Promise.all([listAllSkills(), countSkillUsage()])
    return NextResponse.json({ skills, usage })
  }
  const skills = await listEnabledSkills()
  return NextResponse.json({ skills })
}

const CreateBody = z.object({
  name: z.string().min(1).max(64),
  description: z.string().min(1).max(280),
  category: z.string().min(1).max(32),
  instruction: z.string().min(1).max(20_000),
  requiredToolNames: z.array(z.string()).default([]),
  isGlobalDefault: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null)
  const parsed = CreateBody.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 })
  }

  try {
    const skill = await createSkill({ ...parsed.data, source: 'user' })
    return NextResponse.json({ skill }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
