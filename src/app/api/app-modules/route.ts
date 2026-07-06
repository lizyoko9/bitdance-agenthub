import { NextRequest, NextResponse } from 'next/server'

import { buildAgentHubModuleManagerView } from '@/lib/agenthub-module-manager'

export async function GET(req: NextRequest) {
  const enabledParam = req.nextUrl.searchParams.get('enabled')
  const enabledModuleIds = enabledParam
    ?.split(',')
    .map((moduleId) => moduleId.trim())
    .filter(Boolean)

  return NextResponse.json({
    moduleManager: buildAgentHubModuleManagerView({
      enabledModuleIds: enabledModuleIds && enabledModuleIds.length > 0 ? enabledModuleIds : undefined,
    }),
  })
}
