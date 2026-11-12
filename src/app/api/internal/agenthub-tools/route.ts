import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { db, schema } from '@/db/client'
import { verifyInternalToolToken } from '@/server/internal-tool-auth'
import { askUserTool } from '@/server/tools/ask-user'
import { deployArtifactTool } from '@/server/tools/deploy-artifact'
import { deployWorkspaceTool } from '@/server/tools/deploy-workspace'
import { fsListTool } from '@/server/tools/fs-list'
import { installSkillTool } from '@/server/tools/install-skill'
import { loadSkillTool } from '@/server/tools/load-skill'
import { planTasksTool } from '@/server/tools/plan-tasks'
import { readArtifactTool } from '@/server/tools/read-artifact'
import { readAttachmentTool } from '@/server/tools/read-attachment'
import { reportTaskResultTool } from '@/server/tools/report-task-result'
import type { ToolContext } from '@/server/tools/types'
import { writeArtifactTool } from '@/server/tools/write-artifact'
import { getEffectiveCwd } from '@/server/workspace-utils'

export const runtime = 'nodejs'

const EXPOSED_TOOLS = {
  write_artifact: writeArtifactTool,
  read_artifact: readArtifactTool,
  deploy_artifact: deployArtifactTool,
  deploy_workspace: deployWorkspaceTool,
  ask_user: askUserTool,
  report_task_result: reportTaskResultTool,
  fs_list: fsListTool,
  plan_tasks: planTasksTool,
  read_attachment: readAttachmentTool,
  load_skill: loadSkillTool,
  install_skill: installSkillTool,
}

const BodySchema = z.object({
  toolName: z.string().min(1),
  args: z.unknown(),
  conversationId: z.string().min(1),
  agentId: z.string().min(1),
  runId: z.string().min(1),
})

export async function POST(req: Request) {
  if (!verifyInternalToolToken(req.headers.get('authorization'))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: `Invalid body: ${parsed.error.message}` }, { status: 400 })
  }

  const { toolName, args, conversationId, agentId, runId } = parsed.data
  const tool = EXPOSED_TOOLS[toolName as keyof typeof EXPOSED_TOOLS]
  if (!tool) {
    return NextResponse.json({ ok: false, error: `Tool is not exposed to Codex: ${toolName}` }, { status: 403 })
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(schema.workspaces.conversationId, conversationId),
  })
  if (!workspace) {
    return NextResponse.json({ ok: false, error: `Workspace not found for conversation: ${conversationId}` }, { status: 404 })
  }

  const ctx: ToolContext = {
    conversationId,
    workspacePath: getEffectiveCwd(workspace),
    agentId,
    runId,
    abortSignal: req.signal,
  }

  try {
    return NextResponse.json(await tool.handler(args, ctx))
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
