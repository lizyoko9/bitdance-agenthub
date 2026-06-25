'use client'

import {
  AlertTriangle,
  Check,
  Clipboard,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  Monitor,
  Network,
  Power,
  RotateCw,
  Settings as SettingsIcon,
  Smartphone,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { AppSettingsRow } from '@/db/schema'
import {
  fetchAppSettings,
  fetchConnectionHints,
  regenerateMobileDeviceToken,
  updateAppSettings,
  type AppSettingsPatchBody,
  type ConnectionHint,
} from '@/lib/api'
import { subscribeUiCommand } from '@/lib/ui-command-events'

interface SettingsForm {
  anthropicApiKey: string
  anthropicBaseUrl: string
  openaiApiKey: string
  deepseekApiKey: string
  arkApiKey: string
  companionMode: 'off' | 'lan' | 'tailnet'
  mobileDeviceToken: string
  deploymentPublishEnabled: boolean
  deploymentPublishDir: string
  deploymentPublicBaseUrl: string
}

const MOBILE_CONNECTION_ENABLED = false

/**
 * 全局 API key / endpoint 设置面板。
 *
 * 4 个 provider key + Anthropic 自定义 base URL。明文展示，因为本地单用户场景安全
 * 收益小且会引入 keychain / safeStorage 复杂度（详见 spec / CLAUDE.md §5.4）。
 *
 * 优先级（adapter 侧）：agent.apiKey > app_settings > process.env。
 */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hintsLoading, setHintsLoading] = useState(false)
  const [tokenBusy, setTokenBusy] = useState(false)
  const [restartRequired, setRestartRequired] = useState(false)
  const [connectionHints, setConnectionHints] = useState<ConnectionHint[]>([])
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [tab, setTab] = useState('keys')
  const [form, setForm] = useState<SettingsForm>({
    anthropicApiKey: '',
    anthropicBaseUrl: '',
    openaiApiKey: '',
    deepseekApiKey: '',
    arkApiKey: '',
    companionMode: 'off',
    mobileDeviceToken: '',
    deploymentPublishEnabled: false,
    deploymentPublishDir: '',
    deploymentPublicBaseUrl: '',
  })
  const [reveal, setReveal] = useState<Record<keyof SettingsForm, boolean>>({
    anthropicApiKey: false,
    anthropicBaseUrl: false,
    openaiApiKey: false,
    deepseekApiKey: false,
    arkApiKey: false,
    companionMode: true,
    mobileDeviceToken: false,
    deploymentPublishEnabled: true,
    deploymentPublishDir: true,
    deploymentPublicBaseUrl: true,
  })

  useEffect(() => {
    if (!MOBILE_CONNECTION_ENABLED && tab === 'mobile') setTab('keys')
  }, [tab])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    void Promise.resolve()
      .then(() => {
        if (!cancelled) {
          setRestartRequired(false)
          setLoading(true)
        }
        return fetchAppSettings()
      })
      .then((s) => {
        if (!cancelled) setForm(rowToForm(s))
      })
      .catch((err) => console.error('[SettingsDialog] load failed', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || !MOBILE_CONNECTION_ENABLED) return
    let cancelled = false

    void Promise.resolve()
      .then(() => {
        if (!cancelled) setHintsLoading(true)
        return fetchConnectionHints()
      })
      .then((hints) => {
        if (!cancelled) setConnectionHints(hints)
      })
      .catch((err) => console.error('[SettingsDialog] load connection hints failed', err))
      .finally(() => {
        if (!cancelled) setHintsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const handleSave = async () => {
    if (busy) return
    setBusy(true)
    try {
      // 空串归一 null，明确「清空」语义
      const patch: AppSettingsPatchBody = {
        anthropicApiKey: form.anthropicApiKey.trim() || null,
        anthropicBaseUrl: form.anthropicBaseUrl.trim() || null,
        openaiApiKey: form.openaiApiKey.trim() || null,
        deepseekApiKey: form.deepseekApiKey.trim() || null,
        arkApiKey: form.arkApiKey.trim() || null,
        companionMode: MOBILE_CONNECTION_ENABLED ? form.companionMode : 'off',
        mobileDeviceToken: MOBILE_CONNECTION_ENABLED ? form.mobileDeviceToken.trim() || null : null,
        deploymentPublishEnabled: form.deploymentPublishEnabled,
        deploymentPublishDir: form.deploymentPublishDir.trim() || null,
        deploymentPublicBaseUrl: form.deploymentPublicBaseUrl.trim() || null,
      }
      await updateAppSettings(patch)
      onOpenChange(false)
    } catch (err) {
      console.error('[SettingsDialog] save failed', err)
    } finally {
      setBusy(false)
    }
  }

  const handleCopyHint = async (hint: ConnectionHint) => {
    try {
      await navigator.clipboard.writeText(hint.url)
      setCopiedUrl(hint.url)
      window.setTimeout(() => setCopiedUrl(null), 1200)
    } catch (err) {
      console.error('[SettingsDialog] copy connection hint failed', err)
    }
  }

  const handleCopyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedUrl(value)
      window.setTimeout(() => setCopiedUrl(null), 1200)
    } catch (err) {
      console.error('[SettingsDialog] copy text failed', err)
    }
  }

  const handleEnableCompanion = async () => {
    if (busy) return
    setBusy(true)
    try {
      const next = await updateAppSettings({
        companionMode: 'tailnet',
        mobileDeviceToken: form.mobileDeviceToken.trim() || null,
      })
      setForm(rowToForm(next))
      setConnectionHints(await fetchConnectionHints())
      setRestartRequired(true)
    } catch (err) {
      console.error('[SettingsDialog] enable companion failed', err)
    } finally {
      setBusy(false)
    }
  }

  const handleDisableCompanion = async () => {
    if (busy) return
    setBusy(true)
    try {
      const next = await updateAppSettings({ companionMode: 'off' })
      setForm(rowToForm(next))
      setConnectionHints(await fetchConnectionHints())
      setRestartRequired(true)
    } catch (err) {
      console.error('[SettingsDialog] disable companion failed', err)
    } finally {
      setBusy(false)
    }
  }

  const handleRegenerateToken = async () => {
    if (tokenBusy) return
    setTokenBusy(true)
    try {
      const next = await regenerateMobileDeviceToken()
      setForm(rowToForm(next))
    } catch (err) {
      console.error('[SettingsDialog] regenerate mobile token failed', err)
    } finally {
      setTokenBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100vh-2rem)] max-w-xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription className="sr-only">AgentHub 设置</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-0 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
            <div className="flex items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="keys">
                  <KeyRound className="size-3.5" />
                  供应商 Key
                </TabsTrigger>
                {MOBILE_CONNECTION_ENABLED && (
                  <TabsTrigger value="mobile">
                    <Smartphone className="size-3.5" />
                    移动端
                  </TabsTrigger>
                )}
              </TabsList>
              {tab === 'keys' && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      type="button"
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
                      aria-label="供应商 Key 说明"
                    >
                      <Info className="size-4" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-72 whitespace-normal text-left leading-5">
                      填写常用供应商的 API Key。填写后将覆盖系统环境变量；留空则继续使用环境变量（如有）。
                      Agent 设置中单独配置的 Key 仍然优先级最高。
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div className="min-h-0 overflow-y-auto pr-1">
              <TabsContent value="keys" className="mt-0 flex flex-col gap-3 py-1">
                <KeyField
                  label="Anthropic API Key"
                  hint="用于 Claude Code adapter / custom anthropic provider。"
                  value={form.anthropicApiKey}
                  reveal={reveal.anthropicApiKey}
                  onChange={(v) => setForm((f) => ({ ...f, anthropicApiKey: v }))}
                  onToggleReveal={() =>
                    setReveal((r) => ({ ...r, anthropicApiKey: !r.anthropicApiKey }))
                  }
                />
                <KeyField
                  label="Anthropic Base URL（可选）"
                  hint="走第三方网关时填，如 https://anyrouter.top；留空走官方 endpoint。"
                  type="text"
                  value={form.anthropicBaseUrl}
                  reveal
                  onChange={(v) => setForm((f) => ({ ...f, anthropicBaseUrl: v }))}
                />
                <KeyField
                  label="OpenAI API Key"
                  value={form.openaiApiKey}
                  reveal={reveal.openaiApiKey}
                  onChange={(v) => setForm((f) => ({ ...f, openaiApiKey: v }))}
                  onToggleReveal={() => setReveal((r) => ({ ...r, openaiApiKey: !r.openaiApiKey }))}
                />
                <KeyField
                  label="DeepSeek API Key"
                  value={form.deepseekApiKey}
                  reveal={reveal.deepseekApiKey}
                  onChange={(v) => setForm((f) => ({ ...f, deepseekApiKey: v }))}
                  onToggleReveal={() => setReveal((r) => ({ ...r, deepseekApiKey: !r.deepseekApiKey }))}
                />
                <KeyField
                  label="Volcano Ark API Key"
                  value={form.arkApiKey}
                  reveal={reveal.arkApiKey}
                  onChange={(v) => setForm((f) => ({ ...f, arkApiKey: v }))}
                  onToggleReveal={() => setReveal((r) => ({ ...r, arkApiKey: !r.arkApiKey }))}
                />
              </TabsContent>

              {MOBILE_CONNECTION_ENABLED && (
                <TabsContent value="mobile" className="mt-0 py-1">
                  <MobileConnectionHints
                    hints={connectionHints}
                    loading={hintsLoading}
                    copiedUrl={copiedUrl}
                    companionMode={form.companionMode}
                    mobileDeviceToken={form.mobileDeviceToken}
                    busy={busy}
                    tokenBusy={tokenBusy}
                    restartRequired={restartRequired}
                    onCopy={(hint) => void handleCopyHint(hint)}
                    onCopyText={(value) => void handleCopyText(value)}
                    onEnable={() => void handleEnableCompanion()}
                    onDisable={() => void handleDisableCompanion()}
                    onRegenerateToken={() => void handleRegenerateToken()}
                  />
                </TabsContent>
              )}
            </div>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button onClick={() => void handleSave()} disabled={busy || loading}>
            {busy ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MobileConnectionHints({
  hints,
  loading,
  copiedUrl,
  companionMode,
  mobileDeviceToken,
  busy,
  tokenBusy,
  restartRequired,
  onCopy,
  onCopyText,
  onEnable,
  onDisable,
  onRegenerateToken,
}: {
  hints: ConnectionHint[]
  loading: boolean
  copiedUrl: string | null
  companionMode: 'off' | 'lan' | 'tailnet'
  mobileDeviceToken: string
  busy: boolean
  tokenBusy: boolean
  restartRequired: boolean
  onCopy: (hint: ConnectionHint) => void
  onCopyText: (value: string) => void
  onEnable: () => void
  onDisable: () => void
  onRegenerateToken: () => void
}) {
  const enabled = companionMode !== 'off'

  return (
    <section className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">移动端连接</h3>
        </div>
        <Button
          type="button"
          size="sm"
          variant={enabled ? 'outline' : 'default'}
          disabled={busy}
          onClick={enabled ? onDisable : onEnable}
        >
          <Power className="size-3.5" />
          {enabled ? '关闭' : '开启'}
        </Button>
      </div>

      {loading ? (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {restartRequired && (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 flex-none" />
              <div className="min-w-0">
                <p className="text-xs font-semibold">请重启桌面端 App</p>
                <p className="mt-1 text-[11px] leading-4">
                  开启或关闭移动端连接后，监听地址需要重启后才会生效。
                </p>
              </div>
            </div>
          )}

          <div className="rounded-md border bg-background px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <KeyRound className="size-4 flex-none text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{enabled ? '已开启' : '未开启'}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {enabled ? '重启桌面端后生效' : '开启后生成设备 token'}
                  </p>
                </div>
              </div>
              {mobileDeviceToken && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="复制设备 token"
                  title="复制 token"
                  onClick={() => onCopyText(mobileDeviceToken)}
                >
                  {copiedUrl === mobileDeviceToken ? (
                    <Check className="size-4" />
                  ) : (
                    <Clipboard className="size-4" />
                  )}
                </Button>
              )}
            </div>
            {mobileDeviceToken && (
              <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                {mobileDeviceToken}
              </p>
            )}
          </div>

          {enabled && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={tokenBusy}
              onClick={onRegenerateToken}
            >
              {tokenBusy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
              重新生成 token
            </Button>
          )}

          {hints.map((hint) => (
            <div
              key={hint.url}
              className="flex items-center gap-2 rounded-md border bg-background px-2 py-2"
            >
              {hintIcon(hint.kind)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{hint.label}</span>
                  {hint.interfaceName && (
                    <span className="text-[10px] text-muted-foreground">{hint.interfaceName}</span>
                  )}
                </div>
                <p className="truncate font-mono text-[11px] text-muted-foreground">{hint.url}</p>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`复制 ${hint.label} 地址`}
                title="复制"
                onClick={() => onCopy(hint)}
              >
                {copiedUrl === hint.url ? <Check className="size-4" /> : <Clipboard className="size-4" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function hintIcon(kind: ConnectionHint['kind']) {
  switch (kind) {
    case 'tailscale':
    case 'lan':
      return <Network className="size-4 flex-none text-muted-foreground" />
    case 'local':
      return <Monitor className="size-4 flex-none text-muted-foreground" />
  }
}

function KeyField({
  label,
  hint,
  value,
  reveal,
  type = 'password',
  onChange,
  onToggleReveal,
}: {
  label: string
  hint?: string
  value: string
  reveal: boolean
  type?: 'password' | 'text'
  onChange: (v: string) => void
  onToggleReveal?: () => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium">{label}</label>
      <div className="relative">
        <Input
          type={type === 'text' || reveal ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className={onToggleReveal ? 'pr-9 font-mono text-xs' : 'font-mono text-xs'}
        />
        {onToggleReveal && (
          <button
            type="button"
            onClick={onToggleReveal}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            title={reveal ? '隐藏' : '显示'}
          >
            {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        )}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/80">{hint}</p>}
    </div>
  )
}

/** 设置 button 入口，挂在 Sidebar header。 */
export function SettingsButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    return subscribeUiCommand((command) => {
      if (command === 'open-settings') setOpen(true)
    })
  }, [])

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="group"
        onClick={() => setOpen(true)}
        title="API 设置"
        aria-label="API 设置"
      >
        <SettingsIcon className="size-4 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover:rotate-45 motion-safe:group-active:scale-90" />
      </Button>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

function rowToForm(row: AppSettingsRow): SettingsForm {
  return {
    anthropicApiKey: row.anthropicApiKey ?? '',
    anthropicBaseUrl: row.anthropicBaseUrl ?? '',
    openaiApiKey: row.openaiApiKey ?? '',
    deepseekApiKey: row.deepseekApiKey ?? '',
    arkApiKey: row.arkApiKey ?? '',
    companionMode: row.companionMode,
    mobileDeviceToken: row.mobileDeviceToken ?? '',
    deploymentPublishEnabled: row.deploymentPublishEnabled,
    deploymentPublishDir: row.deploymentPublishDir ?? '',
    deploymentPublicBaseUrl: row.deploymentPublicBaseUrl ?? '',
  }
}
