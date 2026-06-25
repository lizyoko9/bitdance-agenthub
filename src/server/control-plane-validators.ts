import { z } from 'zod'

export const JsonObjectSchema = z.record(z.string(), z.unknown())

export const KnowledgeNodeTypeSchema = z.enum([
  'capability',
  'agent',
  'skill',
  'tool',
  'model',
  'playbook',
  'person',
  'project',
  'software',
  'concept',
  'file',
  'error',
  'solution',
  'customer',
])

export const KnowledgeEdgeTypeSchema = z.enum([
  'represents',
  'uses',
  'requires',
  'produces',
  'similar_to',
  'recommended_for',
  'owned_by',
  'depends_on',
  'solves',
  'causes',
  'belongs_to',
  'prefers',
  'avoids',
  'alternative_to',
])

export const KnowledgeGraphRebuildBody = z.object({
  limit: z.number().int().positive().max(1000).optional(),
  includeExpired: z.boolean().optional(),
})

export const KnowledgeGraphQueryBody = z.object({
  query: z.string().min(1),
  scenario: z.enum(['general', 'error_solution', 'customer_preference', 'software_command']).optional(),
  limit: z.number().int().positive().max(50).optional(),
})

export const SimulationTaskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  input: JsonObjectSchema.optional(),
  successCriteria: z.array(z.string()).optional(),
  environmentSnapshot: JsonObjectSchema.optional(),
})

export const SimulationRunBody = z.object({
  targetType: z.enum(['agent', 'workflow']),
  agentProfileId: z.string().nullable().optional(),
  workflowId: z.string().nullable().optional(),
  mode: z.enum(['dry_run', 'user_played_environment']).optional(),
  taskTitle: z.string().min(1),
  input: JsonObjectSchema.optional(),
  simulatedEnvironment: JsonObjectSchema.optional(),
  simulatedToolResults: z.array(JsonObjectSchema).optional(),
})

export const SimulationReviewBody = z.object({
  decision: z.enum(['approved', 'rejected']),
  adjustments: z.array(JsonObjectSchema).optional(),
})

export const GoldenTaskSetBody = z.object({
  name: z.string().min(1),
  targetType: z.enum(['agent', 'workflow']).optional(),
  agentProfileId: z.string().nullable().optional(),
  workflowId: z.string().nullable().optional(),
  tasks: z.array(SimulationTaskSchema).min(1),
  successCriteria: z.array(z.string()).optional(),
  ciPolicy: JsonObjectSchema.optional(),
  status: z.enum(['active', 'draft', 'archived']).optional(),
})

export const BacktestRunBody = z.object({
  mode: z.enum(['historical', 'golden']).optional(),
  targetType: z.enum(['agent', 'workflow']),
  agentProfileId: z.string().nullable().optional(),
  workflowId: z.string().nullable().optional(),
  goldenTaskSetId: z.string().nullable().optional(),
  historicalTasks: z.array(SimulationTaskSchema).optional(),
  baselineVersion: z.string().optional(),
  candidateVersion: z.string().optional(),
  candidateChanges: JsonObjectSchema.optional(),
})

export const ErrorTaxonomyCategorySchema = z.enum([
  'model_error',
  'tool_error',
  'network_error',
  'permission_error',
  'resource_error',
  'input_error',
  'environment_error',
  'rate_limit_error',
  'timeout_error',
])

export const ErrorSeveritySchema = z.enum(['recoverable', 'recoverable_with_help', 'fatal'])

export const RecoveryStrategyTypeSchema = z.enum([
  'retry',
  'retry_with_fallback_model',
  'retry_with_different_approach',
  'skip_step',
  'replan_from_scratch',
  'ask_user',
  'rollback',
  'delegate_to_agent',
])

export const RecoveryStrategyOutcomeSchema = z.enum([
  'succeeded',
  'failed',
  'skipped',
  'needs_user',
])

export const ErrorClassificationBody = z.object({
  resourceType: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional(),
  agentProfileId: z.string().nullable().optional(),
  message: z.string().min(1),
  context: JsonObjectSchema.optional(),
})

export const RecoveryStrategyRecommendationBody = z.object({
  category: ErrorTaxonomyCategorySchema,
  severity: ErrorSeveritySchema.optional(),
  agentProfileId: z.string().nullable().optional(),
  context: JsonObjectSchema.optional(),
})

export const RecoveryStrategyAttemptBody = z.object({
  classificationId: z.string().min(1),
  strategyType: RecoveryStrategyTypeSchema,
  strategyConfig: JsonObjectSchema.optional(),
  outcome: RecoveryStrategyOutcomeSchema,
  durationMs: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
})

export const OSInterferenceSignalSchema = z.enum([
  'uac_prompt',
  'firewall_prompt',
  'system_update_prompt',
  'low_battery',
  'disk_space_low',
  'save_changes_dialog',
  'app_update_dialog',
  'file_modified_dialog',
  'crash_report_dialog',
  'print_dialog',
  'native_file_picker',
  'screen_saver',
  'screen_locked',
  'display_sleep',
  'fast_user_switch',
  'rdp_disconnected',
  'rdp_reconnected',
  'none',
])

export const OSInterferenceSourceTypeSchema = z.enum([
  'system_popup',
  'application_popup',
  'screen_state',
])

export const OSInterferenceEventStatusSchema = z.enum([
  'observed',
  'handled',
  'blocked',
  'needs_user',
])

export const OSPowerStateSchema = z.enum(['ac', 'battery', 'low_battery', 'critical'])

export const OSInterferenceEvaluationBody = z.object({
  policyId: z.string().min(1).optional(),
  signal: OSInterferenceSignalSchema.optional(),
  sourceType: OSInterferenceSourceTypeSchema.optional(),
  monitors: z
    .object({
      screenSaverActive: z.boolean().optional(),
      screenLocked: z.boolean().optional(),
      uacPromptVisible: z.boolean().optional(),
      systemDialogDetected: z.boolean().optional(),
      nativeFilePickerVisible: z.boolean().optional(),
      remoteSessionActive: z.boolean().optional(),
      rdpDisconnected: z.boolean().optional(),
      powerState: OSPowerStateSchema.optional(),
      diskSpaceLow: z.boolean().optional(),
      applicationDialog: z.string().optional(),
    })
    .default({}),
})

export const FileBoundaryPlatformSchema = z.enum(['windows', 'linux', 'macos'])
export const FileBoundaryOperationSchema = z.enum(['read', 'write', 'create', 'delete', 'execute'])
export const FileBoundaryEvaluationStatusSchema = z.enum(['safe', 'warning', 'needs_user', 'blocked'])

export const FileSystemBoundaryEvaluationBody = z.object({
  policyId: z.string().min(1).optional(),
  path: z.string().optional(),
  fileName: z.string().optional(),
  extension: z.string().optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  encoding: z.string().optional(),
  hasBom: z.boolean().optional(),
  lineEnding: z.enum(['lf', 'crlf', 'mixed']).optional(),
  isBinary: z.boolean().optional(),
  operation: FileBoundaryOperationSchema,
  platform: FileBoundaryPlatformSchema.optional(),
  lockDetected: z.boolean().optional(),
})

export const BrowserAutomationTrapStatusSchema = z.enum(['safe', 'warning', 'needs_user', 'blocked'])

export const BrowserAutomationTrapEvaluationBody = z.object({
  policyId: z.string().min(1).optional(),
  extensionsDetected: z.array(z.string()).optional(),
  browserZoom: z.number().positive().optional(),
  deviceScaleFactor: z.number().positive().optional(),
  viewport: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
  colorScheme: z.enum(['light', 'dark', 'system']).optional(),
  gpuAcceleration: z.boolean().optional(),
  captchaDetected: z.union([z.enum(['cloudflare', 'recaptcha', 'hcaptcha', 'generic']), z.literal(false)]).optional(),
  botDetectionMessage: z.string().optional(),
  locatorStrategy: z.enum(['css', 'xpath', 'image', 'ocr']).optional(),
  screenshotComparison: z.enum(['pixel', 'ssim', 'ocr']).optional(),
})

export const EnterpriseProxyTypeSchema = z.enum(['http', 'https', 'socks5', 'pac', 'system'])
export const EnterpriseProxyAuthSchema = z.enum(['none', 'basic', 'ntlm', 'kerberos', 'negotiate'])
export const EnterpriseCertificateIssueSchema = z.enum([
  'self_signed',
  'corporate_ca',
  'ssl_interception',
  'missing_ca_bundle',
  'none',
])
export const EnterpriseNetworkStatusSchema = z.enum(['safe', 'warning', 'needs_user', 'blocked'])

export const EnterpriseNetworkEvaluationBody = z.object({
  policyId: z.string().min(1).optional(),
  proxyType: EnterpriseProxyTypeSchema.optional(),
  proxyUrl: z.string().optional(),
  auth: EnterpriseProxyAuthSchema.optional(),
  username: z.string().optional(),
  passwordRef: z.string().optional(),
  domain: z.string().optional(),
  pacUrl: z.string().optional(),
  noProxy: z.array(z.string()).optional(),
  needsBrowserProxy: z.boolean().optional(),
  needsNodeProxy: z.boolean().optional(),
  needsPythonRequests: z.boolean().optional(),
  certificateIssues: z.array(EnterpriseCertificateIssueSchema).optional(),
  caBundlePath: z.string().optional(),
  sslInspectionDetected: z.boolean().optional(),
  targetUrl: z.string().optional(),
})

export const OutputLanguageSchema = z.enum(['zh-CN', 'en-US', 'ja-JP', 'auto'])
export const OutputConsistencyStatusSchema = z.enum(['passed', 'warning', 'rejected'])

export const OutputConsistencyEvaluationBody = z.object({
  policyId: z.string().min(1).optional(),
  artifactType: z.enum(['code', 'document', 'report', 'json', 'spreadsheet', 'image']),
  content: z.string().optional(),
  fileName: z.string().optional(),
  expectedLanguage: OutputLanguageSchema.optional(),
  detectedLanguages: z.array(OutputLanguageSchema).optional(),
  detectedCommentLanguages: z.array(OutputLanguageSchema).optional(),
  formatterResults: z.record(z.string(), z.enum(['passed', 'failed', 'missing'])).optional(),
})

export const ResourceGovernorStatusSchema = z.enum(['safe', 'throttled', 'paused', 'needs_user'])

export const ResourceGovernorEvaluationBody = z.object({
  policyId: z.string().min(1).optional(),
  snapshot: z.object({
    totalCPUPercent: z.number().min(0).max(100).optional(),
    perAgentCPUPercent: z.record(z.string(), z.number().min(0)).optional(),
    totalMemoryMB: z.number().min(0).optional(),
    perAgentMemoryMB: z.record(z.string(), z.number().min(0)).optional(),
    totalGPUVRAMMB: z.number().min(0).optional(),
    perAgentGPUVRAMMB: z.record(z.string(), z.number().min(0)).optional(),
    totalNetworkKBps: z.number().min(0).optional(),
    diskIOKBps: z.number().min(0).optional(),
    activeAgentCount: z.number().int().min(0).optional(),
    foregroundAgentId: z.string().optional(),
    powerSource: z.enum(['ac', 'battery']).optional(),
    batteryPercent: z.number().min(0).max(100).optional(),
    cpuTempC: z.number().optional(),
    gpuTempC: z.number().optional(),
  }),
})

export const GlobalOSIntegrationStatusSchema = z.enum(['safe', 'delayed', 'needs_user', 'blocked'])

export const GlobalOSIntegrationEvaluationBody = z.object({
  policyId: z.string().min(1).optional(),
  operation: z.enum(['clipboard', 'window_focus', 'native_dialog']),
  requiresSystemClipboard: z.boolean().optional(),
  canUseVirtualClipboard: z.boolean().optional(),
  canDispatchDirectInput: z.boolean().optional(),
  foregroundRequired: z.boolean().optional(),
  headlessAvailable: z.boolean().optional(),
  backgroundAvailable: z.boolean().optional(),
  userIdleMs: z.number().int().min(0).optional(),
  nativeDialogKind: z.enum(['file_picker', 'print_dialog', 'color_picker', 'unknown']).optional(),
  canInjectFileInput: z.boolean().optional(),
  canUsePdfApi: z.boolean().optional(),
  canUseCssInjection: z.boolean().optional(),
})

export const TelemetryLevelSchema = z.enum(['minimal', 'usage', 'performance', 'full', 'off'])
export const TelemetryDecisionStatusSchema = z.enum(['allowed', 'redacted', 'blocked', 'disabled'])
export const TelemetryNeverCollectCategorySchema = z.enum([
  'api_keys',
  'user_files',
  'agent_outputs',
  'memory_content',
  'browser_screenshots',
  'clipboard_data',
  'credentials',
])

export const TelemetryPolicyBody = z.object({
  name: z.string().min(1).max(160).optional(),
  level: TelemetryLevelSchema.default('off'),
  consentGranted: z.boolean().default(false),
  status: z.enum(['active', 'disabled']).default('active'),
  minimal: z
    .object({
      appVersion: z.string().optional(),
      os: z.string().optional(),
      anonymousInstallId: z.string().optional(),
      crashReports: z.boolean().optional(),
    })
    .optional(),
  usage: z
    .object({
      agentsCreated: z.number().int().nonnegative().optional(),
      tasksRun: z.number().int().nonnegative().optional(),
      workflowsCreated: z.number().int().nonnegative().optional(),
    })
    .optional(),
  performance: z
    .object({
      avgTaskDuration: z.number().nonnegative().optional(),
      modelLatency: z.number().nonnegative().optional(),
    })
    .optional(),
  full: z
    .object({
      errorTraces: z.boolean().optional(),
    })
    .optional(),
  neverCollect: z.array(TelemetryNeverCollectCategorySchema).optional(),
  exportable: z.boolean().optional(),
})

export const TelemetryEventEvaluationBody = z.object({
  policyId: z.string().min(1).optional(),
  level: TelemetryLevelSchema,
  eventType: z.string().min(1).max(160),
  payload: JsonObjectSchema.default({}),
  contains: z.array(TelemetryNeverCollectCategorySchema).default([]),
})

export const TelemetryExportBody = z.object({
  policyId: z.string().min(1).optional(),
  status: TelemetryDecisionStatusSchema.optional(),
  eventType: z.string().min(1).max(160).optional(),
  limit: z.number().int().positive().max(200).optional(),
})

export const ModelInvocationTaskTypeSchema = z.enum([
  'code_generation',
  'creative_writing',
  'analysis',
  'planning',
  'tool_selection',
  'summarization',
  'task_planning',
  'creative_generation',
  'safety_critical',
  'other',
])
export const ModelCacheStrategySchema = z.enum(['exact', 'semantic', 'none'])
export const ModelCacheEvaluationStatusSchema = z.enum(['hit', 'miss', 'miss_stored', 'bypassed'])
export const ModelWarmupStatusSchema = z.enum(['warming', 'warmed', 'failed'])
export const ModelOptimizationEventTypeSchema = z.enum([
  'cache_hit',
  'cache_miss',
  'cache_bypass',
  'parameters_resolved',
  'warmup_started',
  'warmup_completed',
])
const ModelParameterValuesSchema = z.object({
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1),
})

export const ModelInvocationOptimizationPolicyBody = z.object({
  name: z.string().min(1).max(160).optional(),
  status: z.enum(['active', 'disabled']).default('active'),
  policy: z
    .object({
      responseCache: z
        .object({
          strategy: ModelCacheStrategySchema.optional(),
          exactTTL: z.number().int().positive().optional(),
          semanticTTL: z.number().int().positive().optional(),
          similarityThreshold: z.number().min(0).max(1).optional(),
          noCacheFor: z.array(ModelInvocationTaskTypeSchema).optional(),
          stats: z
            .object({
              hits: z.number().int().nonnegative().optional(),
              misses: z.number().int().nonnegative().optional(),
              savedCost: z.number().nonnegative().optional(),
            })
            .optional(),
        })
        .optional(),
      parameters: z
        .object({
          byTaskType: z.record(ModelInvocationTaskTypeSchema, ModelParameterValuesSchema).optional(),
          agentOverrides: z
            .record(z.string(), z.record(ModelInvocationTaskTypeSchema, ModelParameterValuesSchema))
            .optional(),
        })
        .optional(),
      warmup: z
        .object({
          autoWarmupAfterAgentCreated: z.boolean().optional(),
          warmupRequest: z.string().min(1).optional(),
          cacheConnection: z.boolean().optional(),
          displayStatus: z.string().min(1).optional(),
          connectionPool: z
            .object({
              keepHttp2Alive: z.boolean().optional(),
              avoidRepeatedTlsHandshake: z.boolean().optional(),
              maxIdleMs: z.number().int().positive().optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .default({}),
})

export const ModelResponseCacheEvaluationBody = z.object({
  policyId: z.string().min(1).optional(),
  modelProfileId: z.string().nullable().optional(),
  agentProfileId: z.string().nullable().optional(),
  taskType: ModelInvocationTaskTypeSchema,
  input: JsonObjectSchema,
  output: JsonObjectSchema.optional(),
  costCents: z.number().int().nonnegative().optional(),
  now: z.number().int().optional(),
})

export const ModelParametersResolveBody = z.object({
  policyId: z.string().min(1).optional(),
  agentProfileId: z.string().nullable().optional(),
  taskType: ModelInvocationTaskTypeSchema,
})

export const ModelWarmupStartBody = z.object({
  policyId: z.string().min(1).optional(),
  agentProfileId: z.string().nullable().optional(),
  modelProfileId: z.string().nullable().optional(),
})

export const ModelWarmupCompleteBody = z.object({
  success: z.boolean(),
  latencyMs: z.number().int().nonnegative().optional(),
  message: z.string().optional(),
})

export const RuntimeTimeoutKindSchema = z.enum(['waiting_for_approval', 'agent_idle', 'agent_stuck'])
export const RuntimeBusyActionSchema = z.enum([
  'queue_after_current',
  'safe_pause_and_preempt',
  'delegate_to_other_agent',
  'ask_user',
])
export const RuntimeMicroOperationDecisionStatusSchema = z.enum([
  'continue',
  'planned',
  'queued',
  'delegated',
  'needs_user',
  'escalated',
])
export const ScheduledActionStatusSchema = z.enum(['scheduled', 'due', 'queued', 'completed', 'canceled'])
export const AgentInboxItemTypeSchema = z.enum([
  'user_message',
  'agent_help',
  'system_notification',
  'approval_result',
  'task_assignment',
])
export const AgentInboxItemStatusSchema = z.enum(['unread', 'processing', 'done', 'dismissed'])

export const RuntimeMicroOperationPolicyBody = z.object({
  name: z.string().min(1).max(160).optional(),
  status: z.enum(['active', 'disabled']).default('active'),
  policy: z
    .object({
      idleTimeout: z
        .object({
          waitingForApproval: z
            .object({
              timeout: z.number().int().positive().optional(),
              onTimeout: z.enum(['auto_reject', 'keep_waiting', 'escalate']).optional(),
            })
            .optional(),
          agentIdle: z
            .object({
              timeout: z.number().int().positive().optional(),
              onTimeout: z.enum(['hibernate', 'do_nothing', 'suggest_tasks']).optional(),
            })
            .optional(),
          agentStuck: z
            .object({
              noProgressSteps: z.number().int().positive().optional(),
              timeout: z.number().int().positive().optional(),
              onTimeout: z.enum(['ask_user', 'replan', 'escalate']).optional(),
            })
            .optional(),
        })
        .optional(),
      busyBehavior: z
        .object({
          defaultAction: RuntimeBusyActionSchema.optional(),
          highPriorityAction: RuntimeBusyActionSchema.optional(),
          delegateWhenOtherAgentCapable: z.boolean().optional(),
          askUserBeforeInterrupting: z.boolean().optional(),
          priorityPreemptDelta: z.number().int().nonnegative().optional(),
        })
        .optional(),
      delayedActions: z
        .object({
          wakeHibernatingAgent: z.boolean().optional(),
          queueWhenBusy: z.boolean().optional(),
        })
        .optional(),
      inbox: z
        .object({
          processWhenIdle: z.boolean().optional(),
          priorityOrder: z.array(AgentInboxItemTypeSchema).optional(),
        })
        .optional(),
    })
    .default({}),
})

export const RuntimeTimeoutEvaluationBody = z.object({
  policyId: z.string().min(1).optional(),
  agentProfileId: z.string().nullable().optional(),
  kind: RuntimeTimeoutKindSchema,
  elapsedMs: z.number().int().nonnegative(),
  noProgressSteps: z.number().int().nonnegative().optional(),
})

export const RuntimeBusyEvaluationBody = z.object({
  policyId: z.string().min(1).optional(),
  agentProfileId: z.string().nullable().optional(),
  currentTaskTitle: z.string().optional(),
  newTaskTitle: z.string().min(1),
  currentPriority: z.number().int().optional(),
  newPriority: z.number().int().optional(),
  otherAgentCapable: z.boolean().optional(),
  otherAgentId: z.string().nullable().optional(),
})

export const ScheduledActionBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  instruction: z.string().min(1),
  dueAt: z.number().int().positive(),
  payload: JsonObjectSchema.default({}),
})

export const RunDueScheduledActionsBody = z.object({
  now: z.number().int().positive().optional(),
  busyAgentIds: z.array(z.string()).default([]),
  limit: z.number().int().positive().max(200).optional(),
})

export const AgentInboxItemBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  itemType: AgentInboxItemTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().default(''),
  priority: z.number().int().default(0),
  payload: JsonObjectSchema.default({}),
})

export const ProcessNextInboxItemBody = z.object({
  agentProfileId: z.string().nullable().optional(),
})

export const WorkflowPartialRerunBody = z.object({
  workflowRunId: z.string().min(1),
  fromNodeId: z.string().min(1),
  inputPatch: JsonObjectSchema.default({}),
})

export const TaskMergeSuggestionBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  taskType: z.string().min(1).optional(),
  tasks: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        taskType: z.string().min(1).optional(),
        agentProfileId: z.string().nullable().optional(),
        payload: JsonObjectSchema.default({}),
      }),
    )
    .min(2),
})

export const TaskMergeDecisionBody = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().default(''),
})

export const WorkflowTemplateParameterTypeSchema = z.enum([
  'string',
  'number',
  'file',
  'url',
  'select',
  'boolean',
])

export const WorkflowTemplateParameterDefinitionSchema = z.object({
  type: WorkflowTemplateParameterTypeSchema,
  label: z.string().min(1),
  description: z.string().default(''),
  default: z.unknown().optional(),
  required: z.boolean().default(false),
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.unknown(),
      }),
    )
    .optional(),
})

export const WorkflowTemplateInstantiationBody = z.object({
  sourceWorkflowId: z.string().min(1),
  name: z.string().min(1).optional(),
  parameters: JsonObjectSchema.default({}),
  parameterSchema: z.record(z.string(), WorkflowTemplateParameterDefinitionSchema).default({}),
})

export const DataMaintenanceArchiveStrategySchema = z.enum(['compress', 'delete', 'summarize'])
export const DataMaintenancePolicyStatusSchema = z.enum(['active', 'disabled'])
export const DataMaintenanceRunStatusSchema = z.enum(['completed', 'warning', 'failed'])

export const DataMaintenancePolicyBody = z.object({
  name: z.string().min(1).max(160).optional(),
  status: DataMaintenancePolicyStatusSchema.default('active'),
  policy: z
    .object({
      logRotation: z
        .object({
          maxEventsPerRun: z.number().int().positive().optional(),
          olderThanDays: z.number().int().positive().optional(),
          archiveStrategy: DataMaintenanceArchiveStrategySchema.optional(),
        })
        .optional(),
      sqliteMaintenance: z
        .object({
          schedule: z.string().min(1).optional(),
          operations: z
            .array(z.enum(['backup', 'integrity_check', 'ANALYZE', 'VACUUM', 'REINDEX']))
            .optional(),
        })
        .optional(),
      workspaceGc: z
        .object({
          trashRetentionDays: z.number().int().positive().optional(),
          cleanRunTempForStatuses: z
            .array(z.enum(['queued', 'running', 'complete', 'failed', 'aborted', 'paused']))
            .optional(),
          removeEmptyDirs: z.boolean().optional(),
          cleanBrowserSessionResidue: z.boolean().optional(),
          preserve: z.array(z.string()).optional(),
        })
        .optional(),
      browserProfiles: z
        .object({
          clearCacheOnTaskEnd: z.boolean().optional(),
          keepCookies: z.boolean().optional(),
          warnSizeBytes: z.number().int().positive().optional(),
          archiveInactiveDays: z.number().int().positive().optional(),
        })
        .optional(),
    })
    .default({}),
})

export const DataMaintenanceRunBody = z.object({
  policyId: z.string().min(1).optional(),
  now: z.number().int().positive().optional(),
  observedBrowserProfiles: z
    .array(
      z.object({
        profilePath: z.string().min(1),
        sizeBytes: z.number().int().nonnegative(),
        lastUsedAt: z.number().int().positive().optional(),
        agentProfileId: z.string().nullable().optional(),
      }),
    )
    .default([]),
})

export const AgentProbationStatusSchema = z.enum([
  'probation',
  'eligible_for_promotion',
  'graduated',
  'blocked',
])
export const AgentDeploymentEnvironmentSchema = z.enum(['staging', 'production'])
export const AgentEnvironmentPromotionStatusSchema = z.enum([
  'requested',
  'approved',
  'rejected',
  'promoted',
])

export const AgentProbationEvaluateBody = z.object({
  agentProfileId: z.string().min(1),
  autoGraduate: z.boolean().default(false),
})

export const AgentPromotionRequestBody = z.object({
  agentProfileId: z.string().min(1),
  productionAgentProfileId: z.string().min(1).optional(),
  abComparison: JsonObjectSchema.optional(),
  note: z.string().default(''),
})

export const AgentPromotionDecisionBody = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().default(''),
})

export const MemoryIntegrityPolicyStatusSchema = z.enum(['active', 'disabled'])
export const MemoryIntegritySourceTypeSchema = z.enum([
  'agent_direct_observation',
  'user_explicit_instruction',
  'external_web_content',
  'inferred_from_task',
  'other_agent_shared',
  'external_file',
])
export const MemoryIntegrityDangerousActionSchema = z.enum([
  'block_and_alert',
  'flag_for_review',
  'allow_with_warning',
])
export const MemoryIntegrityDecisionSchema = z.enum(['allowed', 'warning', 'blocked', 'flagged'])

export const MemoryIntegrityPolicyBody = z.object({
  name: z.string().min(1).max(160).optional(),
  status: MemoryIntegrityPolicyStatusSchema.default('active'),
  policy: z
    .object({
      beforeWrite: z
        .object({
          sourceConfidenceMap: z
            .record(MemoryIntegritySourceTypeSchema, z.number().min(0).max(1))
            .optional(),
          dangerousPatterns: z.array(z.string().min(1)).optional(),
          onDangerousPattern: MemoryIntegrityDangerousActionSchema.optional(),
          minimumAllowedConfidence: z.number().min(0).max(1).optional(),
        })
        .optional(),
      periodicScan: z
        .object({
          intervalDays: z.number().int().positive().optional(),
          lowConfidenceThreshold: z.number().min(0).max(1).optional(),
          contradictionScan: z.boolean().optional(),
        })
        .optional(),
    })
    .default({}),
})

export const MemoryBeforeWriteEvaluationBody = z.object({
  policyId: z.string().min(1).optional(),
  agentProfileId: z.string().nullable().optional(),
  memoryItemId: z.string().nullable().optional(),
  sourceType: MemoryIntegritySourceTypeSchema,
  title: z.string().min(1),
  content: z.string().min(1),
  requestedConfidence: z.number().min(0).max(1).optional(),
})

export const MemoryIntegrityScanBody = z.object({
  policyId: z.string().min(1).optional(),
  agentProfileId: z.string().min(1).optional(),
  limit: z.number().int().positive().max(200).optional(),
})

export const NfrCategorySchema = z.enum([
  'reliability',
  'usability',
  'compatibility',
  'security',
  'maintainability',
])
export const NfrRequirementStatusSchema = z.enum(['active', 'archived'])
export const NfrEvaluationStatusSchema = z.enum(['passed', 'warning', 'failed', 'unknown'])

export const NfrEvaluationBody = z.object({
  observed: JsonObjectSchema.default({}),
})

export const KnownLimitationCategorySchema = z.enum([
  'desktop_automation',
  'parallel_agents',
  'mobile_operation',
  'native_dialogs',
  'browser_automation',
  'enterprise_network',
  'local_model',
  'long_running_task',
  'cluster',
  'voice',
])
export const KnownLimitationSeveritySchema = z.enum(['info', 'warning', 'blocking'])
export const KnownLimitationStatusSchema = z.enum(['active', 'resolved', 'archived'])
export const LimitationDisclosureSurfaceSchema = z.enum([
  'documentation',
  'onboarding',
  'agent_factory',
  'run_preflight',
  'approval',
  'settings',
])

export const KnownLimitationEvaluationBody = z.object({
  requestedCapabilities: z.array(z.string().min(1)).default([]),
  surface: LimitationDisclosureSurfaceSchema.optional(),
})

export const LimitationAcknowledgementBody = z.object({
  acknowledgedBy: z.string().min(1).max(160).optional(),
  surface: LimitationDisclosureSurfaceSchema.default('documentation'),
  note: z.string().max(1000).default(''),
})

export const NetworkProfileBody = z.object({
  name: z.string().min(1).max(120),
  mode: z.enum(['direct', 'http_proxy', 'socks5_proxy', 'custom_gateway']).default('direct'),
  proxyUrl: z.string().nullable().optional(),
  bindInterface: z.string().nullable().optional(),
  regionLabel: z.string().nullable().optional(),
  appliesTo: z
    .enum(['model_only', 'browser_only', 'cli_only', 'all_agent_traffic'])
    .default('model_only'),
})

export const ModelProfileBody = z.object({
  name: z.string().min(1).max(120),
  provider: z.enum([
    'openai',
    'anthropic',
    'deepseek',
    'google',
    'openrouter',
    'ollama',
    'custom',
    'volcano-ark',
    'openai-compatible',
  ]),
  baseUrl: z.string().min(1),
  apiKeyRef: z.string().min(1),
  model: z.string().min(1),
  contextWindow: z.number().int().positive().nullable().optional(),
  supportsVision: z.boolean().optional(),
  supportsToolCalling: z.boolean().optional(),
  supportsJsonMode: z.boolean().optional(),
  networkProfileId: z.string().nullable().optional(),
})

export const ModelConnectionTestBody = z.object({
  live: z.boolean().default(false),
  confirmExternalCall: z.boolean().default(false),
})

export const ModelCapabilityProbeBody = z.object({
  kind: z.enum(['text', 'json', 'tool_calling', 'vision']).default('json'),
  live: z.boolean().default(false),
  confirmExternalCall: z.boolean().default(false),
  stream: z.boolean().default(false),
  prompt: z.string().max(2000).optional(),
  visionImageDataUrl: z.string().nullable().optional(),
})

export const ModelRoutePreviewBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  requestedCapabilities: JsonObjectSchema.default({}),
  estimatedInputTokens: z.number().int().nonnegative().optional(),
  estimatedOutputTokens: z.number().int().nonnegative().optional(),
})

export const CliProfileBody = z.object({
  name: z.string().min(1).max(120),
  command: z.string().min(1),
  argsTemplate: z.string().optional(),
  cwdPolicy: z.enum(['workspace', 'agent_workspace', 'custom']).default('workspace'),
  customCwd: z.string().nullable().optional(),
  env: z.record(z.string(), z.string()).default({}),
  timeoutMs: z.number().int().positive().optional(),
  inputMode: z.enum(['stdin', 'args', 'file']).default('args'),
  outputMode: z.enum(['stdout', 'file', 'json']).default('stdout'),
  allowedAgentIds: z.array(z.string()).default([]),
  requiresApproval: z.boolean().optional(),
})

export const CliRunBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  employeeRunId: z.string().nullable().optional(),
  variables: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .default({}),
  stdin: z.string().nullable().optional(),
  mode: z.enum(['dry_run', 'execute']).default('dry_run'),
})

export const ToolConnectionBody = z.object({
  displayName: z.string().min(1).max(120),
  type: z.enum(['mcp', 'cli', 'software', 'api']),
  config: JsonObjectSchema.default({}),
  enabled: z.boolean().optional(),
})

export const McpServerBody = z.object({
  displayName: z.string().min(1).max(120),
  transport: z.enum(['stdio', 'sse', 'http']).default('stdio'),
  command: z.string().nullable().optional(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  endpoint: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
})

export const McpServerRuntimeBody = z.object({
  action: z.enum(['plan', 'start', 'stop', 'status']).default('status'),
  live: z.boolean().optional(),
  confirmRisk: z.boolean().optional(),
})

export const McpToolRunBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  employeeRunId: z.string().nullable().optional(),
  workflowRunId: z.string().nullable().optional(),
  workflowNodeRunId: z.string().nullable().optional(),
  input: JsonObjectSchema.default({}),
  mode: z.enum(['dry_run', 'execute']).default('dry_run'),
  computerSessionId: z.string().nullable().optional(),
  live: z.boolean().optional(),
  confirmRisk: z.boolean().optional(),
  approvalRequestId: z.string().nullable().optional(),
})

export const PromptTemplateVariableBindingSchema = z.object({
  source: z.enum(['agent_profile', 'task_input', 'memory', 'runtime_state', 'env', 'static']),
  path: z.string().default(''),
  default: z.string().optional(),
})

export const PromptTemplateConditionalBlockSchema = z.object({
  condition: z.string().min(1).max(500),
  block: z.string().min(1).max(20000),
})

export const PromptVersionAbTestSchema = z.object({
  experimentId: z.string().min(1).max(120),
  variant: z.enum(['A', 'B']),
  trafficPercent: z.number().min(0).max(100),
  metrics: z
    .array(z.enum(['success_rate', 'step_efficiency', 'user_satisfaction']))
    .min(1)
    .default(['success_rate']),
})

export const PromptTemplateBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  scope: z.enum(['agent', 'workspace', 'global']).default('workspace'),
  agentProfileId: z.string().nullable().optional(),
  engine: z.enum(['handlebars', 'jinja2', 'custom']).default('handlebars'),
  template: z.string().max(100000).optional(),
  variables: z.record(z.string(), PromptTemplateVariableBindingSchema).default({}),
  conditionalBlocks: z.array(PromptTemplateConditionalBlockSchema).default([]),
  status: z.enum(['draft', 'active', 'archived']).default('active'),
  systemPrompt: z.string().optional(),
  content: z.string().max(100000).optional(),
  contextRules: z.array(z.string()).default([]),
  inputSchema: JsonObjectSchema.default({}),
  outputSchema: JsonObjectSchema.default({}),
  modelHints: JsonObjectSchema.default({}),
  abTest: PromptVersionAbTestSchema.nullable().optional(),
  deployedAt: z.number().int().positive().nullable().optional(),
  retiredAt: z.number().int().positive().nullable().optional(),
})

export const PromptTemplateRenderBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  taskInput: JsonObjectSchema.default({}),
  runtimeState: JsonObjectSchema.default({}),
  memory: JsonObjectSchema.default({}),
  env: JsonObjectSchema.default({}),
})

export const PromptDriftScheduleSchema = z.enum(['7d', '30d', 'on_model_update_notice'])
export const PromptDriftActionSchema = z.enum(['notify_user', 'auto_rollback_model', 'create_incident'])
export const PromptDriftMonitorStatusSchema = z.enum(['active', 'disabled'])
export const PromptDriftRunStatusSchema = z.enum(['stable', 'warning', 'drift_detected'])

export const PromptDriftChecksSchema = z.object({
  outputFormatStability: z.boolean().optional(),
  refusalRateChange: z.boolean().optional(),
  verbosityChange: z.boolean().optional(),
  toolCallingAccuracy: z.boolean().optional(),
  reasoningQuality: z.boolean().optional(),
  latencyChange: z.boolean().optional(),
  costChange: z.boolean().optional(),
})

export const PromptDriftMonitorBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  modelProfileId: z.string().nullable().optional(),
  name: z.string().min(1).max(160),
  schedule: PromptDriftScheduleSchema.default('30d'),
  checks: PromptDriftChecksSchema.default({}),
  onDriftDetected: PromptDriftActionSchema.default('notify_user'),
  thresholds: JsonObjectSchema.default({}),
  status: PromptDriftMonitorStatusSchema.default('active'),
})

export const ModelBehaviorSnapshotBody = z.object({
  monitorId: z.string().nullable().optional(),
  agentProfileId: z.string().nullable().optional(),
  modelProfileId: z.string().nullable().optional(),
  modelName: z.string().min(1).max(160),
  modelDate: z.string().min(1).max(80),
  providerVersion: z.string().nullable().optional(),
  benchmarkResults: JsonObjectSchema.default({}),
  pinned: z.boolean().default(false),
  notes: z.string().default(''),
})

export const PromptDriftCheckBody = z.object({
  monitorId: z.string().min(1),
  baselineSnapshotId: z.string().min(1).optional(),
  candidateSnapshotId: z.string().min(1).optional(),
  baselineResults: JsonObjectSchema.optional(),
  candidateResults: JsonObjectSchema.optional(),
})

export const ConsensusCriticalTaskSchema = z.enum([
  'security_analysis',
  'code_review',
  'data_analysis_conclusion',
  'financial_calculation',
  'legal_document_generation',
])
export const SecondaryModelStrategySchema = z.enum([
  'cheap_fast_model',
  'same_model',
  'different_provider',
])
export const ConsensusRecommendedActionSchema = z.enum([
  'use_primary',
  'use_secondary',
  'merge',
  'ask_user',
])
export const AgentVotingTieBreakerSchema = z.enum([
  'user_decides',
  'lead_agent_decides',
  'conservative_option',
])
export const AgentVotingDecisionSchema = z.enum(['accepted', 'rejected', 'tie', 'no_quorum'])
export const AdversarialReviewStatusSchema = z.enum(['passed', 'issues_found', 'needs_revision'])

export const DualModelVerificationBody = z.object({
  appliesTo: ConsensusCriticalTaskSchema,
  primaryModelProfileId: z.string().nullable().optional(),
  secondaryModelProfileId: z.string().nullable().optional(),
  secondaryModel: SecondaryModelStrategySchema.default('cheap_fast_model'),
  primaryResult: JsonObjectSchema.default({}),
  secondaryResult: JsonObjectSchema.default({}),
})

export const AgentConsensusVoteBody = z.object({
  question: z.string().min(1).max(500),
  voters: z
    .array(
      z.object({
        agentId: z.string().min(1),
        vote: z.string().min(1).max(120),
        reasoning: z.string().default(''),
        confidence: z.number().min(0).max(1).default(0.5),
      }),
    )
    .default([]),
  quorum: z.number().int().positive(),
  requiredMajority: z.number().positive().max(1),
  tieBreaker: AgentVotingTieBreakerSchema.default('user_decides'),
})

export const AdversarialReviewBody = z.object({
  subjectAgentId: z.string().nullable().optional(),
  reviewerAgentId: z.string().nullable().optional(),
  targetTitle: z.string().min(1).max(240),
  targetContent: JsonObjectSchema.default({}),
  skepticism: z.number().min(0).max(1).default(0.8),
  assumptions: z.array(z.string()).default([]),
  missedCases: z.array(z.string()).default([]),
  attackerExploitation: z.array(z.string()).default([]),
  worstCases: z.array(z.string()).default([]),
})

export const ContentSafetyCategorySchema = z.enum([
  'safe',
  'hate',
  'adult',
  'violence',
  'spam',
  'self_harm',
  'pii',
  'blocked_pattern',
  'cloud_review',
])
export const ContentSafetyCloudProviderSchema = z.enum([
  'openai_moderation',
  'azure_content_safety',
  'custom',
])
export const ContentSafetyActionSchema = z.enum([
  'block',
  'warn',
  'redact',
  'quarantine',
  'ask_user',
])
export const ContentSafetyPolicyStatusSchema = z.enum(['active', 'disabled'])
export const ContentSafetyScanStatusSchema = z.enum([
  'passed',
  'flagged',
  'blocked',
  'quarantined',
  'needs_user',
])
export const SafetyReviewedContentTypeSchema = z.enum([
  'text',
  'code',
  'document',
  'image',
  'json',
  'file_bundle',
])
export const CopyrightOnMatchSchema = z.enum([
  'warn_with_attribution',
  'block',
  'ask_user',
])
export const CopyrightCheckStatusSchema = z.enum([
  'clear',
  'needs_attribution',
  'blocked',
  'needs_user',
])

export const ContentSafetyLayersSchema = z.object({
  keywordFilter: z
    .object({
      blockedPatterns: z.array(z.string().min(1)).optional(),
      piiPatterns: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  localClassifier: z
    .object({
      categories: z.array(ContentSafetyCategorySchema).optional(),
      threshold: z.number().min(0).max(1).optional(),
    })
    .optional(),
  cloudSafetyAPI: z
    .object({
      provider: ContentSafetyCloudProviderSchema,
      requiresUserConsent: z.literal(true).default(true),
    })
    .optional(),
})

export const ContentSafetyPolicyBody = z.object({
  name: z.string().min(1).max(160).optional(),
  layers: ContentSafetyLayersSchema.optional(),
  onFlag: ContentSafetyActionSchema.default('warn'),
  status: ContentSafetyPolicyStatusSchema.default('active'),
})

export const ContentSafetyScanBody = z.object({
  policyId: z.string().nullable().optional(),
  agentProfileId: z.string().nullable().optional(),
  employeeRunId: z.string().nullable().optional(),
  artifactId: z.string().nullable().optional(),
  contentType: SafetyReviewedContentTypeSchema.default('text'),
  content: z.string(),
  userConsentedToCloudSafety: z.boolean().default(false),
})

export const CopyrightCheckBody = z.object({
  scanId: z.string().nullable().optional(),
  agentProfileId: z.string().nullable().optional(),
  artifactId: z.string().nullable().optional(),
  contentType: SafetyReviewedContentTypeSchema.default('code'),
  config: z
    .object({
      codePlagiarism: z
        .object({
          similarityThreshold: z.number().min(0).max(1).optional(),
          minMatchLength: z.number().int().positive().optional(),
          onMatch: CopyrightOnMatchSchema.optional(),
        })
        .optional(),
      imageCopyright: z
        .object({
          checkMetadata: z.boolean().optional(),
          reverseImageSearch: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  content: z.string().optional(),
  knownSources: z
    .array(
      z.object({
        sourceRef: z.string().min(1),
        content: z.string(),
        license: z.string().nullable().optional(),
        attribution: z.string().nullable().optional(),
      }),
    )
    .default([]),
  imageMetadata: JsonObjectSchema.optional(),
})

export const TrustCalibrationPolicyStatusSchema = z.enum(['active', 'disabled'])
export const TrustCalibrationRecommendationSchema = z.enum([
  'increase_autonomy',
  'decrease_autonomy',
  'keep_current',
  'require_manual_review',
])
export const TrustLevelSchema = z.enum(['day_1_untrusted', 'low', 'medium', 'high'])
export const TrustCalibrationConfigSchema = z.object({
  highConfidenceIndicators: z
    .object({
      showConfidenceBadge: z.boolean().optional(),
      showEvidence: z.boolean().optional(),
      showVerifiedCheck: z.boolean().optional(),
    })
    .optional(),
  lowConfidenceIndicators: z
    .object({
      showWarningBadge: z.boolean().optional(),
      showUncertaintyReason: z.boolean().optional(),
      suggestHumanReview: z.boolean().optional(),
    })
    .optional(),
  antiOverTrust: z
    .object({
      streakWarning: z.number().int().positive().optional(),
      periodicRealityCheck: z.boolean().optional(),
    })
    .optional(),
})

export const TrustCalibrationPolicyBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  name: z.string().min(1).max(160).optional(),
  config: TrustCalibrationConfigSchema.optional(),
  status: TrustCalibrationPolicyStatusSchema.default('active'),
})

export const TrustCalibrationMetricsBody = z.object({
  daysActive: z.number().int().positive().optional(),
  runCount: z.number().int().nonnegative().optional(),
  successRate: z.number().min(0).max(1).optional(),
  approvalsApproved: z.number().int().nonnegative().optional(),
  approvalsRejected: z.number().int().nonnegative().optional(),
  takeoverCount: z.number().int().nonnegative().optional(),
  modificationRate: z.number().min(0).max(1).optional(),
  similarTaskCount: z.number().int().nonnegative().optional(),
  verifiedArtifactCount: z.number().int().nonnegative().optional(),
  highConfidenceSuccessStreak: z.number().int().nonnegative().optional(),
})

export const AutonomyLevelSchema = z.enum([
  'observe_only',
  'propose_only',
  'execute_with_approval',
  'execute_low_risk',
  'fully_autonomous',
])

export const TrustCalibrationEvaluationBody = z.object({
  policyId: z.string().nullable().optional(),
  agentProfileId: z.string().nullable().optional(),
  currentAutonomyLevel: AutonomyLevelSchema.default('execute_with_approval'),
  metrics: TrustCalibrationMetricsBody.optional(),
})

export const BudgetScopeSchema = z.enum([
  'per_task',
  'per_agent_per_day',
  'per_project_per_month',
  'global_per_month',
])
export const BudgetLimitTypeSchema = z.enum(['token_count', 'usd_amount'])
export const BudgetPolicyStatusSchema = z.enum(['active', 'disabled'])
export const BudgetEvaluationStatusSchema = z.enum(['ok', 'notify', 'blocked'])
export const BudgetControlActionSchema = z.enum(['allow', 'notify_user', 'stop_task'])
export const BudgetUsageGroupBySchema = z.enum(['agent', 'project', 'day', 'week', 'month'])
export const BudgetRoutingConditionSchema = z.enum([
  'task_type',
  'estimated_steps',
  'context_length',
  'needs_vision',
  'time_of_day',
])
export const BudgetRoutingOperatorSchema = z.enum(['equals', 'lt', 'gt'])
export const BudgetModelRoutingRuleSchema = z.object({
  condition: BudgetRoutingConditionSchema,
  operator: BudgetRoutingOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean()]),
  routeTo: z.string().min(1),
  reason: z.string().optional(),
})
export const BudgetPolicyConfigSchema = z.object({
  routingRules: z.array(BudgetModelRoutingRuleSchema).optional(),
  estimateFactors: z
    .object({
      modelUnitPriceUsd: z.number().nonnegative().optional(),
      averageStepTokens: z.number().int().positive().optional(),
      visionMultiplier: z.number().positive().optional(),
      largeContextMultiplier: z.number().positive().optional(),
      historicalTaskWeight: z.number().min(0).max(1).optional(),
    })
    .optional(),
  reportTags: z.array(z.string().min(1)).optional(),
})

export const BudgetPolicyBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  name: z.string().min(1).max(160).optional(),
  scope: BudgetScopeSchema.default('per_task'),
  limitType: BudgetLimitTypeSchema.default('usd_amount'),
  limit: z.number().positive(),
  hardCap: z.boolean().default(true),
  notifyAtPercent: z.number().positive().max(100).default(80),
  config: BudgetPolicyConfigSchema.optional(),
  status: BudgetPolicyStatusSchema.default('active'),
})

export const BudgetCostBreakdownBody = z
  .object({
    modelCalls: z.array(JsonObjectSchema).optional(),
    toolExecutions: z.array(JsonObjectSchema).optional(),
    cliExecutions: z.array(JsonObjectSchema).optional(),
  })
  .optional()

export const BudgetEvaluationBody = z.object({
  policyId: z.string().nullable().optional(),
  scope: BudgetScopeSchema.optional(),
  agentProfileId: z.string().nullable().optional(),
  employeeRunId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  observedTokens: z.number().int().nonnegative().default(0),
  estimatedAdditionalTokens: z.number().int().nonnegative().default(0),
  observedUsd: z.number().nonnegative().default(0),
  estimatedAdditionalUsd: z.number().nonnegative().default(0),
  selectedModelProfileId: z.string().nullable().optional(),
  task: JsonObjectSchema.optional(),
  costBreakdown: BudgetCostBreakdownBody,
})

export const SecretBody = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(['env_ref', 'encrypted_value']).optional(),
  valueRef: z.string().optional(),
  encryptedValue: z.string().optional(),
})

export const CredentialScopeBody = z.object({
  secretId: z.string().min(1),
  resourceType: z.enum([
    'global',
    'model_profile',
    'agent_profile',
    'cli_profile',
    'mcp_server',
    'tool_connection',
    'software_profile',
  ]),
  resourceId: z.string().min(1),
  capability: z.string().optional(),
})

export const SandboxPolicyBody = z.object({
  name: z.string().min(1).max(120),
  level: z.enum(['strict', 'workspace', 'trusted']).default('strict'),
  allowedPaths: z.array(z.string()).default([]),
  deniedPaths: z.array(z.string()).default([]),
  allowedCommands: z.array(z.string()).default([]),
  networkMode: z.enum(['none', 'model_only', 'approved_hosts', 'unrestricted']).default('model_only'),
  requiresApprovalForWrites: z.boolean().optional(),
})

export const SandboxAccessBody = z.object({
  action: z.enum(['read_file', 'write_file', 'run_command', 'network']),
  targetPath: z.string().nullable().optional(),
  command: z.string().nullable().optional(),
})

export const SecurityFindingBody = z.object({
  sourceType: z.string().min(1),
  sourceId: z.string().nullable().optional(),
  category: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  action: z.enum(['block', 'warn', 'redact', 'require_approval', 'log']).default('log'),
  message: z.string().min(1),
  evidence: z.string().optional(),
})

export const PromptInjectionScanBody = z.object({
  text: z.string(),
  sourceType: z.string().min(1),
  sourceId: z.string().nullable().optional(),
})

export const RetentionPolicyBody = z.object({
  entity: z.enum(['run_log', 'run_event', 'artifact', 'memory', 'screenshot', 'audit_log']),
  retentionPeriod: z.string().min(1),
  onExpiry: z.enum(['delete', 'archive', 'anonymize', 'ask_user']).default('ask_user'),
  maxStorageBytes: z.number().int().positive().nullable().optional(),
  enabled: z.boolean().optional(),
})

export const StorageQuotaBody = z.object({
  scope: z.enum(['agent', 'project', 'workspace']).default('workspace'),
  scopeId: z.string().nullable().optional(),
  maxTotalBytes: z.number().int().positive().optional(),
  warnAtPercent: z.number().positive().max(100).optional(),
  blockAtPercent: z.number().positive().max(100).optional(),
})

export const PiiScanBody = z.object({
  memoryItemId: z.string().nullable().optional(),
  limit: z.number().int().positive().max(500).optional(),
})

export const PiiMarkerStatusBody = z.object({
  status: z.enum(['flagged', 'reviewed', 'redacted', 'cleared']),
})

export const DataExportManifestBody = z.object({
  scope: z.enum(['agent', 'project', 'workspace']).default('workspace'),
  scopeId: z.string().nullable().optional(),
  format: z.enum(['json', 'yaml', 'zip_manifest']).default('zip_manifest'),
  includeSecrets: z.boolean().default(false),
})

export const FeatureFlagBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  status: z.enum(['development', 'beta', 'released', 'deprecated']).default('development'),
  rolloutPercent: z.number().min(0).max(100).default(0),
  targetUsers: z.enum(['all', 'beta_testers', 'internal', 'by_user_id']).default('internal'),
  targetUserIds: z.array(z.string()).default([]),
  requiresFlags: z.array(z.string()).default([]),
  conflictsWith: z.array(z.string()).default([]),
  remoteOverride: z.boolean().default(true),
  remoteDisabled: z.boolean().default(false),
})

export const FeatureFlagEvaluationBody = z.object({
  userId: z.string().nullable().optional(),
  groups: z.array(z.string()).default([]),
})

export const DegradationPolicyBody = z.object({
  name: z.string().min(1).max(120),
  resourceType: z.enum([
    'model_profile',
    'mcp_server',
    'network_profile',
    'tool_connection',
    'browser_session',
    'external_api',
    'task_queue',
  ]),
  resourceId: z.string().nullable().optional(),
  trigger: z.enum(['offline', 'health_failed', 'timeout', 'rate_limited', 'manual']).default('offline'),
  action: z.enum([
    'use_fallback_model',
    'use_fallback_server',
    'use_direct_network',
    'mark_pending_retry',
    'pause_until_online',
    'keep_queue_state',
    'mark_unavailable',
  ]),
  fallbackResourceIds: z.array(z.string()).default([]),
  enabled: z.boolean().optional(),
})

export const DegradationEvaluationBody = z.object({
  resourceType: DegradationPolicyBody.shape.resourceType,
  resourceId: z.string().nullable().optional(),
  trigger: DegradationPolicyBody.shape.trigger,
  fallbackCandidates: z.array(z.string()).default([]),
  metadata: JsonObjectSchema.default({}),
})

export const SkillInstallBody = z.object({
  source: z.enum(['skillsmp', 'github', 'local']).default('skillsmp'),
  url: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
  manifest: JsonObjectSchema.default({}),
})

export const SkillEnableBody = z.object({
  enabled: z.boolean().default(true),
})

export const SkillSdkDependenciesBody = z
  .object({
    python_packages: z.array(z.string()).default([]),
    node_packages: z.array(z.string()).default([]),
    system_tools: z.array(z.string()).default([]),
  })
  .default({
    python_packages: [],
    node_packages: [],
    system_tools: [],
  })

export const SkillSdkManifestBody = z.object({
  skillId: z.string().nullable().optional(),
  manifest: JsonObjectSchema,
  files: z.array(z.string()).default([]),
})

export const SkillSdkScaffoldBody = z.object({
  name: z.string().min(1).max(120),
  version: z.string().min(1).default('0.1.0'),
  capabilities: z.array(z.string()).min(1),
  dependencies: SkillSdkDependenciesBody,
  permissions: z.array(z.string()).default([]),
})

export const SkillMarketplacePublishBody = z.object({
  marketplaceUrl: z.string().min(1).optional(),
})

export const PluginExtensionPointSchema = z.enum([
  'tool_provider',
  'model_provider',
  'memory_backend',
  'workstation_type',
  'verification_strategy',
  'output_adapter',
  'notification_channel',
  'trigger_type',
  'ui_panel',
  'artifact_renderer',
])

export const PluginCapabilityDefinitionBody = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  type: PluginExtensionPointSchema,
  description: z.string().default(''),
  inputSchema: JsonObjectSchema.optional(),
  outputSchema: JsonObjectSchema.optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).default('low'),
})

export const PluginMarketplaceMetadataBody = z.object({
  source: z.enum(['local', 'marketplace', 'github', 'file']).default('local'),
  marketplaceUrl: z.string().nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  downloads: z.number().int().nonnegative().nullable().optional(),
  reviews: z.number().int().nonnegative().nullable().optional(),
  updateAvailable: z.boolean().optional(),
  latestVersion: z.string().nullable().optional(),
})

export const PluginInstallBody = z.object({
  name: z.string().min(1).max(160),
  version: z.string().min(1).max(80),
  description: z.string().default(''),
  author: z.string().default(''),
  extensionPoints: z.array(PluginExtensionPointSchema).min(1),
  capabilities: z.array(PluginCapabilityDefinitionBody).default([]),
  config: JsonObjectSchema.default({}),
  marketplaceMetadata: PluginMarketplaceMetadataBody.optional(),
  requiredCoreVersion: z.string().nullable().optional(),
})

export const PluginUpgradeBody = z.object({
  version: z.string().min(1).max(80),
  extensionPoints: z.array(PluginExtensionPointSchema).optional(),
  capabilities: z.array(PluginCapabilityDefinitionBody).optional(),
  config: JsonObjectSchema.optional(),
  marketplaceMetadata: PluginMarketplaceMetadataBody.optional(),
  requiredCoreVersion: z.string().nullable().optional(),
})

export const TeamUserRoleSystemSchema = z.enum(['admin', 'operator', 'viewer', 'custom'])
export const TeamPermissionsBody = z.record(z.string(), z.boolean()).default({})

export const TeamUserBody = z.object({
  displayName: z.string().min(1).max(160),
  email: z.string().email(),
  roleSystem: TeamUserRoleSystemSchema.default('viewer'),
  permissions: TeamPermissionsBody,
  scope: z.string().min(1).default('global'),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const TeamBody = z.object({
  name: z.string().min(1).max(160),
  description: z.string().default(''),
  status: z.enum(['active', 'archived']).default('active'),
})

export const TeamMembershipBody = z.object({
  userId: z.string().min(1),
  roleSystem: TeamUserRoleSystemSchema.default('viewer'),
  permissions: TeamPermissionsBody,
  scope: z.string().min(1).default('global'),
  status: z.enum(['active', 'removed']).default('active'),
})

export const TeamResourceShareBody = z.object({
  teamId: z.string().min(1),
  resourceType: z.enum(['agent_template', 'workflow', 'skill', 'model_profile', 'memory']),
  resourceId: z.string().min(1),
  sharingPolicy: z.enum(['team_shared', 'project_shared', 'private']).default('team_shared'),
  secretHandling: z.enum(['user_isolated', 'shared_reference', 'not_applicable']).optional(),
  createdByUserId: z.string().nullable().optional(),
  metadata: JsonObjectSchema.default({}),
})

export const TeamApprovalPolicyBody = z.object({
  teamId: z.string().min(1),
  name: z.string().min(1).max(160),
  approvalMode: z.enum(['specific_user', 'any_approver', 'all_must_approve', 'one_of_many']),
  approverUserIds: z.array(z.string().min(1)).default([]),
  requiredPermission: z.string().min(1).default('approval:decide'),
  riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const TeamApprovalDecisionBody = z.object({
  approvalRequestId: z.string().nullable().optional(),
  userId: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().default(''),
})

export const TeamPermissionEvaluationBody = z.object({
  userId: z.string().min(1),
  teamId: z.string().nullable().optional(),
  permission: z.string().min(1),
  scope: z.string().nullable().optional(),
})

export const AgentTemplatePackageTypeSchema = z.enum([
  'agent_profile',
  'workflow',
  'skill_package',
  'software_command',
  'macro_package',
])

export const AgentTemplateCategorySchema = z.enum([
  'development',
  'design',
  'operations',
  'office',
  'project',
  'custom',
])

export const AgentTemplatePackageBody = z.object({
  templateKey: z.string().min(1).max(160).optional(),
  templateType: AgentTemplatePackageTypeSchema,
  category: AgentTemplateCategorySchema.default('custom'),
  name: z.string().min(1).max(160),
  description: z.string().default(''),
  role: z.string().default(''),
  payload: JsonObjectSchema.default({}),
  requiredSkillIds: z.array(z.string().min(1)).default([]),
  recommendedToolIds: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  author: z.string().default('User'),
  source: z.enum(['system', 'user', 'marketplace']).default('user'),
  visibility: z.enum(['private', 'team', 'public']).default('private'),
  marketplaceUrl: z.string().nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  rating: z.number().min(0).max(5).nullable().optional(),
  createdByUserId: z.string().nullable().optional(),
})

export const AgentTemplateInstallBody = z.object({
  installedByUserId: z.string().nullable().optional(),
  targetName: z.string().nullable().optional(),
  variables: JsonObjectSchema.default({}),
})

export const TestFixtureTypeSchema = z.enum(['file', 'project_template', 'web_fixture', 'memory_fixture'])

export const TestFixtureGenerateBody = z.object({
  targetPath: z.string().nullable().optional(),
})

export const BenchmarkRunBody = z.object({
  suiteId: z.string().nullable().optional(),
  modelProfileIds: z.array(z.string()).default(['default-model']),
  promptVersion: z.string().default('baseline'),
  baselinePromptVersion: z.string().default('baseline'),
  ciMode: z.boolean().default(true),
})

export const SupportedLocaleSchema = z.enum(['zh-CN', 'en-US', 'ja-JP', 'zh-TW'])
export const LocalizationNamespaceSchema = z.enum(['ui', 'errors', 'agent-prompts', 'docs'])
export const I18nContractAreaSchema = z.enum([
  'ui_text_keys',
  'agent_prompt_language',
  'locale_formatting',
  'localized_errors',
  'localized_docs',
])
export const I18nContractStatusSchema = z.enum(['passing', 'warning', 'failing'])
export const OutputLanguagePolicySchema = z.enum([
  'workspace_default',
  'follow_user_locale',
  'fixed_locale',
  'match_input',
])

export const ArchitectureEvolutionTrackSchema = z.enum([
  'single_machine_to_cluster',
  'cloud_worker',
  'saas_private_deploy',
  'mobile_future',
])
export const ArchitectureAbstractionKindSchema = z.enum([
  'event_bus',
  'storage',
  'lock_service',
  'runtime_worker',
  'deployment',
  'mobile_interface',
])
export const ArchitectureEvolutionReservationBody = z.object({
  track: ArchitectureEvolutionTrackSchema,
  abstractionKind: ArchitectureAbstractionKindSchema,
  abstractionName: z.string().min(1).max(120),
  currentImplementation: z.string().min(1),
  futureImplementation: z.string().min(1),
  migrationTrigger: z.string().min(1),
  notes: z.string().optional(),
  evidence: JsonObjectSchema.default({}),
  status: z.enum(['reserved', 'planned', 'blocked', 'implemented']).default('reserved'),
})

export const LocalizationResourceBody = z.object({
  locale: SupportedLocaleSchema,
  namespace: LocalizationNamespaceSchema,
  key: z.string().min(1),
  value: z.string().min(1),
})

export const AgentLocalizationPolicyBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  outputLanguagePolicy: OutputLanguagePolicySchema.default('workspace_default'),
  outputLocale: SupportedLocaleSchema.default('zh-CN'),
  dateTimeLocale: SupportedLocaleSchema.default('zh-CN'),
  numberLocale: SupportedLocaleSchema.default('zh-CN'),
})

export const LocalizationTranslateBody = z.object({
  locale: SupportedLocaleSchema,
  namespace: LocalizationNamespaceSchema,
  key: z.string().min(1),
})

export const LocalizationResolveBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  personaLanguage: SupportedLocaleSchema.optional(),
  userLocale: SupportedLocaleSchema.optional(),
  taskInputLanguage: SupportedLocaleSchema.optional(),
  timestamp: z.number().int().optional(),
  numberValue: z.number().optional(),
})

export const ThemePresetSchema = z.enum(['light', 'dark', 'highContrast', 'cozy'])
export const ThemeSpacingScaleSchema = z.enum(['compact', 'comfortable', 'spacious'])
export const ThemeModePreferenceSchema = z.enum(['system', 'light', 'dark'])

export const ThemeProfileBody = z.object({
  name: z.string().min(1).max(120),
  presetKey: ThemePresetSchema.default('light'),
  followSystem: z.boolean().default(false),
  modePreference: ThemeModePreferenceSchema.default('system'),
  colorTokens: JsonObjectSchema.default({}),
  fontTokens: JsonObjectSchema.default({}),
  radiusPx: z.number().int().min(0).max(32).default(8),
  spacingScale: ThemeSpacingScaleSchema.default('comfortable'),
})

export const ThemeResolveBody = z.object({
  profileId: z.string().nullable().optional(),
  systemTheme: z.enum(['light', 'dark']).default('light'),
})

export const KeyboardShortcutScopeSchema = z.enum(['global', 'canvas', 'run_monitor', 'common'])

export const KeyboardShortcutResolveBody = z.object({
  scope: KeyboardShortcutScopeSchema,
  keys: z.array(z.string()).min(1),
})

export const AccessibilityColorSchemeSchema = z.enum(['system', 'light', 'dark'])

export const AccessibilityProfileBody = z.object({
  profileKey: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  keyboardNavigation: z.boolean().default(true),
  screenReaderSupport: z.boolean().default(true),
  highContrastMode: z.boolean().default(false),
  fontScale: z.number().min(0.85).max(1.6).default(1),
  colorScheme: AccessibilityColorSchemeSchema.default('system'),
  themeProfileId: z.string().nullable().optional(),
})

export const ReasonixFileFormatKindSchema = z.enum([
  'agent',
  'workflow',
  'skill',
  'macro',
  'package',
  'debug',
])

export const ReasonixFileValidationBody = z.object({
  formatKind: ReasonixFileFormatKindSchema,
  payload: JsonObjectSchema,
  signature: z.string().nullable().optional(),
})

export const MigrationSourceToolSchema = z.enum(['autogpt', 'crewai', 'langchain', 'csv'])

export const MigrationCompatibilityBody = z.object({
  sourceTool: MigrationSourceToolSchema,
  sourceName: z.string().max(160).optional(),
  payload: JsonObjectSchema,
})

export const MigrationImportBody = z.object({
  mode: z.enum(['dry_run', 'import']).default('import'),
})

export const PerformanceAnalysisScopeSchema = z.enum(['agent', 'system', 'workspace'])

export const PerformanceAnalysisBody = z.object({
  scope: PerformanceAnalysisScopeSchema.default('workspace'),
  agentProfileId: z.string().nullable().optional(),
  windowStart: z.number().int().nullable().optional(),
  windowEnd: z.number().int().nullable().optional(),
  samples: JsonObjectSchema.default({}),
})

export const SecurityAuditCadenceSchema = z.enum([
  'quarterly',
  'major_version',
  'quarterly_or_major',
  'continuous',
])

export const SecurityAuditRunBody = z.object({
  cadence: z.enum(['quarterly', 'major_version', 'continuous']).default('quarterly'),
  releaseLabel: z.string().max(120).optional(),
  evidence: JsonObjectSchema.default({}),
})

export const IncidentSeveritySchema = z.enum(['P0', 'P1', 'P2', 'P3'])

export const IncidentReportBody = z.object({
  severity: IncidentSeveritySchema,
  title: z.string().min(1).max(160),
  trigger: z.string().min(1).max(160),
  affectedResources: z.array(z.string()).default([]),
  evidence: JsonObjectSchema.default({}),
})

export const CompleteIncidentActionBody = z.object({
  evidence: JsonObjectSchema.default({}),
})

export const CapacityPlanningEvaluateBody = z.object({
  memoryGb: z.number().int().positive(),
  cpuCores: z.number().int().positive(),
  hasGpu: z.boolean().default(false),
  desiredAgents: z.number().int().nonnegative().default(0),
  desiredBrowsers: z.number().int().nonnegative().default(0),
  agentCount: z.number().int().nonnegative().default(0),
  memoriesPerAgent: z.number().int().nonnegative().default(0),
  taskCount: z.number().int().nonnegative().default(0),
})

export const DeprecationStageSchema = z.enum(['notice', 'warning', 'disabled_new', 'removed'])

export const FeatureDeprecationBody = z.object({
  featureKey: z.string().min(1).max(120),
  featureName: z.string().min(1).max(160),
  replacementFeature: z.string().nullable().optional(),
  migrationGuide: z.string().min(1),
  autoMigrateAvailable: z.boolean().default(false),
  noticeAt: z.number().int().optional(),
})

export const DeprecationStageResolveBody = z.object({
  at: z.number().int().optional(),
})

export const DeprecationMigrationRunBody = z.object({
  mode: z.enum(['dry_run', 'apply']).default('dry_run'),
  itemCount: z.number().int().nonnegative().default(0),
})

export const DocumentationSectionCategorySchema = z.enum([
  'getting_started',
  'user_guide',
  'advanced',
  'developer',
  'troubleshooting',
  'reference',
  'release_notes',
])

export const HelpCenterSurfaceBody = z.object({
  surfaceKey: z.string().min(1).max(120),
  route: z.string().min(1).max(240),
  title: z.string().min(1).max(160),
  description: z.string().default(''),
  documentationPageId: z.string().nullable().optional(),
  docHref: z.string().default(''),
  questionButtonLabel: z.string().min(1).max(24).default('?'),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const HelpCenterItemTypeSchema = z.enum([
  'question_button',
  'tooltip',
  'example_value',
  'error_doc_link',
  'onboarding_step',
])

export const HelpCenterItemBody = z.object({
  surfaceId: z.string().min(1),
  itemKey: z.string().min(1).max(160),
  itemType: HelpCenterItemTypeSchema,
  label: z.string().min(1).max(160),
  body: z.string().default(''),
  selector: z.string().nullable().optional(),
  docHref: z.string().default(''),
  exampleValue: JsonObjectSchema.default({}),
  orderIndex: z.number().int().nonnegative().default(0),
  status: z.string().min(1).default('active'),
})

export const HelpOnboardingFlowBody = z.object({
  flowKey: z.string().min(1).max(160),
  title: z.string().min(1).max(160),
  description: z.string().default(''),
  startSurfaceKey: z.string().min(1).default('agent_factory'),
  steps: z.array(JsonObjectSchema).min(1),
  status: z.enum(['active', 'archived']).default('active'),
})

export const GlossaryTermCategorySchema = z.enum([
  'lifecycle',
  'runtime',
  'safety',
  'collaboration',
  'quality',
  'learning',
  'operations',
])

export const FaqEntryCategorySchema = z.enum([
  'security',
  'recovery',
  'models',
  'cost',
  'offline',
  'platform',
  'safety',
])

export const TroubleshootingCategorySchema = z.enum([
  'model',
  'runtime',
  'browser',
  'skills',
  'memory',
  'workflow',
  'approval',
  'security',
])

export const QuickReferenceCategorySchema = z.enum([
  'agent',
  'task',
  'runtime',
  'approval',
  'monitoring',
  'debug',
  'safety',
])

export const NonGoalScopeSchema = z.enum(['v1_not_do', 'never_do'])

export const BrandCandidateLanguageSchema = z.enum(['zh', 'en'])

export const CompetitivePositioningReportBody = z.object({
  name: z.string().min(1).max(160).optional(),
  competitors: z.array(JsonObjectSchema).default([]),
  differentiators: z.array(JsonObjectSchema).default([]),
  strategicImplications: z.array(JsonObjectSchema).default([]),
  summary: z.string().max(2000).optional(),
  status: z.enum(['draft', 'active', 'archived']).default('active'),
})

export const EcosystemRoadmapPhaseBody = z.object({
  phaseNumber: z.number().int().min(1).max(20),
  phaseKey: z.string().min(1).max(120),
  stage: z.enum(['internal_beta', 'open', 'ecosystem', 'platform']),
  title: z.string().min(1).max(180),
  initiatives: z.array(JsonObjectSchema).default([]),
  requiredAssets: JsonObjectSchema.default({}),
  communityChannels: z.array(z.string().min(1)).default([]),
  revenueModel: z.string().max(240).optional(),
  enterpriseReadiness: JsonObjectSchema.default({}),
  status: z.enum(['planned', 'active', 'complete', 'archived']).default('planned'),
})

export const EthicalAlignmentPolicyBody = z.object({
  name: z.string().min(1).max(180).optional(),
  refuseCategories: z.array(z.string().min(1)).default([]),
  warnCategories: z.array(z.string().min(1)).default([]),
  onRefuse: z.enum(['explain_why', 'silent_reject', 'ask_user_to_rephrase']).default('explain_why'),
  userValues: JsonObjectSchema.default({}),
  preTaskAlignment: JsonObjectSchema.default({}),
  status: z.enum(['draft', 'active', 'archived']).default('active'),
})

export const EthicalAlignmentEvaluationBody = z.object({
  policyId: z.string().min(1).optional(),
  taskSummary: z.string().min(1).max(2000),
  detectedCategories: z.array(z.string().min(1)).default([]),
  uncertain: z.boolean().default(false),
})

export const LegalComplianceFrameworkBody = z.object({
  name: z.string().min(1).max(180).optional(),
  regulations: JsonObjectSchema.default({}),
  dataResidencyDefault: z.string().min(1).max(80).default('local_only'),
  notes: z.string().max(2000).optional(),
  status: z.enum(['draft', 'active', 'archived']).default('active'),
})

export const LegalDisclaimerNoticeBody = z.object({
  placement: z.enum(['installation', 'agent_creation', 'approval_footer', 'artifact_output']),
  title: z.string().min(1).max(180),
  message: z.string().min(1).max(4000),
  requiresAcknowledgement: z.boolean().default(false),
  status: z.enum(['draft', 'active', 'archived']).default('active'),
})

export const LicenseComplianceCheckBody = z.object({
  code: z.string().optional(),
  source: z.string().min(1).max(500),
  declaredLicense: z.string().max(80).optional(),
})

export const EmotionalUxGuidelineBody = z.object({
  guidelineType: z.enum(['tone', 'microinteraction', 'anxiety_reduction']),
  scenarioKey: z.string().min(1).max(120),
  title: z.string().min(1).max(180),
  messageTemplate: z.string().max(1000).optional(),
  behavior: z.string().max(1000).optional(),
  visualCue: z.string().max(240).optional(),
  audioCue: z.string().max(240).optional(),
  anxietyReduction: z.string().max(1000).optional(),
  status: z.enum(['draft', 'active', 'archived']).default('active'),
})

export const SystemBootstrapCheckRunBody = z.object({
  observed: JsonObjectSchema.default({}),
  thresholds: JsonObjectSchema.default({}),
  now: z.number().int().optional(),
})

export const SuccessMetricCategorySchema = z.enum(['product', 'quality', 'community', 'business'])

export const SuccessMetricSnapshotBody = z.object({
  metricKey: z.string().min(1),
  value: z.number(),
  measuredAt: z.number().int().optional(),
  notes: z.string().optional(),
})

export const ReadinessChecklistCategorySchema = z.enum([
  'technical',
  'security',
  'planning',
  'environment',
  'team',
  'documentation',
  'legal',
])

export const OAuthProviderSchema = z.enum([
  'github',
  'google',
  'microsoft',
  'notion',
  'slack',
  'custom',
])

export const OAuthCredentialBody = z.object({
  provider: OAuthProviderSchema,
  grantType: z.enum(['authorization_code', 'client_credentials', 'device_code']),
  accessTokenSecretRef: z.string().min(1),
  refreshTokenSecretRef: z.string().nullable().optional(),
  expiresAt: z.number().int().positive(),
  scopes: z.array(z.string().min(1)).default([]),
  actingAs: z.enum(['user', 'service_account', 'bot']),
  autoRefresh: z.boolean().default(true),
  refreshBeforeExpiry: z.number().int().nonnegative().default(300),
  allowedOperations: z.array(z.string().min(1)).default([]),
  requiresUserConsent: z.boolean().default(false),
  shared: z.boolean().default(false),
  agentProfileId: z.string().nullable().optional(),
})

export const OAuthOperationEvaluationBody = z.object({
  operation: z.string().min(1),
  requiredScope: z.string().nullable().optional(),
  agentProfileId: z.string().nullable().optional(),
  now: z.number().int().positive().optional(),
})

export const OAuthRefreshFailureBody = z.object({
  message: z.string().min(1),
  pausedRunId: z.string().nullable().optional(),
  reauthorizationUrl: z.string().nullable().optional(),
})

export const OAuthReauthorizationBody = z.object({
  accessTokenSecretRef: z.string().min(1).optional(),
  refreshTokenSecretRef: z.string().nullable().optional(),
  expiresAt: z.number().int().positive(),
  scopes: z.array(z.string().min(1)).optional(),
  resumedRunId: z.string().nullable().optional(),
})

export const WorkspaceStructureSchema = z.enum(['node', 'python', 'go', 'custom'])

export const WorkspaceSetupSchema = z.object({
  installDeps: z.boolean().default(false),
  runMigrations: z.boolean().default(false),
  seedData: z.string().nullable().optional(),
  linkSharedModules: z.boolean().default(false),
})

export const WorkspaceVerifySchema = z.object({
  runTests: z.boolean().default(false),
  checkTypes: z.boolean().default(false),
  lintCheck: z.boolean().default(false),
  buildCheck: z.boolean().default(false),
})

export const WorkspaceTemplateBody = z.object({
  name: z.string().min(1).max(120),
  structure: WorkspaceStructureSchema,
  description: z.string().optional(),
  fileTree: z.array(JsonObjectSchema).default([]),
  setupDefaults: JsonObjectSchema.default({}),
  verifyDefaults: JsonObjectSchema.default({}),
})

export const WorkspaceInitBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  employeeRunId: z.string().nullable().optional(),
  source: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('git'),
      url: z.string().min(1),
      branch: z.string().nullable().optional(),
      depth: z.number().int().positive().nullable().optional(),
    }),
    z.object({
      type: z.literal('local'),
      path: z.string().min(1),
    }),
    z.object({
      type: z.literal('template'),
      templateId: z.string().min(1),
    }),
    z.object({
      type: z.literal('empty'),
      structure: WorkspaceStructureSchema,
    }),
  ]),
  setup: WorkspaceSetupSchema.default({
    installDeps: false,
    runMigrations: false,
    linkSharedModules: false,
  }),
  verify: WorkspaceVerifySchema.default({
    runTests: false,
    checkTypes: false,
    lintCheck: false,
    buildCheck: false,
  }),
  onSetupFail: z.enum(['abort', 'retry', 'skip_and_warn', 'ask_user']).default('ask_user'),
  workspacePath: z.string().nullable().optional(),
})

export const WorkspaceInitFailureBody = z.object({
  failureMessage: z.string().min(1),
})

export const CustomModelSourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('openai_finetune'), modelId: z.string().min(1) }),
  z.object({ type: z.literal('huggingface'), repoId: z.string().min(1) }),
  z.object({ type: z.literal('local_gguf'), path: z.string().min(1) }),
  z.object({ type: z.literal('ollama_custom'), modelName: z.string().min(1) }),
])

export const CustomModelBody = z.object({
  name: z.string().min(1).max(120),
  source: CustomModelSourceSchema,
  finetuneInfo: z
    .object({
      baseModel: z.string().min(1),
      dataset: z.string().min(1),
      taskSpecialization: z.array(z.string().min(1)).default([]),
      finetunedAt: z.number().int().positive(),
      performanceDelta: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  usageConstraints: z.object({
    maxContextWindow: z.number().int().positive(),
    requiresSpecialPromptFormat: z.boolean().default(false),
    knownLimitations: z.array(z.string().min(1)).default([]),
    compatibleSkills: z.array(z.string().min(1)).default([]),
    incompatibleSkills: z.array(z.string().min(1)).default([]),
  }),
  status: z.enum(['available', 'testing', 'disabled']).default('available'),
})

export const CustomModelEvaluationBody = z.object({
  requestedContextWindow: z.number().int().positive().optional(),
  skillIds: z.array(z.string()).default([]),
  promptFormatAcknowledged: z.boolean().default(false),
})

export const FinetuneDatasetExportBody = z.object({
  customModelId: z.string().nullable().optional(),
  sourceScope: z.enum(['agent', 'project', 'workspace']),
  sourceIds: z.array(z.string().min(1)).default([]),
  datasetPurpose: z.string().min(1),
  recordCount: z.number().int().nonnegative().default(0),
  destinationProvider: z.string().min(1).default('manual'),
  includePrivateData: z.boolean().default(false),
  consentStatus: z.enum(['pending', 'approved', 'rejected', 'exported']).default('pending'),
})

export const ProjectSwitchModeSchema = z.enum(['sequential', 'parallel', 'time_sliced'])

export const ProjectContextBody = z.object({
  projectName: z.string().min(1).max(160),
  overrides: z
    .object({
      modelProfileId: z.string().nullable().optional(),
      maxBudget: z.number().nonnegative().nullable().optional(),
      allowedSkills: z.array(z.string().min(1)).default([]),
      requiredApprovalFor: z.array(z.string().min(1)).default([]),
      networkProfileId: z.string().nullable().optional(),
    })
    .default({
      allowedSkills: [],
      requiredApprovalFor: [],
    }),
  switchBehavior: z
    .object({
      pauseCurrentTasks: z.boolean().default(true),
      isolateMemories: z.boolean().default(true),
      checkpointBeforeSwitch: z.boolean().default(true),
      mode: ProjectSwitchModeSchema.default('sequential'),
    })
    .default({
      pauseCurrentTasks: true,
      isolateMemories: true,
      checkpointBeforeSwitch: true,
      mode: 'sequential',
    }),
})

export const ProjectAgentRoleBody = z.object({
  agentId: z.string().min(1),
  role: z.string().min(1).max(120),
  joinedAt: z.number().int().positive().optional(),
  activeWorkflows: z.array(z.string()).default([]),
  contributedArtifacts: z.array(z.string()).default([]),
  projectSpecificMemories: z.array(z.string()).default([]),
})

export const ProjectSwitchBody = z.object({
  agentId: z.string().min(1),
  fromProjectContextId: z.string().nullable().optional(),
  toProjectContextId: z.string().min(1),
  behavior: z
    .object({
      pauseCurrentTasks: z.boolean().optional(),
      isolateMemories: z.boolean().optional(),
      checkpointBeforeSwitch: z.boolean().optional(),
      mode: ProjectSwitchModeSchema.optional(),
    })
    .optional(),
})

export const BehaviorSnapshotBody = z.object({
  agentProfileId: z.string().min(1),
  kind: z.enum(['baseline', 'current']),
  schedule: z.string().min(1).default('weekly'),
  baselineBehavior: z.object({
    avgStepsPerTask: z.number().nonnegative(),
    avgCostPerTask: z.number().nonnegative(),
    approvalRequestRate: z.number().nonnegative(),
    typicalPlanStructure: z.string().min(1),
    toolPreferenceOrder: z.array(z.string()).default([]),
    outputVerbosity: z.number().nonnegative(),
  }),
  maxAllowedDeviation: z.number().nonnegative().default(0.2),
})

export const BehaviorStabilizationConfigBody = z.object({
  memoryHygiene: z.boolean().default(false),
  resetLearnedBehaviors: z.boolean().default(false),
  reAnchorToOriginalConfig: z.boolean().default(false),
  recalibrateWithBenchmarks: z.boolean().default(false),
})

export const BehaviorDriftAnalysisBody = z.object({
  baselineSnapshotId: z.string().min(1),
  currentSnapshotId: z.string().min(1),
  stabilization: BehaviorStabilizationConfigBody.default({
    memoryHygiene: false,
    resetLearnedBehaviors: false,
    reAnchorToOriginalConfig: false,
    recalibrateWithBenchmarks: false,
  }),
  onSignificantDrift: z.enum(['notify', 'auto_correct', 'ask_user']).default('ask_user'),
})

export const SkillSynthesisDiscoveryBody = z.object({
  skillIds: z.array(z.string().min(1)).min(2),
  detectComplementaryPairs: z.boolean().default(true),
  suggestNewCompositeSkill: z.boolean().default(true),
})

export const ToolPipelineBody = z.object({
  synthesisRecordId: z.string().nullable().optional(),
  name: z.string().min(1).max(160),
  composedOf: z.array(z.string().min(1)).min(1),
  chain: z.array(JsonObjectSchema).min(1),
  inputOutputMapping: JsonObjectSchema.default({}),
  onStepFailure: z.enum(['abort', 'skip', 'retry', 'use_fallback_tool']).default('abort'),
  publishable: z.boolean().default(false),
})

export const UnifiedSearchEntityTypeSchema = z.enum([
  'agent',
  'task',
  'memory',
  'artifact',
  'workflow',
  'event',
  'knowledge_graph',
  'document',
])

export const UnifiedSearchIndexBody = z.object({
  entityType: UnifiedSearchEntityTypeSchema,
  entityId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  snippet: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  agentName: z.string().nullable().optional(),
  taskName: z.string().nullable().optional(),
  projectName: z.string().nullable().optional(),
  timestamp: z.number().int().positive().optional(),
})

export const UnifiedSearchQueryBody = z.object({
  query: z.string().min(1),
  scope: z
    .object({
      agents: z.boolean().default(true),
      tasks: z.boolean().default(true),
      memories: z.boolean().default(true),
      artifacts: z.boolean().default(true),
      workflows: z.boolean().default(true),
      events: z.boolean().default(true),
      knowledgeGraph: z.boolean().default(true),
      documents: z.boolean().default(true),
    })
    .default({
      agents: true,
      tasks: true,
      memories: true,
      artifacts: true,
      workflows: true,
      events: true,
      knowledgeGraph: true,
      documents: true,
    }),
  modes: z
    .object({
      keyword: z.boolean().default(true),
      semantic: z.boolean().default(false),
      hybrid: z.boolean().default(true),
      filtered: z.boolean().default(false),
    })
    .default({
      keyword: true,
      semantic: false,
      hybrid: true,
      filtered: false,
    }),
  filters: z
    .object({
      entityTypes: z.array(UnifiedSearchEntityTypeSchema).optional(),
      agentName: z.string().optional(),
      projectName: z.string().optional(),
      dateFrom: z.number().int().optional(),
      dateTo: z.number().int().optional(),
    })
    .default({}),
  nlQuery: z.boolean().default(false),
  limit: z.number().int().positive().max(100).default(20),
})

export const ContextPreloadTaskTypeSchema = z.enum(['code', 'data', 'doc', 'general'])
export const ContextCacheStatusSchema = z.enum(['fresh', 'stale', 'invalidated'])

export const ContextPreloadBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  taskType: ContextPreloadTaskTypeSchema.default('general'),
  goal: z.string().min(1),
  preload: z
    .object({
      relevantMemories: z.boolean().default(true),
      projectStructure: z.boolean().default(true),
      recentChanges: z.boolean().default(true),
      activeGuidelines: z.boolean().default(true),
      peerAgentStatus: z.boolean().default(false),
      recentErrors: z.boolean().default(true),
    })
    .partial()
    .optional(),
  cache: z
    .object({
      projectStructureTTL: z.string().min(1).default('until_file_change'),
      semanticCacheTTL: z.number().int().nonnegative().default(300),
      memorySearchCacheTTL: z.number().int().nonnegative().default(600),
    })
    .partial()
    .optional(),
})

export const ContextCacheResolveBody = z.object({
  contextCacheId: z.string().nullable().optional(),
  cacheKey: z.string().nullable().optional(),
  invalidationSignal: z.string().nullable().optional(),
})

export const SoftwareProfileBody = z.object({
  name: z.string().min(1).max(120),
  appType: z.enum(['native_app', 'browser_app', 'cli_app', 'mobile_app', 'api_service', 'script']),
  adapterType: z.enum([
    'cli',
    'mcp',
    'api',
    'browser_automation',
    'desktop_automation',
    'recorded_macro',
    'hybrid',
  ]),
  launchCommand: z.string().nullable().optional(),
  executablePath: z.string().nullable().optional(),
  defaultWorkstationMode: z
    .enum(['browser_context', 'physical_desktop', 'virtual_desktop', 'vm', 'remote_session'])
    .default('browser_context'),
})

export const SoftwareCommandBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  inputSchema: JsonObjectSchema.default({}),
  outputSchema: JsonObjectSchema.default({}),
  implementation: JsonObjectSchema,
  riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  requiresApproval: z.boolean().optional(),
})

export const SoftwareCommandRunBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  workflowRunId: z.string().nullable().optional(),
  workflowNodeRunId: z.string().nullable().optional(),
  input: JsonObjectSchema.default({}),
  mode: z.enum(['dry_run', 'execute']).default('dry_run'),
  computerSessionId: z.string().nullable().optional(),
  live: z.boolean().optional(),
  confirmRisk: z.boolean().optional(),
  approvalRequestId: z.string().nullable().optional(),
})

export const RecordedMacroBody = z.object({
  softwareProfileId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  steps: z.array(JsonObjectSchema).min(1),
  inputSchema: JsonObjectSchema.default({}),
  outputSchema: JsonObjectSchema.default({}),
  parameterBindings: JsonObjectSchema.default({}),
  riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['draft', 'active', 'archived']).default('active'),
})

export const MacroReplayBody = z.object({
  softwareCommandId: z.string().nullable().optional(),
  agentProfileId: z.string().nullable().optional(),
  input: JsonObjectSchema.default({}),
  mode: z.enum(['dry_run', 'execute']).default('dry_run'),
})

export const BrowserSessionStatusSchema = z.enum(['active', 'expired', 'revoked', 'archived'])
export const BrowserSessionMaxAgeSchema = z.enum(['1d', '7d', '30d', 'forever'])
export const BrowserSessionKeepAliveIntervalSchema = z.enum(['1h', '4h', '12h'])

export const BrowserSessionBody = z.object({
  sessionName: z.string().min(1).max(160),
  ownerAgentProfileId: z.string().nullable().optional(),
  sharedWithAgentProfileIds: z.array(z.string()).default([]),
  cookieJarRef: z.string().min(1),
  localStorageRef: z.string().nullable().optional(),
  indexedDbRef: z.string().nullable().optional(),
  encrypted: z.boolean().default(true),
  persistAfterTask: z.boolean().default(true),
  maxAge: BrowserSessionMaxAgeSchema.default('7d'),
  keepAlive: z
    .object({
      enabled: z.boolean().default(false),
      interval: BrowserSessionKeepAliveIntervalSchema.default('4h'),
      visitUrls: z.array(z.string()).default([]),
    })
    .default({ enabled: false, interval: '4h', visitUrls: [] }),
  security: z
    .object({
      encryptSensitiveCookies: z.boolean().default(true),
      isolateByAgent: z.boolean().default(true),
      exportable: z.boolean().default(false),
      blockedDomains: z.array(z.string()).default([]),
    })
    .default({
      encryptSensitiveCookies: true,
      isolateByAgent: true,
      exportable: false,
      blockedDomains: [],
    }),
  now: z.number().int().optional(),
})

export const BrowserSessionAccessBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  now: z.number().int().optional(),
})

export const BrowserSessionKeepAliveBody = z.object({
  now: z.number().int().optional(),
})

export const BrowserSessionExportBody = z.object({
  format: z.enum(['encrypted_bundle_manifest']).default('encrypted_bundle_manifest'),
  requestedByAgentProfileId: z.string().nullable().optional(),
})

export const AgentPersonaBody = z.object({
  avatar: z.string().optional(),
  tone: z
    .enum(['formal', 'casual', 'technical', 'friendly', 'concise', 'detailed'])
    .optional(),
  language: z.string().optional(),
  communicationStyle: z
    .object({
      useEmoji: z.boolean().optional(),
      useCodeBlocks: z.boolean().optional(),
      preferBulletPoints: z.boolean().optional(),
      showThinkingProcess: z.boolean().optional(),
      selfReference: z.string().optional(),
    })
    .optional(),
  personalityTraits: z
    .object({
      cautious: z.number().min(0).max(1).optional(),
      creative: z.number().min(0).max(1).optional(),
      thorough: z.number().min(0).max(1).optional(),
      efficient: z.number().min(0).max(1).optional(),
    })
    .optional(),
})

export const AgentProfileBody = z.object({
  name: z.string().min(1).max(120),
  role: z.string().min(1).max(120),
  description: z.string().optional(),
  modelProfileId: z.string().nullable().optional(),
  fallbackModelProfileIds: z.array(z.string()).default([]),
  skillIds: z.array(z.string()).default([]),
  mcpServerIds: z.array(z.string()).default([]),
  cliProfileIds: z.array(z.string()).default([]),
  softwareProfileIds: z.array(z.string()).default([]),
  memoryPolicy: JsonObjectSchema.default({}),
  autonomyPolicy: JsonObjectSchema.default({}),
  workstationPolicy: JsonObjectSchema.default({}),
  permissionPolicy: JsonObjectSchema.default({}),
  inputContract: JsonObjectSchema.default({}),
  outputContract: JsonObjectSchema.default({}),
  persona: AgentPersonaBody.optional(),
  systemPrompt: z.string().optional(),
  behaviorRules: z.array(z.string()).default([]),
  successCriteria: z.array(z.string()).default([]),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
})

export const AgentProfilePatchBody = AgentProfileBody.partial()

export const AgentCloneBody = z.object({
  name: z.string().min(1).max(120).optional(),
  nameSuffix: z.string().max(80).default('(experiment)'),
  copyModelConfig: z.boolean().default(true),
  modelProfileId: z.string().nullable().optional(),
  fallbackModelProfileIds: z.array(z.string()).optional(),
  skillMode: z.enum(['shared', 'independent_snapshot', 'none']).default('shared'),
  memoryMode: z.enum(['semantic_only', 'none']).default('semantic_only'),
  copyPermissionConfig: z.boolean().default(true),
  modifications: JsonObjectSchema.default({}),
  experimentNote: z.string().max(500).optional(),
  status: z.enum(['draft', 'active']).default('draft'),
})

export const AgentComparisonBody = z.object({
  leftAgentProfileId: z.string().min(1),
  rightAgentProfileId: z.string().min(1),
  tasks: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().min(1).max(160),
        input: JsonObjectSchema.default({}),
      }),
    )
    .min(1)
    .max(12),
  repetitions: z.number().int().min(1).max(5).default(3),
})

export const AgentWhatIfBody = z.object({
  agentProfileId: z.string().min(1),
  proposedChanges: JsonObjectSchema.default({}),
})

export const StyleGuideBody = z.object({
  name: z.string().min(1).max(120),
  language: z
    .object({
      tone: z.string().optional(),
      forbiddenWords: z.array(z.string()).default([]),
      preferredTerms: z.record(z.string(), z.string()).default({}),
      sentenceLength: z.enum(['short', 'medium', 'varied']).default('varied'),
      useOxfordComma: z.boolean().default(false),
    })
    .default({
      forbiddenWords: [],
      preferredTerms: {},
      sentenceLength: 'varied',
      useOxfordComma: false,
    }),
  code: z
    .object({
      indentStyle: z.enum(['space', 'tab']).default('space'),
      indentSize: z.number().int().positive().max(8).default(2),
      quotes: z.enum(['single', 'double']).default('single'),
      semicolons: z.boolean().default(false),
      maxLineLength: z.number().int().positive().max(240).default(100),
      namingConvention: z.enum(['camelCase', 'PascalCase', 'snake_case']).default('camelCase'),
    })
    .default({
      indentStyle: 'space',
      indentSize: 2,
      quotes: 'single',
      semicolons: false,
      maxLineLength: 100,
      namingConvention: 'camelCase',
    }),
  visual: z
    .object({
      colorPalette: z.array(z.string()).default([]),
      fontFamily: z.string().optional(),
      logoUrl: z.string().optional(),
      preferDarkTheme: z.boolean().default(false),
    })
    .default({
      colorPalette: [],
      preferDarkTheme: false,
    }),
  outputRules: JsonObjectSchema.default({}),
  status: z.enum(['active', 'archived']).default('active'),
})

export const AgentStyleGuideBindingBody = z.object({
  agentProfileId: z.string().min(1),
  styleGuideId: z.string().min(1),
  status: z.enum(['active', 'superseded', 'disabled']).default('active'),
})

export const StyleGuideBindAgentBody = z.object({
  agentProfileId: z.string().min(1),
  status: z.enum(['active', 'superseded', 'disabled']).default('active'),
})

export const StyleGuideEvaluationBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  styleGuideId: z.string().nullable().optional(),
  sample: z.union([z.string(), JsonObjectSchema]),
})

export const AgentDiversityProfileBody = z.object({
  agentProfileId: z.string().min(1),
  personality: z
    .enum(['creative', 'cautious', 'user_advocate', 'security', 'performance', 'operator', 'custom'])
    .default('cautious'),
  perspective: z.string().min(1).max(120).default('implementation'),
  temperature: z.number().min(0).max(2).default(0.4),
  riskPosture: z.enum(['bold', 'balanced', 'conservative']).default('balanced'),
  collaborationRole: z.string().min(1).max(120).default('contributor'),
  status: z.enum(['active', 'archived']).default('active'),
})

export const DiversityAnalysisBody = z.object({
  scopeType: z.enum(['team', 'workflow', 'project', 'workspace']).default('team'),
  scopeId: z.string().nullable().optional(),
  agentProfileIds: z.array(z.string()).default([]),
})

export const AgentInterviewBody = z.object({
  agentProfileId: z.string().min(1),
  scenarioTitle: z.string().min(1).max(160).optional(),
  scenarioTask: z.string().min(1).optional(),
  planResponse: z.string().nullable().optional(),
  feedbackPrompt: z.string().nullable().optional(),
  feedbackResponse: z.string().nullable().optional(),
  rubric: JsonObjectSchema.default({}),
})

export const PerformanceReviewBody = z.object({
  agentProfileId: z.string().min(1),
  reviewerAgentProfileId: z.string().nullable().optional(),
  sampledRunIds: z.array(z.string()).default([]),
  sampleSize: z.number().int().positive().max(10).default(3),
  periodStartAt: z.number().int().nullable().optional(),
  periodEndAt: z.number().int().nullable().optional(),
  autoApplyRecommendations: z.boolean().default(false),
})

export const AgentMentorshipBody = z.object({
  mentorAgentProfileId: z.string().min(1),
  menteeAgentProfileId: z.string().min(1),
  scope: z.enum(['all_tasks', 'specific_task_types', 'until_proficiency']).default('until_proficiency'),
  scopeTaskTypes: z.array(z.string()).default([]),
  style: z.enum(['review_and_feedback', 'pair_execution', 'shadow_mode']).default('review_and_feedback'),
  mentoringActions: z
    .object({
      reviewOutputs: z.boolean().default(true),
      interveneWhenStuck: z.boolean().default(true),
      shareRelevantMemories: z.boolean().default(true),
      generatePracticeTasks: z.boolean().default(true),
    })
    .default({
      reviewOutputs: true,
      interveneWhenStuck: true,
      shareRelevantMemories: true,
      generatePracticeTasks: true,
    }),
  progress: z
    .object({
      initialProficiency: z.number().min(0).max(1).default(0.2),
      currentProficiency: z.number().min(0).max(1).optional(),
      targetProficiency: z.number().min(0).max(1).default(0.8),
      tasksUntilGraduation: z.number().int().nonnegative().default(5),
      fastestImprovingAreas: z.array(z.string()).default([]),
      needsImprovement: z.array(z.string()).default([]),
    })
    .default({
      initialProficiency: 0.2,
      targetProficiency: 0.8,
      tasksUntilGraduation: 5,
      fastestImprovingAreas: [],
      needsImprovement: [],
    }),
})

export const AgentMentoringActionBody = z.object({
  eventType: z.enum([
    'review_output',
    'intervene_when_stuck',
    'share_memory',
    'generate_practice_task',
    'progress_update',
  ]),
  employeeRunId: z.string().nullable().optional(),
  artifactId: z.string().nullable().optional(),
  summary: z.string().default(''),
  feedback: z.string().default(''),
  sharedMemoryIds: z.array(z.string()).default([]),
  practiceTask: JsonObjectSchema.default({}),
  proficiencyDelta: z.number().min(-1).max(1).default(0),
  successfulTask: z.boolean().default(false),
  areasImproved: z.array(z.string()).default([]),
  needsImprovement: z.array(z.string()).default([]),
})

export const UserOverrideBody = z.object({
  command: z.enum(['STOP', 'UNDO', 'PAUSE', 'NEVER_DO_THIS_AGAIN', 'IGNORE_PREVIOUS_INSTRUCTION']),
  targetType: z
    .enum(['global', 'workspace', 'agent_profile', 'employee_run', 'workflow_run', 'task_queue', 'resource'])
    .default('workspace'),
  targetId: z.string().nullable().optional(),
  reason: z.string().optional(),
  trigger: z.enum(['ui', 'api', 'hotkey', 'tray', 'cli', 'system']).default('api'),
  payload: JsonObjectSchema.default({}),
})

export const WorkflowBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  nodes: z
    .array(
      z.object({
        id: z.string().optional(),
        type: z.string().min(1),
        agentProfileId: z.string().nullable().optional(),
        position: z.object({ x: z.number(), y: z.number() }),
        config: JsonObjectSchema.default({}),
        inputMapping: JsonObjectSchema.default({}),
        outputContract: JsonObjectSchema.default({}),
        retryPolicy: JsonObjectSchema.default({}),
        approvalPolicy: JsonObjectSchema.default({}),
      }),
    )
    .default([]),
  edges: z
    .array(
      z.object({
        id: z.string().optional(),
        sourceNodeId: z.string().min(1),
        targetNodeId: z.string().min(1),
        sourceHandle: z.string().nullable().optional(),
        targetHandle: z.string().nullable().optional(),
        mapping: JsonObjectSchema.default({}),
      }),
    )
    .default([]),
})

export const WorkflowRunBody = z.object({
  input: JsonObjectSchema.default({}),
})

export const WorkflowPreflightBody = z.object({
  input: JsonObjectSchema.default({}),
  budgetLimitCents: z.number().int().nonnegative().nullable().optional(),
})

export const NaturalLanguageWorkflowDraftBody = z.object({
  prompt: z.string().min(1).max(4000),
  name: z.string().min(1).max(120).optional(),
  agentProfileIds: z.array(z.string()).default([]),
  preferredAgentRoles: z.array(z.string()).default([]),
})

export const NaturalLanguageWorkflowReviseBody = z.object({
  modificationPrompt: z.string().min(1).max(2000),
  name: z.string().min(1).max(120).optional(),
  agentProfileIds: z.array(z.string()).default([]),
})

export const NaturalLanguageWorkflowConfirmBody = z.object({
  name: z.string().min(1).max(120).optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  modifications: JsonObjectSchema.default({}),
})

export const TaskTemplateParameterTypeSchema = z.enum(['string', 'number', 'boolean', 'file', 'url', 'select'])

export const TaskTemplateParameterSchema = z.object({
  type: TaskTemplateParameterTypeSchema,
  label: z.string().min(1),
  description: z.string().default(''),
  default: z.unknown().optional(),
  required: z.boolean().default(false),
  options: z
    .array(z.object({ label: z.string().min(1), value: z.unknown() }))
    .optional(),
})

export const TaskTemplateBody = z.object({
  name: z.string().min(1).max(160),
  description: z.string().default(''),
  category: z.string().min(1).max(80),
  parameters: z.record(z.string(), TaskTemplateParameterSchema).default({}),
  agentRole: z.string().min(1).max(160),
  workflowId: z.string().nullable().optional(),
  descriptionTemplate: z.string().min(1),
  inputTemplate: JsonObjectSchema.default({}),
  estimatedDuration: z.string().default(''),
  estimatedCost: z.number().nonnegative().default(0),
  tags: z.array(z.string()).default([]),
  relatedMemories: z.array(z.string()).default([]),
  requiredSkills: z.array(z.string()).default([]),
  sampleOutputs: z.array(z.string()).default([]),
  status: z.enum(['active', 'archived']).default('active'),
})

export const TaskTemplateInstantiateBody = z.object({
  parameters: JsonObjectSchema.default({}),
  agentProfileId: z.string().nullable().optional(),
  workflowId: z.string().nullable().optional(),
  status: z.enum(['planned', 'queued']).default('planned'),
})

export const TaskTemplateRunCompleteBody = z.object({
  success: z.boolean(),
  actualDuration: z.string().default(''),
  actualCost: z.number().nonnegative().default(0),
})

export const TaskQueueBody = z.object({
  name: z.string().min(1).max(120),
  concurrencyLimit: z.number().int().positive().max(32).optional(),
  status: z.enum(['active', 'paused', 'archived']).default('active'),
})

export const EnqueueTaskBody = z.object({
  kind: z.enum(['employee_run', 'workflow_run', 'software_command', 'continuation_plan', 'task_batch']),
  payload: JsonObjectSchema,
  priority: z.number().int().optional(),
  scheduledAt: z.number().int().optional(),
})

export const ProcessTaskQueueBody = z.object({
  maxItems: z.number().int().positive().max(32).optional(),
})

export const TaskBatchMergeableBody = z.object({
  sameAgent: z.boolean().default(true),
  sameType: z.boolean().default(true),
  sameProject: z.boolean().default(true),
  crossAgent: z.boolean().default(false),
})

export const TaskBatchStrategyBody = z.object({
  windowMs: z.number().int().positive().max(24 * 60 * 60 * 1000).default(60_000),
  maxBatchSize: z.number().int().min(2).max(100).default(5),
  mergeable: TaskBatchMergeableBody.default({
    sameAgent: true,
    sameType: true,
    sameProject: true,
    crossAgent: false,
  }),
  exclusionRules: z.array(z.string()).default([
    'priority == 1',
    'estimated_duration > 10m',
    'requires_approval',
  ]),
})

export const TaskBatchPlanBody = z.object({
  queueId: z.string().min(1),
  now: z.number().int().optional(),
  strategy: TaskBatchStrategyBody.optional(),
})

export const TaskBatchApplyBody = z.object({
  note: z.string().max(500).optional(),
})

export const TaskQueueTickBody = z.object({
  maxItems: z.number().int().positive().max(32).optional(),
  enqueueDueContinuationPlans: z.boolean().default(true),
  now: z.number().int().optional(),
  continuationScanLimit: z.number().int().positive().max(500).optional(),
  continuationPriority: z.number().int().optional(),
  budgetLimitCents: z.number().int().nonnegative().nullable().optional(),
})

export const AcceptanceScenarioKeySchema = z.enum([
  'first_experience',
  'parallel_agents',
  'crash_recovery',
  'canvas_workflow',
  'approval_flow',
  'budget_control',
  'memory_learning',
  'security_boundary',
  'offline_degradation',
  'emergency_stop',
])

export const AcceptanceCriteriaRunBody = z.object({
  scenarioKeys: z.array(AcceptanceScenarioKeySchema).optional(),
})

export const TaskScheduleBody = z.object({
  queueId: z.string().min(1),
  name: z.string().min(1).max(120),
  kind: z.enum(['task_queue_tick', 'enqueue_due_continuations']).default('task_queue_tick'),
  status: z.enum(['active', 'paused', 'archived']).default('active'),
  intervalMs: z.number().int().positive(),
  nextRunAt: z.number().int().optional(),
  payload: JsonObjectSchema.default({}),
})

export const RunDueTaskSchedulesBody = z.object({
  now: z.number().int().optional(),
  limit: z.number().int().positive().max(500).optional(),
})

export const RecoveryEventBody = z.object({
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  eventType: z.enum([
    'checkpoint_saved',
    'resume_requested',
    'resume_completed',
    'resume_failed',
    'shutdown_notice',
  ]),
  status: z.enum(['recorded', 'complete', 'failed']).default('recorded'),
  summary: z.string().min(1),
  payload: JsonObjectSchema.default({}),
})

export const IdempotencyRecordBody = z.object({
  key: z.string().min(1),
  scope: z.string().optional(),
  resourceType: z.string().min(1),
  resourceId: z.string().nullable().optional(),
  request: JsonObjectSchema,
  expiresAt: z.number().int().nullable().optional(),
})

export const AgentMessageBody = z.object({
  senderAgentProfileId: z.string().nullable().optional(),
  recipientAgentProfileId: z.string().nullable().optional(),
  workflowRunId: z.string().nullable().optional(),
  employeeRunId: z.string().nullable().optional(),
  channel: z.string().optional(),
  messageType: z.enum(['handoff', 'question', 'status', 'artifact', 'warning']).default('status'),
  content: JsonObjectSchema,
})

export const BlackboardEntryBody = z.object({
  scopeType: z.enum(['workflow_run', 'project', 'workspace', 'global']),
  scopeId: z.string().min(1),
  key: z.string().min(1),
  value: JsonObjectSchema,
  authorAgentProfileId: z.string().nullable().optional(),
})

export const AgentTeamDashboardBody = z.object({
  name: z.string().min(1).max(160).default('Agent Team Dashboard'),
  workflowRunId: z.string().nullable().optional(),
  agentProfileIds: z.array(z.string()).default([]),
  blackboardScopeType: z.enum(['workflow_run', 'project', 'workspace', 'global']).default('global'),
  blackboardScopeId: z.string().default('global'),
})

export const AgentTeamDashboardCommandBody = z.object({
  commandType: z.enum(['pause_all', 'resume_all', 'emergency_stop', 'export_report']),
})

export const CicdIntegrationBody = z.object({
  name: z.string().min(1).max(160),
  platform: z.enum(['github_actions', 'gitlab_ci', 'jenkins', 'circleci', 'azure_devops']),
  mode: z.enum(['cli', 'action', 'api', 'webhook']),
  agentProfileId: z.string().nullable().optional(),
  agentName: z.string().min(1).max(160),
  task: z.string().min(1),
  maxBudgetDollars: z.number().nonnegative().default(0.5),
  failOn: z
    .enum(['passed', 'security_issue_found', 'style_issues_only', 'agent_failed'])
    .default('security_issue_found'),
  outputArtifacts: z.boolean().default(true),
  postAsPrComment: z.boolean().default(true),
  autoFix: z.boolean().default(false),
  exitCodeMapping: z.record(z.string(), z.number().int()).default({
    security_issue_found: 1,
    style_issues_only: 0,
    agent_failed: 2,
    passed: 0,
  }),
})

export const CicdTriggerBody = z.object({
  triggerType: z.enum(['cli', 'action', 'api', 'webhook']).default('api'),
  refName: z.string().default(''),
  commitSha: z.string().default(''),
  pullRequestNumber: z.number().int().positive().nullable().optional(),
  agentConclusion: z
    .enum(['passed', 'security_issue_found', 'style_issues_only', 'agent_failed'])
    .default('passed'),
})

export const ConflictResolutionBody = z.object({
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  conflictType: z.string().min(1),
  participants: z.array(z.string()).default([]),
  summary: z.string().optional(),
})

export const ConflictResolveBody = z.object({
  resolution: JsonObjectSchema.default({}),
})

export const ConflictEscalationBody = z.object({
  reason: z.string().optional(),
  forceLevel: z.number().int().min(1).max(5).optional(),
})

export const UpdatePolicyBody = z.object({
  name: z.string().min(1).optional(),
  checkInterval: z.enum(['on_launch', 'daily', 'weekly']).default('daily'),
  channel: z.enum(['stable', 'beta', 'nightly']).default('stable'),
  autoDownload: z.boolean().default(true),
  installOn: z.enum(['on_quit', 'on_idle', 'ask_user', 'scheduled']).default('ask_user'),
  ifAgentsRunning: z
    .enum(['wait_for_completion', 'notify_user', 'force_after_timeout'])
    .default('notify_user'),
  maxWaitMs: z.number().int().positive().default(2 * 60 * 60 * 1000),
  rollbackCrashOnStartup: z.boolean().default(true),
  rollbackAgentSuccessRateDrop: z.number().min(0).max(100).default(20),
})

export const UpdateCheckBody = z.object({
  currentVersion: z.string().min(1).default('0.0.0'),
  availableVersion: z.string().optional(),
  releaseNotes: z.string().optional(),
})

export const MaintenanceWindowBody = z.object({
  reason: z.string().optional(),
  updatePolicyId: z.string().nullable().optional(),
  autoComplete: z.boolean().default(true),
})

export const CompleteMaintenanceWindowBody = z.object({
  force: z.boolean().optional(),
})

export const CustomMetricWeightsSchema = z.object({
  costWeight: z.number().min(0).max(1).optional(),
  speedWeight: z.number().min(0).max(1).optional(),
  qualityWeight: z.number().min(0).max(1).optional(),
  safetyWeight: z.number().min(0).max(1).optional(),
})

export const CustomMetricConstraintsSchema = z.object({
  maxCostPerTask: z.number().nonnegative().optional(),
  maxTimePerTask: z.number().nonnegative().optional(),
  minQualityScore: z.number().min(0).max(100).optional(),
  requireApprovalFor: z.array(z.string()).default([]),
})

export const CustomMetricProfileBody = z.object({
  name: z.string().min(1),
  scope: z.enum(['workspace', 'agent', 'project', 'global']).default('workspace'),
  scopeId: z.string().nullable().optional(),
  optimizationTarget: z
    .enum([
      'minimize_cost',
      'maximize_speed',
      'maximize_quality',
      'maximize_safety',
      'balanced',
      'custom',
    ])
    .default('balanced'),
  weights: CustomMetricWeightsSchema.default({}),
  constraints: CustomMetricConstraintsSchema.default({ requireApprovalFor: [] }),
})

export const CustomMetricEvaluationBody = z.object({
  resourceType: z.string().default('task_estimate'),
  resourceId: z.string().nullable().optional(),
  estimatedCostCents: z.number().nonnegative().default(0),
  estimatedDurationMs: z.number().nonnegative().default(0),
  qualityScore: z.number().min(0).max(100).default(80),
  actionTypes: z.array(z.string()).default([]),
})

export const WorkflowPresetInstallBody = z.object({
  name: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
})

export const WorkflowPresetRunBody = z.object({
  input: JsonObjectSchema.default({}),
})

export const OnboardingWorkTypeBody = z.object({
  workType: z.enum(['coding', 'documentation', 'data', 'browser', 'files', 'other']),
})

export const RealtimeCollabSessionBody = z.object({
  documentPath: z.string().min(1),
  protocol: z.enum(['segment_lock', 'crdt', 'ot']).default('segment_lock'),
  conflictResolution: z.enum(['user_wins', 'agent_wins', 'manual_merge']).default('user_wins'),
  showAgentCursor: z.boolean().optional(),
  showAgentSelection: z.boolean().optional(),
  agentAwareOfUserEdits: z.boolean().optional(),
  createdBy: z.string().nullable().optional(),
})

export const RealtimeSegmentLockBody = z.object({
  sessionId: z.string().min(1),
  employeeRunId: z.string().nullable().optional(),
  agentProfileId: z.string().nullable().optional(),
  participantType: z.enum(['user', 'agent', 'system']),
  participantId: z.string().nullable().optional(),
  filePath: z.string().nullable().optional(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  cursorLine: z.number().int().positive().nullable().optional(),
  cursorColumn: z.number().int().nonnegative().nullable().optional(),
  expiresAt: z.number().int().nullable().optional(),
})

export const RealtimeEditOperationBody = z.object({
  sessionId: z.string().min(1),
  segmentLockId: z.string().nullable().optional(),
  participantType: z.enum(['user', 'agent', 'system']),
  participantId: z.string().nullable().optional(),
  filePath: z.string().nullable().optional(),
  operationKind: z.enum(['insert', 'delete', 'replace']),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  baseVersion: z.number().int().positive(),
  newText: z.string().nullable().optional(),
})

export const MetricPointBody = z.object({
  metricName: z.string().min(1),
  value: z.number(),
  unit: z.string().optional(),
  resourceType: z.string().nullable().optional(),
  resourceId: z.string().nullable().optional(),
  tags: JsonObjectSchema.default({}),
})

export const ExternalMonitoringConfigBody = z.object({
  name: z.string().min(1).max(120),
  metricsEndpoint: z.string().min(1).default('/metrics'),
  healthEndpoint: z.string().min(1).default('/health'),
  readyEndpoint: z.string().min(1).default('/ready'),
  logExport: z
    .object({
      format: z.enum(['json', 'syslog']).default('json'),
      destination: z.enum(['stdout', 'file', 'http', 'elasticsearch']).default('stdout'),
      structured: z.boolean().default(true),
      redactSensitive: z.boolean().default(true),
      target: z.string().nullable().optional(),
    })
    .default({
      format: 'json',
      destination: 'stdout',
      structured: true,
      redactSensitive: true,
      target: null,
    }),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const ArtifactSemanticDiffBody = z.object({
  artifactV1Id: z.string().min(1),
  artifactV2Id: z.string().min(1),
})

export const AlertRuleBody = z.object({
  name: z.string().min(1).max(120),
  metricName: z.string().min(1),
  comparison: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']).default('gte'),
  threshold: z.number(),
  severity: z.enum(['info', 'success', 'warning', 'critical']).default('warning'),
  enabled: z.boolean().optional(),
  cooldownMs: z.number().int().positive().optional(),
})

export const AgentReputationComputeBody = z.object({
  monthLabel: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

export const AgentReputationRefreshBody = AgentReputationComputeBody.extend({
  limit: z.number().int().positive().max(500).optional(),
})

export const AgentReputationReviewBody = z.object({
  taskId: z.string().min(1).optional(),
  employeeRunId: z.string().nullable().optional(),
  userRating: z.number().int().min(1).max(5),
  autoScore: z.number().min(0).max(100).optional(),
  comment: z.string().nullable().optional(),
  reviewer: z.string().optional(),
})

export const ProgrammaticApiKeyBody = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.string()).default(['tasks:write', 'tasks:read']),
})

export const SdkTaskBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  agentName: z.string().nullable().optional(),
  description: z.string().min(1),
  input: JsonObjectSchema.default({}),
  priority: z.number().int().optional(),
  maxBudget: z.number().nonnegative().nullable().optional(),
  maxBudgetCents: z.number().int().nonnegative().nullable().optional(),
  webhookUrl: z.string().nullable().optional(),
})

export const SdkMemoryBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  agentName: z.string().nullable().optional(),
  type: z.enum(['episodic', 'semantic', 'procedural', 'project', 'customer', 'software', 'mistake', 'success']),
  title: z.string().min(1),
  content: z.string().min(1),
  scope: z.enum(['agent', 'project', 'workspace', 'global']).default('agent'),
  confidence: z.number().min(0).max(1).optional(),
  importance: z.number().min(0).max(1).optional(),
})

export const WebhookSubscriptionBody = z.object({
  name: z.string().min(1).max(120),
  url: z.string().min(1),
  events: z
    .array(z.enum(['run.created', 'run.queued', 'run.completed', 'run.failed', 'run.event', 'webhook.test']))
    .default(['run.completed', 'run.failed']),
  secret: z.string().min(1),
  filter: JsonObjectSchema.default({}),
  retry: z
    .object({
      maxRetries: z.number().int().nonnegative().optional(),
      backoffMs: z.number().int().nonnegative().optional(),
    })
    .optional(),
  deliveryMode: z.enum(['record_only', 'http_post']).default('record_only'),
  status: z.enum(['active', 'paused', 'disabled']).default('active'),
})

export const MultimodalInputBody = z.object({
  employeeRunId: z.string().nullable().optional(),
  agentProfileId: z.string().nullable().optional(),
  kind: z.enum(['text', 'image', 'screenshot', 'audio', 'video_frame', 'structured']),
  mimeType: z.string().nullable().optional(),
  source: z.string().optional(),
  dataRef: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  metadata: JsonObjectSchema.default({}),
})

export const MultimodalOutputBody = z.object({
  employeeRunId: z.string().nullable().optional(),
  agentProfileId: z.string().nullable().optional(),
  kind: z.enum(['text', 'code_diff', 'screenshot', 'chart', 'recording', 'report', 'audio_summary']),
  artifactId: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  format: z.string().nullable().optional(),
  data: JsonObjectSchema.default({}),
  metadata: JsonObjectSchema.default({}),
})

export const NotificationBody = z.object({
  channel: z.enum(['in_app', 'desktop_notification', 'email', 'webhook']).default('in_app'),
  level: z.enum(['info', 'success', 'warning', 'critical']).default('info'),
  sourceType: z.string().min(1),
  sourceId: z.string().nullable().optional(),
  title: z.string().min(1),
  message: z.string().optional(),
  payload: JsonObjectSchema.default({}),
})

export const NotificationPreferenceBody = z.object({
  channel: z.enum(['in_app', 'desktop_notification', 'email', 'webhook']),
  enabled: z.boolean().optional(),
  minLevel: z.enum(['info', 'success', 'warning', 'critical']).optional(),
})

export const CapabilitySearchBody = z.object({
  query: z.string().default(''),
  limit: z.number().int().positive().max(50).optional(),
})

export const CapabilityRecommendationBody = z.object({
  goal: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
})

export const AgentContextPreviewBody = z.object({
  goal: z.string().min(1),
  input: JsonObjectSchema.default({}),
  tokenBudget: z.number().int().positive().max(250000).nullable().optional(),
  memoryLimit: z.number().int().positive().max(50).optional(),
})

export const ContextCompressorConfigSchema = z.object({
  triggerThreshold: z.number().positive().max(100).default(0.8),
  strategy: z
    .enum(['summarize_oldest', 'summarize_least_relevant', 'sliding_window', 'hierarchical'])
    .default('hierarchical'),
  preserveAlways: z
    .array(
      z.enum([
        'plan',
        'current_goal',
        'error_log',
        'user_instructions',
        'important_observations',
      ]),
    )
    .default(['plan', 'current_goal', 'error_log', 'user_instructions', 'important_observations']),
  summarizerModel: z.enum(['cheap_local', 'same_model']).default('cheap_local'),
})

export const TokenBudgetAllocationConfigSchema = z.object({
  totalWindow: z.number().int().positive().max(250000).default(128000),
  systemPromptMax: z.number().int().nonnegative().max(250000).default(3000),
  currentPlanMax: z.number().int().nonnegative().max(250000).default(2000),
  relevantMemoriesMax: z.number().int().nonnegative().max(250000).default(3000),
  recentStepSummariesMax: z.number().int().nonnegative().max(250000).default(5000),
  toolDefinitionsMax: z.number().int().nonnegative().max(250000).default(2000),
  safetyMargin: z.number().int().nonnegative().max(250000).default(2000),
  fullRecentStepsCount: z.number().int().nonnegative().max(20).default(3),
})

export const ContextCompressorPolicyBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  name: z.string().min(1).max(160),
  config: ContextCompressorConfigSchema.partial().optional(),
  tokenBudgetConfig: TokenBudgetAllocationConfigSchema.partial().optional(),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const ContextCompressionSectionBody = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(500),
  kind: z.string().max(120).optional(),
  priority: z.number().optional(),
  tokenEstimate: z.number().int().nonnegative().optional(),
  tokenUsed: z.number().int().nonnegative().optional(),
  status: z.enum(['included', 'truncated', 'omitted']).optional(),
  content: z.string().max(200000).optional(),
})

export const ContextCompressionPlanBody = z.object({
  policyId: z.string().nullable().optional(),
  agentProfileId: z.string().nullable().optional(),
  employeeRunId: z.string().nullable().optional(),
  runtimeContextSnapshotId: z.string().nullable().optional(),
  goal: z.string().min(1),
  input: JsonObjectSchema.default({}),
  tokenBudget: z.number().int().positive().max(250000).nullable().optional(),
  tokenEstimate: z.number().int().nonnegative().nullable().optional(),
  memoryLimit: z.number().int().positive().max(50).optional(),
  sections: z.array(ContextCompressionSectionBody).default([]),
})

export const ContextWindowVisualizationBody = z.object({
  agentProfileId: z.string().min(1),
  employeeRunId: z.string().nullable().optional(),
  runtimeContextSnapshotId: z.string().nullable().optional(),
  goal: z.string().min(1),
  input: JsonObjectSchema.default({}),
  tokenBudget: z.number().int().positive().max(250000).nullable().optional(),
  memoryLimit: z.number().int().positive().max(50).optional(),
})

export const ContextWindowActionBody = z.object({
  actionType: z.enum([
    'compress_plan',
    'remove_old_steps',
    'expand_window',
    'compress_memory',
    'trim_tools',
  ]),
})

export const ComputerActionEventBody = z.object({
  actionType: z.string().min(1).max(120),
  target: z.string().nullable().optional(),
  input: JsonObjectSchema.default({}),
  output: JsonObjectSchema.default({}),
  status: z.enum(['planned', 'complete', 'blocked', 'failed']).default('planned'),
})

export const ComputerObservationBody = z.object({
  summary: z.string().min(1).max(1000),
  viewport: JsonObjectSchema.optional(),
  screenshotPath: z.string().nullable().optional(),
  pageUrl: z.string().nullable().optional(),
})

export const ConfigEntityTypeSchema = z.enum([
  'agent_profile',
  'model_profile',
  'network_profile',
  'cli_profile',
  'mcp_server',
  'tool_connection',
  'software_profile',
  'software_command',
  'recorded_macro',
  'workflow',
  'prompt_template',
  'playbook',
])

export const ConfigVersionBody = z.object({
  entityType: ConfigEntityTypeSchema,
  entityId: z.string().min(1),
  source: z.enum(['manual', 'api', 'runtime_snapshot', 'gitops_export']).default('api'),
  changeSummary: z.string().optional(),
  createdBy: z.string().nullable().optional(),
})

export const ConfigVersionApplyBody = z.object({
  appliedBy: z.string().nullable().optional(),
  changeSummary: z.string().optional(),
})

export const ConfigExportBody = z.object({
  name: z.string().min(1).max(120),
  format: z.enum(['json', 'yaml', 'gitops_bundle']).default('gitops_bundle'),
  entityRefs: z
    .array(
      z.object({
        entityType: ConfigEntityTypeSchema,
        entityId: z.string().min(1),
        versionId: z.string().nullable().optional(),
      }),
    )
    .min(1),
})

export const ConfigImpactAnalysisBody = z.object({
  entityType: ConfigEntityTypeSchema,
  entityId: z.string().min(1),
  baseVersionId: z.string().nullable().optional(),
  proposedSnapshot: JsonObjectSchema.nullable().optional(),
})

export const OptimisticEditSessionBody = z.object({
  entityType: ConfigEntityTypeSchema,
  entityId: z.string().min(1),
  editedBy: z.string().nullable().optional(),
})

export const OptimisticEditCommitBody = z.object({
  entityType: ConfigEntityTypeSchema,
  entityId: z.string().min(1),
  baseVersion: z.number().int().positive(),
  proposedSnapshot: JsonObjectSchema,
  changedFields: z.array(z.string()).default([]),
  editedBy: z.string().nullable().optional(),
})

export const EditConflictResolveBody = z.object({
  resolution: z.enum(['overwrite', 'merge', 'discard', 'show_diff']),
  mergedSnapshot: JsonObjectSchema.nullable().optional(),
  resolvedBy: z.string().nullable().optional(),
})

export const ExportPackageBody = z.object({
  packageType: z.enum(['agent_profile', 'workflow', 'skill', 'software_command', 'recorded_macro']),
  sourceEntityId: z.string().min(1),
  name: z.string().optional(),
  author: z.string().nullable().optional(),
  description: z.string().optional(),
  packageVersion: z.string().optional(),
  tags: z.array(z.string()).default([]),
  includes: z
    .object({
      memories: z.boolean().optional(),
      sampleArtifacts: z.boolean().optional(),
      benchmarkResults: z.boolean().optional(),
    })
    .default({
      memories: true,
      sampleArtifacts: true,
      benchmarkResults: true,
    }),
})

export const AutonomyDecisionBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  actionType: z.enum([
    'read_file',
    'write_file',
    'delete_file',
    'run_command',
    'install_dependency',
    'network_request',
    'browser_operation',
    'desktop_operation',
    'software_command',
    'mcp_tool',
    'cli_profile',
    'mobile_operation',
    'login',
    'payment',
    'send_message',
    'system_setting',
  ]),
  resourceType: z.string().min(1),
  resourceId: z.string().nullable().optional(),
  requestedMode: z.string().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  payload: JsonObjectSchema.default({}),
})

export const DynamicPermissionRequestBody = z.object({
  agentProfileId: z.string().min(1),
  employeeRunId: z.string().nullable().optional(),
  permissionKey: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().nullable().optional(),
  duration: z.enum(['single_operation', 'this_step', 'this_task']).default('single_operation'),
  justification: z.string().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  payload: JsonObjectSchema.default({}),
})

export const DynamicPermissionRevokeBody = z.object({
  reason: z.string().optional(),
})

export const DynamicPermissionDowngradeBody = z.object({
  agentProfileId: z.string().optional(),
  employeeRunId: z.string().optional(),
  permissionKeys: z.array(z.string()).default([]),
  reason: z.string().min(1),
})

export const VoiceInterfaceProfileBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  input: z
    .object({
      mode: z.enum(['push_to_talk', 'always_listening', 'wake_word']).default('push_to_talk'),
      wakeWord: z.string().nullable().optional(),
      language: z.string().min(2).default('en-US'),
      speakerIdentification: z.boolean().default(false),
    })
    .default({
      mode: 'push_to_talk',
      language: 'en-US',
      speakerIdentification: false,
    }),
  output: z
    .object({
      ttsEngine: z.enum(['system', 'openai_tts', 'elevenlabs', 'custom']).default('system'),
      voice: z.string().default('default'),
      speed: z.number().positive().max(3).default(1),
      speakOn: z
        .array(z.enum(['task_complete', 'approval_needed', 'error', 'milestone']))
        .default(['approval_needed', 'task_complete']),
    })
    .default({
      ttsEngine: 'system',
      voice: 'default',
      speed: 1,
      speakOn: ['approval_needed', 'task_complete'],
    }),
  conversationPolicy: JsonObjectSchema.default({}),
  status: z.enum(['draft', 'active', 'disabled']).default('active'),
})

export const VoiceConversationTurnBody = z.object({
  voiceInterfaceProfileId: z.string().nullable().optional(),
  agentProfileId: z.string().nullable().optional(),
  speaker: z.enum(['user', 'agent', 'system']),
  speakerLabel: z.string().optional(),
  text: z.string().min(1),
  language: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(['captured', 'planned', 'delivered']).default('captured'),
  metadata: JsonObjectSchema.default({}),
})

export const E2EEncryptionPolicyBody = z.object({
  name: z.string().min(1).max(120),
  localIPC: z
    .object({
      encryption: z.enum(['none', 'tls_local']).default('none'),
    })
    .default({ encryption: 'none' }),
  remoteCommunication: z
    .object({
      encryption: z.literal('tls_1_3').default('tls_1_3'),
      certificatePinning: z.boolean().default(true),
      mutualTLS: z.boolean().default(false),
    })
    .default({
      encryption: 'tls_1_3',
      certificatePinning: true,
      mutualTLS: false,
    }),
  dataExport: z
    .object({
      encryptExport: z.boolean().default(true),
      passwordProtected: z.boolean().default(true),
    })
    .default({
      encryptExport: true,
      passwordProtected: true,
    }),
  notes: z.string().optional(),
  status: z.enum(['draft', 'active', 'disabled']).default('active'),
})

export const E2EEncryptionCheckBody = z.object({
  policyId: z.string().min(1),
  scope: z.enum(['local_ipc', 'remote_communication', 'data_export']),
  resourceType: z.string().min(1),
  resourceId: z.string().nullable().optional(),
  observed: JsonObjectSchema.default({}),
})

export const ConcurrencyProfileBody = z.object({
  name: z.string().min(1).max(120),
  theoreticalMax: z
    .object({
      maxProcesses: z.number().int().positive().default(64),
      maxFileDescriptors: z.number().int().positive().default(1024),
      maxMemoryBytes: z.number().int().positive().default(8 * 1024 * 1024 * 1024),
      maxBrowserInstances: z.number().int().positive().default(3),
      maxModelConnections: z.number().int().positive().default(8),
    })
    .default({
      maxProcesses: 64,
      maxFileDescriptors: 1024,
      maxMemoryBytes: 8 * 1024 * 1024 * 1024,
      maxBrowserInstances: 3,
      maxModelConnections: 8,
    }),
  recommended: z
    .object({
      lowMemory: z.object({ maxAgents: z.number().int().positive(), maxBrowsers: z.number().int().positive() }).default({ maxAgents: 2, maxBrowsers: 1 }),
      midMemory: z.object({ maxAgents: z.number().int().positive(), maxBrowsers: z.number().int().positive() }).default({ maxAgents: 5, maxBrowsers: 3 }),
      highMemory: z.object({ maxAgents: z.number().int().positive(), maxBrowsers: z.number().int().positive() }).default({ maxAgents: 10, maxBrowsers: 6 }),
      workstation: z.object({ maxAgents: z.number().int().positive(), maxBrowsers: z.number().int().positive() }).default({ maxAgents: 20, maxBrowsers: 12 }),
    })
    .default({
      lowMemory: { maxAgents: 2, maxBrowsers: 1 },
      midMemory: { maxAgents: 5, maxBrowsers: 3 },
      highMemory: { maxAgents: 10, maxBrowsers: 6 },
      workstation: { maxAgents: 20, maxBrowsers: 12 },
    }),
  adaptiveLimit: z.boolean().default(true),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const ConcurrencyEvaluationBody = z.object({
  concurrencyProfileId: z.string().min(1),
  currentAgents: z.number().int().min(0).default(0),
  currentBrowsers: z.number().int().min(0).default(0),
  currentModelConnections: z.number().int().min(0).default(0),
  totalMemoryBytes: z.number().int().positive().optional(),
  usedMemoryBytes: z.number().int().min(0).optional(),
})

export const AbusePreventionPolicyBody = z.object({
  name: z.string().min(1).max(120),
  detectionRules: z
    .object({
      agentCreationBurst: z
        .object({
          max: z.number().int().positive().default(10),
          windowMs: z.number().int().positive().default(60 * 60 * 1000),
        })
        .default({ max: 10, windowMs: 60 * 60 * 1000 }),
      outboundRequestBurst: z
        .object({
          max: z.number().int().positive().default(100),
          windowMs: z.number().int().positive().default(60 * 1000),
        })
        .default({ max: 100, windowMs: 60 * 1000 }),
      scrapingDetection: z
        .object({
          maxRequestsPerDomain: z.number().int().positive().default(30),
        })
        .default({ maxRequestsPerDomain: 30 }),
      spamDetection: z
        .object({
          similarOutputRatio: z.number().min(0).max(1).default(0.85),
        })
        .default({ similarOutputRatio: 0.85 }),
      intrusionAttempt: z
        .object({
          pattern: z.array(z.string()).default([
            'bypass approval',
            'steal token',
            'ignore previous instructions',
          ]),
        })
        .default({
          pattern: ['bypass approval', 'steal token', 'ignore previous instructions'],
        }),
    })
    .default({
      agentCreationBurst: { max: 10, windowMs: 60 * 60 * 1000 },
      outboundRequestBurst: { max: 100, windowMs: 60 * 1000 },
      scrapingDetection: { maxRequestsPerDomain: 30 },
      spamDetection: { similarOutputRatio: 0.85 },
      intrusionAttempt: {
        pattern: ['bypass approval', 'steal token', 'ignore previous instructions'],
      },
    }),
  onAbuseDetected: z
    .object({
      light: z.literal('warn_user').default('warn_user'),
      moderate: z.literal('pause_agent_and_warn').default('pause_agent_and_warn'),
      severe: z.literal('stop_and_quarantine_agent').default('stop_and_quarantine_agent'),
      critical: z.literal('stop_all_and_notify_admin').default('stop_all_and_notify_admin'),
    })
    .default({
      light: 'warn_user',
      moderate: 'pause_agent_and_warn',
      severe: 'stop_and_quarantine_agent',
      critical: 'stop_all_and_notify_admin',
    }),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const AbuseDetectionBody = z.object({
  policyId: z.string().min(1),
  agentProfileId: z.string().nullable().optional(),
  employeeRunId: z.string().nullable().optional(),
  signals: z
    .object({
      agentCreations: z.number().int().min(0).default(0),
      outboundRequests: z.array(z.object({ domain: z.string().min(1) })).default([]),
      generatedOutputs: z.array(z.string()).default([]),
      intrusionText: z.string().default(''),
      unauthorizedAccessAttempts: z.number().int().min(0).default(0),
    })
    .default({
      agentCreations: 0,
      outboundRequests: [],
      generatedOutputs: [],
      intrusionText: '',
      unauthorizedAccessAttempts: 0,
    }),
})

export const AbuseAppealBody = z.object({
  abuseDetectionEventId: z.string().min(1),
  agentProfileId: z.string().nullable().optional(),
  reason: z.string().min(1),
})

export const AbuseAppealReviewBody = z.object({
  approved: z.boolean(),
  reviewNote: z.string().optional(),
})

export const FutureTechCapabilityKindSchema = z.enum([
  'compute_provider',
  'computer_use',
  'reinforcement_learning',
  'model_router',
  'os_integration',
  'organization_service',
  'proactive_agent',
])

export const FutureTechInterfaceBody = z.object({
  capabilityKind: FutureTechCapabilityKindSchema,
  displayName: z.string().min(1).max(120),
  abstractionName: z.string().min(1).max(120),
  description: z.string().default(''),
  reservedMethods: z.array(z.string().min(1)).default([]),
  safetyBoundary: z.string().default(''),
  localFirst: z.boolean().default(true),
  readiness: z.enum(['planned', 'reserved', 'experimental', 'ready']).default('reserved'),
})

export const FutureTechRadarItemBody = z.object({
  stage: z.enum(['v1_now', 'v2_near', 'v3_mid', 'v4_far']),
  title: z.string().min(1).max(160),
  description: z.string().default(''),
  capabilityKinds: z.array(FutureTechCapabilityKindSchema).default([]),
  dependencies: z.array(z.string()).default([]),
  status: z.enum(['planned', 'in_progress', 'available', 'blocked']).default('planned'),
})

export const CommercialPlanBody = z.object({
  planKey: z.enum(['community', 'professional', 'team', 'enterprise']),
  name: z.string().min(1).max(120),
  priceCents: z.number().int().min(0).nullable().optional(),
  currency: z.string().min(3).max(8).default('USD'),
  billingPeriod: z.enum(['free', 'monthly', 'per_user_monthly', 'custom']),
  maxAgents: z.number().int().positive().nullable().optional(),
  maxConcurrentRuns: z.number().int().positive().nullable().optional(),
  features: z.array(z.string()).default([]),
  limits: JsonObjectSchema.default({}),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const RevenueStreamBody = z.object({
  streamType: z.enum([
    'subscription',
    'enterprise_service',
    'marketplace_commission',
    'compute_resale',
    'certification',
  ]),
  name: z.string().min(1).max(120),
  priority: z.number().int().min(1).default(100),
  description: z.string().default(''),
  commissionRateBps: z.number().int().min(0).max(10000).nullable().optional(),
  status: z.enum(['active', 'future', 'disabled']).default('active'),
})

export const CommercialPolicyRuleBody = z.object({
  ruleType: z.enum(['allowed_revenue', 'forbidden_practice']),
  title: z.string().min(1).max(160),
  description: z.string().default(''),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const OpenSourceComponentBody = z.object({
  layer: z.enum(['core_mit', 'plus_commercial', 'community_author']),
  name: z.string().min(1).max(120),
  scope: z.string().default(''),
  license: z.string().min(1).max(120),
  sourceVisibility: z.string().default('source_visible'),
  commercialUse: z.string().default('allowed'),
  authorPolicy: z.string().default(''),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const CommunityGovernanceRoleBody = z.object({
  roleType: z.enum(['maintainer', 'contributor', 'community_manager', 'plugin_author']),
  name: z.string().min(1).max(120),
  responsibilities: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const GovernanceRfcDecisionBody = z.object({
  title: z.string().min(1).max(180),
  summary: z.string().default(''),
  proposer: z.string().default(''),
  discussionUrl: z.string().nullable().optional(),
})

export const GovernanceRfcAdvanceBody = z.object({
  status: z.enum(['rfc', 'discussion', 'maintainer_vote', 'implementation', 'accepted', 'rejected']),
  discussionUrl: z.string().nullable().optional(),
  votesFor: z.number().int().min(0).optional(),
  votesAgainst: z.number().int().min(0).optional(),
  implementationNotes: z.string().optional(),
})

export const ContributorPrerequisiteBody = z.object({
  tool: z.enum(['node', 'rust', 'python', 'git', 'chrome']),
  minimumVersion: z.string().default(''),
  required: z.boolean().default(true),
  installHint: z.string().default(''),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const ContributionPolicyBody = z.object({
  policyType: z.enum([
    'getting_started',
    'project_structure',
    'commit_convention',
    'branch_rule',
    'review_rule',
  ]),
  key: z.string().min(1).max(120),
  description: z.string().default(''),
  required: z.boolean().default(true),
  metadata: JsonObjectSchema.default({}),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const ContributorEnvironmentBody = z.object({
  nodeVersion: z.string().optional(),
  rustVersion: z.string().optional(),
  pythonVersion: z.string().optional(),
  hasGit: z.boolean().default(false),
  hasChrome: z.boolean().default(false),
})

export const ArchitecturePatternBody = z.object({
  patternKey: z.enum([
    'event_bus',
    'command',
    'strategy',
    'observer',
    'responsibility_chain',
    'repository',
    'factory',
    'state',
  ]),
  name: z.string().min(1).max(120),
  description: z.string().default(''),
  appliedTo: z.array(z.string()).default([]),
  required: z.boolean().default(true),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const ArchitectureInterfaceBody = z.object({
  interfaceName: z.string().min(1).max(120),
  responsibility: z.string().default(''),
  reservedMethods: z.array(z.string()).default([]),
  ownerService: z.string().default(''),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const ErrorCodeCategorySchema = z.enum(['M', 'T', 'A', 'W', 'R', 'F', 'S', 'N', 'SY'])

export const ErrorCodeCatalogEntryBody = z.object({
  code: z
    .string()
    .regex(/^RX-(M|T|A|W|R|F|S|N|SY)-\d{3}$/)
    .optional(),
  category: ErrorCodeCategorySchema,
  numericCode: z.string().regex(/^\d{3}$/),
  title: z.string().min(1).max(120),
  description: z.string().default(''),
  severity: z.enum(['info', 'warning', 'error', 'critical']).default('error'),
  retryable: z.boolean().default(false),
  remediation: z.string().default(''),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const EntityStateMachineTypeSchema = z.enum(['agent', 'task_run', 'workflow', 'memory', 'skill'])

export const EntityStateMachineBody = z.object({
  entityType: EntityStateMachineTypeSchema,
  name: z.string().min(1).max(120),
  description: z.string().default(''),
  states: z.array(z.string().min(1)).min(1),
  initialState: z.string().min(1),
  terminalStates: z.array(z.string().min(1)).default([]),
  errorState: z.string().nullable().optional(),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const EntityStateTransitionBody = z.object({
  machineId: z.string().min(1),
  entityType: EntityStateMachineTypeSchema,
  fromState: z.string().min(1),
  toState: z.string().min(1),
  trigger: z.string().default(''),
  reversible: z.boolean().default(false),
  description: z.string().default(''),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const EntityStateTransitionEvaluationBody = z.object({
  entityType: EntityStateMachineTypeSchema,
  fromState: z.string().min(1),
  toState: z.string().min(1),
})

export const AgentCommunicationProtocolBody = z.object({
  version: z.string().min(1).max(32).default('1.0'),
  name: z.string().min(1).max(120),
  description: z.string().default(''),
  requiredTopLevelFields: z.array(z.string()).default([
    'version',
    'messageId',
    'timestamp',
    'ttl',
    'header',
    'body',
  ]),
  headerFields: z.array(z.string()).default(['from', 'to', 'type', 'priority', 'replyTo']),
  bodyFields: z.array(z.string()).default(['intent', 'detail', 'context', 'proposedAction']),
  contextFields: z.array(z.string()).default(['artifacts', 'memories', 'files']),
  supportsSignature: z.boolean().default(true),
  defaultTtlMs: z.number().int().positive().default(3600000),
  status: z.enum(['draft', 'active', 'deprecated']).default('active'),
})

export const AgentProtocolMessageBody = z.object({
  protocolId: z.string().optional(),
  version: z.string().min(1).max(32).default('1.0'),
  messageId: z.string().optional(),
  timestamp: z.number().int().positive().optional(),
  ttl: z.number().int().positive().default(3600000),
  header: z.object({
    from: z.string().min(1),
    to: z.string().min(1).nullable().optional(),
    type: z.enum(['status', 'handoff', 'question', 'artifact', 'warning', 'request', 'response', 'proposal']),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    replyTo: z.string().nullable().optional(),
  }),
  body: z.object({
    intent: z.string().min(1),
    detail: z.string().default(''),
    context: z
      .object({
        artifacts: z.array(z.string()).default([]),
        memories: z.array(z.string()).default([]),
        files: z.array(z.string()).default([]),
      })
      .default({ artifacts: [], memories: [], files: [] }),
    proposedAction: JsonObjectSchema.nullable().optional(),
  }),
  signature: z.string().nullable().optional(),
})

export const CapabilityNegotiationStrategySchema = z.enum([
  'find_alternative',
  'request_skill_install',
  'delegate_to_peer',
  'degrade_task',
  'refuse_task',
])

export const CapabilityNegotiationStrategiesBody = z.object({
  findAlternative: z.boolean().default(true),
  requestSkillInstall: z.boolean().default(true),
  delegateToPeer: z.boolean().default(true),
  degradeTask: z.boolean().default(true),
  refuseTask: z.boolean().default(true),
})

export const CapabilityNegotiationBody = z.object({
  requesterAgentProfileId: z.string().min(1),
  workflowRunId: z.string().nullable().optional(),
  employeeRunId: z.string().nullable().optional(),
  taskGoal: z.string().min(1).max(2000),
  requiredCapabilities: z.array(z.string().min(1)).min(1),
  availableCapabilities: z.array(z.string().min(1)).optional(),
  strategies: CapabilityNegotiationStrategiesBody.optional(),
  candidateAgentProfileIds: z.array(z.string().min(1)).optional(),
})

export const CapabilityNegotiationResolutionBody = z.object({
  strategy: CapabilityNegotiationStrategySchema,
  explanation: z.string().max(2000).optional(),
  installRequest: z
    .object({
      skillName: z.string().min(1).max(160),
      reason: z.string().min(1).max(1000),
      riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
    })
    .optional(),
  delegation: z
    .object({
      toAgentId: z.string().min(1),
      subtask: z.string().min(1).max(2000),
      expectedResult: z.string().min(1).max(1000),
    })
    .optional(),
  alternative: z
    .object({
      capability: z.string().min(1),
      substituteWith: z.string().min(1),
      limitation: z.string().default(''),
    })
    .optional(),
  degradedScope: z
    .object({
      canDo: z.array(z.string()).default([]),
      cannotDo: z.array(z.string()).default([]),
    })
    .optional(),
})

export const DecisionRollbackScopeBody = z.object({
  fileChanges: z.boolean().default(true),
  memoryChanges: z.boolean().default(true),
  cascadeToPeers: z.boolean().default(true),
  knowledgeGraphChanges: z.boolean().default(true),
})

export const DecisionRollbackBody = z.object({
  employeeRunId: z.string().min(1),
  targetDecisionId: z.string().min(1).optional(),
  granularity: z
    .enum(['single_decision', 'step_decisions', 'from_decision_onwards'])
    .default('from_decision_onwards'),
  rollback: DecisionRollbackScopeBody.default({
    fileChanges: true,
    memoryChanges: true,
    cascadeToPeers: true,
    knowledgeGraphChanges: true,
  }),
  reason: z.object({
    type: z.enum(['user_requested', 'incorrect_outcome', 'based_on_wrong_memory', 'cascading_failure']),
    description: z.string().min(1).max(2000),
    timestamp: z.number().int().positive().optional(),
  }),
  applyImmediately: z.boolean().default(false),
})

export const DecisionRollbackApplyBody = z.object({
  note: z.string().max(2000).optional(),
})

export const WorkflowOptimizationAutoApplyBody = z.object({
  enabled: z.boolean().default(false),
  riskThreshold: z.enum(['low', 'medium']).default('low'),
  requireApprovalFor: z.enum(['medium', 'high']).default('medium'),
})

export const WorkflowOptimizationBody = z.object({
  workflowId: z.string().min(1),
  autoApply: WorkflowOptimizationAutoApplyBody.default({
    enabled: false,
    riskThreshold: 'low',
    requireApprovalFor: 'medium',
  }),
})

export const WorkflowOptimizationApplyBody = z.object({
  riskThreshold: z.enum(['low', 'medium']).default('low'),
})

const WeekdayNameSchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
])

const AgentWorkingDayScheduleSchema = z.object({
  active: z.boolean(),
  start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  allDay: z.boolean().optional(),
})

export const AgentScheduleBody = z.object({
  agentProfileId: z.string().min(1),
  timezone: z.string().min(1).default('UTC'),
  weeklySchedule: z.record(WeekdayNameSchema, AgentWorkingDayScheduleSchema),
  maintenanceWindows: z
    .array(
      z.object({
        day: WeekdayNameSchema,
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
        reason: z.string().min(1).max(500),
      }),
    )
    .default([]),
  overtimePolicy: z
    .object({
      acceptTasksOutsideHours: z.boolean().default(false),
      maxOvertimePerDay: z.string().default('0h'),
      notifyOnOvertime: z.boolean().default(true),
      urgentTasksBypassRestriction: z.boolean().default(true),
    })
    .default({
      acceptTasksOutsideHours: false,
      maxOvertimePerDay: '0h',
      notifyOnOvertime: true,
      urgentTasksBypassRestriction: true,
    }),
  vacationMode: z
    .object({
      enabled: z.boolean().default(false),
      startDate: z.number().int().nullable().optional(),
      endDate: z.number().int().nullable().optional(),
      behavior: z.enum(['reject_all_tasks', 'queue_tasks', 'delegate_to_backup']).default('queue_tasks'),
      backupAgentId: z.string().nullable().optional(),
    })
    .default({
      enabled: false,
      startDate: null,
      endDate: null,
      behavior: 'queue_tasks',
      backupAgentId: null,
    }),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const AgentScheduleEvaluationBody = z.object({
  at: z.number().int().positive().optional(),
  urgent: z.boolean().default(false),
  estimatedDurationMinutes: z.number().positive().optional(),
})

export const AgentCertificationRubricBody = z.object({
  correctness: z.number().nonnegative().max(100),
  efficiency: z.number().nonnegative().max(100),
  codeStyle: z.number().nonnegative().max(100),
  safetyAwareness: z.number().nonnegative().max(100),
})

export const AgentCertificationTaskBody = z.object({
  taskId: z.string().min(1),
  description: z.string().min(1),
  expectedOutput: z.unknown(),
  scoringRubric: AgentCertificationRubricBody,
})

export const AgentCertificationExamBody = z.object({
  name: z.string().min(1).max(160),
  description: z.string().default(''),
  tasks: z.array(AgentCertificationTaskBody).min(1),
  passingScore: z.number().min(0).max(100).default(80),
  validityPeriod: z.enum(['6m', '1y', 'permanent']).default('1y'),
  level: z.enum(['basic', 'intermediate', 'advanced', 'expert']).default('basic'),
  status: z.enum(['active', 'archived']).default('active'),
})

export const AgentCertificationSubmissionBody = z.object({
  taskId: z.string().min(1),
  output: z.unknown(),
  durationMs: z.number().int().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
})

export const AgentCertificationRunBody = z.object({
  agentProfileId: z.string().min(1),
  submissions: z.array(AgentCertificationSubmissionBody).default([]),
})

export const ToolProtocolManifestBody = z.object({
  name: z.string().min(1).max(160),
  description: z.string().default(''),
  source: z.enum(['mcp', 'cli', 'software', 'api', 'internal']),
  inputSchema: JsonObjectSchema.default({}),
  attributes: z.object({
    idempotent: z.boolean().default(false),
    readOnly: z.boolean().default(false),
    destructive: z.boolean().default(false),
    longRunning: z.boolean().default(false),
    requiresApproval: z.boolean().default(true),
    riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  }),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const ToolProtocolInvocationBody = z.object({
  manifestId: z.string().min(1),
  callId: z.string().optional(),
  toolName: z.string().min(1).max(160),
  arguments: JsonObjectSchema.default({}),
  idempotencyKey: z.string().nullable().optional(),
  status: z.enum(['created', 'running', 'succeeded', 'failed']).default('created'),
})

export const ToolProtocolResultBody = z.object({
  invocationId: z.string().min(1),
  callId: z.string().min(1),
  success: z.boolean(),
  data: JsonObjectSchema.nullable().optional(),
  error: JsonObjectSchema.nullable().optional(),
  metadata: JsonObjectSchema.default({}),
})

export const StreamProtocolChannelBody = z.object({
  stream: z.string().min(1).max(200),
  description: z.string().default(''),
  primaryTransport: z.enum(['websocket', 'sse']).default('websocket'),
  fallbackTransport: z.enum(['websocket', 'sse']).default('sse'),
  replayRetentionMs: z.number().int().positive().default(3600000),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const StreamProtocolEventBody = z.object({
  stream: z.string().min(1),
  messageType: z.enum(['event', 'request', 'response', 'error', 'ping', 'pong']),
  data: JsonObjectSchema.default({}),
})

export const StreamReplayCursorBody = z.object({
  stream: z.string().min(1),
  clientId: z.string().min(1),
  lastSequence: z.number().int().min(0).default(0),
  transport: z.enum(['websocket', 'sse']).default('sse'),
  disconnectedAt: z.number().int().nullable().optional(),
})

export const PromptEngineeringGuideBody = z.object({
  name: z.string().min(1).max(160),
  description: z.string().default(''),
  recommendedSections: z.array(z.string()).min(1),
  requiredPlaceholders: z.array(z.string()).default([]),
  maxTokens: z.number().int().positive().default(3000),
  examplePolicy: z.string().default('specific_examples_with_positive_negative_pairs'),
  mustRulePhrase: z.string().default('你必须'),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const PromptAntiPatternRuleBody = z.object({
  guideId: z.string().min(1),
  ruleKey: z.enum([
    'too_long',
    'contradictory_instruction',
    'vague_language',
    'internal_jargon',
    'missing_examples',
    'missing_must_rules',
  ]),
  description: z.string().default(''),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  detectorHint: z.string().default(''),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const PromptGuideEvaluationBody = z.object({
  guideId: z.string().optional(),
  prompt: z.string().min(1),
})

export const ApprovalResponseBody = z.object({
  response: JsonObjectSchema.default({}),
})

export const HumanApprovalPolicyConfigBody = z.object({
  timeoutSeconds: z.number().int().positive().max(604800).default(3600),
  onTimeout: z
    .enum(['auto_reject', 'auto_approve', 'keep_waiting', 'escalate_to_admin'])
    .default('keep_waiting'),
  batching: z
    .object({
      enabled: z.boolean().default(false),
      maxBatchSize: z.number().int().positive().max(500).default(10),
      maxWaitSeconds: z.number().int().nonnegative().max(86400).default(120),
      mergeSimilar: z.boolean().default(true),
    })
    .default({
      enabled: false,
      maxBatchSize: 10,
      maxWaitSeconds: 120,
      mergeSimilar: true,
    }),
  autoApproveConditions: z
    .array(
      z.object({
        condition: z.string().min(1).max(500),
        maxAutoApprovalsPerRun: z.number().int().nonnegative().max(100).default(1),
      }),
    )
    .default([]),
  escalationChain: z
    .array(
      z.object({
        level: z.number().int().positive().max(20),
        approver: z.enum(['user', 'admin', 'project_owner', 'external']),
        escalateAfterSeconds: z.number().int().nonnegative().max(604800),
      }),
    )
    .default([{ level: 1, approver: 'user', escalateAfterSeconds: 0 }]),
})

export const HumanApprovalPolicyBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  workflowId: z.string().nullable().optional(),
  name: z.string().min(1).max(160),
  config: HumanApprovalPolicyConfigBody.partial().default({}),
  status: z.enum(['active', 'disabled']).default('active'),
})

export const HumanApprovalPolicyEvaluationBody = z.object({
  facts: JsonObjectSchema.default({}),
  requestedAt: z.number().int().nullable().optional(),
  elapsedSeconds: z.number().int().nonnegative().nullable().optional(),
  autoApprovalsUsedInRun: z.number().int().nonnegative().default(0),
  approvalType: z.string().nullable().optional(),
})

export const PlanApprovalResultBody = z.object({
  approvalRequestId: z.string().nullable().optional(),
  agentProfileId: z.string().nullable().optional(),
  employeeRunId: z.string().nullable().optional(),
  workflowRunId: z.string().nullable().optional(),
  planId: z.string().nullable().optional(),
  stepDecisions: z
    .array(
      z.object({
        stepId: z.string().min(1).max(160),
        decision: z.enum(['approved', 'rejected', 'modified', 'skipped']),
        modification: z.string().max(5000).optional(),
        reason: z.string().max(1000).optional(),
      }),
    )
    .min(1),
  overallDecision: z.enum(['approved_with_changes', 'rejected', 'approved']).optional(),
  summary: z.string().max(2000).optional(),
})

export const TakeoverSessionBody = z.object({
  runId: z.string().nullable().optional(),
  agentProfileId: z.string().nullable().optional(),
  stepId: z.string().min(1).max(160),
  resource: z.enum(['browser', 'desktop', 'cli', 'file_editor']),
  observation: JsonObjectSchema.default({}),
})

export const TakeoverActionBody = z.object({
  type: z.enum(['click', 'type', 'scroll', 'navigate', 'run_command', 'edit_file']),
  payload: JsonObjectSchema.default({}),
  timestamp: z.number().int().positive().optional(),
})

export const TakeoverCompleteBody = z.object({
  status: z.enum(['completed', 'cancelled']).default('completed'),
  observation: JsonObjectSchema.default({}),
})

export const LearningReviewBody = z.object({
  reviewerNote: z.string().optional(),
})

export const MemoryItemBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  scope: z.enum(['agent', 'project', 'workspace', 'global']),
  type: z.enum([
    'episodic',
    'semantic',
    'procedural',
    'project',
    'customer',
    'software',
    'mistake',
    'success',
  ]),
  title: z.string().min(1).max(160),
  content: z.string().min(1),
  sourceRunId: z.string().nullable().optional(),
  embedding: z.array(z.number()).nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
  importance: z.number().min(0).max(1).optional(),
  expiresAt: z.number().int().nullable().optional(),
  readAccess: z
    .enum(['only_me', 'my_team', 'my_role', 'project', 'organization', 'user_only'])
    .optional(),
  writeAccess: z.enum(['only_me', 'user', 'team_lead']).optional(),
  encryption: z.enum(['none', 'at_rest', 'always_encrypted']).optional(),
  containsDataTypes: z
    .array(
      z.enum(['pii', 'credentials', 'business_secret', 'customer_data', 'internal_only', 'public_ok']),
    )
    .default([]),
})

export const MemoryItemPatchBody = MemoryItemBody.partial().extend({
  title: z.string().min(1).max(160).optional(),
  content: z.string().min(1).optional(),
})

export const MemoryGraphViewBody = z.object({
  name: z.string().min(1).max(160).default('Memory Graph'),
  agentProfileId: z.string().nullable().optional(),
  focusAgentProfileId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  layout: z.enum(['force', 'hierarchical']).default('force'),
  includeExpired: z.boolean().default(false),
  filters: z
    .object({
      scope: z.enum(['agent', 'project', 'workspace', 'global']).optional(),
      type: z
        .enum([
          'episodic',
          'semantic',
          'procedural',
          'project',
          'customer',
          'software',
          'mistake',
          'success',
        ])
        .optional(),
      query: z.string().optional(),
      limit: z.number().int().positive().max(300).optional(),
    })
    .default({}),
})

export const MemoryGraphExportBody = z.object({
  format: z.enum(['json', 'graphml_manifest']).default('json'),
})

export const MemoryDecaySnapshotBody = z.object({
  name: z.string().min(1).max(160).default('Memory Decay View'),
  agentProfileId: z.string().nullable().optional(),
  includeExpired: z.boolean().default(false),
  horizonDays: z.number().int().positive().max(3650).default(180),
  staleAfterDays: z.number().int().positive().max(3650).default(45),
  expiringSoonDays: z.number().int().positive().max(3650).default(30),
  pinnedImportanceThreshold: z.number().min(0).max(1).default(0.95),
  filters: z
    .object({
      scope: z.enum(['agent', 'project', 'workspace', 'global']).optional(),
      type: z
        .enum([
          'episodic',
          'semantic',
          'procedural',
          'project',
          'customer',
          'software',
          'mistake',
          'success',
        ])
        .optional(),
      query: z.string().optional(),
      limit: z.number().int().positive().max(500).optional(),
    })
    .default({}),
})

export const MemoryDecayActionBody = z.object({
  memoryItemId: z.string().min(1),
  action: z.enum(['pin', 'delete_now', 'update_content']),
  confirm: z.boolean().default(false),
  patch: z
    .object({
      title: z.string().min(1).max(160).optional(),
      content: z.string().min(1).optional(),
      importance: z.number().min(0).max(1).optional(),
      expiresAt: z.number().int().nullable().optional(),
    })
    .default({}),
})

export const AgentDiaryEntryBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  employeeRunId: z.string().nullable().optional(),
  workflowRunId: z.string().nullable().optional(),
  entryType: z
    .enum(['run_summary', 'handoff', 'lesson', 'blocker', 'next_step'])
    .default('run_summary'),
  title: z.string().min(1).max(160),
  content: z.string().min(1),
  nextActions: z.array(z.string()).default([]),
  blockers: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  importance: z.number().min(0).max(1).optional(),
})

export const ContinuationPlanBody = z.object({
  agentProfileId: z.string().nullable().optional(),
  sourceRunId: z.string().nullable().optional(),
  workflowRunId: z.string().nullable().optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'canceled']).default('open'),
  title: z.string().min(1).max(160),
  summary: z.string().min(1),
  nextSteps: z.array(z.string()).default([]),
  resumeInput: JsonObjectSchema.default({}),
  requiredCapabilityRefs: z.array(JsonObjectSchema).default([]),
  dueAt: z.number().int().nullable().optional(),
})

export const ContinuationPlanStatusBody = z.object({
  status: z.enum(['open', 'in_progress', 'completed', 'canceled']),
})

export const AgentRetirementPlanBody = z.object({
  agentProfileId: z.string().min(1),
  targetAgentProfileId: z.string().nullable().optional(),
  status: z
    .enum(['draft', 'ready_for_review', 'completed', 'canceled'])
    .default('ready_for_review'),
  taskHandling: JsonObjectSchema.default({}),
  knowledgeExtraction: JsonObjectSchema.default({}),
  cleanupPolicy: JsonObjectSchema.default({}),
})

export const KnowledgeTransferPackageBody = z.object({
  fromAgentProfileId: z.string().min(1),
  toAgentProfileId: z.string().min(1),
  retirementPlanId: z.string().nullable().optional(),
  receiverHandling: z
    .enum(['accept_all', 'review_each', 'accept_high_confidence'])
    .default('review_each'),
  transferItems: JsonObjectSchema.default({}),
})

export const OrganizationalKnowledgeBuildBody = z.object({
  source: z.enum(['all_agents', 'specific_project', 'specific_role']).default('all_agents'),
  sourceRef: z.string().nullable().optional(),
  periodStartAt: z.number().int().nullable().optional(),
  periodEndAt: z.number().int().nullable().optional(),
  minFrequency: z.number().int().positive().optional(),
  promoteCandidates: z.boolean().optional(),
})

export const MetaAgentProfileBody = z.object({
  name: z.string().min(1).max(120).optional(),
  responsibilities: z.array(z.enum([
    'monitor_all_agents_health',
    'suggest_agent_optimizations',
    'resolve_inter_agent_conflicts',
    'route_incoming_tasks',
    'detect_anomalies',
    'generate_daily_digest',
    'manage_resource_allocation',
    'onboard_new_agents',
    'retire_underperforming_agents',
  ])).optional(),
  specialCapabilities: JsonObjectSchema.default({}),
  restrictions: JsonObjectSchema.default({}),
  scheduleLocalTime: z.string().max(20).optional(),
})

export const MetaAgentDigestBody = z.object({
  metaAgentProfileId: z.string().nullable().optional(),
  now: z.number().int().optional(),
  budgetLimitCents: z.number().int().nonnegative().nullable().optional(),
})

export const MetaAgentRecommendationStatusBody = z.object({
  status: z.enum(['open', 'approved', 'dismissed', 'applied']),
})

export const ContinuationPlanEnqueueBody = z.object({
  queueId: z.string().min(1),
  priority: z.number().int().optional(),
  scheduledAt: z.number().int().optional(),
  budgetLimitCents: z.number().int().nonnegative().nullable().optional(),
  autoComplete: z.boolean().optional(),
  goal: z.string().min(1).optional(),
  input: JsonObjectSchema.default({}),
})

export const EnqueueDueContinuationPlansBody = z.object({
  queueId: z.string().min(1),
  now: z.number().int().optional(),
  limit: z.number().int().positive().max(500).optional(),
  priority: z.number().int().optional(),
  budgetLimitCents: z.number().int().nonnegative().nullable().optional(),
})

export const EmployeeRunBody = z.object({
  goal: z.string().min(1),
  input: JsonObjectSchema.default({}),
  workflowRunId: z.string().nullable().optional(),
  budgetLimitCents: z.number().int().nonnegative().nullable().optional(),
  autoComplete: z.boolean().optional(),
})
