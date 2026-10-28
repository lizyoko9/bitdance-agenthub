import { NextResponse } from 'next/server'

import { evidenceGatesEnabled } from '@/server/eval-flags'
import { currentPlatform } from '@/server/platform'

/**
 * GET /api/platform
 *
 * 返回服务器宿主平台。前端用来做 UI 文案 / placeholder 的平台感知（详见 specs/11-platform.md）。
 * 不放敏感信息，纯 UI 提示用。evidenceGates 供评测脚本核对服务端开关（见 eval/README.md）。
 */
export async function GET() {
  return NextResponse.json({ platform: currentPlatform(), evidenceGates: evidenceGatesEnabled() })
}
