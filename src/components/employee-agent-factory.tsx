'use client'

import {
  Activity,
  Bot,
  BrainCircuit,
  Camera,
  CheckCircle2,
  Database,
  Eye,
  Loader2,
  Network,
  Package,
  Palette,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Square,
  Terminal,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type {
  AgentProfileRow,
  AgentInterviewRow,
  AgentStyleGuideBindingRow,
  AgentDiversityProfileRow,
  AgentPersonality,
  AgentPersonaTone,
  AgentRiskPosture,
  AuditLogRow,
  ArtifactValidationRow,
  BudgetEventRow,
  CliProfileRow,
  CliRunRow,
  ComputerActionEventRow,
  ComputerSessionRow,
  DecisionAuditTrailRow,
  DiversityAnalysisRow,
  EmployeeRunEventRow,
  EmployeeRunRow,
  LearningEventRow,
  McpServerRow,
  McpTransport,
  MemoryItemRow,
  ModelProfileProvider,
  ModelProfileRow,
  MultimodalInputRow,
  MultimodalOutputRow,
  NetworkAppliesTo,
  NetworkMode,
  NetworkProfileRow,
  OnboardingSessionRow,
  PerformanceReviewRow,
  PromptTemplateRow,
  PromptTemplateScope,
  PromptTemplateVersionRow,
  RecoveryEventRow,
  RunReflectionRow,
  RuntimeContextSnapshotRow,
  SoftwareAdapterType,
  SoftwareAppType,
  SoftwareProfileRow,
  StyleGuideRow,
  ToolConnectionRow,
  ToolConnectionType,
  WorkstationMode,
} from '@/db/schema'
import {
  analyzeAgentDiversity,
  approveLearningEvent,
  bindStyleGuideToAgent,
  cancelEmployeeRun,
  completeOnboardingSession,
  configureOnboardingAgent,
  createAgentProfile,
  createAgentInterview,
  createCliProfile,
  createMcpServer,
  createModelProfile,
  createNetworkProfile,
  createPerformanceReview,
  createPromptTemplate,
  createSoftwareCommand,
  createSoftwareProfile,
  createStyleGuide,
  createToolConnection,
  fetchAgentDiversityProfiles,
  fetchAgentStyleGuideBindings,
  fetchAgentProfiles,
  fetchAgentInterviews,
  fetchDiversityAnalyses,
  fetchCliProfiles,
  fetchEmployeeRunSnapshot,
  fetchEmployeeRuns,
  fetchMcpServers,
  fetchModelProfiles,
  fetchNetworkProfiles,
  fetchOnboardingSessions,
  fetchPerformanceReviews,
  fetchPromptTemplateCatalog,
  fetchSoftwareProfiles,
  fetchStyleGuides,
  fetchToolConnections,
  pauseEmployeeRun,
  rejectLearningEvent,
  recordComputerObservation,
  resumeEmployeeRun,
  runOnboardingDemo,
  startEmployeeRun,
  startOnboardingSession,
  updateAgentProfile,
  upsertAgentDiversityProfile,
  type CreateAgentProfileBody,
  type OnboardingWorkType,
} from '@/lib/api'
import { cn } from '@/lib/utils'

type FactoryTab = 'control' | 'agent' | 'run'
type FactoryFocusSection = 'capabilities'

interface EmployeeAgentFactoryProps {
  initialAgentProfileId?: string
  initialAgentName?: string
  initialAgentDescription?: string
  embedded?: boolean
  initialTab?: FactoryTab
  initialFocusSection?: FactoryFocusSection
  title?: string
  subtitle?: string
}

const MODEL_PROVIDERS: ModelProfileProvider[] = [
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

const NETWORK_MODES: NetworkMode[] = ['direct', 'http_proxy', 'socks5_proxy', 'custom_gateway']
const NETWORK_TARGETS: NetworkAppliesTo[] = [
  'model_only',
  'browser_only',
  'cli_only',
  'all_agent_traffic',
]
const TOOL_TYPES: ToolConnectionType[] = ['mcp', 'cli', 'software', 'api']
const MCP_TRANSPORTS: McpTransport[] = ['stdio', 'sse', 'http']
const SOFTWARE_APP_TYPES: SoftwareAppType[] = [
  'native_app',
  'browser_app',
  'cli_app',
  'mobile_app',
  'api_service',
  'script',
]
const SOFTWARE_ADAPTERS: SoftwareAdapterType[] = [
  'cli',
  'mcp',
  'api',
  'browser_automation',
  'desktop_automation',
  'recorded_macro',
  'hybrid',
]
const WORKSTATION_MODES: WorkstationMode[] = [
  'browser_context',
  'physical_desktop',
  'virtual_desktop',
  'vm',
  'remote_session',
]
const AGENT_PERSONA_TONES: AgentPersonaTone[] = [
  'formal',
  'casual',
  'technical',
  'friendly',
  'concise',
  'detailed',
]
const AGENT_PERSONALITIES: AgentPersonality[] = [
  'creative',
  'cautious',
  'user_advocate',
  'security',
  'performance',
  'operator',
  'custom',
]
const RISK_POSTURES: AgentRiskPosture[] = ['bold', 'balanced', 'conservative']
const PERSONA_TONE_LABELS: Record<AgentPersonaTone, string> = {
  formal: '正式稳重',
  casual: '轻松自然',
  technical: '技术专家',
  friendly: '友好协作',
  concise: '简洁直接',
  detailed: '详细耐心',
}
const PERSONALITY_LABELS: Record<AgentPersonality, string> = {
  creative: '创意型',
  cautious: '谨慎型',
  user_advocate: '用户视角',
  security: '安全优先',
  performance: '效率优先',
  operator: '执行型',
  custom: '自定义',
}
const RISK_POSTURE_LABELS: Record<AgentRiskPosture, string> = {
  bold: '大胆执行',
  balanced: '平衡',
  conservative: '保守',
}
const WORKSTATION_MODE_LABELS: Record<WorkstationMode, string> = {
  browser_context: '独立浏览器',
  physical_desktop: '当前电脑桌面',
  virtual_desktop: '虚拟桌面',
  vm: '虚拟机',
  remote_session: '远程会话',
}
const AUTONOMY_LABELS: Record<string, string> = {
  observe_only: '只观察',
  propose_only: '只给建议',
  execute_with_approval: '执行前确认',
  execute_low_risk: '低风险自动执行',
  fully_autonomous: '完全自主',
}
const ONBOARDING_WORK_TYPES: OnboardingWorkType[] = [
  'coding',
  'documentation',
  'data',
  'browser',
  'files',
  'other',
]
const ONBOARDING_WORK_LABELS: Record<OnboardingWorkType, string> = {
  coding: 'Writing code',
  documentation: 'Writing docs',
  data: 'Working with data',
  browser: 'Browsing web pages',
  files: 'Organizing files',
  other: 'Other work',
}

interface FactoryData {
  models: ModelProfileRow[]
  networks: NetworkProfileRow[]
  cliProfiles: CliProfileRow[]
  mcpServers: McpServerRow[]
  promptTemplates: PromptTemplateRow[]
  promptTemplateVersions: PromptTemplateVersionRow[]
  toolConnections: ToolConnectionRow[]
  softwareProfiles: SoftwareProfileRow[]
  styleGuides: StyleGuideRow[]
  styleGuideBindings: AgentStyleGuideBindingRow[]
  agentDiversityProfiles: AgentDiversityProfileRow[]
  diversityAnalyses: DiversityAnalysisRow[]
  agentInterviews: AgentInterviewRow[]
  performanceReviews: PerformanceReviewRow[]
  agentProfiles: AgentProfileRow[]
  employeeRuns: EmployeeRunRow[]
}

interface NetworkDraft {
  name: string
  mode: NetworkMode
  proxyUrl: string
  appliesTo: NetworkAppliesTo
}

interface ModelDraft {
  name: string
  provider: ModelProfileProvider
  baseUrl: string
  apiKeyRef: string
  model: string
  contextWindow: string
  networkProfileId: string
  supportsVision: boolean
  supportsToolCalling: boolean
  supportsJsonMode: boolean
}

interface CliDraft {
  name: string
  command: string
  argsTemplate: string
  requiresApproval: boolean
}

interface ToolDraft {
  displayName: string
  type: ToolConnectionType
  enabled: boolean
}

interface McpDraft {
  displayName: string
  transport: McpTransport
  command: string
  endpoint: string
}

interface PromptTemplateDraft {
  name: string
  description: string
  scope: PromptTemplateScope
  systemPrompt: string
  contextRulesText: string
}

interface SoftwareDraft {
  name: string
  appType: SoftwareAppType
  adapterType: SoftwareAdapterType
  launchCommand: string
  defaultWorkstationMode: WorkstationMode
}

interface SoftwareCommandDraft {
  softwareProfileId: string
  name: string
  description: string
  riskLevel: 'low'
  requiresApproval: boolean
}

interface StyleGuideDraft {
  name: string
  tone: string
  forbiddenWordsText: string
  preferredTermsText: string
  sentenceLength: 'short' | 'medium' | 'varied'
  useOxfordComma: boolean
  indentStyle: 'space' | 'tab'
  indentSize: string
  quotes: 'single' | 'double'
  semicolons: boolean
  maxLineLength: string
  namingConvention: 'camelCase' | 'PascalCase' | 'snake_case'
  colorPaletteText: string
  fontFamily: string
  logoUrl: string
  preferDarkTheme: boolean
}

interface AgentDraft {
  name: string
  role: string
  description: string
  modelProfileId: string
  workstationMode: WorkstationMode
  outputArtifactType: string
  personaAvatar: string
  personaTone: AgentPersonaTone
  personaLanguage: string
  personaSelfReference: string
  personaUseEmoji: boolean
  personaUseCodeBlocks: boolean
  personaPreferBulletPoints: boolean
  personaShowThinkingProcess: boolean
  personaCautious: string
  personaCreative: string
  personaThorough: string
  personaEfficient: string
  skillsText: string
  mcpText: string
  behaviorRulesText: string
  successCriteriaText: string
  systemPrompt: string
  memoryEnabled: boolean
  memoryScopeAgent: boolean
  memoryScopeProject: boolean
  memoryScopeWorkspace: boolean
  memoryWriteReflection: boolean
  canReadFiles: boolean
  canWriteFiles: boolean
  canRunCommands: boolean
  canUseBrowser: boolean
  canUseDesktop: boolean
  canUseNetwork: boolean
  autonomyLevel: string
  selectedCliIds: string[]
  selectedMcpIds: string[]
  selectedSoftwareIds: string[]
  selectedPromptTemplateId: string
  selectedStyleGuideId: string
  personality: AgentPersonality
  perspective: string
  temperature: string
  riskPosture: AgentRiskPosture
  collaborationRole: string
  accessibilityHtmlAltText: boolean
  accessibilitySemanticHtml: boolean
  accessibilityAriaLabels: boolean
  accessibilityColorContrast: boolean
  accessibilityDocumentHeadings: boolean
  accessibilityDescriptiveLinks: boolean
  accessibilityImageAltText: boolean
  accessibilityColorBlindPalette: boolean
}

interface InterviewDraft {
  scenarioTitle: string
  scenarioTask: string
  planResponse: string
  feedbackPrompt: string
  feedbackResponse: string
}

interface RunDraft {
  goal: string
  budgetLimitCents: string
  autoComplete: boolean
}

const emptyData: FactoryData = {
  models: [],
  networks: [],
  cliProfiles: [],
  mcpServers: [],
  promptTemplates: [],
  promptTemplateVersions: [],
  toolConnections: [],
  softwareProfiles: [],
  styleGuides: [],
  styleGuideBindings: [],
  agentDiversityProfiles: [],
  diversityAnalyses: [],
  agentInterviews: [],
  performanceReviews: [],
  agentProfiles: [],
  employeeRuns: [],
}

function findInitialAgentProfile(
  profiles: AgentProfileRow[],
  initialAgentProfileId?: string,
  initialAgentName?: string,
): AgentProfileRow | null {
  const byId = initialAgentProfileId
    ? profiles.find((profile) => profile.id === initialAgentProfileId)
    : null
  if (byId) return byId

  const normalizedName = initialAgentName?.trim().toLowerCase()
  if (!normalizedName) return null

  return (
    profiles.find((profile) => profile.name.trim().toLowerCase() === normalizedName) ??
    profiles.find((profile) => profile.name.trim().toLowerCase().includes(normalizedName)) ??
    null
  )
}

function buildAgentProfileBody(draft: AgentDraft): CreateAgentProfileBody {
  return {
    name: draft.name,
    role: draft.role,
    description: draft.description,
    modelProfileId: nullableText(draft.modelProfileId),
    skillIds: splitList(draft.skillsText),
    mcpServerIds: [...draft.selectedMcpIds, ...splitList(draft.mcpText)],
    cliProfileIds: draft.selectedCliIds,
    softwareProfileIds: draft.selectedSoftwareIds,
    memoryPolicy: {
      enabled: draft.memoryEnabled,
      scopes: [
        draft.memoryScopeAgent ? 'agent' : null,
        draft.memoryScopeProject ? 'project' : null,
        draft.memoryScopeWorkspace ? 'workspace' : null,
      ].filter((scope): scope is string => Boolean(scope)),
      writeReflection: draft.memoryWriteReflection,
    },
    autonomyPolicy: {
      level: draft.autonomyLevel,
      selfRecovery: true,
      requireApprovalForHighRisk: true,
    },
    workstationPolicy: {
      mode: draft.workstationMode,
      isolatedBrowserProfile: true,
      isolatedWorkspace: true,
    },
    permissionPolicy: {
      files: { read: draft.canReadFiles, write: draft.canWriteFiles },
      commands: { run: draft.canRunCommands },
      browser: { operate: draft.canUseBrowser },
      desktop: { operate: draft.canUseDesktop },
      network: { access: draft.canUseNetwork },
    },
    inputContract: {
      type: 'object',
      required: ['goal'],
      promptTemplateId: nullableText(draft.selectedPromptTemplateId),
    },
    persona: {
      avatar: draft.personaAvatar,
      tone: draft.personaTone,
      language: draft.personaLanguage,
      communicationStyle: {
        useEmoji: draft.personaUseEmoji,
        useCodeBlocks: draft.personaUseCodeBlocks,
        preferBulletPoints: draft.personaPreferBulletPoints,
        showThinkingProcess: draft.personaShowThinkingProcess,
        selfReference: draft.personaSelfReference,
      },
      personalityTraits: {
        cautious: parseTrait(draft.personaCautious),
        creative: parseTrait(draft.personaCreative),
        thorough: parseTrait(draft.personaThorough),
        efficient: parseTrait(draft.personaEfficient),
      },
    },
    outputContract: {
      artifactType: draft.outputArtifactType,
      validationRules: splitList(draft.successCriteriaText),
      accessibility: {
        html: {
          requireAltText: draft.accessibilityHtmlAltText,
          requireSemanticHTML: draft.accessibilitySemanticHtml,
          requireARIALabels: draft.accessibilityAriaLabels,
          checkColorContrast: draft.accessibilityColorContrast,
        },
        documents: {
          requireHeadings: draft.accessibilityDocumentHeadings,
          requireDescriptiveLinks: draft.accessibilityDescriptiveLinks,
        },
        images: {
          generateAltText: draft.accessibilityImageAltText,
          suggestColorBlindPalette: draft.accessibilityColorBlindPalette,
        },
      },
    },
    systemPrompt: draft.systemPrompt,
    behaviorRules: splitList(draft.behaviorRulesText),
    successCriteria: splitList(draft.successCriteriaText),
    status: 'active',
  }
}

function agentProfileToDraft(profile: AgentProfileRow, current: AgentDraft): AgentDraft {
  const memoryPolicy = asRecord(profile.memoryPolicy)
  const memoryScopes = stringArrayValue(memoryPolicy.scopes)
  const permissionPolicy = asRecord(profile.permissionPolicy)
  const autonomyPolicy = asRecord(profile.autonomyPolicy)
  const workstationPolicy = asRecord(profile.workstationPolicy)
  const inputContract = asRecord(profile.inputContract)
  const outputContract = asRecord(profile.outputContract)
  const persona = asRecord(profile.persona)
  const communicationStyle = asRecord(persona.communicationStyle)
  const personalityTraits = asRecord(persona.personalityTraits)
  const accessibility = asRecord(outputContract.accessibility)
  const htmlAccessibility = asRecord(accessibility.html)
  const documentAccessibility = asRecord(accessibility.documents)
  const imageAccessibility = asRecord(accessibility.images)

  return {
    ...current,
    name: profile.name,
    role: profile.role,
    description: profile.description,
    modelProfileId: profile.modelProfileId ?? '',
    selectedCliIds: profile.cliProfileIds,
    selectedMcpIds: profile.mcpServerIds,
    selectedSoftwareIds: profile.softwareProfileIds,
    skillsText: profile.skillIds.join('\n'),
    mcpText: '',
    outputArtifactType: stringValue(outputContract.artifactType, current.outputArtifactType),
    selectedPromptTemplateId: stringValue(inputContract.promptTemplateId, ''),
    workstationMode: workstationModeValue(workstationPolicy.mode, current.workstationMode),
    autonomyLevel: stringValue(autonomyPolicy.level, current.autonomyLevel),
    canReadFiles: nestedBoolean(permissionPolicy, 'files', 'read', current.canReadFiles),
    canWriteFiles: nestedBoolean(permissionPolicy, 'files', 'write', current.canWriteFiles),
    canRunCommands: nestedBoolean(permissionPolicy, 'commands', 'run', current.canRunCommands),
    canUseBrowser: nestedBoolean(permissionPolicy, 'browser', 'operate', current.canUseBrowser),
    canUseDesktop: nestedBoolean(permissionPolicy, 'desktop', 'operate', current.canUseDesktop),
    canUseNetwork: nestedBoolean(permissionPolicy, 'network', 'access', current.canUseNetwork),
    personaAvatar: stringValue(persona.avatar, current.personaAvatar),
    personaTone: personaToneValue(persona.tone, current.personaTone),
    personaLanguage: stringValue(persona.language, current.personaLanguage),
    personaSelfReference: stringValue(communicationStyle.selfReference, current.personaSelfReference),
    personaUseEmoji: booleanValue(communicationStyle.useEmoji, current.personaUseEmoji),
    personaUseCodeBlocks: booleanValue(communicationStyle.useCodeBlocks, current.personaUseCodeBlocks),
    personaPreferBulletPoints: booleanValue(
      communicationStyle.preferBulletPoints,
      current.personaPreferBulletPoints,
    ),
    personaShowThinkingProcess: booleanValue(
      communicationStyle.showThinkingProcess,
      current.personaShowThinkingProcess,
    ),
    personaCautious: traitString(personalityTraits.cautious, current.personaCautious),
    personaCreative: traitString(personalityTraits.creative, current.personaCreative),
    personaThorough: traitString(personalityTraits.thorough, current.personaThorough),
    personaEfficient: traitString(personalityTraits.efficient, current.personaEfficient),
    accessibilityHtmlAltText: booleanValue(
      htmlAccessibility.requireAltText,
      current.accessibilityHtmlAltText,
    ),
    accessibilitySemanticHtml: booleanValue(
      htmlAccessibility.requireSemanticHTML,
      current.accessibilitySemanticHtml,
    ),
    accessibilityAriaLabels: booleanValue(
      htmlAccessibility.requireARIALabels,
      current.accessibilityAriaLabels,
    ),
    accessibilityColorContrast: booleanValue(
      htmlAccessibility.checkColorContrast,
      current.accessibilityColorContrast,
    ),
    accessibilityDocumentHeadings: booleanValue(
      documentAccessibility.requireHeadings,
      current.accessibilityDocumentHeadings,
    ),
    accessibilityDescriptiveLinks: booleanValue(
      documentAccessibility.requireDescriptiveLinks,
      current.accessibilityDescriptiveLinks,
    ),
    accessibilityImageAltText: booleanValue(
      imageAccessibility.generateAltText,
      current.accessibilityImageAltText,
    ),
    accessibilityColorBlindPalette: booleanValue(
      imageAccessibility.suggestColorBlindPalette,
      current.accessibilityColorBlindPalette,
    ),
    systemPrompt: profile.systemPrompt,
    memoryEnabled: booleanValue(memoryPolicy.enabled, current.memoryEnabled),
    memoryScopeAgent: memoryScopes.includes('agent'),
    memoryScopeProject: memoryScopes.includes('project'),
    memoryScopeWorkspace: memoryScopes.includes('workspace'),
    memoryWriteReflection: booleanValue(memoryPolicy.writeReflection, current.memoryWriteReflection),
    behaviorRulesText: profile.behaviorRules.join('\n'),
    successCriteriaText: profile.successCriteria.join('\n'),
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function nestedBoolean(
  record: Record<string, unknown>,
  groupKey: string,
  fieldKey: string,
  fallback: boolean,
): boolean {
  return booleanValue(asRecord(record[groupKey])[fieldKey], fallback)
}

function traitString(value: unknown, fallback: string): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback
}

function workstationModeValue(value: unknown, fallback: WorkstationMode): WorkstationMode {
  return typeof value === 'string' && WORKSTATION_MODES.includes(value as WorkstationMode)
    ? (value as WorkstationMode)
    : fallback
}

function personaToneValue(value: unknown, fallback: AgentPersonaTone): AgentPersonaTone {
  return typeof value === 'string' && AGENT_PERSONA_TONES.includes(value as AgentPersonaTone)
    ? (value as AgentPersonaTone)
    : fallback
}

export function EmployeeAgentFactory({
  initialAgentProfileId,
  initialAgentName,
  initialAgentDescription,
  embedded = false,
  initialTab = embedded ? 'agent' : 'control',
  initialFocusSection,
  title,
  subtitle,
}: EmployeeAgentFactoryProps = {}) {
  const [data, setData] = useState<FactoryData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FactoryTab>(initialTab)
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [selectedRunId, setSelectedRunId] = useState('')
  const [runEvents, setRunEvents] = useState<EmployeeRunEventRow[]>([])
  const [runCliRuns, setRunCliRuns] = useState<CliRunRow[]>([])
  const [runComputerSessions, setRunComputerSessions] = useState<ComputerSessionRow[]>([])
  const [runComputerActions, setRunComputerActions] = useState<ComputerActionEventRow[]>([])
  const [runContextSnapshots, setRunContextSnapshots] = useState<RuntimeContextSnapshotRow[]>([])
  const [runBudgetEvents, setRunBudgetEvents] = useState<BudgetEventRow[]>([])
  const [runDecisionAudits, setRunDecisionAudits] = useState<DecisionAuditTrailRow[]>([])
  const [runSecurityAuditLogs, setRunSecurityAuditLogs] = useState<AuditLogRow[]>([])
  const [runRecoveryEvents, setRunRecoveryEvents] = useState<RecoveryEventRow[]>([])
  const [runArtifactValidations, setRunArtifactValidations] = useState<ArtifactValidationRow[]>([])
  const [runMultimodalInputs, setRunMultimodalInputs] = useState<MultimodalInputRow[]>([])
  const [runMultimodalOutputs, setRunMultimodalOutputs] = useState<MultimodalOutputRow[]>([])
  const [runLearningEvents, setRunLearningEvents] = useState<LearningEventRow[]>([])
  const [runMemories, setRunMemories] = useState<MemoryItemRow[]>([])
  const [runReflection, setRunReflection] = useState<RunReflectionRow | null>(null)

  const [networkDraft, setNetworkDraft] = useState<NetworkDraft>({
    name: 'Direct model network',
    mode: 'direct' as NetworkMode,
    proxyUrl: '',
    appliesTo: 'model_only' as NetworkAppliesTo,
  })
  const [modelDraft, setModelDraft] = useState<ModelDraft>({
    name: 'Primary model',
    provider: 'openai' as ModelProfileProvider,
    baseUrl: 'https://api.openai.com/v1',
    apiKeyRef: 'OPENAI_API_KEY',
    model: 'model-id',
    contextWindow: '',
    networkProfileId: '',
    supportsVision: false,
    supportsToolCalling: true,
    supportsJsonMode: true,
  })
  const [cliDraft, setCliDraft] = useState<CliDraft>({
    name: 'Codex CLI',
    command: 'codex',
    argsTemplate: '',
    requiresApproval: true,
  })
  const [toolDraft, setToolDraft] = useState<ToolDraft>({
    displayName: 'Local MCP tools',
    type: 'mcp' as ToolConnectionType,
    enabled: true,
  })
  const [mcpDraft, setMcpDraft] = useState<McpDraft>({
    displayName: 'Local MCP server',
    transport: 'stdio',
    command: '',
    endpoint: '',
  })
  const [promptTemplateDraft, setPromptTemplateDraft] = useState<PromptTemplateDraft>({
    name: 'Employee context template',
    description: 'Shared context rules for employee-grade task execution.',
    scope: 'workspace',
    systemPrompt: 'You are an employee-grade Agent. Work from the goal, tool scope, memory, and required artifact contract.',
    contextRulesText:
      'Use only visible context and selected tools.\nVerify required artifacts before completion.\nRecord uncertainty and recovery steps.',
  })
  const [softwareDraft, setSoftwareDraft] = useState<SoftwareDraft>({
    name: 'Chrome',
    appType: 'browser_app' as SoftwareAppType,
    adapterType: 'browser_automation' as SoftwareAdapterType,
    launchCommand: '',
    defaultWorkstationMode: 'browser_context' as WorkstationMode,
  })
  const [softwareCommandDraft, setSoftwareCommandDraft] = useState<SoftwareCommandDraft>({
    softwareProfileId: '',
    name: 'Open target URL',
    description: 'Navigate the browser automation profile to a target URL.',
    riskLevel: 'low' as const,
    requiresApproval: false,
  })
  const [styleGuideDraft, setStyleGuideDraft] = useState<StyleGuideDraft>({
    name: 'Product brand guide',
    tone: 'clear, confident, and practical',
    forbiddenWordsText: '',
    preferredTermsText: 'AI app=Agent OS\nbot=Agent employee',
    sentenceLength: 'varied',
    useOxfordComma: false,
    indentStyle: 'space',
    indentSize: '2',
    quotes: 'single',
    semicolons: false,
    maxLineLength: '100',
    namingConvention: 'camelCase',
    colorPaletteText: '#111827\n#2563eb\n#10b981',
    fontFamily: 'Inter',
    logoUrl: '',
    preferDarkTheme: false,
  })
  const [agentDraft, setAgentDraft] = useState<AgentDraft>({
    name: 'Research Employee',
    role: 'researcher',
    description: 'Finds information, validates it, and produces a report artifact.',
    modelProfileId: '',
    workstationMode: 'browser_context' as WorkstationMode,
    outputArtifactType: 'report',
    personaAvatar: 'agent',
    personaTone: 'friendly',
    personaLanguage: 'zh-CN',
    personaSelfReference: 'I',
    personaUseEmoji: false,
    personaUseCodeBlocks: true,
    personaPreferBulletPoints: true,
    personaShowThinkingProcess: false,
    personaCautious: '0.6',
    personaCreative: '0.4',
    personaThorough: '0.7',
    personaEfficient: '0.6',
    skillsText: '',
    mcpText: '',
    behaviorRulesText: 'State uncertainty clearly.\nVerify before marking work complete.',
    successCriteriaText: 'Required artifact is produced.\nResult is verifiable from logs/events.',
    systemPrompt: 'You are an employee-grade Agent with scoped tools and required artifacts.',
    memoryEnabled: true,
    memoryScopeAgent: true,
    memoryScopeProject: true,
    memoryScopeWorkspace: true,
    memoryWriteReflection: true,
    canReadFiles: true,
    canWriteFiles: true,
    canRunCommands: false,
    canUseBrowser: true,
    canUseDesktop: false,
    canUseNetwork: true,
    autonomyLevel: 'execute_low_risk',
    selectedCliIds: [] as string[],
    selectedMcpIds: [] as string[],
    selectedSoftwareIds: [] as string[],
    selectedPromptTemplateId: '',
    selectedStyleGuideId: '',
    personality: 'cautious',
    perspective: 'implementation quality',
    temperature: '0.4',
    riskPosture: 'balanced',
    collaborationRole: 'contributor',
    accessibilityHtmlAltText: true,
    accessibilitySemanticHtml: true,
    accessibilityAriaLabels: true,
    accessibilityColorContrast: true,
    accessibilityDocumentHeadings: true,
    accessibilityDescriptiveLinks: true,
    accessibilityImageAltText: true,
    accessibilityColorBlindPalette: true,
  })
  const [interviewDraft, setInterviewDraft] = useState<InterviewDraft>({
    scenarioTitle: 'Frontend onboarding interview',
    scenarioTask: 'Create a user list component with search, reuse existing components where possible, and describe validation.',
    planResponse: '',
    feedbackPrompt: 'User feedback: responsive layout is not needed. How do you adjust?',
    feedbackResponse: '',
  })
  const [runDraft, setRunDraft] = useState<RunDraft>({
    goal: 'Research the requested topic and produce a concise verified report.',
    budgetLimitCents: '',
    autoComplete: true,
  })

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        models,
        networks,
        cliProfiles,
        mcpServers,
        promptCatalog,
        toolConnections,
        softwareProfiles,
        styleGuides,
        styleGuideBindings,
        agentDiversityProfiles,
        diversityAnalyses,
        agentInterviews,
        performanceReviews,
        agentProfiles,
        employeeRuns,
      ] = await Promise.all([
        fetchModelProfiles(),
        fetchNetworkProfiles(),
        fetchCliProfiles(),
        fetchMcpServers(),
        fetchPromptTemplateCatalog(),
        fetchToolConnections(),
        fetchSoftwareProfiles(),
        fetchStyleGuides(),
        fetchAgentStyleGuideBindings(),
        fetchAgentDiversityProfiles(),
        fetchDiversityAnalyses(),
        fetchAgentInterviews(),
        fetchPerformanceReviews(),
        fetchAgentProfiles(),
        fetchEmployeeRuns(),
      ])
      setData({
        models,
        networks,
        cliProfiles,
        mcpServers,
        promptTemplates: promptCatalog.promptTemplates,
        promptTemplateVersions: promptCatalog.promptTemplateVersions,
        toolConnections,
        softwareProfiles,
        styleGuides,
        styleGuideBindings,
        agentDiversityProfiles,
        diversityAnalyses,
        agentInterviews,
        performanceReviews,
        agentProfiles,
        employeeRuns,
      })
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const preferredInitialAgent = useMemo(
    () => findInitialAgentProfile(data.agentProfiles, initialAgentProfileId, initialAgentName),
    [data.agentProfiles, initialAgentName, initialAgentProfileId],
  )

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    if (preferredInitialAgent && selectedAgentId !== preferredInitialAgent.id) {
      setSelectedAgentId(preferredInitialAgent.id)
    }
  }, [preferredInitialAgent, selectedAgentId])

  useEffect(() => {
    if (embedded && initialAgentName && !preferredInitialAgent) return
    if (!selectedAgentId && (preferredInitialAgent ?? data.agentProfiles[0])) {
      setSelectedAgentId((preferredInitialAgent ?? data.agentProfiles[0]).id)
    }
  }, [data.agentProfiles, embedded, initialAgentName, preferredInitialAgent, selectedAgentId])

  useEffect(() => {
    if (!embedded || preferredInitialAgent || !initialAgentName) return
    if (selectedAgentId) setSelectedAgentId('')
    setAgentDraft((draft) => ({
      ...draft,
      name: initialAgentName,
      role: draft.role === 'Researcher' ? '智能体员工' : draft.role,
      description: initialAgentDescription ?? draft.description,
    }))
  }, [embedded, initialAgentDescription, initialAgentName, preferredInitialAgent, selectedAgentId])

  useEffect(() => {
    if (!agentDraft.modelProfileId && data.models[0]) {
      setAgentDraft((draft) => ({ ...draft, modelProfileId: data.models[0].id }))
    }
  }, [agentDraft.modelProfileId, data.models])

  useEffect(() => {
    if (!softwareCommandDraft.softwareProfileId && data.softwareProfiles[0]) {
      setSoftwareCommandDraft((draft) => ({
        ...draft,
        softwareProfileId: data.softwareProfiles[0].id,
      }))
    }
  }, [data.softwareProfiles, softwareCommandDraft.softwareProfileId])

  useEffect(() => {
    if (!agentDraft.selectedStyleGuideId && data.styleGuides[0]) {
      setAgentDraft((draft) => ({ ...draft, selectedStyleGuideId: data.styleGuides[0].id }))
    }
  }, [agentDraft.selectedStyleGuideId, data.styleGuides])

  useEffect(() => {
    if (!selectedRunId && data.employeeRuns[0]) {
      setSelectedRunId(data.employeeRuns[0].id)
    }
  }, [data.employeeRuns, selectedRunId])

  const selectedRun = useMemo(
    () => data.employeeRuns.find((run) => run.id === selectedRunId) ?? null,
    [data.employeeRuns, selectedRunId],
  )

  const selectedAgent = useMemo(
    () => data.agentProfiles.find((agent) => agent.id === selectedAgentId) ?? null,
    [data.agentProfiles, selectedAgentId],
  )

  useEffect(() => {
    if (!selectedAgent) return
    setAgentDraft((draft) => agentProfileToDraft(selectedAgent, draft))
  }, [selectedAgent])

  const refreshRunSnapshot = useCallback(async (runId: string) => {
    try {
      const snapshot = await fetchEmployeeRunSnapshot(runId)
      setRunEvents(snapshot.events)
      setRunCliRuns(snapshot.cliRuns)
      setRunComputerSessions(snapshot.computerSessions)
      setRunComputerActions(snapshot.computerActionEvents)
      setRunContextSnapshots(snapshot.contextSnapshots)
      setRunBudgetEvents(snapshot.budgetEvents)
      setRunDecisionAudits(snapshot.decisionAuditTrails)
      setRunSecurityAuditLogs(snapshot.securityAuditLogs)
      setRunRecoveryEvents(snapshot.recoveryEvents)
      setRunArtifactValidations(snapshot.artifactValidations)
      setRunMultimodalInputs(snapshot.multimodalInputs)
      setRunMultimodalOutputs(snapshot.multimodalOutputs)
      setRunLearningEvents(snapshot.learningEvents)
      setRunMemories(snapshot.memoryItems)
      setRunReflection(snapshot.reflection)
    } catch (err) {
      setError(formatError(err))
    }
  }, [])

  const recordRunComputerObservation = (
    session: ComputerSessionRow,
    kind: 'observe' | 'screenshot',
  ) =>
    runAction(kind === 'observe' ? 'Computer observation' : 'Screenshot marker', async () => {
      await recordComputerObservation(session.id, {
        summary:
          kind === 'observe'
            ? 'Manual UI observation marker for this Agent workstation.'
            : 'Screenshot marker requested from UI; live screen capture is not enabled in this safe runtime.',
        viewport: {
          mode: session.mode,
          workspacePath: session.workspacePath,
          captureRequested: kind === 'screenshot',
        },
      })
      if (selectedRunId) await refreshRunSnapshot(selectedRunId)
    })

  useEffect(() => {
    if (!selectedRunId) {
      setRunEvents([])
      setRunCliRuns([])
      setRunComputerSessions([])
      setRunComputerActions([])
      setRunContextSnapshots([])
      setRunBudgetEvents([])
      setRunDecisionAudits([])
      setRunSecurityAuditLogs([])
      setRunRecoveryEvents([])
      setRunArtifactValidations([])
      setRunMultimodalInputs([])
      setRunMultimodalOutputs([])
      setRunLearningEvents([])
      setRunMemories([])
      setRunReflection(null)
      return
    }
    void refreshRunSnapshot(selectedRunId)
  }, [refreshRunSnapshot, selectedRunId])

  const runAction = async (label: string, action: () => Promise<void>) => {
    setSaving(label)
    setError(null)
    setNotice(null)
    try {
      await action()
      setNotice(`${label} saved`)
      await reload()
    } catch (err) {
      setError(formatError(err))
    } finally {
      setSaving(null)
    }
  }

  const createNetwork = () =>
    runAction('Network profile', async () => {
      await createNetworkProfile({
        name: networkDraft.name,
        mode: networkDraft.mode,
        proxyUrl: nullableText(networkDraft.proxyUrl),
        appliesTo: networkDraft.appliesTo,
      })
    })

  const createModel = () =>
    runAction('Model profile', async () => {
      await createModelProfile({
        name: modelDraft.name,
        provider: modelDraft.provider,
        baseUrl: modelDraft.baseUrl,
        apiKeyRef: modelDraft.apiKeyRef,
        model: modelDraft.model,
        contextWindow: modelDraft.contextWindow ? Number(modelDraft.contextWindow) : null,
        supportsVision: modelDraft.supportsVision,
        supportsToolCalling: modelDraft.supportsToolCalling,
        supportsJsonMode: modelDraft.supportsJsonMode,
        networkProfileId: nullableText(modelDraft.networkProfileId),
      })
    })

  const createCli = () =>
    runAction('CLI profile', async () => {
      await createCliProfile({
        name: cliDraft.name,
        command: cliDraft.command,
        argsTemplate: cliDraft.argsTemplate,
        cwdPolicy: 'agent_workspace',
        inputMode: 'args',
        outputMode: 'stdout',
        requiresApproval: cliDraft.requiresApproval,
      })
    })

  const createTool = () =>
    runAction('Tool connection', async () => {
      await createToolConnection({
        displayName: toolDraft.displayName,
        type: toolDraft.type,
        config: {},
        enabled: toolDraft.enabled,
      })
    })

  const createMcp = () =>
    runAction('MCP server', async () => {
      await createMcpServer({
        displayName: mcpDraft.displayName,
        transport: mcpDraft.transport,
        command: nullableText(mcpDraft.command),
        endpoint: nullableText(mcpDraft.endpoint),
        enabled: true,
      })
    })

  const createPrompt = () =>
    runAction('Prompt template', async () => {
      await createPromptTemplate({
        name: promptTemplateDraft.name,
        description: promptTemplateDraft.description,
        scope: promptTemplateDraft.scope,
        systemPrompt: promptTemplateDraft.systemPrompt,
        contextRules: splitList(promptTemplateDraft.contextRulesText),
        inputSchema: { type: 'object', required: ['goal'] },
        outputSchema: { type: 'object' },
        modelHints: { useWith: 'employee_runtime' },
        status: 'active',
      })
    })

  const createSoftware = () =>
    runAction('Software profile', async () => {
      await createSoftwareProfile({
        name: softwareDraft.name,
        appType: softwareDraft.appType,
        adapterType: softwareDraft.adapterType,
        launchCommand: nullableText(softwareDraft.launchCommand),
        defaultWorkstationMode: softwareDraft.defaultWorkstationMode,
      })
    })

  const createCommand = () =>
    runAction('Software command', async () => {
      if (!softwareCommandDraft.softwareProfileId) throw new Error('Select a software profile first.')
      await createSoftwareCommand(softwareCommandDraft.softwareProfileId, {
        name: softwareCommandDraft.name,
        description: softwareCommandDraft.description,
        implementation: { type: 'browser', steps: [] },
        inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { status: { type: 'string' } } },
        riskLevel: softwareCommandDraft.riskLevel,
        requiresApproval: softwareCommandDraft.requiresApproval,
      })
    })

  const createGuide = () =>
    runAction('Style guide', async () => {
      await createStyleGuide({
        name: styleGuideDraft.name,
        language: {
          tone: styleGuideDraft.tone,
          forbiddenWords: splitList(styleGuideDraft.forbiddenWordsText),
          preferredTerms: parseTermMap(styleGuideDraft.preferredTermsText),
          sentenceLength: styleGuideDraft.sentenceLength,
          useOxfordComma: styleGuideDraft.useOxfordComma,
        },
        code: {
          indentStyle: styleGuideDraft.indentStyle,
          indentSize: Number(styleGuideDraft.indentSize) || 2,
          quotes: styleGuideDraft.quotes,
          semicolons: styleGuideDraft.semicolons,
          maxLineLength: Number(styleGuideDraft.maxLineLength) || 100,
          namingConvention: styleGuideDraft.namingConvention,
        },
        visual: {
          colorPalette: splitList(styleGuideDraft.colorPaletteText),
          fontFamily: nullableText(styleGuideDraft.fontFamily) ?? undefined,
          logoUrl: nullableText(styleGuideDraft.logoUrl) ?? undefined,
          preferDarkTheme: styleGuideDraft.preferDarkTheme,
        },
        outputRules: {
          enforceOnEmployeeRun: true,
        },
        status: 'active',
      })
    })

  const createEmployeeAgent = () =>
    runAction('Agent profile', async () => {
      const agent = await createAgentProfile(buildAgentProfileBody(agentDraft))
      await persistAgentAuxiliarySettings(agent.id)
      setSelectedAgentId(agent.id)
    })

  const updateSelectedAgent = () =>
    runAction('Agent profile update', async () => {
      if (!selectedAgentId) throw new Error('Create or select an Agent profile first.')
      const agent = await updateAgentProfile(selectedAgentId, buildAgentProfileBody(agentDraft))
      await persistAgentAuxiliarySettings(agent.id)
      setSelectedAgentId(agent.id)
    })

  const persistAgentAuxiliarySettings = async (agentProfileId: string) => {
    if (agentDraft.selectedStyleGuideId) {
      await bindStyleGuideToAgent(agentDraft.selectedStyleGuideId, {
        agentProfileId,
        status: 'active',
      })
    }
    await upsertAgentDiversityProfile({
      agentProfileId,
      personality: agentDraft.personality,
      perspective: agentDraft.perspective,
      temperature: Number(agentDraft.temperature) || 0.4,
      riskPosture: agentDraft.riskPosture,
      collaborationRole: agentDraft.collaborationRole,
      status: 'active',
    })
  }

  const analyzeDiversity = () =>
    runAction('Diversity analysis', async () => {
      await analyzeAgentDiversity({
        scopeType: 'team',
        agentProfileIds: data.agentProfiles.map((agent) => agent.id),
      })
    })

  const runInterview = () =>
    runAction('Agent interview', async () => {
      if (!selectedAgentId) throw new Error('Create or select an Agent profile first.')
      await createAgentInterview({
        agentProfileId: selectedAgentId,
        scenarioTitle: interviewDraft.scenarioTitle,
        scenarioTask: interviewDraft.scenarioTask,
        planResponse: nullableText(interviewDraft.planResponse),
        feedbackPrompt: nullableText(interviewDraft.feedbackPrompt),
        feedbackResponse: nullableText(interviewDraft.feedbackResponse),
      })
    })

  const runPerformanceReview = () =>
    runAction('Performance review', async () => {
      if (!selectedAgentId) throw new Error('Create or select an Agent profile first.')
      await createPerformanceReview({
        agentProfileId: selectedAgentId,
        sampleSize: 3,
      })
    })

  const startRun = () =>
    runAction('Employee run', async () => {
      if (!selectedAgentId) throw new Error('Create or select an Agent profile first.')
      const run = await startEmployeeRun(selectedAgentId, {
        goal: runDraft.goal,
        input: { source: 'employee_factory_ui' },
        budgetLimitCents: runDraft.budgetLimitCents ? Number(runDraft.budgetLimitCents) : null,
        autoComplete: runDraft.autoComplete,
      })
      setSelectedRunId(run.id)
      await refreshRunSnapshot(run.id)
    })

  const mutateSelectedRun = (label: string, action: (id: string) => Promise<unknown>) =>
    runAction(label, async () => {
      if (!selectedRunId) throw new Error('Select a run first.')
      await action(selectedRunId)
      await refreshRunSnapshot(selectedRunId)
    })

  const reviewLearningEvent = (label: string, action: (id: string) => Promise<unknown>, id: string) =>
    runAction(label, async () => {
      await action(id)
      if (selectedRunId) await refreshRunSnapshot(selectedRunId)
    })

  const visibleActiveTab = embedded && activeTab === 'control' ? 'agent' : activeTab

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="size-4" />
              <span className="truncate">{title ?? (embedded ? '智能体设置' : '智能体配置中心')}</span>
            </div>
            {subtitle && <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>}
            <div className={cn('mt-2 grid gap-1 text-[10px] text-muted-foreground', embedded ? 'grid-cols-4' : 'grid-cols-5')}>
              <Metric label="可选模型" value={data.models.length} />
              <Metric label="智能体" value={data.agentProfiles.length} />
              <Metric label="命令" value={data.cliProfiles.length} />
              {!embedded && <Metric label="规范" value={data.styleGuides.length} />}
              <Metric label="运行" value={data.employeeRuns.length} />
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => void reload()}
            disabled={loading}
            title="刷新"
          >
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
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

      <Tabs
        value={visibleActiveTab}
        onValueChange={(value) => setActiveTab(value as FactoryTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 border-b px-3 py-2">
          <TabsList className={cn('grid h-8 w-full', embedded ? 'grid-cols-2' : 'grid-cols-3')}>
            {!embedded && (
              <TabsTrigger value="control" className="text-xs">
                系统配置
              </TabsTrigger>
            )}
            <TabsTrigger value="agent" className="text-xs">
              能力设置
            </TabsTrigger>
            <TabsTrigger value="run" className="text-xs">
              运行记录
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          {loading && data.models.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-3 py-10 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              正在加载智能体配置
            </div>
          ) : (
            <div className="p-3">
              {!embedded && (
                <TabsContent value="control" className="mt-0 space-y-3">
                  <ControlPlaneForms
                    networkDraft={networkDraft}
                    setNetworkDraft={setNetworkDraft}
                    modelDraft={modelDraft}
                    setModelDraft={setModelDraft}
                    cliDraft={cliDraft}
                    setCliDraft={setCliDraft}
                    toolDraft={toolDraft}
                    setToolDraft={setToolDraft}
                    mcpDraft={mcpDraft}
                    setMcpDraft={setMcpDraft}
                    promptTemplateDraft={promptTemplateDraft}
                    setPromptTemplateDraft={setPromptTemplateDraft}
                    softwareDraft={softwareDraft}
                    setSoftwareDraft={setSoftwareDraft}
                    softwareCommandDraft={softwareCommandDraft}
                    setSoftwareCommandDraft={setSoftwareCommandDraft}
                    styleGuideDraft={styleGuideDraft}
                    setStyleGuideDraft={setStyleGuideDraft}
                    data={data}
                    saving={saving}
                    onCreateNetwork={createNetwork}
                    onCreateModel={createModel}
                    onCreateCli={createCli}
                    onCreateMcp={createMcp}
                    onCreatePrompt={createPrompt}
                    onCreateTool={createTool}
                    onCreateSoftware={createSoftware}
                    onCreateCommand={createCommand}
                    onCreateStyleGuide={createGuide}
                  />
                </TabsContent>
              )}

              <TabsContent value="agent" className="mt-0 space-y-3">
                {embedded && (
                  <div className="rounded-md border bg-muted/25 px-3 py-2 text-xs leading-5 text-muted-foreground">
                    这里专门管理当前智能体。模型、技能、命令行工具和软件能力先在左侧对应页面接入，
                    回到这里直接勾选给这个智能体使用。
                  </div>
                )}
                {!embedded && (
                  <FirstLessonPanel
                    onAgentReady={setSelectedAgentId}
                    onRunReady={async (runId) => {
                      setSelectedRunId(runId)
                      await refreshRunSnapshot(runId)
                    }}
                    onAfterChange={reload}
                  />
                )}
                <AgentProfileForm
                  data={data}
                  draft={agentDraft}
                  interviewDraft={interviewDraft}
                  selectedAgent={selectedAgent}
                  saving={saving}
                  setDraft={setAgentDraft}
                  setInterviewDraft={setInterviewDraft}
                  selectedAgentId={selectedAgentId}
                  setSelectedAgentId={setSelectedAgentId}
                  onCreate={createEmployeeAgent}
                  onUpdate={updateSelectedAgent}
                  onAnalyzeDiversity={analyzeDiversity}
                  onRunInterview={runInterview}
                  onRunPerformanceReview={runPerformanceReview}
                  embedded={embedded}
                  focusCapabilities={initialFocusSection === 'capabilities'}
                />
              </TabsContent>

              <TabsContent value="run" className="mt-0 space-y-3">
                <RunMonitor
                  data={data}
                  runDraft={runDraft}
                  setRunDraft={setRunDraft}
                  selectedAgentId={selectedAgentId}
                  setSelectedAgentId={setSelectedAgentId}
                  selectedRunId={selectedRunId}
                  setSelectedRunId={setSelectedRunId}
                  selectedRun={selectedRun}
                  runEvents={runEvents}
                  runCliRuns={runCliRuns}
                  runComputerSessions={runComputerSessions}
                  runComputerActions={runComputerActions}
                  runContextSnapshots={runContextSnapshots}
                  runBudgetEvents={runBudgetEvents}
                  runDecisionAudits={runDecisionAudits}
                  runSecurityAuditLogs={runSecurityAuditLogs}
                  runRecoveryEvents={runRecoveryEvents}
                  runArtifactValidations={runArtifactValidations}
                  runMultimodalInputs={runMultimodalInputs}
                  runMultimodalOutputs={runMultimodalOutputs}
                  runLearningEvents={runLearningEvents}
                  runMemories={runMemories}
                  runReflection={runReflection}
                  saving={saving}
                  onStart={startRun}
                  onPause={() => mutateSelectedRun('Pause run', pauseEmployeeRun)}
                  onResume={() => mutateSelectedRun('Resume run', resumeEmployeeRun)}
                  onCancel={() => mutateSelectedRun('Cancel run', cancelEmployeeRun)}
                  onApproveLearning={(id) =>
                    reviewLearningEvent('Approve learning', (eventId) => approveLearningEvent(eventId), id)
                  }
                  onRejectLearning={(id) =>
                    reviewLearningEvent('Reject learning', (eventId) => rejectLearningEvent(eventId), id)
                  }
                  onComputerMark={recordRunComputerObservation}
                />
              </TabsContent>
            </div>
          )}
        </ScrollArea>
      </Tabs>
    </div>
  )
}

function FirstLessonPanel({
  onAgentReady,
  onRunReady,
  onAfterChange,
}: {
  onAgentReady: (agentProfileId: string) => void
  onRunReady: (employeeRunId: string) => Promise<void>
  onAfterChange: () => Promise<void>
}) {
  const [sessions, setSessions] = useState<OnboardingSessionRow[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [workType, setWorkType] = useState<OnboardingWorkType>('coding')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null,
    [selectedSessionId, sessions],
  )

  const reloadSessions = useCallback(async () => {
    const rows = await fetchOnboardingSessions()
    setSessions(rows)
    if (!selectedSessionId && rows[0]) setSelectedSessionId(rows[0].id)
  }, [selectedSessionId])

  useEffect(() => {
    void reloadSessions().catch((err) => setError(formatError(err)))
  }, [reloadSessions])

  useEffect(() => {
    if (activeSession?.selectedWorkType && isOnboardingWorkType(activeSession.selectedWorkType)) {
      setWorkType(activeSession.selectedWorkType)
    }
  }, [activeSession?.selectedWorkType])

  const runLessonAction = async (
    label: string,
    action: () => Promise<OnboardingSessionRow>,
  ) => {
    setBusy(label)
    setError(null)
    setNotice(null)
    try {
      const session = await action()
      setSelectedSessionId(session.id)
      if (session.createdAgentProfileId) onAgentReady(session.createdAgentProfileId)
      if (session.demoEmployeeRunId) await onRunReady(session.demoEmployeeRunId)
      await reloadSessions()
      await onAfterChange()
      setNotice(`${label} complete`)
    } catch (err) {
      setError(formatError(err))
    } finally {
      setBusy(null)
    }
  }

  const checklist = activeSession?.checklist ?? {}
  const nextSteps = onboardingNextSteps(checklist)
  const lessonSteps = [
    ['welcome', 'Welcome', 'Start the guided lesson'],
    ['needSelected', 'Choose work', 'Pick the repeated work this Agent should learn'],
    ['agentConfigured', 'Create Agent', 'Auto-configure the first employee profile'],
    ['demoStarted', 'Demo task', 'Ask the Agent to inspect README.md'],
    ['demoCompleted', 'Progress visible', 'Review the completed run and artifact trail'],
    ['completed', 'Next steps', 'Move into templates, custom Agents, and Canvas'],
  ] as const

  return (
    <Section icon={<CheckCircle2 className="size-3.5" />} title="Agent First Lesson">
      <div className="rounded-md border bg-muted/30 p-2 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate font-medium">Interactive onboarding</span>
          <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
            {activeSession?.status ?? 'not_started'}
          </Badge>
        </div>
        <div className="mt-1 line-clamp-2 text-muted-foreground">
          Create the first Agent, run a safe README check, and surface the same progress trail that
          future Canvas nodes will show.
        </div>
        {activeSession && <CodeLine value={activeSession.id} />}
      </div>

      {sessions.length > 0 && (
        <Select
          value={activeSession?.id ?? ''}
          onChange={setSelectedSessionId}
          options={sessions.map((session) => session.id)}
          labels={Object.fromEntries(
            sessions.map((session) => [
              session.id,
              `${session.status} - ${new Date(session.createdAt).toLocaleTimeString()}`,
            ]),
          )}
        />
      )}

      <Select
        value={workType}
        onChange={(value) => setWorkType(isOnboardingWorkType(value) ? value : 'other')}
        options={ONBOARDING_WORK_TYPES}
        labels={ONBOARDING_WORK_LABELS}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() => void runLessonAction('Start lesson', startOnboardingSession)}
          disabled={busy !== null}
        >
          {busy === 'Start lesson' ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          Start
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() =>
            void runLessonAction('Configure Agent', async () => {
              if (!activeSession) throw new Error('Start the first lesson before configuring Agent.')
              return configureOnboardingAgent(activeSession.id, workType)
            })
          }
          disabled={busy !== null || !activeSession}
        >
          {busy === 'Configure Agent' ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
          Agent
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() =>
            void runLessonAction('Run demo', async () => {
              if (!activeSession) throw new Error('Start the first lesson before running demo.')
              return runOnboardingDemo(activeSession.id)
            })
          }
          disabled={busy !== null || !activeSession?.createdAgentProfileId}
        >
          {busy === 'Run demo' ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className="size-3.5" />}
          Demo
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() =>
            void runLessonAction('Complete lesson', async () => {
              if (!activeSession) throw new Error('Start the first lesson before completion.')
              return completeOnboardingSession(activeSession.id)
            })
          }
          disabled={busy !== null || !activeSession}
        >
          {busy === 'Complete lesson' ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
          Finish
        </Button>
      </div>

      {(error || notice) && (
        <div
          className={cn(
            'rounded-md border px-2 py-1.5 text-[11px]',
            error
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          )}
        >
          {error ?? notice}
        </div>
      )}

      <div className="space-y-1">
        {lessonSteps.map(([key, title, description]) => (
          <div key={key} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px]">
            <CheckCircle2
              className={cn(
                'size-3.5 shrink-0',
                onboardingChecklistDone(checklist, key)
                  ? 'text-emerald-600'
                  : 'text-muted-foreground/50',
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{title}</div>
              <div className="truncate text-[10px] text-muted-foreground">{description}</div>
            </div>
          </div>
        ))}
      </div>

      {activeSession?.createdAgentProfileId && (
        <div className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="font-medium">Created Agent</div>
          <CodeLine value={activeSession.createdAgentProfileId} />
        </div>
      )}
      {activeSession?.demoEmployeeRunId && (
        <div className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="font-medium">Demo run</div>
          <CodeLine value={activeSession.demoEmployeeRunId} />
        </div>
      )}
      <MiniList title="Next steps" items={nextSteps} />
    </Section>
  )
}

function ControlPlaneForms({
  networkDraft,
  setNetworkDraft,
  modelDraft,
  setModelDraft,
  cliDraft,
  setCliDraft,
  toolDraft,
  setToolDraft,
  mcpDraft,
  setMcpDraft,
  promptTemplateDraft,
  setPromptTemplateDraft,
  softwareDraft,
  setSoftwareDraft,
  softwareCommandDraft,
  setSoftwareCommandDraft,
  styleGuideDraft,
  setStyleGuideDraft,
  data,
  saving,
  onCreateNetwork,
  onCreateModel,
  onCreateCli,
  onCreateMcp,
  onCreatePrompt,
  onCreateTool,
  onCreateSoftware,
  onCreateCommand,
  onCreateStyleGuide,
}: {
  networkDraft: NetworkDraft
  setNetworkDraft: Dispatch<SetStateAction<NetworkDraft>>
  modelDraft: ModelDraft
  setModelDraft: Dispatch<SetStateAction<ModelDraft>>
  cliDraft: CliDraft
  setCliDraft: Dispatch<SetStateAction<CliDraft>>
  toolDraft: ToolDraft
  setToolDraft: Dispatch<SetStateAction<ToolDraft>>
  mcpDraft: McpDraft
  setMcpDraft: Dispatch<SetStateAction<McpDraft>>
  promptTemplateDraft: PromptTemplateDraft
  setPromptTemplateDraft: Dispatch<SetStateAction<PromptTemplateDraft>>
  softwareDraft: SoftwareDraft
  setSoftwareDraft: Dispatch<SetStateAction<SoftwareDraft>>
  softwareCommandDraft: SoftwareCommandDraft
  setSoftwareCommandDraft: Dispatch<SetStateAction<SoftwareCommandDraft>>
  styleGuideDraft: StyleGuideDraft
  setStyleGuideDraft: Dispatch<SetStateAction<StyleGuideDraft>>
  data: FactoryData
  saving: string | null
  onCreateNetwork: () => Promise<void>
  onCreateModel: () => Promise<void>
  onCreateCli: () => Promise<void>
  onCreateMcp: () => Promise<void>
  onCreatePrompt: () => Promise<void>
  onCreateTool: () => Promise<void>
  onCreateSoftware: () => Promise<void>
  onCreateCommand: () => Promise<void>
  onCreateStyleGuide: () => Promise<void>
}) {
  const showAdvancedControlForms = false

  return (
    <>
      <Section
        icon={<Network className="size-3.5" />}
        title="代理配置"
        actionLabel="添加"
        saving={saving === 'Network profile'}
        onAction={onCreateNetwork}
      >
        <Input
          value={networkDraft.name}
          onChange={(event) => setNetworkDraft((draft) => ({ ...draft, name: event.target.value }))}
          placeholder="Name"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={networkDraft.mode}
            onChange={(value) =>
              setNetworkDraft((draft) => ({ ...draft, mode: value as NetworkMode }))
            }
            options={NETWORK_MODES}
          />
          <Select
            value={networkDraft.appliesTo}
            onChange={(value) =>
              setNetworkDraft((draft) => ({ ...draft, appliesTo: value as NetworkAppliesTo }))
            }
            options={NETWORK_TARGETS}
          />
        </div>
        <Input
          value={networkDraft.proxyUrl}
          onChange={(event) =>
            setNetworkDraft((draft) => ({ ...draft, proxyUrl: event.target.value }))
          }
          placeholder="Proxy URL"
        />
      </Section>

      <Section
        icon={<Database className="size-3.5" />}
        title="模型配置"
        actionLabel="添加"
        saving={saving === 'Model profile'}
        onAction={onCreateModel}
      >
        <Input
          value={modelDraft.name}
          onChange={(event) => setModelDraft((draft) => ({ ...draft, name: event.target.value }))}
          placeholder="Name"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={modelDraft.provider}
            onChange={(value) =>
              setModelDraft((draft) => ({ ...draft, provider: value as ModelProfileProvider }))
            }
            options={MODEL_PROVIDERS}
          />
          <Input
            value={modelDraft.model}
            onChange={(event) =>
              setModelDraft((draft) => ({ ...draft, model: event.target.value }))
            }
            placeholder="Model"
          />
        </div>
        <Input
          value={modelDraft.baseUrl}
          onChange={(event) =>
            setModelDraft((draft) => ({ ...draft, baseUrl: event.target.value }))
          }
          placeholder="Base URL"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={modelDraft.apiKeyRef}
            onChange={(event) =>
              setModelDraft((draft) => ({ ...draft, apiKeyRef: event.target.value }))
            }
            placeholder="API key ref"
          />
          <Input
            value={modelDraft.contextWindow}
            onChange={(event) =>
              setModelDraft((draft) => ({ ...draft, contextWindow: event.target.value }))
            }
            placeholder="Context"
            type="number"
          />
        </div>
        <Select
          value={modelDraft.networkProfileId}
          onChange={(value) => setModelDraft((draft) => ({ ...draft, networkProfileId: value }))}
          options={['', ...data.networks.map((network) => network.id)]}
          labels={Object.fromEntries(data.networks.map((network) => [network.id, network.name]))}
          emptyLabel="No network profile"
        />
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <Checkbox
            checked={modelDraft.supportsVision}
            label="Vision"
            onChange={(checked) =>
              setModelDraft((draft) => ({ ...draft, supportsVision: checked }))
            }
          />
          <Checkbox
            checked={modelDraft.supportsToolCalling}
            label="Tools"
            onChange={(checked) =>
              setModelDraft((draft) => ({ ...draft, supportsToolCalling: checked }))
            }
          />
          <Checkbox
            checked={modelDraft.supportsJsonMode}
            label="JSON"
            onChange={(checked) =>
              setModelDraft((draft) => ({ ...draft, supportsJsonMode: checked }))
            }
          />
        </div>
      </Section>

      <Section
        icon={<Terminal className="size-3.5" />}
        title="CLI 配置"
        actionLabel="添加"
        saving={saving === 'CLI profile'}
        onAction={onCreateCli}
      >
        <Input
          value={cliDraft.name}
          onChange={(event) => setCliDraft((draft) => ({ ...draft, name: event.target.value }))}
          placeholder="Name"
        />
        <Input
          value={cliDraft.command}
          onChange={(event) => setCliDraft((draft) => ({ ...draft, command: event.target.value }))}
          placeholder="Command"
        />
        <Input
          value={cliDraft.argsTemplate}
          onChange={(event) =>
            setCliDraft((draft) => ({ ...draft, argsTemplate: event.target.value }))
          }
          placeholder="Args template"
        />
        <Checkbox
          checked={cliDraft.requiresApproval}
          label="Requires approval"
          onChange={(checked) =>
            setCliDraft((draft) => ({ ...draft, requiresApproval: checked }))
          }
        />
      </Section>

      <Section
        icon={<Network className="size-3.5" />}
        title="MCP 配置"
        actionLabel="添加"
        saving={saving === 'MCP server'}
        onAction={onCreateMcp}
      >
        <Input
          value={mcpDraft.displayName}
          onChange={(event) =>
            setMcpDraft((draft) => ({ ...draft, displayName: event.target.value }))
          }
          placeholder="Display name"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={mcpDraft.transport}
            onChange={(value) =>
              setMcpDraft((draft) => ({ ...draft, transport: value as McpTransport }))
            }
            options={MCP_TRANSPORTS}
          />
          <Input
            value={mcpDraft.command}
            onChange={(event) =>
              setMcpDraft((draft) => ({ ...draft, command: event.target.value }))
            }
            placeholder="Command"
          />
        </div>
        <Input
          value={mcpDraft.endpoint}
          onChange={(event) =>
            setMcpDraft((draft) => ({ ...draft, endpoint: event.target.value }))
          }
          placeholder="Endpoint"
        />
      </Section>

      <Section
        icon={<Package className="size-3.5" />}
        title="提示词工程"
        actionLabel="添加"
        saving={saving === 'Prompt template'}
        onAction={onCreatePrompt}
      >
        <Input
          value={promptTemplateDraft.name}
          onChange={(event) =>
            setPromptTemplateDraft((draft) => ({ ...draft, name: event.target.value }))
          }
          placeholder="Name"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={promptTemplateDraft.scope}
            onChange={(value) =>
              setPromptTemplateDraft((draft) => ({
                ...draft,
                scope: value as PromptTemplateScope,
              }))
            }
            options={['agent', 'workspace', 'global']}
          />
          <Input
            value={data.promptTemplates.length.toString()}
            readOnly
            placeholder="Templates"
          />
        </div>
        <Input
          value={promptTemplateDraft.description}
          onChange={(event) =>
            setPromptTemplateDraft((draft) => ({ ...draft, description: event.target.value }))
          }
          placeholder="Description"
        />
        <Textarea
          className="min-h-20 text-xs"
          value={promptTemplateDraft.systemPrompt}
          onChange={(event) =>
            setPromptTemplateDraft((draft) => ({ ...draft, systemPrompt: event.target.value }))
          }
          placeholder="System prompt"
        />
        <Textarea
          className="min-h-20 text-xs"
          value={promptTemplateDraft.contextRulesText}
          onChange={(event) =>
            setPromptTemplateDraft((draft) => ({
              ...draft,
              contextRulesText: event.target.value,
            }))
          }
          placeholder="Context rules, one per line"
        />
      </Section>

      {showAdvancedControlForms && (
        <>
          <Section
            icon={<Palette className="size-3.5" />}
            title="Style Guide"
            actionLabel="Add"
            saving={saving === 'Style guide'}
            onAction={onCreateStyleGuide}
          >
            <Input
              value={styleGuideDraft.name}
              onChange={(event) =>
                setStyleGuideDraft((draft) => ({ ...draft, name: event.target.value }))
              }
              placeholder="Name"
            />
            <Input
              value={styleGuideDraft.tone}
              onChange={(event) =>
                setStyleGuideDraft((draft) => ({ ...draft, tone: event.target.value }))
              }
              placeholder="Tone"
            />
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={styleGuideDraft.sentenceLength}
                onChange={(value) =>
                  setStyleGuideDraft((draft) => ({
                    ...draft,
                    sentenceLength: value as StyleGuideDraft['sentenceLength'],
                  }))
                }
                options={['short', 'medium', 'varied']}
              />
              <Checkbox
                checked={styleGuideDraft.useOxfordComma}
                label="Oxford comma"
                onChange={(checked) =>
                  setStyleGuideDraft((draft) => ({ ...draft, useOxfordComma: checked }))
                }
              />
            </div>
            <Textarea
              className="min-h-16 text-xs"
              value={styleGuideDraft.forbiddenWordsText}
              onChange={(event) =>
                setStyleGuideDraft((draft) => ({
                  ...draft,
                  forbiddenWordsText: event.target.value,
                }))
              }
              placeholder="Forbidden words, one per line"
            />
            <Textarea
              className="min-h-16 text-xs"
              value={styleGuideDraft.preferredTermsText}
              onChange={(event) =>
                setStyleGuideDraft((draft) => ({
                  ...draft,
                  preferredTermsText: event.target.value,
                }))
              }
              placeholder="Preferred terms: old=new"
            />
            <div className="grid grid-cols-3 gap-2">
              <Select
                value={styleGuideDraft.indentStyle}
                onChange={(value) =>
                  setStyleGuideDraft((draft) => ({
                    ...draft,
                    indentStyle: value as StyleGuideDraft['indentStyle'],
                  }))
                }
                options={['space', 'tab']}
              />
              <Input
                value={styleGuideDraft.indentSize}
                onChange={(event) =>
                  setStyleGuideDraft((draft) => ({ ...draft, indentSize: event.target.value }))
                }
                placeholder="Indent"
                type="number"
              />
              <Select
                value={styleGuideDraft.quotes}
                onChange={(value) =>
                  setStyleGuideDraft((draft) => ({
                    ...draft,
                    quotes: value as StyleGuideDraft['quotes'],
                  }))
                }
                options={['single', 'double']}
              />
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input
                value={styleGuideDraft.maxLineLength}
                onChange={(event) =>
                  setStyleGuideDraft((draft) => ({
                    ...draft,
                    maxLineLength: event.target.value,
                  }))
                }
                placeholder="Line length"
                type="number"
              />
              <Select
                value={styleGuideDraft.namingConvention}
                onChange={(value) =>
                  setStyleGuideDraft((draft) => ({
                    ...draft,
                    namingConvention: value as StyleGuideDraft['namingConvention'],
                  }))
                }
                options={['camelCase', 'PascalCase', 'snake_case']}
              />
              <Checkbox
                checked={styleGuideDraft.semicolons}
                label=";"
                onChange={(checked) =>
                  setStyleGuideDraft((draft) => ({ ...draft, semicolons: checked }))
                }
              />
            </div>
            <Textarea
              className="min-h-16 text-xs"
              value={styleGuideDraft.colorPaletteText}
              onChange={(event) =>
                setStyleGuideDraft((draft) => ({
                  ...draft,
                  colorPaletteText: event.target.value,
                }))
              }
              placeholder="Color palette"
            />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                value={styleGuideDraft.fontFamily}
                onChange={(event) =>
                  setStyleGuideDraft((draft) => ({ ...draft, fontFamily: event.target.value }))
                }
                placeholder="Font family"
              />
              <Checkbox
                checked={styleGuideDraft.preferDarkTheme}
                label="Dark"
                onChange={(checked) =>
                  setStyleGuideDraft((draft) => ({ ...draft, preferDarkTheme: checked }))
                }
              />
            </div>
            <Input
              value={styleGuideDraft.logoUrl}
              onChange={(event) =>
                setStyleGuideDraft((draft) => ({ ...draft, logoUrl: event.target.value }))
              }
              placeholder="Logo URL"
            />
          </Section>

          <Section
            icon={<Activity className="size-3.5" />}
            title="Tool Connection"
            actionLabel="Add"
            saving={saving === 'Tool connection'}
            onAction={onCreateTool}
          >
            <Input
              value={toolDraft.displayName}
              onChange={(event) =>
                setToolDraft((draft) => ({ ...draft, displayName: event.target.value }))
              }
              placeholder="Display name"
            />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Select
                value={toolDraft.type}
                onChange={(value) =>
                  setToolDraft((draft) => ({ ...draft, type: value as ToolConnectionType }))
                }
                options={TOOL_TYPES}
              />
              <Checkbox
                checked={toolDraft.enabled}
                label="Enabled"
                onChange={(checked) => setToolDraft((draft) => ({ ...draft, enabled: checked }))}
              />
            </div>
          </Section>

          <Section
            icon={<Package className="size-3.5" />}
            title="Software Profile"
            actionLabel="Add"
            saving={saving === 'Software profile'}
            onAction={onCreateSoftware}
          >
            <Input
              value={softwareDraft.name}
              onChange={(event) =>
                setSoftwareDraft((draft) => ({ ...draft, name: event.target.value }))
              }
              placeholder="Name"
            />
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={softwareDraft.appType}
                onChange={(value) =>
                  setSoftwareDraft((draft) => ({ ...draft, appType: value as SoftwareAppType }))
                }
                options={SOFTWARE_APP_TYPES}
              />
              <Select
                value={softwareDraft.adapterType}
                onChange={(value) =>
                  setSoftwareDraft((draft) => ({
                    ...draft,
                    adapterType: value as SoftwareAdapterType,
                  }))
                }
                options={SOFTWARE_ADAPTERS}
              />
            </div>
            <Select
              value={softwareDraft.defaultWorkstationMode}
              onChange={(value) =>
                setSoftwareDraft((draft) => ({
                  ...draft,
                  defaultWorkstationMode: value as WorkstationMode,
                }))
              }
              options={WORKSTATION_MODES}
            />
            <Input
              value={softwareDraft.launchCommand}
              onChange={(event) =>
                setSoftwareDraft((draft) => ({ ...draft, launchCommand: event.target.value }))
              }
              placeholder="Launch command"
            />
          </Section>

          <Section
            icon={<CheckCircle2 className="size-3.5" />}
            title="Software Command"
            actionLabel="Add"
            saving={saving === 'Software command'}
            onAction={onCreateCommand}
          >
            <Select
              value={softwareCommandDraft.softwareProfileId}
              onChange={(value) =>
                setSoftwareCommandDraft((draft) => ({ ...draft, softwareProfileId: value }))
              }
              options={['', ...data.softwareProfiles.map((profile) => profile.id)]}
              labels={Object.fromEntries(data.softwareProfiles.map((profile) => [profile.id, profile.name]))}
              emptyLabel="Select software"
            />
            <Input
              value={softwareCommandDraft.name}
              onChange={(event) =>
                setSoftwareCommandDraft((draft) => ({ ...draft, name: event.target.value }))
              }
              placeholder="Command name"
            />
            <Textarea
              className="min-h-16 text-xs"
              value={softwareCommandDraft.description}
              onChange={(event) =>
                setSoftwareCommandDraft((draft) => ({
                  ...draft,
                  description: event.target.value,
                }))
              }
              placeholder="Description"
            />
          </Section>
        </>
      )}
    </>
  )
}

function AgentProfileForm({
  data,
  draft,
  interviewDraft,
  selectedAgent,
  saving,
  setDraft,
  setInterviewDraft,
  selectedAgentId,
  setSelectedAgentId,
  onCreate,
  onUpdate,
  onAnalyzeDiversity,
  onRunInterview,
  onRunPerformanceReview,
  embedded = false,
  focusCapabilities = false,
}: {
  data: FactoryData
  draft: AgentDraft
  interviewDraft: InterviewDraft
  selectedAgent: AgentProfileRow | null
  saving: string | null
  setDraft: Dispatch<SetStateAction<AgentDraft>>
  setInterviewDraft: Dispatch<SetStateAction<InterviewDraft>>
  selectedAgentId: string
  setSelectedAgentId: (id: string) => void
  onCreate: () => Promise<void>
  onUpdate: () => Promise<void>
  onAnalyzeDiversity: () => Promise<void>
  onRunInterview: () => Promise<void>
  onRunPerformanceReview: () => Promise<void>
  embedded?: boolean
  focusCapabilities?: boolean
}) {
  const latestInterview = selectedAgentId
    ? data.agentInterviews.find((interview) => interview.agentProfileId === selectedAgentId) ?? null
    : null
  const latestReview = selectedAgentId
    ? data.performanceReviews.find((review) => review.agentProfileId === selectedAgentId) ?? null
    : null
  const [advancedPersonaOpen, setAdvancedPersonaOpen] = useState(false)
  const capabilitiesSectionRef = useRef<HTMLDivElement | null>(null)
  const selectedModelName =
    data.models.find((model) => model.id === draft.modelProfileId)?.name ?? '不绑定模型'
  const selectedPromptTemplateName =
    data.promptTemplates.find((template) => template.id === draft.selectedPromptTemplateId)?.name ??
    '未绑定上下文模板'
  const selectedStyleGuideName =
    data.styleGuides.find((guide) => guide.id === draft.selectedStyleGuideId)?.name ?? '未绑定风格规范'
  const capabilitySummary = [
    draft.selectedCliIds.length ? `${draft.selectedCliIds.length} 个 CLI` : null,
    draft.selectedMcpIds.length ? `${draft.selectedMcpIds.length} 个 MCP` : null,
    draft.selectedSoftwareIds.length ? `${draft.selectedSoftwareIds.length} 个软件` : null,
    splitList(draft.skillsText).length ? `${splitList(draft.skillsText).length} 个技能` : null,
  ].filter(Boolean)
  const assignedCapabilitySummary =
    capabilitySummary.length ? capabilitySummary.join(' / ') : '还没有分配工具能力'
  const assignedSkillCount = splitList(draft.skillsText).length
  const assignedMcpCount = draft.selectedMcpIds.length + splitList(draft.mcpText).length
  const assignedPermissionLabels = [
    draft.canReadFiles ? '读文件' : null,
    draft.canWriteFiles ? '写文件' : null,
    draft.canRunCommands ? '运行命令' : null,
    draft.canUseBrowser ? '浏览器' : null,
    draft.canUseDesktop ? '电脑操作' : null,
    draft.canUseNetwork ? '联网' : null,
  ].filter(Boolean) as string[]
  const assignedPermissionSummary =
    assignedPermissionLabels.length > 0 ? assignedPermissionLabels.join('、') : '只允许观察和回复'
  const jumpToCapabilities = () => {
    capabilitiesSectionRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  useEffect(() => {
    if (!focusCapabilities) return
    const timeoutId = window.setTimeout(() => {
      capabilitiesSectionRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 150)
    return () => window.clearTimeout(timeoutId)
  }, [focusCapabilities, selectedAgentId])

  return (
    <>
      <AgentSettingsSummary
        role={draft.role}
        artifactType={draft.outputArtifactType}
        modelName={selectedModelName}
        workstation={WORKSTATION_MODE_LABELS[draft.workstationMode] ?? draft.workstationMode}
        autonomy={AUTONOMY_LABELS[draft.autonomyLevel] ?? draft.autonomyLevel}
        capabilitySummary={assignedCapabilitySummary}
      />

      <AgentEmployeeControlPanel
        draft={draft}
        modelName={selectedModelName}
        promptTemplateName={selectedPromptTemplateName}
        styleGuideName={selectedStyleGuideName}
        capabilitySummary={assignedCapabilitySummary}
      />

      <AgentToolboxSummary
        modelName={selectedModelName}
        skillCount={assignedSkillCount}
        cliCount={draft.selectedCliIds.length}
        mcpCount={assignedMcpCount}
        softwareCount={draft.selectedSoftwareIds.length}
        permissionSummary={assignedPermissionSummary}
        outputTarget={draft.outputArtifactType || '未设置交付物'}
        onAssign={jumpToCapabilities}
      />

      <Section
        icon={<Bot className="size-3.5" />}
        title="身份与产物"
        actionLabel={selectedAgentId ? '保存当前设置' : '新建配置'}
        saving={saving === 'Agent profile' || saving === 'Agent profile update'}
        onAction={selectedAgentId ? onUpdate : onCreate}
      >
        <Field label="员工名称" hint="用户在对话和画布里看到的名字。">
          <Input
            value={draft.name}
            onChange={(event) => setDraft((next) => ({ ...next, name: event.target.value }))}
            placeholder="例如：前端工程师"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="岗位职责" hint="决定它主要负责什么。">
            <Input
              value={draft.role}
              onChange={(event) => setDraft((next) => ({ ...next, role: event.target.value }))}
              placeholder="例如：researcher / designer / coder"
            />
          </Field>
          <Field label="必须交付" hint="这个 Agent 完成后应该产出什么。">
            <Input
              value={draft.outputArtifactType}
              onChange={(event) =>
                setDraft((next) => ({ ...next, outputArtifactType: event.target.value }))
              }
              placeholder="例如：报告、代码、视频、图片"
            />
          </Field>
        </div>
        <Field label="工作说明" hint="说明它像哪类员工、接到任务后要怎么做。">
          <Textarea
            className="min-h-16 text-xs"
            value={draft.description}
            onChange={(event) => setDraft((next) => ({ ...next, description: event.target.value }))}
            placeholder="例如：负责理解需求、拆解任务、产出可交付结果，并在卡住时说明原因。"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="沟通风格" hint="影响它回复用户时的语气。">
            <Select
              value={draft.personaTone}
              onChange={(value) =>
                setDraft((next) => ({ ...next, personaTone: value as AgentPersonaTone }))
              }
              options={AGENT_PERSONA_TONES}
              labels={PERSONA_TONE_LABELS}
            />
          </Field>
          <Field label="语言" hint="中国用户默认用中文。">
            <Input
              value={draft.personaLanguage}
              onChange={(event) =>
                setDraft((next) => ({ ...next, personaLanguage: event.target.value }))
              }
              placeholder="zh-CN"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Checkbox
            checked={draft.personaUseCodeBlocks}
            label="代码块"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, personaUseCodeBlocks: checked }))
            }
          />
          <Checkbox
            checked={draft.personaPreferBulletPoints}
            label="列表表达"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, personaPreferBulletPoints: checked }))
            }
          />
          <Checkbox
            checked={draft.personaUseEmoji}
            label="表情"
            onChange={(checked) => setDraft((next) => ({ ...next, personaUseEmoji: checked }))}
          />
          <Checkbox
            checked={draft.personaShowThinkingProcess}
            label="显示思考状态"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, personaShowThinkingProcess: checked }))
            }
          />
        </div>
        <div className="rounded-lg border bg-muted/30 p-2">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium"
            onClick={() => setAdvancedPersonaOpen((open) => !open)}
          >
            <span>高级人格参数</span>
            <span className="text-[11px] text-muted-foreground">
              {advancedPersonaOpen ? '收起' : '展开'}
            </span>
          </button>
          {advancedPersonaOpen && (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="头像标识">
                  <Input
                    value={draft.personaAvatar}
                    onChange={(event) =>
                      setDraft((next) => ({ ...next, personaAvatar: event.target.value }))
                    }
                    placeholder="例如：agent"
                  />
                </Field>
                <Field label="自称">
                  <Input
                    value={draft.personaSelfReference}
                    onChange={(event) =>
                      setDraft((next) => ({ ...next, personaSelfReference: event.target.value }))
                    }
                    placeholder="例如：我"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Field label="谨慎">
                  <Input
                    value={draft.personaCautious}
                    onChange={(event) =>
                      setDraft((next) => ({ ...next, personaCautious: event.target.value }))
                    }
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                  />
                </Field>
                <Field label="创意">
                  <Input
                    value={draft.personaCreative}
                    onChange={(event) =>
                      setDraft((next) => ({ ...next, personaCreative: event.target.value }))
                    }
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                  />
                </Field>
                <Field label="细致">
                  <Input
                    value={draft.personaThorough}
                    onChange={(event) =>
                      setDraft((next) => ({ ...next, personaThorough: event.target.value }))
                    }
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                  />
                </Field>
                <Field label="效率">
                  <Input
                    value={draft.personaEfficient}
                    onChange={(event) =>
                      setDraft((next) => ({ ...next, personaEfficient: event.target.value }))
                    }
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                  />
                </Field>
              </div>
            </div>
          )}
        </div>
        <Field label="使用模型" hint="模型密钥和出口在「模型管理」里维护，这里只选择。">
          <Select
            value={draft.modelProfileId}
            onChange={(value) => setDraft((next) => ({ ...next, modelProfileId: value }))}
            options={['', ...data.models.map((model) => model.id)]}
            labels={Object.fromEntries(data.models.map((model) => [model.id, model.name]))}
            emptyLabel="不绑定模型"
          />
        </Field>
        <Field label="工作位置" hint="决定它用独立浏览器、当前桌面还是未来虚拟工位。">
          <Select
            value={draft.workstationMode}
            onChange={(value) =>
              setDraft((next) => ({ ...next, workstationMode: value as WorkstationMode }))
            }
            options={WORKSTATION_MODES}
            labels={WORKSTATION_MODE_LABELS}
          />
        </Field>
      </Section>

      <Section icon={<BrainCircuit className="size-3.5" />} title="记忆、上下文与协作">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Checkbox
            checked={draft.memoryEnabled}
            label="启用记忆"
            onChange={(checked) => setDraft((next) => ({ ...next, memoryEnabled: checked }))}
          />
          <Checkbox
            checked={draft.memoryWriteReflection}
            label="任务复盘写入记忆"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, memoryWriteReflection: checked }))
            }
          />
          <Checkbox
            checked={draft.memoryScopeAgent}
            label="记住本智能体经验"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, memoryScopeAgent: checked }))
            }
          />
          <Checkbox
            checked={draft.memoryScopeProject}
            label="记住项目状态"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, memoryScopeProject: checked }))
            }
          />
          <Checkbox
            checked={draft.memoryScopeWorkspace}
            label="记住工作区共识"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, memoryScopeWorkspace: checked }))
            }
          />
        </div>
        <Field label="上下文模板" hint="给这个智能体固定一套项目背景、流程或客户偏好。">
          <Select
            value={draft.selectedPromptTemplateId}
            onChange={(value) =>
              setDraft((next) => ({ ...next, selectedPromptTemplateId: value }))
            }
            options={['', ...data.promptTemplates.map((template) => template.id)]}
            labels={Object.fromEntries(
              data.promptTemplates.map((template) => [template.id, template.name]),
            )}
            emptyLabel="不绑定上下文模板"
          />
        </Field>
        <Field label="风格规范" hint="用于固定文案、设计或代码输出风格。">
          <Select
            value={draft.selectedStyleGuideId}
            onChange={(value) => setDraft((next) => ({ ...next, selectedStyleGuideId: value }))}
            options={['', ...data.styleGuides.map((guide) => guide.id)]}
            labels={Object.fromEntries(data.styleGuides.map((guide) => [guide.id, guide.name]))}
            emptyLabel="不绑定风格规范"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="工作性格">
            <Select
              value={draft.personality}
              onChange={(value) =>
                setDraft((next) => ({ ...next, personality: value as AgentPersonality }))
              }
              options={AGENT_PERSONALITIES}
              labels={PERSONALITY_LABELS}
            />
          </Field>
          <Field label="风险倾向">
            <Select
              value={draft.riskPosture}
              onChange={(value) =>
                setDraft((next) => ({ ...next, riskPosture: value as AgentRiskPosture }))
              }
              options={RISK_POSTURES}
              labels={RISK_POSTURE_LABELS}
            />
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <Field label="看问题角度">
            <Input
              value={draft.perspective}
              onChange={(event) => setDraft((next) => ({ ...next, perspective: event.target.value }))}
              placeholder="例如：用户视角 / 代码质量 / 商业结果"
            />
          </Field>
          <Field label="发散度">
            <Input
              value={draft.temperature}
              onChange={(event) => setDraft((next) => ({ ...next, temperature: event.target.value }))}
              placeholder="0.7"
              type="number"
              min="0"
              max="2"
              step="0.1"
            />
          </Field>
        </div>
        <Field label="团队协作角色" hint="在画布里和其他智能体配合时，它扮演什么位置。">
          <Input
            value={draft.collaborationRole}
            onChange={(event) =>
              setDraft((next) => ({ ...next, collaborationRole: event.target.value }))
            }
            placeholder="例如：主执行 / 审核 / 资料收集 / 交付验收"
          />
        </Field>
      </Section>

      <Section icon={<CheckCircle2 className="size-3.5" />} title="产物质量要求">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Checkbox
            checked={draft.accessibilityHtmlAltText}
            label="HTML 图片说明"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, accessibilityHtmlAltText: checked }))
            }
          />
          <Checkbox
            checked={draft.accessibilitySemanticHtml}
            label="语义化 HTML"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, accessibilitySemanticHtml: checked }))
            }
          />
          <Checkbox
            checked={draft.accessibilityAriaLabels}
            label="控件可读名称"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, accessibilityAriaLabels: checked }))
            }
          />
          <Checkbox
            checked={draft.accessibilityColorContrast}
            label="颜色对比"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, accessibilityColorContrast: checked }))
            }
          />
          <Checkbox
            checked={draft.accessibilityDocumentHeadings}
            label="文档标题"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, accessibilityDocumentHeadings: checked }))
            }
          />
          <Checkbox
            checked={draft.accessibilityDescriptiveLinks}
            label="链接说明"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, accessibilityDescriptiveLinks: checked }))
            }
          />
          <Checkbox
            checked={draft.accessibilityImageAltText}
            label="图片说明"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, accessibilityImageAltText: checked }))
            }
          />
          <Checkbox
            checked={draft.accessibilityColorBlindPalette}
            label="色盲友好"
            onChange={(checked) =>
              setDraft((next) => ({ ...next, accessibilityColorBlindPalette: checked }))
            }
          />
        </div>
      </Section>

      <div ref={capabilitiesSectionRef} data-testid="agent-capabilities-section">
        <Section icon={<Terminal className="size-3.5" />} title="可用能力">
          <CapabilityList
            title="命令行能力"
            emptyText="还没有可选 CLI。先去「工具连接」接入软件或命令。"
            rows={data.cliProfiles}
            selectedIds={draft.selectedCliIds}
            onToggle={(id) =>
              setDraft((next) => ({ ...next, selectedCliIds: toggleId(next.selectedCliIds, id) }))
            }
          />
          <CapabilityList
            title="工具连接"
            emptyText="还没有可选 MCP 工具。先去「工具连接」注册。"
            rows={data.mcpServers}
            selectedIds={draft.selectedMcpIds}
            onToggle={(id) =>
              setDraft((next) => ({ ...next, selectedMcpIds: toggleId(next.selectedMcpIds, id) }))
            }
          />
          <CapabilityList
            title="软件能力"
            emptyText="还没有可选软件能力。先在「工具连接」里创建软件配置。"
            rows={data.softwareProfiles}
            selectedIds={draft.selectedSoftwareIds}
            onToggle={(id) =>
              setDraft((next) => ({
                ...next,
                selectedSoftwareIds: toggleId(next.selectedSoftwareIds, id),
              }))
            }
          />
          <Field label="额外技能 ID" hint="一般不用手填；从技能中心安装后可填入一行一个 ID。">
            <Textarea
              className="min-h-16 text-xs"
              value={draft.skillsText}
              onChange={(event) => setDraft((next) => ({ ...next, skillsText: event.target.value }))}
              placeholder="一行一个 Skill ID"
            />
          </Field>
          <Field label="额外工具连接 ID" hint="高级用法，一般直接勾选上面的工具连接即可。">
            <Textarea
              className="min-h-16 text-xs"
              value={draft.mcpText}
              onChange={(event) => setDraft((next) => ({ ...next, mcpText: event.target.value }))}
              placeholder="一行一个工具连接 ID"
            />
          </Field>
        </Section>
      </div>

      <Section icon={<ShieldCheck className="size-3.5" />} title="安全权限与自主性">
        <Field label="自主程度" hint="控制它能自己做到哪一步。危险动作仍应走审批。">
          <Select
            value={draft.autonomyLevel}
            onChange={(value) => setDraft((next) => ({ ...next, autonomyLevel: value }))}
            options={[
              'observe_only',
              'propose_only',
              'execute_with_approval',
              'execute_low_risk',
              'fully_autonomous',
            ]}
            labels={AUTONOMY_LABELS}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Checkbox
            checked={draft.canReadFiles}
            label="读文件"
            onChange={(checked) => setDraft((next) => ({ ...next, canReadFiles: checked }))}
          />
          <Checkbox
            checked={draft.canWriteFiles}
            label="写文件"
            onChange={(checked) => setDraft((next) => ({ ...next, canWriteFiles: checked }))}
          />
          <Checkbox
            checked={draft.canRunCommands}
            label="运行命令"
            onChange={(checked) => setDraft((next) => ({ ...next, canRunCommands: checked }))}
          />
          <Checkbox
            checked={draft.canUseBrowser}
            label="浏览器"
            onChange={(checked) => setDraft((next) => ({ ...next, canUseBrowser: checked }))}
          />
          <Checkbox
            checked={draft.canUseDesktop}
            label="电脑操作"
            onChange={(checked) => setDraft((next) => ({ ...next, canUseDesktop: checked }))}
          />
          <Checkbox
            checked={draft.canUseNetwork}
            label="联网"
            onChange={(checked) => setDraft((next) => ({ ...next, canUseNetwork: checked }))}
          />
        </div>
        <Field label="系统提示词" hint="定义这个智能体的工作底线和身份。">
          <Textarea
            className="min-h-20 text-xs"
            value={draft.systemPrompt}
            onChange={(event) => setDraft((next) => ({ ...next, systemPrompt: event.target.value }))}
            placeholder="例如：你是一个员工级智能体，必须先理解目标，再使用允许的工具完成交付物。"
          />
        </Field>
        <Field label="行为规则" hint="一行一条，告诉它哪些事情必须遵守。">
          <Textarea
            className="min-h-20 text-xs"
            value={draft.behaviorRulesText}
            onChange={(event) =>
              setDraft((next) => ({ ...next, behaviorRulesText: event.target.value }))
            }
            placeholder="例如：删除文件前必须确认；遇到失败要先自检再汇报。"
          />
        </Field>
        <Field label="完成标准" hint="一行一条，决定什么才算任务完成。">
          <Textarea
            className="min-h-20 text-xs"
            value={draft.successCriteriaText}
            onChange={(event) =>
              setDraft((next) => ({ ...next, successCriteriaText: event.target.value }))
            }
            placeholder="例如：必须产出可预览文件；必须说明验证结果。"
          />
        </Field>
      </Section>

      <Section icon={<CheckCircle2 className="size-3.5" />} title="测试与评估">
        <Field label="测试场景">
          <Input
            value={interviewDraft.scenarioTitle}
            onChange={(event) =>
              setInterviewDraft((next) => ({ ...next, scenarioTitle: event.target.value }))
            }
            placeholder="例如：客户要求生成一份短视频脚本"
          />
        </Field>
        <Field label="测试任务">
          <Textarea
            className="min-h-16 text-xs"
            value={interviewDraft.scenarioTask}
            onChange={(event) =>
              setInterviewDraft((next) => ({ ...next, scenarioTask: event.target.value }))
            }
            placeholder="写清楚要让这个智能体完成什么。"
          />
        </Field>
        <Field label="期望计划">
          <Textarea
            className="min-h-16 text-xs"
            value={interviewDraft.planResponse}
            onChange={(event) =>
              setInterviewDraft((next) => ({ ...next, planResponse: event.target.value }))
            }
            placeholder="希望它先怎么拆解任务。"
          />
        </Field>
        <Field label="期望反馈">
          <Textarea
            className="min-h-16 text-xs"
            value={interviewDraft.feedbackResponse}
            onChange={(event) =>
              setInterviewDraft((next) => ({ ...next, feedbackResponse: event.target.value }))
            }
            placeholder="希望它完成后怎么汇报。"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => void onRunInterview()}
            disabled={saving !== null || !selectedAgentId}
          >
            <CheckCircle2 className="size-3.5" />
            测试
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => void onRunPerformanceReview()}
            disabled={saving !== null || !selectedAgentId}
          >
            <Activity className="size-3.5" />
            复盘
          </Button>
        </div>
        <AgentInterviewCard interview={latestInterview} />
        <PerformanceReviewCard review={latestReview} />
      </Section>

      <Section icon={<Activity className="size-3.5" />} title={embedded ? '当前配置' : '已保存配置'}>
        <Select
          value={selectedAgentId}
          onChange={setSelectedAgentId}
          options={['', ...data.agentProfiles.map((agent) => agent.id)]}
          labels={Object.fromEntries(data.agentProfiles.map((agent) => [agent.id, agent.name]))}
          emptyLabel="选择智能体配置"
        />
        {selectedAgent ? (
          <div className="rounded-md border bg-muted/30 p-2 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium">{selectedAgent.name}</span>
              <Badge variant="outline">{selectedAgent.status}</Badge>
            </div>
            <div className="mt-1 text-muted-foreground">{selectedAgent.role}</div>
            <div className="mt-1 text-muted-foreground">
              风格：{activeStyleGuideName(selectedAgent.id, data)}
            </div>
            <div className="mt-1 text-muted-foreground">
              协作画像：{activeDiversitySummary(selectedAgent.id, data)}
            </div>
            <CodeLine value={selectedAgent.id} />
          </div>
        ) : (
          <EmptyLine text="还没有选择智能体配置" />
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full gap-1 text-xs"
          onClick={() => void onAnalyzeDiversity()}
          disabled={saving !== null || data.agentProfiles.length === 0}
        >
          <Activity className="size-3.5" />
          分析团队差异
        </Button>
        <DiversityAnalysisCard analysis={data.diversityAnalyses[0] ?? null} />
      </Section>
    </>
  )
}

function DiversityAnalysisCard({ analysis }: { analysis: DiversityAnalysisRow | null }) {
  if (!analysis) return <EmptyLine text="No diversity analysis yet." />
  return (
    <div className="rounded-md border bg-muted/30 p-2 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium">Team diversity</span>
        <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
          {analysis.scopeType}
        </Badge>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
        <div>
          <div className="font-mono text-foreground">{analysis.modelDiversity.length}</div>
          <div>models</div>
        </div>
        <div>
          <div className="font-mono text-foreground">{analysis.skillDiversity}</div>
          <div>skills</div>
        </div>
        <div>
          <div className="font-mono text-foreground">
            {Math.round(analysis.perspectiveDiversity * 100)}
          </div>
          <div>views</div>
        </div>
      </div>
      <div className="mt-1 line-clamp-2 text-muted-foreground">{analysis.recommendation}</div>
      {analysis.missingPerspectives.length > 0 && (
        <div className="mt-1 line-clamp-1 font-mono text-[10px] text-muted-foreground">
          missing: {analysis.missingPerspectives.join(', ')}
        </div>
      )}
    </div>
  )
}

function AgentInterviewCard({ interview }: { interview: AgentInterviewRow | null }) {
  if (!interview) return <EmptyLine text="No Agent interview yet." />
  return (
    <div className="rounded-md border bg-muted/30 p-2 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{interview.scenarioTitle}</span>
        <Badge
          variant={interview.status === 'failed' ? 'destructive' : 'outline'}
          className="h-5 px-1.5 text-[9px]"
        >
          {interview.overallScore}/100
        </Badge>
      </div>
      <div className="mt-1 text-muted-foreground">{interview.trialDecision}</div>
      {interview.warnings.length > 0 && (
        <div className="mt-1 line-clamp-2 text-muted-foreground">
          warning: {interview.warnings[0]}
        </div>
      )}
      {interview.promptPatches.length > 0 && (
        <div className="mt-1 line-clamp-1 font-mono text-[10px] text-muted-foreground">
          patch: {interview.promptPatches[0]}
        </div>
      )}
    </div>
  )
}

function PerformanceReviewCard({ review }: { review: PerformanceReviewRow | null }) {
  if (!review) return <EmptyLine text="No performance review yet." />
  return (
    <div className="rounded-md border bg-muted/30 p-2 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium">Performance review</span>
        <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
          {review.overallScore}/100
        </Badge>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
        <div>
          <div className="font-mono text-foreground">{Math.round(review.qualityScore)}</div>
          <div>quality</div>
        </div>
        <div>
          <div className="font-mono text-foreground">{Math.round(review.reliabilityScore)}</div>
          <div>reliable</div>
        </div>
        <div>
          <div className="font-mono text-foreground">{review.sampledRunIds.length}</div>
          <div>runs</div>
        </div>
      </div>
      <div className="mt-1 line-clamp-2 text-muted-foreground">
        {review.improvementSuggestions[0] ?? review.findings[0]}
      </div>
    </div>
  )
}

function RunMonitor({
  data,
  runDraft,
  setRunDraft,
  selectedAgentId,
  setSelectedAgentId,
  selectedRunId,
  setSelectedRunId,
  selectedRun,
  runEvents,
  runCliRuns,
  runComputerSessions,
  runComputerActions,
  runContextSnapshots,
  runBudgetEvents,
  runDecisionAudits,
  runSecurityAuditLogs,
  runRecoveryEvents,
  runArtifactValidations,
  runMultimodalInputs,
  runMultimodalOutputs,
  runLearningEvents,
  runMemories,
  runReflection,
  saving,
  onStart,
  onPause,
  onResume,
  onCancel,
  onApproveLearning,
  onRejectLearning,
  onComputerMark,
}: {
  data: FactoryData
  runDraft: RunDraft
  setRunDraft: Dispatch<SetStateAction<RunDraft>>
  selectedAgentId: string
  setSelectedAgentId: (id: string) => void
  selectedRunId: string
  setSelectedRunId: (id: string) => void
  selectedRun: EmployeeRunRow | null
  runEvents: EmployeeRunEventRow[]
  runCliRuns: CliRunRow[]
  runComputerSessions: ComputerSessionRow[]
  runComputerActions: ComputerActionEventRow[]
  runContextSnapshots: RuntimeContextSnapshotRow[]
  runBudgetEvents: BudgetEventRow[]
  runDecisionAudits: DecisionAuditTrailRow[]
  runSecurityAuditLogs: AuditLogRow[]
  runRecoveryEvents: RecoveryEventRow[]
  runArtifactValidations: ArtifactValidationRow[]
  runMultimodalInputs: MultimodalInputRow[]
  runMultimodalOutputs: MultimodalOutputRow[]
  runLearningEvents: LearningEventRow[]
  runMemories: MemoryItemRow[]
  runReflection: RunReflectionRow | null
  saving: string | null
  onStart: () => Promise<void>
  onPause: () => Promise<void>
  onResume: () => Promise<void>
  onCancel: () => Promise<void>
  onApproveLearning: (id: string) => Promise<void>
  onRejectLearning: (id: string) => Promise<void>
  onComputerMark: (session: ComputerSessionRow, kind: 'observe' | 'screenshot') => void
}) {
  return (
    <>
      <Section
        icon={<Play className="size-3.5" />}
        title="Start Run"
        actionLabel="Start"
        saving={saving === 'Employee run'}
        onAction={onStart}
      >
        <Select
          value={selectedAgentId}
          onChange={setSelectedAgentId}
          options={['', ...data.agentProfiles.map((agent) => agent.id)]}
          labels={Object.fromEntries(data.agentProfiles.map((agent) => [agent.id, agent.name]))}
          emptyLabel="Select Agent"
        />
        <Textarea
          className="min-h-20 text-xs"
          value={runDraft.goal}
          onChange={(event) => setRunDraft((draft) => ({ ...draft, goal: event.target.value }))}
          placeholder="Goal"
        />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            value={runDraft.budgetLimitCents}
            onChange={(event) =>
              setRunDraft((draft) => ({ ...draft, budgetLimitCents: event.target.value }))
            }
            placeholder="Budget cents"
            type="number"
          />
          <Checkbox
            checked={runDraft.autoComplete}
            label="Auto"
            onChange={(checked) => setRunDraft((draft) => ({ ...draft, autoComplete: checked }))}
          />
        </div>
      </Section>

      <Section icon={<Activity className="size-3.5" />} title="Runs">
        <div className="space-y-1">
          {data.employeeRuns.length === 0 ? (
            <EmptyLine text="No employee runs yet." />
          ) : (
            data.employeeRuns.slice(0, 8).map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setSelectedRunId(run.id)}
                className={cn(
                  'w-full rounded-md border p-2 text-left transition hover:bg-accent',
                  selectedRunId === run.id && 'border-primary bg-primary/5',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs font-medium">{run.goal}</span>
                  <StatusBadge status={run.status} />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
                  <span className="truncate">{run.currentPhase}</span>
                  <span>{formatTime(run.updatedAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </Section>

      <Section icon={<CheckCircle2 className="size-3.5" />} title="Selected Run">
        {selectedRun ? (
          <>
            <div className="rounded-md border bg-muted/30 p-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium">{selectedRun.currentPhase}</span>
                <StatusBadge status={selectedRun.status} />
              </div>
              <div className="mt-1 text-muted-foreground">{selectedRun.currentStep}</div>
              <CodeLine value={selectedRun.id} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => void onPause()}
                disabled={saving !== null || !['queued', 'running'].includes(selectedRun.status)}
              >
                <Pause className="size-3.5" />
                Pause
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => void onResume()}
                disabled={saving !== null || selectedRun.status !== 'paused'}
              >
                <RotateCcw className="size-3.5" />
                Resume
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => void onCancel()}
                disabled={
                  saving !== null ||
                  ['complete', 'failed', 'aborted'].includes(selectedRun.status)
                }
              >
                <Square className="size-3.5" />
                Stop
              </Button>
            </div>
            <CliRunList cliRuns={runCliRuns} />
            <ComputerSessionList
              sessions={runComputerSessions}
              actions={runComputerActions}
              onMark={onComputerMark}
              busy={!!saving}
            />
            <ContextSnapshotList contextSnapshots={runContextSnapshots} />
            <BudgetAuditList budgetEvents={runBudgetEvents} decisionAudits={runDecisionAudits} />
            <SecurityAuditList auditLogs={runSecurityAuditLogs} />
            <RecoveryEventList recoveryEvents={runRecoveryEvents} />
            <MultimodalIoList inputs={runMultimodalInputs} outputs={runMultimodalOutputs} />
            <ArtifactValidationList validations={runArtifactValidations} />
            <LearningEventList
              learningEvents={runLearningEvents}
              saving={saving}
              onApprove={onApproveLearning}
              onReject={onRejectLearning}
            />
            <div className="space-y-1">
              {runEvents.length === 0 ? (
                <EmptyLine text="No events loaded." />
              ) : (
                runEvents.map((event) => (
                  <div key={event.id} className="rounded-md border px-2 py-1.5 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {event.phase}
                      </span>
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                        {event.type}
                      </Badge>
                    </div>
                    <div className="mt-0.5">{event.message}</div>
                  </div>
                ))
              )}
            </div>
            <LearningReflection reflection={runReflection} />
            <MemoryWriteList memories={runMemories} />
          </>
        ) : (
          <EmptyLine text="Select a run to inspect events." />
        )}
      </Section>
    </>
  )
}

function AgentSettingsSummary({
  role,
  artifactType,
  modelName,
  workstation,
  autonomy,
  capabilitySummary,
}: {
  role: string
  artifactType: string
  modelName: string
  workstation: string
  autonomy: string
  capabilitySummary: string
}) {
  return (
    <section className="rounded-lg border bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Bot className="size-4 text-primary" />
        <span>这个智能体现在的配置</span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <SummaryTile label="岗位" value={role || '未设置岗位'} />
        <SummaryTile label="必须交付" value={artifactType || '未设置交付物'} />
        <SummaryTile label="模型" value={modelName} />
        <SummaryTile label="工作位置" value={workstation} />
        <SummaryTile label="自主程度" value={autonomy} />
        <SummaryTile label="已分配能力" value={capabilitySummary} />
      </div>
    </section>
  )
}

function AgentToolboxSummary({
  modelName,
  skillCount,
  cliCount,
  mcpCount,
  softwareCount,
  permissionSummary,
  outputTarget,
  onAssign,
}: {
  modelName: string
  skillCount: number
  cliCount: number
  mcpCount: number
  softwareCount: number
  permissionSummary: string
  outputTarget: string
  onAssign: () => void
}) {
  return (
    <section
      className="rounded-lg border bg-background p-3 shadow-sm"
      data-testid="agent-toolbox-summary"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Package className="size-4 text-primary" />
            <span>员工工具包</span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            模型、技能、CLI、MCP、软件和权限都在这里统一分配。用户只需要知道这个员工能用什么、最终交付什么。
          </p>
        </div>
        <Button type="button" size="sm" onClick={onAssign} className="shrink-0">
          分配能力
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <ToolboxTile label="模型" value={modelName} />
        <ToolboxTile label="技能" value={`${skillCount} 个`} />
        <ToolboxTile label="CLI" value={`${cliCount} 个`} />
        <ToolboxTile label="MCP" value={`${mcpCount} 个`} />
        <ToolboxTile label="软件" value={`${softwareCount} 个`} />
        <ToolboxTile label="权限" value={permissionSummary} />
      </div>
      <div className="mt-2 rounded-md border bg-primary/5 px-2.5 py-2 text-xs">
        <span className="font-medium text-foreground">交付给客户看到：</span>
        <span className="ml-1 text-muted-foreground">{outputTarget}</span>
      </div>
    </section>
  )
}

function ToolboxTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 px-2.5 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-xs font-medium">{value}</div>
    </div>
  )
}

function AgentEmployeeControlPanel({
  draft,
  modelName,
  promptTemplateName,
  styleGuideName,
  capabilitySummary,
}: {
  draft: AgentDraft
  modelName: string
  promptTemplateName: string
  styleGuideName: string
  capabilitySummary: string
}) {
  const memoryScopes = [
    draft.memoryScopeAgent ? '本智能体经验' : null,
    draft.memoryScopeProject ? '项目状态' : null,
    draft.memoryScopeWorkspace ? '工作区共识' : null,
  ].filter(Boolean)
  const allowedActions = [
    draft.canReadFiles ? '读文件' : null,
    draft.canWriteFiles ? '写文件' : null,
    draft.canRunCommands ? '运行命令' : null,
    draft.canUseBrowser ? '浏览器' : null,
    draft.canUseDesktop ? '电脑操作' : null,
    draft.canUseNetwork ? '联网' : null,
  ].filter(Boolean)
  const outputTarget = draft.outputArtifactType || '未设置交付物'
  const collaboration = draft.collaborationRole || '可单人执行，也可进入工作对话区或编排画布'
  const memoryDescription = draft.memoryEnabled
    ? `会记住：${memoryScopes.length ? memoryScopes.join('、') : '当前任务经验'}`
    : '长期记忆已关闭，只使用本次任务上下文'

  return (
    <Section icon={<Bot className="size-3.5" />} title="员工能力控制台">
      <div
        className="rounded-md border bg-muted/25 p-2.5 text-xs text-muted-foreground"
        data-testid="agent-employee-control-panel"
      >
        <span className="font-medium text-foreground">统一在智能体设置里管理。</span>
        这里把原来的记忆、上下文、能力、团队协作和安全治理收成一个员工设置面板。
      </div>
      <div className="grid gap-2 xl:grid-cols-2">
        <ControlPanelRow
          icon={<BrainCircuit className="size-4 text-primary" />}
          title="记忆与上下文"
          value={memoryDescription}
          detail={`上下文：${promptTemplateName}；风格：${styleGuideName}`}
        />
        <ControlPanelRow
          icon={<ShieldCheck className="size-4 text-primary" />}
          title="权限与安全"
          value={allowedActions.length ? allowedActions.join('、') : '只允许观察和回复'}
          detail={`自主程度：${AUTONOMY_LABELS[draft.autonomyLevel] ?? draft.autonomyLevel}`}
        />
        <ControlPanelRow
          icon={<Activity className="size-4 text-primary" />}
          title="协作方式"
          value={collaboration}
          detail={`模型：${modelName}；工作位置：${
            WORKSTATION_MODE_LABELS[draft.workstationMode] ?? draft.workstationMode
          }`}
        />
        <ControlPanelRow
          icon={<CheckCircle2 className="size-4 text-primary" />}
          title="输出交付"
          value={`客户最终看到：${outputTarget}`}
          detail="画布会按这个产物类型传递给下一个 Agent 或交付检查"
        />
        <ControlPanelRow
          icon={<Terminal className="size-4 text-primary" />}
          title="技能 / MCP / CLI / 软件"
          value={capabilitySummary}
          detail="只需要在这里勾选已经接入的能力，不再让用户理解底层适配器"
          className="xl:col-span-2"
        />
      </div>
    </Section>
  )
}

function ControlPanelRow({
  icon,
  title,
  value,
  detail,
  className,
}: {
  icon: ReactNode
  title: string
  value: string
  detail: string
  className?: string
}) {
  return (
    <div className={cn('rounded-md border bg-background p-2.5', className)}>
      <div className="flex items-center gap-2">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{title}</div>
          <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{value}</div>
        </div>
        <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[9px]">
          已集中
        </Badge>
      </div>
      <div className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{detail}</div>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-background px-2.5 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-xs font-medium">{value}</div>
    </div>
  )
}

function Section({
  icon,
  title,
  actionLabel,
  saving,
  onAction,
  children,
}: {
  icon: ReactNode
  title: string
  actionLabel?: string
  saving?: boolean
  onAction?: () => Promise<void>
  children: ReactNode
}) {
  return (
    <section className="rounded-md border bg-background/60">
      <div className="flex items-center justify-between gap-2 border-b px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
          {icon}
          <span className="truncate">{title}</span>
        </div>
        {actionLabel && onAction && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[11px]"
            onClick={() => void onAction()}
            disabled={saving}
          >
            {saving ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
            {actionLabel}
          </Button>
        )}
      </div>
      <div className="space-y-2 p-2.5">{children}</div>
    </section>
  )
}

function CliRunList({ cliRuns }: { cliRuns: CliRunRow[] }) {
  if (cliRuns.length === 0) return <EmptyLine text="No CLI dry-runs for this run." />
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">CLI dry-runs</div>
      {cliRuns.map((cliRun) => (
        <div key={cliRun.id} className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-mono text-[10px]">
              {[cliRun.command, cliRun.renderedArgs].filter(Boolean).join(' ')}
            </span>
            <CliRunStatusBadge status={cliRun.status} />
          </div>
          <div className="mt-1 grid grid-cols-[1fr_auto] gap-2 text-[10px] text-muted-foreground">
            <span className="truncate font-mono">{cliRun.cwd}</span>
            <span>{cliRun.mode}</span>
          </div>
          {cliRun.envKeys.length > 0 && (
            <div className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
              env: {cliRun.envKeys.join(', ')}
            </div>
          )}
          {cliRun.error && <div className="mt-1 line-clamp-2 text-destructive">{cliRun.error}</div>}
        </div>
      ))}
    </div>
  )
}

function CliRunStatusBadge({ status }: { status: CliRunRow['status'] }) {
  const variant: 'default' | 'secondary' | 'destructive' | 'outline' =
    status === 'failed' || status === 'blocked'
      ? 'destructive'
      : status === 'complete'
        ? 'default'
        : 'secondary'
  return (
    <Badge variant={variant} className="h-5 px-1.5 text-[9px]">
      {status}
    </Badge>
  )
}

function ComputerSessionList({
  sessions,
  actions,
  onMark,
  busy,
}: {
  sessions: ComputerSessionRow[]
  actions: ComputerActionEventRow[]
  onMark?: (session: ComputerSessionRow, kind: 'observe' | 'screenshot') => void
  busy?: boolean
}) {
  if (sessions.length === 0) return <EmptyLine text="No computer sessions for this run." />
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">Computer sessions</div>
      {sessions.map((session) => {
        const sessionActions = actions.filter((action) => action.computerSessionId === session.id)
        const latestActions = sessionActions.slice(-3).reverse()
        return (
          <div key={session.id} className="rounded-md border px-2 py-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium">{session.mode}</span>
              <Badge variant={session.status === 'failed' ? 'destructive' : 'outline'} className="h-5 px-1.5 text-[9px]">
                {session.status}
              </Badge>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="truncate font-mono">{session.workspacePath}</span>
              <span>{sessionActions.length} actions</span>
            </div>
            {onMark && (
              <div className="mt-1.5 flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1 gap-1 px-2 text-[10px]"
                  disabled={busy}
                  onClick={() => onMark(session, 'observe')}
                >
                  <Eye className="size-3" />
                  Observe
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1 gap-1 px-2 text-[10px]"
                  disabled={busy}
                  onClick={() => onMark(session, 'screenshot')}
                >
                  <Camera className="size-3" />
                  Screenshot
                </Button>
              </div>
            )}
            {latestActions.length > 0 && (
              <div className="mt-1.5 space-y-1">
                {latestActions.map((action) => (
                  <div key={action.id} className="rounded bg-muted/40 px-1.5 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{action.actionType}</span>
                      <span className="text-[9px] text-muted-foreground">{action.status}</span>
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                      {summarizeComputerAction(action)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function summarizeComputerAction(action: ComputerActionEventRow): string {
  const outputSummary = action.output.summary
  if (typeof outputSummary === 'string' && outputSummary.trim()) return outputSummary
  if (action.target) return action.target
  return new Date(action.createdAt).toLocaleTimeString()
}

function ContextSnapshotList({
  contextSnapshots,
}: {
  contextSnapshots: RuntimeContextSnapshotRow[]
}) {
  if (contextSnapshots.length === 0) {
    return <EmptyLine text="No context snapshots for this run." />
  }
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">Context snapshots</div>
      {contextSnapshots.map((snapshot) => (
        <div key={snapshot.id} className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-medium">{snapshot.summary}</span>
            <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
              {snapshot.tokenEstimate} tok
            </Badge>
          </div>
          <div className="mt-1 grid grid-cols-[1fr_auto] gap-2 text-[10px] text-muted-foreground">
            <span className="truncate font-mono">
              {snapshot.promptTemplateVersionId ?? 'agent_system_prompt'}
            </span>
            <span>{snapshot.tokenBudget ? `${snapshot.tokenBudget} max` : 'no budget'}</span>
          </div>
          <div className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
            keys: {Object.keys(snapshot.visibleContext).join(', ')}
          </div>
        </div>
      ))}
    </div>
  )
}

function BudgetAuditList({
  budgetEvents,
  decisionAudits,
}: {
  budgetEvents: BudgetEventRow[]
  decisionAudits: DecisionAuditTrailRow[]
}) {
  if (budgetEvents.length === 0 && decisionAudits.length === 0) {
    return <EmptyLine text="No budget or decision audit records for this run." />
  }
  const totalCents = budgetEvents.reduce((sum, event) => sum + event.amountCents, 0)
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">Budget and audit</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="font-mono text-[12px]">{totalCents}c</div>
          <div className="text-[10px] text-muted-foreground">{budgetEvents.length} budget events</div>
        </div>
        <div className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="font-mono text-[12px]">{decisionAudits.length}</div>
          <div className="text-[10px] text-muted-foreground">decisions</div>
        </div>
      </div>
      {decisionAudits.slice(0, 3).map((audit) => (
        <div key={audit.id} className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-mono text-[10px]">{audit.decisionType}</span>
            <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
              audit
            </Badge>
          </div>
          <div className="mt-1 line-clamp-2 text-muted-foreground">{audit.rationale}</div>
        </div>
      ))}
    </div>
  )
}

function SecurityAuditList({ auditLogs }: { auditLogs: AuditLogRow[] }) {
  if (auditLogs.length === 0) return <EmptyLine text="No security audit records for this run." />
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">Security audit</div>
      {auditLogs.slice(0, 4).map((audit) => (
        <div key={audit.id} className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-mono text-[10px]">{audit.action}</span>
            <Badge
              variant={audit.status === 'blocked' ? 'destructive' : 'outline'}
              className="h-5 px-1.5 text-[9px]"
            >
              {audit.riskLevel}
            </Badge>
          </div>
          <div className="mt-1 line-clamp-2 text-muted-foreground">{audit.message}</div>
        </div>
      ))}
    </div>
  )
}

function RecoveryEventList({ recoveryEvents }: { recoveryEvents: RecoveryEventRow[] }) {
  if (recoveryEvents.length === 0) return <EmptyLine text="No recovery events for this run." />
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">Recovery events</div>
      {recoveryEvents.slice(0, 4).map((event) => (
        <div key={event.id} className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-mono text-[10px]">{event.eventType}</span>
            <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
              {event.status}
            </Badge>
          </div>
          <div className="mt-1 line-clamp-2 text-muted-foreground">{event.summary}</div>
        </div>
      ))}
    </div>
  )
}

function ArtifactValidationList({ validations }: { validations: ArtifactValidationRow[] }) {
  if (validations.length === 0) return <EmptyLine text="No artifact validations for this run." />
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">Artifact validations</div>
      {validations.map((validation) => {
        const styleSummary = styleGuideValidationSummary(validation.result)
        const accessibilitySummary = accessibilityValidationSummary(validation.result)
        return (
          <div key={validation.id} className="rounded-md border px-2 py-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium">
                {validation.rules.length > 0 ? validation.rules.join(', ') : 'output contract'}
              </span>
              <Badge
                variant={validation.status === 'failed' ? 'destructive' : 'default'}
                className="h-5 px-1.5 text-[9px]"
              >
                {validation.status}
              </Badge>
            </div>
            {styleSummary && (
              <div className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
                style: {styleSummary}
              </div>
            )}
            {accessibilitySummary && (
              <div className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
                accessibility: {accessibilitySummary}
              </div>
            )}
            <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
              {validation.id}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MultimodalIoList({
  inputs,
  outputs,
}: {
  inputs: MultimodalInputRow[]
  outputs: MultimodalOutputRow[]
}) {
  if (inputs.length === 0 && outputs.length === 0) {
    return <EmptyLine text="No multimodal IO registered for this run." />
  }
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">Multimodal IO</div>
      {inputs.slice(0, 4).map((input) => (
        <div key={input.id} className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-medium">input: {input.kind}</span>
            <StatusPill status={input.status} />
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2 font-mono text-[10px] text-muted-foreground">
            <span className="truncate">{input.mimeType ?? input.source}</span>
            <span className="truncate text-right">{input.dataRef ?? input.description ?? input.id}</span>
          </div>
        </div>
      ))}
      {outputs.slice(0, 4).map((output) => (
        <div key={output.id} className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-medium">output: {output.kind}</span>
            <StatusPill status={output.status} />
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2 font-mono text-[10px] text-muted-foreground">
            <span className="truncate">{output.format ?? output.artifactId ?? 'contract'}</span>
            <span className="truncate text-right">{output.path ?? output.caption ?? output.id}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function LearningEventList({
  learningEvents,
  saving,
  onApprove,
  onReject,
}: {
  learningEvents: LearningEventRow[]
  saving: string | null
  onApprove: (id: string) => Promise<void>
  onReject: (id: string) => Promise<void>
}) {
  if (learningEvents.length === 0) return <EmptyLine text="No learning proposals for this run." />
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">Learning proposals</div>
      {learningEvents.map((event) => (
        <div key={event.id} className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-medium">{event.title}</span>
            <Badge
              variant={event.status === 'rejected' ? 'destructive' : 'outline'}
              className="h-5 px-1.5 text-[9px]"
            >
              {event.status}
            </Badge>
          </div>
          <div className="mt-1 line-clamp-2 text-muted-foreground">{event.summary}</div>
          {event.status === 'pending_review' && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                disabled={saving !== null}
                onClick={() => void onReject(event.id)}
              >
                Reject
              </Button>
              <Button
                size="sm"
                className="h-7"
                disabled={saving !== null}
                onClick={() => void onApprove(event.id)}
              >
                Publish
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function LearningReflection({ reflection }: { reflection: RunReflectionRow | null }) {
  if (!reflection) return <EmptyLine text="No reflection written for this run." />
  return (
    <div className="space-y-1 rounded-md border p-2 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">Learning reflection</span>
        <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
          reflection
        </Badge>
      </div>
      <MiniList title="Worked" items={reflection.whatWorked} />
      <MiniList title="New knowledge" items={reflection.newKnowledge} />
      <MiniList title="Procedure" items={reflection.reusableProcedure} />
      {reflection.futureWarnings.length > 0 && (
        <MiniList title="Warnings" items={reflection.futureWarnings} />
      )}
    </div>
  )
}

function MemoryWriteList({ memories }: { memories: MemoryItemRow[] }) {
  if (memories.length === 0) return <EmptyLine text="No memory writes for this run." />
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground">Memory writes</div>
      {memories.map((memory) => (
        <div key={memory.id} className="rounded-md border px-2 py-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-medium">{memory.title}</span>
            <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
              {memory.type}
            </Badge>
          </div>
          <div className="mt-1 line-clamp-2 text-muted-foreground">{memory.content}</div>
        </div>
      ))}
    </div>
  )
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="mt-1 text-[10px] uppercase text-muted-foreground">{title}</div>
      {items.slice(0, 3).map((item) => (
        <div key={item} className="mt-0.5 line-clamp-2">
          {item}
        </div>
      ))}
    </div>
  )
}

function isOnboardingWorkType(value: string): value is OnboardingWorkType {
  return ONBOARDING_WORK_TYPES.includes(value as OnboardingWorkType)
}

function onboardingChecklistDone(checklist: Record<string, unknown>, key: string): boolean {
  return checklist[key] === true
}

function onboardingNextSteps(checklist: Record<string, unknown>): string[] {
  const raw = checklist.nextSteps
  return Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function Select({
  value,
  options,
  labels,
  emptyLabel,
  onChange,
}: {
  value: string
  options: string[]
  labels?: Record<string, string>
  emptyLabel?: string
  onChange: (value: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
    >
      {options.map((option) => (
        <option key={option || '__empty'} value={option}>
          {option ? labels?.[option] ?? option : emptyLabel ?? 'None'}
        </option>
      ))}
    </select>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block min-w-0 space-y-1">
      <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[10px] leading-relaxed text-muted-foreground">{hint}</span>}
    </label>
  )
}

function Checkbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border px-2 text-[11px] text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3 shrink-0"
      />
      <span className="truncate">{label}</span>
    </label>
  )
}

function CapabilityList<T extends { id: string; name?: string; displayName?: string }>({
  title,
  emptyText,
  rows,
  selectedIds,
  onToggle,
}: {
  title: string
  emptyText?: string
  rows: T[]
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase text-muted-foreground">{title}</div>
      <div className="space-y-1">
        {rows.length === 0 ? (
          <EmptyLine text={emptyText ?? `还没有可选${title}`} />
        ) : (
          rows.map((row) => (
            <label
              key={row.id}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(row.id)}
                onChange={() => onToggle(row.id)}
                className="size-3 shrink-0"
              />
              <span className="min-w-0 flex-1 truncate">{row.name ?? row.displayName ?? row.id}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-1.5 py-1">
      <div className="font-mono text-[11px] text-foreground">{value}</div>
      <div className="truncate">{label}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: EmployeeRunRow['status'] }) {
  const variant: 'default' | 'secondary' | 'destructive' | 'outline' =
    status === 'failed' || status === 'aborted'
      ? 'destructive'
      : status === 'complete'
        ? 'default'
        : status === 'running'
          ? 'secondary'
          : 'outline'
  return (
    <Badge variant={variant} className="h-5 px-1.5 text-[9px]">
      {status}
    </Badge>
  )
}

function StatusPill({ status }: { status: string }) {
  const variant = status === 'rejected' || status === 'failed' ? 'destructive' : 'outline'
  return (
    <Badge variant={variant} className="h-5 px-1.5 text-[9px]">
      {status}
    </Badge>
  )
}

function CodeLine({ value }: { value: string }) {
  return <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{value}</div>
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/20 px-2 py-3 text-center text-[11px] text-muted-foreground">
      {text}
    </div>
  )
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseTermMap(value: string): Record<string, string> {
  return Object.fromEntries(
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.includes('=') ? '=' : '->'
        const [from, to] = line.split(separator).map((part) => part.trim())
        return from && to ? ([from, to] as const) : null
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry)),
  )
}

function activeStyleGuideName(agentProfileId: string, data: FactoryData): string {
  const binding = data.styleGuideBindings.find(
    (row) => row.agentProfileId === agentProfileId && row.status === 'active',
  )
  if (!binding) return 'none'
  return data.styleGuides.find((guide) => guide.id === binding.styleGuideId)?.name ?? binding.styleGuideId
}

function activeDiversitySummary(agentProfileId: string, data: FactoryData): string {
  const profile = data.agentDiversityProfiles.find(
    (row) => row.agentProfileId === agentProfileId && row.status === 'active',
  )
  if (!profile) return 'not configured'
  return `${profile.personality}, ${profile.perspective}, temp ${profile.temperature}`
}

function styleGuideValidationSummary(result: Record<string, unknown>): string | null {
  const styleGuide = result.styleGuide
  if (!styleGuide || typeof styleGuide !== 'object' || Array.isArray(styleGuide)) return null
  const row = styleGuide as Record<string, unknown>
  const name = typeof row.styleGuideName === 'string' ? row.styleGuideName : 'style guide'
  const passed = row.passed === true
  const violations = Array.isArray(row.violations) ? row.violations.length : 0
  return passed ? `${name} passed` : `${name} failed with ${violations} issue${violations === 1 ? '' : 's'}`
}

function accessibilityValidationSummary(result: Record<string, unknown>): string | null {
  const accessibility = result.accessibility
  if (!accessibility || typeof accessibility !== 'object' || Array.isArray(accessibility)) return null
  const row = accessibility as Record<string, unknown>
  if (row.enabled !== true) return null
  const checks = Array.isArray(row.checks) ? row.checks.length : 0
  const missing = Array.isArray(row.missing) ? row.missing.length : 0
  const warnings = Array.isArray(row.warnings) ? row.warnings.length : 0
  if (missing > 0) return `${missing} missing / ${checks} checks`
  return warnings > 0 ? `passed / ${checks} checks / ${warnings} warnings` : `passed / ${checks} checks`
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

function nullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parseTrait(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0.5
  return Math.max(0, Math.min(1, Math.round(parsed * 100) / 100))
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
