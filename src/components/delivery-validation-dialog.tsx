'use client'

import { ClipboardCheck, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  fetchDeliveryValidation,
  submitDeliveryValidation,
} from '@/lib/delivery-validation-api'
import type {
  DeliveryCatalog,
  DeliveryInput,
  DeliveryPlanView,
  DeliveryReceiptView,
  DeliveryValidationRequest,
} from '@/shared/delivery-validation'

const SELECT_CLASS = 'h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-ring'
const PLAN_LABEL = { draft: '草稿', active: '已启用', revoked: '已撤销', stale: '已失效' }
const RESULT_LABEL = { pass: '通过', fail: '失败', unverified: '未验证' }
const INPUT_LABEL = { ready: '已读取', missing: '文件缺失', unavailable: '未能读取' }
const FORMAT_LABEL = { json: 'JSON', markdown: 'Markdown', text: '文本' }
const DATE_FORMAT = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium' })

type Action = (body: DeliveryValidationRequest) => Promise<void>
type DraftAction = Extract<DeliveryValidationRequest, { action: 'draft' }>

export function DeliveryValidationDialog({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={open ? 'default' : 'ghost'} size="icon-sm" title="交付校验" aria-label="交付校验" />}>
        <ClipboardCheck className="size-4" />
      </DialogTrigger>
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-4 py-3 pr-10">
          <DialogTitle>交付校验</DialogTitle>
          <DialogDescription>根据用户需求生成并保存规则，校验工作区文件的指定快照。</DialogDescription>
        </DialogHeader>
        {open && <DeliveryValidationPanel conversationId={conversationId} />}
      </DialogContent>
    </Dialog>
  )
}

function DeliveryValidationPanel({ conversationId }: { conversationId: string }) {
  const request = useRef<AbortController | null>(null)
  const [catalog, setCatalog] = useState<DeliveryCatalog | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<DeliveryValidationRequest['action'] | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [creating, setCreating] = useState<{ from?: DeliveryPlanView } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void fetchDeliveryValidation(conversationId, controller.signal).then((data) => {
      if (!controller.signal.aborted) setCatalog(data)
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setLoadError(message(cause))
    })
    return () => controller.abort()
  }, [conversationId, loadAttempt])

  useEffect(() => () => request.current?.abort(), [])

  const perform: Action = async (body) => {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setPending(body.action)
    setError('')
    setNotice('')
    try {
      const response = await submitDeliveryValidation(conversationId, body, controller.signal)
      if (controller.signal.aborted) return
      if ('plan' in response) {
        const plan = response.plan
        setCatalog((current) => current && ({
          ...current,
          plans: [plan, ...current.plans.filter((saved) => saved.id !== plan.id)],
        }))
        setSelectedId(plan.id)
        setCreating(null)
      } else {
        const receipt = response.receipt
        setCatalog((current) => current && ({
          ...current,
          plans: current.plans.map((plan) => plan.id === receipt.revisionId
            ? { ...plan, receipts: [receipt, ...plan.receipts] }
            : plan),
        }))
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(message(cause))
    } finally {
      if (request.current === controller && !controller.signal.aborted) {
        request.current = null
        setPending(null)
      }
    }
  }

  function cancelDraft() {
    request.current?.abort()
    request.current = null
    setPending(null)
    setNotice('已取消生成。')
  }

  if (!catalog) {
    return (
      <div className="space-y-2 px-4 py-4">
        {loadError ? (
          <>
            <p role="alert" className="text-destructive">{loadError}</p>
            <Button variant="outline" onClick={() => { setLoadError(''); setLoadAttempt((n) => n + 1) }}>重试</Button>
          </>
        ) : <p role="status" className="text-muted-foreground">正在读取校验规则…</p>}
      </div>
    )
  }

  const selected = catalog.plans.find((plan) => plan.id === selectedId)
  return (
    <div className="space-y-4 overflow-y-auto px-4 py-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1 space-y-1">
          <span className="text-xs font-medium">已保存版本</span>
          <select
            className={SELECT_CLASS}
            value={selectedId}
            disabled={pending !== null}
            onChange={(event) => {
              setSelectedId(event.target.value)
              setCreating(null)
              setError('')
              setNotice('')
            }}
          >
            <option value="">{catalog.plans.length ? '选择规则版本' : '暂无保存的规则'}</option>
            {catalog.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.title} · v{plan.revision} · {PLAN_LABEL[plan.status]}</option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          disabled={pending !== null}
          onClick={() => { setCreating({}); setError(''); setNotice('') }}
        >
          <Plus className="size-4" />
          新建规则
        </Button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-destructive/35 px-3 py-2 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      {creating ? (
        <DraftForm
          key={creating.from?.id ?? 'new'}
          catalog={catalog}
          from={creating.from}
          pending={pending === 'draft'}
          onGenerate={perform}
          onClose={() => { setCreating(null); setError(''); setNotice('') }}
          onCancel={cancelDraft}
        />
      ) : selected ? (
        <PlanReview
          key={selected.id}
          plan={selected}
          pending={pending}
          onAction={perform}
          onRevise={() => { setCreating({ from: selected }); setError(''); setNotice('') }}
        />
      ) : <p className="text-sm text-muted-foreground">选择一个版本复验，或新建规则。</p>}
    </div>
  )
}

function DraftForm({ catalog, from, pending, onGenerate, onClose, onCancel }: {
  catalog: DeliveryCatalog
  from?: DeliveryPlanView
  pending: boolean
  onGenerate: Action
  onClose: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(from?.title ?? '')
  const [agentId, setAgentId] = useState(catalog.agents[0]?.id ?? '')
  const [requirements, setRequirements] = useState(() => (from?.requirements ?? [{ messageId: '', quote: '' }])
    .map(({ messageId, quote }, index) => ({ row: index, messageId, quote })))
  const [inputs, setInputs] = useState(() => (from?.inputs ?? [{ alias: 'file1', path: '', format: 'json' } satisfies DeliveryInput])
    .map((input, index) => ({ ...input, row: index })))
  const nextRequirement = useRef(requirements.length)
  const nextInput = useRef(inputs.length)
  const recentSourceIds = new Set(catalog.sources.map((source) => source.messageId))
  const sourceById = new Map(catalog.sources.map((source) => [source.messageId, [source.text]]))
  for (const source of from?.requirements ?? []) {
    if (!recentSourceIds.has(source.messageId)) {
      sourceById.set(source.messageId, [...(sourceById.get(source.messageId) ?? []), source.quote])
    }
  }
  const requirementsReady = requirements.every((item) => item.quote.trim()
    && sourceById.get(item.messageId)?.some((text) => text.includes(item.quote)))
  const inputBytes = requirements.reduce((size, item) => size + new TextEncoder().encode(item.quote).length, 0)
  const formReady = title.trim() && agentId && requirementsReady && inputBytes <= 16 * 1024
    && inputs.every((input) => input.alias.trim() && input.path.trim())

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !formReady) return
    const body: DraftAction = {
      action: 'draft',
      title: title.trim(),
      agentId,
      requirements: requirements.map(({ messageId, quote }) => ({ messageId, quote })),
      inputs: inputs.map(({ alias, path, format }) => ({ alias: alias.trim(), path: path.trim(), format })),
      ...(from ? { previousRevisionId: from.id } : {}),
    }
    void onGenerate(body)
  }

  return (
    <form className="space-y-4" onSubmit={generate}>
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium">规则名称</span>
            <Input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">生成 Agent</span>
            <select className={SELECT_CLASS} value={agentId} onChange={(event) => setAgentId(event.target.value)} required>
              {!catalog.agents.length && <option value="">本会话暂无可用 Custom Agent</option>}
              {catalog.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
          </label>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium">需求原文</h3>
            <Button type="button" variant="outline" size="sm" disabled={requirements.length >= 12 || !sourceById.size} onClick={() => {
              const row = nextRequirement.current++
              setRequirements((items) => [...items, { row, messageId: '', quote: '' }])
            }}>添加需求</Button>
          </div>
          {!sourceById.size && <p className="text-sm text-muted-foreground">在对话中发送交付要求后，即可选择需求原文。</p>}
          {requirements.map((item, index) => {
            const original = sourceById.get(item.messageId)
            const invalid = !!item.messageId && (!original || (!!item.quote && !original.some((text) => text.includes(item.quote))))
            return (
              <div key={item.row} className="space-y-2 rounded-lg border p-2">
                <div className="flex items-end gap-2">
                  <label className="min-w-0 flex-1 space-y-1">
                    <span className="text-xs font-medium">需求消息 {index + 1}</span>
                    <select className={SELECT_CLASS} value={item.messageId} onChange={(event) => {
                      const messageId = event.target.value
                      setRequirements((items) => items.map((old) => old.row === item.row
                        ? { ...old, messageId, quote: sourceById.get(messageId)?.[0] ?? '' }
                        : old))
                    }} required>
                      <option value="">选择用户消息</option>
                      {item.messageId && !original && <option value={item.messageId}>原消息已不可选</option>}
                      {[...sourceById].map(([messageId, quotes]) => (
                        <option key={messageId} value={messageId}>
                          {!recentSourceIds.has(messageId) && '旧版引用 · '}
                          {quotes[0].replace(/\s+/g, ' ').slice(0, 95)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {requirements.length > 1 && (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`移除需求 ${index + 1}`} onClick={() => {
                      setRequirements((items) => items.filter((old) => old.row !== item.row))
                    }}><X className="size-4" /></Button>
                  )}
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">需求原文片段 {index + 1}</span>
                  <Textarea
                    className="max-h-40"
                    value={item.quote}
                    placeholder="选择消息后，可删减为原文中的连续片段"
                    aria-invalid={invalid}
                    onChange={(event) => {
                      const quote = event.target.value
                      setRequirements((items) => items.map((old) => old.row === item.row ? { ...old, quote } : old))
                    }}
                    required
                  />
                </label>
                {invalid && <p className="text-xs text-destructive">需求片段必须与所选消息原文一致。</p>}
              </div>
            )
          })}
          {inputBytes > 16 * 1024 && <p className="text-xs text-destructive">需求原文总长超过 16 KiB，请缩短片段。</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium">交付文件</h3>
            <Button type="button" variant="outline" size="sm" disabled={inputs.length >= 8} onClick={() => {
              const row = nextInput.current++
              setInputs((items) => [...items, { row, alias: `file${row + 1}`, path: '', format: 'json' }])
            }}>添加文件</Button>
          </div>
          {inputs.map((file, index) => (
            <div key={file.row} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_auto]">
              <label className="order-2 space-y-1 sm:order-1">
                <span className="text-xs font-medium">别名 {index + 1}</span>
                <Input value={file.alias} onChange={(event) => {
                  const alias = event.target.value
                  setInputs((items) => items.map((old) => old.row === file.row ? { ...old, alias } : old))
                }} required />
              </label>
              <label className="order-1 col-span-3 space-y-1 sm:order-2 sm:col-span-1">
                <span className="text-xs font-medium">相对路径 {index + 1}</span>
                <Input value={file.path} placeholder="output/report.json" onChange={(event) => {
                  const path = event.target.value
                  const format = /\.md$/i.test(path) ? 'markdown' : /\.json$/i.test(path) ? 'json' : file.format
                  setInputs((items) => items.map((old) => old.row === file.row ? { ...old, path, format } : old))
                }} required />
              </label>
              <label className="order-3 space-y-1">
                <span className="text-xs font-medium">格式 {index + 1}</span>
                <select className={SELECT_CLASS} value={file.format} onChange={(event) => {
                  const format = event.target.value as DeliveryInput['format']
                  setInputs((items) => items.map((old) => old.row === file.row ? { ...old, format } : old))
                }}>
                  <option value="json">JSON</option>
                  <option value="markdown">Markdown</option>
                  <option value="text">文本</option>
                </select>
              </label>
              {inputs.length > 1 && (
                <Button type="button" className="order-4" variant="ghost" size="icon-sm" aria-label={`移除文件 ${index + 1}`} onClick={() => {
                  setInputs((items) => items.filter((old) => old.row !== file.row))
                }}><X className="size-4" /></Button>
              )}
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {pending ? (
          <>
            <span className="mr-auto text-sm text-muted-foreground" role="status">正在生成规则草稿…</span>
            <Button type="button" variant="outline" onClick={onCancel}>取消生成</Button>
          </>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={onClose}>返回</Button>
            <Button type="submit" disabled={!formReady}>生成草稿</Button>
          </>
        )}
      </div>
    </form>
  )
}

function fixtureInputs(value: string): Record<string, string> {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || Object.values(parsed).some((item: unknown) => typeof item !== 'string')) {
    throw new Error('样例须使用 JSON 对象，键为文件别名，值为文件正文。')
  }
  return parsed as Record<string, string>
}

function PlanReview({ plan, pending, onAction, onRevise }: {
  plan: DeliveryPlanView
  pending: DeliveryValidationRequest['action'] | null
  onAction: Action
  onRevise: () => void
}) {
  const [reviewed, setReviewed] = useState(false)
  const [fixtureError, setFixtureError] = useState('')
  const [fixtures, setFixtures] = useState(() => new Map(plan.suggestedFixtures.map((fixture) => [
    `${fixture.ruleId}/${fixture.expected}`,
    JSON.stringify(fixture.inputs, null, 2),
  ])))
  const [receiptId, setReceiptId] = useState('')
  const receipt = plan.receipts.find((item) => item.id === receiptId) ?? plan.receipts[0]
  const functions = plan.rules.filter((rule) => rule.requiresFixtures)

  function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reviewed || pending) return
    setFixtureError('')
    try {
      const qualified = functions.flatMap((rule) => (['pass', 'fail'] as const).map((expected) => {
        const value = fixtures.get(`${rule.id}/${expected}`)
        if (!value?.trim()) throw new Error(`请补充「${rule.title}」的通过和失败样例。`)
        try {
          return { ruleId: rule.id, expected, inputs: fixtureInputs(value) }
        } catch {
          throw new Error(`「${rule.title}」的${RESULT_LABEL[expected]}样例须为 JSON 对象，键为文件别名，值为文件正文。`)
        }
      }))
      void onAction({ action: 'activate', revisionId: plan.id, fixtures: qualified, reviewed: true })
    } catch (cause) {
      setFixtureError(message(cause))
    }
  }

  return (
    <section className="space-y-4 rounded-xl border px-3 py-3" aria-label="规则详情">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-0 break-words font-semibold">{plan.title} · v{plan.revision}</h3>
        <Badge variant={plan.status === 'active' ? 'secondary' : 'outline'}>{PLAN_LABEL[plan.status]}</Badge>
      </div>
      {plan.statusReason && <p className="text-sm text-muted-foreground">{plan.statusReason}</p>}
      <ul className="space-y-1 text-xs text-muted-foreground" aria-label="已绑定文件">
        {plan.inputs.map((input) => (
          <li key={input.alias} className="break-all">
            <code>{input.alias}</code> · {input.path} · {FORMAT_LABEL[input.format]}
          </li>
        ))}
      </ul>
      <div className="space-y-3">
        <h4 className="font-medium">需求与检查</h4>
        {plan.requirements.map((requirement) => {
          const rules = plan.rules.filter((rule) => rule.requirementId === requirement.id)
          return (
            <div key={requirement.id} className="space-y-2 rounded-lg border p-2.5">
              <blockquote className="max-h-28 overflow-auto whitespace-pre-wrap break-words border-l-2 pl-2 text-sm text-muted-foreground">
                {requirement.quote}
              </blockquote>
              {rules.length ? rules.map((rule) => (
                <div key={rule.id} className="space-y-1">
                  <p className="text-sm font-medium">{rule.title}</p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted px-2 py-1.5 text-xs">{rule.expression}</pre>
                </div>
              )) : <p className="text-xs text-muted-foreground">未验证 · 该需求没有可执行检查</p>}
            </div>
          )
        })}
      </div>
      {plan.status === 'draft' && (
        <form onSubmit={activate} className="space-y-3">
          {functions.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">函数样例</h4>
              <p className="text-xs text-muted-foreground">
                为每个函数确认一个应通过和一个应失败的样例。可以修改建议样例。键为文件别名，值为文件正文。
              </p>
              {functions.map((rule) => (
                <fieldset key={rule.id} disabled={pending !== null} className="rounded-lg border p-2.5">
                  <legend className="px-1 text-sm font-medium">{rule.title}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(['pass', 'fail'] as const).map((expected) => {
                      const key = `${rule.id}/${expected}`
                      return (
                        <label key={key} className="space-y-1">
                          <span className="text-xs font-medium">{RESULT_LABEL[expected]}样例</span>
                          <Textarea
                            className="max-h-36 font-mono text-xs!"
                            value={fixtures.get(key) ?? ''}
                            onChange={(event) => {
                              const value = event.target.value
                              setFixtures((current) => new Map(current).set(key, value))
                            }}
                            spellCheck={false}
                            required
                          />
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
          {fixtureError && <p role="alert" className="text-xs text-destructive">{fixtureError}</p>}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={reviewed} disabled={pending !== null} onChange={(event) => setReviewed(event.target.checked)} />
            我已核对需求、检查规则与样例预期。
          </label>
          <Button type="submit" disabled={!reviewed || pending !== null}>{pending === 'activate' ? '正在审核…' : '审核并启用'}</Button>
        </form>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {plan.status === 'active' && (
          <>
            <Button disabled={pending !== null} onClick={() => {
              setReceiptId('')
              void onAction({ action: 'validate', revisionId: plan.id })
            }}>{pending === 'validate' ? '正在校验…' : '校验当前文件'}</Button>
            <Button variant="outline" disabled={pending !== null} onClick={() => void onAction({ action: 'revoke', revisionId: plan.id })}>
              {pending === 'revoke' ? '正在撤销…' : '撤销版本'}
            </Button>
          </>
        )}
        <Button variant="ghost" disabled={pending !== null} onClick={onRevise}>生成新版本</Button>
      </div>
      {receipt && (
        <div className="space-y-2 border-t pt-3">
          {plan.receipts.length > 1 && (
            <label className="block space-y-1">
              <span className="text-xs font-medium">快照记录</span>
              <select className={SELECT_CLASS} value={receipt.id} onChange={(event) => setReceiptId(event.target.value)}>
                {plan.receipts.map((item) => (
                  <option key={item.id} value={item.id}>{DATE_FORMAT.format(item.createdAt)} · {RESULT_LABEL[item.status]}</option>
                ))}
              </select>
            </label>
          )}
          <ReceiptSummary receipt={receipt} plan={plan} />
        </div>
      )}
    </section>
  )
}

function ReceiptSummary({ receipt, plan }: { receipt: DeliveryReceiptView; plan: DeliveryPlanView }) {
  const rules = new Map(plan.rules.map((rule) => [rule.id, rule.title]))
  return (
    <section className="space-y-2" aria-label="文件快照校验结果" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-medium">快照校验结果</h4>
        <Badge variant={receipt.status === 'fail' ? 'destructive' : 'secondary'}>{RESULT_LABEL[receipt.status]}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        v{plan.revision} · {DATE_FORMAT.format(receipt.createdAt)}。结果对应此次读取的文件，文件改动后需重新校验。
      </p>
      <ul className="space-y-2">
        {receipt.checks.map((check, index) => (
          <li key={`${check.ruleId}/${index}`} className="space-y-1 rounded-md border p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={check.status === 'fail' ? 'destructive' : 'outline'}>{RESULT_LABEL[check.status]}</Badge>
              <span className="break-words text-sm">{rules.get(check.ruleId) ?? '需求覆盖检查'}</span>
            </div>
            {check.location && <code className="block break-all text-xs">{check.location}</code>}
            {check.reason && <p className="break-words text-xs text-muted-foreground">{check.reason}</p>}
            {check.expected && <p className="break-words text-xs">预期：{check.expected}</p>}
            {check.observed && <p className="break-words text-xs">实际：{check.observed}</p>}
          </li>
        ))}
      </ul>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">文件快照</summary>
        <ul className="mt-1 space-y-1">
          {receipt.inputs.map((input) => (
            <li key={input.alias} className="break-all">
              {input.path} · {INPUT_LABEL[input.status]}
              {input.sha256 && <> · <code title={input.sha256}>{input.sha256.slice(0, 12)}</code></>}
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : '交付校验请求失败，请重试。'
}
