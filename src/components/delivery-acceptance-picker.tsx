'use client'

import { Check, ChevronDown, ClipboardCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { fetchDeliveryValidation } from '@/lib/delivery-validation-api'
import type { DeliveryPlanView } from '@/shared/delivery-validation'

export type DeliveryAcceptanceChoice = Pick<DeliveryPlanView, 'id' | 'title' | 'revision'>

function versionLabel(plan: DeliveryAcceptanceChoice) {
  return `${plan.title} · v${plan.revision}`
}

export function DeliveryAcceptancePicker({ conversationId, choice, disabled, onChange }: {
  conversationId: string
  choice: DeliveryAcceptanceChoice | null
  disabled: boolean
  onChange: (choice: DeliveryAcceptanceChoice | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [plans, setPlans] = useState<DeliveryAcceptanceChoice[] | null>(null)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)

  useEffect(() => () => request.current?.abort(), [])

  function changeOpen(next: boolean) {
    request.current?.abort()
    setOpen(next)
    if (!next) return

    const controller = new AbortController()
    request.current = controller
    setPlans(null)
    setError('')
    void fetchDeliveryValidation(conversationId, controller.signal).then((catalog) => {
      if (controller.signal.aborted) return
      setPlans(catalog.plans.filter((plan) => plan.status === 'active').map(({ id, title, revision }) => ({
        id, title, revision,
      })))
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : '无法读取已启用的规则版本')
      }
    })
  }

  function choose(next: DeliveryAcceptanceChoice | null) {
    onChange(next)
    changeOpen(false)
  }

  return (
    <Popover open={open && !disabled} onOpenChange={changeOpen}>
      <PopoverTrigger render={
        <Button
          type="button"
          aria-label="完成时验收"
          aria-description={choice ? versionLabel(choice) : undefined}
          title={choice ? versionLabel(choice) : '完成时验收'}
          variant={choice ? 'secondary' : 'ghost'}
          size="sm"
          className="max-w-full"
          disabled={disabled}
        />
      }>
        <ClipboardCheck className="size-4" />
        完成时验收
        {choice && <span className="truncate font-normal text-muted-foreground">{versionLabel(choice)}</span>}
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 max-w-[calc(100vw-2rem)]">
        <PopoverTitle>为本次发送选择规则版本</PopoverTitle>
        <ActiveVersionList choice={choice} plans={plans} error={error} onChoose={choose} />
      </PopoverContent>
    </Popover>
  )
}

function ActiveVersionList({ choice, plans, error, onChoose }: {
  choice: DeliveryAcceptanceChoice | null
  plans: DeliveryAcceptanceChoice[] | null
  error: string
  onChoose: (choice: DeliveryAcceptanceChoice | null) => void
}) {
  return (
    <>
      {choice && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChoose(null)}>
          取消本次验收
        </Button>
      )}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p>
        : !plans ? <p role="status" className="text-xs text-muted-foreground">正在读取规则版本…</p>
          : plans.length ? (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {plans.map((plan) => (
                <Button
                  key={plan.id}
                  type="button"
                  variant="ghost"
                  className="w-full justify-start"
                  size="sm"
                  aria-pressed={choice?.id === plan.id}
                  onClick={() => onChoose(plan)}
                >
                  <span className="min-w-0 flex-1 truncate text-left">{versionLabel(plan)}</span>
                  {choice?.id === plan.id && <Check className="size-4" />}
                </Button>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">暂无可用版本。请先在本会话的「交付校验」中启用规则。</p>}
    </>
  )
}
