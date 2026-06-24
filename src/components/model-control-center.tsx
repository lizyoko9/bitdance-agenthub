'use client'

import {
  Activity,
  CheckCircle2,
  Globe2,
  Loader2,
  Plus,
  RefreshCw,
  Route,
  Settings2,
  Trash2,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import type {
  AgentProfileRow,
  ModelConnectionTestRow,
  ModelProfileProvider,
  ModelProfileRow,
  ModelRouteDecisionRow,
  NetworkAppliesTo,
  NetworkMode,
  NetworkProfileRow,
  SecretKind,
} from '@/db/schema'
import {
  createCredentialScope,
  createModelProfile,
  createNetworkProfile,
  createSecret,
  deleteModelProfile,
  fetchAgentProfiles,
  fetchModelConnectionTests,
  fetchModelProfiles,
  fetchModelRouteDecisions,
  fetchNetworkProfiles,
  previewModelRoute,
  runModelCapabilityProbe,
  testModelConnection,
  testModelProfile,
  testNetworkProfile,
  updateModelProfile,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const modelProviders: ModelProfileProvider[] = [
  'openai',
  'anthropic',
  'deepseek',
  'google',
  'openrouter',
  'ollama',
  'custom',
  'volcano-ark',
  'openai-compatible',
]

const networkModes: NetworkMode[] = ['direct', 'http_proxy', 'socks5_proxy', 'custom_gateway']
const networkTargets: NetworkAppliesTo[] = ['model_only', 'browser_only', 'cli_only', 'all_agent_traffic']
const preferredModelStorageKey = 'agenthub:preferred-model-profile-id'

type SavingAction =
  | 'model'
  | 'network'
  | 'route'
  | `model:${string}`
  | `delete-model:${string}`
  | `network:${string}`
  | null

type ModelDraft = {
  name: string
  provider: ModelProfileProvider
  baseUrl: string
  apiKeyRef: string
  model: string
  contextWindow: string
  supportsVision: boolean
  supportsToolCalling: boolean
  supportsJsonMode: boolean
  networkProfileId: string
}

const providerDefaults: Record<
  ModelProfileProvider,
  Pick<ModelDraft, 'baseUrl' | 'apiKeyRef' | 'model' | 'contextWindow' | 'supportsVision' | 'supportsToolCalling' | 'supportsJsonMode'>
> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    apiKeyRef: 'env:DEEPSEEK_API_KEY',
    model: 'deepseek-v4-flash',
    contextWindow: '1000000',
    supportsVision: false,
    supportsToolCalling: true,
    supportsJsonMode: true,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    apiKeyRef: 'env:OPENAI_API_KEY',
    model: 'gpt-5',
    contextWindow: '400000',
    supportsVision: true,
    supportsToolCalling: true,
    supportsJsonMode: true,
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    apiKeyRef: 'env:ANTHROPIC_API_KEY',
    model: 'claude-sonnet-4',
    contextWindow: '200000',
    supportsVision: true,
    supportsToolCalling: true,
    supportsJsonMode: false,
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKeyRef: 'env:GOOGLE_API_KEY',
    model: 'gemini-1.5-flash',
    contextWindow: '1000000',
    supportsVision: true,
    supportsToolCalling: true,
    supportsJsonMode: true,
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyRef: 'env:OPENROUTER_API_KEY',
    model: 'openrouter/auto',
    contextWindow: '128000',
    supportsVision: true,
    supportsToolCalling: true,
    supportsJsonMode: true,
  },
  ollama: {
    baseUrl: 'http://127.0.0.1:11434/v1',
    apiKeyRef: 'env:OLLAMA_API_KEY',
    model: 'qwen2.5:14b',
    contextWindow: '32768',
    supportsVision: false,
    supportsToolCalling: false,
    supportsJsonMode: true,
  },
  custom: {
    baseUrl: 'https://example.com/v1',
    apiKeyRef: 'env:CUSTOM_MODEL_API_KEY',
    model: 'model-id',
    contextWindow: '128000',
    supportsVision: false,
    supportsToolCalling: true,
    supportsJsonMode: true,
  },
  'volcano-ark': {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKeyRef: 'env:ARK_API_KEY',
    model: 'doubao-seed-1-6',
    contextWindow: '256000',
    supportsVision: true,
    supportsToolCalling: true,
    supportsJsonMode: true,
  },
  'openai-compatible': {
    baseUrl: 'https://example.com/v1',
    apiKeyRef: 'env:OPENAI_COMPATIBLE_API_KEY',
    model: 'model-id',
    contextWindow: '128000',
    supportsVision: false,
    supportsToolCalling: true,
    supportsJsonMode: true,
  },
}

function defaultModelDraft(provider: ModelProfileProvider = 'deepseek'): ModelDraft {
  return {
    name: `${providerLabel(provider)} 主模型`,
    provider,
    ...providerDefaults[provider],
    networkProfileId: '',
  }
}

function modelToDraft(model: ModelProfileRow): ModelDraft {
  return {
    name: model.name,
    provider: model.provider,
    baseUrl: model.baseUrl,
    apiKeyRef: model.apiKeyRef,
    model: model.model,
    contextWindow: model.contextWindow ? String(model.contextWindow) : '',
    supportsVision: model.supportsVision,
    supportsToolCalling: model.supportsToolCalling,
    supportsJsonMode: model.supportsJsonMode,
    networkProfileId: model.networkProfileId ?? '',
  }
}

export function ModelControlCenter() {
  const [models, setModels] = useState<ModelProfileRow[]>([])
  const [networks, setNetworks] = useState<NetworkProfileRow[]>([])
  const [agents, setAgents] = useState<AgentProfileRow[]>([])
  const [connectionTests, setConnectionTests] = useState<ModelConnectionTestRow[]>([])
  const [routeDecisions, setRouteDecisions] = useState<ModelRouteDecisionRow[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [preferredModelId, setPreferredModelId] = useState('')
  const [selectedNetworkId, setSelectedNetworkId] = useState('')
  const [routeAgentId, setRouteAgentId] = useState('')
  const [routeNeedsVision, setRouteNeedsVision] = useState(false)
  const [routeNeedsTools, setRouteNeedsTools] = useState(true)
  const [routeNeedsJson, setRouteNeedsJson] = useState(true)
  const [addModelOpen, setAddModelOpen] = useState(false)
  const [showConfigPanel, setShowConfigPanel] = useState(false)
  const [editingModel, setEditingModel] = useState<ModelProfileRow | null>(null)
  const [pendingDeleteModelId, setPendingDeleteModelId] = useState<string | null>(null)
  const [inputTokens, setInputTokens] = useState('1200')
  const [outputTokens, setOutputTokens] = useState('800')
  const [networkDraft, setNetworkDraft] = useState({
    name: '直连模型出口',
    mode: 'direct' as NetworkMode,
    proxyUrl: '',
    bindInterface: '',
    regionLabel: '',
    appliesTo: 'model_only' as NetworkAppliesTo,
  })
  const [modelDraft, setModelDraft] = useState<ModelDraft>(() => defaultModelDraft())
  const [secretDraft, setSecretDraft] = useState({
    enabled: true,
    name: 'OpenAI 生产密钥',
    kind: 'env_ref' as SecretKind,
    valueRef: 'OPENAI_API_KEY',
    encryptedValue: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<SavingAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? null,
    [models, selectedModelId],
  )
  const preferredModel = useMemo(
    () => models.find((model) => model.id === preferredModelId) ?? null,
    [models, preferredModelId],
  )
  const selectedNetwork = useMemo(
    () => networks.find((network) => network.id === selectedNetworkId) ?? null,
    [networks, selectedNetworkId],
  )
  const workbenchModel = selectedModel ?? preferredModel ?? models[0] ?? null
  const workbenchNetwork =
    workbenchModel && workbenchModel.networkProfileId
      ? networks.find((network) => network.id === workbenchModel.networkProfileId) ?? null
      : selectedNetwork

  const openAddModelDialog = () => {
    setEditingModel(null)
    setModelDraft(defaultModelDraft())
    setAddModelOpen(true)
  }

  const openEditModelDialog = (model: ModelProfileRow) => {
    setEditingModel(model)
    setModelDraft(modelToDraft(model))
    setAddModelOpen(true)
  }

  const handleModelDialogOpenChange = (open: boolean) => {
    setAddModelOpen(open)
    if (!open) setEditingModel(null)
  }

  const upsertModelLocally = useCallback((model: ModelProfileRow) => {
    setModels((current) => [model, ...current.filter((item) => item.id !== model.id)])
  }, [])

  const removeModelLocally = useCallback((modelId: string) => {
    setModels((current) => current.filter((model) => model.id !== modelId))
  }, [])

  const modelsByNetwork = useMemo(() => {
    const counts = new Map<string, number>()
    for (const model of models) {
      if (!model.networkProfileId) continue
      counts.set(model.networkProfileId, (counts.get(model.networkProfileId) ?? 0) + 1)
    }
    return counts
  }, [models])

  useEffect(() => {
    try {
      setPreferredModelId(window.localStorage.getItem(preferredModelStorageKey) ?? '')
    } catch {
      setPreferredModelId('')
    }
  }, [])

  useEffect(() => {
    if (!preferredModelId) return
    if (!models.some((model) => model.id === preferredModelId)) return
    setSelectedModelId((current) => current || preferredModelId)
  }, [models, preferredModelId])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [modelsNext, networksNext, agentsNext, testsNext, routesNext] = await Promise.all([
        fetchModelProfiles(),
        fetchNetworkProfiles(),
        fetchAgentProfiles(),
        fetchModelConnectionTests(selectedModelId || undefined),
        fetchModelRouteDecisions(routeAgentId || undefined),
      ])
      setModels(modelsNext)
      setNetworks(networksNext)
      setAgents(agentsNext)
      setConnectionTests(testsNext)
      setRouteDecisions(routesNext)
      setSelectedModelId((current) =>
        current && modelsNext.some((model) => model.id === current) ? current : modelsNext[0]?.id ?? '',
      )
      setSelectedNetworkId((current) =>
        current && networksNext.some((network) => network.id === current)
          ? current
          : networksNext[0]?.id ?? '',
      )
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }, [routeAgentId, selectedModelId])

  const refreshModelsUntil = useCallback(
    async (isReady: (modelsNext: ModelProfileRow[]) => boolean, optimisticModel?: ModelProfileRow) => {
      const withOptimisticModel = (modelsNext: ModelProfileRow[]) =>
        optimisticModel
          ? [optimisticModel, ...modelsNext.filter((model) => model.id !== optimisticModel.id)]
          : modelsNext

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const modelsNext = withOptimisticModel(await fetchModelProfiles())
        setModels(modelsNext)
        if (isReady(modelsNext)) return modelsNext
        await new Promise((resolve) => window.setTimeout(resolve, 250))
      }

      const modelsNext = withOptimisticModel(await fetchModelProfiles())
      setModels(modelsNext)
      return modelsNext
    },
    [],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  const submitNetwork = async () => {
    setSaving('network')
    setError(null)
    setNotice(null)
    try {
      const network = await createNetworkProfile({
        ...networkDraft,
        proxyUrl: networkDraft.proxyUrl || null,
        bindInterface: networkDraft.bindInterface || null,
        regionLabel: networkDraft.regionLabel || null,
      })
      setSelectedNetworkId(network.id)
      setNotice('网络出口已创建')
      await reload()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(null)
    }
  }

  const submitModel = async () => {
    setSaving('model')
    setError(null)
    setNotice(null)
    try {
      const secret = secretDraft.enabled
        ? await createSecret({
            name: secretDraft.name.trim() || `${modelDraft.name.trim()} 密钥`,
            kind: secretDraft.kind,
            valueRef:
              secretDraft.kind === 'env_ref'
                ? requireTrimmed(secretDraft.valueRef, '请输入环境变量名。')
                : undefined,
            encryptedValue:
              secretDraft.kind === 'encrypted_value'
                ? requireTrimmed(secretDraft.encryptedValue, '请输入 API Key。')
                : undefined,
          })
        : null
      const model = await createModelProfile({
        ...modelDraft,
        apiKeyRef: secret ? `secret:${secret.id}` : modelDraft.apiKeyRef,
        contextWindow: parseNullableInt(modelDraft.contextWindow),
        networkProfileId: modelDraft.networkProfileId || selectedNetworkId || null,
      })
      upsertModelLocally(model)
      if (secret) {
        await Promise.all([
          createCredentialScope({
            secretId: secret.id,
            resourceType: 'model_profile',
            resourceId: model.id,
            capability: 'model.connect',
          }),
          createCredentialScope({
            secretId: secret.id,
            resourceType: 'model_profile',
            resourceId: model.id,
            capability: 'model.invoke',
          }),
        ])
        setSecretDraft((draft) => ({ ...draft, encryptedValue: '' }))
      }
      setSelectedModelId(model.id)
      setNotice(secret ? '模型配置已创建，密钥已自动绑定' : '模型配置已创建')
      await refreshModelsUntil((modelsNext) => modelsNext.some((item) => item.id === model.id), model)
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(null)
    }
  }

  const submitQuickModel = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    setSaving('model')
    setError(null)
    setNotice(null)
    try {
      const payload = {
        name: requireTrimmed(modelDraft.name, '请输入模型名称。'),
        provider: modelDraft.provider,
        baseUrl: requireTrimmed(modelDraft.baseUrl, '请输入 Base URL。'),
        apiKeyRef: requireTrimmed(modelDraft.apiKeyRef, '请输入 API Key 引用或环境变量名。'),
        model: requireTrimmed(modelDraft.model, '请输入模型 ID。'),
        contextWindow: parseNullableInt(modelDraft.contextWindow),
        supportsVision: modelDraft.supportsVision,
        supportsToolCalling: modelDraft.supportsToolCalling,
        supportsJsonMode: modelDraft.supportsJsonMode,
        networkProfileId: modelDraft.networkProfileId || null,
      }
      const model = editingModel
        ? await updateModelProfile(editingModel.id, payload)
        : await createModelProfile(payload)
      upsertModelLocally(model)
      setSelectedModelId(model.id)
      setAddModelOpen(false)
      setEditingModel(null)
      setNotice(editingModel ? '模型已保存，请重新检测连接状态' : '模型已添加，可以直接在智能体或普通对话里选择使用')
      await refreshModelsUntil((modelsNext) => modelsNext.some((item) => item.id === model.id), model)
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(null)
    }
  }

  const deleteModel = async (model: ModelProfileRow) => {
    setError(null)
    setNotice(null)
    if (pendingDeleteModelId !== model.id) {
      setPendingDeleteModelId(model.id)
      setNotice(`再次点击「确认删除」会删除模型：${model.name}`)
      return
    }
    setSaving(`delete-model:${model.id}`)
    try {
      await deleteModelProfile(model.id)
      removeModelLocally(model.id)
      setPendingDeleteModelId(null)
      setSelectedModelId((current) => (current === model.id ? '' : current))
      if (preferredModelId === model.id) {
        setPreferredModelId('')
        try {
          window.localStorage.removeItem(preferredModelStorageKey)
        } catch {
          // Best-effort local preference cleanup.
        }
      }
      setNotice(`已删除模型：${model.name}`)
      await refreshModelsUntil((modelsNext) => modelsNext.every((item) => item.id !== model.id))
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(null)
    }
  }

  const applyProviderDefaults = (provider: ModelProfileProvider) => {
    const defaults = providerDefaults[provider]
    setModelDraft((draft) => ({
      ...draft,
      ...defaults,
      provider,
      name: draft.name.trim() ? draft.name : `${providerLabel(provider)} 模型`,
    }))
  }

  const setAsPreferredModel = (model: ModelProfileRow) => {
    setPreferredModelId(model.id)
    setSelectedModelId(model.id)
    try {
      window.localStorage.setItem(preferredModelStorageKey, model.id)
    } catch {
      // Local preference is optional; the current session still updates.
    }
    setNotice(`已设为首选模型：${model.name}`)
  }

  const runModelTest = async (model: ModelProfileRow, live: boolean) => {
    setSaving(`model:${model.id}`)
    setError(null)
    setNotice(null)
    try {
      if (live) {
        const test = await testModelConnection(model.id, { live: true, confirmExternalCall: true })
        setNotice(`实时连接测试：${statusLabel(test.status)}`)
      } else {
        const [structural, connection] = await Promise.all([
          testModelProfile(model.id),
          testModelConnection(model.id, { live: false }),
        ])
        setNotice(`静态测试：${statusLabel(structural.status)}/${statusLabel(connection.status)}`)
      }
      await reload()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(null)
    }
  }

  const runModelInvokeProbe = async (model: ModelProfileRow) => {
    setSaving(`model:${model.id}`)
    setError(null)
    setNotice(null)
    try {
      const probe = await runModelCapabilityProbe(model.id, {
        kind: model.supportsJsonMode ? 'json' : 'text',
        live: true,
        confirmExternalCall: true,
      })
      setNotice(`推理探测：${statusLabel(probe.status)}`)
      await reload()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(null)
    }
  }

  const runNetworkTest = async (network: NetworkProfileRow) => {
    setSaving(`network:${network.id}`)
    setError(null)
    setNotice(null)
    try {
      const result = await testNetworkProfile(network.id)
      setNotice(`网络测试：${statusLabel(result.status)}`)
      await reload()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(null)
    }
  }

  const runRoutePreview = async () => {
    setSaving('route')
    setError(null)
    setNotice(null)
    try {
      const decision = await previewModelRoute({
        agentProfileId: routeAgentId || null,
        requestedCapabilities: {
          supportsVision: routeNeedsVision,
          supportsToolCalling: routeNeedsTools,
          supportsJsonMode: routeNeedsJson,
        },
        estimatedInputTokens: parsePositiveInt(inputTokens, 0),
        estimatedOutputTokens: parsePositiveInt(outputTokens, 0),
      })
      setNotice(`路由预览：${statusLabel(decision.status)}`)
      await reload()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(null)
    }
  }

  const selectModel = async (modelId: string) => {
    setSelectedModelId(modelId)
    setError(null)
    try {
      setConnectionTests(await fetchModelConnectionTests(modelId))
    } catch (err) {
      setError(formatError(err))
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="size-4" />
              <span className="truncate">模型管理</span>
            </div>
            <div className="mt-1 grid grid-cols-4 gap-1 text-[10px] text-muted-foreground">
              <Metric label="模型" value={models.length} />
              <Metric label="出口" value={networks.length} />
              <Metric label="测试" value={connectionTests.length} />
              <Metric label="路由" value={routeDecisions.length} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" className="h-8 gap-1" onClick={openAddModelDialog}>
              <Plus className="size-3.5" />
              添加模型
            </Button>
            <Button
              size="sm"
              variant={showConfigPanel ? 'default' : 'outline'}
              className="h-8 gap-1"
              onClick={() => setShowConfigPanel((value) => !value)}
            >
              <Settings2 className="size-3.5" />
              高级配置
            </Button>
            <Button size="icon" variant="ghost" onClick={() => void reload()} disabled={loading}>
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
        {(error || notice) && (
          <div
            className={cn(
              'mt-2 rounded-md border px-2 py-1.5 text-[11px]',
              error
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            )}
          >
            {error ?? notice}
          </div>
        )}
      </div>

      <Dialog open={addModelOpen} onOpenChange={handleModelDialogOpenChange}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingModel ? '编辑模型' : '添加模型'}</DialogTitle>
            <DialogDescription>
              {editingModel
                ? '修改后会立即影响后续对话和智能体调用，建议保存后重新检测连接。'
                : '这里添加一次，后面创建对话或配置智能体时就可以直接选择这个模型。'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => void submitQuickModel(event)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="模型名称">
                <Input
                  value={modelDraft.name}
                  onChange={(event) => setModelDraft((draft) => ({ ...draft, name: event.target.value }))}
                  placeholder="例如：DeepSeek 主模型"
                />
              </Field>
              <Field label="服务商">
                <select
                  value={modelDraft.provider}
                  onChange={(event) => applyProviderDefaults(event.target.value as ModelProfileProvider)}
                  className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
                >
                  {modelProviders.map((provider) => (
                    <option key={provider} value={provider}>
                      {providerLabel(provider)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="模型 ID">
              <Input
                value={modelDraft.model}
                onChange={(event) => setModelDraft((draft) => ({ ...draft, model: event.target.value }))}
                placeholder="例如：deepseek-v4-flash"
              />
            </Field>
            <Field label="Base URL">
              <Input
                value={modelDraft.baseUrl}
                onChange={(event) => setModelDraft((draft) => ({ ...draft, baseUrl: event.target.value }))}
                placeholder="https://api.deepseek.com"
              />
            </Field>
            <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
              <Field label="API Key 引用">
                <Input
                  value={modelDraft.apiKeyRef}
                  onChange={(event) =>
                    setModelDraft((draft) => ({ ...draft, apiKeyRef: event.target.value }))
                  }
                  placeholder="env:DEEPSEEK_API_KEY"
                />
              </Field>
              <Field label="上下文窗口">
                <Input
                  value={modelDraft.contextWindow}
                  onChange={(event) =>
                    setModelDraft((draft) => ({ ...draft, contextWindow: event.target.value }))
                  }
                  inputMode="numeric"
                  placeholder="1000000"
                />
              </Field>
            </div>
            <Field label="网络出口">
              <select
                value={modelDraft.networkProfileId}
                onChange={(event) =>
                  setModelDraft((draft) => ({ ...draft, networkProfileId: event.target.value }))
                }
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
              >
                <option value="">直连，不走代理</option>
                {networks.map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Toggle
                label="视觉"
                checked={modelDraft.supportsVision}
                onChange={(checked) => setModelDraft((draft) => ({ ...draft, supportsVision: checked }))}
              />
              <Toggle
                label="工具"
                checked={modelDraft.supportsToolCalling}
                onChange={(checked) =>
                  setModelDraft((draft) => ({ ...draft, supportsToolCalling: checked }))
                }
              />
              <Toggle
                label="JSON"
                checked={modelDraft.supportsJsonMode}
                onChange={(checked) => setModelDraft((draft) => ({ ...draft, supportsJsonMode: checked }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddModelOpen(false)}>
                取消
              </Button>
              <Button
                type="submit"
                className="gap-1"
                disabled={saving !== null || !modelDraft.name.trim() || !modelDraft.model.trim()}
              >
                {saving === 'model' ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                {editingModel ? '保存修改' : '保存模型'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          'grid min-h-0 flex-1',
          showConfigPanel ? 'grid-cols-[18rem_1fr]' : 'grid-cols-[1fr]',
        )}
      >
        {showConfigPanel && (
        <ScrollArea className="min-h-0 border-r">
          <div className="space-y-3 p-3">
            <Section title="网络出口">
              <Input
                value={networkDraft.name}
                onChange={(event) => setNetworkDraft((draft) => ({ ...draft, name: event.target.value }))}
                placeholder="出口名称"
              />
              <select
                value={networkDraft.mode}
                onChange={(event) =>
                  setNetworkDraft((draft) => ({ ...draft, mode: event.target.value as NetworkMode }))
                }
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
              >
                {networkModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {networkModeLabel(mode)}
                  </option>
                ))}
              </select>
              <Input
                value={networkDraft.proxyUrl}
                onChange={(event) => setNetworkDraft((draft) => ({ ...draft, proxyUrl: event.target.value }))}
                placeholder="代理地址"
              />
              <Input
                value={networkDraft.bindInterface}
                onChange={(event) =>
                  setNetworkDraft((draft) => ({ ...draft, bindInterface: event.target.value }))
                }
                placeholder="绑定网卡"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={networkDraft.regionLabel}
                  onChange={(event) =>
                    setNetworkDraft((draft) => ({ ...draft, regionLabel: event.target.value }))
                  }
                  placeholder="地区"
                />
                <select
                  value={networkDraft.appliesTo}
                  onChange={(event) =>
                    setNetworkDraft((draft) => ({
                      ...draft,
                      appliesTo: event.target.value as NetworkAppliesTo,
                    }))
                  }
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
                >
                  {networkTargets.map((target) => (
                    <option key={target} value={target}>
                      {networkTargetLabel(target)}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                className="h-8 w-full gap-1"
                onClick={() => void submitNetwork()}
                disabled={saving !== null || !networkDraft.name.trim()}
              >
                {saving === 'network' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                创建出口
              </Button>
            </Section>

            <Section title="模型配置">
              <Input
                value={modelDraft.name}
                onChange={(event) => setModelDraft((draft) => ({ ...draft, name: event.target.value }))}
                placeholder="配置名称"
              />
              <select
                value={modelDraft.provider}
                onChange={(event) =>
                  applyProviderDefaults(event.target.value as ModelProfileProvider)
                }
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
              >
                {modelProviders.map((provider) => (
                  <option key={provider} value={provider}>
                    {providerLabel(provider)}
                  </option>
                ))}
              </select>
              <Input
                value={modelDraft.baseUrl}
                onChange={(event) => setModelDraft((draft) => ({ ...draft, baseUrl: event.target.value }))}
                placeholder="基础地址"
              />
              <Input
                value={modelDraft.apiKeyRef}
                onChange={(event) => setModelDraft((draft) => ({ ...draft, apiKeyRef: event.target.value }))}
                placeholder="密钥引用"
                disabled={secretDraft.enabled}
              />
              <div className="rounded-md border bg-muted/20 p-2">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={secretDraft.enabled}
                    onChange={(event) =>
                      setSecretDraft((draft) => ({ ...draft, enabled: event.target.checked }))
                    }
                    className="size-3.5"
                  />
                  使用密钥库保存生产凭证
                </label>
                {secretDraft.enabled && (
                  <div className="mt-2 space-y-2">
                    <Input
                      value={secretDraft.name}
                      onChange={(event) =>
                        setSecretDraft((draft) => ({ ...draft, name: event.target.value }))
                      }
                      placeholder="密钥名称"
                    />
                    <select
                      value={secretDraft.kind}
                      onChange={(event) =>
                        setSecretDraft((draft) => ({
                          ...draft,
                          kind: event.target.value as SecretKind,
                        }))
                      }
                      className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
                    >
                      <option value="env_ref">读取系统环境变量</option>
                      <option value="encrypted_value">加密保存 API Key</option>
                    </select>
                    {secretDraft.kind === 'env_ref' ? (
                      <Input
                        value={secretDraft.valueRef}
                        onChange={(event) =>
                          setSecretDraft((draft) => ({ ...draft, valueRef: event.target.value }))
                        }
                        placeholder="环境变量名，例如 OPENAI_API_KEY"
                      />
                    ) : (
                      <Input
                        type="password"
                        value={secretDraft.encryptedValue}
                        onChange={(event) =>
                          setSecretDraft((draft) => ({
                            ...draft,
                            encryptedValue: event.target.value,
                          }))
                        }
                        placeholder="粘贴 API Key，保存后不再显示"
                      />
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={modelDraft.model}
                  onChange={(event) => setModelDraft((draft) => ({ ...draft, model: event.target.value }))}
                  placeholder="模型名称"
                />
                <Input
                  value={modelDraft.contextWindow}
                  onChange={(event) =>
                    setModelDraft((draft) => ({ ...draft, contextWindow: event.target.value }))
                  }
                  inputMode="numeric"
                  placeholder="上下文"
                />
              </div>
              <div className="grid grid-cols-3 gap-1">
                <Toggle
                  label="视觉"
                  checked={modelDraft.supportsVision}
                  onChange={(checked) =>
                    setModelDraft((draft) => ({ ...draft, supportsVision: checked }))
                  }
                />
                <Toggle
                  label="工具"
                  checked={modelDraft.supportsToolCalling}
                  onChange={(checked) =>
                    setModelDraft((draft) => ({ ...draft, supportsToolCalling: checked }))
                  }
                />
                <Toggle
                  label="JSON"
                  checked={modelDraft.supportsJsonMode}
                  onChange={(checked) =>
                    setModelDraft((draft) => ({ ...draft, supportsJsonMode: checked }))
                  }
                />
              </div>
              <Button
                className="h-8 w-full gap-1"
                onClick={() => void submitModel()}
                disabled={saving !== null || !modelDraft.name.trim() || !modelDraft.model.trim()}
              >
                {saving === 'model' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                创建模型
              </Button>
            </Section>
          </div>
        </ScrollArea>
        )}

        <ScrollArea className="min-h-0">
          <div className="space-y-3 p-3">
            <ModelConnectionWorkbench
              model={workbenchModel}
              preferred={Boolean(workbenchModel && workbenchModel.id === preferredModelId)}
              network={workbenchNetwork}
              latestTest={workbenchModel && selectedModelId === workbenchModel.id ? (connectionTests[0] ?? null) : null}
              saving={Boolean(workbenchModel && saving === `model:${workbenchModel.id}`)}
              onAddModel={openAddModelDialog}
              onDryTest={() => workbenchModel && void runModelTest(workbenchModel, false)}
              onLiveTest={() => workbenchModel && void runModelTest(workbenchModel, true)}
              onInvokeProbe={() => workbenchModel && void runModelInvokeProbe(workbenchModel)}
              onEdit={() => workbenchModel && openEditModelDialog(workbenchModel)}
              onSetPreferred={() => workbenchModel && setAsPreferredModel(workbenchModel)}
              onOpenAdvanced={() => setShowConfigPanel(true)}
            />

            <Section title="模型列表">
              <div className="mb-2 rounded-md border bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
                模型在这里统一管理。添加一次之后，普通对话和每个智能体都可以直接选择使用。
              </div>
              <div className="grid gap-2 xl:grid-cols-2">
                {models.length === 0 ? (
                  <EmptyState label="暂无模型配置" />
                ) : (
                  models.map((model) => (
                    <ModelRow
                      key={model.id}
                      model={model}
                      selected={model.id === selectedModelId}
                      preferred={model.id === preferredModelId}
                      network={networks.find((network) => network.id === model.networkProfileId) ?? null}
                      saving={saving === `model:${model.id}`}
                      deleting={saving === `delete-model:${model.id}`}
                      deleteArmed={pendingDeleteModelId === model.id}
                      onSelect={() => void selectModel(model.id)}
                      onDryTest={() => void runModelTest(model, false)}
                      onLiveTest={() => void runModelTest(model, true)}
                      onInvokeProbe={() => void runModelInvokeProbe(model)}
                      onEdit={() => openEditModelDialog(model)}
                      onDelete={() => void deleteModel(model)}
                    />
                  ))
                )}
              </div>
            </Section>

            {showConfigPanel && (
              <>
                <Section title="网络出口">
                  <div className="grid gap-2 xl:grid-cols-2">
                    {networks.length === 0 ? (
                      <EmptyState label="暂无网络出口" />
                    ) : (
                      networks.map((network) => (
                        <NetworkRow
                          key={network.id}
                          network={network}
                          selected={network.id === selectedNetworkId}
                          modelCount={modelsByNetwork.get(network.id) ?? 0}
                          saving={saving === `network:${network.id}`}
                          onSelect={() => setSelectedNetworkId(network.id)}
                          onTest={() => void runNetworkTest(network)}
                        />
                      ))
                    )}
                  </div>
                </Section>

                <Section title="路由预览">
                  <div className="grid grid-cols-[1fr_8rem_8rem] gap-2">
                    <select
                      value={routeAgentId}
                      onChange={(event) => setRouteAgentId(event.target.value)}
                      className="h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
                    >
                      <option value="">全部模型</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={inputTokens}
                      onChange={(event) => setInputTokens(event.target.value)}
                      inputMode="numeric"
                      placeholder="输入"
                    />
                    <Input
                      value={outputTokens}
                      onChange={(event) => setOutputTokens(event.target.value)}
                      inputMode="numeric"
                      placeholder="输出"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <Toggle label="视觉" checked={routeNeedsVision} onChange={setRouteNeedsVision} />
                    <Toggle label="工具" checked={routeNeedsTools} onChange={setRouteNeedsTools} />
                    <Toggle label="JSON" checked={routeNeedsJson} onChange={setRouteNeedsJson} />
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => void runRoutePreview()}
                      disabled={saving !== null}
                    >
                      {saving === 'route' ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Route className="size-3.5" />
                      )}
                      预览
                    </Button>
                  </div>
                </Section>

                <Section title="连接与推理测试">
                  <div className="space-y-2">
                    {connectionTests.length === 0 ? (
                      <EmptyState label="暂无测试记录" />
                    ) : (
                      connectionTests.slice(0, 20).map((test) => (
                        <RuntimeRow
                          key={test.id}
                          title={connectionTestTitle(test)}
                          subtitle={test.message}
                          badge={test.status}
                          meta={`${test.latencyMs ?? 0}ms · ${formatTime(test.createdAt)}`}
                        />
                      ))
                    )}
                  </div>
                </Section>

                <Section title="路由决策">
                  <div className="space-y-2">
                    {routeDecisions.length === 0 ? (
                      <EmptyState label="暂无路由决策" />
                    ) : (
                      routeDecisions.slice(0, 20).map((decision) => (
                        <RuntimeRow
                          key={decision.id}
                          title={statusLabel(decision.status)}
                          subtitle={decision.reason}
                          badge={decision.status}
                          meta={`${decision.estimatedCostCents}c · ${formatTime(decision.createdAt)}`}
                        />
                      ))
                    )}
                  </div>
                </Section>

                {selectedModel && (
                  <Section title="当前模型">
                    <RuntimeRow
                      title={selectedModel.name}
                      subtitle={`${selectedModel.provider} · ${selectedModel.model}`}
                      badge={selectedModel.healthStatus}
                      meta={selectedModel.lastTestResult ?? selectedModel.id}
                    />
                  </Section>
                )}

                {selectedNetwork && (
                  <Section title="当前出口">
                    <RuntimeRow
                      title={selectedNetwork.name}
                      subtitle={`${networkModeLabel(selectedNetwork.mode)} · ${networkTargetLabel(selectedNetwork.appliesTo)}`}
                      badge={selectedNetwork.healthStatus}
                      meta={selectedNetwork.lastTestResult ?? selectedNetwork.id}
                    />
                  </Section>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
        {title}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-2 py-1">
      <div className="tabular-nums text-foreground">{value}</div>
      <div className="truncate">{label}</div>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex h-8 items-center gap-2 rounded-md border px-2 text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5"
      />
      <span className="truncate">{label}</span>
    </label>
  )
}

function ModelConnectionWorkbench({
  model,
  preferred,
  network,
  latestTest,
  saving,
  onAddModel,
  onDryTest,
  onLiveTest,
  onInvokeProbe,
  onEdit,
  onSetPreferred,
  onOpenAdvanced,
}: {
  model: ModelProfileRow | null
  preferred: boolean
  network: NetworkProfileRow | null
  latestTest: ModelConnectionTestRow | null
  saving: boolean
  onAddModel: () => void
  onDryTest: () => void
  onLiveTest: () => void
  onInvokeProbe: () => void
  onEdit: () => void
  onSetPreferred: () => void
  onOpenAdvanced: () => void
}) {
  const failedTestMessage = latestTest?.status === 'failed' ? latestTest.message : null
  const failureReason = model?.lastTestResult ?? failedTestMessage ?? '暂无失败原因'
  const latestTestText = latestTest
    ? `${statusLabel(latestTest.status)} · ${latestTest.message || '没有返回说明'} · ${latestTest.latencyMs ?? 0}ms`
    : '暂无测试记录'

  return (
    <section
      data-testid="model-connection-workbench"
      className="overflow-hidden rounded-lg border bg-card text-card-foreground"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/20 px-3 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="size-4 text-primary" />
            <span>模型连接工作台</span>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            普通用户只需要在这里添加模型、设为首选模型、选择网络出口并一键检测。高级适配器参数已经收起来。
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" className="h-8 gap-1" onClick={onAddModel}>
            <Plus className="size-3.5" />
            添加模型
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={onOpenAdvanced}>
            <Settings2 className="size-3.5" />
            高级设置
          </Button>
        </div>
      </div>

      {!model ? (
        <div className="grid place-items-center px-3 py-8">
          <div className="max-w-sm text-center">
            <div className="text-sm font-semibold">还没有可用模型</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              先添加 DeepSeek、OpenAI、Gemini 或本地 Ollama，后面新建对话和智能体就能直接选择。
            </p>
            <Button className="mt-3 h-8 gap-1" onClick={onAddModel}>
              <Plus className="size-3.5" />
              添加第一个模型
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 p-3 xl:grid-cols-[1.2fr_1fr_0.9fr]">
          <div className="rounded-md border bg-background/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">{model.name}</h3>
                  {preferred && <Badge variant="secondary">首选模型</Badge>}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {providerLabel(model.provider)} · {model.model}
                </div>
              </div>
              <Badge variant={badgeTone(model.healthStatus)}>{statusLabel(model.healthStatus)}</Badge>
            </div>

            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <WorkbenchInfo label="服务商" value={providerLabel(model.provider)} />
              <WorkbenchInfo label="上下文" value={`${model.contextWindow ?? 0}`} />
              <WorkbenchInfo label="密钥" value={model.apiKeyRef || '未设置'} />
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
              <CapabilityChip enabled={model.supportsVision} label="视觉" />
              <CapabilityChip enabled={model.supportsToolCalling} label="工具调用" />
              <CapabilityChip enabled={model.supportsJsonMode} label="JSON 输出" />
            </div>
          </div>

          <div className="rounded-md border bg-background/60 p-3">
            <div className="grid gap-2 text-xs">
              <WorkbenchInfo label="连接状态" value={latestTestText} />
              <WorkbenchInfo
                label="网络出口"
                value={network ? `${network.name} · ${networkModeLabel(network.mode)}` : '直连，不走代理'}
              />
              <div className="rounded-md border bg-muted/20 px-2 py-2">
                <div className="text-[11px] font-semibold text-muted-foreground">失败原因</div>
                <div className="mt-1 line-clamp-3 text-xs">{failureReason}</div>
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-background/60 p-3">
            <div className="text-[11px] font-semibold text-muted-foreground">一键检测</div>
            <div className="mt-2 grid gap-2">
              <Button className="h-8 gap-1" onClick={onLiveTest} disabled={saving}>
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className="size-3.5" />}
                一键检测连接
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-1" onClick={onDryTest} disabled={saving}>
                  <CheckCircle2 className="size-3.5" />
                  静态检查
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1" onClick={onInvokeProbe} disabled={saving}>
                  <Zap className="size-3.5" />
                  推理探测
                </Button>
              </div>
              <Button
                size="sm"
                variant={preferred ? 'secondary' : 'outline'}
                className="h-8 gap-1"
                onClick={onSetPreferred}
                disabled={saving}
              >
                设为首选模型
              </Button>
              <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={onEdit} disabled={saving}>
                <Settings2 className="size-3.5" />
                编辑模型
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function WorkbenchInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-2 py-2">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-xs">{value}</div>
    </div>
  )
}

function CapabilityChip({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5',
        enabled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground',
      )}
    >
      {enabled ? '支持' : '不支持'} {label}
    </span>
  )
}

function ModelRow({
  model,
  selected,
  preferred,
  network,
  saving,
  deleting,
  deleteArmed,
  onSelect,
  onDryTest,
  onLiveTest,
  onInvokeProbe,
  onEdit,
  onDelete,
}: {
  model: ModelProfileRow
  selected: boolean
  preferred: boolean
  network: NetworkProfileRow | null
  saving: boolean
  deleting: boolean
  deleteArmed: boolean
  onSelect: () => void
  onDryTest: () => void
  onLiveTest: () => void
  onInvokeProbe: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      data-testid="model-profile-card"
      className={cn('rounded-md border px-2 py-2 text-xs', selected && 'border-primary/50 bg-primary/10')}
    >
      <button type="button" className="w-full text-left" onClick={onSelect}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="truncate font-medium">{model.name}</div>
              {preferred && <Badge variant="secondary">首选</Badge>}
            </div>
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {providerLabel(model.provider)} · {model.model}
            </div>
          </div>
          <Badge variant={badgeTone(model.healthStatus)}>{statusLabel(model.healthStatus)}</Badge>
        </div>
        <div className="mt-1 truncate text-[10px] text-muted-foreground">
          {network?.name ?? '直连'} · {model.contextWindow ?? 0} 上下文
        </div>
      </button>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button size="xs" variant="outline" className="gap-1" onClick={onDryTest} disabled={saving}>
          {saving ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
          静态
        </Button>
        <Button size="xs" variant="ghost" className="gap-1" onClick={onLiveTest} disabled={saving}>
          <Activity className="size-3" />
          连接
        </Button>
        <Button size="xs" variant="ghost" className="gap-1" onClick={onInvokeProbe} disabled={saving}>
          <Zap className="size-3" />
          推理
        </Button>
        <Button size="xs" variant="ghost" className="gap-1" onClick={onEdit} disabled={saving || deleting}>
          <Settings2 className="size-3" />
          编辑
        </Button>
        <Button
          size="xs"
          variant={deleteArmed ? 'destructive' : 'ghost'}
          className="ml-auto gap-1"
          title={deleteArmed ? '确认删除模型' : '删除模型'}
          aria-label={deleteArmed ? `确认删除模型 ${model.name}` : `删除模型 ${model.name}`}
          onClick={onDelete}
          disabled={saving || deleting}
        >
          {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
          {deleteArmed ? '确认删除' : '删除'}
        </Button>
      </div>
    </div>
  )
}

function NetworkRow({
  network,
  selected,
  modelCount,
  saving,
  onSelect,
  onTest,
}: {
  network: NetworkProfileRow
  selected: boolean
  modelCount: number
  saving: boolean
  onSelect: () => void
  onTest: () => void
}) {
  return (
    <div className={cn('rounded-md border px-2 py-2 text-xs', selected && 'border-primary/50 bg-primary/10')}>
      <button type="button" className="w-full text-left" onClick={onSelect}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium">{network.name}</div>
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {networkModeLabel(network.mode)} · {networkTargetLabel(network.appliesTo)}
            </div>
          </div>
          <Badge variant={badgeTone(network.healthStatus)}>{statusLabel(network.healthStatus)}</Badge>
        </div>
        <div className="mt-1 truncate text-[10px] text-muted-foreground">
          {network.regionLabel ?? '未设置地区'} · 模型 {modelCount}
        </div>
      </button>
      <Button size="xs" variant="outline" className="mt-2 gap-1" onClick={onTest} disabled={saving}>
        {saving ? <Loader2 className="size-3 animate-spin" /> : <Globe2 className="size-3" />}
        测试
      </Button>
    </div>
  )
}

function RuntimeRow({
  title,
  subtitle,
  badge,
  meta,
}: {
  title: string
  subtitle: string
  badge: string
  meta: string
}) {
  return (
    <div className="rounded-md border px-2 py-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{title}</div>
          <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
        <Badge variant={badgeTone(badge)}>{statusLabel(badge)}</Badge>
      </div>
      <div className="mt-1 truncate text-[10px] text-muted-foreground">{meta}</div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed px-2 py-4 text-center text-xs text-muted-foreground">
      {label}
    </div>
  )
}

function badgeTone(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ok' || status === 'selected') return 'secondary'
  if (status === 'failed' || status === 'no_match') return 'destructive'
  if (status === 'fallback_selected' || status === 'unknown') return 'outline'
  return 'default'
}

function connectionTestTitle(test: ModelConnectionTestRow): string {
  const checks = test.capabilityChecks as Record<string, unknown>
  const kind = typeof checks.capabilityProbeKind === 'string' ? checks.capabilityProbeKind : null
  return kind ? `${connectionModeLabel(test.mode)} / ${capabilityKindLabel(kind)}` : connectionModeLabel(test.mode)
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    ok: '正常',
    failed: '失败',
    unknown: '未知',
    selected: '已选择',
    no_match: '无匹配',
    fallback_selected: '已选备用',
    ready: '就绪',
    available: '可用',
    blocked: '已阻止',
    complete: '已完成',
  }
  return map[status] ?? status
}

function providerLabel(provider: string): string {
  const map: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    deepseek: 'DeepSeek',
    google: 'Google Gemini',
    openrouter: 'OpenRouter',
    ollama: 'Ollama 本地模型',
    custom: '自定义模型',
    'volcano-ark': '火山方舟',
    'openai-compatible': 'OpenAI 兼容接口',
  }
  return map[provider] ?? provider
}

function networkModeLabel(mode: string): string {
  const map: Record<string, string> = {
    direct: '直连',
    http_proxy: 'HTTP 代理',
    socks5_proxy: 'SOCKS5 代理',
    custom_gateway: '自定义网关',
  }
  return map[mode] ?? mode
}

function networkTargetLabel(target: string): string {
  const map: Record<string, string> = {
    model_only: '仅模型',
    browser_only: '仅浏览器',
    cli_only: '仅 CLI',
    all_agent_traffic: '全部智能体流量',
  }
  return map[target] ?? target
}

function connectionModeLabel(mode: string): string {
  const map: Record<string, string> = {
    dry: '静态',
    live: '连接',
  }
  return map[mode] ?? mode
}

function capabilityKindLabel(kind: string): string {
  const map: Record<string, string> = {
    text: '文本',
    json: 'JSON',
    tool_calling: '工具调用',
    vision: '视觉',
  }
  return map[kind] ?? kind
}

function requireTrimmed(value: string, message: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(message)
  return trimmed
}

function parseNullableInt(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function formatTime(value: number): string {
  return new Date(value).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
