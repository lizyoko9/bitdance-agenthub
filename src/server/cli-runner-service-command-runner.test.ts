import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { splitRenderedCliArgs } from '@/lib/cli-command-args'

describe('cli runner central command runner integration', () => {
  it('splits rendered CLI args without losing quoted values', () => {
    expect(splitRenderedCliArgs('exec --task "review login page" --flag')).toEqual([
      'exec',
      '--task',
      'review login page',
      '--flag',
    ])
    expect(splitRenderedCliArgs("python -c 'print(\"agenthub\")'")).toEqual([
      'python',
      '-c',
      'print("agenthub")',
    ])
  })

  it('routes approved execute mode through the central AgentHub command runner', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/server/cli-runner-service.ts'), 'utf8')

    expect(source).toContain("import { runAgentHubCommand } from '@/server/agenthub-command-runner'")
    expect(source).toContain("import { splitRenderedCliArgs } from '@/lib/cli-command-args'")
    expect(source).toContain("import { resolveEmployeeRunCliMode } from '@/lib/employee-run-cli-mode'")
    expect(source).toContain('runAgentHubCommand({')
    expect(source).toContain('args: splitRenderedCliArgs(renderedArgs)')
    expect(source).toContain('mode: resolveEmployeeRunCliMode(args.agent)')
    expect(source).not.toContain("mode: 'dry_run'")
    expect(source).not.toContain('live process execution is not enabled in this runtime slice')
  })
})
