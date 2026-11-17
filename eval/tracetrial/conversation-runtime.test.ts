import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { validateTrialRequest } from '../terminalbench/trial-schema'
import { validateTraceTrialRequest } from './run-agenthub'

const scratch: string[] = []
const environment = (): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([name]) => ['PATH', 'HOME', 'LANG', 'TMPDIR', 'SYSTEMROOT', 'WINDIR'].includes(name))),
  NODE_ENV: 'test', OPENAI_API_KEY: 'test-no-real-request',
})

function fixture() {
  const parent = path.resolve('.agenthub-data/test-conversations')
  mkdirSync(parent, { recursive: true })
  const directory = mkdtempSync(path.join(parent, 'conversation-'))
  scratch.push(directory)
  const cwd = path.join(directory, 'workspace')
  mkdirSync(cwd)
  const source = process.env.AGENTHUB_TRACETRIAL_TEST_SOURCE
  const sourceTurns = source && path.join(source, 'Task/E2-shard-stderr-003/turns.json')
  const turns: string[] = sourceTurns && existsSync(sourceTurns)
    ? (JSON.parse(readFileSync(sourceTurns, 'utf8')) as { turns: string[] }).turns
    : Array.from({ length: 10 }, (_, index) => index === 0 ? 'FIRST_INSTRUCTION' : `user-input-${index + 1}`)
  return { directory, turns, request: {
    taskId: 'E2-shard-stderr-003', instruction: turns[0], cwd, outputDir: path.join(directory, 'trial'),
    conversation: { mode: 'fixed_turns', turns }, timeoutMs: 2_400_000, maxTurns: 141, maxToolCalls: 140,
    requestLimits: { maxRequests: 150, maxRequestBytes: 262144, maxTotalRequestBytes: 39321600, maxCompletionTokens: 8192 },
  } }
}

afterEach(() => { for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true }) })

describe('TraceTrial fixed conversation boundary', () => {
  it('extends only the selected TraceTrial schema and requires the exact first input', () => {
    const { request } = fixture()
    expect(validateTraceTrialRequest(request).conversation?.turns).toEqual(request.conversation.turns)
    expect(() => validateTrialRequest(request)).toThrow()
    expect(() => validateTraceTrialRequest({ ...request, instruction: 'changed' })).toThrow(/first conversation turn/)
    expect(() => validateTraceTrialRequest({ ...request, conversation: undefined })).toThrow(/complete fixed conversation/)
    expect(() => validateTraceTrialRequest({ ...request, taskId: 'E8-mountcheck-exit-masked-003' })).toThrow(/approved E2/)
    expect(() => validateTraceTrialRequest({ ...request, group: 'orch-gate' })).toThrow(/approved E2/)
    for (const conversation of [{ ...request.conversation, turns: request.conversation.turns.slice(1) },
      { ...request.conversation, resetSession: true }, { mode: 'free_turns', turns: request.conversation.turns }]) {
      expect(() => validateTraceTrialRequest({ ...request, conversation })).toThrow()
    }
  })

  it('validates the fixed conversation through the actual TraceTrial CLI before checking credentials', () => {
    const { directory, request } = fixture()
    const filename = path.join(directory, 'request.json')
    writeFileSync(filename, JSON.stringify({ ...request, timeoutMs: 600_000 }))
    const env = environment()
    delete env.OPENAI_API_KEY
    const invoke = (entry: string) => spawnSync(process.execPath, ['--import', 'tsx', entry, '--request', filename], {
      cwd: path.resolve('.'), env, timeout: 10_000, encoding: 'utf8',
    })
    const trace = invoke('eval/tracetrial/run-agenthub.ts')
    expect(trace.error).toBeUndefined()
    expect(trace.status).toBe(1)
    expect(trace.stderr).toContain('OPENAI_API_KEY is required')
    const terminal = invoke('eval/terminalbench/run-agenthub.ts')
    expect(terminal.error).toBeUndefined()
    expect(terminal.status).toBe(1)
    expect(terminal.stderr).toContain('conversation')
    expect(terminal.stderr).not.toContain('OPENAI_API_KEY is required')
    expect(existsSync(request.outputDir)).toBe(false)
  })

  it('runs the real service, SQLite and SDK with fake fetch while observing the unchanged history policy', () => {
    const { directory, turns, request } = fixture()
    const bundle = path.join(directory, 'runtime')
    mkdirSync(bundle)
    cpSync(path.resolve('src'), path.join(bundle, 'src'), { recursive: true })
    cpSync(path.resolve('eval/terminalbench'), path.join(bundle, 'eval/terminalbench'), { recursive: true })
    mkdirSync(path.join(bundle, 'eval/tracetrial'))
    cpSync(path.resolve('eval/tracetrial/run-agenthub.ts'), path.join(bundle, 'eval/tracetrial/run-agenthub.ts'))
    cpSync(path.resolve('tsconfig.json'), path.join(bundle, 'tsconfig.json'))
    symlinkSync(path.resolve('node_modules'), path.join(bundle, 'node_modules'), 'dir')
    writeFileSync(path.join(bundle, 'package.json'), JSON.stringify({ type: 'module' }))
    writeFileSync(path.join(request.cwd, 'secret.txt'), 'tool-visible-only-C0DE')
    const entry = pathToFileURL(path.join(bundle, 'eval/tracetrial/run-agenthub.ts')).href
    const output = path.join(directory, 'observed.json')
    const script = `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      const bodies=[];
      globalThis.fetch=async (input, init)=>{
        const body=JSON.parse(typeof init?.body==='string' ? init.body : await input.text());
        bodies.push(body);
        const call=bodies.length;
        const tool=call===1||(call>=3&&call<=14);
        const delta=tool ? {tool_calls:[{index:0,id:'read-'+call,type:'function',function:{name:'fs_read',arguments:JSON.stringify({path:'secret.txt'})}}]}
          : {content:call===2?'public-alpha':call===15?'public-beta':'reply-'+call};
        const chunk={id:'response-'+call,object:'chat.completion.chunk',created:1,model:'gpt-6-luna',choices:[{index:0,delta,finish_reason:tool?'tool_calls':'stop'}]};
        return new Response('data: '+JSON.stringify(chunk)+'\\n\\ndata: [DONE]\\n\\n',{headers:{'content-type':'text/event-stream'}});
      };
      const {runTraceTrial,validateTraceTrialRequest}=await import(${JSON.stringify(entry)});
      const request=validateTraceTrialRequest(${JSON.stringify(request)});
      const result=await runTraceTrial(request);
      assert.equal(result.runStatus,'complete',JSON.stringify(result));
      assert.deepEqual(result.conversation,{plannedTurns:10,completedTurns:10,attemptedTurns:10});
      assert.equal(bodies.length,23);
      assert.ok(JSON.stringify(bodies[1].messages).includes('tool-visible-only-C0DE'));
      const second=bodies[2].messages;
      assert.equal(second.filter(m=>m.role==='user'&&m.content===${JSON.stringify(turns[1])}).length,1);
      assert.ok(second.some(m=>m.role==='assistant'&&m.content==='public-alpha'));
      assert.ok(second.some(m=>m.role==='user'&&m.content===${JSON.stringify(turns[0].trim())}));
      assert.ok(!JSON.stringify(second).includes('tool-visible-only-C0DE'));
      assert.ok(!second.some(m=>m.role==='tool'));
      const final=bodies.at(-1).messages;
      assert.equal(final.filter(m=>m.role==='user'&&m.content===${JSON.stringify(turns[9])}).length,1);
      assert.ok(!final.some(m=>m.content===${JSON.stringify(turns[0].trim())}||m.content==='public-alpha'));
      const manifest=JSON.parse(fs.readFileSync(request.outputDir+'/manifest.json','utf8'));
      const {default:Database}=await import('better-sqlite3');
      const database=new Database(manifest.dataDir+'/agenthub.db',{readonly:true,fileMustExist:true});
      const rows=database.prepare('select id, conversation_id as conversationId, role, parts from messages').all();
      const users=rows.filter(row=>row.role==='user');
      assert.equal(users.length,10);
      assert.equal(new Set(users.map(row=>row.conversationId)).size,1);
      assert.equal(rows.length,33);
      assert.ok(rows.some(row=>JSON.stringify(row.parts).includes('tool-visible-only-C0DE')));
      database.close();
      fs.writeFileSync(${JSON.stringify(output)},JSON.stringify({requests:bodies.length,messages:rows.length,userInputs:users.length,
        withinRunToolEvidence:true,priorPublicTextRetained:true,rawToolsOmittedAcrossRuns:true,twentyRowSelectionDropsOldPublicText:true}));
    `
    const argv = ['--import', 'tsx', '--input-type=module', '-e', script]
    const startedAt = new Date().toISOString()
    const processResult = spawnSync(process.execPath, argv, {
      cwd: bundle, timeout: 15_000, stdio: 'pipe', env: environment(), encoding: 'utf8',
    })
    const finishedAt = new Date().toISOString()
    expect(processResult.error).toBeUndefined()
    expect(processResult.status, processResult.stderr).toBe(0)
    expect(JSON.parse(readFileSync(output, 'utf8'))).toMatchObject({ requests: 23, messages: 33, userInputs: 10,
      withinRunToolEvidence: true, priorPublicTextRetained: true, rawToolsOmittedAcrossRuns: true, twentyRowSelectionDropsOldPublicText: true })
    const receipts = readFileSync(path.join(request.outputDir, 'conversation-turns.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
    expect(receipts).toHaveLength(22)
    expect(receipts.filter((receipt) => receipt.type === 'turn.end').map((receipt) => receipt.index)).toEqual(Array.from({ length: 10 }, (_, index) => index + 1))
    expect(new Set(receipts.filter((receipt) => receipt.type === 'turn.end').map((receipt) => receipt.userMessageId)).size).toBe(10)
    const evidence = process.env.AGENTHUB_TRACETRIAL_TEST_EVIDENCE_DIR
    if (evidence) {
      if (existsSync(evidence)) throw new Error('Conversation test evidence requires a fresh directory')
      mkdirSync(evidence, { recursive: true })
      cpSync(request.outputDir, path.join(evidence, 'native'), { recursive: true })
      cpSync(request.cwd, path.join(evidence, 'workspace'), { recursive: true })
      writeFileSync(path.join(evidence, 'request.json'), JSON.stringify(request))
      writeFileSync(path.join(evidence, 'turns.json'), JSON.stringify({ turns }))
      writeFileSync(path.join(evidence, 'producer-process.json'), JSON.stringify({
        kind: 'real Node process using fake fetch and synthetic workspace; not a benchmark Actor',
        argv: [process.execPath, ...argv], cwd: bundle, pid: processResult.pid,
        exitCode: processResult.status, signal: processResult.signal, startedAt, finishedAt,
        stdout: processResult.stdout, stderr: processResult.stderr, modelCalls: 0,
      }, null, 2))
      cpSync(output, path.join(evidence, 'observed.json'))
    }
  }, 20_000)
})
