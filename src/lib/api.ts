import type {
  AbuseAppealRow,
  AbuseAppealStatus,
  AbuseDetectionEventRow,
  AbusePreventionPolicyRow,
  AbusePreventionPolicyStatus,
  AbusePreventionSeverity,
  FutureTechCapabilityKind,
  FutureTechInterfaceRow,
  FutureTechRadarItemRow,
  FutureTechRadarStatus,
  FutureTechReadiness,
  FutureTechStage,
  CommercialBillingPeriod,
  CommercialPlanKey,
  CommercialPlanRow,
  CommercialPlanStatus,
  CommercialPolicyRuleRow,
  CommercialPolicyRuleType,
  CommercialPolicySeverity,
  MonetizationRevenueStreamRow,
  RevenueStreamStatus,
  RevenueStreamType,
  CommunityGovernanceRoleRow,
  GovernanceRfcDecisionRow,
  GovernanceRfcStatus,
  GovernanceRoleType,
  OpenSourceComponentRow,
  OpenSourceGovernanceStatus,
  OSInterferenceEventRow,
  OSInterferenceEventStatus,
  OSInterferenceMonitorSnapshot,
  OSInterferencePolicyRow,
  OSInterferenceSignal,
  FileBoundaryEvaluationStatus,
  FileBoundaryOperation,
  FileSystemBoundaryEvaluationRow,
  FileSystemBoundaryInput,
  FileSystemBoundaryPolicyRow,
  BrowserAutomationTrapEvaluationRow,
  BrowserAutomationTrapInput,
  BrowserAutomationTrapPolicyRow,
  BrowserAutomationTrapStatus,
  EnterpriseNetworkEvaluationRow,
  EnterpriseNetworkInput,
  EnterpriseNetworkPolicyRow,
  EnterpriseNetworkStatus,
  OutputConsistencyEvaluationRow,
  OutputConsistencyInput,
  OutputConsistencyPolicyRow,
  OutputConsistencyStatus,
  ResourceGovernorEvaluationRow,
  ResourceGovernorPolicyRow,
  ResourceGovernorSnapshot,
  ResourceGovernorStatus,
  GlobalOSIntegrationEvaluationRow,
  GlobalOSIntegrationInput,
  GlobalOSIntegrationPolicyRow,
  GlobalOSIntegrationStatus,
  TelemetryDecisionStatus,
  TelemetryEventInput,
  TelemetryEventRow,
  TelemetryExportManifestRow,
  TelemetryLevel,
  TelemetryNeverCollectCategory,
  TelemetryPolicyRow,
  SourceLicenseLayer,
  ContributionPolicyRow,
  ContributionPolicyType,
  ContributorPrerequisiteRow,
  ContributorTool,
  ArchitectureInterfaceRow,
  ArchitecturePatternKey,
  ArchitecturePatternRow,
  TechnicalArchitectureEvaluationRow,
  TechnicalArchitectureEvaluationStatus,
  TechnicalArchitectureManifest,
  ErrorClassificationRow,
  ErrorSeverity,
  ErrorTaxonomyCategory,
  ErrorCodeCatalogRow,
  ErrorCodeCategory,
  EntityStateMachineRow,
  EntityStateMachineType,
  EntityStateTransitionRow,
  AgentCloneMemoryMode,
  AgentCloneRecordRow,
  AgentCloneSkillMode,
  AgentComparisonReportRow,
  AgentDeploymentEnvironment,
  AgentEnvironmentPromotionRow,
  AgentEnvironmentPromotionStatus,
  AgentProfileRow,
  AgentProbationRecordRow,
  AgentProbationStatus,
  AgentTemplateCategory,
  AgentTemplateInstallRow,
  AgentTemplatePackageRow,
  AgentTemplatePackageType,
  AgentTemplateSource,
  AgentTemplateStatus,
  AgentTemplateVisibility,
  AcceptanceScenarioKey,
  AcceptanceScenarioRunRow,
  AcceptanceScenarioStatus,
  AccessibilityColorScheme,
  AccessibilityProfileRow,
  AgentEnvironment,
  AgentInterviewRow,
  AgentLocalizationPolicyRow,
  AgentMentoringEventRow,
  AgentMentoringEventType,
  AgentMentorshipRow,
  AgentMentorshipScope,
  AgentMentorshipStatus,
  AgentMentorshipStyle,
  AgentPersona,
  AgentStyleGuideBindingRow,
  AgentDiversityProfileRow,
  AgentPersonality,
  AgentRiskPosture,
  AgentRow,
  AgentWorkstationRow,
  AgentDiaryEntryRow,
  AgentRetirementPlanRow,
  AgentHealthScoreRow,
  AgentCommunicationProtocolRow,
  AgentProtocolMessageRow,
  AgentProtocolMessageType,
  AgentProtocolPriority,
  AgentProtocolStatus,
  AgentReputationReviewRow,
  AgentReputationSnapshotRow,
  AgentAvailabilityDecision,
  AgentCertificationExamRow,
  AgentCertificationExamStatus,
  AgentCertificationLevel,
  AgentCertificationRunRow,
  AgentCertificationSubmission,
  AgentCertificationTask,
  AgentCertificationValidityPeriod,
  AgentMaintenanceWindow,
  AgentOvertimePolicy,
  AgentScheduleRow,
  AgentScheduleStatus,
  AgentVacationMode,
  AgentWeeklySchedule,
  AgentTeamDashboardCommandRow,
  AgentTeamDashboardCommandType,
  AgentTeamDashboardSnapshotRow,
  AgentWhatIfAnalysisRow,
  AlertEventRow,
  AlertRuleRow,
  AppSettingsRow,
  ApprovalEscalationStep,
  ApprovalOnTimeout,
  ApprovalRequestRow,
  AutoApproveCondition,
  ArtifactSemanticDiffRow,
  ArtifactValidationRow,
  ArtifactRow,
  ArchitectureAbstractionKind,
  ArchitectureEvolutionReservationRow,
  ArchitectureEvolutionStatus,
  ArchitectureEvolutionTrack,
  AttachmentRow,
  AutonomyActionType,
  AutonomyDecisionRow,
  BacktestGateStatus,
  BacktestRunMode,
  BacktestRunRow,
  BlackboardEntryRow,
  BlackboardScopeType,
  BenchmarkCaseResultRow,
  BenchmarkCaseRow,
  BenchmarkDimension,
  BenchmarkRunRow,
  BenchmarkSuiteRow,
  BrandCandidateLanguage,
  BrandCandidateRow,
  BrandGuidelineRow,
  BrowserSessionEventRow,
  BrowserSessionKeepAliveInterval,
  BrowserSessionMaxAge,
  BrowserSessionRow,
  BrowserSessionStatus,
  BudgetEventRow,
  CapacityPlanningEvaluationRow,
  CapacityPlanningProfileRow,
  BehaviorDriftAnalysisRow,
  BehaviorDriftSeverity,
  BehaviorSnapshotKind,
  BehaviorSnapshotRow,
  BehaviorStabilizationRunRow,
  BehaviorStabilizationRunStatus,
  CapabilityIndexEntryRow,
  CapabilityNegotiationEventRow,
  CapabilityNegotiationEventType,
  CapabilityNegotiationResolution,
  CapabilityNegotiationRow,
  CapabilityNegotiationStatus,
  CapabilityNegotiationStrategies,
  CapabilityNegotiationStrategy,
  CapabilityRecommendationRow,
  CapabilitySourceType,
  CicdAgentConclusion,
  CicdIntegrationRow,
  CicdMode,
  CicdPlatform,
  CicdRunRow,
  CliProfileRow,
  CliRunRow,
  ComputerActionStatus,
  ComputerActionEventRow,
  ComputerSessionRow,
  CompetitivePositioningReportRow,
  CompetitivePositioningStatus,
  EcosystemRoadmapPhaseRow,
  EcosystemRoadmapStage,
  EcosystemRoadmapStatus,
  EthicalAlignmentDecision,
  EthicalAlignmentEvaluationRow,
  EthicalAlignmentPolicyRow,
  EthicalAlignmentPolicyStatus,
  EthicalOnRefuse,
  LegalComplianceFrameworkRow,
  LegalComplianceStatus,
  LegalDisclaimerNoticeRow,
  LegalDisclaimerPlacement,
  LicenseComplianceCheckRow,
  LicenseRiskLevel,
  EmotionalUxGuidelineRow,
  EmotionalUxGuidelineType,
  EmotionalUxStatus,
  SystemBootstrapCheckRow,
  SystemBootstrapCheckStatus,
  SystemBootstrapComponent,
  ConfigEntityType,
  ConfigExportFormat,
  ConfigExportRow,
  ConfigImpactAnalysisRow,
  ConfigVersionRow,
  ConcurrencyEvaluationRow,
  ConcurrencyEvaluationStatus,
  ConcurrencyProfileRow,
  ConcurrencyProfileStatus,
  ConflictEscalationRow,
  ConversationWithMeta,
  ContextSummaryRow,
  ConflictResolutionRow,
  ContinuationPlanRow,
  ContinuationPlanStatus,
  CustomModelRow,
  CustomModelSourceType,
  CustomModelStatus,
  CustomMetricEvaluationRow,
  CustomMetricProfileRow,
  CustomMetricScope,
  DecisionAuditTrailRow,
  DecisionRollbackGranularity,
  DecisionRollbackReasonType,
  DecisionRollbackRow,
  DecisionRollbackScope,
  DecisionRollbackStatus,
  DiversityAnalysisRow,
  DiversityScopeType,
  DebugReplaySnapshotRow,
  DriftResponsePolicy,
  DynamicPermissionDuration,
  DynamicPermissionGrantRow,
  DynamicPermissionGrantStatus,
  E2EEncryptionCheckRow,
  E2EEncryptionCheckScope,
  E2EEncryptionCheckStatus,
  E2EEncryptionPolicyRow,
  E2EEncryptionPolicyStatus,
  ExternalMonitoringConfigRow,
  ExternalMonitoringLogExport,
  ExternalMonitoringStatus,
  FinetuneDatasetConsentStatus,
  FinetuneDatasetExportRow,
  FinetuneDatasetSourceScope,
  LocalIpcEncryption,
  EmployeeRunEventRow,
  EmployeeRunRow,
  IdempotencyRecordRow,
  IncidentReportRow,
  IncidentResponseActionRow,
  IncidentResponsePlanRow,
  IncidentSeverity,
  InterAgentMessageRow,
  AgentMessageType,
  HealthStatus,
  JsonObject,
  KnowledgeTransferPackageRow,
  KnowledgeTransferReceiverHandling,
  KnowledgeEdgeType,
  KnowledgeGraphEdgeRow,
  KnowledgeGraphNodeRow,
  KnowledgeNodeType,
  KeyboardShortcutRow,
  KeyboardShortcutScope,
  LearningEventRow,
  I18nContractArea,
  I18nContractCheckRow,
  I18nContractStatus,
  LocalizationNamespace,
  LocalizationResourceRow,
  LocalizationSettingsRow,
  MaintenanceWindowRow,
  McpServerRow,
  McpTransport,
  McpToolCallRow,
  McpToolDefinitionRow,
  MemoryDecayAction,
  MemoryDecaySnapshotRow,
  MemoryGraphExportFormat,
  MemoryGraphLayout,
  MemoryGraphViewRow,
  MemoryIntegrityDecision,
  MemoryIntegrityEvaluationRow,
  MemoryIntegrityPolicy,
  MemoryIntegrityPolicyRow,
  MemoryIntegrityPolicyStatus,
  MemoryIntegritySourceType,
  MemoryItemRow,
  MemoryPrivacyDataType,
  MemoryPrivacyEncryption,
  MemoryPrivacyReadAccess,
  MemoryPrivacyWriteAccess,
  MemoryScope,
  MemoryType,
  MessageRow,
  MetaAgentDigestRow,
  MetaAgentProfileRow,
  MetaAgentRecommendationRow,
  MetaAgentRecommendationStatus,
  MetaAgentResponsibility,
  MetricPointRow,
  MacroReplayRunRow,
  MigrationImportRecordRow,
  MigrationSourceTool,
  MigrationWizardSessionRow,
  ModelConnectionTestRow,
  ModelCacheEvaluationStatus,
  ModelCacheStrategy,
  ModelInvocationOptimizationEventRow,
  ModelInvocationOptimizationPolicyRow,
  ModelInvocationTaskType,
  ModelParameterValues,
  ModelProfileProvider,
  ModelProfileRow,
  ModelResponseCacheEntryRow,
  ModelRouteDecisionRow,
  ModelWarmupSessionRow,
  ModelWarmupStatus,
  MultimodalInputKind,
  MultimodalInputRow,
  MultimodalOutputKind,
  MultimodalOutputRow,
  NaturalLanguageWorkflowDraftRow,
  NaturalLanguageWorkflowDraftStatus,
  NetworkAppliesTo,
  NetworkMode,
  NetworkProfileRow,
  NfrCategory,
  NfrEvaluationRow,
  NfrEvaluationStatus,
  NfrRequirementRow,
  NfrRequirementStatus,
  KnownLimitationCategory,
  KnownLimitationRow,
  KnownLimitationSeverity,
  KnownLimitationStatus,
  LimitationAcknowledgementRow,
  LimitationDisclosureSurface,
  NonGoalPolicyRow,
  NonGoalScope,
  NotificationChannel,
  NotificationLevel,
  NotificationPreferenceRow,
  NotificationRow,
  OAuthActingAs,
  OAuthCredentialRow,
  OAuthGrantType,
  OAuthProvider,
  OAuthRefreshEventRow,
  OAuthRefreshStatus,
  OnboardingSessionRow,
  OptimisticLockRow,
  OrganizationalInsightStatus,
  OrganizationalInsightType,
  OrganizationalKnowledgeItemRow,
  OrganizationalKnowledgeSource,
  OrganizationalLearningReportRow,
  OptimizationTarget,
  OutputLanguagePolicy,
  PackageImportCheckRow,
  HumanApprovalPolicyConfig,
  HumanApprovalPolicyRow,
  HumanApprovalPolicyStatus,
  PlanApprovalOverallDecision,
  PlanApprovalResultRow,
  PlanStepDecision,
  PerformanceAnalysisRunRow,
  PerformanceAnalysisScope,
  PerformanceOptimizationRecommendationRow,
  PerformanceReviewRow,
  PlaybookRow,
  PlaybookVersionRow,
  PluginCapabilityDefinition,
  PluginCompatibilityReport,
  PluginExtensionPoint,
  PluginLifecycleEventRow,
  PluginMarketplaceMetadata,
  PluginPackageRow,
  PluginStatus,
  TeamApprovalDecisionRow,
  TeamApprovalMode,
  TeamApprovalPolicyRow,
  TeamApprovalPolicyStatus,
  TeamApprovalResolution,
  TeamMembershipRow,
  TeamMembershipStatus,
  TeamResourceShareRow,
  TeamResourceSharingPolicy,
  TeamResourceType,
  TeamRow,
  TeamSecretHandling,
  TeamStatus,
  TeamUserRoleSystem,
  TeamUserRow,
  TeamUserStatus,
  TakeoverActionType,
  TakeoverResource,
  TakeoverSessionRow,
  TakeoverSessionStatus,
  ProgrammaticApiKeyRow,
  ContextCompressorConfig,
  ContextCompressorPolicyRow,
  ContextCompressorPolicyStatus,
  ContextCompressionPlanRow,
  ContextCompressionPlanStatus,
  PromptTemplateConditionalBlock,
  PromptTemplateEngine,
  PromptTemplateRow,
  PromptTemplateScope,
  PromptTemplateStatus,
  PromptTemplateVariables,
  PromptTemplateVersionRow,
  ModelBehaviorSnapshotRow,
  PromptVersionAbTest,
  TokenBudgetAllocationConfig,
  PromptDriftAction,
  PromptDriftChecks,
  PromptDriftMonitorRow,
  PromptDriftMonitorStatus,
  PromptDriftRunRow,
  PromptDriftRunStatus,
  PromptDriftSchedule,
  AdversarialReviewRow,
  AdversarialReviewStatus,
  ContentSafetyAction,
  ContentSafetyLayers,
  ContentSafetyPolicyRow,
  ContentSafetyPolicyStatus,
  ContentSafetyScanRow,
  ContentSafetyScanStatus,
  CopyrightCheckConfig,
  CopyrightCheckRow,
  CopyrightCheckStatus,
  SafetyReviewedContentType,
  TrustCalibrationConfig,
  TrustCalibrationEvaluationRow,
  TrustCalibrationMetrics,
  TrustCalibrationPolicyRow,
  TrustCalibrationPolicyStatus,
  TrustCalibrationRecommendation,
  BudgetCostBreakdown,
  BudgetEvaluationRow,
  BudgetEvaluationStatus,
  BudgetLimitType,
  BudgetModelRoutingRule,
  BudgetPolicyRow,
  BudgetPolicyStatus,
  BudgetScope,
  BudgetUsageGroupBy,
  AutonomyLevel,
  AgentConsensusVoteRow,
  AgentVotingDecision,
  AgentVotingTieBreaker,
  ConsensusCriticalTask,
  ConsensusRecommendedAction,
  DualModelVerificationRow,
  SecondaryModelStrategy,
  PromptEngineeringGuideRow,
  PromptAntiPatternRuleRow,
  ProjectAgentRoleRow,
  ProjectContextRow,
  ProjectContextStatus,
  ProjectSwitchEventRow,
  ProjectSwitchMode,
  ProjectSwitchStatus,
  QuickReferenceCategory,
  QuickReferenceItemRow,
  ReasonixFileFormatKind,
  ReasonixFileFormatSpecRow,
  ReasonixFileValidationRow,
  ReadinessChecklistCategory,
  ReadinessChecklistItemRow,
  RealtimeCollabProtocol,
  RealtimeCollabResolution,
  RealtimeCollabSessionRow,
  RealtimeEditOperationKind,
  RealtimeEditOperationRow,
  RealtimeParticipantType,
  RealtimeSegmentLockRow,
  RecoveryEventRow,
  RecoveryStrategyAttemptRow,
  RecoveryStrategyOutcome,
  RecoveryStrategyStatsRow,
  RecoveryStrategyType,
  RecordedMacroRow,
  RuntimeCheckpointRow,
  RiskLevel,
  ResourceLockRow,
  RunReflectionRow,
  RuntimeContextSnapshotRow,
  RuntimeMicroOperationDecisionRow,
  RuntimeMicroOperationDecisionStatus,
  RuntimeMicroOperationPolicyRow,
  RuntimeTimeoutKind,
  ScheduledActionRow,
  ScheduledActionStatus,
  AgentInboxItemRow,
  AgentInboxItemStatus,
  AgentInboxItemType,
  SandboxNetworkMode,
  SandboxPolicyRow,
  SecretKind,
  SecretVaultRow,
  SecurityFindingAction,
  SecurityFindingRow,
  SecurityFindingSeverity,
  SecurityAuditCadence,
  SecurityAuditChecklistItemRow,
  SecurityAuditRunItemRow,
  SecurityAuditRunRow,
  SkillInstallFlowRow,
  SkillMarketplacePublicationRow,
  SkillRow,
  SkillSdkManifestRow,
  SkillSource,
  SkillSynthesisRecordRow,
  SkillSynthesisStatus,
  SoftwareAdapterType,
  SoftwareAppType,
  SoftwareCommandRunRow,
  SoftwareCommandRow,
  SoftwareProfileRow,
  StyleGuideRow,
  SdkTaskRow,
  SuccessMetricCategory,
  SuccessMetricDefinitionRow,
  SuccessMetricSnapshotRow,
  SuccessMetricSnapshotStatus,
  TaskBatchRow,
  TaskBatchStatus,
  TaskBatchStrategy,
  TaskMergeSuggestionRow,
  TaskMergeSuggestionStatus,
  TaskScheduleKind,
  TaskScheduleRow,
  TaskScheduleStatus,
  CredentialResourceType,
  CredentialScopeRow,
  DataMaintenancePolicy,
  DataMaintenancePolicyRow,
  DataMaintenancePolicyStatus,
  DataMaintenanceRunRow,
  DataMaintenanceRunStatus,
  DataExportFormat,
  DataExportManifestRow,
  DataExportScope,
  DegradationAction,
  DegradationEventRow,
  DegradationResourceType,
  DegradationPolicyRow,
  DegradationTrigger,
  DeprecationMigrationRunRow,
  DeprecationPolicyStageRow,
  HelpCenterItemRow,
  HelpCenterItemType,
  HelpCenterSurfaceRow,
  HelpCenterSurfaceStatus,
  HelpOnboardingFlowRow,
  HelpOnboardingFlowStatus,
  DocumentationPageRow,
  DocumentationSectionCategory,
  DocumentationSectionRow,
  EditConflictResolution,
  EditConflictRow,
  EditConflictStatus,
  ExportPackageRow,
  ExportPackageType,
  FaqEntryCategory,
  FaqEntryRow,
  FeatureFlagEvaluationRow,
  FeatureFlagRow,
  FeatureFlagStatus,
  FeatureFlagTargetUsers,
  FeatureDeprecationRow,
  GlossaryTermCategory,
  GlossaryTermRow,
  AuditLogRow,
  PiiMarkerRow,
  PiiMarkerStatus,
  TaskQueueItemKind,
  TaskQueueItemRow,
  TaskQueueRow,
  TaskTemplateParameterType,
  TaskTemplateRow,
  TaskTemplateRunRow,
  TaskTemplateStatus,
  ThemeModePreference,
  ThemePresetKey,
  ThemeProfileRow,
  ThemeSpacingScale,
  RetentionEntity,
  RetentionExpiryAction,
  RetentionPolicyRow,
  StorageQuotaScope,
  StorageQuotaSnapshotRow,
  TestFixtureGenerationRunRow,
  TestFixtureSpecRow,
  TestFixtureType,
  TestStrategyItemKind,
  TestStrategyItemRow,
  TestStrategyItemStatus,
  StreamProtocolChannelRow,
  StreamProtocolEventRow,
  StreamProtocolMessageType,
  StreamReplayCursorRow,
  TroubleshootingCategory,
  TroubleshootingEntryRow,
  SupportedLocale,
  ToolConnectionRow,
  ToolConnectionType,
  ToolProtocolInvocationRow,
  ToolProtocolInvocationStatus,
  ToolProtocolManifestRow,
  ToolProtocolResultRow,
  ToolProtocolSource,
  ToolPipelineFailurePolicy,
  ToolPipelineRow,
  ToolPipelineStatus,
  ContextCacheRow,
  ContextCacheStatus,
  ContextPreloadTaskType,
  ContextWindowActionType,
  ContextWindowVisualizationRow,
  UnifiedSearchEntityType,
  UnifiedSearchIndexRow,
  UpdatePolicyRow,
  UserOverrideCommand,
  UserOverrideRow,
  UserOverrideTargetType,
  UserOverrideTrigger,
  VoiceConversationSpeaker,
  VoiceConversationTurnRow,
  VoiceConversationTurnStatus,
  VoiceInputMode,
  VoiceInterfaceProfileRow,
  VoiceProfileStatus,
  VoiceSpeakOn,
  TtsEngine,
  WorkstationMode,
  GoldenTaskSetRow,
  GoldenTaskSetStatus,
  SimulationRunMode,
  SimulationRunRow,
  SimulationRunStatus,
  SimulationTargetType,
  WorkspaceInitRunRow,
  WorkspaceInitRunStatus,
  WorkspaceInitSourceType,
  WorkspaceSetupFailPolicy,
  WorkspaceStructure,
  WorkspaceTemplateRow,
  WebhookDeliveryRow,
  WebhookEventType,
  WebhookSubscriptionRow,
  WorkflowEdgeRow,
  WorkflowNodeRow,
  WorkflowNodeRunRow,
  WorkflowOptimizationAutoApply,
  WorkflowOptimizationRow,
  WorkflowOptimizationStatus,
  WorkflowPartialRerunPlanRow,
  WorkflowPartialRerunStatus,
  WorkflowPreflightRow,
  WorkflowRow,
  WorkflowRunRow,
  WorkflowTemplateInstantiationRow,
  WorkflowTemplateInstantiationStatus,
  WorkflowTemplateParameterSchema,
} from '@/db/schema'
import type { AgentProfileCapabilityReport } from '@/server/control-plane-service'
import type { AgentIsolationReport } from '@/server/agent-isolation-service'
import type { AgentMemoryLearningReport } from '@/server/agent-memory-learning-report-service'
import type { WorkflowNodeBrainStatus } from '@/lib/workflow-node-brain-status'
export type { WorkflowNodeBrainStatus } from '@/lib/workflow-node-brain-status'
import type { ApiDesignCoverageReport } from '@/server/api-design-coverage-report-service'
import type { BackendServiceCoverageReport } from '@/server/backend-service-coverage-report-service'
import type { DatabaseCoverageReport } from '@/server/database-coverage-report-service'
import type { FrontendPageCoverageReport } from '@/server/frontend-page-coverage-report-service'
import type { PhasePlanCoverageReport } from '@/server/phase-plan-coverage-report-service'
import type { ProductEffectsCoverageReport } from '@/server/product-effects-coverage-report-service'
import type { TestPlanCoverageReport } from '@/server/test-plan-coverage-report-service'
import type {
  MobileCompanionReport,
  MobileUploadSummary,
  RegisterMobileUploadArgs,
} from '@/server/mobile-service'
import type { NetworkEgressReport } from '@/server/network-egress-report-service'
import type { NetworkEgressLiveTestResult } from '@/server/network-egress-live-test-service'
import type { SkillsMapIntegrationReport } from '@/server/skillsmap-integration-service'
import type { WorkflowCanvasReport } from '@/server/workflow-canvas-report-service'
import type {
  AskUserAnswer,
  DeployCandidateRecord,
  DeployStatusRecord,
  PendingBashCommand,
  PendingDispatchPlan,
  PendingQuestion,
  PendingWrite,
} from '@/shared/types'
import type { AgentConfigDraft, AgentDraftRequest } from '@/shared/agent-builder-config'
import type { AgentHubModuleManagerView } from '@/lib/agenthub-module-manager'

export interface ArtifactListItem {
  id: string
  conversationId: string
  conversationTitle: string | null
  type: string
  title: string
  version: number
  parentArtifactId: string | null
  createdByAgentId: string
  createdAt: number
}

async function json<T>(req: Promise<Response>): Promise<T> {
  const res = await req
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body || res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchAppModuleManagerView(enabledModuleIds?: string[]): Promise<AgentHubModuleManagerView> {
  const suffix =
    enabledModuleIds && enabledModuleIds.length > 0
      ? `?enabled=${encodeURIComponent(enabledModuleIds.join(','))}`
      : ''
  const { moduleManager } = await json<{ moduleManager: AgentHubModuleManagerView }>(
    fetch(`/api/app-modules${suffix}`),
  )
  return moduleManager
}

// ─── Agents ─────────────────────────────────────
export async function fetchAgents(): Promise<AgentRow[]> {
  const { agents } = await json<{ agents: AgentRow[] }>(fetch('/api/agents'))
  return agents
}

export interface CreateAgentBody {
  name: string
  avatar: string
  description: string
  capabilities: string[]
  systemPrompt: string
  /** 默认 'custom'。SDK adapter 使用各自内置工具集 */
  adapterName?: 'custom' | 'claude-code' | 'codex'
  /** custom: required；SDK adapter: 忽略 */
  modelProvider?: 'anthropic' | 'openai' | 'deepseek' | 'volcano-ark' | 'openai-compatible'
  /** custom: required；SDK adapter: 可选，默认 SDK 默认模型 */
  modelId?: string
  toolNames: string[]
  skillIds?: string[]
  mcpServerIds?: string[]
  cliProfileIds?: string[]
  supportsVision?: boolean
  apiKey?: string
  /** 自定义 API base URL。Claude/Codex 对 endpoint 协议兼容性要求不同；空走默认 */
  apiBaseUrl?: string
}

export async function createAgent(body: CreateAgentBody): Promise<AgentRow> {
  const { agent } = await json<{ agent: AgentRow }>(
    fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return agent
}

export async function createAgentDraft(body: AgentDraftRequest): Promise<AgentConfigDraft> {
  const { draft } = await json<{ draft: AgentConfigDraft }>(
    fetch('/api/agents/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return draft
}

export type UpdateAgentBody = Partial<
  Omit<CreateAgentBody, 'avatar' | 'apiKey' | 'apiBaseUrl' | 'modelId'>
> & {
  // SDK adapter 可用 null 清空，表示走 SDK 默认模型；custom 仍必须有非空 modelId
  modelId?: string | null
  // 显式 null 表示清除自定义 key；undefined 表示不改
  apiKey?: string | null
  // 同上
  apiBaseUrl?: string | null
}

export async function updateAgent(agentId: string, patch: UpdateAgentBody): Promise<AgentRow> {
  const { agent } = await json<{ agent: AgentRow }>(
    fetch(`/api/agents/${agentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
  return agent
}

export async function deleteAgent(agentId: string): Promise<void> {
  await json<{ ok: true }>(fetch(`/api/agents/${agentId}`, { method: 'DELETE' }))
}

export async function fetchAgentProbationRecords(params: {
  agentProfileId?: string
  status?: AgentProbationStatus
  environment?: AgentDeploymentEnvironment
  limit?: number
} = {}): Promise<AgentProbationRecordRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.environment) qs.set('environment', params.environment)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { probationRecords } = await json<{ probationRecords: AgentProbationRecordRow[] }>(
    fetch(`/api/agent-probation${suffix}`),
  )
  return probationRecords
}

export async function evaluateAgentProbation(body: {
  agentProfileId: string
  autoGraduate?: boolean
}): Promise<AgentProbationRecordRow> {
  const { probationRecord } = await json<{ probationRecord: AgentProbationRecordRow }>(
    fetch('/api/agent-probation/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return probationRecord
}

export async function requestAgentProductionPromotion(body: {
  agentProfileId: string
  productionAgentProfileId?: string
  abComparison?: JsonObject
  note?: string
}): Promise<AgentEnvironmentPromotionRow> {
  const { promotion } = await json<{ promotion: AgentEnvironmentPromotionRow }>(
    fetch('/api/agent-probation/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return promotion
}

export async function fetchAgentEnvironmentPromotions(params: {
  agentProfileId?: string
  status?: AgentEnvironmentPromotionStatus
  limit?: number
} = {}): Promise<AgentEnvironmentPromotionRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { promotions } = await json<{ promotions: AgentEnvironmentPromotionRow[] }>(
    fetch(`/api/agent-probation/promotions${suffix}`),
  )
  return promotions
}

export async function decideAgentProductionPromotion(
  promotionId: string,
  body: { decision: 'approved' | 'rejected'; note?: string },
): Promise<AgentEnvironmentPromotionRow> {
  const { promotion } = await json<{ promotion: AgentEnvironmentPromotionRow }>(
    fetch(`/api/agent-probation/promotions/${promotionId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return promotion
}

export async function applyAgentProductionPromotion(
  promotionId: string,
): Promise<AgentEnvironmentPromotionRow> {
  const { promotion } = await json<{ promotion: AgentEnvironmentPromotionRow }>(
    fetch(`/api/agent-probation/promotions/${promotionId}/apply`, {
      method: 'POST',
    }),
  )
  return promotion
}

// ─── Conversations ──────────────────────────────
// Employee Agent control plane
export interface CreateNetworkProfileBody {
  name: string
  mode?: NetworkMode
  proxyUrl?: string | null
  bindInterface?: string | null
  regionLabel?: string | null
  appliesTo?: NetworkAppliesTo
}

export async function fetchNetworkProfiles(): Promise<NetworkProfileRow[]> {
  const { networkProfiles } = await json<{ networkProfiles: NetworkProfileRow[] }>(
    fetch('/api/network-profiles'),
  )
  return networkProfiles
}

export type { NetworkEgressReport }

export async function fetchNetworkEgressReport(): Promise<NetworkEgressReport> {
  const { report } = await json<{ report: NetworkEgressReport }>(
    fetch('/api/network-profiles/egress-report'),
  )
  return report
}

export async function fetchNetworkProfileEgressReport(
  networkProfileId: string,
): Promise<NetworkEgressReport> {
  const { report } = await json<{ report: NetworkEgressReport }>(
    fetch(`/api/network-profiles/${networkProfileId}/egress-report`),
  )
  return report
}

export async function createNetworkProfile(
  body: CreateNetworkProfileBody,
): Promise<NetworkProfileRow> {
  const { networkProfile } = await json<{ networkProfile: NetworkProfileRow }>(
    fetch('/api/network-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return networkProfile
}

export interface ControlPlaneTestResult {
  status: 'ok' | 'failed'
  message: string
  checkedAt: number
}

export async function testNetworkProfile(
  networkProfileId: string,
): Promise<ControlPlaneTestResult> {
  const { result } = await json<{ result: ControlPlaneTestResult }>(
    fetch(`/api/network-profiles/${networkProfileId}/test`, { method: 'POST' }),
  )
  return result
}

export async function testNetworkProfileEgress(
  networkProfileId: string,
  body: {
    live?: boolean
    confirmExternalCall?: boolean
    probeUrl?: string | null
  } = {},
): Promise<NetworkEgressLiveTestResult> {
  const { result } = await json<{ result: NetworkEgressLiveTestResult }>(
    fetch(`/api/network-profiles/${networkProfileId}/egress-live-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export interface CreateModelProfileBody {
  name: string
  provider: ModelProfileProvider
  baseUrl: string
  apiKeyRef: string
  model: string
  contextWindow?: number | null
  supportsVision?: boolean
  supportsToolCalling?: boolean
  supportsJsonMode?: boolean
  networkProfileId?: string | null
}

export async function fetchModelProfiles(): Promise<ModelProfileRow[]> {
  const { modelProfiles } = await json<{ modelProfiles: ModelProfileRow[] }>(
    fetch('/api/model-profiles'),
  )
  return modelProfiles
}

export async function createModelProfile(body: CreateModelProfileBody): Promise<ModelProfileRow> {
  const { modelProfile } = await json<{ modelProfile: ModelProfileRow }>(
    fetch('/api/model-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return modelProfile
}

export async function updateModelProfile(
  modelProfileId: string,
  body: CreateModelProfileBody,
): Promise<ModelProfileRow> {
  const { modelProfile } = await json<{ modelProfile: ModelProfileRow }>(
    fetch(`/api/model-profiles/${modelProfileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return modelProfile
}

export async function deleteModelProfile(modelProfileId: string): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/model-profiles/${modelProfileId}`, {
      method: 'DELETE',
    }),
  )
}

export async function testModelProfile(
  modelProfileId: string,
): Promise<ControlPlaneTestResult> {
  const { result } = await json<{ result: ControlPlaneTestResult }>(
    fetch(`/api/model-profiles/${modelProfileId}/test`, { method: 'POST' }),
  )
  return result
}

export async function testModelConnection(
  modelProfileId: string,
  body: { live?: boolean; confirmExternalCall?: boolean } = {},
): Promise<ModelConnectionTestRow> {
  const { modelConnectionTest } = await json<{ modelConnectionTest: ModelConnectionTestRow }>(
    fetch(`/api/model-profiles/${modelProfileId}/connection-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return modelConnectionTest
}

export type ModelCapabilityProbeKind = 'text' | 'json' | 'tool_calling' | 'vision'

export async function runModelCapabilityProbe(
  modelProfileId: string,
  body: {
    kind?: ModelCapabilityProbeKind
    live?: boolean
    confirmExternalCall?: boolean
    prompt?: string
    visionImageDataUrl?: string | null
  } = {},
): Promise<ModelConnectionTestRow> {
  const { modelConnectionTest } = await json<{ modelConnectionTest: ModelConnectionTestRow }>(
    fetch(`/api/model-profiles/${modelProfileId}/capability-probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return modelConnectionTest
}

export async function fetchModelConnectionTests(
  modelProfileId?: string,
): Promise<ModelConnectionTestRow[]> {
  const qs = modelProfileId ? `?modelProfileId=${encodeURIComponent(modelProfileId)}` : ''
  const { modelConnectionTests } = await json<{
    modelConnectionTests: ModelConnectionTestRow[]
  }>(fetch(`/api/model-gateway/connection-tests${qs}`))
  return modelConnectionTests
}

export async function previewModelRoute(body: {
  agentProfileId?: string | null
  requestedCapabilities?: JsonObject
  estimatedInputTokens?: number
  estimatedOutputTokens?: number
}): Promise<ModelRouteDecisionRow> {
  const { modelRouteDecision } = await json<{ modelRouteDecision: ModelRouteDecisionRow }>(
    fetch('/api/model-gateway/route-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return modelRouteDecision
}

export async function fetchModelRouteDecisions(
  agentProfileId?: string,
): Promise<ModelRouteDecisionRow[]> {
  const qs = agentProfileId ? `?agentProfileId=${encodeURIComponent(agentProfileId)}` : ''
  const { modelRouteDecisions } = await json<{ modelRouteDecisions: ModelRouteDecisionRow[] }>(
    fetch(`/api/model-gateway/route-decisions${qs}`),
  )
  return modelRouteDecisions
}

export async function seedModelInvocationOptimizationPolicy(): Promise<ModelInvocationOptimizationPolicyRow> {
  const { policy } = await json<{ policy: ModelInvocationOptimizationPolicyRow }>(
    fetch('/api/model-optimization/policies/seed', { method: 'POST' }),
  )
  return policy
}

export interface CreateModelInvocationOptimizationPolicyBody {
  name?: string
  status?: ModelInvocationOptimizationPolicyRow['status']
  policy?: {
    responseCache?: {
      strategy?: ModelCacheStrategy
      exactTTL?: number
      semanticTTL?: number
      similarityThreshold?: number
      noCacheFor?: ModelInvocationTaskType[]
      stats?: { hits?: number; misses?: number; savedCost?: number }
    }
    parameters?: {
      byTaskType?: Partial<Record<ModelInvocationTaskType, ModelParameterValues>>
      agentOverrides?: Record<string, Partial<Record<ModelInvocationTaskType, ModelParameterValues>>>
    }
    warmup?: {
      autoWarmupAfterAgentCreated?: boolean
      warmupRequest?: string
      cacheConnection?: boolean
      displayStatus?: string
      connectionPool?: {
        keepHttp2Alive?: boolean
        avoidRepeatedTlsHandshake?: boolean
        maxIdleMs?: number
      }
    }
  }
}

export async function createModelInvocationOptimizationPolicy(
  body: CreateModelInvocationOptimizationPolicyBody,
): Promise<ModelInvocationOptimizationPolicyRow> {
  const { policy } = await json<{ policy: ModelInvocationOptimizationPolicyRow }>(
    fetch('/api/model-optimization/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return policy
}

export async function fetchModelInvocationOptimizationPolicies(params: {
  status?: ModelInvocationOptimizationPolicyRow['status']
  limit?: number
} = {}): Promise<ModelInvocationOptimizationPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: ModelInvocationOptimizationPolicyRow[] }>(
    fetch(`/api/model-optimization/policies${suffix}`),
  )
  return policies
}

export async function evaluateModelResponseCache(body: {
  policyId?: string
  modelProfileId?: string | null
  agentProfileId?: string | null
  taskType: ModelInvocationTaskType
  input: JsonObject
  output?: JsonObject
  costCents?: number
  now?: number
}): Promise<{
  policy: ModelInvocationOptimizationPolicyRow
  status: ModelCacheEvaluationStatus
  entry: ModelResponseCacheEntryRow | null
  event: ModelInvocationOptimizationEventRow
  cacheKey: string
  semanticKey: string
  reason: string
}> {
  const { result } = await json<{
    result: {
      policy: ModelInvocationOptimizationPolicyRow
      status: ModelCacheEvaluationStatus
      entry: ModelResponseCacheEntryRow | null
      event: ModelInvocationOptimizationEventRow
      cacheKey: string
      semanticKey: string
      reason: string
    }
  }>(
    fetch('/api/model-optimization/cache/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchModelResponseCacheEntries(params: {
  policyId?: string
  modelProfileId?: string
  taskType?: ModelInvocationTaskType
  limit?: number
} = {}): Promise<ModelResponseCacheEntryRow[]> {
  const qs = new URLSearchParams()
  if (params.policyId) qs.set('policyId', params.policyId)
  if (params.modelProfileId) qs.set('modelProfileId', params.modelProfileId)
  if (params.taskType) qs.set('taskType', params.taskType)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { entries } = await json<{ entries: ModelResponseCacheEntryRow[] }>(
    fetch(`/api/model-optimization/cache-entries${suffix}`),
  )
  return entries
}

export async function resolveModelParameters(body: {
  policyId?: string
  agentProfileId?: string | null
  taskType: ModelInvocationTaskType
}): Promise<{
  policy: ModelInvocationOptimizationPolicyRow
  taskType: ModelInvocationTaskType
  parameters: ModelParameterValues
  source: 'agent_override' | 'task_default' | 'fallback'
  event: ModelInvocationOptimizationEventRow
}> {
  const { result } = await json<{
    result: {
      policy: ModelInvocationOptimizationPolicyRow
      taskType: ModelInvocationTaskType
      parameters: ModelParameterValues
      source: 'agent_override' | 'task_default' | 'fallback'
      event: ModelInvocationOptimizationEventRow
    }
  }>(
    fetch('/api/model-optimization/parameters/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function startModelWarmup(body: {
  policyId?: string
  agentProfileId?: string | null
  modelProfileId?: string | null
}): Promise<ModelWarmupSessionRow> {
  const { warmup } = await json<{ warmup: ModelWarmupSessionRow }>(
    fetch('/api/model-optimization/warmups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return warmup
}

export async function completeModelWarmup(
  warmupId: string,
  body: { success: boolean; latencyMs?: number; message?: string },
): Promise<ModelWarmupSessionRow> {
  const { warmup } = await json<{ warmup: ModelWarmupSessionRow }>(
    fetch(`/api/model-optimization/warmups/${warmupId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return warmup
}

export async function fetchModelWarmups(params: {
  agentProfileId?: string
  status?: ModelWarmupStatus
  limit?: number
} = {}): Promise<ModelWarmupSessionRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { warmups } = await json<{ warmups: ModelWarmupSessionRow[] }>(
    fetch(`/api/model-optimization/warmups${suffix}`),
  )
  return warmups
}

export async function fetchModelInvocationOptimizationEvents(params: {
  policyId?: string
  eventType?: ModelInvocationOptimizationEventRow['eventType']
  limit?: number
} = {}): Promise<ModelInvocationOptimizationEventRow[]> {
  const qs = new URLSearchParams()
  if (params.policyId) qs.set('policyId', params.policyId)
  if (params.eventType) qs.set('eventType', params.eventType)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { events } = await json<{ events: ModelInvocationOptimizationEventRow[] }>(
    fetch(`/api/model-optimization/events${suffix}`),
  )
  return events
}

export async function seedRuntimeMicroOperationPolicy(): Promise<RuntimeMicroOperationPolicyRow> {
  const { policy } = await json<{ policy: RuntimeMicroOperationPolicyRow }>(
    fetch('/api/runtime-micro-operations/policies/seed', { method: 'POST' }),
  )
  return policy
}

export interface CreateRuntimeMicroOperationPolicyBody {
  name?: string
  status?: RuntimeMicroOperationPolicyRow['status']
  policy?: {
    idleTimeout?: {
      waitingForApproval?: Partial<
        RuntimeMicroOperationPolicyRow['policy']['idleTimeout']['waitingForApproval']
      >
      agentIdle?: Partial<RuntimeMicroOperationPolicyRow['policy']['idleTimeout']['agentIdle']>
      agentStuck?: Partial<RuntimeMicroOperationPolicyRow['policy']['idleTimeout']['agentStuck']>
    }
    busyBehavior?: Partial<RuntimeMicroOperationPolicyRow['policy']['busyBehavior']>
    delayedActions?: Partial<RuntimeMicroOperationPolicyRow['policy']['delayedActions']>
    inbox?: Partial<RuntimeMicroOperationPolicyRow['policy']['inbox']>
  }
}

export async function createRuntimeMicroOperationPolicy(
  body: CreateRuntimeMicroOperationPolicyBody,
): Promise<RuntimeMicroOperationPolicyRow> {
  const { policy } = await json<{ policy: RuntimeMicroOperationPolicyRow }>(
    fetch('/api/runtime-micro-operations/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return policy
}

export async function fetchRuntimeMicroOperationPolicies(params: {
  status?: RuntimeMicroOperationPolicyRow['status']
  limit?: number
} = {}): Promise<RuntimeMicroOperationPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: RuntimeMicroOperationPolicyRow[] }>(
    fetch(`/api/runtime-micro-operations/policies${suffix}`),
  )
  return policies
}

export async function evaluateRuntimeTimeout(body: {
  policyId?: string
  agentProfileId?: string | null
  kind: RuntimeTimeoutKind
  elapsedMs: number
  noProgressSteps?: number
}): Promise<RuntimeMicroOperationDecisionRow> {
  const { decision } = await json<{ decision: RuntimeMicroOperationDecisionRow }>(
    fetch('/api/runtime-micro-operations/timeouts/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return decision
}

export async function evaluateBusyTask(body: {
  policyId?: string
  agentProfileId?: string | null
  currentTaskTitle?: string
  newTaskTitle: string
  currentPriority?: number
  newPriority?: number
  otherAgentCapable?: boolean
  otherAgentId?: string | null
}): Promise<RuntimeMicroOperationDecisionRow> {
  const { decision } = await json<{ decision: RuntimeMicroOperationDecisionRow }>(
    fetch('/api/runtime-micro-operations/busy/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return decision
}

export async function fetchRuntimeMicroOperationDecisions(params: {
  policyId?: string
  status?: RuntimeMicroOperationDecisionStatus
  limit?: number
} = {}): Promise<RuntimeMicroOperationDecisionRow[]> {
  const qs = new URLSearchParams()
  if (params.policyId) qs.set('policyId', params.policyId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { decisions } = await json<{ decisions: RuntimeMicroOperationDecisionRow[] }>(
    fetch(`/api/runtime-micro-operations/decisions${suffix}`),
  )
  return decisions
}

export async function createScheduledAction(body: {
  agentProfileId?: string | null
  instruction: string
  dueAt: number
  payload?: JsonObject
}): Promise<ScheduledActionRow> {
  const { scheduledAction } = await json<{ scheduledAction: ScheduledActionRow }>(
    fetch('/api/runtime-micro-operations/scheduled-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return scheduledAction
}

export async function runDueScheduledActions(body: {
  now?: number
  busyAgentIds?: string[]
  limit?: number
} = {}): Promise<{
  processed: ScheduledActionRow[]
  queued: ScheduledActionRow[]
  due: ScheduledActionRow[]
}> {
  const { result } = await json<{
    result: {
      processed: ScheduledActionRow[]
      queued: ScheduledActionRow[]
      due: ScheduledActionRow[]
    }
  }>(
    fetch('/api/runtime-micro-operations/scheduled-actions/run-due', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchScheduledActions(params: {
  status?: ScheduledActionStatus
  limit?: number
} = {}): Promise<ScheduledActionRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { scheduledActions } = await json<{ scheduledActions: ScheduledActionRow[] }>(
    fetch(`/api/runtime-micro-operations/scheduled-actions${suffix}`),
  )
  return scheduledActions
}

export async function createInboxItem(body: {
  agentProfileId?: string | null
  itemType: AgentInboxItemType
  title: string
  body?: string
  priority?: number
  payload?: JsonObject
}): Promise<AgentInboxItemRow> {
  const { inboxItem } = await json<{ inboxItem: AgentInboxItemRow }>(
    fetch('/api/runtime-micro-operations/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return inboxItem
}

export async function processNextInboxItem(body: {
  agentProfileId?: string | null
} = {}): Promise<AgentInboxItemRow | null> {
  const { inboxItem } = await json<{ inboxItem: AgentInboxItemRow | null }>(
    fetch('/api/runtime-micro-operations/inbox/process-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return inboxItem
}

export async function fetchInboxItems(params: {
  status?: AgentInboxItemStatus
  itemType?: AgentInboxItemType
  limit?: number
} = {}): Promise<AgentInboxItemRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.itemType) qs.set('itemType', params.itemType)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { inboxItems } = await json<{ inboxItems: AgentInboxItemRow[] }>(
    fetch(`/api/runtime-micro-operations/inbox${suffix}`),
  )
  return inboxItems
}

export interface CreateCliProfileBody {
  name: string
  command: string
  argsTemplate?: string
  cwdPolicy?: 'workspace' | 'agent_workspace' | 'custom'
  customCwd?: string | null
  env?: Record<string, string>
  timeoutMs?: number
  inputMode?: 'stdin' | 'args' | 'file'
  outputMode?: 'stdout' | 'file' | 'json'
  allowedAgentIds?: string[]
  requiresApproval?: boolean
}

export async function fetchCliProfiles(): Promise<CliProfileRow[]> {
  const { cliProfiles } = await json<{ cliProfiles: CliProfileRow[] }>(
    fetch('/api/cli-profiles'),
  )
  return cliProfiles
}

export async function createCliProfile(body: CreateCliProfileBody): Promise<CliProfileRow> {
  const { cliProfile } = await json<{ cliProfile: CliProfileRow }>(
    fetch('/api/cli-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return cliProfile
}

export async function testCliProfile(cliProfileId: string): Promise<ControlPlaneTestResult> {
  const { result } = await json<{ result: ControlPlaneTestResult }>(
    fetch(`/api/cli-profiles/${cliProfileId}/test`, { method: 'POST' }),
  )
  return result
}

export async function fetchCliRuns(params: {
  cliProfileId?: string
  agentProfileId?: string
  employeeRunId?: string
} = {}): Promise<CliRunRow[]> {
  const qs = new URLSearchParams()
  if (params.cliProfileId) qs.set('cliProfileId', params.cliProfileId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.employeeRunId) qs.set('employeeRunId', params.employeeRunId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { cliRuns } = await json<{ cliRuns: CliRunRow[] }>(fetch(`/api/cli-runs${suffix}`))
  return cliRuns
}

export interface CreateToolConnectionBody {
  displayName: string
  type: ToolConnectionType
  config?: JsonObject
  enabled?: boolean
}

export async function fetchToolConnections(): Promise<ToolConnectionRow[]> {
  const { toolConnections } = await json<{ toolConnections: ToolConnectionRow[] }>(
    fetch('/api/tool-connections'),
  )
  return toolConnections
}

export async function createToolConnection(
  body: CreateToolConnectionBody,
): Promise<ToolConnectionRow> {
  const { toolConnection } = await json<{ toolConnection: ToolConnectionRow }>(
    fetch('/api/tool-connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return toolConnection
}

export async function testToolConnection(
  toolConnectionId: string,
): Promise<ControlPlaneTestResult> {
  const { result } = await json<{ result: ControlPlaneTestResult }>(
    fetch(`/api/tool-connections/${toolConnectionId}/test`, { method: 'POST' }),
  )
  return result
}

export interface CreateMcpServerBody {
  displayName: string
  transport?: McpTransport
  command?: string | null
  args?: string[]
  env?: Record<string, string>
  endpoint?: string | null
  enabled?: boolean
}

export async function fetchMcpServers(): Promise<McpServerRow[]> {
  const { mcpServers } = await json<{ mcpServers: McpServerRow[] }>(fetch('/api/mcp-servers'))
  return mcpServers
}

export async function createMcpServer(body: CreateMcpServerBody): Promise<McpServerRow> {
  const { mcpServer } = await json<{ mcpServer: McpServerRow }>(
    fetch('/api/mcp-servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return mcpServer
}

export async function testMcpServer(mcpServerId: string): Promise<ControlPlaneTestResult> {
  const { result } = await json<{ result: ControlPlaneTestResult }>(
    fetch(`/api/mcp-servers/${mcpServerId}/test`, { method: 'POST' }),
  )
  return result
}

export async function discoverMcpTools(mcpServerId: string): Promise<McpToolDefinitionRow[]> {
  const { mcpToolDefinitions } = await json<{ mcpToolDefinitions: McpToolDefinitionRow[] }>(
    fetch(`/api/mcp-servers/${mcpServerId}/discover-tools`, { method: 'POST' }),
  )
  return mcpToolDefinitions
}

export async function fetchMcpToolDefinitions(
  mcpServerId?: string,
): Promise<McpToolDefinitionRow[]> {
  const qs = mcpServerId ? `?mcpServerId=${encodeURIComponent(mcpServerId)}` : ''
  const { mcpToolDefinitions } = await json<{ mcpToolDefinitions: McpToolDefinitionRow[] }>(
    fetch(`/api/mcp-tools${qs}`),
  )
  return mcpToolDefinitions
}

export async function runMcpTool(
  mcpToolDefinitionId: string,
  body: {
    agentProfileId?: string | null
    employeeRunId?: string | null
    workflowRunId?: string | null
    workflowNodeRunId?: string | null
    input?: JsonObject
    mode?: 'dry_run' | 'execute'
  } = {},
): Promise<McpToolCallRow> {
  const { mcpToolCall } = await json<{ mcpToolCall: McpToolCallRow }>(
    fetch(`/api/mcp-tools/${mcpToolDefinitionId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return mcpToolCall
}

export async function fetchMcpToolCalls(params: {
  mcpServerId?: string
  employeeRunId?: string
  workflowRunId?: string
  agentProfileId?: string
} = {}): Promise<McpToolCallRow[]> {
  const qs = new URLSearchParams()
  if (params.mcpServerId) qs.set('mcpServerId', params.mcpServerId)
  if (params.employeeRunId) qs.set('employeeRunId', params.employeeRunId)
  if (params.workflowRunId) qs.set('workflowRunId', params.workflowRunId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { mcpToolCalls } = await json<{ mcpToolCalls: McpToolCallRow[] }>(
    fetch(`/api/mcp-tool-calls${suffix}`),
  )
  return mcpToolCalls
}

export interface CreateToolProtocolManifestBody {
  name: string
  description?: string
  source: ToolProtocolSource
  inputSchema?: JsonObject
  attributes: {
    idempotent: boolean
    readOnly: boolean
    destructive: boolean
    longRunning: boolean
    requiresApproval: boolean
    riskLevel: RiskLevel
  }
  status?: OpenSourceGovernanceStatus
}

export async function fetchToolProtocolManifests(params: {
  source?: ToolProtocolSource
  status?: OpenSourceGovernanceStatus
  limit?: number
} = {}): Promise<ToolProtocolManifestRow[]> {
  const qs = new URLSearchParams()
  if (params.source) qs.set('source', params.source)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { toolProtocolManifests } = await json<{
    toolProtocolManifests: ToolProtocolManifestRow[]
  }>(fetch(`/api/tool-protocol/manifests${suffix}`))
  return toolProtocolManifests
}

export async function createToolProtocolManifest(
  body: CreateToolProtocolManifestBody,
): Promise<ToolProtocolManifestRow> {
  const { manifest } = await json<{ manifest: ToolProtocolManifestRow }>(
    fetch('/api/tool-protocol/manifests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return manifest
}

export async function seedToolInvocationProtocol(): Promise<ToolProtocolManifestRow[]> {
  const { manifests } = await json<{ manifests: ToolProtocolManifestRow[] }>(
    fetch('/api/tool-protocol/seed', { method: 'POST' }),
  )
  return manifests
}

export async function fetchToolProtocolInvocations(params: {
  manifestId?: string
  toolName?: string
  status?: ToolProtocolInvocationStatus
  limit?: number
} = {}): Promise<ToolProtocolInvocationRow[]> {
  const qs = new URLSearchParams()
  if (params.manifestId) qs.set('manifestId', params.manifestId)
  if (params.toolName) qs.set('toolName', params.toolName)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { toolProtocolInvocations } = await json<{
    toolProtocolInvocations: ToolProtocolInvocationRow[]
  }>(fetch(`/api/tool-protocol/invocations${suffix}`))
  return toolProtocolInvocations
}

export async function createToolProtocolInvocation(body: {
  manifestId: string
  callId?: string
  toolName: string
  arguments?: JsonObject
  idempotencyKey?: string | null
  status?: ToolProtocolInvocationStatus
}): Promise<ToolProtocolInvocationRow> {
  const { invocation } = await json<{ invocation: ToolProtocolInvocationRow }>(
    fetch('/api/tool-protocol/invocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return invocation
}

export async function fetchToolProtocolResults(params: {
  invocationId?: string
  callId?: string
  limit?: number
} = {}): Promise<ToolProtocolResultRow[]> {
  const qs = new URLSearchParams()
  if (params.invocationId) qs.set('invocationId', params.invocationId)
  if (params.callId) qs.set('callId', params.callId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { toolProtocolResults } = await json<{
    toolProtocolResults: ToolProtocolResultRow[]
  }>(fetch(`/api/tool-protocol/results${suffix}`))
  return toolProtocolResults
}

export async function createToolProtocolResult(body: {
  invocationId: string
  callId: string
  success: boolean
  data?: JsonObject | null
  error?: JsonObject | null
  metadata?: JsonObject
}): Promise<ToolProtocolResultRow> {
  const { result } = await json<{ result: ToolProtocolResultRow }>(
    fetch('/api/tool-protocol/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function seedPromptEngineeringGuide(): Promise<{
  guide: PromptEngineeringGuideRow
  rules: PromptAntiPatternRuleRow[]
}> {
  return json<{ guide: PromptEngineeringGuideRow; rules: PromptAntiPatternRuleRow[] }>(
    fetch('/api/prompt-engineering/seed', { method: 'POST' }),
  )
}

export async function fetchPromptEngineeringGuides(params: {
  status?: OpenSourceGovernanceStatus
  limit?: number
} = {}): Promise<PromptEngineeringGuideRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { guides } = await json<{ guides: PromptEngineeringGuideRow[] }>(
    fetch(`/api/prompt-engineering/guides${suffix}`),
  )
  return guides
}

export async function fetchPromptAntiPatternRules(params: {
  guideId?: string
  status?: OpenSourceGovernanceStatus
  limit?: number
} = {}): Promise<PromptAntiPatternRuleRow[]> {
  const qs = new URLSearchParams()
  if (params.guideId) qs.set('guideId', params.guideId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { rules } = await json<{ rules: PromptAntiPatternRuleRow[] }>(
    fetch(`/api/prompt-engineering/rules${suffix}`),
  )
  return rules
}

export async function evaluatePromptEngineeringGuide(body: {
  guideId?: string
  prompt: string
}): Promise<{
  guide: PromptEngineeringGuideRow
  tokenEstimate: number
  passed: boolean
  findings: Array<{ ruleKey: string; severity: RiskLevel; message: string }>
}> {
  const { evaluation } = await json<{
    evaluation: {
      guide: PromptEngineeringGuideRow
      tokenEstimate: number
      passed: boolean
      findings: Array<{ ruleKey: string; severity: RiskLevel; message: string }>
    }
  }>(
    fetch('/api/prompt-engineering/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evaluation
}

export interface PromptTemplateCatalog {
  promptTemplates: PromptTemplateRow[]
  promptTemplateVersions: PromptTemplateVersionRow[]
}

export interface CreatePromptTemplateBody {
  name: string
  description?: string
  scope?: PromptTemplateScope
  agentProfileId?: string | null
  engine?: PromptTemplateEngine
  template?: string
  variables?: PromptTemplateVariables
  conditionalBlocks?: PromptTemplateConditionalBlock[]
  status?: PromptTemplateStatus
  systemPrompt?: string
  content?: string
  contextRules?: string[]
  inputSchema?: JsonObject
  outputSchema?: JsonObject
  modelHints?: JsonObject
  abTest?: PromptVersionAbTest | null
  deployedAt?: number | null
  retiredAt?: number | null
}

export interface RenderPromptTemplateBody {
  agentProfileId?: string | null
  taskInput?: JsonObject
  runtimeState?: JsonObject
  memory?: JsonObject
  env?: JsonObject
}

export interface RenderPromptTemplateDto {
  template: PromptTemplateRow
  version: PromptTemplateVersionRow
  rendered: string
  renderedVariables: Record<string, string>
  missingVariables: string[]
  includedConditionalBlocks: string[]
  abTest: PromptVersionAbTest | null
  tokenEstimate: number
}

export type PackedContextSectionKind =
  | 'system_prompt'
  | 'goal'
  | 'input'
  | 'agent_profile'
  | 'prompt_template'
  | 'memory'
  | 'contract'
  | 'policy'
  | 'capability'
  | 'style_guide'
  | 'user_sovereignty'
  | 'agent_environment'

export type PackedContextSectionStatus = 'included' | 'truncated' | 'omitted'

export interface PackedContextSectionDto {
  id: string
  kind: PackedContextSectionKind
  title: string
  sourceId: string | null
  priority: number
  tokenEstimate: number
  tokenUsed: number
  status: PackedContextSectionStatus
  content: string
  reason: string
  matchedTerms: string[]
}

export interface AgentContextPackPreviewDto {
  agentProfile: AgentProfileRow
  promptTemplate: PromptTemplateRow | null
  promptTemplateVersion: PromptTemplateVersionRow | null
  tokenBudget: number
  tokenEstimate: number
  tokenUsed: number
  overflowTokens: number
  truncated: boolean
  memoryCount: number
  sections: PackedContextSectionDto[]
  packedContext: JsonObject
  summary: string
}

export interface PreviewAgentContextBody {
  goal: string
  input?: JsonObject
  tokenBudget?: number | null
  memoryLimit?: number
}

export interface CreateContextWindowVisualizationBody extends PreviewAgentContextBody {
  agentProfileId: string
  employeeRunId?: string | null
  runtimeContextSnapshotId?: string | null
}

export interface CreateContextCompressorPolicyBody {
  agentProfileId?: string | null
  name: string
  config?: Partial<ContextCompressorConfig>
  tokenBudgetConfig?: Partial<TokenBudgetAllocationConfig>
  status?: ContextCompressorPolicyStatus
}

export interface CreateContextCompressionPlanBody {
  policyId?: string | null
  agentProfileId?: string | null
  employeeRunId?: string | null
  runtimeContextSnapshotId?: string | null
  goal: string
  input?: JsonObject
  tokenBudget?: number | null
  tokenEstimate?: number | null
  memoryLimit?: number
  sections?: Array<{
    id?: string
    title: string
    kind?: string
    priority?: number
    tokenEstimate?: number
    tokenUsed?: number
    status?: PackedContextSectionStatus
    content?: string
  }>
}

export interface ContextWindowActionPlanDto {
  visualizationId: string
  actionType: ContextWindowActionType
  before: {
    tokenCapacity: number
    tokensUsed: number
    remainingTokens: number
    usedPercent: number
  }
  after: {
    tokenCapacity: number
    tokensUsed: number
    remainingTokens: number
    usedPercent: number
  }
  estimatedSavedTokens: number
  summary: string
  warnings: string[]
}

export async function fetchPromptTemplateCatalog(): Promise<PromptTemplateCatalog> {
  return json<PromptTemplateCatalog>(fetch('/api/prompt-templates'))
}

export async function createPromptTemplate(
  body: CreatePromptTemplateBody,
): Promise<{ promptTemplate: PromptTemplateRow; promptTemplateVersion: PromptTemplateVersionRow }> {
  return json<{ promptTemplate: PromptTemplateRow; promptTemplateVersion: PromptTemplateVersionRow }>(
    fetch('/api/prompt-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function renderPromptTemplate(
  templateId: string,
  body: RenderPromptTemplateBody = {},
): Promise<RenderPromptTemplateDto> {
  const { render } = await json<{ render: RenderPromptTemplateDto }>(
    fetch(`/api/prompt-templates/${templateId}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return render
}

export async function createPromptDriftMonitor(body: {
  agentProfileId?: string | null
  modelProfileId?: string | null
  name: string
  schedule?: PromptDriftSchedule
  checks?: Partial<PromptDriftChecks>
  onDriftDetected?: PromptDriftAction
  thresholds?: JsonObject
  status?: PromptDriftMonitorStatus
}): Promise<PromptDriftMonitorRow> {
  const { monitor } = await json<{ monitor: PromptDriftMonitorRow }>(
    fetch('/api/prompt-drift/monitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return monitor
}

export async function fetchPromptDriftMonitors(params: {
  agentProfileId?: string
  modelProfileId?: string
  schedule?: PromptDriftSchedule
  status?: PromptDriftMonitorStatus
  limit?: number
} = {}): Promise<PromptDriftMonitorRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.modelProfileId) qs.set('modelProfileId', params.modelProfileId)
  if (params.schedule) qs.set('schedule', params.schedule)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { monitors } = await json<{ monitors: PromptDriftMonitorRow[] }>(
    fetch(`/api/prompt-drift/monitors${suffix}`),
  )
  return monitors
}

export async function createModelBehaviorSnapshot(body: {
  monitorId?: string | null
  agentProfileId?: string | null
  modelProfileId?: string | null
  modelName: string
  modelDate: string
  providerVersion?: string | null
  benchmarkResults?: JsonObject
  pinned?: boolean
  notes?: string
}): Promise<ModelBehaviorSnapshotRow> {
  const { snapshot } = await json<{ snapshot: ModelBehaviorSnapshotRow }>(
    fetch('/api/prompt-drift/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return snapshot
}

export async function fetchModelBehaviorSnapshots(params: {
  monitorId?: string
  agentProfileId?: string
  modelProfileId?: string
  modelName?: string
  pinned?: boolean
  limit?: number
} = {}): Promise<ModelBehaviorSnapshotRow[]> {
  const qs = new URLSearchParams()
  if (params.monitorId) qs.set('monitorId', params.monitorId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.modelProfileId) qs.set('modelProfileId', params.modelProfileId)
  if (params.modelName) qs.set('modelName', params.modelName)
  if (params.pinned !== undefined) qs.set('pinned', String(params.pinned))
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { snapshots } = await json<{ snapshots: ModelBehaviorSnapshotRow[] }>(
    fetch(`/api/prompt-drift/snapshots${suffix}`),
  )
  return snapshots
}

export async function runPromptDriftCheck(body: {
  monitorId: string
  baselineSnapshotId?: string
  candidateSnapshotId?: string
  baselineResults?: JsonObject
  candidateResults?: JsonObject
}): Promise<PromptDriftRunRow> {
  const { run } = await json<{ run: PromptDriftRunRow }>(
    fetch('/api/prompt-drift/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return run
}

export async function fetchPromptDriftRuns(params: {
  monitorId?: string
  status?: PromptDriftRunStatus
  limit?: number
} = {}): Promise<PromptDriftRunRow[]> {
  const qs = new URLSearchParams()
  if (params.monitorId) qs.set('monitorId', params.monitorId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { runs } = await json<{ runs: PromptDriftRunRow[] }>(
    fetch(`/api/prompt-drift/runs${suffix}`),
  )
  return runs
}

export async function createDualModelVerification(body: {
  appliesTo: ConsensusCriticalTask
  primaryModelProfileId?: string | null
  secondaryModelProfileId?: string | null
  secondaryModel?: SecondaryModelStrategy
  primaryResult?: JsonObject
  secondaryResult?: JsonObject
}): Promise<DualModelVerificationRow> {
  const { verification } = await json<{ verification: DualModelVerificationRow }>(
    fetch('/api/consensus/dual-model-verifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return verification
}

export async function fetchDualModelVerifications(params: {
  appliesTo?: ConsensusCriticalTask
  recommendedAction?: ConsensusRecommendedAction
  limit?: number
} = {}): Promise<DualModelVerificationRow[]> {
  const qs = new URLSearchParams()
  if (params.appliesTo) qs.set('appliesTo', params.appliesTo)
  if (params.recommendedAction) qs.set('recommendedAction', params.recommendedAction)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { verifications } = await json<{ verifications: DualModelVerificationRow[] }>(
    fetch(`/api/consensus/dual-model-verifications${suffix}`),
  )
  return verifications
}

export async function createAgentConsensusVote(body: {
  question: string
  voters: Array<{
    agentId: string
    vote: string
    reasoning?: string
    confidence?: number
  }>
  quorum: number
  requiredMajority: number
  tieBreaker?: AgentVotingTieBreaker
}): Promise<AgentConsensusVoteRow> {
  const { vote } = await json<{ vote: AgentConsensusVoteRow }>(
    fetch('/api/consensus/agent-votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return vote
}

export async function fetchAgentConsensusVotes(params: {
  decision?: AgentVotingDecision
  limit?: number
} = {}): Promise<AgentConsensusVoteRow[]> {
  const qs = new URLSearchParams()
  if (params.decision) qs.set('decision', params.decision)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { votes } = await json<{ votes: AgentConsensusVoteRow[] }>(
    fetch(`/api/consensus/agent-votes${suffix}`),
  )
  return votes
}

export async function createAdversarialReview(body: {
  subjectAgentId?: string | null
  reviewerAgentId?: string | null
  targetTitle: string
  targetContent?: JsonObject
  skepticism?: number
  assumptions?: string[]
  missedCases?: string[]
  attackerExploitation?: string[]
  worstCases?: string[]
}): Promise<AdversarialReviewRow> {
  const { review } = await json<{ review: AdversarialReviewRow }>(
    fetch('/api/consensus/adversarial-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return review
}

export async function fetchAdversarialReviews(params: {
  status?: AdversarialReviewStatus
  subjectAgentId?: string
  reviewerAgentId?: string
  limit?: number
} = {}): Promise<AdversarialReviewRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.subjectAgentId) qs.set('subjectAgentId', params.subjectAgentId)
  if (params.reviewerAgentId) qs.set('reviewerAgentId', params.reviewerAgentId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { reviews } = await json<{ reviews: AdversarialReviewRow[] }>(
    fetch(`/api/consensus/adversarial-reviews${suffix}`),
  )
  return reviews
}

export async function seedContentSafetyPolicies(): Promise<ContentSafetyPolicyRow[]> {
  const { policies } = await json<{ policies: ContentSafetyPolicyRow[] }>(
    fetch('/api/content-safety/policies/seed', { method: 'POST' }),
  )
  return policies
}

export async function createContentSafetyPolicy(body: {
  name?: string
  layers?: Partial<ContentSafetyLayers>
  onFlag?: ContentSafetyAction
  status?: ContentSafetyPolicyStatus
}): Promise<ContentSafetyPolicyRow> {
  const { policy } = await json<{ policy: ContentSafetyPolicyRow }>(
    fetch('/api/content-safety/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return policy
}

export async function fetchContentSafetyPolicies(params: {
  status?: ContentSafetyPolicyStatus
  onFlag?: ContentSafetyAction
  limit?: number
} = {}): Promise<ContentSafetyPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.onFlag) qs.set('onFlag', params.onFlag)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: ContentSafetyPolicyRow[] }>(
    fetch(`/api/content-safety/policies${suffix}`),
  )
  return policies
}

export async function scanContentSafetyOutput(body: {
  policyId?: string | null
  agentProfileId?: string | null
  employeeRunId?: string | null
  artifactId?: string | null
  contentType?: SafetyReviewedContentType
  content: string
  userConsentedToCloudSafety?: boolean
}): Promise<ContentSafetyScanRow> {
  const { scan } = await json<{ scan: ContentSafetyScanRow }>(
    fetch('/api/content-safety/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return scan
}

export async function fetchContentSafetyScans(params: {
  policyId?: string
  agentProfileId?: string
  status?: ContentSafetyScanStatus
  limit?: number
} = {}): Promise<ContentSafetyScanRow[]> {
  const qs = new URLSearchParams()
  if (params.policyId) qs.set('policyId', params.policyId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { scans } = await json<{ scans: ContentSafetyScanRow[] }>(
    fetch(`/api/content-safety/scans${suffix}`),
  )
  return scans
}

export async function createCopyrightCheck(body: {
  scanId?: string | null
  agentProfileId?: string | null
  artifactId?: string | null
  contentType?: SafetyReviewedContentType
  config?: Partial<CopyrightCheckConfig>
  content?: string
  knownSources?: Array<{
    sourceRef: string
    content: string
    license?: string | null
    attribution?: string | null
  }>
  imageMetadata?: JsonObject
}): Promise<CopyrightCheckRow> {
  const { check } = await json<{ check: CopyrightCheckRow }>(
    fetch('/api/content-safety/copyright-checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return check
}

export async function fetchCopyrightChecks(params: {
  scanId?: string
  agentProfileId?: string
  status?: CopyrightCheckStatus
  limit?: number
} = {}): Promise<CopyrightCheckRow[]> {
  const qs = new URLSearchParams()
  if (params.scanId) qs.set('scanId', params.scanId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { checks } = await json<{ checks: CopyrightCheckRow[] }>(
    fetch(`/api/content-safety/copyright-checks${suffix}`),
  )
  return checks
}

export async function seedTrustCalibrationPolicies(): Promise<TrustCalibrationPolicyRow[]> {
  const { policies } = await json<{ policies: TrustCalibrationPolicyRow[] }>(
    fetch('/api/trust-calibration/policies/seed', { method: 'POST' }),
  )
  return policies
}

export async function createTrustCalibrationPolicy(body: {
  agentProfileId?: string | null
  name?: string
  config?: {
    highConfidenceIndicators?: Partial<TrustCalibrationConfig['highConfidenceIndicators']>
    lowConfidenceIndicators?: Partial<TrustCalibrationConfig['lowConfidenceIndicators']>
    antiOverTrust?: Partial<TrustCalibrationConfig['antiOverTrust']>
  }
  status?: TrustCalibrationPolicyStatus
}): Promise<TrustCalibrationPolicyRow> {
  const { policy } = await json<{ policy: TrustCalibrationPolicyRow }>(
    fetch('/api/trust-calibration/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return policy
}

export async function fetchTrustCalibrationPolicies(params: {
  agentProfileId?: string
  status?: TrustCalibrationPolicyStatus
  limit?: number
} = {}): Promise<TrustCalibrationPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: TrustCalibrationPolicyRow[] }>(
    fetch(`/api/trust-calibration/policies${suffix}`),
  )
  return policies
}

export async function evaluateTrustCalibration(body: {
  policyId?: string | null
  agentProfileId?: string | null
  currentAutonomyLevel?: AutonomyLevel
  metrics?: Partial<TrustCalibrationMetrics>
}): Promise<TrustCalibrationEvaluationRow> {
  const { evaluation } = await json<{ evaluation: TrustCalibrationEvaluationRow }>(
    fetch('/api/trust-calibration/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evaluation
}

export async function fetchTrustCalibrationEvaluations(params: {
  policyId?: string
  agentProfileId?: string
  recommendation?: TrustCalibrationRecommendation
  limit?: number
} = {}): Promise<TrustCalibrationEvaluationRow[]> {
  const qs = new URLSearchParams()
  if (params.policyId) qs.set('policyId', params.policyId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.recommendation) qs.set('recommendation', params.recommendation)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { evaluations } = await json<{ evaluations: TrustCalibrationEvaluationRow[] }>(
    fetch(`/api/trust-calibration/evaluations${suffix}`),
  )
  return evaluations
}

export interface BudgetUsageReportRow {
  key: string
  label: string
  agentProfileId: string | null
  projectId: string | null
  runCount: number
  evaluationCount: number
  blockedCount: number
  notifyCount: number
  estimatedCostUsd: number
  actualCostUsd: number
}

export interface BudgetUsageReport {
  groupBy: BudgetUsageGroupBy
  from: number | null
  to: number | null
  rows: BudgetUsageReportRow[]
  csv: string
}

export async function seedBudgetPolicies(): Promise<BudgetPolicyRow[]> {
  const { policies } = await json<{ policies: BudgetPolicyRow[] }>(
    fetch('/api/budget-control/policies/seed', { method: 'POST' }),
  )
  return policies
}

export async function createBudgetPolicy(body: {
  agentProfileId?: string | null
  projectId?: string | null
  name?: string
  scope?: BudgetScope
  limitType?: BudgetLimitType
  limit: number
  hardCap?: boolean
  notifyAtPercent?: number
  config?: {
    routingRules?: BudgetModelRoutingRule[]
    estimateFactors?: {
      modelUnitPriceUsd?: number
      averageStepTokens?: number
      visionMultiplier?: number
      largeContextMultiplier?: number
      historicalTaskWeight?: number
    }
    reportTags?: string[]
  }
  status?: BudgetPolicyStatus
}): Promise<BudgetPolicyRow> {
  const { policy } = await json<{ policy: BudgetPolicyRow }>(
    fetch('/api/budget-control/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return policy
}

export async function fetchBudgetPolicies(params: {
  scope?: BudgetScope
  status?: BudgetPolicyStatus
  agentProfileId?: string
  projectId?: string
  limit?: number
} = {}): Promise<BudgetPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.scope) qs.set('scope', params.scope)
  if (params.status) qs.set('status', params.status)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.projectId) qs.set('projectId', params.projectId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: BudgetPolicyRow[] }>(
    fetch(`/api/budget-control/policies${suffix}`),
  )
  return policies
}

export async function evaluateBudget(body: {
  policyId?: string | null
  scope?: BudgetScope
  agentProfileId?: string | null
  employeeRunId?: string | null
  projectId?: string | null
  observedTokens?: number
  estimatedAdditionalTokens?: number
  observedUsd?: number
  estimatedAdditionalUsd?: number
  selectedModelProfileId?: string | null
  task?: JsonObject
  costBreakdown?: Partial<BudgetCostBreakdown>
}): Promise<BudgetEvaluationRow> {
  const { evaluation } = await json<{ evaluation: BudgetEvaluationRow }>(
    fetch('/api/budget-control/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evaluation
}

export async function fetchBudgetEvaluations(params: {
  policyId?: string
  agentProfileId?: string
  projectId?: string
  status?: BudgetEvaluationStatus
  limit?: number
} = {}): Promise<BudgetEvaluationRow[]> {
  const qs = new URLSearchParams()
  if (params.policyId) qs.set('policyId', params.policyId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.projectId) qs.set('projectId', params.projectId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { evaluations } = await json<{ evaluations: BudgetEvaluationRow[] }>(
    fetch(`/api/budget-control/evaluations${suffix}`),
  )
  return evaluations
}

export async function fetchBudgetUsageReport(params: {
  groupBy?: BudgetUsageGroupBy
  agentProfileId?: string
  projectId?: string
  from?: number
  to?: number
} = {}): Promise<BudgetUsageReport> {
  const qs = new URLSearchParams()
  if (params.groupBy) qs.set('groupBy', params.groupBy)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.projectId) qs.set('projectId', params.projectId)
  if (params.from !== undefined) qs.set('from', String(params.from))
  if (params.to !== undefined) qs.set('to', String(params.to))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { report } = await json<{ report: BudgetUsageReport }>(
    fetch(`/api/budget-control/usage-report${suffix}`),
  )
  return report
}

export async function previewAgentContextPack(
  agentProfileId: string,
  body: PreviewAgentContextBody,
): Promise<AgentContextPackPreviewDto> {
  return json<AgentContextPackPreviewDto>(
    fetch(`/api/agent-profiles/${agentProfileId}/context-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function seedContextCompressorPolicies(): Promise<ContextCompressorPolicyRow[]> {
  const { policies } = await json<{ policies: ContextCompressorPolicyRow[] }>(
    fetch('/api/context-compressors/policies/seed', { method: 'POST' }),
  )
  return policies
}

export async function createContextCompressorPolicy(
  body: CreateContextCompressorPolicyBody,
): Promise<ContextCompressorPolicyRow> {
  const { policy } = await json<{ policy: ContextCompressorPolicyRow }>(
    fetch('/api/context-compressors/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return policy
}

export async function fetchContextCompressorPolicies(params: {
  agentProfileId?: string
  status?: ContextCompressorPolicyStatus
  limit?: number
} = {}): Promise<ContextCompressorPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: ContextCompressorPolicyRow[] }>(
    fetch(`/api/context-compressors/policies${suffix}`),
  )
  return policies
}

export async function createContextCompressionPlan(
  body: CreateContextCompressionPlanBody,
): Promise<ContextCompressionPlanRow> {
  const { plan } = await json<{ plan: ContextCompressionPlanRow }>(
    fetch('/api/context-compressors/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return plan
}

export async function fetchContextCompressionPlans(params: {
  policyId?: string
  agentProfileId?: string
  status?: ContextCompressionPlanStatus
  limit?: number
} = {}): Promise<ContextCompressionPlanRow[]> {
  const qs = new URLSearchParams()
  if (params.policyId) qs.set('policyId', params.policyId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { plans } = await json<{ plans: ContextCompressionPlanRow[] }>(
    fetch(`/api/context-compressors/plans${suffix}`),
  )
  return plans
}

export async function createContextWindowVisualization(
  body: CreateContextWindowVisualizationBody,
): Promise<ContextWindowVisualizationRow> {
  const { visualization } = await json<{ visualization: ContextWindowVisualizationRow }>(
    fetch('/api/context-window-visualizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return visualization
}

export async function fetchContextWindowVisualizations(params: {
  agentProfileId?: string
  employeeRunId?: string
  limit?: number
} = {}): Promise<ContextWindowVisualizationRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.employeeRunId) qs.set('employeeRunId', params.employeeRunId)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { visualizations } = await json<{ visualizations: ContextWindowVisualizationRow[] }>(
    fetch(`/api/context-window-visualizations${suffix}`),
  )
  return visualizations
}

export async function planContextWindowAction(
  visualizationId: string,
  actionType: ContextWindowActionType,
): Promise<ContextWindowActionPlanDto> {
  const { actionPlan } = await json<{ actionPlan: ContextWindowActionPlanDto }>(
    fetch(`/api/context-window-visualizations/${visualizationId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType }),
    }),
  )
  return actionPlan
}

export interface CreateSecretBody {
  name: string
  kind?: SecretKind
  valueRef?: string
  encryptedValue?: string
}

export async function fetchSecrets(): Promise<SecretVaultRow[]> {
  const { secrets } = await json<{ secrets: SecretVaultRow[] }>(fetch('/api/security/secrets'))
  return secrets
}

export async function createSecret(body: CreateSecretBody): Promise<SecretVaultRow> {
  const { secret } = await json<{ secret: SecretVaultRow }>(
    fetch('/api/security/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return secret
}

export interface CreateCredentialScopeBody {
  secretId: string
  resourceType: CredentialResourceType
  resourceId: string
  capability?: string
}

export async function fetchCredentialScopes(): Promise<CredentialScopeRow[]> {
  const { credentialScopes } = await json<{ credentialScopes: CredentialScopeRow[] }>(
    fetch('/api/security/credential-scopes'),
  )
  return credentialScopes
}

export async function createCredentialScope(
  body: CreateCredentialScopeBody,
): Promise<CredentialScopeRow> {
  const { credentialScope } = await json<{ credentialScope: CredentialScopeRow }>(
    fetch('/api/security/credential-scopes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return credentialScope
}

export interface CreateSandboxPolicyBody {
  name: string
  level?: SandboxPolicyRow['level']
  allowedPaths?: string[]
  deniedPaths?: string[]
  allowedCommands?: string[]
  networkMode?: SandboxNetworkMode
  requiresApprovalForWrites?: boolean
}

export async function fetchSandboxPolicies(): Promise<SandboxPolicyRow[]> {
  const { sandboxPolicies } = await json<{ sandboxPolicies: SandboxPolicyRow[] }>(
    fetch('/api/security/sandbox-policies'),
  )
  return sandboxPolicies
}

export async function createSandboxPolicy(
  body: CreateSandboxPolicyBody,
): Promise<SandboxPolicyRow> {
  const { sandboxPolicy } = await json<{ sandboxPolicy: SandboxPolicyRow }>(
    fetch('/api/security/sandbox-policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return sandboxPolicy
}

export async function evaluateSandboxPolicy(
  sandboxPolicyId: string,
  body: {
    action: 'read_file' | 'write_file' | 'run_command' | 'network'
    targetPath?: string | null
    command?: string | null
  },
): Promise<{ status: 'allowed' | 'blocked' | 'warning'; reason: string; requiresApproval: boolean }> {
  const { decision } = await json<{
    decision: { status: 'allowed' | 'blocked' | 'warning'; reason: string; requiresApproval: boolean }
  }>(
    fetch(`/api/security/sandbox-policies/${sandboxPolicyId}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return decision
}

export async function fetchAuditLogs(limit = 100): Promise<AuditLogRow[]> {
  const { auditLogs } = await json<{ auditLogs: AuditLogRow[] }>(
    fetch(`/api/security/audit-logs?limit=${limit}`),
  )
  return auditLogs
}

export interface CreateSecurityFindingBody {
  sourceType: string
  sourceId?: string | null
  category: string
  severity?: SecurityFindingSeverity
  action?: SecurityFindingAction
  message: string
  evidence?: string
}

export async function fetchSecurityFindings(limit = 100): Promise<SecurityFindingRow[]> {
  const { securityFindings } = await json<{ securityFindings: SecurityFindingRow[] }>(
    fetch(`/api/security/findings?limit=${limit}`),
  )
  return securityFindings
}

export async function createSecurityFinding(
  body: CreateSecurityFindingBody,
): Promise<SecurityFindingRow> {
  const { securityFinding } = await json<{ securityFinding: SecurityFindingRow }>(
    fetch('/api/security/findings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return securityFinding
}

export async function scanSecurityFinding(body: {
  text: string
  sourceType: string
  sourceId?: string | null
}): Promise<SecurityFindingRow | null> {
  const { securityFinding } = await json<{ securityFinding: SecurityFindingRow | null }>(
    fetch('/api/security/findings/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return securityFinding
}

export type ProductionIntegrationStatus =
  | 'ready'
  | 'available'
  | 'not_configured'
  | 'not_installed'
  | 'blocked'
  | 'unknown'

export interface ProductionProbeResultDto {
  key: string
  label: string
  status: ProductionIntegrationStatus
  evidence: string[]
  warnings: string[]
  nextActions: string[]
  checkedAt: number
}

export interface DesktopAutomationProbeDto extends ProductionProbeResultDto {
  platform: string
  canObserveWindows: boolean
  canControlPhysicalDesktop: boolean
  windowSamples: Array<{ processName: string; title: string }>
}

export interface MobileAutomationDiscoveryDto extends ProductionProbeResultDto {
  adb: {
    command: string
    available: boolean
    path?: string
    version?: string
    error?: string
  }
  appium: {
    command: string
    available: boolean
    path?: string
    version?: string
    error?: string
  }
  devices: Array<{ id: string; status: string; description: string }>
}

export interface WorkstationProviderDiscoveryDto extends ProductionProbeResultDto {
  providers: Array<{
    key: 'rdp' | 'hyperv' | 'virtualbox' | 'vmware' | 'vnc'
    label: string
    available: boolean
    command?: string
    evidence: string[]
    warnings: string[]
  }>
}

export interface ProductionIntegrationReadinessDto {
  status: ProductionIntegrationStatus
  readinessScore: number
  generatedAt: number
  categories: ProductionProbeResultDto[]
  summary: {
    modelProfiles: number
    modelProfilesUsingVault: number
    modelProfilesWithScopedVaultCredentials: number
    liveModelTests: number
    modelCapabilityProbes: number
    successfulModelCapabilityProbes: number
    modelGatewayAuditLogs: number
    modelGatewayInvokeAuditLogs: number
    secrets: number
    desktopPlatform: string
    mobileCompanionConfigured: boolean
    agentWorkstations: number
  }
}

export interface ProductionModelCredentialReportDto {
  status: ProductionIntegrationStatus
  readinessScore: number
  generatedAt: number
  summary: {
    modelProfiles: number
    readyModels: number
    vaultBackedModels: number
    envBackedModels: number
    unresolvedModels: number
    inlineSecretBlockedModels: number
    scopedForConnect: number
    scopedForInvoke: number
    liveConnectionOk: number
    liveInvocationOk: number
  }
  models: ProductionModelCredentialItemDto[]
  blockers: string[]
  nextActions: string[]
}

export interface ProductionModelCredentialIntakeReportDto {
  status: ProductionIntegrationStatus
  readinessScore: number
  generatedAt: number
  redacted: true
  summary: {
    totalModels: number
    vaultReadyModels: number
    envMigratableModels: number
    inlineSecretBlockedModels: number
    missingScopeModels: number
    migratedSecretRefs: number
  }
  items: ProductionModelCredentialIntakeItemDto[]
  blockers: string[]
  nextActions: string[]
  safetyNotice: string
}

export interface ProductionModelCredentialIntakeItemDto {
  modelProfileId: string
  name: string
  provider: string
  model: string
  status: ProductionIntegrationStatus
  credentialRefKind: ProductionModelCredentialItemDto['credential']['refKind']
  currentRefPreview: string
  proposedSecretRef: string | null
  proposedEnvVar: string | null
  envValuePresent: boolean | null
  secretId: string | null
  connectScope: ProductionModelCredentialItemDto['credential']['connectScope']
  invokeScope: ProductionModelCredentialItemDto['credential']['invokeScope']
  canMigrateFromEnv: boolean
  canAttachExistingSecret: boolean
  requiresManualSecretInput: boolean
  redacted: true
  evidence: string[]
  blockers: string[]
  nextActions: string[]
}

export interface ProductionModelCredentialIntakeApplyResultDto {
  applied: boolean
  redacted: true
  modelProfileId: string
  previousApiKeyRef: string
  nextApiKeyRef: string
  secretId: string | null
  createdSecret: boolean
  createdScopes: string[]
  status: ProductionIntegrationStatus
  message: string
  plan: ProductionModelCredentialIntakeItemDto
}

export interface ProductionModelCredentialItemDto {
  modelProfileId: string
  name: string
  provider: string
  model: string
  baseUrlHost: string
  networkProfileId: string | null
  status: ProductionIntegrationStatus
  credential: {
    refKind: 'secret_vault' | 'env' | 'unresolved' | 'inline_secret_blocked'
    refPreview: string
    envVar: string | null
    envValuePresent: boolean | null
    secretId: string | null
    secretName: string | null
    secretKind: string | null
    secretStatus: string | null
    secretValuePresent: boolean | null
    secretResolvable: boolean | null
    connectScope: 'allowed' | 'missing' | 'not_applicable'
    invokeScope: 'allowed' | 'missing' | 'not_applicable'
  }
  latestLiveConnection: ProductionModelCredentialTestEvidenceDto | null
  latestLiveInvocation: ProductionModelCredentialTestEvidenceDto | null
  evidence: string[]
  warnings: string[]
  nextActions: string[]
}

export interface ProductionModelCredentialTestEvidenceDto {
  id: string
  status: HealthStatus
  mode: 'dry_run' | 'live'
  message: string
  latencyMs: number | null
  createdAt: number
}

export interface ProductionHardeningReportDto {
  status: ProductionIntegrationStatus
  readinessScore: number
  generatedAt: number
  app: {
    name: string
    version: string
    platform: string
    arch: string
    node: string
    electronMode: 'dev' | 'packaged' | 'node'
    dataDir: string
  }
  checks: ProductionProbeResultDto[]
  counts: {
    modelProfiles: number
    liveModelTests: number
    modelCapabilityProbes: number
    successfulModelCapabilityProbes: number
    modelGatewayAuditLogs: number
    modelGatewayInvokeAuditLogs: number
    secrets: number
    scopedCredentials: number
    agentWorkstations: number
    computerSessions: number
    softwareCommands: number
    runtimeMappedSoftwareCommands: number
    softwareCommandRuns: number
    softwareCommandApprovals: number
    approvalBoundSoftwareCommandApprovals: number
    approvedSoftwareCommandApprovals: number
    runtimeControlApprovals: number
    approvalBoundRuntimeControlApprovals: number
    approvedRuntimeControlApprovals: number
    runtimeControlActions: number
    completedRuntimeControlActions: number
    blockedRuntimeControlActions: number
    successfulWorkstationValidations: number
    blockedWorkstationValidations: number
    workstationReleaseActions: number
    staleBusyWorkstations: number
    recoverableStaleBusyWorkstations: number
    mobileScreenshotActions: number
    auditLogs: number
  }
  gaps: string[]
  warnings: string[]
  recommendations: string[]
}

export interface RuntimeControlReadinessReportDto {
  status: ProductionIntegrationStatus
  readinessScore: number
  generatedAt: number
  gates: RuntimeControlGateProbeDto[]
  workstationChecks: WorkstationReadinessProbeDto[]
  summary: {
    runtimeControlActions: number
    completedRuntimeControlActions: number
    blockedRuntimeControlActions: number
    approvedRuntimeControlApprovals: number
    enabledHighRiskGates: number
    totalHighRiskGates: number
    readyWorkstations: number
    blockedWorkstations: number
  }
  recommendations: string[]
}

export type ProductionExecutionPreflightDomainDto = 'model' | 'desktop' | 'mobile' | 'workstation'

export interface ProductionExecutionPreflightReportDto {
  status: ProductionIntegrationStatus
  readinessScore: number
  generatedAt: number
  safeToExecuteAnyLiveAction: boolean
  canExecuteReadOnly: boolean
  summary: {
    totalActions: number
    executableNow: number
    blocked: number
    readOnly: number
    highRisk: number
    enabledEnvGates: number
    requiredEnvGates: number
    readyModels: number
    readyWorkstations: number
  }
  actions: ProductionExecutionPreflightActionDto[]
  blockers: string[]
  nextActions: string[]
  safetyNotice: string
}

export interface ProductionExecutionPreflightActionDto {
  id: string
  domain: ProductionExecutionPreflightDomainDto
  label: string
  actionType: string
  riskLevel: 'low' | 'medium' | 'high'
  status: ProductionIntegrationStatus
  canExecuteNow: boolean
  dryRunAvailable: boolean
  readOnly: boolean
  requiresApproval: boolean
  requiresGoLiveHash: boolean
  requiredEnvVars: ProductionExecutionPreflightEnvGateDto[]
  evidence: string[]
  blockers: string[]
  nextActions: string[]
}

export interface ProductionExecutionPreflightEnvGateDto {
  envVar: string
  enabled: boolean
  required: boolean
  purpose: string
}

export type ProductionGoLiveDrillDomainDto =
  | 'model'
  | 'desktop'
  | 'mobile'
  | 'workstation'
  | 'customer'
  | 'go_live'

export interface ProductionGoLiveDrillReportDto {
  status: ProductionIntegrationStatus
  readinessScore: number
  generatedAt: number
  safeToStartLivePilot: boolean
  willTouchExternalSystems: false
  summary: {
    totalScenarios: number
    passedScenarios: number
    blockedScenarios: number
    readOnlyScenarios: number
    highRiskScenarios: number
    goLiveGateAllowed: boolean
    customerAuthorized: boolean
    environmentFingerprintMatched: boolean
  }
  scenarios: ProductionGoLiveDrillScenarioDto[]
  blockers: string[]
  nextActions: string[]
  safetyNotice: string
}

export interface ProductionGoLiveDrillScenarioDto {
  id: string
  domain: ProductionGoLiveDrillDomainDto
  title: string
  target: string
  riskLevel: 'low' | 'medium' | 'high'
  readOnly: boolean
  status: ProductionIntegrationStatus
  canPassNow: boolean
  evidence: string[]
  blockers: string[]
  nextActions: string[]
}

export interface RealControlRuntimeAcceptanceReportDto {
  status: ProductionIntegrationStatus
  readinessScore: number
  generatedAt: number
  safeToUseLiveControls: boolean
  summary: {
    desktopReady: boolean
    mobileReady: boolean
    workstationReady: boolean
    customerAuthorized: boolean
    customerAuthorizationSwitchEnabled: boolean
    customerAuthorizationEvidenceHashPresent: boolean
    customerAuthorizationEvidenceMatched: boolean
    enabledHighRiskGates: number
    totalHighRiskGates: number
    liveExecutions: number
    blockedActions: number
    readyWorkstations: number
    blockedWorkstations: number
  }
  desktop: RealControlDomainAcceptanceDto
  mobile: RealControlDomainAcceptanceDto
  workstations: RealControlDomainAcceptanceDto
  checks: ProductionProbeResultDto[]
  blockers: string[]
  nextActions: string[]
}

export interface RealControlDomainAcceptanceDto {
  key: 'desktop' | 'mobile' | 'workstation'
  label: string
  status: ProductionIntegrationStatus
  toolchainStatus: ProductionIntegrationStatus
  gates: RuntimeControlGateProbeDto[]
  evidence: string[]
  warnings: string[]
  blockers: string[]
  nextActions: string[]
  liveExecutions: number
  blockedActions: number
  ready: boolean
}

export interface ProductionLiveConnectorReportDto {
  status: ProductionIntegrationStatus
  readinessScore: number
  generatedAt: number
  safeToActivateLive: boolean
  connectors: ProductionLiveConnectorDto[]
  summary: {
    total: number
    ready: number
    available: number
    blocked: number
    models: number
    modelReady: number
    desktopReady: boolean
    mobileReady: boolean
    workstationReady: boolean
    customerAuthorized: boolean
    customerAuthorizationSwitchEnabled: boolean
    customerAuthorizationEvidenceHashPresent: boolean
    customerAuthorizationEvidenceMatched: boolean
  }
  checks: ProductionProbeResultDto[]
  blockers: string[]
  nextActions: string[]
}

export interface ProductionLiveConnectorDto {
  id: string
  kind: 'model' | 'desktop' | 'mobile' | 'workstation' | 'customer_authorization'
  label: string
  status: ProductionIntegrationStatus
  ready: boolean
  ownerId: string | null
  routeLabel: string
  verification: {
    dryRunAvailable: boolean
    liveEvidenceCount: number
    lastLiveEvidenceAt: number | null
  }
  envGates: ProductionLiveConnectorEnvGateDto[]
  evidence: string[]
  warnings: string[]
  blockers: string[]
  nextActions: string[]
}

export interface ProductionLiveConnectorEnvGateDto {
  envVar: string
  label: string
  enabled: boolean
  requiredForLive: boolean
}

export type ProductionOnsiteIntakeDomain =
  | 'model_credentials'
  | 'network_routes'
  | 'desktop_control'
  | 'mobile_control'
  | 'workstations'
  | 'customer_authorization'
  | 'runtime_guardrails'
  | 'hardening'
  | 'go_live'

export type ProductionOnsiteIntakeFieldKind =
  | 'secret_ref'
  | 'env_var'
  | 'network_profile'
  | 'device_id'
  | 'rdp_config'
  | 'vnc_url'
  | 'approval'
  | 'evidence'
  | 'command'
  | 'hash'

export type ProductionOnsiteIntakeFieldStatus = 'ready' | 'missing' | 'needs_review'

export interface ProductionOnsiteIntakeChecklistDto {
  status: ProductionIntegrationStatus
  readinessScore: number
  generatedAt: number
  redacted: true
  canProceedToGoLive: boolean
  summary: {
    totalItems: number
    readyItems: number
    blockedItems: number
    missingFields: number
    highRiskItems: number
    modelItems: number
    workstationItems: number
  }
  items: ProductionOnsiteIntakeItemDto[]
  blockers: string[]
  nextActions: string[]
  safetyNotice: string
}

export interface ProductionOnsiteIntakeItemDto {
  id: string
  domain: ProductionOnsiteIntakeDomain
  title: string
  ownerId: string | null
  status: ProductionIntegrationStatus
  ready: boolean
  riskLevel: 'low' | 'medium' | 'high'
  fields: ProductionOnsiteIntakeFieldDto[]
  validationCommands: ProductionOnsiteCommandDto[]
  evidence: string[]
  blockers: string[]
  nextActions: string[]
}

export interface ProductionOnsiteIntakeFieldDto {
  key: string
  label: string
  kind: ProductionOnsiteIntakeFieldKind
  required: boolean
  redacted: boolean
  currentStatus: ProductionOnsiteIntakeFieldStatus
  valuePreview: string | null
  instructions: string[]
}

export interface ProductionOnsiteActivationGuideDto {
  status: ProductionIntegrationStatus
  readinessScore: number
  generatedAt: number
  safeToStartDryRun: boolean
  safeToActivateLive: boolean
  summary: {
    totalSteps: number
    doneSteps: number
    needsActionSteps: number
    blockedSteps: number
    envGates: number
    enabledEnvGates: number
    connectors: number
    readyConnectors: number
  }
  steps: ProductionOnsiteActivationStepDto[]
  envChecklist: ProductionOnsiteEnvInstructionDto[]
  validationCommands: ProductionOnsiteCommandDto[]
  rollbackPlan: ProductionOnsiteCommandDto[]
  blockers: string[]
  nextActions: string[]
}

export interface ProductionOnsiteActivationStepDto {
  id: string
  phase:
    | 'authorization'
    | 'credentials'
    | 'network'
    | 'desktop'
    | 'mobile'
    | 'workstation'
    | 'verification'
    | 'rollback'
  title: string
  status: ProductionSetupStepStatus
  riskLevel: 'low' | 'medium' | 'high'
  automationAvailable: boolean
  evidence: string[]
  actions: string[]
  verification: string[]
  rollback: string[]
}

export interface ProductionOnsiteEnvInstructionDto {
  envVar: string
  label: string
  enabled: boolean
  requiredForLive: boolean
  valueHint: string
  powershellPreview: string
}

export interface ProductionOnsiteCommandDto {
  label: string
  command: string
  riskLevel: 'low' | 'medium' | 'high'
  requiresHuman: boolean
  notes: string[]
}

export interface ProductionOnsiteActivationPackageDto {
  id: string
  generatedAt: number
  redacted: true
  contentHash: string
  guide: ProductionOnsiteActivationGuideDto
  files: {
    manifestPath: string
    markdownPath: string
    activationScriptPath: string
    rollbackScriptPath: string
    manifestFileName: string
    markdownFileName: string
    activationScriptFileName: string
    rollbackScriptFileName: string
  }
  summary: {
    status: ProductionIntegrationStatus
    readinessScore: number
    safeToActivateLive: boolean
    totalSteps: number
    blockedSteps: number
    rollbackCommands: number
  }
}

export type ProductionFinalAcceptanceCategoryKey =
  | 'model_credentials'
  | 'desktop_control'
  | 'mobile_control'
  | 'workstations'
  | 'customer_authorization'
  | 'runtime_guardrails'
  | 'hardening'
  | 'rollback'

export interface ProductionFinalAcceptanceLedgerDto {
  status: ProductionIntegrationStatus
  readinessScore: number
  generatedAt: number
  canClaimProductionReady: boolean
  categories: ProductionFinalAcceptanceCategoryDto[]
  summary: {
    total: number
    passed: number
    needsAction: number
    blocked: number
    evidenceItems: number
    requiredEvidenceItems: number
    onsiteEvidenceItems: number
    latestPackageHash: string | null
    latestEvidenceHash: string | null
    customerAuthorizationEvidenceHash: string | null
    customerAuthorizationEvidenceMatched: boolean
  }
  evidence: string[]
  blockers: string[]
  nextActions: string[]
}

export interface ProductionFinalAcceptanceCategoryDto {
  key: ProductionFinalAcceptanceCategoryKey
  title: string
  status: ProductionIntegrationStatus
  passed: boolean
  requiredEvidence: string[]
  presentEvidence: string[]
  missingEvidence: string[]
  blockers: string[]
  nextActions: string[]
}

export interface ProductionOnsiteEvidenceReportDto {
  generatedAt: number
  records: ProductionOnsiteEvidenceRecordDto[]
  summary: {
    total: number
    categoriesCovered: number
    latestEvidenceHash: string | null
    byCategory: Record<ProductionFinalAcceptanceCategoryKey, number>
  }
}

export interface ProductionOnsiteEvidenceRecordDto {
  id: string
  category: ProductionFinalAcceptanceCategoryKey
  title: string
  evidence: string[]
  notes: string | null
  operator: string | null
  externalRef: string | null
  riskLevel: 'low' | 'medium' | 'high'
  contentHash: string
  verifiedAt: number
  createdAt: number
}

export interface ProductionGoLiveDecisionDto {
  id: string
  generatedAt: number
  decision: 'approved' | 'blocked'
  status: ProductionIntegrationStatus
  readinessScore: number
  contentHash: string
  canActivateLive: boolean
  ledgerSnapshot: {
    status: ProductionIntegrationStatus
    readinessScore: number
    canClaimProductionReady: boolean
    passed: number
    total: number
    blockers: number
    onsiteEvidenceItems: number
    latestPackageHash: string | null
    latestEvidenceHash: string | null
    customerAuthorizationEvidenceHash: string | null
    customerAuthorizationEvidenceMatched: boolean
  }
  environmentFingerprint: ProductionGoLiveEnvironmentFingerprintDto[]
  activationPlan: ProductionGoLiveActivationInstructionDto[]
  approvedHashInstruction: ProductionGoLiveActivationInstructionDto
  rollbackPlan: ProductionOnsiteCommandDto[]
  blockedReasons: string[]
  nextActions: string[]
  safetyNotice: string
}

export interface ProductionLivePilotLeaseDto {
  id: string
  generatedAt: number
  expiresAt: number
  durationMinutes: number
  status: 'active' | 'blocked' | 'expired'
  contentHash: string
  currentlyEnabled: boolean
  goLiveDecisionHash: string | null
  customerAuthorizationEvidenceHash: string | null
  environmentFingerprintHash: string | null
  environmentFingerprintItems: number
  canActivateLivePilot: boolean
  activationInstruction: ProductionGoLiveActivationInstructionDto
  blockers: string[]
  nextActions: string[]
  safetyNotice: string
}

export type ProductionLivePilotSessionStatusDto = 'active' | 'blocked' | 'expired' | 'stopped'

export interface ProductionLivePilotSessionDto {
  id: string
  generatedAt: number
  startedAt: number
  expiresAt: number
  stoppedAt: number | null
  durationMinutes: number
  status: ProductionLivePilotSessionStatusDto
  contentHash: string
  livePilotLeaseHash: string | null
  livePilotLeaseExpiresAt: number | null
  goLiveDecisionHash: string | null
  customerAuthorizationEvidenceHash: string | null
  environmentFingerprintHash: string | null
  canRunLivePilot: boolean
  blockers: string[]
  nextActions: string[]
  safetyNotice: string
}

export interface ProductionLivePilotSessionReportDto {
  generatedAt: number
  activeSession: ProductionLivePilotSessionDto | null
  sessions: ProductionLivePilotSessionDto[]
  summary: {
    total: number
    active: number
    stopped: number
    expired: number
    blocked: number
  }
  blockers: string[]
  nextActions: string[]
}

export interface ProductionGoLiveEnvironmentFingerprintDto {
  envVar: string
  configured: boolean
  valueHash: string | null
}

export interface ProductionGoLiveActivationInstructionDto {
  envVar: string
  label: string
  currentlyEnabled: boolean
  requiredForLive: boolean
  riskLevel: 'medium' | 'high'
  powershellPreview: string
  reason: string
}

export type ProductionSetupStepStatus = 'done' | 'needs_action' | 'blocked'

export interface ProductionSetupGuideDto {
  status: ProductionIntegrationStatus
  completionPercent: number
  generatedAt: number
  steps: ProductionSetupGuideStepDto[]
  summary: {
    done: number
    needsAction: number
    blocked: number
    total: number
    productionReady: boolean
  }
}

export interface ProductionSetupGuideStepDto {
  key: string
  title: string
  status: ProductionSetupStepStatus
  readinessStatus: ProductionIntegrationStatus
  evidence: string[]
  blockers: string[]
  nextActions: string[]
  primaryActionLabel: string
  targetRoute?: string
}

export interface ProductionCustomerEnvironmentReportDto {
  status: ProductionIntegrationStatus
  readinessScore: number
  generatedAt: number
  safeToRunLive: boolean
  host: {
    platform: string
    arch: string
    node: string
    electronMode: 'dev' | 'packaged' | 'node'
    dataDir: string
  }
  setupGuide: {
    completionPercent: number
    productionReady: boolean
    done: number
    needsAction: number
    blocked: number
    total: number
  }
  envGates: ProductionEnvironmentGateDto[]
  runtimeGuards: Array<{
    key: string
    envVar: string
    configured: boolean
    required: boolean
    purpose: string
    valueHint: string
  }>
  emergencyStop: {
    envVar: string
    active: boolean
    blocksHighRiskLive: boolean
    purpose: string
  }
  customerAuthorization: {
    switchEnabled: boolean
    evidenceHash: string | null
    evidenceHashPresent: boolean
    evidenceMatched: boolean
    matchedEvidenceId: string | null
    matchedEvidenceTitle: string | null
    matchedEvidenceAt: number | null
  }
  checks: ProductionProbeResultDto[]
  evidence: string[]
  blockers: string[]
  nextActions: string[]
}

export interface ProductionCustomerEnvironmentPackageDto {
  id: string
  generatedAt: number
  redacted: true
  contentHash: string
  report: ProductionCustomerEnvironmentReportDto
  files: {
    manifestPath: string
    markdownPath: string
    preflightScriptPath: string
    rollbackScriptPath: string
    manifestFileName: string
    markdownFileName: string
    preflightScriptFileName: string
    rollbackScriptFileName: string
  }
  summary: {
    status: ProductionIntegrationStatus
    readinessScore: number
    safeToRunLive: boolean
    blockers: number
    nextActions: number
  }
}

export type ProductionPackageIntegrityKindDto = 'onsite_activation' | 'customer_environment'

export interface ProductionPackageIntegrityReportDto {
  status: ProductionIntegrationStatus
  readinessScore: number
  generatedAt: number
  summary: {
    totalPackages: number
    readyPackages: number
    blockedPackages: number
    onsiteActivationPackages: number
    customerEnvironmentPackages: number
    latestReadyPackageHash: string | null
  }
  packages: ProductionPackageIntegrityItemDto[]
  checks: ProductionProbeResultDto[]
  blockers: string[]
  nextActions: string[]
}

export interface ProductionPackageIntegrityItemDto {
  id: string
  kind: ProductionPackageIntegrityKindDto
  status: ProductionIntegrationStatus
  generatedAt: number | null
  contentHash: string | null
  expectedContentHash: string | null
  contentHashMatches: boolean
  manifestPath: string | null
  markdownPath: string | null
  scriptPaths: string[]
  filesPresent: boolean
  manifestReadable: boolean
  manifestSchemaMatches: boolean
  scriptHashesMatch: boolean
  redacted: boolean
  sensitiveHits: string[]
  evidence: string[]
  warnings: string[]
  nextActions: string[]
}

export interface ProductionEnvironmentGateDto {
  key: string
  label: string
  envVar: string
  enabled: boolean
  riskLevel: 'medium' | 'high'
  purpose: string
}

export interface RuntimeControlGateProbeDto extends ProductionProbeResultDto {
  scope: 'desktop' | 'mobile' | 'workstation'
  envVar: string | null
  envEnabled: boolean
  approvalRequired: boolean
  readOnly: boolean
  actionTypes: string[]
  recentActions: number
  completedActions: number
  blockedActions: number
  liveExecutions: number
  approvedRuntimeControlApprovals: number
  lastActionAt: number | null
}

export interface WorkstationReadinessProbeDto {
  id: string
  agentProfileId: string
  mode: WorkstationMode
  status: AgentWorkstationRow['status']
  ready: boolean
  hasVncUrl: boolean
  hasRdpConfig: boolean
  pathChecks: {
    workspacePath: boolean
    browserProfilePath: boolean
    tempPath: boolean
  }
  blockingReasons: string[]
  warnings: string[]
  nextActions: string[]
}

export interface WorkstationLeaseRecoveryItemDto {
  workstationId: string
  agentProfileId: string
  mode: WorkstationMode
  status: AgentWorkstationRow['status']
  updatedAt: number
  ageMs: number
  stale: boolean
  recoverable: boolean
  activeSessionIds: string[]
  heldLockIds: string[]
  blockers: string[]
}

export interface WorkstationLeaseRecoveryReportDto {
  generatedAt: number
  maxBusyAgeMs: number
  summary: {
    busyWorkstations: number
    staleBusyWorkstations: number
    recoverableWorkstations: number
    blockedWorkstations: number
    recoveredWorkstations: number
  }
  items: WorkstationLeaseRecoveryItemDto[]
  warnings: string[]
  nextActions: string[]
  applied: boolean
  recoveredIds: string[]
}

export async function fetchProductionIntegrationReadiness(): Promise<ProductionIntegrationReadinessDto> {
  const { readiness } = await json<{ readiness: ProductionIntegrationReadinessDto }>(
    fetch('/api/production-integrations/readiness'),
  )
  return readiness
}

export async function fetchProductionModelCredentialReport(): Promise<ProductionModelCredentialReportDto> {
  const { report } = await json<{ report: ProductionModelCredentialReportDto }>(
    fetch('/api/production-integrations/model-credentials/report'),
  )
  return report
}

export async function fetchProductionModelCredentialIntakeReport(): Promise<ProductionModelCredentialIntakeReportDto> {
  const { report } = await json<{ report: ProductionModelCredentialIntakeReportDto }>(
    fetch('/api/production-integrations/model-credentials/intake'),
  )
  return report
}

export async function applyProductionModelCredentialIntake(body: {
  modelProfileId: string
  envVar?: string | null
  secretId?: string | null
  grantConnect?: boolean
  grantInvoke?: boolean
  confirmMigrate?: boolean
}): Promise<ProductionModelCredentialIntakeApplyResultDto> {
  const { result } = await json<{ result: ProductionModelCredentialIntakeApplyResultDto }>(
    fetch('/api/production-integrations/model-credentials/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function probeProductionDesktop(body: {
  live?: boolean
  includeWindowList?: boolean
} = {}): Promise<DesktopAutomationProbeDto> {
  const { desktop } = await json<{ desktop: DesktopAutomationProbeDto }>(
    fetch('/api/production-integrations/desktop/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return desktop
}

export async function discoverProductionMobileDevices(body: {
  live?: boolean
} = {}): Promise<MobileAutomationDiscoveryDto> {
  const { mobile } = await json<{ mobile: MobileAutomationDiscoveryDto }>(
    fetch('/api/production-integrations/mobile/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return mobile
}

export async function discoverProductionWorkstationProviders(body: {
  live?: boolean
} = {}): Promise<WorkstationProviderDiscoveryDto> {
  const { workstations } = await json<{ workstations: WorkstationProviderDiscoveryDto }>(
    fetch('/api/production-integrations/workstations/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return workstations
}

export async function createProductionWorkstationReservation(body: {
  agentProfileId: string
  mode: Extract<WorkstationMode, 'virtual_desktop' | 'vm' | 'remote_session'>
  workspacePath?: string | null
  browserProfilePath?: string | null
  tempPath?: string | null
  displayId?: string | null
  vncUrl?: string | null
  rdpConfig?: string | null
}): Promise<AgentWorkstationRow> {
  const { workstation } = await json<{ workstation: AgentWorkstationRow }>(
    fetch('/api/production-integrations/workstations/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return workstation
}

export async function fetchWorkstationLeaseRecoveryReport(maxBusyAgeMs?: number): Promise<WorkstationLeaseRecoveryReportDto> {
  const query = maxBusyAgeMs ? `?maxBusyAgeMs=${encodeURIComponent(String(maxBusyAgeMs))}` : ''
  const { recovery } = await json<{ recovery: WorkstationLeaseRecoveryReportDto }>(
    fetch(`/api/production-integrations/workstations/recovery${query}`),
  )
  return recovery
}

export async function recoverStaleWorkstationLeases(body: {
  maxBusyAgeMs?: number
  apply?: boolean
  confirmRecovery?: boolean
} = {}): Promise<WorkstationLeaseRecoveryReportDto> {
  const { recovery } = await json<{ recovery: WorkstationLeaseRecoveryReportDto }>(
    fetch('/api/production-integrations/workstations/recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return recovery
}

export async function fetchProductionHardeningReport(): Promise<ProductionHardeningReportDto> {
  const { report } = await json<{ report: ProductionHardeningReportDto }>(
    fetch('/api/production-integrations/hardening-report'),
  )
  return report
}

export async function fetchProductionPackageIntegrityReport(): Promise<ProductionPackageIntegrityReportDto> {
  const { report } = await json<{ report: ProductionPackageIntegrityReportDto }>(
    fetch('/api/production-integrations/package-integrity/report'),
  )
  return report
}

export async function fetchRuntimeControlReadinessReport(): Promise<RuntimeControlReadinessReportDto> {
  const { runtimeControl } = await json<{ runtimeControl: RuntimeControlReadinessReportDto }>(
    fetch('/api/production-integrations/runtime-control/readiness'),
  )
  return runtimeControl
}

export async function fetchProductionExecutionPreflightReport(): Promise<ProductionExecutionPreflightReportDto> {
  const { preflight } = await json<{ preflight: ProductionExecutionPreflightReportDto }>(
    fetch('/api/production-integrations/execution-preflight'),
  )
  return preflight
}

export async function fetchRealControlRuntimeAcceptanceReport(): Promise<RealControlRuntimeAcceptanceReportDto> {
  const { report } = await json<{ report: RealControlRuntimeAcceptanceReportDto }>(
    fetch('/api/production-integrations/real-control/report'),
  )
  return report
}

export async function fetchProductionLiveConnectorReport(): Promise<ProductionLiveConnectorReportDto> {
  const { report } = await json<{ report: ProductionLiveConnectorReportDto }>(
    fetch('/api/production-integrations/live-connectors/report'),
  )
  return report
}

export async function fetchProductionOnsiteIntakeChecklist(): Promise<ProductionOnsiteIntakeChecklistDto> {
  const { checklist } = await json<{ checklist: ProductionOnsiteIntakeChecklistDto }>(
    fetch('/api/production-integrations/onsite-intake/checklist'),
  )
  return checklist
}

export async function fetchProductionOnsiteActivationGuide(): Promise<ProductionOnsiteActivationGuideDto> {
  const { guide } = await json<{ guide: ProductionOnsiteActivationGuideDto }>(
    fetch('/api/production-integrations/onsite-activation/guide'),
  )
  return guide
}

export async function exportProductionOnsiteActivationPackage(): Promise<ProductionOnsiteActivationPackageDto> {
  const { package: exportPackage } = await json<{ package: ProductionOnsiteActivationPackageDto }>(
    fetch('/api/production-integrations/onsite-activation/package', { method: 'POST' }),
  )
  return exportPackage
}

export async function fetchProductionFinalAcceptanceLedger(): Promise<ProductionFinalAcceptanceLedgerDto> {
  const { ledger } = await json<{ ledger: ProductionFinalAcceptanceLedgerDto }>(
    fetch('/api/production-integrations/final-acceptance/ledger'),
  )
  return ledger
}

export async function fetchProductionOnsiteEvidenceReport(): Promise<ProductionOnsiteEvidenceReportDto> {
  const { report } = await json<{ report: ProductionOnsiteEvidenceReportDto }>(
    fetch('/api/production-integrations/final-acceptance/evidence'),
  )
  return report
}

export async function recordProductionOnsiteEvidence(body: {
  category: ProductionFinalAcceptanceCategoryKey
  title: string
  evidence: string[]
  notes?: string | null
  operator?: string | null
  externalRef?: string | null
  riskLevel?: 'low' | 'medium' | 'high'
  verifiedAt?: number | null
}): Promise<ProductionOnsiteEvidenceRecordDto> {
  const { evidence } = await json<{ evidence: ProductionOnsiteEvidenceRecordDto }>(
    fetch('/api/production-integrations/final-acceptance/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evidence
}

export async function createProductionGoLiveDecision(): Promise<ProductionGoLiveDecisionDto> {
  const { decision } = await json<{ decision: ProductionGoLiveDecisionDto }>(
    fetch('/api/production-integrations/go-live/decision', { method: 'POST' }),
  )
  return decision
}

export async function createProductionLivePilotLease(body: {
  durationMinutes?: number
} = {}): Promise<ProductionLivePilotLeaseDto> {
  const { lease } = await json<{ lease: ProductionLivePilotLeaseDto }>(
    fetch('/api/production-integrations/go-live/live-pilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return lease
}

export async function fetchProductionLivePilotSessionReport(): Promise<ProductionLivePilotSessionReportDto> {
  const { report } = await json<{ report: ProductionLivePilotSessionReportDto }>(
    fetch('/api/production-integrations/go-live/live-pilot/session'),
  )
  return report
}

export async function startProductionLivePilotSession(body: {
  durationMinutes?: number
} = {}): Promise<ProductionLivePilotSessionDto> {
  const { session } = await json<{ session: ProductionLivePilotSessionDto }>(
    fetch('/api/production-integrations/go-live/live-pilot/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return session
}

export async function stopProductionLivePilotSession(body: {
  reason?: string
} = {}): Promise<ProductionLivePilotSessionDto> {
  const { session } = await json<{ session: ProductionLivePilotSessionDto }>(
    fetch('/api/production-integrations/go-live/live-pilot/session', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return session
}

export async function fetchProductionGoLiveDrillReport(): Promise<ProductionGoLiveDrillReportDto> {
  const { drill } = await json<{ drill: ProductionGoLiveDrillReportDto }>(
    fetch('/api/production-integrations/go-live/drill'),
  )
  return drill
}

export async function fetchProductionSetupGuide(): Promise<ProductionSetupGuideDto> {
  const { setupGuide } = await json<{ setupGuide: ProductionSetupGuideDto }>(
    fetch('/api/production-integrations/setup-guide'),
  )
  return setupGuide
}

export async function fetchProductionCustomerEnvironmentReport(): Promise<ProductionCustomerEnvironmentReportDto> {
  const { report } = await json<{ report: ProductionCustomerEnvironmentReportDto }>(
    fetch('/api/production-integrations/customer-environment/report'),
  )
  return report
}

export async function exportProductionCustomerEnvironmentPackage(): Promise<ProductionCustomerEnvironmentPackageDto> {
  const { package: exportPackage } = await json<{ package: ProductionCustomerEnvironmentPackageDto }>(
    fetch('/api/production-integrations/customer-environment/package', { method: 'POST' }),
  )
  return exportPackage
}

export async function seedOSInterferencePolicy(): Promise<OSInterferencePolicyRow> {
  const { policy } = await json<{ policy: OSInterferencePolicyRow }>(
    fetch('/api/os-interference/policies/seed', { method: 'POST' }),
  )
  return policy
}

export async function fetchOSInterferencePolicies(params: {
  status?: OSInterferencePolicyRow['status']
  limit?: number
} = {}): Promise<OSInterferencePolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: OSInterferencePolicyRow[] }>(
    fetch(`/api/os-interference/policies${suffix}`),
  )
  return policies
}

export async function evaluateOSInterference(body: {
  policyId?: string
  signal?: OSInterferenceSignal
  monitors: OSInterferenceMonitorSnapshot
}): Promise<{
  policy: OSInterferencePolicyRow
  event: OSInterferenceEventRow
  preventionChecklist: string[]
}> {
  const { evaluation } = await json<{
    evaluation: {
      policy: OSInterferencePolicyRow
      event: OSInterferenceEventRow
      preventionChecklist: string[]
    }
  }>(
    fetch('/api/os-interference/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evaluation
}

export async function fetchOSInterferenceEvents(params: {
  signal?: OSInterferenceSignal
  status?: OSInterferenceEventStatus
  limit?: number
} = {}): Promise<OSInterferenceEventRow[]> {
  const qs = new URLSearchParams()
  if (params.signal) qs.set('signal', params.signal)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { events } = await json<{ events: OSInterferenceEventRow[] }>(
    fetch(`/api/os-interference/events${suffix}`),
  )
  return events
}

export async function seedFileSystemBoundaryPolicy(): Promise<FileSystemBoundaryPolicyRow> {
  const { policy } = await json<{ policy: FileSystemBoundaryPolicyRow }>(
    fetch('/api/file-boundaries/policies/seed', { method: 'POST' }),
  )
  return policy
}

export async function fetchFileSystemBoundaryPolicies(params: {
  status?: FileSystemBoundaryPolicyRow['status']
  limit?: number
} = {}): Promise<FileSystemBoundaryPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: FileSystemBoundaryPolicyRow[] }>(
    fetch(`/api/file-boundaries/policies${suffix}`),
  )
  return policies
}

export async function evaluateFileSystemBoundary(body: FileSystemBoundaryInput & {
  policyId?: string
}): Promise<{
  policy: FileSystemBoundaryPolicyRow
  evaluation: FileSystemBoundaryEvaluationRow
  summary: {
    riskCount: number
    blocked: number
    warnings: number
    actions: string[]
  }
}> {
  const { result } = await json<{
    result: {
      policy: FileSystemBoundaryPolicyRow
      evaluation: FileSystemBoundaryEvaluationRow
      summary: {
        riskCount: number
        blocked: number
        warnings: number
        actions: string[]
      }
    }
  }>(
    fetch('/api/file-boundaries/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchFileSystemBoundaryEvaluations(params: {
  status?: FileBoundaryEvaluationStatus
  operation?: FileBoundaryOperation
  limit?: number
} = {}): Promise<FileSystemBoundaryEvaluationRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.operation) qs.set('operation', params.operation)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { evaluations } = await json<{ evaluations: FileSystemBoundaryEvaluationRow[] }>(
    fetch(`/api/file-boundaries/evaluations${suffix}`),
  )
  return evaluations
}

export async function seedBrowserAutomationTrapPolicy(): Promise<BrowserAutomationTrapPolicyRow> {
  const { policy } = await json<{ policy: BrowserAutomationTrapPolicyRow }>(
    fetch('/api/browser-automation-traps/policies/seed', { method: 'POST' }),
  )
  return policy
}

export async function fetchBrowserAutomationTrapPolicies(params: {
  status?: BrowserAutomationTrapPolicyRow['status']
  limit?: number
} = {}): Promise<BrowserAutomationTrapPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: BrowserAutomationTrapPolicyRow[] }>(
    fetch(`/api/browser-automation-traps/policies${suffix}`),
  )
  return policies
}

export async function evaluateBrowserAutomationTraps(body: BrowserAutomationTrapInput & {
  policyId?: string
}): Promise<{
  policy: BrowserAutomationTrapPolicyRow
  evaluation: BrowserAutomationTrapEvaluationRow
  summary: {
    riskCount: number
    needsUser: number
    warnings: number
    actions: string[]
  }
}> {
  const { result } = await json<{
    result: {
      policy: BrowserAutomationTrapPolicyRow
      evaluation: BrowserAutomationTrapEvaluationRow
      summary: {
        riskCount: number
        needsUser: number
        warnings: number
        actions: string[]
      }
    }
  }>(
    fetch('/api/browser-automation-traps/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchBrowserAutomationTrapEvaluations(params: {
  status?: BrowserAutomationTrapStatus
  limit?: number
} = {}): Promise<BrowserAutomationTrapEvaluationRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { evaluations } = await json<{ evaluations: BrowserAutomationTrapEvaluationRow[] }>(
    fetch(`/api/browser-automation-traps/evaluations${suffix}`),
  )
  return evaluations
}

export async function seedEnterpriseNetworkPolicy(): Promise<EnterpriseNetworkPolicyRow> {
  const { policy } = await json<{ policy: EnterpriseNetworkPolicyRow }>(
    fetch('/api/enterprise-network/policies/seed', { method: 'POST' }),
  )
  return policy
}

export async function fetchEnterpriseNetworkPolicies(params: {
  status?: EnterpriseNetworkPolicyRow['status']
  limit?: number
} = {}): Promise<EnterpriseNetworkPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: EnterpriseNetworkPolicyRow[] }>(
    fetch(`/api/enterprise-network/policies${suffix}`),
  )
  return policies
}

export async function evaluateEnterpriseNetwork(body: EnterpriseNetworkInput & {
  policyId?: string
}): Promise<{
  policy: EnterpriseNetworkPolicyRow
  evaluation: EnterpriseNetworkEvaluationRow
  summary: {
    riskCount: number
    needsUser: number
    warnings: number
    actions: string[]
  }
}> {
  const { result } = await json<{
    result: {
      policy: EnterpriseNetworkPolicyRow
      evaluation: EnterpriseNetworkEvaluationRow
      summary: {
        riskCount: number
        needsUser: number
        warnings: number
        actions: string[]
      }
    }
  }>(
    fetch('/api/enterprise-network/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchEnterpriseNetworkEvaluations(params: {
  status?: EnterpriseNetworkStatus
  limit?: number
} = {}): Promise<EnterpriseNetworkEvaluationRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { evaluations } = await json<{ evaluations: EnterpriseNetworkEvaluationRow[] }>(
    fetch(`/api/enterprise-network/evaluations${suffix}`),
  )
  return evaluations
}

export async function seedOutputConsistencyPolicy(): Promise<OutputConsistencyPolicyRow> {
  const { policy } = await json<{ policy: OutputConsistencyPolicyRow }>(
    fetch('/api/output-consistency/policies/seed', { method: 'POST' }),
  )
  return policy
}

export async function fetchOutputConsistencyPolicies(params: {
  status?: OutputConsistencyPolicyRow['status']
  limit?: number
} = {}): Promise<OutputConsistencyPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: OutputConsistencyPolicyRow[] }>(
    fetch(`/api/output-consistency/policies${suffix}`),
  )
  return policies
}

export async function evaluateOutputConsistency(body: OutputConsistencyInput & {
  policyId?: string
}): Promise<{
  policy: OutputConsistencyPolicyRow
  evaluation: OutputConsistencyEvaluationRow
  summary: {
    riskCount: number
    rejected: number
    warnings: number
    actions: string[]
  }
}> {
  const { result } = await json<{
    result: {
      policy: OutputConsistencyPolicyRow
      evaluation: OutputConsistencyEvaluationRow
      summary: {
        riskCount: number
        rejected: number
        warnings: number
        actions: string[]
      }
    }
  }>(
    fetch('/api/output-consistency/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchOutputConsistencyEvaluations(params: {
  status?: OutputConsistencyStatus
  limit?: number
} = {}): Promise<OutputConsistencyEvaluationRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { evaluations } = await json<{ evaluations: OutputConsistencyEvaluationRow[] }>(
    fetch(`/api/output-consistency/evaluations${suffix}`),
  )
  return evaluations
}

export async function seedResourceGovernorPolicy(): Promise<ResourceGovernorPolicyRow> {
  const { policy } = await json<{ policy: ResourceGovernorPolicyRow }>(
    fetch('/api/resource-governor/policies/seed', { method: 'POST' }),
  )
  return policy
}

export async function fetchResourceGovernorPolicies(params: {
  status?: ResourceGovernorPolicyRow['status']
  limit?: number
} = {}): Promise<ResourceGovernorPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: ResourceGovernorPolicyRow[] }>(
    fetch(`/api/resource-governor/policies${suffix}`),
  )
  return policies
}

export async function evaluateResourceGovernor(body: {
  policyId?: string
  snapshot: ResourceGovernorSnapshot
}): Promise<{
  policy: ResourceGovernorPolicyRow
  evaluation: ResourceGovernorEvaluationRow
  summary: {
    decisionCount: number
    critical: number
    warnings: number
    actions: string[]
  }
}> {
  const { result } = await json<{
    result: {
      policy: ResourceGovernorPolicyRow
      evaluation: ResourceGovernorEvaluationRow
      summary: {
        decisionCount: number
        critical: number
        warnings: number
        actions: string[]
      }
    }
  }>(
    fetch('/api/resource-governor/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchResourceGovernorEvaluations(params: {
  status?: ResourceGovernorStatus
  limit?: number
} = {}): Promise<ResourceGovernorEvaluationRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { evaluations } = await json<{ evaluations: ResourceGovernorEvaluationRow[] }>(
    fetch(`/api/resource-governor/evaluations${suffix}`),
  )
  return evaluations
}

export async function seedGlobalOSIntegrationPolicy(): Promise<GlobalOSIntegrationPolicyRow> {
  const { policy } = await json<{ policy: GlobalOSIntegrationPolicyRow }>(
    fetch('/api/global-os-integration/policies/seed', { method: 'POST' }),
  )
  return policy
}

export async function fetchGlobalOSIntegrationPolicies(params: {
  status?: GlobalOSIntegrationPolicyRow['status']
  limit?: number
} = {}): Promise<GlobalOSIntegrationPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: GlobalOSIntegrationPolicyRow[] }>(
    fetch(`/api/global-os-integration/policies${suffix}`),
  )
  return policies
}

export async function evaluateGlobalOSIntegration(body: GlobalOSIntegrationInput & {
  policyId?: string
}): Promise<{
  policy: GlobalOSIntegrationPolicyRow
  evaluation: GlobalOSIntegrationEvaluationRow
  summary: {
    decisionCount: number
    needsUser: number
    warnings: number
    actions: string[]
  }
}> {
  const { result } = await json<{
    result: {
      policy: GlobalOSIntegrationPolicyRow
      evaluation: GlobalOSIntegrationEvaluationRow
      summary: {
        decisionCount: number
        needsUser: number
        warnings: number
        actions: string[]
      }
    }
  }>(
    fetch('/api/global-os-integration/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchGlobalOSIntegrationEvaluations(params: {
  status?: GlobalOSIntegrationStatus
  limit?: number
} = {}): Promise<GlobalOSIntegrationEvaluationRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { evaluations } = await json<{ evaluations: GlobalOSIntegrationEvaluationRow[] }>(
    fetch(`/api/global-os-integration/evaluations${suffix}`),
  )
  return evaluations
}

export async function seedTelemetryPolicy(): Promise<TelemetryPolicyRow> {
  const { policy } = await json<{ policy: TelemetryPolicyRow }>(
    fetch('/api/telemetry/policies/seed', { method: 'POST' }),
  )
  return policy
}

export interface CreateTelemetryPolicyBody {
  name?: string
  level?: TelemetryLevel
  consentGranted?: boolean
  status?: TelemetryPolicyRow['status']
  minimal?: {
    appVersion?: string
    os?: string
    anonymousInstallId?: string
    crashReports?: boolean
  }
  usage?: {
    agentsCreated?: number
    tasksRun?: number
    workflowsCreated?: number
  }
  performance?: {
    avgTaskDuration?: number
    modelLatency?: number
  }
  full?: {
    errorTraces?: boolean
  }
  neverCollect?: TelemetryNeverCollectCategory[]
  exportable?: boolean
}

export async function createTelemetryPolicy(body: CreateTelemetryPolicyBody): Promise<TelemetryPolicyRow> {
  const { policy } = await json<{ policy: TelemetryPolicyRow }>(
    fetch('/api/telemetry/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return policy
}

export async function fetchTelemetryPolicies(params: {
  status?: TelemetryPolicyRow['status']
  limit?: number
} = {}): Promise<TelemetryPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: TelemetryPolicyRow[] }>(
    fetch(`/api/telemetry/policies${suffix}`),
  )
  return policies
}

export async function evaluateTelemetryEvent(body: TelemetryEventInput & {
  policyId?: string
}): Promise<{
  policy: TelemetryPolicyRow
  event: TelemetryEventRow
  decision: TelemetryEventRow['decision']
  summary: {
    status: TelemetryDecisionStatus
    allowedFieldCount: number
    redactedFieldCount: number
    blockedFieldCount: number
    neverCollect: TelemetryNeverCollectCategory[]
  }
}> {
  const { result } = await json<{
    result: {
      policy: TelemetryPolicyRow
      event: TelemetryEventRow
      decision: TelemetryEventRow['decision']
      summary: {
        status: TelemetryDecisionStatus
        allowedFieldCount: number
        redactedFieldCount: number
        blockedFieldCount: number
        neverCollect: TelemetryNeverCollectCategory[]
      }
    }
  }>(
    fetch('/api/telemetry/events/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchTelemetryEvents(params: {
  policyId?: string
  status?: TelemetryDecisionStatus
  eventType?: string
  limit?: number
} = {}): Promise<TelemetryEventRow[]> {
  const qs = new URLSearchParams()
  if (params.policyId) qs.set('policyId', params.policyId)
  if (params.status) qs.set('status', params.status)
  if (params.eventType) qs.set('eventType', params.eventType)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { events } = await json<{ events: TelemetryEventRow[] }>(
    fetch(`/api/telemetry/events${suffix}`),
  )
  return events
}

export async function exportTelemetryData(body: {
  policyId?: string
  status?: TelemetryDecisionStatus
  eventType?: string
  limit?: number
} = {}): Promise<TelemetryExportManifestRow> {
  const { exportManifest } = await json<{ exportManifest: TelemetryExportManifestRow }>(
    fetch('/api/telemetry/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return exportManifest
}

export async function fetchTelemetryExportManifests(params: {
  policyId?: string
  limit?: number
} = {}): Promise<TelemetryExportManifestRow[]> {
  const qs = new URLSearchParams()
  if (params.policyId) qs.set('policyId', params.policyId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { exports } = await json<{ exports: TelemetryExportManifestRow[] }>(
    fetch(`/api/telemetry/exports${suffix}`),
  )
  return exports
}

export interface CreateRetentionPolicyBody {
  entity: RetentionEntity
  retentionPeriod: string
  onExpiry?: RetentionExpiryAction
  maxStorageBytes?: number | null
  enabled?: boolean
}

export interface RetentionEvaluationDto {
  policy: RetentionPolicyRow
  cutoffAt: number | null
  expiredCandidateCount: number
  action: RetentionExpiryAction
  dryRun: true
}

export interface ComputeStorageQuotaBody {
  scope?: StorageQuotaScope
  scopeId?: string | null
  maxTotalBytes?: number
  warnAtPercent?: number
  blockAtPercent?: number
}

export interface CreateDataExportManifestBody {
  scope?: DataExportScope
  scopeId?: string | null
  format?: DataExportFormat
  includeSecrets?: boolean
}

export interface CreateFeatureFlagBody {
  name: string
  description?: string
  status?: FeatureFlagStatus
  rolloutPercent?: number
  targetUsers?: FeatureFlagTargetUsers
  targetUserIds?: string[]
  requiresFlags?: string[]
  conflictsWith?: string[]
  remoteOverride?: boolean
  remoteDisabled?: boolean
}

export interface EvaluateFeatureFlagBody {
  userId?: string | null
  groups?: string[]
}

export interface CreateDegradationPolicyBody {
  name: string
  resourceType: DegradationResourceType
  resourceId?: string | null
  trigger?: DegradationTrigger
  action: DegradationAction
  fallbackResourceIds?: string[]
  enabled?: boolean
}

export interface EvaluateDegradationBody {
  resourceType: DegradationResourceType
  resourceId?: string | null
  trigger?: DegradationTrigger
  fallbackCandidates?: string[]
  metadata?: JsonObject
}

export interface UpdatePolicyBody {
  name?: string
  checkInterval?: UpdatePolicyRow['checkInterval']
  channel?: UpdatePolicyRow['channel']
  autoDownload?: boolean
  installOn?: UpdatePolicyRow['installOn']
  ifAgentsRunning?: UpdatePolicyRow['ifAgentsRunning']
  maxWaitMs?: number
  rollbackCrashOnStartup?: boolean
  rollbackAgentSuccessRateDrop?: number
}

export interface UpdateCheckBody {
  currentVersion?: string
  availableVersion?: string
  releaseNotes?: string
}

export interface UpdateCheckResultDto extends JsonObject {
  currentVersion: string
  availableVersion: string | null
  updateAvailable: boolean
  channel: UpdatePolicyRow['channel']
  autoDownload: boolean
  installOn: UpdatePolicyRow['installOn']
  agentsRunning: number
  agentsQueued: number
  ifAgentsRunning: UpdatePolicyRow['ifAgentsRunning']
  updateAction: string
  releaseNotes: string
  checkedAt: number
  notificationId?: string
}

export interface MaintenanceStateDto {
  updatePolicy: UpdatePolicyRow
  activeMaintenanceWindow: MaintenanceWindowRow | null
  recentMaintenanceWindows: MaintenanceWindowRow[]
  canStartNewTasks: boolean
}

export interface StartMaintenanceWindowBody {
  reason?: string
  updatePolicyId?: string | null
  autoComplete?: boolean
}

export interface CustomMetricWeightsBody {
  costWeight?: number
  speedWeight?: number
  qualityWeight?: number
  safetyWeight?: number
}

export interface CustomMetricConstraintsBody {
  maxCostPerTask?: number
  maxTimePerTask?: number
  minQualityScore?: number
  requireApprovalFor?: string[]
}

export interface CreateCustomMetricProfileBody {
  name: string
  scope?: CustomMetricScope
  scopeId?: string | null
  optimizationTarget?: OptimizationTarget
  weights?: CustomMetricWeightsBody
  constraints?: CustomMetricConstraintsBody
}

export interface EvaluateCustomMetricBody {
  resourceType?: string
  resourceId?: string | null
  estimatedCostCents?: number
  estimatedDurationMs?: number
  qualityScore?: number
  actionTypes?: string[]
}

export interface WorkflowPresetDto {
  id: string
  category: string
  title: string
  prompt: string
  description: string
  steps: Array<{
    title: string
    instruction: string
    artifactType: string
    deliverableTitle?: string
    deliveryDescription?: string
    customerVisible?: boolean
  }>
}

export type OnboardingWorkType = 'coding' | 'documentation' | 'data' | 'browser' | 'files' | 'other'

export interface StartOptimisticEditBody {
  entityType: ConfigEntityType
  entityId: string
  editedBy?: string | null
}

export interface CommitOptimisticEditBody extends StartOptimisticEditBody {
  baseVersion: number
  proposedSnapshot: JsonObject
  changedFields?: string[]
}

export interface OptimisticCommitResult {
  status: 'committed' | 'conflict'
  lock: OptimisticLockRow
  conflict: EditConflictRow | null
  configVersion: ConfigVersionRow | null
}

export interface ResolveEditConflictBody {
  resolution: EditConflictResolution
  mergedSnapshot?: JsonObject | null
  resolvedBy?: string | null
}

export interface CreateExportPackageBody {
  packageType: ExportPackageType
  sourceEntityId: string
  name?: string
  author?: string | null
  description?: string
  packageVersion?: string
  tags?: string[]
  includes?: {
    memories?: boolean
    sampleArtifacts?: boolean
    benchmarkResults?: boolean
  }
}

export async function fetchRetentionPolicies(): Promise<RetentionPolicyRow[]> {
  const { retentionPolicies } = await json<{ retentionPolicies: RetentionPolicyRow[] }>(
    fetch('/api/data-lifecycle/retention-policies'),
  )
  return retentionPolicies
}

export async function createRetentionPolicy(
  body: CreateRetentionPolicyBody,
): Promise<RetentionPolicyRow> {
  const { retentionPolicy } = await json<{ retentionPolicy: RetentionPolicyRow }>(
    fetch('/api/data-lifecycle/retention-policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return retentionPolicy
}

export async function evaluateRetentionPolicies(): Promise<RetentionEvaluationDto[]> {
  const { evaluations } = await json<{ evaluations: RetentionEvaluationDto[] }>(
    fetch('/api/data-lifecycle/retention-policies/evaluate', { method: 'POST' }),
  )
  return evaluations
}

export async function fetchStorageQuotaSnapshots(limit = 50): Promise<StorageQuotaSnapshotRow[]> {
  const { storageQuotaSnapshots } = await json<{
    storageQuotaSnapshots: StorageQuotaSnapshotRow[]
  }>(fetch(`/api/data-lifecycle/storage-quotas?limit=${limit}`))
  return storageQuotaSnapshots
}

export async function computeStorageQuota(
  body: ComputeStorageQuotaBody = {},
): Promise<StorageQuotaSnapshotRow> {
  const { storageQuotaSnapshot } = await json<{ storageQuotaSnapshot: StorageQuotaSnapshotRow }>(
    fetch('/api/data-lifecycle/storage-quotas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return storageQuotaSnapshot
}

export async function fetchPiiMarkers(limit = 100): Promise<PiiMarkerRow[]> {
  const { piiMarkers } = await json<{ piiMarkers: PiiMarkerRow[] }>(
    fetch(`/api/data-lifecycle/pii-markers?limit=${limit}`),
  )
  return piiMarkers
}

export async function scanPiiMarkers(body: {
  memoryItemId?: string | null
  limit?: number
} = {}): Promise<PiiMarkerRow[]> {
  const { piiMarkers } = await json<{ piiMarkers: PiiMarkerRow[] }>(
    fetch('/api/data-lifecycle/pii-markers/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return piiMarkers
}

export async function updatePiiMarkerStatus(
  piiMarkerId: string,
  status: PiiMarkerStatus,
): Promise<PiiMarkerRow> {
  const { piiMarker } = await json<{ piiMarker: PiiMarkerRow }>(
    fetch(`/api/data-lifecycle/pii-markers/${piiMarkerId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
  )
  return piiMarker
}

export async function fetchDataExportManifests(limit = 50): Promise<DataExportManifestRow[]> {
  const { dataExportManifests } = await json<{ dataExportManifests: DataExportManifestRow[] }>(
    fetch(`/api/data-lifecycle/export-manifests?limit=${limit}`),
  )
  return dataExportManifests
}

export async function createDataExportManifest(
  body: CreateDataExportManifestBody = {},
): Promise<DataExportManifestRow> {
  const { dataExportManifest } = await json<{ dataExportManifest: DataExportManifestRow }>(
    fetch('/api/data-lifecycle/export-manifests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return dataExportManifest
}

export async function fetchFeatureFlags(): Promise<FeatureFlagRow[]> {
  const { featureFlags } = await json<{ featureFlags: FeatureFlagRow[] }>(
    fetch('/api/feature-flags'),
  )
  return featureFlags
}

export async function createFeatureFlag(
  body: CreateFeatureFlagBody,
): Promise<FeatureFlagRow> {
  const { featureFlag } = await json<{ featureFlag: FeatureFlagRow }>(
    fetch('/api/feature-flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return featureFlag
}

export async function evaluateFeatureFlag(
  featureFlagId: string,
  body: EvaluateFeatureFlagBody = {},
): Promise<FeatureFlagEvaluationRow> {
  const { evaluation } = await json<{ evaluation: FeatureFlagEvaluationRow }>(
    fetch(`/api/feature-flags/${featureFlagId}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evaluation
}

export async function fetchFeatureFlagEvaluations(
  limit = 100,
): Promise<FeatureFlagEvaluationRow[]> {
  const { featureFlagEvaluations } = await json<{
    featureFlagEvaluations: FeatureFlagEvaluationRow[]
  }>(fetch(`/api/feature-flag-evaluations?limit=${limit}`))
  return featureFlagEvaluations
}

export async function fetchDegradationPolicies(): Promise<DegradationPolicyRow[]> {
  const { degradationPolicies } = await json<{ degradationPolicies: DegradationPolicyRow[] }>(
    fetch('/api/degradation/policies'),
  )
  return degradationPolicies
}

export async function createDegradationPolicy(
  body: CreateDegradationPolicyBody,
): Promise<DegradationPolicyRow> {
  const { degradationPolicy } = await json<{ degradationPolicy: DegradationPolicyRow }>(
    fetch('/api/degradation/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return degradationPolicy
}

export async function fetchDegradationEvents(limit = 100): Promise<DegradationEventRow[]> {
  const { degradationEvents } = await json<{ degradationEvents: DegradationEventRow[] }>(
    fetch(`/api/degradation/events?limit=${limit}`),
  )
  return degradationEvents
}

export async function evaluateDegradation(
  body: EvaluateDegradationBody,
): Promise<DegradationEventRow> {
  const { degradationEvent } = await json<{ degradationEvent: DegradationEventRow }>(
    fetch('/api/degradation/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return degradationEvent
}

export async function fetchUpdatePolicy(): Promise<UpdatePolicyRow> {
  const { updatePolicy } = await json<{ updatePolicy: UpdatePolicyRow }>(
    fetch('/api/maintenance/update-policy'),
  )
  return updatePolicy
}

export async function saveUpdatePolicy(body: UpdatePolicyBody): Promise<UpdatePolicyRow> {
  const { updatePolicy } = await json<{ updatePolicy: UpdatePolicyRow }>(
    fetch('/api/maintenance/update-policy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return updatePolicy
}

export async function checkApplicationUpdate(body: UpdateCheckBody): Promise<{
  updatePolicy: UpdatePolicyRow
  result: UpdateCheckResultDto
}> {
  return json<{
    updatePolicy: UpdatePolicyRow
    result: UpdateCheckResultDto
  }>(
    fetch('/api/maintenance/update-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchMaintenanceState(): Promise<MaintenanceStateDto> {
  return json<MaintenanceStateDto>(fetch('/api/maintenance/state'))
}

export async function fetchMaintenanceWindows(): Promise<MaintenanceWindowRow[]> {
  const { maintenanceWindows } = await json<{ maintenanceWindows: MaintenanceWindowRow[] }>(
    fetch('/api/maintenance/windows'),
  )
  return maintenanceWindows
}

export async function startMaintenanceWindow(
  body: StartMaintenanceWindowBody,
): Promise<MaintenanceWindowRow> {
  const { maintenanceWindow } = await json<{ maintenanceWindow: MaintenanceWindowRow }>(
    fetch('/api/maintenance/windows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return maintenanceWindow
}

export async function completeMaintenanceWindow(
  maintenanceWindowId: string,
  body: { force?: boolean } = {},
): Promise<MaintenanceWindowRow> {
  const { maintenanceWindow } = await json<{ maintenanceWindow: MaintenanceWindowRow }>(
    fetch(`/api/maintenance/windows/${maintenanceWindowId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return maintenanceWindow
}

export async function fetchCustomMetricProfiles(): Promise<CustomMetricProfileRow[]> {
  const { customMetricProfiles } = await json<{ customMetricProfiles: CustomMetricProfileRow[] }>(
    fetch('/api/custom-metrics/profiles'),
  )
  return customMetricProfiles
}

export async function createCustomMetricProfile(
  body: CreateCustomMetricProfileBody,
): Promise<CustomMetricProfileRow> {
  const { customMetricProfile } = await json<{ customMetricProfile: CustomMetricProfileRow }>(
    fetch('/api/custom-metrics/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return customMetricProfile
}

export async function evaluateCustomMetricProfile(
  profileId: string,
  body: EvaluateCustomMetricBody,
): Promise<CustomMetricEvaluationRow> {
  const { customMetricEvaluation } = await json<{
    customMetricEvaluation: CustomMetricEvaluationRow
  }>(
    fetch(`/api/custom-metrics/profiles/${profileId}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return customMetricEvaluation
}

export async function fetchCustomMetricEvaluations(
  limit = 100,
): Promise<CustomMetricEvaluationRow[]> {
  const { customMetricEvaluations } = await json<{
    customMetricEvaluations: CustomMetricEvaluationRow[]
  }>(fetch(`/api/custom-metrics/evaluations?limit=${limit}`))
  return customMetricEvaluations
}

export async function fetchOptimisticLocks(args: {
  entityType?: ConfigEntityType
  entityId?: string
  limit?: number
} = {}): Promise<OptimisticLockRow[]> {
  const params = new URLSearchParams()
  if (args.entityType) params.set('entityType', args.entityType)
  if (args.entityId) params.set('entityId', args.entityId)
  if (args.limit) params.set('limit', String(args.limit))
  const { optimisticLocks } = await json<{ optimisticLocks: OptimisticLockRow[] }>(
    fetch(`/api/optimistic-locks?${params.toString()}`),
  )
  return optimisticLocks
}

export async function startOptimisticEdit(
  body: StartOptimisticEditBody,
): Promise<OptimisticLockRow> {
  const { optimisticLock } = await json<{ optimisticLock: OptimisticLockRow }>(
    fetch('/api/optimistic-locks/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return optimisticLock
}

export async function commitOptimisticEdit(
  body: CommitOptimisticEditBody,
): Promise<OptimisticCommitResult> {
  return json<OptimisticCommitResult>(
    fetch('/api/optimistic-locks/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchEditConflicts(args: {
  entityType?: ConfigEntityType
  entityId?: string
  status?: EditConflictStatus
  limit?: number
} = {}): Promise<EditConflictRow[]> {
  const params = new URLSearchParams()
  if (args.entityType) params.set('entityType', args.entityType)
  if (args.entityId) params.set('entityId', args.entityId)
  if (args.status) params.set('status', args.status)
  if (args.limit) params.set('limit', String(args.limit))
  const { editConflicts } = await json<{ editConflicts: EditConflictRow[] }>(
    fetch(`/api/edit-conflicts?${params.toString()}`),
  )
  return editConflicts
}

export async function resolveEditConflict(
  conflictId: string,
  body: ResolveEditConflictBody,
): Promise<EditConflictRow> {
  const { editConflict } = await json<{ editConflict: EditConflictRow }>(
    fetch(`/api/edit-conflicts/${conflictId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return editConflict
}

export async function fetchExportPackages(limit = 100): Promise<ExportPackageRow[]> {
  const { exportPackages } = await json<{ exportPackages: ExportPackageRow[] }>(
    fetch(`/api/export-packages?limit=${limit}`),
  )
  return exportPackages
}

export async function createExportPackage(
  body: CreateExportPackageBody,
): Promise<ExportPackageRow> {
  const { exportPackage } = await json<{ exportPackage: ExportPackageRow }>(
    fetch('/api/export-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return exportPackage
}

export async function runPackageImportCheck(
  exportPackageId: string,
): Promise<PackageImportCheckRow> {
  const { packageImportCheck } = await json<{ packageImportCheck: PackageImportCheckRow }>(
    fetch(`/api/export-packages/${exportPackageId}/import-check`, { method: 'POST' }),
  )
  return packageImportCheck
}

export async function fetchPackageImportChecks(limit = 100): Promise<PackageImportCheckRow[]> {
  const { packageImportChecks } = await json<{ packageImportChecks: PackageImportCheckRow[] }>(
    fetch(`/api/package-import-checks?limit=${limit}`),
  )
  return packageImportChecks
}

export interface SkillsCenterData {
  skills: SkillRow[]
  installFlows: SkillInstallFlowRow[]
  sdkManifests: SkillSdkManifestRow[]
  marketplacePublications: SkillMarketplacePublicationRow[]
  marketplaceUrl: string
}

export interface SkillsMpCliSkillResult {
  id: string
  name: string
  description: string
  repository: string | null
  creator: string | null
  sourceUrl: string | null
  skillUrl: string | null
  stars: number | null
  downloads: number | null
  category: string | null
  occupation: string | null
  updatedAt: string | null
  tags: string[]
  manifest: JsonObject
}

export interface SkillsMpCliSearchResult {
  ok: true
  cli: 'skillsmp'
  command: 'search'
  source: 'live' | 'fixture'
  baseUrl: string
  query: string
  page: number
  limit: number
  sortBy: string
  category: string | null
  occupation: string | null
  total: number
  rateLimit: {
    dailyLimit: string | null
    dailyRemaining: string | null
  } | null
  items: SkillsMpCliSkillResult[]
}

export interface SkillsMpCliSearchBody {
  query: string
  page?: number
  limit?: number
  sortBy?: 'stars' | 'recent'
  category?: string
  occupation?: string
}

export type {
  ApiDesignCoverageReport,
  BackendServiceCoverageReport,
  DatabaseCoverageReport,
  FrontendPageCoverageReport,
  MobileCompanionReport,
  MobileUploadSummary,
  PhasePlanCoverageReport,
  RegisterMobileUploadArgs,
  SkillsMapIntegrationReport,
}

export interface InstallSkillBody {
  source?: SkillSource
  url: string
  name?: string
  description?: string
  manifest?: JsonObject
}

export async function fetchSkillsCenterData(): Promise<SkillsCenterData> {
  const [skillsData, sdkData, publicationsData] = await Promise.all([
    json<Pick<SkillsCenterData, 'skills' | 'installFlows' | 'marketplaceUrl'>>(fetch('/api/skills')),
    json<{ manifests: SkillSdkManifestRow[] }>(fetch('/api/skills/sdk/manifests')),
    json<{ publications: SkillMarketplacePublicationRow[] }>(fetch('/api/skills/sdk/publications')),
  ])
  return {
    ...skillsData,
    sdkManifests: sdkData.manifests,
    marketplacePublications: publicationsData.publications,
  }
}

export async function fetchSkillsMapIntegrationReport(): Promise<SkillsMapIntegrationReport> {
  const { report } = await json<{ report: SkillsMapIntegrationReport }>(
    fetch('/api/skills/skillsmap-report'),
  )
  return report
}

export async function searchSkillsMpCli(
  body: SkillsMpCliSearchBody,
): Promise<SkillsMpCliSearchResult> {
  const { result } = await json<{ result: SkillsMpCliSearchResult }>(
    fetch('/api/skills/skillsmp-cli', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchDatabaseCoverageReport(): Promise<DatabaseCoverageReport> {
  const { report } = await json<{ report: DatabaseCoverageReport }>(
    fetch('/api/database/coverage-report'),
  )
  return report
}

export async function fetchBackendServiceCoverageReport(): Promise<BackendServiceCoverageReport> {
  const { report } = await json<{ report: BackendServiceCoverageReport }>(
    fetch('/api/backend-services/coverage-report'),
  )
  return report
}

export async function fetchApiDesignCoverageReport(): Promise<ApiDesignCoverageReport> {
  const { report } = await json<{ report: ApiDesignCoverageReport }>(
    fetch('/api/api-design/coverage-report'),
  )
  return report
}

export async function fetchFrontendPageCoverageReport(): Promise<FrontendPageCoverageReport> {
  const { report } = await json<{ report: FrontendPageCoverageReport }>(
    fetch('/api/frontend-pages/coverage-report'),
  )
  return report
}

export async function fetchPhasePlanCoverageReport(): Promise<PhasePlanCoverageReport> {
  const { report } = await json<{ report: PhasePlanCoverageReport }>(
    fetch('/api/phase-plan/coverage-report'),
  )
  return report
}

export async function fetchTestPlanCoverageReport(): Promise<TestPlanCoverageReport> {
  const { report } = await json<{ report: TestPlanCoverageReport }>(
    fetch('/api/test-plan/coverage-report'),
  )
  return report
}

export async function fetchProductEffectsCoverageReport(): Promise<ProductEffectsCoverageReport> {
  const { report } = await json<{ report: ProductEffectsCoverageReport }>(
    fetch('/api/product-effects/coverage-report'),
  )
  return report
}

export async function fetchMobileCompanionReport(token: string): Promise<MobileCompanionReport> {
  const { report } = await json<{ report: MobileCompanionReport }>(
    fetch('/api/mobile/companion-report', {
      headers: { Authorization: `Bearer ${token}` },
    }),
  )
  return report
}

export async function registerMobileCompanionUpload(
  token: string,
  body: RegisterMobileUploadArgs,
): Promise<MobileUploadSummary> {
  const { upload } = await json<{ upload: MobileUploadSummary }>(
    fetch('/api/mobile/uploads', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  )
  return upload
}

export async function installSkill(body: InstallSkillBody): Promise<{
  skill: SkillRow
  installFlow: SkillInstallFlowRow
}> {
  return json<{ skill: SkillRow; installFlow: SkillInstallFlowRow }>(
    fetch('/api/skills/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function setSkillEnabled(id: string, enabled: boolean): Promise<SkillRow> {
  const { skill } = await json<{ skill: SkillRow }>(
    fetch(`/api/skills/${id}/enable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }),
  )
  return skill
}

export interface ScaffoldSkillSdkBody {
  name: string
  version?: string
  capabilities: string[]
  dependencies?: {
    python_packages?: string[]
    node_packages?: string[]
    system_tools?: string[]
  }
  permissions?: string[]
}

export async function scaffoldSkillSdkProject(body: ScaffoldSkillSdkBody): Promise<{
  manifest: SkillSdkManifestRow
  files: Record<string, string>
  requiredFiles: string[]
}> {
  return json<{
    manifest: SkillSdkManifestRow
    files: Record<string, string>
    requiredFiles: string[]
  }>(
    fetch('/api/skills/sdk/scaffold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function createSkillSdkManifest(body: {
  skillId?: string | null
  manifest: JsonObject
  files?: string[]
}): Promise<SkillSdkManifestRow> {
  const { manifest } = await json<{ manifest: SkillSdkManifestRow }>(
    fetch('/api/skills/sdk/manifests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return manifest
}

export async function publishSkillSdkManifest(
  id: string,
  marketplaceUrl?: string,
): Promise<SkillMarketplacePublicationRow> {
  const { publication } = await json<{ publication: SkillMarketplacePublicationRow }>(
    fetch(`/api/skills/sdk/manifests/${id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketplaceUrl }),
    }),
  )
  return publication
}

export interface InstallPluginBody {
  name: string
  version: string
  description?: string
  author?: string
  extensionPoints: PluginExtensionPoint[]
  capabilities?: PluginCapabilityDefinition[]
  config?: JsonObject
  marketplaceMetadata?: Partial<PluginMarketplaceMetadata>
  requiredCoreVersion?: string | null
}

export async function installPluginPackage(body: InstallPluginBody): Promise<PluginPackageRow> {
  const { plugin } = await json<{ plugin: PluginPackageRow }>(
    fetch('/api/plugins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return plugin
}

export async function fetchPluginPackages(params: {
  status?: PluginStatus
  extensionPoint?: PluginExtensionPoint
} = {}): Promise<PluginPackageRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.extensionPoint) qs.set('extensionPoint', params.extensionPoint)
  const query = qs.toString()
  const { plugins } = await json<{ plugins: PluginPackageRow[] }>(
    fetch(`/api/plugins${query ? `?${query}` : ''}`),
  )
  return plugins
}

export async function enablePluginPackage(pluginId: string): Promise<PluginPackageRow> {
  const { plugin } = await json<{ plugin: PluginPackageRow }>(
    fetch(`/api/plugins/${pluginId}/enable`, { method: 'POST' }),
  )
  return plugin
}

export async function disablePluginPackage(pluginId: string): Promise<PluginPackageRow> {
  const { plugin } = await json<{ plugin: PluginPackageRow }>(
    fetch(`/api/plugins/${pluginId}/disable`, { method: 'POST' }),
  )
  return plugin
}

export async function uninstallPluginPackage(pluginId: string): Promise<PluginPackageRow> {
  const { plugin } = await json<{ plugin: PluginPackageRow }>(
    fetch(`/api/plugins/${pluginId}/uninstall`, { method: 'POST' }),
  )
  return plugin
}

export async function upgradePluginPackage(
  pluginId: string,
  body: {
    version: string
    extensionPoints?: PluginExtensionPoint[]
    capabilities?: PluginCapabilityDefinition[]
    config?: JsonObject
    marketplaceMetadata?: Partial<PluginMarketplaceMetadata>
    requiredCoreVersion?: string | null
  },
): Promise<PluginPackageRow> {
  const { plugin } = await json<{ plugin: PluginPackageRow }>(
    fetch(`/api/plugins/${pluginId}/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return plugin
}

export async function runPluginPackageHealthCheck(pluginId: string): Promise<PluginPackageRow> {
  const { plugin } = await json<{ plugin: PluginPackageRow }>(
    fetch(`/api/plugins/${pluginId}/health-check`, { method: 'POST' }),
  )
  return plugin
}

export async function checkPluginPackageCompatibility(
  pluginId: string,
  requiredCoreVersion?: string | null,
): Promise<PluginCompatibilityReport> {
  const { compatibility } = await json<{ compatibility: PluginCompatibilityReport }>(
    fetch(`/api/plugins/${pluginId}/compatibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requiredCoreVersion }),
    }),
  )
  return compatibility
}

export async function fetchPluginLifecycleEvents(
  pluginId: string,
): Promise<PluginLifecycleEventRow[]> {
  const { events } = await json<{ events: PluginLifecycleEventRow[] }>(
    fetch(`/api/plugins/${pluginId}/events`),
  )
  return events
}

export interface CreateTeamUserBody {
  displayName: string
  email: string
  roleSystem?: TeamUserRoleSystem
  permissions?: Record<string, boolean>
  scope?: string
  status?: TeamUserStatus
}

export async function createTeamUser(body: CreateTeamUserBody): Promise<TeamUserRow> {
  const { teamUser } = await json<{ teamUser: TeamUserRow }>(
    fetch('/api/team-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return teamUser
}

export async function fetchTeamUsers(params: {
  roleSystem?: TeamUserRoleSystem
  status?: TeamUserStatus
} = {}): Promise<TeamUserRow[]> {
  const qs = new URLSearchParams()
  if (params.roleSystem) qs.set('roleSystem', params.roleSystem)
  if (params.status) qs.set('status', params.status)
  const query = qs.toString()
  const { teamUsers } = await json<{ teamUsers: TeamUserRow[] }>(
    fetch(`/api/team-users${query ? `?${query}` : ''}`),
  )
  return teamUsers
}

export interface CreateTeamBody {
  name: string
  description?: string
  status?: TeamStatus
}

export async function createTeam(body: CreateTeamBody): Promise<TeamRow> {
  const { team } = await json<{ team: TeamRow }>(
    fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return team
}

export async function fetchTeams(params: { status?: TeamStatus } = {}): Promise<TeamRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  const query = qs.toString()
  const { teams } = await json<{ teams: TeamRow[] }>(
    fetch(`/api/teams${query ? `?${query}` : ''}`),
  )
  return teams
}

export interface AddTeamMemberBody {
  userId: string
  roleSystem?: TeamUserRoleSystem
  permissions?: Record<string, boolean>
  scope?: string
  status?: TeamMembershipStatus
}

export async function addTeamMember(
  teamId: string,
  body: AddTeamMemberBody,
): Promise<TeamMembershipRow> {
  const { teamMembership } = await json<{ teamMembership: TeamMembershipRow }>(
    fetch(`/api/teams/${teamId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return teamMembership
}

export async function fetchTeamMemberships(
  teamId: string,
  params: { status?: TeamMembershipStatus } = {},
): Promise<TeamMembershipRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  const query = qs.toString()
  const { teamMemberships } = await json<{ teamMemberships: TeamMembershipRow[] }>(
    fetch(`/api/teams/${teamId}/members${query ? `?${query}` : ''}`),
  )
  return teamMemberships
}

export interface TeamPermissionEvaluationBody {
  userId: string
  teamId?: string | null
  permission: string
  scope?: string | null
}

export interface TeamPermissionEvaluationResult {
  userId: string
  teamId: string | null
  permission: string
  scope: string | null
  allowed: boolean
  source: 'user_role' | 'team_membership' | 'none'
  matchedRole: TeamUserRoleSystem | null
  reasons: string[]
}

export async function evaluateTeamPermission(
  body: TeamPermissionEvaluationBody,
): Promise<TeamPermissionEvaluationResult> {
  const { evaluation } = await json<{ evaluation: TeamPermissionEvaluationResult }>(
    fetch('/api/team-permissions/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evaluation
}

export interface ShareTeamResourceBody {
  teamId: string
  resourceType: TeamResourceType
  resourceId: string
  sharingPolicy?: TeamResourceSharingPolicy
  secretHandling?: TeamSecretHandling
  createdByUserId?: string | null
  metadata?: JsonObject
}

export async function shareTeamResource(body: ShareTeamResourceBody): Promise<TeamResourceShareRow> {
  const { teamResourceShare } = await json<{ teamResourceShare: TeamResourceShareRow }>(
    fetch('/api/team-resource-shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return teamResourceShare
}

export async function fetchTeamResourceShares(params: {
  teamId?: string
  resourceType?: TeamResourceType
  resourceId?: string
  sharingPolicy?: TeamResourceSharingPolicy
} = {}): Promise<TeamResourceShareRow[]> {
  const qs = new URLSearchParams()
  if (params.teamId) qs.set('teamId', params.teamId)
  if (params.resourceType) qs.set('resourceType', params.resourceType)
  if (params.resourceId) qs.set('resourceId', params.resourceId)
  if (params.sharingPolicy) qs.set('sharingPolicy', params.sharingPolicy)
  const query = qs.toString()
  const { teamResourceShares } = await json<{ teamResourceShares: TeamResourceShareRow[] }>(
    fetch(`/api/team-resource-shares${query ? `?${query}` : ''}`),
  )
  return teamResourceShares
}

export interface CreateTeamApprovalPolicyBody {
  teamId: string
  name: string
  approvalMode: TeamApprovalMode
  approverUserIds?: string[]
  requiredPermission?: string
  riskLevel?: RiskLevel
  status?: TeamApprovalPolicyStatus
}

export async function createTeamApprovalPolicy(
  body: CreateTeamApprovalPolicyBody,
): Promise<TeamApprovalPolicyRow> {
  const { teamApprovalPolicy } = await json<{ teamApprovalPolicy: TeamApprovalPolicyRow }>(
    fetch('/api/team-approval-policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return teamApprovalPolicy
}

export async function fetchTeamApprovalPolicies(params: {
  teamId?: string
  approvalMode?: TeamApprovalMode
  status?: TeamApprovalPolicyStatus
} = {}): Promise<TeamApprovalPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.teamId) qs.set('teamId', params.teamId)
  if (params.approvalMode) qs.set('approvalMode', params.approvalMode)
  if (params.status) qs.set('status', params.status)
  const query = qs.toString()
  const { teamApprovalPolicies } = await json<{ teamApprovalPolicies: TeamApprovalPolicyRow[] }>(
    fetch(`/api/team-approval-policies${query ? `?${query}` : ''}`),
  )
  return teamApprovalPolicies
}

export interface RecordTeamApprovalDecisionBody {
  approvalRequestId?: string | null
  userId: string
  decision: 'approved' | 'rejected'
  comment?: string
}

export async function recordTeamApprovalDecision(
  policyId: string,
  body: RecordTeamApprovalDecisionBody,
): Promise<TeamApprovalDecisionRow> {
  const { teamApprovalDecision } = await json<{ teamApprovalDecision: TeamApprovalDecisionRow }>(
    fetch(`/api/team-approval-policies/${policyId}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return teamApprovalDecision
}

export async function fetchTeamApprovalDecisions(
  policyId: string,
  params: { userId?: string } = {},
): Promise<TeamApprovalDecisionRow[]> {
  const qs = new URLSearchParams()
  if (params.userId) qs.set('userId', params.userId)
  const query = qs.toString()
  const { teamApprovalDecisions } = await json<{ teamApprovalDecisions: TeamApprovalDecisionRow[] }>(
    fetch(`/api/team-approval-policies/${policyId}/decisions${query ? `?${query}` : ''}`),
  )
  return teamApprovalDecisions
}

export async function evaluateTeamApprovalPolicy(
  policyId: string,
): Promise<TeamApprovalResolution> {
  const { resolution } = await json<{ resolution: TeamApprovalResolution }>(
    fetch(`/api/team-approval-policies/${policyId}/evaluate`, { method: 'POST' }),
  )
  return resolution
}

export interface CreateAgentTemplatePackageBody {
  templateKey?: string
  templateType: AgentTemplatePackageType
  category?: AgentTemplateCategory
  name: string
  description?: string
  role?: string
  payload?: JsonObject
  requiredSkillIds?: string[]
  recommendedToolIds?: string[]
  tags?: string[]
  author?: string
  source?: AgentTemplateSource
  visibility?: AgentTemplateVisibility
  marketplaceUrl?: string | null
  status?: AgentTemplateStatus
  rating?: number | null
  createdByUserId?: string | null
}

export interface InstallAgentTemplatePackageBody {
  installedByUserId?: string | null
  targetName?: string | null
  variables?: JsonObject
}

export interface InstallAgentTemplatePackageResult {
  install: AgentTemplateInstallRow
  template: AgentTemplatePackageRow
  createdAgentProfile: AgentProfileRow | null
}

export async function seedAgentTemplates(): Promise<AgentTemplatePackageRow[]> {
  const { agentTemplates } = await json<{ agentTemplates: AgentTemplatePackageRow[] }>(
    fetch('/api/agent-templates/seed', { method: 'POST' }),
  )
  return agentTemplates
}

export async function createAgentTemplatePackage(
  body: CreateAgentTemplatePackageBody,
): Promise<AgentTemplatePackageRow> {
  const { agentTemplate } = await json<{ agentTemplate: AgentTemplatePackageRow }>(
    fetch('/api/agent-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return agentTemplate
}

export async function fetchAgentTemplatePackages(params: {
  templateType?: AgentTemplatePackageType
  category?: AgentTemplateCategory
  source?: AgentTemplateSource
  visibility?: AgentTemplateVisibility
  status?: AgentTemplateStatus
  query?: string
} = {}): Promise<AgentTemplatePackageRow[]> {
  const qs = new URLSearchParams()
  if (params.templateType) qs.set('templateType', params.templateType)
  if (params.category) qs.set('category', params.category)
  if (params.source) qs.set('source', params.source)
  if (params.visibility) qs.set('visibility', params.visibility)
  if (params.status) qs.set('status', params.status)
  if (params.query) qs.set('query', params.query)
  const query = qs.toString()
  const { agentTemplates } = await json<{ agentTemplates: AgentTemplatePackageRow[] }>(
    fetch(`/api/agent-templates${query ? `?${query}` : ''}`),
  )
  return agentTemplates
}

export async function publishAgentTemplatePackage(
  templateId: string,
): Promise<AgentTemplatePackageRow> {
  const { agentTemplate } = await json<{ agentTemplate: AgentTemplatePackageRow }>(
    fetch(`/api/agent-templates/${templateId}/publish`, { method: 'POST' }),
  )
  return agentTemplate
}

export async function installAgentTemplatePackage(
  templateId: string,
  body: InstallAgentTemplatePackageBody = {},
): Promise<InstallAgentTemplatePackageResult> {
  return json<InstallAgentTemplatePackageResult>(
    fetch(`/api/agent-templates/${templateId}/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchAgentTemplateInstalls(params: {
  templateId?: string
  installedByUserId?: string
  targetType?: AgentTemplatePackageType
} = {}): Promise<AgentTemplateInstallRow[]> {
  const qs = new URLSearchParams()
  if (params.templateId) qs.set('templateId', params.templateId)
  if (params.installedByUserId) qs.set('installedByUserId', params.installedByUserId)
  if (params.targetType) qs.set('targetType', params.targetType)
  const query = qs.toString()
  const { agentTemplateInstalls } = await json<{ agentTemplateInstalls: AgentTemplateInstallRow[] }>(
    fetch(`/api/agent-template-installs${query ? `?${query}` : ''}`),
  )
  return agentTemplateInstalls
}

export async function seedTestFixtures(): Promise<TestFixtureSpecRow[]> {
  const { fixtures } = await json<{ fixtures: TestFixtureSpecRow[] }>(
    fetch('/api/test-fixtures/seed', { method: 'POST' }),
  )
  return fixtures
}

export async function fetchTestFixtures(type?: TestFixtureType): Promise<TestFixtureSpecRow[]> {
  const suffix = type ? `?type=${encodeURIComponent(type)}` : ''
  const { fixtures } = await json<{ fixtures: TestFixtureSpecRow[] }>(
    fetch(`/api/test-fixtures${suffix}`),
  )
  return fixtures
}

export async function generateTestFixture(
  fixtureId: string,
  targetPath?: string | null,
): Promise<TestFixtureGenerationRunRow> {
  const { run } = await json<{ run: TestFixtureGenerationRunRow }>(
    fetch(`/api/test-fixtures/${fixtureId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath }),
    }),
  )
  return run
}

export async function fetchTestFixtureRuns(): Promise<TestFixtureGenerationRunRow[]> {
  const { runs } = await json<{ runs: TestFixtureGenerationRunRow[] }>(
    fetch('/api/test-fixture-runs'),
  )
  return runs
}

export async function seedTestStrategyItems(): Promise<TestStrategyItemRow[]> {
  const { items } = await json<{ items: TestStrategyItemRow[] }>(
    fetch('/api/test-strategy/seed', { method: 'POST' }),
  )
  return items
}

export async function fetchTestStrategyItems(params: {
  kind?: TestStrategyItemKind
  status?: TestStrategyItemStatus
  limit?: number
} = {}): Promise<TestStrategyItemRow[]> {
  const qs = new URLSearchParams()
  if (params.kind) qs.set('kind', params.kind)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { items } = await json<{ items: TestStrategyItemRow[] }>(
    fetch(`/api/test-strategy/items${suffix}`),
  )
  return items
}

export async function evaluateTestStrategy(): Promise<{
  items: TestStrategyItemRow[]
  summary: {
    total: number
    covered: number
    recordOnly: number
    planned: number
    byKind: Record<TestStrategyItemKind, number>
    byStatus: Record<TestStrategyItemStatus, number>
    pyramid: Record<string, unknown>
    chaosPolicy: 'record_only'
  }
}> {
  return json<{
    items: TestStrategyItemRow[]
    summary: {
      total: number
      covered: number
      recordOnly: number
      planned: number
      byKind: Record<TestStrategyItemKind, number>
      byStatus: Record<TestStrategyItemStatus, number>
      pyramid: Record<string, unknown>
      chaosPolicy: 'record_only'
    }
  }>(fetch('/api/test-strategy/evaluate', { method: 'POST' }))
}

export async function seedBenchmarkSuite(): Promise<{
  suite: BenchmarkSuiteRow
  cases: BenchmarkCaseRow[]
}> {
  return json<{ suite: BenchmarkSuiteRow; cases: BenchmarkCaseRow[] }>(
    fetch('/api/benchmarks/seed', { method: 'POST' }),
  )
}

export async function fetchBenchmarkSuites(): Promise<BenchmarkSuiteRow[]> {
  const { suites } = await json<{ suites: BenchmarkSuiteRow[] }>(fetch('/api/benchmarks/suites'))
  return suites
}

export async function fetchBenchmarkCases(args: {
  suiteId?: string
  dimension?: BenchmarkDimension
} = {}): Promise<BenchmarkCaseRow[]> {
  const params = new URLSearchParams()
  if (args.suiteId) params.set('suiteId', args.suiteId)
  if (args.dimension) params.set('dimension', args.dimension)
  const suffix = params.size ? `?${params.toString()}` : ''
  const { cases } = await json<{ cases: BenchmarkCaseRow[] }>(
    fetch(`/api/benchmarks/cases${suffix}`),
  )
  return cases
}

export async function runBenchmarkSuite(body: {
  suiteId?: string | null
  modelProfileIds?: string[]
  promptVersion?: string
  baselinePromptVersion?: string
  ciMode?: boolean
} = {}): Promise<{
  run: BenchmarkRunRow
  results: BenchmarkCaseResultRow[]
}> {
  return json<{ run: BenchmarkRunRow; results: BenchmarkCaseResultRow[] }>(
    fetch('/api/benchmarks/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchBenchmarkRuns(): Promise<BenchmarkRunRow[]> {
  const { runs } = await json<{ runs: BenchmarkRunRow[] }>(fetch('/api/benchmarks/runs'))
  return runs
}

export async function fetchBenchmarkCaseResults(runId: string): Promise<BenchmarkCaseResultRow[]> {
  const { results } = await json<{ results: BenchmarkCaseResultRow[] }>(
    fetch(`/api/benchmarks/runs/${runId}/results`),
  )
  return results
}

export async function seedLocalizationDefaults(): Promise<{
  settings: LocalizationSettingsRow
  resources: LocalizationResourceRow[]
}> {
  return json<{ settings: LocalizationSettingsRow; resources: LocalizationResourceRow[] }>(
    fetch('/api/localization/seed', { method: 'POST' }),
  )
}

export async function seedI18nContractChecks(): Promise<I18nContractCheckRow[]> {
  const { checks } = await json<{ checks: I18nContractCheckRow[] }>(
    fetch('/api/localization/contract/seed', { method: 'POST' }),
  )
  return checks
}

export async function fetchI18nContractChecks(params: {
  area?: I18nContractArea
  status?: I18nContractStatus
  limit?: number
} = {}): Promise<I18nContractCheckRow[]> {
  const qs = new URLSearchParams()
  if (params.area) qs.set('area', params.area)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { checks } = await json<{ checks: I18nContractCheckRow[] }>(
    fetch(`/api/localization/contract/checks${suffix}`),
  )
  return checks
}

export async function evaluateI18nContract(): Promise<{
  checks: I18nContractCheckRow[]
  summary: {
    total: number
    passing: number
    warning: number
    failing: number
  }
}> {
  return json<{
    checks: I18nContractCheckRow[]
    summary: {
      total: number
      passing: number
      warning: number
      failing: number
    }
  }>(fetch('/api/localization/contract/evaluate', { method: 'POST' }))
}

export async function fetchLocalizationSettings(): Promise<LocalizationSettingsRow[]> {
  const { settings } = await json<{ settings: LocalizationSettingsRow[] }>(
    fetch('/api/localization/settings'),
  )
  return settings
}

export async function fetchLocalizationResources(args: {
  locale?: SupportedLocale
  namespace?: LocalizationNamespace
} = {}): Promise<LocalizationResourceRow[]> {
  const params = new URLSearchParams()
  if (args.locale) params.set('locale', args.locale)
  if (args.namespace) params.set('namespace', args.namespace)
  const suffix = params.size ? `?${params.toString()}` : ''
  const { resources } = await json<{ resources: LocalizationResourceRow[] }>(
    fetch(`/api/localization/resources${suffix}`),
  )
  return resources
}

export async function translateLocalization(body: {
  locale: SupportedLocale
  namespace: LocalizationNamespace
  key: string
}): Promise<{
  value: string
  locale: SupportedLocale
  fallbackUsed: boolean
  namespace: LocalizationNamespace
  key: string
}> {
  const { translation } = await json<{
    translation: {
      value: string
      locale: SupportedLocale
      fallbackUsed: boolean
      namespace: LocalizationNamespace
      key: string
    }
  }>(
    fetch('/api/localization/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return translation
}

export async function createAgentLocalizationPolicy(body: {
  agentProfileId?: string | null
  outputLanguagePolicy?: OutputLanguagePolicy
  outputLocale?: SupportedLocale
  dateTimeLocale?: SupportedLocale
  numberLocale?: SupportedLocale
}): Promise<AgentLocalizationPolicyRow> {
  const { policy } = await json<{ policy: AgentLocalizationPolicyRow }>(
    fetch('/api/localization/agent-policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return policy
}

export async function fetchAgentLocalizationPolicies(): Promise<AgentLocalizationPolicyRow[]> {
  const { policies } = await json<{ policies: AgentLocalizationPolicyRow[] }>(
    fetch('/api/localization/agent-policies'),
  )
  return policies
}

export async function resolveAgentLocalization(body: {
  agentProfileId?: string | null
  personaLanguage?: SupportedLocale
  userLocale?: SupportedLocale
  taskInputLanguage?: SupportedLocale
  timestamp?: number
  numberValue?: number
} = {}): Promise<{
  outputLocale: SupportedLocale
  outputLanguagePolicy: OutputLanguagePolicy
  fallbackLocale: SupportedLocale
  systemPromptLocale: SupportedLocale
  systemPromptLocaleSource: 'persona_language' | 'output_locale'
  systemPromptRule: string
  dateSample: string
  numberSample: string
}> {
  const { localization } = await json<{
    localization: {
      outputLocale: SupportedLocale
      outputLanguagePolicy: OutputLanguagePolicy
      fallbackLocale: SupportedLocale
      systemPromptLocale: SupportedLocale
      systemPromptLocaleSource: 'persona_language' | 'output_locale'
      systemPromptRule: string
      dateSample: string
      numberSample: string
    }
  }>(
    fetch('/api/localization/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return localization
}

export async function seedThemeProfiles(): Promise<ThemeProfileRow[]> {
  const { themeProfiles } = await json<{ themeProfiles: ThemeProfileRow[] }>(
    fetch('/api/theme-profiles/seed', { method: 'POST' }),
  )
  return themeProfiles
}

export async function fetchThemeProfiles(): Promise<ThemeProfileRow[]> {
  const { themeProfiles } = await json<{ themeProfiles: ThemeProfileRow[] }>(
    fetch('/api/theme-profiles'),
  )
  return themeProfiles
}

export async function createThemeProfile(body: {
  name: string
  presetKey?: ThemePresetKey
  followSystem?: boolean
  modePreference?: ThemeModePreference
  colorTokens?: JsonObject
  fontTokens?: JsonObject
  radiusPx?: number
  spacingScale?: ThemeSpacingScale
}): Promise<ThemeProfileRow> {
  const { themeProfile } = await json<{ themeProfile: ThemeProfileRow }>(
    fetch('/api/theme-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return themeProfile
}

export async function resolveThemeProfile(body: {
  profileId?: string | null
  systemTheme?: 'light' | 'dark'
} = {}): Promise<{
  profile: ThemeProfileRow
  effectiveMode: 'light' | 'dark'
  cssVariables: JsonObject
}> {
  return json<{
    profile: ThemeProfileRow
    effectiveMode: 'light' | 'dark'
    cssVariables: JsonObject
  }>(
    fetch('/api/theme-profiles/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function seedKeyboardShortcuts(): Promise<KeyboardShortcutRow[]> {
  const { shortcuts } = await json<{ shortcuts: KeyboardShortcutRow[] }>(
    fetch('/api/keyboard-shortcuts/seed', { method: 'POST' }),
  )
  return shortcuts
}

export async function fetchKeyboardShortcuts(scope?: KeyboardShortcutScope): Promise<KeyboardShortcutRow[]> {
  const suffix = scope ? `?scope=${encodeURIComponent(scope)}` : ''
  const { shortcuts } = await json<{ shortcuts: KeyboardShortcutRow[] }>(
    fetch(`/api/keyboard-shortcuts${suffix}`),
  )
  return shortcuts
}

export async function resolveKeyboardShortcut(body: {
  scope: KeyboardShortcutScope
  keys: string[]
}): Promise<{
  shortcut: KeyboardShortcutRow | null
  searchedScopes: KeyboardShortcutScope[]
}> {
  return json<{ shortcut: KeyboardShortcutRow | null; searchedScopes: KeyboardShortcutScope[] }>(
    fetch('/api/keyboard-shortcuts/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchKeyboardShortcutConflicts(): Promise<Array<{
  scope: KeyboardShortcutScope
  keys: string[]
  actions: string[]
}>> {
  const { conflicts } = await json<{
    conflicts: Array<{ scope: KeyboardShortcutScope; keys: string[]; actions: string[] }>
  }>(fetch('/api/keyboard-shortcuts/conflicts'))
  return conflicts
}

export async function seedAccessibilityProfiles(): Promise<AccessibilityProfileRow[]> {
  const { profiles } = await json<{ profiles: AccessibilityProfileRow[] }>(
    fetch('/api/accessibility/profiles/seed', { method: 'POST' }),
  )
  return profiles
}

export async function fetchAccessibilityProfiles(params: {
  status?: 'active' | 'disabled'
  limit?: number
} = {}): Promise<AccessibilityProfileRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { profiles } = await json<{ profiles: AccessibilityProfileRow[] }>(
    fetch(`/api/accessibility/profiles${suffix}`),
  )
  return profiles
}

export async function createAccessibilityProfile(body: {
  profileKey: string
  name: string
  keyboardNavigation?: boolean
  screenReaderSupport?: boolean
  highContrastMode?: boolean
  fontScale?: number
  colorScheme?: AccessibilityColorScheme
  themeProfileId?: string | null
}): Promise<AccessibilityProfileRow> {
  const { profile } = await json<{ profile: AccessibilityProfileRow }>(
    fetch('/api/accessibility/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return profile
}

export async function evaluateAccessibilityProfile(profileId: string): Promise<{
  profile: AccessibilityProfileRow
  summary: {
    total: number
    passing: number
    failing: number
  }
}> {
  return json<{
    profile: AccessibilityProfileRow
    summary: {
      total: number
      passing: number
      failing: number
    }
  }>(fetch(`/api/accessibility/profiles/${encodeURIComponent(profileId)}/evaluate`, { method: 'POST' }))
}

export async function seedArchitectureEvolutionReservations(): Promise<ArchitectureEvolutionReservationRow[]> {
  const { reservations } = await json<{ reservations: ArchitectureEvolutionReservationRow[] }>(
    fetch('/api/future-architecture/reservations/seed', { method: 'POST' }),
  )
  return reservations
}

export async function fetchArchitectureEvolutionReservations(params: {
  track?: ArchitectureEvolutionTrack
  abstractionKind?: ArchitectureAbstractionKind
  status?: ArchitectureEvolutionStatus
  limit?: number
} = {}): Promise<ArchitectureEvolutionReservationRow[]> {
  const qs = new URLSearchParams()
  if (params.track) qs.set('track', params.track)
  if (params.abstractionKind) qs.set('abstractionKind', params.abstractionKind)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { reservations } = await json<{ reservations: ArchitectureEvolutionReservationRow[] }>(
    fetch(`/api/future-architecture/reservations${suffix}`),
  )
  return reservations
}

export async function createArchitectureEvolutionReservation(body: {
  track: ArchitectureEvolutionTrack
  abstractionKind: ArchitectureAbstractionKind
  abstractionName: string
  currentImplementation: string
  futureImplementation: string
  migrationTrigger: string
  notes?: string
  evidence?: JsonObject
  status?: ArchitectureEvolutionStatus
}): Promise<ArchitectureEvolutionReservationRow> {
  const { reservation } = await json<{ reservation: ArchitectureEvolutionReservationRow }>(
    fetch('/api/future-architecture/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return reservation
}

export async function evaluateArchitectureEvolutionReadiness(): Promise<{
  reservations: ArchitectureEvolutionReservationRow[]
  summary: {
    total: number
    reserved: number
    tracks: ArchitectureEvolutionTrack[]
    abstractions: ArchitectureAbstractionKind[]
  }
}> {
  return json<{
    reservations: ArchitectureEvolutionReservationRow[]
    summary: {
      total: number
      reserved: number
      tracks: ArchitectureEvolutionTrack[]
      abstractions: ArchitectureAbstractionKind[]
    }
  }>(fetch('/api/future-architecture/reservations/evaluate', { method: 'POST' }))
}

export async function seedReasonixFileFormats(): Promise<ReasonixFileFormatSpecRow[]> {
  const { formats } = await json<{ formats: ReasonixFileFormatSpecRow[] }>(
    fetch('/api/reasonix-file-formats/seed', { method: 'POST' }),
  )
  return formats
}

export async function fetchReasonixFileFormats(
  formatKind?: ReasonixFileFormatKind,
): Promise<ReasonixFileFormatSpecRow[]> {
  const suffix = formatKind ? `?formatKind=${encodeURIComponent(formatKind)}` : ''
  const { formats } = await json<{ formats: ReasonixFileFormatSpecRow[] }>(
    fetch(`/api/reasonix-file-formats${suffix}`),
  )
  return formats
}

export async function validateReasonixFile(body: {
  formatKind: ReasonixFileFormatKind
  payload: JsonObject
  signature?: string | null
}): Promise<ReasonixFileValidationRow> {
  const { validation } = await json<{ validation: ReasonixFileValidationRow }>(
    fetch('/api/reasonix-file-formats/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return validation
}

export async function fetchReasonixFileValidations(
  formatKind?: ReasonixFileFormatKind,
): Promise<ReasonixFileValidationRow[]> {
  const suffix = formatKind ? `?formatKind=${encodeURIComponent(formatKind)}` : ''
  const { validations } = await json<{ validations: ReasonixFileValidationRow[] }>(
    fetch(`/api/reasonix-file-validations${suffix}`),
  )
  return validations
}

export async function checkMigrationCompatibility(body: {
  sourceTool: MigrationSourceTool
  sourceName?: string
  payload: JsonObject
}): Promise<MigrationWizardSessionRow> {
  const { session } = await json<{ session: MigrationWizardSessionRow }>(
    fetch('/api/migrations/compatibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return session
}

export async function fetchMigrationWizardSessions(
  sourceTool?: MigrationSourceTool,
): Promise<MigrationWizardSessionRow[]> {
  const suffix = sourceTool ? `?sourceTool=${encodeURIComponent(sourceTool)}` : ''
  const { sessions } = await json<{ sessions: MigrationWizardSessionRow[] }>(
    fetch(`/api/migrations/sessions${suffix}`),
  )
  return sessions
}

export async function importMigrationSession(
  sessionId: string,
  body: { mode?: 'dry_run' | 'import' } = {},
): Promise<{
  session: MigrationWizardSessionRow
  records: MigrationImportRecordRow[]
  createdAgentProfiles: AgentProfileRow[]
  createdMemoryItems: MemoryItemRow[]
  createdWorkflows: WorkflowRow[]
  dryRun: boolean
}> {
  return json<{
    session: MigrationWizardSessionRow
    records: MigrationImportRecordRow[]
    createdAgentProfiles: AgentProfileRow[]
    createdMemoryItems: MemoryItemRow[]
    createdWorkflows: WorkflowRow[]
    dryRun: boolean
  }>(
    fetch(`/api/migrations/sessions/${encodeURIComponent(sessionId)}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchMigrationImportRecords(sessionId?: string): Promise<MigrationImportRecordRow[]> {
  const suffix = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
  const { records } = await json<{ records: MigrationImportRecordRow[] }>(
    fetch(`/api/migrations/import-records${suffix}`),
  )
  return records
}

export async function runPerformanceAnalysis(body: {
  scope?: PerformanceAnalysisScope
  agentProfileId?: string | null
  windowStart?: number | null
  windowEnd?: number | null
  samples?: JsonObject
}): Promise<{
  run: PerformanceAnalysisRunRow
  recommendations: PerformanceOptimizationRecommendationRow[]
}> {
  return json<{
    run: PerformanceAnalysisRunRow
    recommendations: PerformanceOptimizationRecommendationRow[]
  }>(
    fetch('/api/performance-analysis/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchPerformanceAnalysisRuns(args: {
  scope?: PerformanceAnalysisScope
  agentProfileId?: string
} = {}): Promise<PerformanceAnalysisRunRow[]> {
  const params = new URLSearchParams()
  if (args.scope) params.set('scope', args.scope)
  if (args.agentProfileId) params.set('agentProfileId', args.agentProfileId)
  const suffix = params.size ? `?${params.toString()}` : ''
  const { runs } = await json<{ runs: PerformanceAnalysisRunRow[] }>(
    fetch(`/api/performance-analysis/runs${suffix}`),
  )
  return runs
}

export async function fetchPerformanceOptimizationRecommendations(
  analysisRunId?: string,
): Promise<PerformanceOptimizationRecommendationRow[]> {
  const suffix = analysisRunId ? `?analysisRunId=${encodeURIComponent(analysisRunId)}` : ''
  const { recommendations } = await json<{
    recommendations: PerformanceOptimizationRecommendationRow[]
  }>(fetch(`/api/performance-analysis/recommendations${suffix}`))
  return recommendations
}

export async function seedSecurityAuditChecklist(): Promise<SecurityAuditChecklistItemRow[]> {
  const { items } = await json<{ items: SecurityAuditChecklistItemRow[] }>(
    fetch('/api/security-audits/checklist/seed', { method: 'POST' }),
  )
  return items
}

export async function fetchSecurityAuditChecklistItems(
  cadence?: SecurityAuditCadence,
): Promise<SecurityAuditChecklistItemRow[]> {
  const suffix = cadence ? `?cadence=${encodeURIComponent(cadence)}` : ''
  const { items } = await json<{ items: SecurityAuditChecklistItemRow[] }>(
    fetch(`/api/security-audits/checklist${suffix}`),
  )
  return items
}

export async function runSecurityAudit(body: {
  cadence?: 'quarterly' | 'major_version' | 'continuous'
  releaseLabel?: string
  evidence?: JsonObject
}): Promise<{
  run: SecurityAuditRunRow
  items: SecurityAuditRunItemRow[]
}> {
  return json<{
    run: SecurityAuditRunRow
    items: SecurityAuditRunItemRow[]
  }>(
    fetch('/api/security-audits/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchSecurityAuditRuns(cadence?: SecurityAuditCadence): Promise<SecurityAuditRunRow[]> {
  const suffix = cadence ? `?cadence=${encodeURIComponent(cadence)}` : ''
  const { runs } = await json<{ runs: SecurityAuditRunRow[] }>(
    fetch(`/api/security-audits/runs${suffix}`),
  )
  return runs
}

export async function fetchSecurityAuditRunItems(runId?: string): Promise<SecurityAuditRunItemRow[]> {
  const suffix = runId ? `?runId=${encodeURIComponent(runId)}` : ''
  const { items } = await json<{ items: SecurityAuditRunItemRow[] }>(
    fetch(`/api/security-audits/run-items${suffix}`),
  )
  return items
}

export async function seedIncidentResponsePlans(): Promise<IncidentResponsePlanRow[]> {
  const { plans } = await json<{ plans: IncidentResponsePlanRow[] }>(
    fetch('/api/incident-response/plans/seed', { method: 'POST' }),
  )
  return plans
}

export async function fetchIncidentResponsePlans(): Promise<IncidentResponsePlanRow[]> {
  const { plans } = await json<{ plans: IncidentResponsePlanRow[] }>(
    fetch('/api/incident-response/plans'),
  )
  return plans
}

export async function createIncidentReport(body: {
  severity: IncidentSeverity
  title: string
  trigger: string
  affectedResources?: string[]
  evidence?: JsonObject
}): Promise<{
  incident: IncidentReportRow
  actions: IncidentResponseActionRow[]
}> {
  return json<{
    incident: IncidentReportRow
    actions: IncidentResponseActionRow[]
  }>(
    fetch('/api/incident-response/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchIncidentReports(severity?: IncidentSeverity): Promise<IncidentReportRow[]> {
  const suffix = severity ? `?severity=${encodeURIComponent(severity)}` : ''
  const { incidents } = await json<{ incidents: IncidentReportRow[] }>(
    fetch(`/api/incident-response/incidents${suffix}`),
  )
  return incidents
}

export async function fetchIncidentResponseActions(incidentId?: string): Promise<IncidentResponseActionRow[]> {
  const suffix = incidentId ? `?incidentId=${encodeURIComponent(incidentId)}` : ''
  const { actions } = await json<{ actions: IncidentResponseActionRow[] }>(
    fetch(`/api/incident-response/actions${suffix}`),
  )
  return actions
}

export async function completeIncidentResponseAction(
  actionId: string,
  evidence: JsonObject = {},
): Promise<IncidentResponseActionRow> {
  const { action } = await json<{ action: IncidentResponseActionRow }>(
    fetch(`/api/incident-response/actions/${encodeURIComponent(actionId)}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evidence }),
    }),
  )
  return action
}

export async function seedCapacityPlanningProfiles(): Promise<CapacityPlanningProfileRow[]> {
  const { profiles } = await json<{ profiles: CapacityPlanningProfileRow[] }>(
    fetch('/api/capacity-planning/profiles/seed', { method: 'POST' }),
  )
  return profiles
}

export async function fetchCapacityPlanningProfiles(): Promise<CapacityPlanningProfileRow[]> {
  const { profiles } = await json<{ profiles: CapacityPlanningProfileRow[] }>(
    fetch('/api/capacity-planning/profiles'),
  )
  return profiles
}

export async function evaluateCapacityPlan(body: {
  memoryGb: number
  cpuCores: number
  hasGpu?: boolean
  desiredAgents?: number
  desiredBrowsers?: number
  agentCount?: number
  memoriesPerAgent?: number
  taskCount?: number
}): Promise<CapacityPlanningEvaluationRow> {
  const { evaluation } = await json<{ evaluation: CapacityPlanningEvaluationRow }>(
    fetch('/api/capacity-planning/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evaluation
}

export async function fetchCapacityPlanningEvaluations(): Promise<CapacityPlanningEvaluationRow[]> {
  const { evaluations } = await json<{ evaluations: CapacityPlanningEvaluationRow[] }>(
    fetch('/api/capacity-planning/evaluations'),
  )
  return evaluations
}

export async function seedDeprecationPolicyStages(): Promise<DeprecationPolicyStageRow[]> {
  const { stages } = await json<{ stages: DeprecationPolicyStageRow[] }>(
    fetch('/api/deprecation-policy/stages/seed', { method: 'POST' }),
  )
  return stages
}

export async function fetchDeprecationPolicyStages(): Promise<DeprecationPolicyStageRow[]> {
  const { stages } = await json<{ stages: DeprecationPolicyStageRow[] }>(
    fetch('/api/deprecation-policy/stages'),
  )
  return stages
}

export async function createFeatureDeprecation(body: {
  featureKey: string
  featureName: string
  replacementFeature?: string | null
  migrationGuide: string
  autoMigrateAvailable?: boolean
  noticeAt?: number
}): Promise<FeatureDeprecationRow> {
  const { feature } = await json<{ feature: FeatureDeprecationRow }>(
    fetch('/api/deprecation-policy/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return feature
}

export async function fetchFeatureDeprecations(): Promise<FeatureDeprecationRow[]> {
  const { features } = await json<{ features: FeatureDeprecationRow[] }>(
    fetch('/api/deprecation-policy/features'),
  )
  return features
}

export async function resolveFeatureDeprecationStage(
  featureDeprecationId: string,
  at?: number,
): Promise<FeatureDeprecationRow> {
  const { feature } = await json<{ feature: FeatureDeprecationRow }>(
    fetch(`/api/deprecation-policy/features/${encodeURIComponent(featureDeprecationId)}/resolve-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ at }),
    }),
  )
  return feature
}

export async function runDeprecationMigration(
  featureDeprecationId: string,
  body: { mode?: 'dry_run' | 'apply'; itemCount?: number } = {},
): Promise<DeprecationMigrationRunRow> {
  const { migrationRun } = await json<{ migrationRun: DeprecationMigrationRunRow }>(
    fetch(`/api/deprecation-policy/features/${encodeURIComponent(featureDeprecationId)}/migrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return migrationRun
}

export async function fetchDeprecationMigrationRuns(
  featureDeprecationId?: string,
): Promise<DeprecationMigrationRunRow[]> {
  const suffix = featureDeprecationId
    ? `?featureDeprecationId=${encodeURIComponent(featureDeprecationId)}`
    : ''
  const { migrationRuns } = await json<{ migrationRuns: DeprecationMigrationRunRow[] }>(
    fetch(`/api/deprecation-policy/migration-runs${suffix}`),
  )
  return migrationRuns
}

export async function seedDocumentationArchitecture(): Promise<{
  sections: DocumentationSectionRow[]
  pages: DocumentationPageRow[]
}> {
  return json<{ sections: DocumentationSectionRow[]; pages: DocumentationPageRow[] }>(
    fetch('/api/documentation/architecture/seed', { method: 'POST' }),
  )
}

export async function fetchDocumentationSections(params: {
  category?: DocumentationSectionCategory
  status?: string
  limit?: number
} = {}): Promise<DocumentationSectionRow[]> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { sections } = await json<{ sections: DocumentationSectionRow[] }>(
    fetch(`/api/documentation/sections${suffix}`),
  )
  return sections
}

export async function fetchDocumentationPages(params: {
  category?: DocumentationSectionCategory
  sectionId?: string
  status?: 'planned' | 'draft' | 'published' | 'missing'
  limit?: number
} = {}): Promise<DocumentationPageRow[]> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.sectionId) qs.set('sectionId', params.sectionId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { pages } = await json<{ pages: DocumentationPageRow[] }>(
    fetch(`/api/documentation/pages${suffix}`),
  )
  return pages
}

export async function seedHelpCenter(): Promise<{
  surfaces: HelpCenterSurfaceRow[]
  items: HelpCenterItemRow[]
  onboardingFlows: HelpOnboardingFlowRow[]
}> {
  return json<{
    surfaces: HelpCenterSurfaceRow[]
    items: HelpCenterItemRow[]
    onboardingFlows: HelpOnboardingFlowRow[]
  }>(fetch('/api/help-center/seed', { method: 'POST' }))
}

export async function createHelpCenterSurface(body: {
  surfaceKey: string
  route: string
  title: string
  description?: string
  documentationPageId?: string | null
  docHref?: string
  questionButtonLabel?: string
  status?: HelpCenterSurfaceStatus
}): Promise<HelpCenterSurfaceRow> {
  const { surface } = await json<{ surface: HelpCenterSurfaceRow }>(
    fetch('/api/help-center/surfaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return surface
}

export async function fetchHelpCenterSurfaces(params: {
  surfaceKey?: string
  status?: HelpCenterSurfaceStatus
  limit?: number
} = {}): Promise<HelpCenterSurfaceRow[]> {
  const qs = new URLSearchParams()
  if (params.surfaceKey) qs.set('surfaceKey', params.surfaceKey)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { surfaces } = await json<{ surfaces: HelpCenterSurfaceRow[] }>(
    fetch(`/api/help-center/surfaces${suffix}`),
  )
  return surfaces
}

export async function createHelpCenterItem(body: {
  surfaceId: string
  itemKey: string
  itemType: HelpCenterItemType
  label: string
  body?: string
  selector?: string | null
  docHref?: string
  exampleValue?: JsonObject
  orderIndex?: number
  status?: string
}): Promise<HelpCenterItemRow> {
  const { item } = await json<{ item: HelpCenterItemRow }>(
    fetch('/api/help-center/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return item
}

export async function fetchHelpCenterItems(params: {
  surfaceId?: string
  surfaceKey?: string
  itemType?: HelpCenterItemType
  query?: string
  limit?: number
} = {}): Promise<HelpCenterItemRow[]> {
  const qs = new URLSearchParams()
  if (params.surfaceId) qs.set('surfaceId', params.surfaceId)
  if (params.surfaceKey) qs.set('surfaceKey', params.surfaceKey)
  if (params.itemType) qs.set('itemType', params.itemType)
  if (params.query) qs.set('query', params.query)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { items } = await json<{ items: HelpCenterItemRow[] }>(
    fetch(`/api/help-center/items${suffix}`),
  )
  return items
}

export async function createHelpOnboardingFlow(body: {
  flowKey: string
  title: string
  description?: string
  startSurfaceKey?: string
  steps: JsonObject[]
  status?: HelpOnboardingFlowStatus
}): Promise<HelpOnboardingFlowRow> {
  const { onboardingFlow } = await json<{ onboardingFlow: HelpOnboardingFlowRow }>(
    fetch('/api/help-center/onboarding-flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return onboardingFlow
}

export async function fetchHelpOnboardingFlows(params: {
  flowKey?: string
  status?: HelpOnboardingFlowStatus
  limit?: number
} = {}): Promise<HelpOnboardingFlowRow[]> {
  const qs = new URLSearchParams()
  if (params.flowKey) qs.set('flowKey', params.flowKey)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { onboardingFlows } = await json<{ onboardingFlows: HelpOnboardingFlowRow[] }>(
    fetch(`/api/help-center/onboarding-flows${suffix}`),
  )
  return onboardingFlows
}

export async function seedGlossaryTerms(): Promise<GlossaryTermRow[]> {
  const { terms } = await json<{ terms: GlossaryTermRow[] }>(
    fetch('/api/documentation/glossary/seed', { method: 'POST' }),
  )
  return terms
}

export async function fetchGlossaryTerms(params: {
  category?: GlossaryTermCategory
  term?: string
  status?: string
  limit?: number
} = {}): Promise<GlossaryTermRow[]> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.term) qs.set('term', params.term)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { terms } = await json<{ terms: GlossaryTermRow[] }>(
    fetch(`/api/documentation/glossary${suffix}`),
  )
  return terms
}

export async function seedFaqEntries(): Promise<FaqEntryRow[]> {
  const { entries } = await json<{ entries: FaqEntryRow[] }>(
    fetch('/api/documentation/faq/seed', { method: 'POST' }),
  )
  return entries
}

export async function fetchFaqEntries(params: {
  category?: FaqEntryCategory
  query?: string
  status?: string
  limit?: number
} = {}): Promise<FaqEntryRow[]> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.query) qs.set('query', params.query)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { entries } = await json<{ entries: FaqEntryRow[] }>(
    fetch(`/api/documentation/faq${suffix}`),
  )
  return entries
}

export async function seedTroubleshootingEntries(): Promise<TroubleshootingEntryRow[]> {
  const { entries } = await json<{ entries: TroubleshootingEntryRow[] }>(
    fetch('/api/documentation/troubleshooting/seed', { method: 'POST' }),
  )
  return entries
}

export async function fetchTroubleshootingEntries(params: {
  category?: TroubleshootingCategory
  query?: string
  status?: string
  limit?: number
} = {}): Promise<TroubleshootingEntryRow[]> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.query) qs.set('query', params.query)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { entries } = await json<{ entries: TroubleshootingEntryRow[] }>(
    fetch(`/api/documentation/troubleshooting${suffix}`),
  )
  return entries
}

export async function seedQuickReferenceItems(): Promise<QuickReferenceItemRow[]> {
  const { items } = await json<{ items: QuickReferenceItemRow[] }>(
    fetch('/api/documentation/quick-reference/seed', { method: 'POST' }),
  )
  return items
}

export async function fetchQuickReferenceItems(params: {
  category?: QuickReferenceCategory
  query?: string
  status?: string
  limit?: number
} = {}): Promise<QuickReferenceItemRow[]> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.query) qs.set('query', params.query)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { items } = await json<{ items: QuickReferenceItemRow[] }>(
    fetch(`/api/documentation/quick-reference${suffix}`),
  )
  return items
}

export async function seedNonGoalPolicies(): Promise<NonGoalPolicyRow[]> {
  const { policies } = await json<{ policies: NonGoalPolicyRow[] }>(
    fetch('/api/documentation/non-goals/seed', { method: 'POST' }),
  )
  return policies
}

export async function fetchNonGoalPolicies(params: {
  scope?: NonGoalScope
  status?: string
  limit?: number
} = {}): Promise<NonGoalPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.scope) qs.set('scope', params.scope)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: NonGoalPolicyRow[] }>(
    fetch(`/api/documentation/non-goals${suffix}`),
  )
  return policies
}

export async function seedBrandIdentity(): Promise<{
  candidates: BrandCandidateRow[]
  guideline: BrandGuidelineRow
}> {
  return json<{ candidates: BrandCandidateRow[]; guideline: BrandGuidelineRow }>(
    fetch('/api/branding/seed', { method: 'POST' }),
  )
}

export async function fetchBrandCandidates(params: {
  language?: BrandCandidateLanguage
  status?: string
  limit?: number
} = {}): Promise<BrandCandidateRow[]> {
  const qs = new URLSearchParams()
  if (params.language) qs.set('language', params.language)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { candidates } = await json<{ candidates: BrandCandidateRow[] }>(
    fetch(`/api/branding/candidates${suffix}`),
  )
  return candidates
}

export async function fetchBrandGuidelines(params: {
  status?: string
  limit?: number
} = {}): Promise<BrandGuidelineRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { guidelines } = await json<{ guidelines: BrandGuidelineRow[] }>(
    fetch(`/api/branding/guidelines${suffix}`),
  )
  return guidelines
}

export async function seedCompetitivePositioningReport(): Promise<CompetitivePositioningReportRow> {
  const { report } = await json<{ report: CompetitivePositioningReportRow }>(
    fetch('/api/competitive-positioning/seed', { method: 'POST' }),
  )
  return report
}

export async function fetchCompetitivePositioningReports(params: {
  status?: CompetitivePositioningStatus
  limit?: number
} = {}): Promise<CompetitivePositioningReportRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { reports } = await json<{ reports: CompetitivePositioningReportRow[] }>(
    fetch(`/api/competitive-positioning/reports${suffix}`),
  )
  return reports
}

export async function createCompetitivePositioningReport(body: {
  name?: string
  competitors?: JsonObject[]
  differentiators?: JsonObject[]
  strategicImplications?: JsonObject[]
  summary?: string
  status?: CompetitivePositioningStatus
}): Promise<CompetitivePositioningReportRow> {
  const { report } = await json<{ report: CompetitivePositioningReportRow }>(
    fetch('/api/competitive-positioning/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return report
}

export async function seedEcosystemRoadmapPhases(): Promise<EcosystemRoadmapPhaseRow[]> {
  const { phases } = await json<{ phases: EcosystemRoadmapPhaseRow[] }>(
    fetch('/api/ecosystem-roadmap/seed', { method: 'POST' }),
  )
  return phases
}

export async function fetchEcosystemRoadmapPhases(params: {
  stage?: EcosystemRoadmapStage
  status?: EcosystemRoadmapStatus
  limit?: number
} = {}): Promise<EcosystemRoadmapPhaseRow[]> {
  const qs = new URLSearchParams()
  if (params.stage) qs.set('stage', params.stage)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { phases } = await json<{ phases: EcosystemRoadmapPhaseRow[] }>(
    fetch(`/api/ecosystem-roadmap/phases${suffix}`),
  )
  return phases
}

export async function createEcosystemRoadmapPhase(body: {
  phaseNumber: number
  phaseKey: string
  stage: EcosystemRoadmapStage
  title: string
  initiatives?: JsonObject[]
  requiredAssets?: JsonObject
  communityChannels?: string[]
  revenueModel?: string
  enterpriseReadiness?: JsonObject
  status?: EcosystemRoadmapStatus
}): Promise<EcosystemRoadmapPhaseRow> {
  const { phase } = await json<{ phase: EcosystemRoadmapPhaseRow }>(
    fetch('/api/ecosystem-roadmap/phases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return phase
}

export async function seedEthicalAlignmentPolicy(): Promise<EthicalAlignmentPolicyRow> {
  const { policy } = await json<{ policy: EthicalAlignmentPolicyRow }>(
    fetch('/api/ethical-alignment/seed', { method: 'POST' }),
  )
  return policy
}

export async function fetchEthicalAlignmentPolicies(params: {
  status?: EthicalAlignmentPolicyStatus
  limit?: number
} = {}): Promise<EthicalAlignmentPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: EthicalAlignmentPolicyRow[] }>(
    fetch(`/api/ethical-alignment/policies${suffix}`),
  )
  return policies
}

export async function createEthicalAlignmentPolicy(body: {
  name?: string
  refuseCategories?: string[]
  warnCategories?: string[]
  onRefuse?: EthicalOnRefuse
  userValues?: JsonObject
  preTaskAlignment?: JsonObject
  status?: EthicalAlignmentPolicyStatus
}): Promise<EthicalAlignmentPolicyRow> {
  const { policy } = await json<{ policy: EthicalAlignmentPolicyRow }>(
    fetch('/api/ethical-alignment/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return policy
}

export async function evaluateEthicalAlignment(body: {
  policyId?: string
  taskSummary: string
  detectedCategories?: string[]
  uncertain?: boolean
}): Promise<EthicalAlignmentEvaluationRow> {
  const { evaluation } = await json<{ evaluation: EthicalAlignmentEvaluationRow }>(
    fetch('/api/ethical-alignment/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evaluation
}

export async function fetchEthicalAlignmentEvaluations(params: {
  policyId?: string
  decision?: EthicalAlignmentDecision
  limit?: number
} = {}): Promise<EthicalAlignmentEvaluationRow[]> {
  const qs = new URLSearchParams()
  if (params.policyId) qs.set('policyId', params.policyId)
  if (params.decision) qs.set('decision', params.decision)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { evaluations } = await json<{ evaluations: EthicalAlignmentEvaluationRow[] }>(
    fetch(`/api/ethical-alignment/evaluations${suffix}`),
  )
  return evaluations
}

export async function seedLegalCompliance(): Promise<{
  framework: LegalComplianceFrameworkRow
  notices: LegalDisclaimerNoticeRow[]
}> {
  return json<{ framework: LegalComplianceFrameworkRow; notices: LegalDisclaimerNoticeRow[] }>(
    fetch('/api/legal-compliance/seed', { method: 'POST' }),
  )
}

export async function fetchLegalComplianceFrameworks(params: {
  status?: LegalComplianceStatus
  limit?: number
} = {}): Promise<LegalComplianceFrameworkRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { frameworks } = await json<{ frameworks: LegalComplianceFrameworkRow[] }>(
    fetch(`/api/legal-compliance/frameworks${suffix}`),
  )
  return frameworks
}

export async function createLegalComplianceFramework(body: {
  name?: string
  regulations?: JsonObject
  dataResidencyDefault?: string
  notes?: string
  status?: LegalComplianceStatus
}): Promise<LegalComplianceFrameworkRow> {
  const { framework } = await json<{ framework: LegalComplianceFrameworkRow }>(
    fetch('/api/legal-compliance/frameworks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return framework
}

export async function fetchLegalDisclaimerNotices(params: {
  placement?: LegalDisclaimerPlacement
  status?: LegalComplianceStatus
  limit?: number
} = {}): Promise<LegalDisclaimerNoticeRow[]> {
  const qs = new URLSearchParams()
  if (params.placement) qs.set('placement', params.placement)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { notices } = await json<{ notices: LegalDisclaimerNoticeRow[] }>(
    fetch(`/api/legal-compliance/disclaimers${suffix}`),
  )
  return notices
}

export async function createLegalDisclaimerNotice(body: {
  placement: LegalDisclaimerPlacement
  title: string
  message: string
  requiresAcknowledgement?: boolean
  status?: LegalComplianceStatus
}): Promise<LegalDisclaimerNoticeRow> {
  const { notice } = await json<{ notice: LegalDisclaimerNoticeRow }>(
    fetch('/api/legal-compliance/disclaimers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return notice
}

export async function createLicenseComplianceCheck(body: {
  code?: string
  source: string
  declaredLicense?: string
}): Promise<LicenseComplianceCheckRow> {
  const { check } = await json<{ check: LicenseComplianceCheckRow }>(
    fetch('/api/legal-compliance/license-checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return check
}

export async function fetchLicenseComplianceChecks(params: {
  license?: string
  riskLevel?: LicenseRiskLevel
  limit?: number
} = {}): Promise<LicenseComplianceCheckRow[]> {
  const qs = new URLSearchParams()
  if (params.license) qs.set('license', params.license)
  if (params.riskLevel) qs.set('riskLevel', params.riskLevel)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { checks } = await json<{ checks: LicenseComplianceCheckRow[] }>(
    fetch(`/api/legal-compliance/license-checks${suffix}`),
  )
  return checks
}

export async function seedEmotionalUxGuidelines(): Promise<EmotionalUxGuidelineRow[]> {
  const { guidelines } = await json<{ guidelines: EmotionalUxGuidelineRow[] }>(
    fetch('/api/emotional-ux/seed', { method: 'POST' }),
  )
  return guidelines
}

export async function fetchEmotionalUxGuidelines(params: {
  guidelineType?: EmotionalUxGuidelineType
  status?: EmotionalUxStatus
  limit?: number
} = {}): Promise<EmotionalUxGuidelineRow[]> {
  const qs = new URLSearchParams()
  if (params.guidelineType) qs.set('guidelineType', params.guidelineType)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { guidelines } = await json<{ guidelines: EmotionalUxGuidelineRow[] }>(
    fetch(`/api/emotional-ux/guidelines${suffix}`),
  )
  return guidelines
}

export async function createEmotionalUxGuideline(body: {
  guidelineType: EmotionalUxGuidelineType
  scenarioKey: string
  title: string
  messageTemplate?: string
  behavior?: string
  visualCue?: string
  audioCue?: string
  anxietyReduction?: string
  status?: EmotionalUxStatus
}): Promise<EmotionalUxGuidelineRow> {
  const { guideline } = await json<{ guideline: EmotionalUxGuidelineRow }>(
    fetch('/api/emotional-ux/guidelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return guideline
}

export async function runSystemBootstrapChecks(body: {
  observed?: JsonObject
  thresholds?: JsonObject
  now?: number
} = {}): Promise<SystemBootstrapCheckRow[]> {
  const { checks } = await json<{ checks: SystemBootstrapCheckRow[] }>(
    fetch('/api/system-bootstrap/checks/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return checks
}

export async function fetchSystemBootstrapChecks(params: {
  runId?: string
  component?: SystemBootstrapComponent
  status?: SystemBootstrapCheckStatus
  limit?: number
} = {}): Promise<SystemBootstrapCheckRow[]> {
  const qs = new URLSearchParams()
  if (params.runId) qs.set('runId', params.runId)
  if (params.component) qs.set('component', params.component)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { checks } = await json<{ checks: SystemBootstrapCheckRow[] }>(
    fetch(`/api/system-bootstrap/checks${suffix}`),
  )
  return checks
}

export async function seedSuccessMetricDefinitions(): Promise<SuccessMetricDefinitionRow[]> {
  const { definitions } = await json<{ definitions: SuccessMetricDefinitionRow[] }>(
    fetch('/api/success-metrics/seed', { method: 'POST' }),
  )
  return definitions
}

export async function fetchSuccessMetricDefinitions(params: {
  category?: SuccessMetricCategory
  status?: string
  limit?: number
} = {}): Promise<SuccessMetricDefinitionRow[]> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { definitions } = await json<{ definitions: SuccessMetricDefinitionRow[] }>(
    fetch(`/api/success-metrics/definitions${suffix}`),
  )
  return definitions
}

export async function recordSuccessMetricSnapshot(body: {
  metricKey: string
  value: number
  measuredAt?: number
  notes?: string
}): Promise<SuccessMetricSnapshotRow> {
  const { snapshot } = await json<{ snapshot: SuccessMetricSnapshotRow }>(
    fetch('/api/success-metrics/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return snapshot
}

export async function fetchSuccessMetricSnapshots(params: {
  metricKey?: string
  status?: SuccessMetricSnapshotStatus
  limit?: number
} = {}): Promise<SuccessMetricSnapshotRow[]> {
  const qs = new URLSearchParams()
  if (params.metricKey) qs.set('metricKey', params.metricKey)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { snapshots } = await json<{ snapshots: SuccessMetricSnapshotRow[] }>(
    fetch(`/api/success-metrics/snapshots${suffix}`),
  )
  return snapshots
}

export async function seedReadinessChecklistItems(): Promise<ReadinessChecklistItemRow[]> {
  const { items } = await json<{ items: ReadinessChecklistItemRow[] }>(
    fetch('/api/readiness-checklist/seed', { method: 'POST' }),
  )
  return items
}

export async function fetchReadinessChecklistItems(params: {
  category?: ReadinessChecklistCategory
  status?: string
  limit?: number
} = {}): Promise<ReadinessChecklistItemRow[]> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { items } = await json<{ items: ReadinessChecklistItemRow[] }>(
    fetch(`/api/readiness-checklist${suffix}`),
  )
  return items
}

export interface CreateOAuthCredentialBody {
  provider: OAuthProvider
  grantType: OAuthGrantType
  accessTokenSecretRef: string
  refreshTokenSecretRef?: string | null
  expiresAt: number
  scopes?: string[]
  actingAs: OAuthActingAs
  autoRefresh?: boolean
  refreshBeforeExpiry?: number
  allowedOperations?: string[]
  requiresUserConsent?: boolean
  shared?: boolean
  agentProfileId?: string | null
}

export interface OAuthOperationEvaluationResult {
  credentialId: string
  allowed: boolean
  status:
    | 'allowed'
    | 'allowed_with_refresh'
    | 'requires_user_consent'
    | 'refresh_required'
    | 'reauthorization_required'
    | 'denied'
  reasons: string[]
  nextAction: 'execute' | 'refresh_token' | 'request_user_consent' | 'request_reauthorization' | 'block'
  provider: OAuthProvider
  actingAs: OAuthActingAs
  shared: boolean
}

export async function createOAuthCredential(
  body: CreateOAuthCredentialBody,
): Promise<OAuthCredentialRow> {
  const { credential } = await json<{ credential: OAuthCredentialRow }>(
    fetch('/api/oauth/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return credential
}

export async function fetchOAuthCredentials(params: {
  provider?: OAuthProvider
  agentProfileId?: string
  shared?: boolean
  status?: string
  limit?: number
} = {}): Promise<OAuthCredentialRow[]> {
  const qs = new URLSearchParams()
  if (params.provider) qs.set('provider', params.provider)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.shared !== undefined) qs.set('shared', String(params.shared))
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { credentials } = await json<{ credentials: OAuthCredentialRow[] }>(
    fetch(`/api/oauth/credentials${suffix}`),
  )
  return credentials
}

export async function evaluateOAuthCredentialOperation(
  credentialId: string,
  body: {
    operation: string
    requiredScope?: string | null
    agentProfileId?: string | null
    now?: number
  },
): Promise<OAuthOperationEvaluationResult> {
  const { evaluation } = await json<{ evaluation: OAuthOperationEvaluationResult }>(
    fetch(`/api/oauth/credentials/${credentialId}/evaluate-operation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evaluation
}

export async function recordOAuthCredentialRefreshFailure(
  credentialId: string,
  body: {
    message: string
    pausedRunId?: string | null
    reauthorizationUrl?: string | null
  },
): Promise<{ credential: OAuthCredentialRow; event: OAuthRefreshEventRow }> {
  const { result } = await json<{
    result: { credential: OAuthCredentialRow; event: OAuthRefreshEventRow }
  }>(
    fetch(`/api/oauth/credentials/${credentialId}/refresh-failure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function completeOAuthCredentialReauthorization(
  credentialId: string,
  body: {
    accessTokenSecretRef?: string
    refreshTokenSecretRef?: string | null
    expiresAt: number
    scopes?: string[]
    resumedRunId?: string | null
  },
): Promise<{ credential: OAuthCredentialRow; event: OAuthRefreshEventRow }> {
  const { result } = await json<{
    result: { credential: OAuthCredentialRow; event: OAuthRefreshEventRow }
  }>(
    fetch(`/api/oauth/credentials/${credentialId}/reauthorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchOAuthRefreshEvents(params: {
  credentialId?: string
  status?: OAuthRefreshStatus
  limit?: number
} = {}): Promise<OAuthRefreshEventRow[]> {
  const qs = new URLSearchParams()
  if (params.credentialId) qs.set('credentialId', params.credentialId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { events } = await json<{ events: OAuthRefreshEventRow[] }>(
    fetch(`/api/oauth/refresh-events${suffix}`),
  )
  return events
}

export type WorkspaceInitSource =
  | { type: 'git'; url: string; branch?: string | null; depth?: number | null }
  | { type: 'local'; path: string }
  | { type: 'template'; templateId: string }
  | { type: 'empty'; structure: WorkspaceStructure }

export interface CreateWorkspaceTemplateBody {
  name: string
  structure: WorkspaceStructure
  description?: string
  fileTree?: JsonObject[]
  setupDefaults?: JsonObject
  verifyDefaults?: JsonObject
}

export async function createWorkspaceTemplate(
  body: CreateWorkspaceTemplateBody,
): Promise<WorkspaceTemplateRow> {
  const { template } = await json<{ template: WorkspaceTemplateRow }>(
    fetch('/api/workspace-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return template
}

export async function fetchWorkspaceTemplates(params: {
  structure?: WorkspaceStructure
  status?: string
  limit?: number
} = {}): Promise<WorkspaceTemplateRow[]> {
  const qs = new URLSearchParams()
  if (params.structure) qs.set('structure', params.structure)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { templates } = await json<{ templates: WorkspaceTemplateRow[] }>(
    fetch(`/api/workspace-templates${suffix}`),
  )
  return templates
}

export interface PlanWorkspaceInitBody {
  agentProfileId?: string | null
  employeeRunId?: string | null
  source: WorkspaceInitSource
  setup?: {
    installDeps?: boolean
    runMigrations?: boolean
    seedData?: string | null
    linkSharedModules?: boolean
  }
  verify?: {
    runTests?: boolean
    checkTypes?: boolean
    lintCheck?: boolean
    buildCheck?: boolean
  }
  onSetupFail?: WorkspaceSetupFailPolicy
  workspacePath?: string | null
}

export async function planWorkspaceInit(
  body: PlanWorkspaceInitBody,
): Promise<WorkspaceInitRunRow> {
  const { run } = await json<{ run: WorkspaceInitRunRow }>(
    fetch('/api/workspace-inits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return run
}

export async function fetchWorkspaceInitRuns(params: {
  sourceType?: WorkspaceInitSourceType
  status?: WorkspaceInitRunStatus
  agentProfileId?: string
  limit?: number
} = {}): Promise<WorkspaceInitRunRow[]> {
  const qs = new URLSearchParams()
  if (params.sourceType) qs.set('sourceType', params.sourceType)
  if (params.status) qs.set('status', params.status)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { runs } = await json<{ runs: WorkspaceInitRunRow[] }>(
    fetch(`/api/workspace-inits${suffix}`),
  )
  return runs
}

export async function resolveWorkspaceInitFailure(
  workspaceInitRunId: string,
  body: { failureMessage: string },
): Promise<{
  run: WorkspaceInitRunRow
  decision: {
    policy: WorkspaceSetupFailPolicy
    status: WorkspaceInitRunStatus
    nextAction: 'abort_run' | 'retry_setup' | 'continue_with_warning' | 'ask_user'
    message: string
  }
}> {
  const { result } = await json<{
    result: {
      run: WorkspaceInitRunRow
      decision: {
        policy: WorkspaceSetupFailPolicy
        status: WorkspaceInitRunStatus
        nextAction: 'abort_run' | 'retry_setup' | 'continue_with_warning' | 'ask_user'
        message: string
      }
    }
  }>(
    fetch(`/api/workspace-inits/${workspaceInitRunId}/failure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export type CustomModelSource =
  | { type: 'openai_finetune'; modelId: string }
  | { type: 'huggingface'; repoId: string }
  | { type: 'local_gguf'; path: string }
  | { type: 'ollama_custom'; modelName: string }

export interface CreateCustomModelBody {
  name: string
  source: CustomModelSource
  finetuneInfo?: {
    baseModel: string
    dataset: string
    taskSpecialization?: string[]
    finetunedAt: number
    performanceDelta?: string | null
  } | null
  usageConstraints: {
    maxContextWindow: number
    requiresSpecialPromptFormat?: boolean
    knownLimitations?: string[]
    compatibleSkills?: string[]
    incompatibleSkills?: string[]
  }
  status?: CustomModelStatus
}

export async function createCustomModel(body: CreateCustomModelBody): Promise<CustomModelRow> {
  const { customModel } = await json<{ customModel: CustomModelRow }>(
    fetch('/api/custom-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return customModel
}

export async function fetchCustomModels(params: {
  sourceType?: CustomModelSourceType
  status?: CustomModelStatus
  compatibleSkill?: string
  limit?: number
} = {}): Promise<CustomModelRow[]> {
  const qs = new URLSearchParams()
  if (params.sourceType) qs.set('sourceType', params.sourceType)
  if (params.status) qs.set('status', params.status)
  if (params.compatibleSkill) qs.set('compatibleSkill', params.compatibleSkill)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { customModels } = await json<{ customModels: CustomModelRow[] }>(
    fetch(`/api/custom-models${suffix}`),
  )
  return customModels
}

export interface CustomModelEvaluationResult {
  customModelId: string
  compatible: boolean
  reasons: string[]
  warnings: string[]
  maxContextWindow: number
  usableSkills: string[]
  blockedSkills: string[]
}

export async function evaluateCustomModel(
  customModelId: string,
  body: {
    requestedContextWindow?: number
    skillIds?: string[]
    promptFormatAcknowledged?: boolean
  },
): Promise<CustomModelEvaluationResult> {
  const { evaluation } = await json<{ evaluation: CustomModelEvaluationResult }>(
    fetch(`/api/custom-models/${customModelId}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evaluation
}

export async function createFinetuneDatasetExport(body: {
  customModelId?: string | null
  sourceScope: FinetuneDatasetSourceScope
  sourceIds?: string[]
  datasetPurpose: string
  recordCount?: number
  destinationProvider?: string
  includePrivateData?: boolean
  consentStatus?: FinetuneDatasetConsentStatus
}): Promise<FinetuneDatasetExportRow> {
  const { exportRecord } = await json<{ exportRecord: FinetuneDatasetExportRow }>(
    fetch('/api/custom-models/dataset-exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return exportRecord
}

export async function fetchFinetuneDatasetExports(params: {
  customModelId?: string
  consentStatus?: FinetuneDatasetConsentStatus
  sourceScope?: FinetuneDatasetSourceScope
  limit?: number
} = {}): Promise<FinetuneDatasetExportRow[]> {
  const qs = new URLSearchParams()
  if (params.customModelId) qs.set('customModelId', params.customModelId)
  if (params.consentStatus) qs.set('consentStatus', params.consentStatus)
  if (params.sourceScope) qs.set('sourceScope', params.sourceScope)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { exports } = await json<{ exports: FinetuneDatasetExportRow[] }>(
    fetch(`/api/custom-models/dataset-exports${suffix}`),
  )
  return exports
}

export interface CreateProjectContextBody {
  projectName: string
  overrides?: {
    modelProfileId?: string | null
    maxBudget?: number | null
    allowedSkills?: string[]
    requiredApprovalFor?: string[]
    networkProfileId?: string | null
  }
  switchBehavior?: {
    pauseCurrentTasks?: boolean
    isolateMemories?: boolean
    checkpointBeforeSwitch?: boolean
    mode?: ProjectSwitchMode
  }
}

export async function createProjectContext(
  body: CreateProjectContextBody,
): Promise<ProjectContextRow> {
  const { projectContext } = await json<{ projectContext: ProjectContextRow }>(
    fetch('/api/project-contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return projectContext
}

export async function fetchProjectContexts(params: {
  status?: ProjectContextStatus
  limit?: number
} = {}): Promise<ProjectContextRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { projectContexts } = await json<{ projectContexts: ProjectContextRow[] }>(
    fetch(`/api/project-contexts${suffix}`),
  )
  return projectContexts
}

export async function addProjectAgentRole(
  projectContextId: string,
  body: {
    agentId: string
    role: string
    joinedAt?: number
    activeWorkflows?: string[]
    contributedArtifacts?: string[]
    projectSpecificMemories?: string[]
  },
): Promise<ProjectAgentRoleRow> {
  const { agentRole } = await json<{ agentRole: ProjectAgentRoleRow }>(
    fetch(`/api/project-contexts/${projectContextId}/agent-roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return agentRole
}

export async function fetchProjectAgentRoles(
  projectContextId: string,
  params: { status?: string } = {},
): Promise<ProjectAgentRoleRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { agentRoles } = await json<{ agentRoles: ProjectAgentRoleRow[] }>(
    fetch(`/api/project-contexts/${projectContextId}/agent-roles${suffix}`),
  )
  return agentRoles
}

export async function planProjectSwitch(body: {
  agentId: string
  fromProjectContextId?: string | null
  toProjectContextId: string
  behavior?: {
    pauseCurrentTasks?: boolean
    isolateMemories?: boolean
    checkpointBeforeSwitch?: boolean
    mode?: ProjectSwitchMode
  }
}): Promise<ProjectSwitchEventRow> {
  const { switchEvent } = await json<{ switchEvent: ProjectSwitchEventRow }>(
    fetch('/api/project-switch-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return switchEvent
}

export async function fetchProjectSwitchEvents(params: {
  agentId?: string
  toProjectContextId?: string
  status?: ProjectSwitchStatus
  limit?: number
} = {}): Promise<ProjectSwitchEventRow[]> {
  const qs = new URLSearchParams()
  if (params.agentId) qs.set('agentId', params.agentId)
  if (params.toProjectContextId) qs.set('toProjectContextId', params.toProjectContextId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { switchEvents } = await json<{ switchEvents: ProjectSwitchEventRow[] }>(
    fetch(`/api/project-switch-events${suffix}`),
  )
  return switchEvents
}

export interface BehaviorMetricsBody {
  avgStepsPerTask: number
  avgCostPerTask: number
  approvalRequestRate: number
  typicalPlanStructure: string
  toolPreferenceOrder?: string[]
  outputVerbosity: number
}

export async function recordBehaviorSnapshot(body: {
  agentProfileId: string
  kind: BehaviorSnapshotKind
  schedule?: string
  baselineBehavior: BehaviorMetricsBody
  maxAllowedDeviation?: number
}): Promise<BehaviorSnapshotRow> {
  const { snapshot } = await json<{ snapshot: BehaviorSnapshotRow }>(
    fetch('/api/behavior-stabilization/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return snapshot
}

export async function fetchBehaviorSnapshots(params: {
  agentProfileId?: string
  kind?: BehaviorSnapshotKind
  limit?: number
} = {}): Promise<BehaviorSnapshotRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.kind) qs.set('kind', params.kind)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { snapshots } = await json<{ snapshots: BehaviorSnapshotRow[] }>(
    fetch(`/api/behavior-stabilization/snapshots${suffix}`),
  )
  return snapshots
}

export async function analyzeBehaviorDrift(body: {
  baselineSnapshotId: string
  currentSnapshotId: string
  stabilization?: {
    memoryHygiene?: boolean
    resetLearnedBehaviors?: boolean
    reAnchorToOriginalConfig?: boolean
    recalibrateWithBenchmarks?: boolean
  }
  onSignificantDrift?: DriftResponsePolicy
}): Promise<{
  analysis: BehaviorDriftAnalysisRow
  stabilizationRun: BehaviorStabilizationRunRow | null
}> {
  const { result } = await json<{
    result: {
      analysis: BehaviorDriftAnalysisRow
      stabilizationRun: BehaviorStabilizationRunRow | null
    }
  }>(
    fetch('/api/behavior-stabilization/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchBehaviorDriftAnalyses(params: {
  agentProfileId?: string
  severity?: BehaviorDriftSeverity
  limit?: number
} = {}): Promise<BehaviorDriftAnalysisRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.severity) qs.set('severity', params.severity)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { analyses } = await json<{ analyses: BehaviorDriftAnalysisRow[] }>(
    fetch(`/api/behavior-stabilization/analyses${suffix}`),
  )
  return analyses
}

export async function fetchBehaviorStabilizationRuns(params: {
  agentProfileId?: string
  driftAnalysisId?: string
  status?: BehaviorStabilizationRunStatus
  limit?: number
} = {}): Promise<BehaviorStabilizationRunRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.driftAnalysisId) qs.set('driftAnalysisId', params.driftAnalysisId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { runs } = await json<{ runs: BehaviorStabilizationRunRow[] }>(
    fetch(`/api/behavior-stabilization/runs${suffix}`),
  )
  return runs
}

export async function discoverSkillSynthesis(body: {
  skillIds: string[]
  detectComplementaryPairs?: boolean
  suggestNewCompositeSkill?: boolean
}): Promise<SkillSynthesisRecordRow> {
  const { record } = await json<{ record: SkillSynthesisRecordRow }>(
    fetch('/api/skill-synthesis/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return record
}

export async function fetchSkillSynthesisRecords(params: {
  status?: SkillSynthesisStatus
  limit?: number
} = {}): Promise<SkillSynthesisRecordRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { records } = await json<{ records: SkillSynthesisRecordRow[] }>(
    fetch(`/api/skill-synthesis/records${suffix}`),
  )
  return records
}

export async function createToolPipeline(body: {
  synthesisRecordId?: string | null
  name: string
  composedOf: string[]
  chain: JsonObject[]
  inputOutputMapping?: JsonObject
  onStepFailure?: ToolPipelineFailurePolicy
  publishable?: boolean
}): Promise<ToolPipelineRow> {
  const { pipeline } = await json<{ pipeline: ToolPipelineRow }>(
    fetch('/api/tool-pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return pipeline
}

export async function fetchToolPipelines(params: {
  status?: ToolPipelineStatus
  synthesisRecordId?: string
  limit?: number
} = {}): Promise<ToolPipelineRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.synthesisRecordId) qs.set('synthesisRecordId', params.synthesisRecordId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { pipelines } = await json<{ pipelines: ToolPipelineRow[] }>(
    fetch(`/api/tool-pipelines${suffix}`),
  )
  return pipelines
}

export async function publishToolPipeline(toolPipelineId: string): Promise<ToolPipelineRow> {
  const { pipeline } = await json<{ pipeline: ToolPipelineRow }>(
    fetch(`/api/tool-pipelines/${toolPipelineId}/publish`, { method: 'POST' }),
  )
  return pipeline
}

export async function upsertUnifiedSearchEntry(body: {
  entityType: UnifiedSearchEntityType
  entityId: string
  title: string
  content: string
  snippet?: string
  keywords?: string[]
  agentName?: string | null
  taskName?: string | null
  projectName?: string | null
  timestamp?: number
}): Promise<UnifiedSearchIndexRow> {
  const { entry } = await json<{ entry: UnifiedSearchIndexRow }>(
    fetch('/api/unified-search/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return entry
}

export async function fetchUnifiedSearchEntries(params: {
  entityType?: UnifiedSearchEntityType
  projectName?: string
  limit?: number
} = {}): Promise<UnifiedSearchIndexRow[]> {
  const qs = new URLSearchParams()
  if (params.entityType) qs.set('entityType', params.entityType)
  if (params.projectName) qs.set('projectName', params.projectName)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { entries } = await json<{ entries: UnifiedSearchIndexRow[] }>(
    fetch(`/api/unified-search/index${suffix}`),
  )
  return entries
}

export interface UnifiedSearchResult {
  id: string
  title: string
  snippet: string
  relevanceScore: number
  source: {
    agentName?: string
    taskName?: string
    projectName?: string
    timestamp: number
  }
}

export async function searchUnifiedIndex(body: {
  query: string
  scope?: {
    agents?: boolean
    tasks?: boolean
    memories?: boolean
    artifacts?: boolean
    workflows?: boolean
    events?: boolean
    knowledgeGraph?: boolean
    documents?: boolean
  }
  modes?: {
    keyword?: boolean
    semantic?: boolean
    hybrid?: boolean
    filtered?: boolean
  }
  filters?: {
    entityTypes?: UnifiedSearchEntityType[]
    agentName?: string
    projectName?: string
    dateFrom?: number
    dateTo?: number
  }
  nlQuery?: boolean
  limit?: number
}): Promise<Record<string, UnifiedSearchResult[]>> {
  const { results } = await json<{ results: Record<string, UnifiedSearchResult[]> }>(
    fetch('/api/unified-search/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return results
}

export interface ContextPreloadFlags {
  relevantMemories?: boolean
  projectStructure?: boolean
  recentChanges?: boolean
  activeGuidelines?: boolean
  peerAgentStatus?: boolean
  recentErrors?: boolean
}

export interface ContextCachePolicy {
  projectStructureTTL?: string
  semanticCacheTTL?: number
  memorySearchCacheTTL?: number
}

export async function planContextPreload(body: {
  agentProfileId?: string | null
  projectId?: string | null
  taskType?: ContextPreloadTaskType
  goal: string
  preload?: ContextPreloadFlags
  cache?: ContextCachePolicy
}): Promise<ContextCacheRow> {
  const { cache } = await json<{ cache: ContextCacheRow }>(
    fetch('/api/context-cache/preload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return cache
}

export async function fetchContextCaches(params: {
  agentProfileId?: string
  projectId?: string
  taskType?: ContextPreloadTaskType
  status?: ContextCacheStatus
  limit?: number
} = {}): Promise<ContextCacheRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.projectId) qs.set('projectId', params.projectId)
  if (params.taskType) qs.set('taskType', params.taskType)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { caches } = await json<{ caches: ContextCacheRow[] }>(
    fetch(`/api/context-cache${suffix}`),
  )
  return caches
}

export async function resolveContextCache(body: {
  contextCacheId?: string | null
  cacheKey?: string | null
  invalidationSignal?: string | null
}): Promise<ContextCacheRow> {
  const { cache } = await json<{ cache: ContextCacheRow }>(
    fetch('/api/context-cache/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return cache
}

export interface CreateSoftwareProfileBody {
  name: string
  appType: SoftwareAppType
  adapterType: SoftwareAdapterType
  launchCommand?: string | null
  executablePath?: string | null
  defaultWorkstationMode?: WorkstationMode
}

export async function fetchSoftwareProfiles(): Promise<SoftwareProfileRow[]> {
  const { softwareProfiles } = await json<{ softwareProfiles: SoftwareProfileRow[] }>(
    fetch('/api/software-profiles'),
  )
  return softwareProfiles
}

export async function createSoftwareProfile(
  body: CreateSoftwareProfileBody,
): Promise<SoftwareProfileRow> {
  const { softwareProfile } = await json<{ softwareProfile: SoftwareProfileRow }>(
    fetch('/api/software-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return softwareProfile
}

export async function fetchSoftwareCommands(): Promise<SoftwareCommandRow[]> {
  const { softwareCommands } = await json<{ softwareCommands: SoftwareCommandRow[] }>(
    fetch('/api/software-commands'),
  )
  return softwareCommands
}

export interface CreateSoftwareCommandBody {
  name: string
  description?: string
  inputSchema?: JsonObject
  outputSchema?: JsonObject
  implementation: JsonObject
  riskLevel?: RiskLevel
  requiresApproval?: boolean
}

export async function createSoftwareCommand(
  softwareProfileId: string,
  body: CreateSoftwareCommandBody,
): Promise<SoftwareCommandRow> {
  const { softwareCommand } = await json<{ softwareCommand: SoftwareCommandRow }>(
    fetch(`/api/software-profiles/${softwareProfileId}/record-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return softwareCommand
}

export interface RunSoftwareCommandBody {
  agentProfileId?: string | null
  workflowRunId?: string | null
  workflowNodeRunId?: string | null
  input?: JsonObject
  mode?: 'dry_run' | 'execute'
  computerSessionId?: string | null
  live?: boolean
  confirmRisk?: boolean
  approvalRequestId?: string | null
}

export async function runSoftwareCommand(
  softwareCommandId: string,
  body: RunSoftwareCommandBody = {},
): Promise<SoftwareCommandRunRow> {
  const { softwareCommandRun } = await json<{ softwareCommandRun: SoftwareCommandRunRow }>(
    fetch(`/api/software-commands/${softwareCommandId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return softwareCommandRun
}

export async function testSoftwareCommand(
  softwareCommandId: string,
): Promise<ControlPlaneTestResult> {
  const { result } = await json<{ result: ControlPlaneTestResult }>(
    fetch(`/api/software-commands/${softwareCommandId}/test`, { method: 'POST' }),
  )
  return result
}

export async function fetchSoftwareCommandRuns(params: {
  softwareCommandId?: string
  softwareProfileId?: string
  agentProfileId?: string
  workflowRunId?: string
} = {}): Promise<SoftwareCommandRunRow[]> {
  const qs = new URLSearchParams()
  if (params.softwareCommandId) qs.set('softwareCommandId', params.softwareCommandId)
  if (params.softwareProfileId) qs.set('softwareProfileId', params.softwareProfileId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.workflowRunId) qs.set('workflowRunId', params.workflowRunId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { softwareCommandRuns } = await json<{
    softwareCommandRuns: SoftwareCommandRunRow[]
  }>(fetch(`/api/software-command-runs${suffix}`))
  return softwareCommandRuns
}

export interface CreateRecordedMacroBody {
  softwareProfileId: string
  name: string
  description?: string
  steps: JsonObject[]
  inputSchema?: JsonObject
  outputSchema?: JsonObject
  parameterBindings?: JsonObject
  riskLevel?: RiskLevel
  status?: 'draft' | 'active' | 'archived'
}

export async function fetchRecordedMacros(
  softwareProfileId?: string,
): Promise<RecordedMacroRow[]> {
  const qs = softwareProfileId ? `?softwareProfileId=${encodeURIComponent(softwareProfileId)}` : ''
  const { recordedMacros } = await json<{ recordedMacros: RecordedMacroRow[] }>(
    fetch(`/api/recorded-macros${qs}`),
  )
  return recordedMacros
}

export async function createRecordedMacro(body: CreateRecordedMacroBody): Promise<RecordedMacroRow> {
  const { recordedMacro } = await json<{ recordedMacro: RecordedMacroRow }>(
    fetch('/api/recorded-macros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return recordedMacro
}

export async function replayRecordedMacro(
  recordedMacroId: string,
  body: {
    softwareCommandId?: string | null
    agentProfileId?: string | null
    input?: JsonObject
    mode?: 'dry_run' | 'execute'
  } = {},
): Promise<MacroReplayRunRow> {
  const { macroReplayRun } = await json<{ macroReplayRun: MacroReplayRunRow }>(
    fetch(`/api/recorded-macros/${recordedMacroId}/replay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return macroReplayRun
}

export async function fetchMacroReplayRuns(params: {
  recordedMacroId?: string
  agentProfileId?: string
} = {}): Promise<MacroReplayRunRow[]> {
  const qs = new URLSearchParams()
  if (params.recordedMacroId) qs.set('recordedMacroId', params.recordedMacroId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { macroReplayRuns } = await json<{ macroReplayRuns: MacroReplayRunRow[] }>(
    fetch(`/api/macro-replay-runs${suffix}`),
  )
  return macroReplayRuns
}

export interface CreateAgentProfileBody {
  name: string
  role: string
  description?: string
  modelProfileId?: string | null
  fallbackModelProfileIds?: string[]
  skillIds?: string[]
  mcpServerIds?: string[]
  cliProfileIds?: string[]
  softwareProfileIds?: string[]
  memoryPolicy?: JsonObject
  autonomyPolicy?: JsonObject
  workstationPolicy?: JsonObject
  permissionPolicy?: JsonObject
  inputContract?: JsonObject
  outputContract?: JsonObject
  persona?: Partial<AgentPersona>
  systemPrompt?: string
  behaviorRules?: string[]
  successCriteria?: string[]
  status?: 'draft' | 'active' | 'archived'
}

export async function fetchAgentProfiles(): Promise<AgentProfileRow[]> {
  const { agentProfiles } = await json<{ agentProfiles: AgentProfileRow[] }>(
    fetch('/api/agent-profiles'),
  )
  return agentProfiles
}

export async function createAgentProfile(
  body: CreateAgentProfileBody,
): Promise<AgentProfileRow> {
  const { agentProfile } = await json<{ agentProfile: AgentProfileRow }>(
    fetch('/api/agent-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return agentProfile
}

export type UpdateAgentProfileBody = Partial<CreateAgentProfileBody>

export async function updateAgentProfile(
  agentProfileId: string,
  body: UpdateAgentProfileBody,
): Promise<AgentProfileRow> {
  const { agentProfile } = await json<{ agentProfile: AgentProfileRow }>(
    fetch(`/api/agent-profiles/${agentProfileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return agentProfile
}

export type { AgentIsolationReport, AgentMemoryLearningReport, AgentProfileCapabilityReport }

export async function fetchAgentProfileCapabilityReport(
  agentProfileId: string,
): Promise<AgentProfileCapabilityReport> {
  const { report } = await json<{ report: AgentProfileCapabilityReport }>(
    fetch(`/api/agent-profiles/${agentProfileId}/capability-report`),
  )
  return report
}

export async function fetchAgentIsolationReport(
  agentProfileId: string,
): Promise<AgentIsolationReport> {
  const { report } = await json<{ report: AgentIsolationReport }>(
    fetch(`/api/agent-profiles/${agentProfileId}/isolation-report`),
  )
  return report
}

export async function fetchAgentMemoryLearningReport(
  agentProfileId: string,
  goal?: string,
): Promise<AgentMemoryLearningReport> {
  const query = goal?.trim() ? `?q=${encodeURIComponent(goal.trim())}` : ''
  const { report } = await json<{ report: AgentMemoryLearningReport }>(
    fetch(`/api/agent-profiles/${agentProfileId}/memory-learning-report${query}`),
  )
  return report
}

export async function fetchAgentMemoryLearningReportForAgent(
  agentId: string,
  goal?: string,
): Promise<AgentMemoryLearningReport> {
  const query = goal?.trim() ? `?q=${encodeURIComponent(goal.trim())}` : ''
  const { report } = await json<{ report: AgentMemoryLearningReport }>(
    fetch(`/api/agents/${agentId}/memory-learning-report${query}`),
  )
  return report
}

export interface CloneAgentProfileBody {
  name?: string
  nameSuffix?: string
  copyModelConfig?: boolean
  modelProfileId?: string | null
  fallbackModelProfileIds?: string[]
  skillMode?: AgentCloneSkillMode
  memoryMode?: AgentCloneMemoryMode
  copyPermissionConfig?: boolean
  modifications?: JsonObject
  experimentNote?: string
  status?: 'draft' | 'active'
}

export interface AgentCloneResult {
  sourceAgentProfile: AgentProfileRow
  clonedAgentProfile: AgentProfileRow
  cloneRecord: AgentCloneRecordRow
  copiedMemories: MemoryItemRow[]
}

export async function cloneAgentProfile(
  agentProfileId: string,
  body: CloneAgentProfileBody = {},
): Promise<AgentCloneResult> {
  const { result } = await json<{ result: AgentCloneResult }>(
    fetch(`/api/agent-profiles/${agentProfileId}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchAgentCloneRecords(
  sourceAgentProfileId: string,
): Promise<AgentCloneRecordRow[]> {
  const { cloneRecords } = await json<{ cloneRecords: AgentCloneRecordRow[] }>(
    fetch(`/api/agent-profiles/${sourceAgentProfileId}/clone`),
  )
  return cloneRecords
}

export interface AgentComparisonTaskBody {
  id?: string
  title: string
  input?: JsonObject
}

export async function createAgentComparisonReport(body: {
  leftAgentProfileId: string
  rightAgentProfileId: string
  tasks: AgentComparisonTaskBody[]
  repetitions?: number
}): Promise<AgentComparisonReportRow> {
  const { comparisonReport } = await json<{ comparisonReport: AgentComparisonReportRow }>(
    fetch('/api/agent-comparisons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return comparisonReport
}

export async function fetchAgentComparisonReports(
  agentProfileId?: string,
): Promise<AgentComparisonReportRow[]> {
  const qs = agentProfileId ? `?agentProfileId=${encodeURIComponent(agentProfileId)}` : ''
  const { comparisonReports } = await json<{ comparisonReports: AgentComparisonReportRow[] }>(
    fetch(`/api/agent-comparisons${qs}`),
  )
  return comparisonReports
}

export async function analyzeAgentWhatIf(body: {
  agentProfileId: string
  proposedChanges?: JsonObject
}): Promise<AgentWhatIfAnalysisRow> {
  const { whatIfAnalysis } = await json<{ whatIfAnalysis: AgentWhatIfAnalysisRow }>(
    fetch('/api/agent-what-if', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return whatIfAnalysis
}

export async function fetchAgentWhatIfAnalyses(
  agentProfileId?: string,
): Promise<AgentWhatIfAnalysisRow[]> {
  const qs = agentProfileId ? `?agentProfileId=${encodeURIComponent(agentProfileId)}` : ''
  const { whatIfAnalyses } = await json<{ whatIfAnalyses: AgentWhatIfAnalysisRow[] }>(
    fetch(`/api/agent-what-if${qs}`),
  )
  return whatIfAnalyses
}

export interface CreateAgentScheduleBody {
  agentProfileId: string
  timezone?: string
  weeklySchedule: AgentWeeklySchedule
  maintenanceWindows?: AgentMaintenanceWindow[]
  overtimePolicy?: AgentOvertimePolicy
  vacationMode?: AgentVacationMode
  status?: AgentScheduleStatus
}

export async function createAgentSchedule(body: CreateAgentScheduleBody): Promise<AgentScheduleRow> {
  const { agentSchedule } = await json<{ agentSchedule: AgentScheduleRow }>(
    fetch('/api/agent-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return agentSchedule
}

export async function fetchAgentSchedules(params: {
  agentProfileId?: string
  status?: AgentScheduleStatus
  limit?: number
} = {}): Promise<AgentScheduleRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { agentSchedules } = await json<{ agentSchedules: AgentScheduleRow[] }>(
    fetch(`/api/agent-schedules${suffix}`),
  )
  return agentSchedules
}

export async function evaluateAgentSchedule(
  scheduleId: string,
  body: { at?: number; urgent?: boolean; estimatedDurationMinutes?: number } = {},
): Promise<{ schedule: AgentScheduleRow; decision: AgentAvailabilityDecision }> {
  return json<{ schedule: AgentScheduleRow; decision: AgentAvailabilityDecision }>(
    fetch(`/api/agent-schedules/${scheduleId}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export interface CreateAgentCertificationExamBody {
  name: string
  description?: string
  tasks: AgentCertificationTask[]
  passingScore?: number
  validityPeriod?: AgentCertificationValidityPeriod
  level?: AgentCertificationLevel
  status?: AgentCertificationExamStatus
}

export async function createAgentCertificationExam(
  body: CreateAgentCertificationExamBody,
): Promise<AgentCertificationExamRow> {
  const { exam } = await json<{ exam: AgentCertificationExamRow }>(
    fetch('/api/agent-certification-exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return exam
}

export async function fetchAgentCertificationExams(params: {
  status?: AgentCertificationExamStatus
  level?: AgentCertificationLevel
} = {}): Promise<AgentCertificationExamRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.level) qs.set('level', params.level)
  const query = qs.toString()
  const { exams } = await json<{ exams: AgentCertificationExamRow[] }>(
    fetch(`/api/agent-certification-exams${query ? `?${query}` : ''}`),
  )
  return exams
}

export async function runAgentCertificationExam(
  examId: string,
  body: { agentProfileId: string; submissions?: AgentCertificationSubmission[] },
): Promise<AgentCertificationRunRow> {
  const { certificationRun } = await json<{ certificationRun: AgentCertificationRunRow }>(
    fetch(`/api/agent-certification-exams/${examId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return certificationRun
}

export async function fetchAgentCertificationRuns(params: {
  agentProfileId?: string
  examId?: string
  passed?: boolean
} = {}): Promise<AgentCertificationRunRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.examId) qs.set('examId', params.examId)
  if (params.passed !== undefined) qs.set('passed', String(params.passed))
  const query = qs.toString()
  const { certificationRuns } = await json<{ certificationRuns: AgentCertificationRunRow[] }>(
    fetch(`/api/agent-certification-runs${query ? `?${query}` : ''}`),
  )
  return certificationRuns
}

export async function fetchOnboardingSessions(): Promise<OnboardingSessionRow[]> {
  const { onboardingSessions } = await json<{ onboardingSessions: OnboardingSessionRow[] }>(
    fetch('/api/onboarding/sessions'),
  )
  return onboardingSessions
}

export async function startOnboardingSession(): Promise<OnboardingSessionRow> {
  const { onboardingSession } = await json<{ onboardingSession: OnboardingSessionRow }>(
    fetch('/api/onboarding/sessions', { method: 'POST' }),
  )
  return onboardingSession
}

export async function configureOnboardingAgent(
  sessionId: string,
  workType: OnboardingWorkType,
): Promise<OnboardingSessionRow> {
  const { onboardingSession } = await json<{ onboardingSession: OnboardingSessionRow }>(
    fetch(`/api/onboarding/sessions/${sessionId}/configure-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workType }),
    }),
  )
  return onboardingSession
}

export async function runOnboardingDemo(sessionId: string): Promise<OnboardingSessionRow> {
  const { onboardingSession } = await json<{ onboardingSession: OnboardingSessionRow }>(
    fetch(`/api/onboarding/sessions/${sessionId}/demo`, { method: 'POST' }),
  )
  return onboardingSession
}

export async function completeOnboardingSession(sessionId: string): Promise<OnboardingSessionRow> {
  const { onboardingSession } = await json<{ onboardingSession: OnboardingSessionRow }>(
    fetch(`/api/onboarding/sessions/${sessionId}/complete`, { method: 'POST' }),
  )
  return onboardingSession
}

export async function fetchAgentEnvironmentPreview(
  agentProfileId: string,
  employeeRunId?: string,
): Promise<AgentEnvironment> {
  const qs = employeeRunId ? `?employeeRunId=${encodeURIComponent(employeeRunId)}` : ''
  const { environment } = await json<{ environment: AgentEnvironment }>(
    fetch(`/api/agent-profiles/${agentProfileId}/environment-preview${qs}`),
  )
  return environment
}

export interface CreateStyleGuideBody {
  name: string
  language?: JsonObject
  code?: JsonObject
  visual?: JsonObject
  outputRules?: JsonObject
  status?: StyleGuideRow['status']
}

export interface StyleGuideEvaluationDto {
  styleGuideId: string | null
  styleGuideName: string | null
  passed: boolean
  checks: Array<{
    key: string
    label: string
    status: 'passed' | 'failed' | 'skipped'
    details: string
  }>
  violations: string[]
  suggestions: string[]
}

export async function fetchStyleGuides(): Promise<StyleGuideRow[]> {
  const { styleGuides } = await json<{ styleGuides: StyleGuideRow[] }>(
    fetch('/api/style-guides'),
  )
  return styleGuides
}

export async function createStyleGuide(body: CreateStyleGuideBody): Promise<StyleGuideRow> {
  const { styleGuide } = await json<{ styleGuide: StyleGuideRow }>(
    fetch('/api/style-guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return styleGuide
}

export async function fetchAgentStyleGuideBindings(params: {
  agentProfileId?: string
  styleGuideId?: string
} = {}): Promise<AgentStyleGuideBindingRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.styleGuideId) qs.set('styleGuideId', params.styleGuideId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { bindings } = await json<{ bindings: AgentStyleGuideBindingRow[] }>(
    fetch(`/api/style-guide-bindings${suffix}`),
  )
  return bindings
}

export async function bindStyleGuideToAgent(
  styleGuideId: string,
  body: { agentProfileId: string; status?: AgentStyleGuideBindingRow['status'] },
): Promise<AgentStyleGuideBindingRow> {
  const { binding } = await json<{ binding: AgentStyleGuideBindingRow }>(
    fetch(`/api/style-guides/${styleGuideId}/bind-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return binding
}

export async function evaluateStyleGuide(body: {
  agentProfileId?: string | null
  styleGuideId?: string | null
  sample: string | JsonObject
}): Promise<StyleGuideEvaluationDto> {
  const { result } = await json<{ result: StyleGuideEvaluationDto }>(
    fetch('/api/style-guides/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export interface UpsertAgentDiversityProfileBody {
  agentProfileId: string
  personality?: AgentPersonality
  perspective?: string
  temperature?: number
  riskPosture?: AgentRiskPosture
  collaborationRole?: string
  status?: AgentDiversityProfileRow['status']
}

export async function fetchAgentDiversityProfiles(
  agentProfileId?: string,
): Promise<AgentDiversityProfileRow[]> {
  const qs = agentProfileId ? `?agentProfileId=${encodeURIComponent(agentProfileId)}` : ''
  const { agentDiversityProfiles } = await json<{
    agentDiversityProfiles: AgentDiversityProfileRow[]
  }>(fetch(`/api/agent-diversity-profiles${qs}`))
  return agentDiversityProfiles
}

export async function upsertAgentDiversityProfile(
  body: UpsertAgentDiversityProfileBody,
): Promise<AgentDiversityProfileRow> {
  const { agentDiversityProfile } = await json<{
    agentDiversityProfile: AgentDiversityProfileRow
  }>(
    fetch('/api/agent-diversity-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return agentDiversityProfile
}

export async function fetchDiversityAnalyses(params: {
  scopeType?: DiversityScopeType
  scopeId?: string
} = {}): Promise<DiversityAnalysisRow[]> {
  const qs = new URLSearchParams()
  if (params.scopeType) qs.set('scopeType', params.scopeType)
  if (params.scopeId) qs.set('scopeId', params.scopeId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { diversityAnalyses } = await json<{ diversityAnalyses: DiversityAnalysisRow[] }>(
    fetch(`/api/agent-diversity-analyses${suffix}`),
  )
  return diversityAnalyses
}

export async function analyzeAgentDiversity(body: {
  scopeType?: DiversityScopeType
  scopeId?: string | null
  agentProfileIds?: string[]
} = {}): Promise<DiversityAnalysisRow> {
  const { diversityAnalysis } = await json<{ diversityAnalysis: DiversityAnalysisRow }>(
    fetch('/api/agent-diversity-analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return diversityAnalysis
}

export interface CreateAgentInterviewBody {
  agentProfileId: string
  scenarioTitle?: string
  scenarioTask?: string
  planResponse?: string | null
  feedbackPrompt?: string | null
  feedbackResponse?: string | null
  rubric?: JsonObject
}

export async function fetchAgentInterviews(
  agentProfileId?: string,
): Promise<AgentInterviewRow[]> {
  const qs = agentProfileId ? `?agentProfileId=${encodeURIComponent(agentProfileId)}` : ''
  const { agentInterviews } = await json<{ agentInterviews: AgentInterviewRow[] }>(
    fetch(`/api/agent-interviews${qs}`),
  )
  return agentInterviews
}

export async function createAgentInterview(
  body: CreateAgentInterviewBody,
): Promise<AgentInterviewRow> {
  const { agentInterview } = await json<{ agentInterview: AgentInterviewRow }>(
    fetch('/api/agent-interviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return agentInterview
}

export interface CreatePerformanceReviewBody {
  agentProfileId: string
  reviewerAgentProfileId?: string | null
  sampledRunIds?: string[]
  sampleSize?: number
  periodStartAt?: number | null
  periodEndAt?: number | null
  autoApplyRecommendations?: boolean
}

export async function fetchPerformanceReviews(
  agentProfileId?: string,
): Promise<PerformanceReviewRow[]> {
  const qs = agentProfileId ? `?agentProfileId=${encodeURIComponent(agentProfileId)}` : ''
  const { performanceReviews } = await json<{ performanceReviews: PerformanceReviewRow[] }>(
    fetch(`/api/performance-reviews${qs}`),
  )
  return performanceReviews
}

export async function createPerformanceReview(
  body: CreatePerformanceReviewBody,
): Promise<PerformanceReviewRow> {
  const { performanceReview } = await json<{ performanceReview: PerformanceReviewRow }>(
    fetch('/api/performance-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return performanceReview
}

export interface CreateAgentMentorshipBody {
  mentorAgentProfileId: string
  menteeAgentProfileId: string
  scope?: AgentMentorshipScope
  scopeTaskTypes?: string[]
  style?: AgentMentorshipStyle
  mentoringActions?: {
    reviewOutputs?: boolean
    interveneWhenStuck?: boolean
    shareRelevantMemories?: boolean
    generatePracticeTasks?: boolean
  }
  progress?: {
    initialProficiency?: number
    currentProficiency?: number
    targetProficiency?: number
    tasksUntilGraduation?: number
    fastestImprovingAreas?: string[]
    needsImprovement?: string[]
  }
}

export interface AgentMentoringActionBody {
  eventType: AgentMentoringEventType
  employeeRunId?: string | null
  artifactId?: string | null
  summary?: string
  feedback?: string
  sharedMemoryIds?: string[]
  practiceTask?: JsonObject
  proficiencyDelta?: number
  successfulTask?: boolean
  areasImproved?: string[]
  needsImprovement?: string[]
}

export async function createAgentMentorship(
  body: CreateAgentMentorshipBody,
): Promise<AgentMentorshipRow> {
  const { mentorship } = await json<{ mentorship: AgentMentorshipRow }>(
    fetch('/api/agent-mentorships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return mentorship
}

export async function fetchAgentMentorships(params: {
  mentorAgentProfileId?: string
  menteeAgentProfileId?: string
  status?: AgentMentorshipStatus
  limit?: number
} = {}): Promise<AgentMentorshipRow[]> {
  const qs = new URLSearchParams()
  if (params.mentorAgentProfileId) qs.set('mentorAgentProfileId', params.mentorAgentProfileId)
  if (params.menteeAgentProfileId) qs.set('menteeAgentProfileId', params.menteeAgentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { mentorships } = await json<{ mentorships: AgentMentorshipRow[] }>(
    fetch(`/api/agent-mentorships${suffix}`),
  )
  return mentorships
}

export async function recordAgentMentoringAction(
  mentorshipId: string,
  body: AgentMentoringActionBody,
): Promise<{ event: AgentMentoringEventRow; mentorship: AgentMentorshipRow }> {
  const { result } = await json<{ result: { event: AgentMentoringEventRow; mentorship: AgentMentorshipRow } }>(
    fetch(`/api/agent-mentorships/${mentorshipId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchAgentMentoringEvents(params: {
  mentorshipId?: string
  eventType?: AgentMentoringEventType
  limit?: number
} = {}): Promise<AgentMentoringEventRow[]> {
  const qs = new URLSearchParams()
  if (params.mentorshipId) qs.set('mentorshipId', params.mentorshipId)
  if (params.eventType) qs.set('eventType', params.eventType)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { events } = await json<{ events: AgentMentoringEventRow[] }>(
    fetch(`/api/agent-mentoring-events${suffix}`),
  )
  return events
}

export interface ApplyUserOverrideBody {
  command: UserOverrideCommand
  targetType?: UserOverrideTargetType
  targetId?: string | null
  reason?: string
  trigger?: UserOverrideTrigger
  payload?: JsonObject
}

export async function fetchUserOverrides(params: {
  command?: UserOverrideCommand
  targetType?: UserOverrideTargetType
  targetId?: string
} = {}): Promise<UserOverrideRow[]> {
  const qs = new URLSearchParams()
  if (params.command) qs.set('command', params.command)
  if (params.targetType) qs.set('targetType', params.targetType)
  if (params.targetId) qs.set('targetId', params.targetId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { userOverrides } = await json<{ userOverrides: UserOverrideRow[] }>(
    fetch(`/api/user-overrides${suffix}`),
  )
  return userOverrides
}

export async function applyUserOverride(body: ApplyUserOverrideBody): Promise<UserOverrideRow> {
  const { userOverride } = await json<{ userOverride: UserOverrideRow }>(
    fetch('/api/user-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return userOverride
}

export type ProgrammaticApiKeyPublic = Omit<ProgrammaticApiKeyRow, 'keyHash'>

export interface CreateProgrammaticApiKeyBody {
  name: string
  scopes?: string[]
}

export async function fetchProgrammaticApiKeys(): Promise<ProgrammaticApiKeyPublic[]> {
  const { programmaticApiKeys } = await json<{
    programmaticApiKeys: ProgrammaticApiKeyPublic[]
  }>(fetch('/api/sdk/api-keys'))
  return programmaticApiKeys
}

export async function createProgrammaticApiKey(
  body: CreateProgrammaticApiKeyBody,
): Promise<{ apiKey: ProgrammaticApiKeyPublic; rawKey: string }> {
  return json<{ apiKey: ProgrammaticApiKeyPublic; rawKey: string }>(
    fetch('/api/sdk/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function revokeProgrammaticApiKey(id: string): Promise<ProgrammaticApiKeyPublic> {
  const { programmaticApiKey } = await json<{
    programmaticApiKey: ProgrammaticApiKeyPublic
  }>(fetch(`/api/sdk/api-keys/${id}/revoke`, { method: 'POST' }))
  return programmaticApiKey
}

export interface CreateSdkTaskBody {
  agentProfileId?: string | null
  agentName?: string | null
  description: string
  input?: JsonObject
  priority?: number
  maxBudget?: number | null
  maxBudgetCents?: number | null
  webhookUrl?: string | null
}

export interface SdkTaskResultDto {
  sdkTask: SdkTaskRow
  employeeRun: EmployeeRunRow
  webhookDeliveries: WebhookDeliveryRow[]
}

export async function fetchSdkAgents(name?: string): Promise<AgentProfileRow[] | AgentProfileRow> {
  const suffix = name ? `?name=${encodeURIComponent(name)}` : ''
  const data = await json<{ agentProfiles?: AgentProfileRow[]; agentProfile?: AgentProfileRow }>(
    fetch(`/api/sdk/agents${suffix}`),
  )
  return data.agentProfile ?? data.agentProfiles ?? []
}

export async function fetchSdkTasks(): Promise<SdkTaskRow[]> {
  const { sdkTasks } = await json<{ sdkTasks: SdkTaskRow[] }>(fetch('/api/sdk/tasks'))
  return sdkTasks
}

export async function createSdkTask(
  body: CreateSdkTaskBody,
  apiKey?: string,
): Promise<SdkTaskResultDto> {
  return json<SdkTaskResultDto>(
    fetch('/api/sdk/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-reasonix-api-key': apiKey } : {}),
      },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchSdkTask(id: string): Promise<{
  sdkTask: SdkTaskRow
  employeeRun: EmployeeRunRow | null
}> {
  return json<{ sdkTask: SdkTaskRow; employeeRun: EmployeeRunRow | null }>(
    fetch(`/api/sdk/tasks/${id}`),
  )
}

export async function fetchSdkTaskEvents(id: string): Promise<{
  events: EmployeeRunEventRow[]
  feed: unknown[]
}> {
  return json<{ events: EmployeeRunEventRow[]; feed: unknown[] }>(
    fetch(`/api/sdk/tasks/${id}/events`),
  )
}

export async function createSdkMemory(
  body: {
    agentProfileId?: string | null
    agentName?: string | null
    type: MemoryType
    title: string
    content: string
    scope?: MemoryScope
    confidence?: number
    importance?: number
  },
  apiKey?: string,
): Promise<MemoryItemRow> {
  const { memoryItem } = await json<{ memoryItem: MemoryItemRow }>(
    fetch('/api/sdk/memories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-reasonix-api-key': apiKey } : {}),
      },
      body: JSON.stringify(body),
    }),
  )
  return memoryItem
}

export interface CreateWebhookSubscriptionBody {
  name: string
  url: string
  events?: WebhookEventType[]
  secret: string
  filter?: JsonObject
  retry?: {
    maxRetries?: number
    backoffMs?: number
  }
  deliveryMode?: WebhookSubscriptionRow['deliveryMode']
  status?: WebhookSubscriptionRow['status']
}

export async function fetchWebhookSubscriptions(): Promise<WebhookSubscriptionRow[]> {
  const { webhookSubscriptions } = await json<{
    webhookSubscriptions: WebhookSubscriptionRow[]
  }>(fetch('/api/webhooks/subscriptions'))
  return webhookSubscriptions
}

export async function createWebhookSubscription(
  body: CreateWebhookSubscriptionBody,
): Promise<WebhookSubscriptionRow> {
  const { webhookSubscription } = await json<{ webhookSubscription: WebhookSubscriptionRow }>(
    fetch('/api/webhooks/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return webhookSubscription
}

export async function testWebhookSubscription(id: string): Promise<WebhookDeliveryRow> {
  const { webhookDelivery } = await json<{ webhookDelivery: WebhookDeliveryRow }>(
    fetch(`/api/webhooks/subscriptions/${id}/test`, { method: 'POST' }),
  )
  return webhookDelivery
}

export async function fetchWebhookDeliveries(args: {
  subscriptionId?: string
  sdkTaskId?: string
} = {}): Promise<WebhookDeliveryRow[]> {
  const qs = new URLSearchParams()
  if (args.subscriptionId) qs.set('subscriptionId', args.subscriptionId)
  if (args.sdkTaskId) qs.set('sdkTaskId', args.sdkTaskId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { webhookDeliveries } = await json<{ webhookDeliveries: WebhookDeliveryRow[] }>(
    fetch(`/api/webhooks/deliveries${suffix}`),
  )
  return webhookDeliveries
}

export interface StartEmployeeRunBody {
  goal: string
  input?: JsonObject
  workflowRunId?: string | null
  budgetLimitCents?: number | null
  autoComplete?: boolean
}

export interface EmployeeRunSnapshot {
  run: EmployeeRunRow
  events: EmployeeRunEventRow[]
  cliRuns: CliRunRow[]
  computerSessions: ComputerSessionRow[]
  computerActionEvents: ComputerActionEventRow[]
  contextSnapshots: RuntimeContextSnapshotRow[]
  budgetEvents: BudgetEventRow[]
  decisionAuditTrails: DecisionAuditTrailRow[]
  securityAuditLogs: AuditLogRow[]
  recoveryEvents: RecoveryEventRow[]
  artifactValidations: ArtifactValidationRow[]
  multimodalInputs: MultimodalInputRow[]
  multimodalOutputs: MultimodalOutputRow[]
  learningEvents: LearningEventRow[]
  memoryItems: MemoryItemRow[]
  reflection: RunReflectionRow | null
}

export async function startEmployeeRun(
  agentProfileId: string,
  body: StartEmployeeRunBody,
): Promise<EmployeeRunRow> {
  const { employeeRun } = await json<{ employeeRun: EmployeeRunRow }>(
    fetch(`/api/agent-profiles/${agentProfileId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return employeeRun
}

export async function fetchEmployeeRuns(agentProfileId?: string): Promise<EmployeeRunRow[]> {
  const qs = agentProfileId ? `?agentProfileId=${encodeURIComponent(agentProfileId)}` : ''
  const { employeeRuns } = await json<{ employeeRuns: EmployeeRunRow[] }>(
    fetch(`/api/employee-runs${qs}`),
  )
  return employeeRuns
}

export async function fetchEmployeeRunSnapshot(runId: string): Promise<EmployeeRunSnapshot> {
  return json<EmployeeRunSnapshot>(fetch(`/api/employee-runs/${runId}`))
}

export interface RegisterMultimodalInputBody {
  employeeRunId?: string | null
  agentProfileId?: string | null
  kind: MultimodalInputKind
  mimeType?: string | null
  source?: string
  dataRef?: string | null
  description?: string | null
  metadata?: JsonObject
}

export interface RegisterMultimodalOutputBody {
  employeeRunId?: string | null
  agentProfileId?: string | null
  kind: MultimodalOutputKind
  artifactId?: string | null
  path?: string | null
  caption?: string | null
  format?: string | null
  data?: JsonObject
  metadata?: JsonObject
}

export async function fetchMultimodalInputs(params: {
  employeeRunId?: string
  agentProfileId?: string
} = {}): Promise<MultimodalInputRow[]> {
  const qs = new URLSearchParams()
  if (params.employeeRunId) qs.set('employeeRunId', params.employeeRunId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { multimodalInputs } = await json<{ multimodalInputs: MultimodalInputRow[] }>(
    fetch(`/api/multimodal-inputs${suffix}`),
  )
  return multimodalInputs
}

export async function registerMultimodalInput(
  body: RegisterMultimodalInputBody,
): Promise<MultimodalInputRow> {
  const { multimodalInput } = await json<{ multimodalInput: MultimodalInputRow }>(
    fetch('/api/multimodal-inputs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return multimodalInput
}

export async function fetchMultimodalOutputs(params: {
  employeeRunId?: string
  agentProfileId?: string
} = {}): Promise<MultimodalOutputRow[]> {
  const qs = new URLSearchParams()
  if (params.employeeRunId) qs.set('employeeRunId', params.employeeRunId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { multimodalOutputs } = await json<{ multimodalOutputs: MultimodalOutputRow[] }>(
    fetch(`/api/multimodal-outputs${suffix}`),
  )
  return multimodalOutputs
}

export async function registerMultimodalOutput(
  body: RegisterMultimodalOutputBody,
): Promise<MultimodalOutputRow> {
  const { multimodalOutput } = await json<{ multimodalOutput: MultimodalOutputRow }>(
    fetch('/api/multimodal-outputs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return multimodalOutput
}

export interface ComputerSessionTimeline {
  session: ComputerSessionRow
  actions: ComputerActionEventRow[]
}

export interface RecordComputerActionBody {
  actionType: string
  target?: string | null
  input?: JsonObject
  output?: JsonObject
  status?: ComputerActionStatus
}

export interface RecordComputerObservationBody {
  summary: string
  viewport?: JsonObject
  screenshotPath?: string | null
  pageUrl?: string | null
}

export type RuntimeControlScope = 'desktop' | 'mobile' | 'workstation'

export type RuntimeControlActionType =
  | 'observe_windows'
  | 'capture_screenshot'
  | 'focus_window'
  | 'click'
  | 'scroll'
  | 'type_text'
  | 'key_press'
  | 'list_devices'
  | 'mobile_tap'
  | 'mobile_swipe'
  | 'mobile_text'
  | 'mobile_keyevent'
  | 'mobile_screenshot'
  | 'validate_workstation'
  | 'launch_remote_session'
  | 'release_workstation'

export interface ExecuteRuntimeControlBody {
  scope: RuntimeControlScope
  actionType: RuntimeControlActionType
  target?: string | null
  input?: JsonObject
  live?: boolean
  confirmRisk?: boolean
  approvalRequestId?: string | null
}

export interface RuntimeControlResultDto {
  action: ComputerActionEventRow
  resourceLock: ResourceLockRow | null
  releasedResourceLock: ResourceLockRow | null
  status: ComputerActionStatus
  liveExecuted: boolean
  gate: {
    requiredEnvVar: string | null
    envEnabled: boolean
    confirmRisk: boolean
    liveRequested: boolean
    readOnly: boolean
    approvalRequired: boolean
  approvalRequestId: string | null
  approvalSatisfied: boolean
  goLiveRequired?: boolean
  goLiveDecisionHash?: string | null
  goLiveLatestDecisionHash?: string | null
  goLiveDecisionSatisfied?: boolean
  goLiveLatestDecisionCustomerAuthorizationEvidenceHash?: string | null
  goLiveLatestDecisionCustomerAuthorizationEvidenceMatched?: boolean
  goLiveLatestDecisionEnvironmentFingerprintPresent?: boolean
  goLiveLatestDecisionEnvironmentFingerprintMatched?: boolean
  goLiveLatestDecisionEnvironmentFingerprintMismatches?: string[]
  goLiveCustomerAuthorizationRequired?: boolean
  goLiveCustomerAuthorized?: boolean
  goLiveCustomerAuthorizationSwitchEnabled?: boolean
  goLiveCustomerAuthorizationEvidenceHashRequired?: boolean
  goLiveCustomerAuthorizationEvidenceHash?: string | null
  goLiveCustomerAuthorizationEvidenceMatched?: boolean
  goLiveCustomerAuthorizationEvidenceBoundToDecision?: boolean
  goLiveLivePilotLeaseRequired?: boolean
  goLiveLivePilotLeaseHash?: string | null
  goLiveLatestLivePilotLeaseHash?: string | null
  goLiveLatestLivePilotLeaseActive?: boolean
  goLiveLatestLivePilotLeaseExpiresAt?: number | null
  goLiveLivePilotLeaseMatched?: boolean
  goLiveLivePilotLeaseExpired?: boolean
  goLiveLivePilotLeaseBoundToDecision?: boolean
  goLiveLivePilotLeaseBoundToCustomerAuthorization?: boolean
  goLiveLivePilotLeaseBoundToEnvironmentFingerprint?: boolean
  goLiveLivePilotSessionRequired?: boolean
  goLiveLatestLivePilotSessionId?: string | null
  goLiveLatestLivePilotSessionHash?: string | null
  goLiveLatestLivePilotSessionStatus?: ProductionLivePilotSessionStatusDto | null
  goLiveLatestLivePilotSessionActive?: boolean
  goLiveLatestLivePilotSessionExpiresAt?: number | null
  goLiveLivePilotSessionBoundToLease?: boolean
  goLiveLivePilotSessionBoundToDecision?: boolean
  goLiveLivePilotSessionBoundToCustomerAuthorization?: boolean
  goLiveLivePilotSessionBoundToEnvironmentFingerprint?: boolean
  allowed: boolean
  reason: string
}
  output: JsonObject
}

export type ImplementationAuditStatus =
  | 'implemented_baseline'
  | 'baseline_plus'
  | 'partial'
  | 'pending'
  | 'source_missing'

export interface ImplementationAuditSection {
  sectionNumber: number
  title: string
  line: number | null
  sourceStatus: 'found' | 'missing'
  implementationStatus: ImplementationAuditStatus
  evidence: string[]
  gaps: string[]
}

export interface ImplementationAuditReport {
  summary: {
    sourcePath: string
    totalSections: number
    foundSourceSections: number
    missingSourceSections: number
    implementedBaselineSections: number
    partialSections: number
    pendingSections: number
    generatedAt: number
  }
  sections: ImplementationAuditSection[]
}

export async function fetchComputerSessions(params: {
  employeeRunId?: string
  workflowRunId?: string
  agentProfileId?: string
} = {}): Promise<ComputerSessionRow[]> {
  const qs = new URLSearchParams()
  if (params.employeeRunId) qs.set('employeeRunId', params.employeeRunId)
  if (params.workflowRunId) qs.set('workflowRunId', params.workflowRunId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { computerSessions } = await json<{ computerSessions: ComputerSessionRow[] }>(
    fetch(`/api/computer-sessions${suffix}`),
  )
  return computerSessions
}

export async function fetchComputerSessionTimeline(
  sessionId: string,
): Promise<ComputerSessionTimeline> {
  return json<ComputerSessionTimeline>(fetch(`/api/computer-sessions/${sessionId}`))
}

export async function recordComputerAction(
  sessionId: string,
  body: RecordComputerActionBody,
): Promise<ComputerActionEventRow> {
  const { action } = await json<{ action: ComputerActionEventRow }>(
    fetch(`/api/computer-sessions/${sessionId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return action
}

export async function recordComputerObservation(
  sessionId: string,
  body: RecordComputerObservationBody,
): Promise<ComputerActionEventRow> {
  const { action } = await json<{ action: ComputerActionEventRow }>(
    fetch(`/api/computer-sessions/${sessionId}/observations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return action
}

export async function executeRuntimeControlAction(
  sessionId: string,
  body: ExecuteRuntimeControlBody,
): Promise<RuntimeControlResultDto> {
  const { result } = await json<{ result: RuntimeControlResultDto }>(
    fetch(`/api/computer-sessions/${sessionId}/runtime-control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export interface RegisterBrowserSessionBody {
  sessionName: string
  ownerAgentProfileId?: string | null
  sharedWithAgentProfileIds?: string[]
  cookieJarRef: string
  localStorageRef?: string | null
  indexedDbRef?: string | null
  encrypted?: boolean
  persistAfterTask?: boolean
  maxAge?: BrowserSessionMaxAge
  keepAlive?: {
    enabled?: boolean
    interval?: BrowserSessionKeepAliveInterval
    visitUrls?: string[]
  }
  security?: {
    encryptSensitiveCookies?: boolean
    isolateByAgent?: boolean
    exportable?: boolean
    blockedDomains?: string[]
  }
}

export interface BrowserSessionAccessEvaluation {
  allowed: boolean
  reasons: string[]
  cookieAccess: 'owner' | 'shared' | 'unisolated' | 'blocked'
  session: BrowserSessionRow
  event: BrowserSessionEventRow
}

export interface BrowserSessionKeepAlivePlan {
  shouldRun: boolean
  interval: BrowserSessionKeepAliveInterval | null
  visitUrls: string[]
  nextRunAt: number | null
  session: BrowserSessionRow
  event: BrowserSessionEventRow
}

export interface BrowserSessionExportPlan {
  status: 'planned' | 'blocked'
  reasons: string[]
  manifest: Record<string, unknown>
  event: BrowserSessionEventRow
}

export async function registerBrowserSession(
  body: RegisterBrowserSessionBody,
): Promise<BrowserSessionRow> {
  const { browserSession } = await json<{ browserSession: BrowserSessionRow }>(
    fetch('/api/browser-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return browserSession
}

export async function fetchBrowserSessions(params: {
  ownerAgentProfileId?: string
  status?: BrowserSessionStatus
  limit?: number
} = {}): Promise<BrowserSessionRow[]> {
  const qs = new URLSearchParams()
  if (params.ownerAgentProfileId) qs.set('ownerAgentProfileId', params.ownerAgentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { browserSessions } = await json<{ browserSessions: BrowserSessionRow[] }>(
    fetch(`/api/browser-sessions${suffix}`),
  )
  return browserSessions
}

export async function evaluateBrowserSessionAccess(
  browserSessionId: string,
  body: {
    agentProfileId?: string | null
    domain?: string | null
  } = {},
): Promise<BrowserSessionAccessEvaluation> {
  const { evaluation } = await json<{ evaluation: BrowserSessionAccessEvaluation }>(
    fetch(`/api/browser-sessions/${browserSessionId}/evaluate-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evaluation
}

export async function planBrowserSessionKeepAlive(
  browserSessionId: string,
): Promise<BrowserSessionKeepAlivePlan> {
  const { plan } = await json<{ plan: BrowserSessionKeepAlivePlan }>(
    fetch(`/api/browser-sessions/${browserSessionId}/keep-alive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
  )
  return plan
}

export async function planBrowserSessionExport(
  browserSessionId: string,
  body: {
    format?: 'encrypted_bundle_manifest'
    requestedByAgentProfileId?: string | null
  } = {},
): Promise<BrowserSessionExportPlan> {
  const { exportPlan } = await json<{ exportPlan: BrowserSessionExportPlan }>(
    fetch(`/api/browser-sessions/${browserSessionId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return exportPlan
}

export async function fetchBrowserSessionEvents(params: {
  browserSessionId?: string
  limit?: number
} = {}): Promise<BrowserSessionEventRow[]> {
  const qs = new URLSearchParams()
  if (params.browserSessionId) qs.set('browserSessionId', params.browserSessionId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { events } = await json<{ events: BrowserSessionEventRow[] }>(
    fetch(`/api/browser-session-events${suffix}`),
  )
  return events
}

export async function fetchImplementationAuditReport(): Promise<ImplementationAuditReport> {
  return json<ImplementationAuditReport>(fetch('/api/implementation-audit'))
}

export interface RunCliProfileBody {
  agentProfileId?: string | null
  employeeRunId?: string | null
  variables?: Record<string, string | number | boolean | null>
  stdin?: string | null
  mode?: 'dry_run' | 'execute'
}

export async function runCliProfile(
  cliProfileId: string,
  body: RunCliProfileBody = {},
): Promise<CliRunRow> {
  const { cliRun } = await json<{ cliRun: CliRunRow }>(
    fetch(`/api/cli-profiles/${cliProfileId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return cliRun
}

export async function fetchEmployeeRunEvents(runId: string): Promise<EmployeeRunEventRow[]> {
  const { events } = await json<{ events: EmployeeRunEventRow[] }>(
    fetch(`/api/employee-runs/${runId}/events`),
  )
  return events
}

export async function fetchEmployeeRunDecisionAuditTrails(
  runId: string,
): Promise<DecisionAuditTrailRow[]> {
  const { decisionAuditTrails } = await json<{
    decisionAuditTrails: DecisionAuditTrailRow[]
  }>(fetch(`/api/employee-runs/${runId}/decision-audit-trails`))
  return decisionAuditTrails
}

export async function fetchDecisionAuditTrails(params: {
  employeeRunId?: string
  limit?: number
} = {}): Promise<DecisionAuditTrailRow[]> {
  const qs = new URLSearchParams()
  if (params.employeeRunId) qs.set('employeeRunId', params.employeeRunId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { decisionAuditTrails } = await json<{
    decisionAuditTrails: DecisionAuditTrailRow[]
  }>(fetch(`/api/decision-audit-trails${suffix}`))
  return decisionAuditTrails
}

export interface CreateDecisionRollbackBody {
  employeeRunId: string
  targetDecisionId?: string
  granularity?: DecisionRollbackGranularity
  rollback: DecisionRollbackScope
  reason: {
    type: DecisionRollbackReasonType
    description: string
    timestamp?: number
  }
  applyImmediately?: boolean
}

export async function createDecisionRollback(
  body: CreateDecisionRollbackBody,
): Promise<DecisionRollbackRow> {
  const { decisionRollback } = await json<{ decisionRollback: DecisionRollbackRow }>(
    fetch('/api/decision-rollbacks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return decisionRollback
}

export async function fetchDecisionRollbacks(params: {
  employeeRunId?: string
  status?: DecisionRollbackStatus
  limit?: number
} = {}): Promise<DecisionRollbackRow[]> {
  const qs = new URLSearchParams()
  if (params.employeeRunId) qs.set('employeeRunId', params.employeeRunId)
  if (params.status) qs.set('status', params.status)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { decisionRollbacks } = await json<{ decisionRollbacks: DecisionRollbackRow[] }>(
    fetch(`/api/decision-rollbacks${suffix}`),
  )
  return decisionRollbacks
}

export async function applyDecisionRollback(
  rollbackId: string,
  body: { note?: string } = {},
): Promise<DecisionRollbackRow> {
  const { decisionRollback } = await json<{ decisionRollback: DecisionRollbackRow }>(
    fetch(`/api/decision-rollbacks/${rollbackId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return decisionRollback
}

export interface RunEventFeedItem {
  id: string
  source: 'workflow_run' | 'workflow_node_run' | 'employee_run' | 'employee_run_event'
  runId: string
  employeeRunId: string | null
  workflowNodeRunId: string | null
  phase: string
  status: string
  message: string
  payload: JsonObject
  createdAt: number
}

export async function fetchEmployeeRunEventFeed(runId: string): Promise<RunEventFeedItem[]> {
  const { feed } = await json<{ feed: RunEventFeedItem[] }>(
    fetch(`/api/employee-runs/${runId}/events`),
  )
  return feed
}

export async function fetchWorkflowRunEventFeed(runId: string): Promise<RunEventFeedItem[]> {
  const { feed } = await json<{ feed: RunEventFeedItem[] }>(
    fetch(`/api/workflow-runs/${runId}/events`),
  )
  return feed
}

export async function pauseEmployeeRun(runId: string): Promise<EmployeeRunRow> {
  const { employeeRun } = await json<{ employeeRun: EmployeeRunRow }>(
    fetch(`/api/employee-runs/${runId}/pause`, { method: 'POST' }),
  )
  return employeeRun
}

export async function resumeEmployeeRun(runId: string): Promise<EmployeeRunRow> {
  const { employeeRun } = await json<{ employeeRun: EmployeeRunRow }>(
    fetch(`/api/employee-runs/${runId}/resume`, { method: 'POST' }),
  )
  return employeeRun
}

export async function cancelEmployeeRun(runId: string): Promise<EmployeeRunRow> {
  const { employeeRun } = await json<{ employeeRun: EmployeeRunRow }>(
    fetch(`/api/employee-runs/${runId}/cancel`, { method: 'POST' }),
  )
  return employeeRun
}

export interface CreateMemoryItemBody {
  agentProfileId?: string | null
  scope: MemoryScope
  type: MemoryType
  title: string
  content: string
  sourceRunId?: string | null
  embedding?: number[] | null
  confidence?: number
  importance?: number
  expiresAt?: number | null
  readAccess?: MemoryPrivacyReadAccess
  writeAccess?: MemoryPrivacyWriteAccess
  encryption?: MemoryPrivacyEncryption
  containsDataTypes?: MemoryPrivacyDataType[]
}

export async function fetchMemoryItems(params: {
  agentProfileId?: string
  sourceRunId?: string
  scope?: MemoryScope
  type?: MemoryType
  limit?: number
} = {}): Promise<MemoryItemRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.sourceRunId) qs.set('sourceRunId', params.sourceRunId)
  if (params.scope) qs.set('scope', params.scope)
  if (params.type) qs.set('type', params.type)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { memoryItems } = await json<{ memoryItems: MemoryItemRow[] }>(
    fetch(`/api/memory-items${suffix}`),
  )
  return memoryItems
}

export async function createMemoryItem(body: CreateMemoryItemBody): Promise<MemoryItemRow> {
  const { memoryItem } = await json<{ memoryItem: MemoryItemRow }>(
    fetch('/api/memory-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return memoryItem
}

export type UpdateMemoryItemBody = Partial<CreateMemoryItemBody>

export async function updateMemoryItem(
  id: string,
  body: UpdateMemoryItemBody,
): Promise<MemoryItemRow> {
  const { memoryItem } = await json<{ memoryItem: MemoryItemRow }>(
    fetch(`/api/memory-items/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return memoryItem
}

export async function deleteMemoryItem(id: string): Promise<MemoryItemRow> {
  const { memoryItem } = await json<{ memoryItem: MemoryItemRow }>(
    fetch(`/api/memory-items/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  )
  return memoryItem
}

export interface CreateMemoryGraphViewBody {
  name?: string
  agentProfileId?: string | null
  focusAgentProfileId?: string | null
  projectId?: string | null
  layout?: MemoryGraphLayout
  includeExpired?: boolean
  filters?: {
    scope?: MemoryScope
    type?: MemoryType
    query?: string
    limit?: number
  }
}

export async function createMemoryGraphView(
  body: CreateMemoryGraphViewBody,
): Promise<MemoryGraphViewRow> {
  const { view } = await json<{ view: MemoryGraphViewRow }>(
    fetch('/api/memory-graph-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return view
}

export async function fetchMemoryGraphViews(params: {
  agentProfileId?: string
  focusAgentProfileId?: string
  limit?: number
} = {}): Promise<MemoryGraphViewRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.focusAgentProfileId) qs.set('focusAgentProfileId', params.focusAgentProfileId)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { views } = await json<{ views: MemoryGraphViewRow[] }>(fetch(`/api/memory-graph-views${suffix}`))
  return views
}

export async function exportMemoryGraphView(
  id: string,
  format: MemoryGraphExportFormat = 'json',
): Promise<MemoryGraphViewRow> {
  const { view } = await json<{ view: MemoryGraphViewRow }>(
    fetch(`/api/memory-graph-views/${id}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format }),
    }),
  )
  return view
}

export interface CreateMemoryDecaySnapshotBody {
  name?: string
  agentProfileId?: string | null
  includeExpired?: boolean
  horizonDays?: number
  staleAfterDays?: number
  expiringSoonDays?: number
  pinnedImportanceThreshold?: number
  filters?: {
    scope?: MemoryScope
    type?: MemoryType
    query?: string
    limit?: number
  }
}

export async function createMemoryDecaySnapshot(
  body: CreateMemoryDecaySnapshotBody = {},
): Promise<MemoryDecaySnapshotRow> {
  const { snapshot } = await json<{ snapshot: MemoryDecaySnapshotRow }>(
    fetch('/api/memory-decay-snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return snapshot
}

export async function fetchMemoryDecaySnapshots(params: {
  agentProfileId?: string
  limit?: number
} = {}): Promise<MemoryDecaySnapshotRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { snapshots } = await json<{ snapshots: MemoryDecaySnapshotRow[] }>(
    fetch(`/api/memory-decay-snapshots${suffix}`),
  )
  return snapshots
}

export async function applyMemoryDecayAction(
  snapshotId: string,
  body: {
    memoryItemId: string
    action: MemoryDecayAction
    confirm?: boolean
    patch?: {
      title?: string
      content?: string
      importance?: number
      expiresAt?: number | null
    }
  },
): Promise<MemoryDecaySnapshotRow> {
  const { snapshot } = await json<{ snapshot: MemoryDecaySnapshotRow }>(
    fetch(`/api/memory-decay-snapshots/${snapshotId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return snapshot
}

export async function fetchLearningEvents(status?: LearningEventRow['status']): Promise<LearningEventRow[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  const { learningEvents } = await json<{ learningEvents: LearningEventRow[] }>(
    fetch(`/api/learning-events${qs}`),
  )
  return learningEvents
}

export async function approveLearningEvent(
  learningEventId: string,
  reviewerNote = '',
): Promise<{
  learningEvent: LearningEventRow
  playbook: PlaybookRow | null
  playbookVersion: PlaybookVersionRow | null
}> {
  return json<{
    learningEvent: LearningEventRow
    playbook: PlaybookRow | null
    playbookVersion: PlaybookVersionRow | null
  }>(
    fetch(`/api/learning-events/${learningEventId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerNote }),
    }),
  )
}

export async function rejectLearningEvent(
  learningEventId: string,
  reviewerNote = '',
): Promise<LearningEventRow> {
  const { learningEvent } = await json<{ learningEvent: LearningEventRow }>(
    fetch(`/api/learning-events/${learningEventId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerNote }),
    }),
  )
  return learningEvent
}

export interface CreateAgentDiaryEntryBody {
  agentProfileId?: string | null
  employeeRunId?: string | null
  workflowRunId?: string | null
  entryType?: 'run_summary' | 'handoff' | 'lesson' | 'blocker' | 'next_step'
  title: string
  content: string
  nextActions?: string[]
  blockers?: string[]
  tags?: string[]
  importance?: number
}

export async function fetchAgentDiaryEntries(params: {
  agentProfileId?: string
  employeeRunId?: string
  limit?: number
} = {}): Promise<AgentDiaryEntryRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.employeeRunId) qs.set('employeeRunId', params.employeeRunId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { agentDiaryEntries } = await json<{ agentDiaryEntries: AgentDiaryEntryRow[] }>(
    fetch(`/api/agent-diary-entries${suffix}`),
  )
  return agentDiaryEntries
}

export async function createAgentDiaryEntry(
  body: CreateAgentDiaryEntryBody,
): Promise<AgentDiaryEntryRow> {
  const { agentDiaryEntry } = await json<{ agentDiaryEntry: AgentDiaryEntryRow }>(
    fetch('/api/agent-diary-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return agentDiaryEntry
}

export interface CreateContinuationPlanBody {
  agentProfileId?: string | null
  sourceRunId?: string | null
  workflowRunId?: string | null
  status?: ContinuationPlanStatus
  title: string
  summary: string
  nextSteps?: string[]
  resumeInput?: JsonObject
  requiredCapabilityRefs?: JsonObject[]
  dueAt?: number | null
}

export async function fetchContinuationPlans(params: {
  agentProfileId?: string
  sourceRunId?: string
  status?: ContinuationPlanStatus
  limit?: number
} = {}): Promise<ContinuationPlanRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.sourceRunId) qs.set('sourceRunId', params.sourceRunId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { continuationPlans } = await json<{ continuationPlans: ContinuationPlanRow[] }>(
    fetch(`/api/continuation-plans${suffix}`),
  )
  return continuationPlans
}

export async function createContinuationPlan(
  body: CreateContinuationPlanBody,
): Promise<ContinuationPlanRow> {
  const { continuationPlan } = await json<{ continuationPlan: ContinuationPlanRow }>(
    fetch('/api/continuation-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return continuationPlan
}

export async function updateContinuationPlanStatus(
  id: string,
  status: ContinuationPlanStatus,
): Promise<ContinuationPlanRow> {
  const { continuationPlan } = await json<{ continuationPlan: ContinuationPlanRow }>(
    fetch(`/api/continuation-plans/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
  )
  return continuationPlan
}

export interface CreateAgentRetirementPlanBody {
  agentProfileId: string
  targetAgentProfileId?: string | null
  status?: 'draft' | 'ready_for_review' | 'completed' | 'canceled'
  taskHandling?: JsonObject
  knowledgeExtraction?: JsonObject
  cleanupPolicy?: JsonObject
}

export async function fetchAgentRetirementPlans(params: {
  agentProfileId?: string
  targetAgentProfileId?: string
  status?: 'draft' | 'ready_for_review' | 'completed' | 'canceled'
  limit?: number
} = {}): Promise<AgentRetirementPlanRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.targetAgentProfileId) qs.set('targetAgentProfileId', params.targetAgentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { agentRetirementPlans } = await json<{ agentRetirementPlans: AgentRetirementPlanRow[] }>(
    fetch(`/api/agent-retirement-plans${suffix}`),
  )
  return agentRetirementPlans
}

export async function createAgentRetirementPlan(
  body: CreateAgentRetirementPlanBody,
): Promise<AgentRetirementPlanRow> {
  const { agentRetirementPlan } = await json<{ agentRetirementPlan: AgentRetirementPlanRow }>(
    fetch('/api/agent-retirement-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return agentRetirementPlan
}

export async function completeAgentRetirementPlan(id: string): Promise<AgentRetirementPlanRow> {
  const { agentRetirementPlan } = await json<{ agentRetirementPlan: AgentRetirementPlanRow }>(
    fetch(`/api/agent-retirement-plans/${id}/complete`, { method: 'POST' }),
  )
  return agentRetirementPlan
}

export interface CreateKnowledgeTransferPackageBody {
  fromAgentProfileId: string
  toAgentProfileId: string
  retirementPlanId?: string | null
  receiverHandling?: KnowledgeTransferReceiverHandling
  transferItems?: JsonObject
}

export async function fetchKnowledgeTransferPackages(params: {
  fromAgentProfileId?: string
  toAgentProfileId?: string
  retirementPlanId?: string
  status?: 'pending_review' | 'completed' | 'rejected'
  limit?: number
} = {}): Promise<KnowledgeTransferPackageRow[]> {
  const qs = new URLSearchParams()
  if (params.fromAgentProfileId) qs.set('fromAgentProfileId', params.fromAgentProfileId)
  if (params.toAgentProfileId) qs.set('toAgentProfileId', params.toAgentProfileId)
  if (params.retirementPlanId) qs.set('retirementPlanId', params.retirementPlanId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { knowledgeTransferPackages } = await json<{
    knowledgeTransferPackages: KnowledgeTransferPackageRow[]
  }>(fetch(`/api/knowledge-transfer-packages${suffix}`))
  return knowledgeTransferPackages
}

export async function createKnowledgeTransferPackage(
  body: CreateKnowledgeTransferPackageBody,
): Promise<KnowledgeTransferPackageRow> {
  const { knowledgeTransferPackage } = await json<{
    knowledgeTransferPackage: KnowledgeTransferPackageRow
  }>(
    fetch('/api/knowledge-transfer-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return knowledgeTransferPackage
}

export interface BuildOrganizationalKnowledgeBody {
  source?: OrganizationalKnowledgeSource
  sourceRef?: string | null
  periodStartAt?: number | null
  periodEndAt?: number | null
  minFrequency?: number
  promoteCandidates?: boolean
}

export interface OrganizationalKnowledgeBuildResult {
  insights: OrganizationalKnowledgeItemRow[]
  report: OrganizationalLearningReportRow
}

export async function buildOrganizationalKnowledge(
  body: BuildOrganizationalKnowledgeBody = {},
): Promise<OrganizationalKnowledgeBuildResult> {
  return json<OrganizationalKnowledgeBuildResult>(
    fetch('/api/organizational-knowledge/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchOrganizationalKnowledgeItems(params: {
  insightType?: OrganizationalInsightType
  status?: OrganizationalInsightStatus
  source?: OrganizationalKnowledgeSource
  limit?: number
} = {}): Promise<OrganizationalKnowledgeItemRow[]> {
  const qs = new URLSearchParams()
  if (params.insightType) qs.set('insightType', params.insightType)
  if (params.status) qs.set('status', params.status)
  if (params.source) qs.set('source', params.source)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { organizationalKnowledgeItems } = await json<{
    organizationalKnowledgeItems: OrganizationalKnowledgeItemRow[]
  }>(fetch(`/api/organizational-knowledge/insights${suffix}`))
  return organizationalKnowledgeItems
}

export async function promoteOrganizationalInsight(
  id: string,
): Promise<OrganizationalKnowledgeItemRow> {
  const { organizationalKnowledgeItem } = await json<{
    organizationalKnowledgeItem: OrganizationalKnowledgeItemRow
  }>(
    fetch(`/api/organizational-knowledge/insights/${id}/promote`, {
      method: 'POST',
    }),
  )
  return organizationalKnowledgeItem
}

export async function fetchOrganizationalLearningReports(
  limit = 100,
): Promise<OrganizationalLearningReportRow[]> {
  const { organizationalLearningReports } = await json<{
    organizationalLearningReports: OrganizationalLearningReportRow[]
  }>(fetch(`/api/organizational-knowledge/reports?limit=${limit}`))
  return organizationalLearningReports
}

export interface CreateMetaAgentProfileBody {
  name?: string
  responsibilities?: MetaAgentResponsibility[]
  specialCapabilities?: JsonObject
  restrictions?: JsonObject
  scheduleLocalTime?: string
}

export interface GenerateMetaAgentDigestBody {
  metaAgentProfileId?: string | null
  now?: number
  budgetLimitCents?: number | null
}

export interface MetaAgentDigestResult {
  metaAgentProfile: MetaAgentProfileRow
  digest: MetaAgentDigestRow
  recommendations: MetaAgentRecommendationRow[]
}

export async function fetchMetaAgentProfiles(limit = 50): Promise<MetaAgentProfileRow[]> {
  const { metaAgentProfiles } = await json<{ metaAgentProfiles: MetaAgentProfileRow[] }>(
    fetch(`/api/meta-agent/profiles?limit=${limit}`),
  )
  return metaAgentProfiles
}

export async function createMetaAgentProfile(
  body: CreateMetaAgentProfileBody = {},
): Promise<MetaAgentProfileRow> {
  const { metaAgentProfile } = await json<{ metaAgentProfile: MetaAgentProfileRow }>(
    fetch('/api/meta-agent/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return metaAgentProfile
}

export async function fetchMetaAgentDigests(limit = 50): Promise<MetaAgentDigestRow[]> {
  const { metaAgentDigests } = await json<{ metaAgentDigests: MetaAgentDigestRow[] }>(
    fetch(`/api/meta-agent/digests?limit=${limit}`),
  )
  return metaAgentDigests
}

export async function generateMetaAgentDigest(
  body: GenerateMetaAgentDigestBody = {},
): Promise<MetaAgentDigestResult> {
  return json<MetaAgentDigestResult>(
    fetch('/api/meta-agent/digests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchMetaAgentRecommendations(params: {
  status?: MetaAgentRecommendationStatus
  digestId?: string
  limit?: number
} = {}): Promise<MetaAgentRecommendationRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.digestId) qs.set('digestId', params.digestId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { metaAgentRecommendations } = await json<{
    metaAgentRecommendations: MetaAgentRecommendationRow[]
  }>(fetch(`/api/meta-agent/recommendations${suffix}`))
  return metaAgentRecommendations
}

export async function updateMetaAgentRecommendationStatus(
  id: string,
  status: MetaAgentRecommendationStatus,
): Promise<MetaAgentRecommendationRow> {
  const { metaAgentRecommendation } = await json<{
    metaAgentRecommendation: MetaAgentRecommendationRow
  }>(
    fetch(`/api/meta-agent/recommendations/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
  )
  return metaAgentRecommendation
}

export interface EnqueueContinuationPlanBody {
  queueId: string
  priority?: number
  scheduledAt?: number
  budgetLimitCents?: number | null
  autoComplete?: boolean
  goal?: string
  input?: JsonObject
}

export async function enqueueContinuationPlan(
  id: string,
  body: EnqueueContinuationPlanBody,
): Promise<TaskQueueItemRow> {
  const { taskQueueItem } = await json<{ taskQueueItem: TaskQueueItemRow }>(
    fetch(`/api/continuation-plans/${id}/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return taskQueueItem
}

export interface EnqueueDueContinuationPlansBody {
  queueId: string
  now?: number
  limit?: number
  priority?: number
  budgetLimitCents?: number | null
}

export interface EnqueueDueContinuationPlansResult {
  queue: TaskQueueRow
  scanned: number
  due: number
  queued: number
  skipped: number
  items: TaskQueueItemRow[]
}

export async function enqueueDueContinuationPlans(
  body: EnqueueDueContinuationPlansBody,
): Promise<EnqueueDueContinuationPlansResult> {
  return json<EnqueueDueContinuationPlansResult>(
    fetch('/api/continuation-plans/enqueue-due', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchPlaybooks(agentProfileId?: string): Promise<PlaybookRow[]> {
  const qs = agentProfileId ? `?agentProfileId=${encodeURIComponent(agentProfileId)}` : ''
  const { playbooks } = await json<{ playbooks: PlaybookRow[] }>(fetch(`/api/playbooks${qs}`))
  return playbooks
}

export interface WorkflowGraph {
  workflow: WorkflowRow
  nodes: WorkflowNodeRow[]
  edges: WorkflowEdgeRow[]
}

export interface WorkflowRunSnapshot {
  workflowRun: WorkflowRunRow
  nodeRuns: WorkflowNodeRunRow[]
  employeeRuns: EmployeeRunRow[]
  nodeBrainStatuses: WorkflowNodeBrainStatus[]
  softwareCommandRuns: SoftwareCommandRunRow[]
  computerSessions: ComputerSessionRow[]
  computerActionEvents: ComputerActionEventRow[]
  artifactValidations: ArtifactValidationRow[]
  approvalRequests: ApprovalRequestRow[]
  resourceLocks: ResourceLockRow[]
}

export interface CreateWorkflowBody {
  name: string
  description?: string
  status?: 'draft' | 'active' | 'archived'
  nodes?: Array<{
    id?: string
    type: string
    agentProfileId?: string | null
    position: { x: number; y: number }
    config?: JsonObject
    inputMapping?: JsonObject
    outputContract?: JsonObject
    retryPolicy?: JsonObject
    approvalPolicy?: JsonObject
  }>
  edges?: Array<{
    id?: string
    sourceNodeId: string
    targetNodeId: string
    sourceHandle?: string | null
    targetHandle?: string | null
    mapping?: JsonObject
  }>
}

export async function fetchWorkflows(): Promise<WorkflowRow[]> {
  const { workflows } = await json<{ workflows: WorkflowRow[] }>(fetch('/api/workflows'))
  return workflows
}

export async function createWorkflow(body: CreateWorkflowBody): Promise<WorkflowRow> {
  const { workflow } = await json<{ workflow: WorkflowRow }>(
    fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return workflow
}

export async function updateWorkflow(workflowId: string, body: CreateWorkflowBody): Promise<WorkflowRow> {
  const { workflow } = await json<{ workflow: WorkflowRow }>(
    fetch(`/api/workflows/${workflowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return workflow
}

export async function fetchWorkflowPresets(): Promise<WorkflowPresetDto[]> {
  const { workflowPresets } = await json<{ workflowPresets: WorkflowPresetDto[] }>(
    fetch('/api/workflow-presets'),
  )
  return workflowPresets
}

export async function installWorkflowPreset(
  presetId: string,
  body: { name?: string; status?: WorkflowRow['status'] } = {},
): Promise<WorkflowGraph> {
  const { workflowGraph } = await json<{ workflowGraph: WorkflowGraph }>(
    fetch(`/api/workflow-presets/${presetId}/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return workflowGraph
}

export async function runWorkflowPreset(
  presetId: string,
  input: JsonObject = {},
): Promise<{ workflow: WorkflowRow; workflowRun: WorkflowRunRow }> {
  return json<{ workflow: WorkflowRow; workflowRun: WorkflowRunRow }>(
    fetch(`/api/workflow-presets/${presetId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    }),
  )
}

export async function fetchWorkflowGraph(workflowId: string): Promise<WorkflowGraph> {
  return json<WorkflowGraph>(fetch(`/api/workflows/${workflowId}`))
}

export type { WorkflowCanvasReport }

export async function fetchWorkflowCanvasReport(
  workflowId: string,
): Promise<WorkflowCanvasReport> {
  const { report } = await json<{ report: WorkflowCanvasReport }>(
    fetch(`/api/workflows/${workflowId}/canvas-report`),
  )
  return report
}

export interface RunWorkflowPreflightBody {
  input?: JsonObject
  budgetLimitCents?: number | null
}

export async function runWorkflowPreflight(
  workflowId: string,
  body: RunWorkflowPreflightBody = {},
): Promise<WorkflowPreflightRow> {
  const { workflowPreflight } = await json<{ workflowPreflight: WorkflowPreflightRow }>(
    fetch(`/api/workflows/${workflowId}/preflight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return workflowPreflight
}

export interface SimulationTaskDto {
  id?: string
  title: string
  input?: JsonObject
  successCriteria?: string[]
  environmentSnapshot?: JsonObject
}

export async function createSimulationRun(body: {
  targetType: SimulationTargetType
  agentProfileId?: string | null
  workflowId?: string | null
  mode?: SimulationRunMode
  taskTitle: string
  input?: JsonObject
  simulatedEnvironment?: JsonObject
  simulatedToolResults?: JsonObject[]
}): Promise<SimulationRunRow> {
  const { simulationRun } = await json<{ simulationRun: SimulationRunRow }>(
    fetch('/api/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return simulationRun
}

export async function fetchSimulationRuns(params: {
  agentProfileId?: string
  workflowId?: string
  status?: SimulationRunStatus
  limit?: number
} = {}): Promise<SimulationRunRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.workflowId) qs.set('workflowId', params.workflowId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { simulationRuns } = await json<{ simulationRuns: SimulationRunRow[] }>(
    fetch(`/api/simulations${suffix}`),
  )
  return simulationRuns
}

export async function reviewSimulationRun(
  id: string,
  body: { decision: 'approved' | 'rejected'; adjustments?: JsonObject[] },
): Promise<SimulationRunRow> {
  const { simulationRun } = await json<{ simulationRun: SimulationRunRow }>(
    fetch(`/api/simulations/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return simulationRun
}

export async function createGoldenTaskSet(body: {
  name: string
  targetType?: SimulationTargetType
  agentProfileId?: string | null
  workflowId?: string | null
  tasks: SimulationTaskDto[]
  successCriteria?: string[]
  ciPolicy?: JsonObject
  status?: GoldenTaskSetStatus
}): Promise<GoldenTaskSetRow> {
  const { goldenTaskSet } = await json<{ goldenTaskSet: GoldenTaskSetRow }>(
    fetch('/api/golden-task-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return goldenTaskSet
}

export async function fetchGoldenTaskSets(params: {
  agentProfileId?: string
  workflowId?: string
  status?: GoldenTaskSetStatus
  limit?: number
} = {}): Promise<GoldenTaskSetRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.workflowId) qs.set('workflowId', params.workflowId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { goldenTaskSets } = await json<{ goldenTaskSets: GoldenTaskSetRow[] }>(
    fetch(`/api/golden-task-sets${suffix}`),
  )
  return goldenTaskSets
}

export async function runBacktest(body: {
  mode?: BacktestRunMode
  targetType: SimulationTargetType
  agentProfileId?: string | null
  workflowId?: string | null
  goldenTaskSetId?: string | null
  historicalTasks?: SimulationTaskDto[]
  baselineVersion?: string
  candidateVersion?: string
  candidateChanges?: JsonObject
}): Promise<BacktestRunRow> {
  const { backtestRun } = await json<{ backtestRun: BacktestRunRow }>(
    fetch('/api/backtests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return backtestRun
}

export async function fetchBacktestRuns(params: {
  agentProfileId?: string
  workflowId?: string
  goldenTaskSetId?: string
  gateStatus?: BacktestGateStatus
  limit?: number
} = {}): Promise<BacktestRunRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.workflowId) qs.set('workflowId', params.workflowId)
  if (params.goldenTaskSetId) qs.set('goldenTaskSetId', params.goldenTaskSetId)
  if (params.gateStatus) qs.set('gateStatus', params.gateStatus)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { backtestRuns } = await json<{ backtestRuns: BacktestRunRow[] }>(
    fetch(`/api/backtests${suffix}`),
  )
  return backtestRuns
}

export async function startWorkflowRun(
  workflowId: string,
  input: JsonObject = {},
): Promise<WorkflowRunRow> {
  const { workflowRun } = await json<{ workflowRun: WorkflowRunRow }>(
    fetch(`/api/workflows/${workflowId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    }),
  )
  return workflowRun
}

export async function fetchWorkflowPreflights(workflowId?: string): Promise<WorkflowPreflightRow[]> {
  const qs = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : ''
  const { workflowPreflights } = await json<{ workflowPreflights: WorkflowPreflightRow[] }>(
    fetch(`/api/workflow-preflights${qs}`),
  )
  return workflowPreflights
}

export interface CreateNaturalLanguageWorkflowDraftBody {
  prompt: string
  name?: string
  agentProfileIds?: string[]
  preferredAgentRoles?: string[]
}

export interface ConfirmNaturalLanguageWorkflowDraftBody {
  name?: string
  status?: WorkflowRow['status']
  modifications?: JsonObject
}

export interface NaturalLanguageWorkflowConfirmResult {
  draft: NaturalLanguageWorkflowDraftRow
  workflowGraph: WorkflowGraph
}

export async function fetchNaturalLanguageWorkflowDrafts(params: {
  status?: NaturalLanguageWorkflowDraftStatus
  limit?: number
} = {}): Promise<NaturalLanguageWorkflowDraftRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { drafts } = await json<{ drafts: NaturalLanguageWorkflowDraftRow[] }>(
    fetch(`/api/workflow-nl-drafts${suffix}`),
  )
  return drafts
}

export async function createNaturalLanguageWorkflowDraft(
  body: CreateNaturalLanguageWorkflowDraftBody,
): Promise<NaturalLanguageWorkflowDraftRow> {
  const { draft } = await json<{ draft: NaturalLanguageWorkflowDraftRow }>(
    fetch('/api/workflow-nl-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return draft
}

export async function reviseNaturalLanguageWorkflowDraft(
  draftId: string,
  body: { modificationPrompt: string; name?: string; agentProfileIds?: string[] },
): Promise<NaturalLanguageWorkflowDraftRow> {
  const { draft } = await json<{ draft: NaturalLanguageWorkflowDraftRow }>(
    fetch(`/api/workflow-nl-drafts/${draftId}/revise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return draft
}

export async function confirmNaturalLanguageWorkflowDraft(
  draftId: string,
  body: ConfirmNaturalLanguageWorkflowDraftBody = {},
): Promise<NaturalLanguageWorkflowConfirmResult> {
  return json<NaturalLanguageWorkflowConfirmResult>(
    fetch(`/api/workflow-nl-drafts/${draftId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export interface AnalyzeWorkflowOptimizationBody {
  workflowId: string
  autoApply?: WorkflowOptimizationAutoApply
}

export async function analyzeWorkflowOptimization(
  body: AnalyzeWorkflowOptimizationBody,
): Promise<WorkflowOptimizationRow> {
  const { workflowOptimization } = await json<{ workflowOptimization: WorkflowOptimizationRow }>(
    fetch('/api/workflow-optimizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return workflowOptimization
}

export async function fetchWorkflowOptimizations(params: {
  workflowId?: string
  status?: WorkflowOptimizationStatus
  limit?: number
} = {}): Promise<WorkflowOptimizationRow[]> {
  const qs = new URLSearchParams()
  if (params.workflowId) qs.set('workflowId', params.workflowId)
  if (params.status) qs.set('status', params.status)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { workflowOptimizations } = await json<{ workflowOptimizations: WorkflowOptimizationRow[] }>(
    fetch(`/api/workflow-optimizations${suffix}`),
  )
  return workflowOptimizations
}

export async function applyWorkflowOptimization(
  optimizationId: string,
  body: { riskThreshold?: 'low' | 'medium' } = {},
): Promise<WorkflowOptimizationRow> {
  const { workflowOptimization } = await json<{ workflowOptimization: WorkflowOptimizationRow }>(
    fetch(`/api/workflow-optimizations/${optimizationId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return workflowOptimization
}

export async function fetchWorkflowRuns(workflowId?: string): Promise<WorkflowRunRow[]> {
  const qs = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : ''
  const { workflowRuns } = await json<{ workflowRuns: WorkflowRunRow[] }>(
    fetch(`/api/workflow-runs${qs}`),
  )
  return workflowRuns
}

export interface TaskTemplateParameterDefinition {
  type: TaskTemplateParameterType
  label: string
  description?: string
  default?: unknown
  required?: boolean
  options?: Array<{ label: string; value: unknown }>
}

export interface CreateTaskTemplateBody {
  name: string
  description?: string
  category: string
  parameters?: Record<string, TaskTemplateParameterDefinition>
  agentRole: string
  workflowId?: string | null
  descriptionTemplate: string
  inputTemplate?: JsonObject
  estimatedDuration?: string
  estimatedCost?: number
  tags?: string[]
  relatedMemories?: string[]
  requiredSkills?: string[]
  sampleOutputs?: string[]
  status?: TaskTemplateStatus
}

export async function seedDefaultTaskTemplates(): Promise<TaskTemplateRow[]> {
  const { taskTemplates } = await json<{ taskTemplates: TaskTemplateRow[] }>(
    fetch('/api/task-templates/seed', { method: 'POST' }),
  )
  return taskTemplates
}

export async function createTaskTemplate(body: CreateTaskTemplateBody): Promise<TaskTemplateRow> {
  const { taskTemplate } = await json<{ taskTemplate: TaskTemplateRow }>(
    fetch('/api/task-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return taskTemplate
}

export async function fetchTaskTemplates(params: {
  category?: string
  status?: TaskTemplateStatus
  query?: string
  limit?: number
} = {}): Promise<TaskTemplateRow[]> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.status) qs.set('status', params.status)
  if (params.query) qs.set('query', params.query)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { taskTemplates } = await json<{ taskTemplates: TaskTemplateRow[] }>(
    fetch(`/api/task-templates${suffix}`),
  )
  return taskTemplates
}

export async function instantiateTaskTemplate(
  taskTemplateId: string,
  body: {
    parameters?: JsonObject
    agentProfileId?: string | null
    workflowId?: string | null
    status?: 'planned' | 'queued'
  } = {},
): Promise<TaskTemplateRunRow> {
  const { taskTemplateRun } = await json<{ taskTemplateRun: TaskTemplateRunRow }>(
    fetch(`/api/task-templates/${taskTemplateId}/instantiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return taskTemplateRun
}

export async function fetchTaskTemplateRuns(params: {
  taskTemplateId?: string
  status?: TaskTemplateRunRow['status']
  limit?: number
} = {}): Promise<TaskTemplateRunRow[]> {
  const qs = new URLSearchParams()
  if (params.taskTemplateId) qs.set('taskTemplateId', params.taskTemplateId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { taskTemplateRuns } = await json<{ taskTemplateRuns: TaskTemplateRunRow[] }>(
    fetch(`/api/task-template-runs${suffix}`),
  )
  return taskTemplateRuns
}

export async function completeTaskTemplateRun(
  taskTemplateRunId: string,
  body: {
    success: boolean
    actualDuration?: string
    actualCost?: number
  },
): Promise<TaskTemplateRunRow> {
  const { taskTemplateRun } = await json<{ taskTemplateRun: TaskTemplateRunRow }>(
    fetch(`/api/task-template-runs/${taskTemplateRunId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return taskTemplateRun
}

export interface CreateTaskQueueBody {
  name: string
  concurrencyLimit?: number
  status?: TaskQueueRow['status']
}

export async function fetchTaskQueues(): Promise<TaskQueueRow[]> {
  const { taskQueues } = await json<{ taskQueues: TaskQueueRow[] }>(fetch('/api/task-queues'))
  return taskQueues
}

export async function createTaskQueue(body: CreateTaskQueueBody): Promise<TaskQueueRow> {
  const { taskQueue } = await json<{ taskQueue: TaskQueueRow }>(
    fetch('/api/task-queues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return taskQueue
}

export interface EnqueueTaskBody {
  kind: TaskQueueItemKind
  payload: JsonObject
  priority?: number
  scheduledAt?: number
}

export async function enqueueTask(
  taskQueueId: string,
  body: EnqueueTaskBody,
): Promise<TaskQueueItemRow> {
  const { taskQueueItem } = await json<{ taskQueueItem: TaskQueueItemRow }>(
    fetch(`/api/task-queues/${taskQueueId}/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return taskQueueItem
}

export async function processTaskQueue(
  taskQueueId: string,
  maxItems?: number,
): Promise<{
  queue: TaskQueueRow
  started: number
  completed: number
  failed: number
  skipped: number
  items: TaskQueueItemRow[]
}> {
  return json<{
    queue: TaskQueueRow
    started: number
    completed: number
    failed: number
    skipped: number
    items: TaskQueueItemRow[]
  }>(
    fetch(`/api/task-queues/${taskQueueId}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxItems }),
    }),
  )
}

export interface PlanTaskBatchBody {
  queueId: string
  now?: number
  strategy?: Partial<TaskBatchStrategy>
}

export async function planTaskBatch(body: PlanTaskBatchBody): Promise<TaskBatchRow> {
  const { taskBatch } = await json<{ taskBatch: TaskBatchRow }>(
    fetch('/api/task-batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return taskBatch
}

export async function fetchTaskBatches(params: {
  queueId?: string
  status?: TaskBatchStatus
} = {}): Promise<TaskBatchRow[]> {
  const qs = new URLSearchParams()
  if (params.queueId) qs.set('queueId', params.queueId)
  if (params.status) qs.set('status', params.status)
  const query = qs.toString()
  const { taskBatches } = await json<{ taskBatches: TaskBatchRow[] }>(
    fetch(`/api/task-batches${query ? `?${query}` : ''}`),
  )
  return taskBatches
}

export async function applyTaskBatch(taskBatchId: string): Promise<TaskBatchRow> {
  const { taskBatch } = await json<{ taskBatch: TaskBatchRow }>(
    fetch(`/api/task-batches/${taskBatchId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
  )
  return taskBatch
}

export async function planPartialWorkflowRerun(body: {
  workflowRunId: string
  fromNodeId: string
  inputPatch?: JsonObject
}): Promise<WorkflowPartialRerunPlanRow> {
  const { partialRerun } = await json<{ partialRerun: WorkflowPartialRerunPlanRow }>(
    fetch('/api/workflow-advanced-operations/partial-reruns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return partialRerun
}

export async function applyPartialWorkflowRerun(planId: string): Promise<WorkflowPartialRerunPlanRow> {
  const { partialRerun } = await json<{ partialRerun: WorkflowPartialRerunPlanRow }>(
    fetch(`/api/workflow-advanced-operations/partial-reruns/${planId}/apply`, {
      method: 'POST',
    }),
  )
  return partialRerun
}

export async function fetchPartialWorkflowReruns(params: {
  workflowRunId?: string
  status?: WorkflowPartialRerunStatus
  limit?: number
} = {}): Promise<WorkflowPartialRerunPlanRow[]> {
  const qs = new URLSearchParams()
  if (params.workflowRunId) qs.set('workflowRunId', params.workflowRunId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { partialReruns } = await json<{ partialReruns: WorkflowPartialRerunPlanRow[] }>(
    fetch(`/api/workflow-advanced-operations/partial-reruns${suffix}`),
  )
  return partialReruns
}

export async function suggestTaskMerge(body: {
  agentProfileId?: string | null
  taskType?: string
  tasks: Array<{
    id: string
    title: string
    taskType?: string
    agentProfileId?: string | null
    payload?: JsonObject
  }>
}): Promise<TaskMergeSuggestionRow> {
  const { taskMergeSuggestion } = await json<{ taskMergeSuggestion: TaskMergeSuggestionRow }>(
    fetch('/api/workflow-advanced-operations/task-merge-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return taskMergeSuggestion
}

export async function decideTaskMergeSuggestion(
  suggestionId: string,
  body: { decision: 'approved' | 'rejected'; note?: string },
): Promise<TaskMergeSuggestionRow> {
  const { taskMergeSuggestion } = await json<{ taskMergeSuggestion: TaskMergeSuggestionRow }>(
    fetch(`/api/workflow-advanced-operations/task-merge-suggestions/${suggestionId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return taskMergeSuggestion
}

export async function applyTaskMergeSuggestion(suggestionId: string): Promise<TaskMergeSuggestionRow> {
  const { taskMergeSuggestion } = await json<{ taskMergeSuggestion: TaskMergeSuggestionRow }>(
    fetch(`/api/workflow-advanced-operations/task-merge-suggestions/${suggestionId}/apply`, {
      method: 'POST',
    }),
  )
  return taskMergeSuggestion
}

export async function fetchTaskMergeSuggestions(params: {
  agentProfileId?: string
  status?: TaskMergeSuggestionStatus
  limit?: number
} = {}): Promise<TaskMergeSuggestionRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { taskMergeSuggestions } = await json<{ taskMergeSuggestions: TaskMergeSuggestionRow[] }>(
    fetch(`/api/workflow-advanced-operations/task-merge-suggestions${suffix}`),
  )
  return taskMergeSuggestions
}

export async function instantiateWorkflowTemplate(body: {
  sourceWorkflowId: string
  name?: string
  parameters: JsonObject
  parameterSchema: WorkflowTemplateParameterSchema
}): Promise<WorkflowTemplateInstantiationRow> {
  const { workflowTemplateInstantiation } = await json<{
    workflowTemplateInstantiation: WorkflowTemplateInstantiationRow
  }>(
    fetch('/api/workflow-advanced-operations/template-instantiations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return workflowTemplateInstantiation
}

export async function fetchWorkflowTemplateInstantiations(params: {
  sourceWorkflowId?: string
  status?: WorkflowTemplateInstantiationStatus
  limit?: number
} = {}): Promise<WorkflowTemplateInstantiationRow[]> {
  const qs = new URLSearchParams()
  if (params.sourceWorkflowId) qs.set('sourceWorkflowId', params.sourceWorkflowId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { workflowTemplateInstantiations } = await json<{
    workflowTemplateInstantiations: WorkflowTemplateInstantiationRow[]
  }>(fetch(`/api/workflow-advanced-operations/template-instantiations${suffix}`))
  return workflowTemplateInstantiations
}

export type DataMaintenancePolicyPatch = {
  logRotation?: Partial<DataMaintenancePolicy['logRotation']>
  sqliteMaintenance?: Partial<DataMaintenancePolicy['sqliteMaintenance']>
  workspaceGc?: Partial<DataMaintenancePolicy['workspaceGc']>
  browserProfiles?: Partial<DataMaintenancePolicy['browserProfiles']>
}

export interface CreateDataMaintenancePolicyBody {
  name?: string
  status?: DataMaintenancePolicyStatus
  policy?: DataMaintenancePolicyPatch
}

export interface ObservedBrowserProfileInput {
  profilePath: string
  sizeBytes: number
  lastUsedAt?: number
  agentProfileId?: string | null
}

export async function seedDataMaintenancePolicy(): Promise<DataMaintenancePolicyRow> {
  const { policy } = await json<{ policy: DataMaintenancePolicyRow }>(
    fetch('/api/data-maintenance/policies/seed', { method: 'POST' }),
  )
  return policy
}

export async function createDataMaintenancePolicy(
  body: CreateDataMaintenancePolicyBody,
): Promise<DataMaintenancePolicyRow> {
  const { policy } = await json<{ policy: DataMaintenancePolicyRow }>(
    fetch('/api/data-maintenance/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return policy
}

export async function fetchDataMaintenancePolicies(params: {
  status?: DataMaintenancePolicyStatus
  limit?: number
} = {}): Promise<DataMaintenancePolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: DataMaintenancePolicyRow[] }>(
    fetch(`/api/data-maintenance/policies${suffix}`),
  )
  return policies
}

export async function runDataMaintenance(body: {
  policyId?: string
  now?: number
  observedBrowserProfiles?: ObservedBrowserProfileInput[]
} = {}): Promise<DataMaintenanceRunRow> {
  const { run } = await json<{ run: DataMaintenanceRunRow }>(
    fetch('/api/data-maintenance/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return run
}

export async function fetchDataMaintenanceRuns(params: {
  policyId?: string
  status?: DataMaintenanceRunStatus
  limit?: number
} = {}): Promise<DataMaintenanceRunRow[]> {
  const qs = new URLSearchParams()
  if (params.policyId) qs.set('policyId', params.policyId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { runs } = await json<{ runs: DataMaintenanceRunRow[] }>(
    fetch(`/api/data-maintenance/runs${suffix}`),
  )
  return runs
}

export type MemoryIntegrityPolicyPatch = {
  beforeWrite?: Partial<MemoryIntegrityPolicy['beforeWrite']>
  periodicScan?: Partial<MemoryIntegrityPolicy['periodicScan']>
}

export async function seedMemoryIntegrityPolicy(): Promise<MemoryIntegrityPolicyRow> {
  const { policy } = await json<{ policy: MemoryIntegrityPolicyRow }>(
    fetch('/api/memory-integrity/policies/seed', { method: 'POST' }),
  )
  return policy
}

export async function createMemoryIntegrityPolicy(body: {
  name?: string
  status?: MemoryIntegrityPolicyStatus
  policy?: MemoryIntegrityPolicyPatch
}): Promise<MemoryIntegrityPolicyRow> {
  const { policy } = await json<{ policy: MemoryIntegrityPolicyRow }>(
    fetch('/api/memory-integrity/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return policy
}

export async function fetchMemoryIntegrityPolicies(params: {
  status?: MemoryIntegrityPolicyStatus
  limit?: number
} = {}): Promise<MemoryIntegrityPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: MemoryIntegrityPolicyRow[] }>(
    fetch(`/api/memory-integrity/policies${suffix}`),
  )
  return policies
}

export async function evaluateMemoryBeforeWrite(body: {
  policyId?: string
  agentProfileId?: string | null
  memoryItemId?: string | null
  sourceType: MemoryIntegritySourceType
  title: string
  content: string
  requestedConfidence?: number
}): Promise<MemoryIntegrityEvaluationRow> {
  const { evaluation } = await json<{ evaluation: MemoryIntegrityEvaluationRow }>(
    fetch('/api/memory-integrity/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evaluation
}

export async function scanMemoryIntegrity(body: {
  policyId?: string
  agentProfileId?: string
  limit?: number
} = {}): Promise<{
  policy: MemoryIntegrityPolicyRow
  evaluatedCount: number
  blocked: number
  flagged: number
  warnings: number
  evaluations: MemoryIntegrityEvaluationRow[]
}> {
  const { scan } = await json<{
    scan: {
      policy: MemoryIntegrityPolicyRow
      evaluatedCount: number
      blocked: number
      flagged: number
      warnings: number
      evaluations: MemoryIntegrityEvaluationRow[]
    }
  }>(
    fetch('/api/memory-integrity/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return scan
}

export async function fetchMemoryIntegrityEvaluations(params: {
  policyId?: string
  memoryItemId?: string
  decision?: MemoryIntegrityDecision
  limit?: number
} = {}): Promise<MemoryIntegrityEvaluationRow[]> {
  const qs = new URLSearchParams()
  if (params.policyId) qs.set('policyId', params.policyId)
  if (params.memoryItemId) qs.set('memoryItemId', params.memoryItemId)
  if (params.decision) qs.set('decision', params.decision)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { evaluations } = await json<{ evaluations: MemoryIntegrityEvaluationRow[] }>(
    fetch(`/api/memory-integrity/evaluations${suffix}`),
  )
  return evaluations
}

export async function seedNfrRequirements(): Promise<NfrRequirementRow[]> {
  const { requirements } = await json<{ requirements: NfrRequirementRow[] }>(
    fetch('/api/nfr/requirements/seed', { method: 'POST' }),
  )
  return requirements
}

export async function fetchNfrRequirements(params: {
  category?: NfrCategory
  status?: NfrRequirementStatus
  limit?: number
} = {}): Promise<NfrRequirementRow[]> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { requirements } = await json<{ requirements: NfrRequirementRow[] }>(
    fetch(`/api/nfr/requirements${suffix}`),
  )
  return requirements
}

export async function evaluateNfrRequirements(body: {
  observed?: JsonObject
} = {}): Promise<{
  evaluations: NfrEvaluationRow[]
  summary: { passed: number; failed: number; warnings: number; unknown: number; total: number }
}> {
  return json<{
    evaluations: NfrEvaluationRow[]
    summary: { passed: number; failed: number; warnings: number; unknown: number; total: number }
  }>(
    fetch('/api/nfr/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchNfrEvaluations(params: {
  status?: NfrEvaluationStatus
  requirementId?: string
  limit?: number
} = {}): Promise<NfrEvaluationRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.requirementId) qs.set('requirementId', params.requirementId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { evaluations } = await json<{ evaluations: NfrEvaluationRow[] }>(
    fetch(`/api/nfr/evaluations${suffix}`),
  )
  return evaluations
}

export async function seedKnownLimitations(): Promise<KnownLimitationRow[]> {
  const { limitations } = await json<{ limitations: KnownLimitationRow[] }>(
    fetch('/api/known-limitations/seed', { method: 'POST' }),
  )
  return limitations
}

export async function fetchKnownLimitations(params: {
  category?: KnownLimitationCategory
  severity?: KnownLimitationSeverity
  status?: KnownLimitationStatus
  surface?: LimitationDisclosureSurface
  limit?: number
} = {}): Promise<KnownLimitationRow[]> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.severity) qs.set('severity', params.severity)
  if (params.status) qs.set('status', params.status)
  if (params.surface) qs.set('surface', params.surface)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { limitations } = await json<{ limitations: KnownLimitationRow[] }>(
    fetch(`/api/known-limitations${suffix}`),
  )
  return limitations
}

export async function evaluateKnownLimitations(body: {
  requestedCapabilities?: string[]
  surface?: LimitationDisclosureSurface
} = {}): Promise<{
  limitations: KnownLimitationRow[]
  summary: {
    requestedCapabilities: string[]
    total: number
    blocking: number
    warnings: number
    info: number
    requiresAcknowledgement: number
    canProceedWithoutUserAcknowledgement: boolean
  }
  recommendations: string[]
}> {
  return json<{
    limitations: KnownLimitationRow[]
    summary: {
      requestedCapabilities: string[]
      total: number
      blocking: number
      warnings: number
      info: number
      requiresAcknowledgement: number
      canProceedWithoutUserAcknowledgement: boolean
    }
    recommendations: string[]
  }>(
    fetch('/api/known-limitations/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function acknowledgeKnownLimitation(
  limitationId: string,
  body: {
    acknowledgedBy?: string
    surface?: LimitationDisclosureSurface
    note?: string
  } = {},
): Promise<LimitationAcknowledgementRow> {
  const { acknowledgement } = await json<{ acknowledgement: LimitationAcknowledgementRow }>(
    fetch(`/api/known-limitations/${limitationId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return acknowledgement
}

export async function fetchLimitationAcknowledgements(params: {
  limitationId?: string
  acknowledgedBy?: string
  surface?: LimitationDisclosureSurface
  limit?: number
} = {}): Promise<LimitationAcknowledgementRow[]> {
  const qs = new URLSearchParams()
  if (params.limitationId) qs.set('limitationId', params.limitationId)
  if (params.acknowledgedBy) qs.set('acknowledgedBy', params.acknowledgedBy)
  if (params.surface) qs.set('surface', params.surface)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { acknowledgements } = await json<{
    acknowledgements: LimitationAcknowledgementRow[]
  }>(fetch(`/api/known-limitations/acknowledgements${suffix}`))
  return acknowledgements
}

export interface AcceptanceCapabilityCheckDefinition {
  step: string
  requiredTables: string[]
  serviceFiles: string[]
  apiRouteFiles: string[]
  evidenceNotes: string[]
  manualGaps?: string[]
}

export interface AcceptanceScenarioDefinition {
  key: AcceptanceScenarioKey
  name: string
  steps: string[]
  expected: string
  checks: AcceptanceCapabilityCheckDefinition[]
}

export interface AcceptanceSuiteSummary {
  scenarioCount: number
  passed: number
  warnings: number
  failed: number
  manualRequired: number
  automatedBaselineReady: boolean
  releaseReadyWithoutManualQA: boolean
}

export interface AcceptanceSuiteResult {
  runs: AcceptanceScenarioRunRow[]
  summary: AcceptanceSuiteSummary
}

export async function fetchAcceptanceCriteriaDefinitions(): Promise<AcceptanceScenarioDefinition[]> {
  const { scenarios } = await json<{ scenarios: AcceptanceScenarioDefinition[] }>(
    fetch('/api/acceptance-criteria'),
  )
  return scenarios
}

export async function runFinalAcceptanceSuite(body: {
  scenarioKeys?: AcceptanceScenarioKey[]
} = {}): Promise<AcceptanceSuiteResult> {
  return json<AcceptanceSuiteResult>(
    fetch('/api/acceptance-criteria/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchAcceptanceScenarioRuns(params: {
  scenarioKey?: AcceptanceScenarioKey
  status?: AcceptanceScenarioStatus
} = {}): Promise<AcceptanceScenarioRunRow[]> {
  const qs = new URLSearchParams()
  if (params.scenarioKey) qs.set('scenarioKey', params.scenarioKey)
  if (params.status) qs.set('status', params.status)
  const query = qs.toString()
  const { acceptanceScenarioRuns } = await json<{
    acceptanceScenarioRuns: AcceptanceScenarioRunRow[]
  }>(fetch(`/api/acceptance-scenario-runs${query ? `?${query}` : ''}`))
  return acceptanceScenarioRuns
}

export interface RunTaskQueueTickBody {
  maxItems?: number
  enqueueDueContinuationPlans?: boolean
  now?: number
  continuationScanLimit?: number
  continuationPriority?: number
  budgetLimitCents?: number | null
}

export interface RunTaskQueueTickResult {
  queue: TaskQueueRow
  dueContinuationPlans: EnqueueDueContinuationPlansResult | null
  processed: {
    queue: TaskQueueRow
    started: number
    completed: number
    failed: number
    skipped: number
    items: TaskQueueItemRow[]
  }
}

export async function runTaskQueueTick(
  taskQueueId: string,
  body: RunTaskQueueTickBody,
): Promise<RunTaskQueueTickResult> {
  return json<RunTaskQueueTickResult>(
    fetch(`/api/task-queues/${taskQueueId}/tick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export interface CreateTaskScheduleBody {
  queueId: string
  name: string
  kind?: TaskScheduleKind
  status?: TaskScheduleStatus
  intervalMs: number
  nextRunAt?: number
  payload?: JsonObject
}

export async function fetchTaskSchedules(queueId?: string): Promise<TaskScheduleRow[]> {
  const qs = queueId ? `?queueId=${encodeURIComponent(queueId)}` : ''
  const { taskSchedules } = await json<{ taskSchedules: TaskScheduleRow[] }>(
    fetch(`/api/task-schedules${qs}`),
  )
  return taskSchedules
}

export async function createTaskSchedule(
  body: CreateTaskScheduleBody,
): Promise<TaskScheduleRow> {
  const { taskSchedule } = await json<{ taskSchedule: TaskScheduleRow }>(
    fetch('/api/task-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return taskSchedule
}

export interface RunDueTaskSchedulesBody {
  now?: number
  limit?: number
}

export interface TaskScheduleExecutionResultDto {
  schedule: TaskScheduleRow
  result: JsonObject | null
  error: string | null
}

export interface RunDueTaskSchedulesResultDto {
  now: number
  scanned: number
  ran: number
  failed: number
  results: TaskScheduleExecutionResultDto[]
}

export async function runDueTaskSchedules(
  body: RunDueTaskSchedulesBody,
): Promise<RunDueTaskSchedulesResultDto> {
  return json<RunDueTaskSchedulesResultDto>(
    fetch('/api/task-schedules/run-due', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchTaskQueueItems(queueId?: string): Promise<TaskQueueItemRow[]> {
  const qs = queueId ? `?queueId=${encodeURIComponent(queueId)}` : ''
  const { taskQueueItems } = await json<{ taskQueueItems: TaskQueueItemRow[] }>(
    fetch(`/api/task-queue-items${qs}`),
  )
  return taskQueueItems
}

export interface CreateIdempotencyRecordBody {
  key: string
  scope?: string
  resourceType: string
  resourceId?: string | null
  request: JsonObject
  expiresAt?: number | null
}

export async function fetchIdempotencyRecords(limit = 100): Promise<IdempotencyRecordRow[]> {
  const { idempotencyRecords } = await json<{ idempotencyRecords: IdempotencyRecordRow[] }>(
    fetch(`/api/idempotency-records?limit=${limit}`),
  )
  return idempotencyRecords
}

export async function createIdempotencyRecord(
  body: CreateIdempotencyRecordBody,
): Promise<IdempotencyRecordRow> {
  const { idempotencyRecord } = await json<{ idempotencyRecord: IdempotencyRecordRow }>(
    fetch('/api/idempotency-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return idempotencyRecord
}

export interface EmployeeRunRecoverySummary {
  run: EmployeeRunRow
  latestCheckpoint: RuntimeCheckpointRow | null
  contextSnapshots: RuntimeContextSnapshotRow[]
  runtimeEvents: EmployeeRunEventRow[]
  recoveryEvents: RecoveryEventRow[]
  canResume: boolean
  summary: string
}

export async function fetchEmployeeRunRecoverySummary(
  runId: string,
): Promise<EmployeeRunRecoverySummary> {
  return json<EmployeeRunRecoverySummary>(fetch(`/api/employee-runs/${runId}/recovery-summary`))
}

export async function fetchRecoveryEvents(params: {
  resourceType?: string
  resourceId?: string
} = {}): Promise<RecoveryEventRow[]> {
  const qs = new URLSearchParams()
  if (params.resourceType) qs.set('resourceType', params.resourceType)
  if (params.resourceId) qs.set('resourceId', params.resourceId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { recoveryEvents } = await json<{ recoveryEvents: RecoveryEventRow[] }>(
    fetch(`/api/recovery-events${suffix}`),
  )
  return recoveryEvents
}

export async function classifyRuntimeError(body: {
  resourceType?: string
  resourceId?: string
  agentProfileId?: string | null
  message: string
  context?: JsonObject
}): Promise<ErrorClassificationRow> {
  const { errorClassification } = await json<{ errorClassification: ErrorClassificationRow }>(
    fetch('/api/error-recovery/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return errorClassification
}

export async function recommendRecoveryStrategy(body: {
  category: ErrorTaxonomyCategory
  severity?: ErrorSeverity
  agentProfileId?: string | null
  context?: JsonObject
}): Promise<JsonObject> {
  const { recommendation } = await json<{ recommendation: JsonObject }>(
    fetch('/api/error-recovery/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return recommendation
}

export async function fetchErrorClassifications(params: {
  agentProfileId?: string
  resourceType?: string
  resourceId?: string
  category?: ErrorTaxonomyCategory
  severity?: ErrorSeverity
  limit?: number
} = {}): Promise<ErrorClassificationRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.resourceType) qs.set('resourceType', params.resourceType)
  if (params.resourceId) qs.set('resourceId', params.resourceId)
  if (params.category) qs.set('category', params.category)
  if (params.severity) qs.set('severity', params.severity)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { errorClassifications } = await json<{
    errorClassifications: ErrorClassificationRow[]
  }>(fetch(`/api/error-recovery/classifications${suffix}`))
  return errorClassifications
}

export async function recordRecoveryStrategyAttempt(body: {
  classificationId: string
  strategyType: RecoveryStrategyType
  strategyConfig?: JsonObject
  outcome: RecoveryStrategyOutcome
  durationMs?: number
  notes?: string
}): Promise<{
  attempt: RecoveryStrategyAttemptRow
  stats: RecoveryStrategyStatsRow
}> {
  return json<{
    attempt: RecoveryStrategyAttemptRow
    stats: RecoveryStrategyStatsRow
  }>(
    fetch('/api/error-recovery/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchRecoveryStrategyAttempts(params: {
  classificationId?: string
  agentProfileId?: string
  category?: ErrorTaxonomyCategory
  strategyType?: RecoveryStrategyType
  outcome?: RecoveryStrategyOutcome
  limit?: number
} = {}): Promise<RecoveryStrategyAttemptRow[]> {
  const qs = new URLSearchParams()
  if (params.classificationId) qs.set('classificationId', params.classificationId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.category) qs.set('category', params.category)
  if (params.strategyType) qs.set('strategyType', params.strategyType)
  if (params.outcome) qs.set('outcome', params.outcome)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { recoveryStrategyAttempts } = await json<{
    recoveryStrategyAttempts: RecoveryStrategyAttemptRow[]
  }>(fetch(`/api/error-recovery/attempts${suffix}`))
  return recoveryStrategyAttempts
}

export async function fetchRecoveryStrategyStats(params: {
  agentProfileId?: string
  category?: ErrorTaxonomyCategory
  strategyType?: RecoveryStrategyType
  limit?: number
} = {}): Promise<RecoveryStrategyStatsRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.category) qs.set('category', params.category)
  if (params.strategyType) qs.set('strategyType', params.strategyType)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { recoveryStrategyStats } = await json<{
    recoveryStrategyStats: RecoveryStrategyStatsRow[]
  }>(fetch(`/api/error-recovery/strategy-stats${suffix}`))
  return recoveryStrategyStats
}

export interface SendAgentMessageBody {
  senderAgentProfileId?: string | null
  recipientAgentProfileId?: string | null
  workflowRunId?: string | null
  employeeRunId?: string | null
  channel?: string
  messageType?: AgentMessageType
  content: JsonObject
}

export async function fetchAgentMessages(params: {
  channel?: string
  recipientAgentProfileId?: string
} = {}): Promise<InterAgentMessageRow[]> {
  const qs = new URLSearchParams()
  if (params.channel) qs.set('channel', params.channel)
  if (params.recipientAgentProfileId) {
    qs.set('recipientAgentProfileId', params.recipientAgentProfileId)
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { messages } = await json<{ messages: InterAgentMessageRow[] }>(
    fetch(`/api/collaboration/messages${suffix}`),
  )
  return messages
}

export async function sendAgentMessage(body: SendAgentMessageBody): Promise<InterAgentMessageRow> {
  const { message } = await json<{ message: InterAgentMessageRow }>(
    fetch('/api/collaboration/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return message
}

export async function fetchAgentCommunicationProtocols(params: {
  version?: string
  status?: AgentProtocolStatus
  limit?: number
} = {}): Promise<AgentCommunicationProtocolRow[]> {
  const qs = new URLSearchParams()
  if (params.version) qs.set('version', params.version)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { protocols } = await json<{ protocols: AgentCommunicationProtocolRow[] }>(
    fetch(`/api/agent-communication/protocols${suffix}`),
  )
  return protocols
}

export async function seedAgentCommunicationProtocol(): Promise<AgentCommunicationProtocolRow[]> {
  const { protocols } = await json<{ protocols: AgentCommunicationProtocolRow[] }>(
    fetch('/api/agent-communication/protocols/seed', {
      method: 'POST',
    }),
  )
  return protocols
}

export interface AgentProtocolMessageBody {
  protocolId?: string
  version?: string
  messageId?: string
  timestamp?: number
  ttl?: number
  header: {
    from: string
    to?: string | null
    type: AgentProtocolMessageType
    priority: AgentProtocolPriority
    replyTo?: string | null
  }
  body: {
    intent: string
    detail?: string
    context?: {
      artifacts?: string[]
      memories?: string[]
      files?: string[]
    }
    proposedAction?: JsonObject | null
  }
  signature?: string | null
}

export async function fetchAgentProtocolMessages(params: {
  fromAgentId?: string
  toAgentId?: string
  messageType?: AgentProtocolMessageType
  limit?: number
} = {}): Promise<AgentProtocolMessageRow[]> {
  const qs = new URLSearchParams()
  if (params.fromAgentId) qs.set('fromAgentId', params.fromAgentId)
  if (params.toAgentId) qs.set('toAgentId', params.toAgentId)
  if (params.messageType) qs.set('messageType', params.messageType)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { protocolMessages } = await json<{ protocolMessages: AgentProtocolMessageRow[] }>(
    fetch(`/api/agent-communication/messages${suffix}`),
  )
  return protocolMessages
}

export async function createAgentProtocolMessage(
  body: AgentProtocolMessageBody,
): Promise<AgentProtocolMessageRow> {
  const { protocolMessage } = await json<{ protocolMessage: AgentProtocolMessageRow }>(
    fetch('/api/agent-communication/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return protocolMessage
}

export async function validateAgentProtocolMessage(body: AgentProtocolMessageBody): Promise<{
  valid: boolean
  errors: string[]
}> {
  const { validation } = await json<{ validation: { valid: boolean; errors: string[] } }>(
    fetch('/api/agent-communication/messages/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return validation
}

export async function seedStreamProtocolChannels(): Promise<StreamProtocolChannelRow[]> {
  const { channels } = await json<{ channels: StreamProtocolChannelRow[] }>(
    fetch('/api/stream-protocol/seed', { method: 'POST' }),
  )
  return channels
}

export async function fetchStreamProtocolChannels(params: {
  status?: OpenSourceGovernanceStatus
  limit?: number
} = {}): Promise<StreamProtocolChannelRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { streamProtocolChannels } = await json<{
    streamProtocolChannels: StreamProtocolChannelRow[]
  }>(fetch(`/api/stream-protocol/channels${suffix}`))
  return streamProtocolChannels
}

export async function publishStreamProtocolEvent(body: {
  stream: string
  messageType: StreamProtocolMessageType
  data?: JsonObject
}): Promise<StreamProtocolEventRow> {
  const { event } = await json<{ event: StreamProtocolEventRow }>(
    fetch('/api/stream-protocol/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return event
}

export async function fetchStreamProtocolEvents(params: {
  stream?: string
  afterSequence?: number
  limit?: number
} = {}): Promise<StreamProtocolEventRow[]> {
  const qs = new URLSearchParams()
  if (params.stream) qs.set('stream', params.stream)
  if (params.afterSequence !== undefined) qs.set('afterSequence', String(params.afterSequence))
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { streamProtocolEvents } = await json<{
    streamProtocolEvents: StreamProtocolEventRow[]
  }>(fetch(`/api/stream-protocol/events${suffix}`))
  return streamProtocolEvents
}

export async function replayStreamProtocolEvents(body: {
  stream: string
  clientId: string
  lastSequence?: number
  transport?: 'websocket' | 'sse'
  disconnectedAt?: number | null
}): Promise<{ cursor: StreamReplayCursorRow; events: StreamProtocolEventRow[] }> {
  return json<{ cursor: StreamReplayCursorRow; events: StreamProtocolEventRow[] }>(
    fetch('/api/stream-protocol/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export interface WriteBlackboardEntryBody {
  scopeType: BlackboardScopeType
  scopeId: string
  key: string
  value: JsonObject
  authorAgentProfileId?: string | null
}

export async function fetchBlackboardEntries(params: {
  scopeType?: BlackboardScopeType
  scopeId?: string
} = {}): Promise<BlackboardEntryRow[]> {
  const qs = new URLSearchParams()
  if (params.scopeType) qs.set('scopeType', params.scopeType)
  if (params.scopeId) qs.set('scopeId', params.scopeId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { blackboardEntries } = await json<{ blackboardEntries: BlackboardEntryRow[] }>(
    fetch(`/api/collaboration/blackboard${suffix}`),
  )
  return blackboardEntries
}

export async function writeBlackboardEntry(
  body: WriteBlackboardEntryBody,
): Promise<BlackboardEntryRow> {
  const { blackboardEntry } = await json<{ blackboardEntry: BlackboardEntryRow }>(
    fetch('/api/collaboration/blackboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return blackboardEntry
}

export interface CreateAgentTeamDashboardBody {
  name?: string
  workflowRunId?: string | null
  agentProfileIds?: string[]
  blackboardScopeType?: BlackboardScopeType
  blackboardScopeId?: string
}

export async function createAgentTeamDashboardSnapshot(
  body: CreateAgentTeamDashboardBody,
): Promise<AgentTeamDashboardSnapshotRow> {
  const { snapshot } = await json<{ snapshot: AgentTeamDashboardSnapshotRow }>(
    fetch('/api/agent-team-dashboard-snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return snapshot
}

export async function fetchAgentTeamDashboardSnapshots(params: {
  workflowRunId?: string
  limit?: number
} = {}): Promise<AgentTeamDashboardSnapshotRow[]> {
  const qs = new URLSearchParams()
  if (params.workflowRunId) qs.set('workflowRunId', params.workflowRunId)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { snapshots } = await json<{ snapshots: AgentTeamDashboardSnapshotRow[] }>(
    fetch(`/api/agent-team-dashboard-snapshots${suffix}`),
  )
  return snapshots
}

export async function applyAgentTeamDashboardCommand(
  snapshotId: string,
  commandType: AgentTeamDashboardCommandType,
): Promise<AgentTeamDashboardCommandRow> {
  const { command } = await json<{ command: AgentTeamDashboardCommandRow }>(
    fetch(`/api/agent-team-dashboard-snapshots/${snapshotId}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commandType }),
    }),
  )
  return command
}

export async function fetchAgentTeamDashboardCommands(params: {
  dashboardSnapshotId?: string
  commandType?: AgentTeamDashboardCommandType
  limit?: number
} = {}): Promise<AgentTeamDashboardCommandRow[]> {
  const qs = new URLSearchParams()
  if (params.dashboardSnapshotId) qs.set('dashboardSnapshotId', params.dashboardSnapshotId)
  if (params.commandType) qs.set('commandType', params.commandType)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { commands } = await json<{ commands: AgentTeamDashboardCommandRow[] }>(
    fetch(`/api/agent-team-dashboard-commands${suffix}`),
  )
  return commands
}

export interface CreateCicdIntegrationBody {
  name: string
  platform: CicdPlatform
  mode: CicdMode
  agentProfileId?: string | null
  agentName: string
  task: string
  maxBudgetDollars?: number
  failOn?: CicdAgentConclusion
  outputArtifacts?: boolean
  postAsPrComment?: boolean
  autoFix?: boolean
  exitCodeMapping?: Record<string, number>
}

export interface TriggerCicdRunBody {
  triggerType?: CicdMode
  refName?: string
  commitSha?: string
  pullRequestNumber?: number | null
  agentConclusion?: CicdAgentConclusion
}

export async function createCicdIntegration(
  body: CreateCicdIntegrationBody,
): Promise<CicdIntegrationRow> {
  const { integration } = await json<{ integration: CicdIntegrationRow }>(
    fetch('/api/cicd/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return integration
}

export async function fetchCicdIntegrations(platform?: CicdPlatform): Promise<CicdIntegrationRow[]> {
  const qs = platform ? `?platform=${encodeURIComponent(platform)}` : ''
  const { integrations } = await json<{ integrations: CicdIntegrationRow[] }>(
    fetch(`/api/cicd/integrations${qs}`),
  )
  return integrations
}

export async function triggerCicdRun(
  integrationId: string,
  body: TriggerCicdRunBody,
): Promise<CicdRunRow> {
  const { run } = await json<{ run: CicdRunRow }>(
    fetch(`/api/cicd/integrations/${integrationId}/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return run
}

export async function fetchCicdRuns(integrationId?: string): Promise<CicdRunRow[]> {
  const qs = integrationId ? `?integrationId=${encodeURIComponent(integrationId)}` : ''
  const { runs } = await json<{ runs: CicdRunRow[] }>(fetch(`/api/cicd/runs${qs}`))
  return runs
}

export interface CapabilityNegotiationSnapshotDto {
  negotiation: CapabilityNegotiationRow
  events: CapabilityNegotiationEventRow[]
}

export interface CreateCapabilityNegotiationBody {
  requesterAgentProfileId: string
  workflowRunId?: string | null
  employeeRunId?: string | null
  taskGoal: string
  requiredCapabilities: string[]
  availableCapabilities?: string[]
  strategies?: Partial<CapabilityNegotiationStrategies>
  candidateAgentProfileIds?: string[]
}

export interface ResolveCapabilityNegotiationBody {
  strategy: CapabilityNegotiationStrategy
  explanation?: string
  installRequest?: CapabilityNegotiationResolution['installRequest']
  delegation?: CapabilityNegotiationResolution['delegation']
  alternative?: CapabilityNegotiationResolution['alternative']
  degradedScope?: CapabilityNegotiationResolution['degradedScope']
}

export async function createCapabilityNegotiation(
  body: CreateCapabilityNegotiationBody,
): Promise<CapabilityNegotiationSnapshotDto> {
  const { snapshot } = await json<{ snapshot: CapabilityNegotiationSnapshotDto }>(
    fetch('/api/capability-negotiations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return snapshot
}

export async function fetchCapabilityNegotiations(params: {
  requesterAgentProfileId?: string
  status?: CapabilityNegotiationStatus
  limit?: number
} = {}): Promise<CapabilityNegotiationRow[]> {
  const qs = new URLSearchParams()
  if (params.requesterAgentProfileId) qs.set('requesterAgentProfileId', params.requesterAgentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { negotiations } = await json<{ negotiations: CapabilityNegotiationRow[] }>(
    fetch(`/api/capability-negotiations${suffix}`),
  )
  return negotiations
}

export async function resolveCapabilityNegotiation(
  negotiationId: string,
  body: ResolveCapabilityNegotiationBody,
): Promise<CapabilityNegotiationSnapshotDto> {
  const { snapshot } = await json<{ snapshot: CapabilityNegotiationSnapshotDto }>(
    fetch(`/api/capability-negotiations/${negotiationId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return snapshot
}

export async function fetchCapabilityNegotiationEvents(params: {
  negotiationId?: string
  eventType?: CapabilityNegotiationEventType
  limit?: number
} = {}): Promise<CapabilityNegotiationEventRow[]> {
  const qs = new URLSearchParams()
  if (params.negotiationId) qs.set('negotiationId', params.negotiationId)
  if (params.eventType) qs.set('eventType', params.eventType)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { events } = await json<{ events: CapabilityNegotiationEventRow[] }>(
    fetch(`/api/capability-negotiation-events${suffix}`),
  )
  return events
}

export interface CreateConflictResolutionBody {
  resourceType: string
  resourceId: string
  conflictType: string
  participants?: string[]
  summary?: string
}

export async function fetchConflictResolutions(): Promise<ConflictResolutionRow[]> {
  const { conflictResolutions } = await json<{ conflictResolutions: ConflictResolutionRow[] }>(
    fetch('/api/collaboration/conflicts'),
  )
  return conflictResolutions
}

export async function createConflictResolution(
  body: CreateConflictResolutionBody,
): Promise<ConflictResolutionRow> {
  const { conflictResolution } = await json<{ conflictResolution: ConflictResolutionRow }>(
    fetch('/api/collaboration/conflicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return conflictResolution
}

export async function resolveConflictResolution(
  id: string,
  resolution: JsonObject,
): Promise<ConflictResolutionRow> {
  const { conflictResolution } = await json<{ conflictResolution: ConflictResolutionRow }>(
    fetch(`/api/collaboration/conflicts/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    }),
  )
  return conflictResolution
}

export async function fetchConflictEscalations(
  conflictResolutionId?: string,
): Promise<ConflictEscalationRow[]> {
  const qs = conflictResolutionId
    ? `?conflictResolutionId=${encodeURIComponent(conflictResolutionId)}`
    : ''
  const { conflictEscalations } = await json<{ conflictEscalations: ConflictEscalationRow[] }>(
    fetch(`/api/collaboration/conflict-escalations${qs}`),
  )
  return conflictEscalations
}

export async function advanceConflictEscalation(
  conflictResolutionId: string,
  body: { reason?: string; forceLevel?: number } = {},
): Promise<{
  conflictResolution: ConflictResolutionRow
  escalation: ConflictEscalationRow
  escalations: ConflictEscalationRow[]
}> {
  return json<{
    conflictResolution: ConflictResolutionRow
    escalation: ConflictEscalationRow
    escalations: ConflictEscalationRow[]
  }>(
    fetch(`/api/collaboration/conflicts/${conflictResolutionId}/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export interface CreateRealtimeCollabSessionBody {
  documentPath: string
  protocol?: RealtimeCollabProtocol
  conflictResolution?: RealtimeCollabResolution
  showAgentCursor?: boolean
  showAgentSelection?: boolean
  agentAwareOfUserEdits?: boolean
  createdBy?: string | null
}

export interface AcquireRealtimeSegmentLockBody {
  sessionId: string
  employeeRunId?: string | null
  agentProfileId?: string | null
  participantType: RealtimeParticipantType
  participantId?: string | null
  filePath?: string | null
  startLine: number
  endLine: number
  cursorLine?: number | null
  cursorColumn?: number | null
  expiresAt?: number | null
}

export interface ApplyRealtimeEditOperationBody {
  sessionId: string
  segmentLockId?: string | null
  participantType: RealtimeParticipantType
  participantId?: string | null
  filePath?: string | null
  operationKind: RealtimeEditOperationKind
  startLine: number
  endLine: number
  baseVersion: number
  newText?: string | null
}

export async function fetchRealtimeCollabSessions(): Promise<RealtimeCollabSessionRow[]> {
  const { realtimeCollabSessions } = await json<{
    realtimeCollabSessions: RealtimeCollabSessionRow[]
  }>(fetch('/api/collaboration/realtime-sessions'))
  return realtimeCollabSessions
}

export async function createRealtimeCollabSession(
  body: CreateRealtimeCollabSessionBody,
): Promise<RealtimeCollabSessionRow> {
  const { realtimeCollabSession } = await json<{
    realtimeCollabSession: RealtimeCollabSessionRow
  }>(
    fetch('/api/collaboration/realtime-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return realtimeCollabSession
}

export async function fetchRealtimeSegmentLocks(sessionId?: string): Promise<RealtimeSegmentLockRow[]> {
  const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
  const { realtimeSegmentLocks } = await json<{
    realtimeSegmentLocks: RealtimeSegmentLockRow[]
  }>(fetch(`/api/collaboration/realtime-segment-locks${qs}`))
  return realtimeSegmentLocks
}

export async function acquireRealtimeSegmentLock(
  body: AcquireRealtimeSegmentLockBody,
): Promise<{
  segmentLock: RealtimeSegmentLockRow
  conflicts: RealtimeSegmentLockRow[]
  conflictResolution: ConflictResolutionRow | null
}> {
  return json<{
    segmentLock: RealtimeSegmentLockRow
    conflicts: RealtimeSegmentLockRow[]
    conflictResolution: ConflictResolutionRow | null
  }>(
    fetch('/api/collaboration/realtime-segment-locks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function releaseRealtimeSegmentLock(id: string): Promise<RealtimeSegmentLockRow> {
  const { realtimeSegmentLock } = await json<{
    realtimeSegmentLock: RealtimeSegmentLockRow
  }>(fetch(`/api/collaboration/realtime-segment-locks/${id}/release`, { method: 'POST' }))
  return realtimeSegmentLock
}

export async function fetchRealtimeEditOperations(sessionId?: string): Promise<RealtimeEditOperationRow[]> {
  const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
  const { realtimeEditOperations } = await json<{
    realtimeEditOperations: RealtimeEditOperationRow[]
  }>(fetch(`/api/collaboration/realtime-edit-operations${qs}`))
  return realtimeEditOperations
}

export async function applyRealtimeEditOperation(
  body: ApplyRealtimeEditOperationBody,
): Promise<RealtimeEditOperationRow> {
  const { realtimeEditOperation } = await json<{
    realtimeEditOperation: RealtimeEditOperationRow
  }>(
    fetch('/api/collaboration/realtime-edit-operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return realtimeEditOperation
}

export interface RecordMetricPointBody {
  metricName: string
  value: number
  unit?: string
  resourceType?: string | null
  resourceId?: string | null
  tags?: JsonObject
}

export async function fetchMetricPoints(metricName?: string): Promise<MetricPointRow[]> {
  const qs = metricName ? `?metricName=${encodeURIComponent(metricName)}` : ''
  const { metricPoints } = await json<{ metricPoints: MetricPointRow[] }>(
    fetch(`/api/observability/metrics${qs}`),
  )
  return metricPoints
}

export async function recordMetricPoint(body: RecordMetricPointBody): Promise<{
  metricPoint: MetricPointRow
  alertEvents: AlertEventRow[]
}> {
  return json<{ metricPoint: MetricPointRow; alertEvents: AlertEventRow[] }>(
    fetch('/api/observability/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export interface CreateExternalMonitoringConfigBody {
  name: string
  metricsEndpoint?: string
  healthEndpoint?: string
  readyEndpoint?: string
  logExport?: ExternalMonitoringLogExport
  status?: ExternalMonitoringStatus
}

export async function createExternalMonitoringConfig(
  body: CreateExternalMonitoringConfigBody,
): Promise<ExternalMonitoringConfigRow> {
  const { config } = await json<{ config: ExternalMonitoringConfigRow }>(
    fetch('/api/external-monitoring/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return config
}

export async function fetchExternalMonitoringConfigs(
  status?: ExternalMonitoringStatus,
): Promise<ExternalMonitoringConfigRow[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  const { configs } = await json<{ configs: ExternalMonitoringConfigRow[] }>(
    fetch(`/api/external-monitoring/configs${qs}`),
  )
  return configs
}

export async function fetchPrometheusMetricsText(): Promise<string> {
  const response = await fetch('/metrics')
  if (!response.ok) throw new Error(await response.text())
  return response.text()
}

export async function fetchHealthProbe(): Promise<JsonObject> {
  return json<JsonObject>(fetch('/health'))
}

export async function fetchReadyProbe(): Promise<JsonObject> {
  return json<JsonObject>(fetch('/ready'))
}

export interface CreateAlertRuleBody {
  name: string
  metricName: string
  comparison?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
  threshold: number
  severity?: NotificationLevel
  enabled?: boolean
  cooldownMs?: number
}

export async function fetchAlertRules(): Promise<AlertRuleRow[]> {
  const { alertRules } = await json<{ alertRules: AlertRuleRow[] }>(
    fetch('/api/observability/alert-rules'),
  )
  return alertRules
}

export async function createAlertRule(body: CreateAlertRuleBody): Promise<AlertRuleRow> {
  const { alertRule } = await json<{ alertRule: AlertRuleRow }>(
    fetch('/api/observability/alert-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return alertRule
}

export async function fetchAlertEvents(status?: AlertEventRow['status']): Promise<AlertEventRow[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  const { alertEvents } = await json<{ alertEvents: AlertEventRow[] }>(
    fetch(`/api/observability/alert-events${qs}`),
  )
  return alertEvents
}

export async function fetchDebugReplaySnapshots(params: {
  resourceType?: string
  resourceId?: string
} = {}): Promise<DebugReplaySnapshotRow[]> {
  const qs = new URLSearchParams()
  if (params.resourceType) qs.set('resourceType', params.resourceType)
  if (params.resourceId) qs.set('resourceId', params.resourceId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { debugReplaySnapshots } = await json<{ debugReplaySnapshots: DebugReplaySnapshotRow[] }>(
    fetch(`/api/observability/debug-replay${suffix}`),
  )
  return debugReplaySnapshots
}

export async function createEmployeeRunDebugReplay(
  employeeRunId: string,
): Promise<DebugReplaySnapshotRow> {
  const { debugReplaySnapshot } = await json<{ debugReplaySnapshot: DebugReplaySnapshotRow }>(
    fetch(`/api/employee-runs/${employeeRunId}/debug-replay`, { method: 'POST' }),
  )
  return debugReplaySnapshot
}

export interface EmployeeRunDebugPackageFileDto {
  path: string
  contentType: string
  bytes: number
}

export interface EmployeeRunDebugPackageDto {
  fileName: string
  generatedAt: number
  resourceType: 'employee_run'
  resourceId: string
  diagnostics: JsonObject
  files: EmployeeRunDebugPackageFileDto[]
}

export async function fetchEmployeeRunDebugPackageManifest(
  employeeRunId: string,
): Promise<EmployeeRunDebugPackageDto> {
  const { debugPackage } = await json<{ debugPackage: EmployeeRunDebugPackageDto }>(
    fetch(`/api/employee-runs/${employeeRunId}/debug-package?format=json`),
  )
  return debugPackage
}

export function employeeRunDebugPackageUrl(employeeRunId: string): string {
  return `/api/employee-runs/${employeeRunId}/debug-package`
}

export async function fetchAgentHealthScores(agentProfileId?: string): Promise<AgentHealthScoreRow[]> {
  const qs = agentProfileId ? `?agentProfileId=${encodeURIComponent(agentProfileId)}` : ''
  const { agentHealthScores } = await json<{ agentHealthScores: AgentHealthScoreRow[] }>(
    fetch(`/api/observability/agent-health${qs}`),
  )
  return agentHealthScores
}

export async function computeAgentHealthScore(agentProfileId: string): Promise<AgentHealthScoreRow> {
  const { agentHealthScore } = await json<{ agentHealthScore: AgentHealthScoreRow }>(
    fetch(`/api/agent-profiles/${agentProfileId}/health-score`, { method: 'POST' }),
  )
  return agentHealthScore
}

export interface AgentReputationLeaderboardEntryDto {
  rank: number
  agent: Pick<AgentProfileRow, 'id' | 'name' | 'role' | 'status'> | null
  snapshot: AgentReputationSnapshotRow
  deltaScore: number
  successRate: number
  averageCostPerTaskCents: number
}

export interface AgentReputationLeaderboardDto {
  monthLabel: string
  entries: AgentReputationLeaderboardEntryDto[]
  topAgent: AgentReputationLeaderboardEntryDto | null
  fastestImprover: AgentReputationLeaderboardEntryDto | null
  needsAttention: AgentReputationLeaderboardEntryDto[]
}

export async function fetchAgentReputations(args: {
  agentProfileId?: string
  monthLabel?: string
  limit?: number
} = {}): Promise<AgentReputationSnapshotRow[]> {
  const qs = new URLSearchParams()
  if (args.agentProfileId) qs.set('agentProfileId', args.agentProfileId)
  if (args.monthLabel) qs.set('monthLabel', args.monthLabel)
  if (args.limit) qs.set('limit', String(args.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { agentReputationSnapshots } = await json<{
    agentReputationSnapshots: AgentReputationSnapshotRow[]
  }>(fetch(`/api/agent-reputations${suffix}`))
  return agentReputationSnapshots
}

export async function computeAgentReputation(
  agentProfileId: string,
  body: { monthLabel?: string } = {},
): Promise<AgentReputationSnapshotRow> {
  const { agentReputationSnapshot } = await json<{
    agentReputationSnapshot: AgentReputationSnapshotRow
  }>(
    fetch(`/api/agent-profiles/${agentProfileId}/reputation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return agentReputationSnapshot
}

export async function fetchAgentReputationReviews(
  agentProfileId: string,
): Promise<AgentReputationReviewRow[]> {
  const { agentReputationReviews } = await json<{
    agentReputationReviews: AgentReputationReviewRow[]
  }>(fetch(`/api/agent-profiles/${agentProfileId}/reputation-reviews`))
  return agentReputationReviews
}

export async function createAgentReputationReview(
  agentProfileId: string,
  body: {
    taskId?: string
    employeeRunId?: string | null
    userRating: number
    autoScore?: number
    comment?: string | null
    reviewer?: string
  },
): Promise<AgentReputationReviewRow> {
  const { agentReputationReview } = await json<{
    agentReputationReview: AgentReputationReviewRow
  }>(
    fetch(`/api/agent-profiles/${agentProfileId}/reputation-reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return agentReputationReview
}

export async function fetchAgentReputationLeaderboard(args: {
  monthLabel?: string
  limit?: number
} = {}): Promise<AgentReputationLeaderboardDto> {
  const qs = new URLSearchParams()
  if (args.monthLabel) qs.set('monthLabel', args.monthLabel)
  if (args.limit) qs.set('limit', String(args.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { agentReputationLeaderboard } = await json<{
    agentReputationLeaderboard: AgentReputationLeaderboardDto
  }>(fetch(`/api/agent-reputations/leaderboard${suffix}`))
  return agentReputationLeaderboard
}

export async function refreshAgentReputationLeaderboard(body: {
  monthLabel?: string
  limit?: number
} = {}): Promise<{
  agentReputationSnapshots: AgentReputationSnapshotRow[]
  agentReputationLeaderboard: AgentReputationLeaderboardDto
}> {
  return json<{
    agentReputationSnapshots: AgentReputationSnapshotRow[]
    agentReputationLeaderboard: AgentReputationLeaderboardDto
  }>(
    fetch('/api/agent-reputations/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export interface CreateNotificationBody {
  channel?: NotificationChannel
  level?: NotificationLevel
  sourceType: string
  sourceId?: string | null
  title: string
  message?: string
  payload?: JsonObject
}

export async function fetchNotifications(status?: NotificationRow['status']): Promise<NotificationRow[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  const { notifications } = await json<{ notifications: NotificationRow[] }>(
    fetch(`/api/notifications${qs}`),
  )
  return notifications
}

export async function createNotification(body: CreateNotificationBody): Promise<NotificationRow> {
  const { notification } = await json<{ notification: NotificationRow }>(
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return notification
}

export async function markNotificationRead(id: string): Promise<NotificationRow> {
  const { notification } = await json<{ notification: NotificationRow }>(
    fetch(`/api/notifications/${id}/read`, { method: 'POST' }),
  )
  return notification
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferenceRow[]> {
  const { notificationPreferences } = await json<{
    notificationPreferences: NotificationPreferenceRow[]
  }>(fetch('/api/notification-preferences'))
  return notificationPreferences
}

export interface UpsertNotificationPreferenceBody {
  channel: NotificationChannel
  enabled?: boolean
  minLevel?: NotificationLevel
}

export async function upsertNotificationPreference(
  body: UpsertNotificationPreferenceBody,
): Promise<NotificationPreferenceRow> {
  const { notificationPreference } = await json<{
    notificationPreference: NotificationPreferenceRow
  }>(
    fetch('/api/notification-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return notificationPreference
}

export interface CapabilitySearchResultDto {
  entry: CapabilityIndexEntryRow
  score: number
  reason: string
  matchedKeywords: string[]
}

export interface CapabilityRecommendationResultDto {
  recommendation: CapabilityRecommendationRow
  entry: CapabilityIndexEntryRow
  score: number
  reason: string
}

export interface ApplyCapabilityRecommendationResultDto {
  recommendation: CapabilityRecommendationRow
  agentProfile: AgentProfileRow
  entry: CapabilityIndexEntryRow
  appliedChanges: string[]
}

export async function fetchCapabilityIndexEntries(
  sourceType?: CapabilitySourceType,
): Promise<CapabilityIndexEntryRow[]> {
  const qs = sourceType ? `?sourceType=${encodeURIComponent(sourceType)}` : ''
  const { capabilityIndexEntries } = await json<{
    capabilityIndexEntries: CapabilityIndexEntryRow[]
  }>(fetch(`/api/capabilities${qs}`))
  return capabilityIndexEntries
}

export async function rebuildCapabilityIndex(): Promise<CapabilityIndexEntryRow[]> {
  const { capabilityIndexEntries } = await json<{
    capabilityIndexEntries: CapabilityIndexEntryRow[]
  }>(fetch('/api/capabilities', { method: 'POST' }))
  return capabilityIndexEntries
}

export async function searchCapabilities(body: {
  query?: string
  limit?: number
}): Promise<CapabilitySearchResultDto[]> {
  const { capabilitySearchResults } = await json<{
    capabilitySearchResults: CapabilitySearchResultDto[]
  }>(
    fetch('/api/capabilities/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return capabilitySearchResults
}

export async function fetchCapabilityKnowledgeGraph(): Promise<{
  nodes: KnowledgeGraphNodeRow[]
  edges: KnowledgeGraphEdgeRow[]
}> {
  return json<{ nodes: KnowledgeGraphNodeRow[]; edges: KnowledgeGraphEdgeRow[] }>(
    fetch('/api/capabilities/knowledge-graph'),
  )
}

export type KnowledgeGraphQueryScenario =
  | 'general'
  | 'error_solution'
  | 'customer_preference'
  | 'software_command'

export interface StructuredKnowledgeGraphDto {
  nodes: KnowledgeGraphNodeRow[]
  edges: KnowledgeGraphEdgeRow[]
}

export interface KnowledgeGraphRebuildDto extends StructuredKnowledgeGraphDto {
  summary: {
    memoryCount: number
    softwareProfileCount: number
    softwareCommandCount: number
    softwareCommandRunCount: number
    nodeCount: number
    edgeCount: number
  }
}

export interface KnowledgeGraphNodeMatchDto {
  node: KnowledgeGraphNodeRow
  score: number
  reason: string
  matchedTerms: string[]
}

export interface KnowledgeGraphPathDto {
  scenario: KnowledgeGraphQueryScenario
  fromNode: KnowledgeGraphNodeRow
  edge: KnowledgeGraphEdgeRow
  toNode: KnowledgeGraphNodeRow
  score: number
  evidence: JsonObject
  explanation: string
}

export interface KnowledgeGraphQueryResultDto {
  query: string
  scenario: KnowledgeGraphQueryScenario
  matches: KnowledgeGraphNodeMatchDto[]
  paths: KnowledgeGraphPathDto[]
}

export async function fetchStructuredKnowledgeGraph(params: {
  nodeType?: KnowledgeNodeType
  relation?: KnowledgeEdgeType
  limitNodes?: number
  limitEdges?: number
} = {}): Promise<StructuredKnowledgeGraphDto> {
  const qs = new URLSearchParams()
  if (params.nodeType) qs.set('nodeType', params.nodeType)
  if (params.relation) qs.set('relation', params.relation)
  if (params.limitNodes) qs.set('limitNodes', String(params.limitNodes))
  if (params.limitEdges) qs.set('limitEdges', String(params.limitEdges))
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { graph } = await json<{ graph: StructuredKnowledgeGraphDto }>(
    fetch(`/api/knowledge-graph${suffix}`),
  )
  return graph
}

export async function rebuildStructuredKnowledgeGraph(body: {
  limit?: number
  includeExpired?: boolean
} = {}): Promise<KnowledgeGraphRebuildDto> {
  const { graph } = await json<{ graph: KnowledgeGraphRebuildDto }>(
    fetch('/api/knowledge-graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return graph
}

export async function queryStructuredKnowledgeGraph(body: {
  query: string
  scenario?: KnowledgeGraphQueryScenario
  limit?: number
}): Promise<KnowledgeGraphQueryResultDto> {
  const { result } = await json<{ result: KnowledgeGraphQueryResultDto }>(
    fetch('/api/knowledge-graph/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchCapabilityRecommendations(
  agentProfileId: string,
): Promise<CapabilityRecommendationRow[]> {
  const { capabilityRecommendations } = await json<{
    capabilityRecommendations: CapabilityRecommendationRow[]
  }>(fetch(`/api/agent-profiles/${agentProfileId}/capability-recommendations`))
  return capabilityRecommendations
}

export async function recommendCapabilitiesForAgent(
  agentProfileId: string,
  body: { goal: string; limit?: number },
): Promise<CapabilityRecommendationResultDto[]> {
  const { capabilityRecommendationResults } = await json<{
    capabilityRecommendationResults: CapabilityRecommendationResultDto[]
  }>(
    fetch(`/api/agent-profiles/${agentProfileId}/capability-recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return capabilityRecommendationResults
}

export async function applyCapabilityRecommendation(
  recommendationId: string,
): Promise<ApplyCapabilityRecommendationResultDto> {
  return json<ApplyCapabilityRecommendationResultDto>(
    fetch(`/api/capability-recommendations/${recommendationId}/apply`, {
      method: 'POST',
    }),
  )
}

export interface CaptureConfigVersionBody {
  entityType: ConfigEntityType
  entityId: string
  source?: 'manual' | 'api' | 'runtime_snapshot' | 'gitops_export'
  changeSummary?: string
  createdBy?: string | null
}

export interface ApplyConfigVersionBody {
  appliedBy?: string | null
  changeSummary?: string
}

export interface ApplyConfigVersionResultDto {
  appliedVersion: ConfigVersionRow
  rollbackVersion: ConfigVersionRow
  entityType: ConfigEntityType
  entityId: string
  displayName: string
  appliedHash: string
  rollbackHash: string
  changed: boolean
  summary: string
}

export async function fetchConfigVersions(params: {
  entityType?: ConfigEntityType
  entityId?: string
  limit?: number
} = {}): Promise<ConfigVersionRow[]> {
  const qs = new URLSearchParams()
  if (params.entityType) qs.set('entityType', params.entityType)
  if (params.entityId) qs.set('entityId', params.entityId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { configVersions } = await json<{ configVersions: ConfigVersionRow[] }>(
    fetch(`/api/config-versions${suffix}`),
  )
  return configVersions
}

export async function captureConfigVersion(
  body: CaptureConfigVersionBody,
): Promise<ConfigVersionRow> {
  const { configVersion } = await json<{ configVersion: ConfigVersionRow }>(
    fetch('/api/config-versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return configVersion
}

export async function applyConfigVersion(
  configVersionId: string,
  body: ApplyConfigVersionBody = {},
): Promise<ApplyConfigVersionResultDto> {
  return json<ApplyConfigVersionResultDto>(
    fetch(`/api/config-versions/${configVersionId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export interface ConfigEntityRefBody {
  entityType: ConfigEntityType
  entityId: string
  versionId?: string | null
}

export interface CreateConfigExportBody {
  name: string
  format?: ConfigExportFormat
  entityRefs: ConfigEntityRefBody[]
}

export async function fetchConfigExports(limit = 100): Promise<ConfigExportRow[]> {
  const { configExports } = await json<{ configExports: ConfigExportRow[] }>(
    fetch(`/api/config-exports?limit=${limit}`),
  )
  return configExports
}

export async function createConfigExport(
  body: CreateConfigExportBody,
): Promise<ConfigExportRow> {
  const { configExport } = await json<{ configExport: ConfigExportRow }>(
    fetch('/api/config-exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return configExport
}

export interface AnalyzeConfigImpactBody {
  entityType: ConfigEntityType
  entityId: string
  baseVersionId?: string | null
  proposedSnapshot?: JsonObject | null
}

export async function fetchConfigImpactAnalyses(params: {
  entityType?: ConfigEntityType
  entityId?: string
  limit?: number
} = {}): Promise<ConfigImpactAnalysisRow[]> {
  const qs = new URLSearchParams()
  if (params.entityType) qs.set('entityType', params.entityType)
  if (params.entityId) qs.set('entityId', params.entityId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { configImpactAnalyses } = await json<{
    configImpactAnalyses: ConfigImpactAnalysisRow[]
  }>(fetch(`/api/config-impact-analyses${suffix}`))
  return configImpactAnalyses
}

export async function analyzeConfigImpact(
  body: AnalyzeConfigImpactBody,
): Promise<ConfigImpactAnalysisRow> {
  const { configImpactAnalysis } = await json<{
    configImpactAnalysis: ConfigImpactAnalysisRow
  }>(
    fetch('/api/config-impact-analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return configImpactAnalysis
}

export interface EvaluateAutonomyActionBody {
  agentProfileId?: string | null
  actionType: AutonomyActionType
  resourceType: string
  resourceId?: string | null
  requestedMode?: string
  riskLevel?: RiskLevel
  payload?: JsonObject
}

export interface RequestDynamicPermissionBody {
  agentProfileId: string
  employeeRunId?: string | null
  permissionKey: string
  resourceType: string
  resourceId?: string | null
  duration?: DynamicPermissionDuration
  justification?: string
  riskLevel?: RiskLevel
  payload?: JsonObject
}

export async function fetchAutonomyDecisions(params: {
  agentProfileId?: string
  resourceType?: string
  resourceId?: string
  limit?: number
} = {}): Promise<AutonomyDecisionRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.resourceType) qs.set('resourceType', params.resourceType)
  if (params.resourceId) qs.set('resourceId', params.resourceId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { autonomyDecisions } = await json<{ autonomyDecisions: AutonomyDecisionRow[] }>(
    fetch(`/api/autonomy/decisions${suffix}`),
  )
  return autonomyDecisions
}

export async function fetchDynamicPermissionGrants(params: {
  agentProfileId?: string
  employeeRunId?: string
  permissionKey?: string
  status?: DynamicPermissionGrantStatus
  limit?: number
} = {}): Promise<DynamicPermissionGrantRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.employeeRunId) qs.set('employeeRunId', params.employeeRunId)
  if (params.permissionKey) qs.set('permissionKey', params.permissionKey)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { dynamicPermissionGrants } = await json<{
    dynamicPermissionGrants: DynamicPermissionGrantRow[]
  }>(fetch(`/api/autonomy/dynamic-permissions${suffix}`))
  return dynamicPermissionGrants
}

export async function requestDynamicPermission(
  body: RequestDynamicPermissionBody,
): Promise<DynamicPermissionGrantRow> {
  const { dynamicPermissionGrant } = await json<{
    dynamicPermissionGrant: DynamicPermissionGrantRow
  }>(
    fetch('/api/autonomy/dynamic-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return dynamicPermissionGrant
}

export async function revokeDynamicPermissionGrant(
  id: string,
  reason?: string,
): Promise<DynamicPermissionGrantRow> {
  const { dynamicPermissionGrant } = await json<{
    dynamicPermissionGrant: DynamicPermissionGrantRow
  }>(
    fetch(`/api/autonomy/dynamic-permissions/${id}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }),
  )
  return dynamicPermissionGrant
}

export async function downgradeDynamicPermissions(body: {
  agentProfileId?: string
  employeeRunId?: string
  permissionKeys?: string[]
  reason: string
}): Promise<DynamicPermissionGrantRow[]> {
  const { dynamicPermissionGrants } = await json<{
    dynamicPermissionGrants: DynamicPermissionGrantRow[]
  }>(
    fetch('/api/autonomy/dynamic-permissions/downgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return dynamicPermissionGrants
}

export interface CreateVoiceInterfaceProfileBody {
  agentProfileId?: string | null
  input?: {
    mode?: VoiceInputMode
    wakeWord?: string | null
    language?: string
    speakerIdentification?: boolean
  }
  output?: {
    ttsEngine?: TtsEngine
    voice?: string
    speed?: number
    speakOn?: VoiceSpeakOn[]
  }
  conversationPolicy?: JsonObject
  status?: VoiceProfileStatus
}

export interface RecordVoiceConversationTurnBody {
  voiceInterfaceProfileId?: string | null
  agentProfileId?: string | null
  speaker: VoiceConversationSpeaker
  speakerLabel?: string
  text: string
  language?: string
  source?: string
  status?: VoiceConversationTurnStatus
  metadata?: JsonObject
}

export interface VoiceConversationTurnsDto {
  voiceConversationTurns: VoiceConversationTurnRow[]
  context: JsonObject
}

export async function fetchVoiceInterfaceProfiles(params: {
  agentProfileId?: string
  status?: VoiceProfileStatus
  limit?: number
} = {}): Promise<VoiceInterfaceProfileRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { voiceInterfaceProfiles } = await json<{
    voiceInterfaceProfiles: VoiceInterfaceProfileRow[]
  }>(fetch(`/api/voice-interface/profiles${suffix}`))
  return voiceInterfaceProfiles
}

export async function createVoiceInterfaceProfile(
  body: CreateVoiceInterfaceProfileBody,
): Promise<VoiceInterfaceProfileRow> {
  const { voiceInterfaceProfile } = await json<{
    voiceInterfaceProfile: VoiceInterfaceProfileRow
  }>(
    fetch('/api/voice-interface/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return voiceInterfaceProfile
}

export async function fetchVoiceConversationTurns(params: {
  voiceInterfaceProfileId?: string
  agentProfileId?: string
  limit?: number
} = {}): Promise<VoiceConversationTurnsDto> {
  const qs = new URLSearchParams()
  if (params.voiceInterfaceProfileId) qs.set('voiceInterfaceProfileId', params.voiceInterfaceProfileId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return json<VoiceConversationTurnsDto>(
    fetch(`/api/voice-interface/conversation-turns${suffix}`),
  )
}

export async function recordVoiceConversationTurn(
  body: RecordVoiceConversationTurnBody,
): Promise<VoiceConversationTurnRow> {
  const { voiceConversationTurn } = await json<{
    voiceConversationTurn: VoiceConversationTurnRow
  }>(
    fetch('/api/voice-interface/conversation-turns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return voiceConversationTurn
}

export interface CreateE2EEncryptionPolicyBody {
  name: string
  localIPC?: {
    encryption?: LocalIpcEncryption
  }
  remoteCommunication?: {
    encryption?: 'tls_1_3'
    certificatePinning?: boolean
    mutualTLS?: boolean
  }
  dataExport?: {
    encryptExport?: boolean
    passwordProtected?: boolean
  }
  notes?: string
  status?: E2EEncryptionPolicyStatus
}

export interface EvaluateE2EEncryptionBody {
  policyId: string
  scope: E2EEncryptionCheckScope
  resourceType: string
  resourceId?: string | null
  observed?: JsonObject
}

export async function fetchE2EEncryptionPolicies(params: {
  status?: E2EEncryptionPolicyStatus
  limit?: number
} = {}): Promise<E2EEncryptionPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { e2eEncryptionPolicies } = await json<{
    e2eEncryptionPolicies: E2EEncryptionPolicyRow[]
  }>(fetch(`/api/e2e-encryption/policies${suffix}`))
  return e2eEncryptionPolicies
}

export async function createE2EEncryptionPolicy(
  body: CreateE2EEncryptionPolicyBody,
): Promise<E2EEncryptionPolicyRow> {
  const { e2eEncryptionPolicy } = await json<{
    e2eEncryptionPolicy: E2EEncryptionPolicyRow
  }>(
    fetch('/api/e2e-encryption/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return e2eEncryptionPolicy
}

export async function fetchE2EEncryptionChecks(params: {
  policyId?: string
  scope?: E2EEncryptionCheckScope
  status?: E2EEncryptionCheckStatus
  limit?: number
} = {}): Promise<E2EEncryptionCheckRow[]> {
  const qs = new URLSearchParams()
  if (params.policyId) qs.set('policyId', params.policyId)
  if (params.scope) qs.set('scope', params.scope)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { e2eEncryptionChecks } = await json<{
    e2eEncryptionChecks: E2EEncryptionCheckRow[]
  }>(fetch(`/api/e2e-encryption/checks${suffix}`))
  return e2eEncryptionChecks
}

export async function evaluateE2EEncryption(
  body: EvaluateE2EEncryptionBody,
): Promise<E2EEncryptionCheckRow> {
  const { e2eEncryptionCheck } = await json<{
    e2eEncryptionCheck: E2EEncryptionCheckRow
  }>(
    fetch('/api/e2e-encryption/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return e2eEncryptionCheck
}

export interface CreateConcurrencyProfileBody {
  name: string
  theoreticalMax?: {
    maxProcesses?: number
    maxFileDescriptors?: number
    maxMemoryBytes?: number
    maxBrowserInstances?: number
    maxModelConnections?: number
  }
  recommended?: {
    lowMemory?: { maxAgents: number; maxBrowsers: number }
    midMemory?: { maxAgents: number; maxBrowsers: number }
    highMemory?: { maxAgents: number; maxBrowsers: number }
    workstation?: { maxAgents: number; maxBrowsers: number }
  }
  adaptiveLimit?: boolean
  status?: ConcurrencyProfileStatus
}

export interface EvaluateConcurrencyBody {
  concurrencyProfileId: string
  currentAgents?: number
  currentBrowsers?: number
  currentModelConnections?: number
  totalMemoryBytes?: number
  usedMemoryBytes?: number
}

export async function fetchConcurrencyProfiles(params: {
  status?: ConcurrencyProfileStatus
  limit?: number
} = {}): Promise<ConcurrencyProfileRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { concurrencyProfiles } = await json<{
    concurrencyProfiles: ConcurrencyProfileRow[]
  }>(fetch(`/api/concurrency/profiles${suffix}`))
  return concurrencyProfiles
}

export async function createConcurrencyProfile(
  body: CreateConcurrencyProfileBody,
): Promise<ConcurrencyProfileRow> {
  const { concurrencyProfile } = await json<{
    concurrencyProfile: ConcurrencyProfileRow
  }>(
    fetch('/api/concurrency/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return concurrencyProfile
}

export async function fetchConcurrencyEvaluations(params: {
  concurrencyProfileId?: string
  status?: ConcurrencyEvaluationStatus
  limit?: number
} = {}): Promise<ConcurrencyEvaluationRow[]> {
  const qs = new URLSearchParams()
  if (params.concurrencyProfileId) qs.set('concurrencyProfileId', params.concurrencyProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { concurrencyEvaluations } = await json<{
    concurrencyEvaluations: ConcurrencyEvaluationRow[]
  }>(fetch(`/api/concurrency/evaluations${suffix}`))
  return concurrencyEvaluations
}

export async function evaluateConcurrency(
  body: EvaluateConcurrencyBody,
): Promise<ConcurrencyEvaluationRow> {
  const { concurrencyEvaluation } = await json<{
    concurrencyEvaluation: ConcurrencyEvaluationRow
  }>(
    fetch('/api/concurrency/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return concurrencyEvaluation
}

export interface CreateAbusePreventionPolicyBody {
  name: string
  detectionRules?: {
    agentCreationBurst?: { max: number; windowMs: number }
    outboundRequestBurst?: { max: number; windowMs: number }
    scrapingDetection?: { maxRequestsPerDomain: number }
    spamDetection?: { similarOutputRatio: number }
    intrusionAttempt?: { pattern: string[] }
  }
  onAbuseDetected?: {
    light?: 'warn_user'
    moderate?: 'pause_agent_and_warn'
    severe?: 'stop_and_quarantine_agent'
    critical?: 'stop_all_and_notify_admin'
  }
  status?: AbusePreventionPolicyStatus
}

export interface EvaluateAbuseBody {
  policyId: string
  agentProfileId?: string | null
  employeeRunId?: string | null
  signals?: {
    agentCreations?: number
    outboundRequests?: Array<{ domain: string }>
    generatedOutputs?: string[]
    intrusionText?: string
    unauthorizedAccessAttempts?: number
  }
}

export interface SubmitAbuseAppealBody {
  abuseDetectionEventId: string
  agentProfileId?: string | null
  reason: string
}

export async function fetchAbusePreventionPolicies(params: {
  status?: AbusePreventionPolicyStatus
  limit?: number
} = {}): Promise<AbusePreventionPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { abusePreventionPolicies } = await json<{
    abusePreventionPolicies: AbusePreventionPolicyRow[]
  }>(fetch(`/api/abuse-prevention/policies${suffix}`))
  return abusePreventionPolicies
}

export async function createAbusePreventionPolicy(
  body: CreateAbusePreventionPolicyBody,
): Promise<AbusePreventionPolicyRow> {
  const { abusePreventionPolicy } = await json<{
    abusePreventionPolicy: AbusePreventionPolicyRow
  }>(
    fetch('/api/abuse-prevention/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return abusePreventionPolicy
}

export async function fetchAbuseDetectionEvents(params: {
  policyId?: string
  agentProfileId?: string
  severity?: AbusePreventionSeverity
  limit?: number
} = {}): Promise<AbuseDetectionEventRow[]> {
  const qs = new URLSearchParams()
  if (params.policyId) qs.set('policyId', params.policyId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.severity) qs.set('severity', params.severity)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { abuseDetectionEvents } = await json<{
    abuseDetectionEvents: AbuseDetectionEventRow[]
  }>(fetch(`/api/abuse-prevention/events${suffix}`))
  return abuseDetectionEvents
}

export async function evaluateAbuseSignals(
  body: EvaluateAbuseBody,
): Promise<AbuseDetectionEventRow> {
  const { abuseDetectionEvent } = await json<{
    abuseDetectionEvent: AbuseDetectionEventRow
  }>(
    fetch('/api/abuse-prevention/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return abuseDetectionEvent
}

export async function fetchAbuseAppeals(params: {
  status?: AbuseAppealStatus
  agentProfileId?: string
  limit?: number
} = {}): Promise<AbuseAppealRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { abuseAppeals } = await json<{
    abuseAppeals: AbuseAppealRow[]
  }>(fetch(`/api/abuse-prevention/appeals${suffix}`))
  return abuseAppeals
}

export async function submitAbuseAppeal(
  body: SubmitAbuseAppealBody,
): Promise<AbuseAppealRow> {
  const { abuseAppeal } = await json<{ abuseAppeal: AbuseAppealRow }>(
    fetch('/api/abuse-prevention/appeals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return abuseAppeal
}

export async function reviewAbuseAppeal(
  id: string,
  body: { approved: boolean; reviewNote?: string },
): Promise<AbuseAppealRow> {
  const { abuseAppeal } = await json<{ abuseAppeal: AbuseAppealRow }>(
    fetch(`/api/abuse-prevention/appeals/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return abuseAppeal
}

export interface CreateFutureTechInterfaceBody {
  capabilityKind: FutureTechCapabilityKind
  displayName: string
  abstractionName: string
  description?: string
  reservedMethods?: string[]
  safetyBoundary?: string
  localFirst?: boolean
  readiness?: FutureTechReadiness
}

export interface CreateFutureTechRadarItemBody {
  stage: FutureTechStage
  title: string
  description?: string
  capabilityKinds?: FutureTechCapabilityKind[]
  dependencies?: string[]
  status?: FutureTechRadarStatus
}

export async function fetchFutureTechInterfaces(params: {
  capabilityKind?: FutureTechCapabilityKind
  readiness?: FutureTechReadiness
  limit?: number
} = {}): Promise<FutureTechInterfaceRow[]> {
  const qs = new URLSearchParams()
  if (params.capabilityKind) qs.set('capabilityKind', params.capabilityKind)
  if (params.readiness) qs.set('readiness', params.readiness)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { futureTechInterfaces } = await json<{
    futureTechInterfaces: FutureTechInterfaceRow[]
  }>(fetch(`/api/future-tech/interfaces${suffix}`))
  return futureTechInterfaces
}

export async function createFutureTechInterface(
  body: CreateFutureTechInterfaceBody,
): Promise<FutureTechInterfaceRow> {
  const { futureTechInterface } = await json<{
    futureTechInterface: FutureTechInterfaceRow
  }>(
    fetch('/api/future-tech/interfaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return futureTechInterface
}

export async function fetchFutureTechRadarItems(params: {
  stage?: FutureTechStage
  status?: FutureTechRadarStatus
  limit?: number
} = {}): Promise<FutureTechRadarItemRow[]> {
  const qs = new URLSearchParams()
  if (params.stage) qs.set('stage', params.stage)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { futureTechRadarItems } = await json<{
    futureTechRadarItems: FutureTechRadarItemRow[]
  }>(fetch(`/api/future-tech/radar${suffix}`))
  return futureTechRadarItems
}

export async function createFutureTechRadarItem(
  body: CreateFutureTechRadarItemBody,
): Promise<FutureTechRadarItemRow> {
  const { futureTechRadarItem } = await json<{
    futureTechRadarItem: FutureTechRadarItemRow
  }>(
    fetch('/api/future-tech/radar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return futureTechRadarItem
}

export async function seedFutureTechRoadmap(): Promise<{
  interfaces: FutureTechInterfaceRow[]
  radarItems: FutureTechRadarItemRow[]
}> {
  return json<{
    interfaces: FutureTechInterfaceRow[]
    radarItems: FutureTechRadarItemRow[]
  }>(
    fetch('/api/future-tech/seed', {
      method: 'POST',
    }),
  )
}

export interface CreateCommercialPlanBody {
  planKey: CommercialPlanKey
  name: string
  priceCents?: number | null
  currency?: string
  billingPeriod: CommercialBillingPeriod
  maxAgents?: number | null
  maxConcurrentRuns?: number | null
  features?: string[]
  limits?: JsonObject
  status?: CommercialPlanStatus
}

export interface CreateRevenueStreamBody {
  streamType: RevenueStreamType
  name: string
  priority?: number
  description?: string
  commissionRateBps?: number | null
  status?: RevenueStreamStatus
}

export interface CreateCommercialPolicyRuleBody {
  ruleType: CommercialPolicyRuleType
  title: string
  description?: string
  severity?: CommercialPolicySeverity
  status?: CommercialPlanStatus
}

export async function fetchCommercialPlans(params: {
  planKey?: CommercialPlanKey
  status?: CommercialPlanStatus
  limit?: number
} = {}): Promise<CommercialPlanRow[]> {
  const qs = new URLSearchParams()
  if (params.planKey) qs.set('planKey', params.planKey)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { commercialPlans } = await json<{
    commercialPlans: CommercialPlanRow[]
  }>(fetch(`/api/commercial/plans${suffix}`))
  return commercialPlans
}

export async function createCommercialPlan(
  body: CreateCommercialPlanBody,
): Promise<CommercialPlanRow> {
  const { commercialPlan } = await json<{ commercialPlan: CommercialPlanRow }>(
    fetch('/api/commercial/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return commercialPlan
}

export async function fetchRevenueStreams(params: {
  streamType?: RevenueStreamType
  status?: RevenueStreamStatus
  limit?: number
} = {}): Promise<MonetizationRevenueStreamRow[]> {
  const qs = new URLSearchParams()
  if (params.streamType) qs.set('streamType', params.streamType)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { revenueStreams } = await json<{
    revenueStreams: MonetizationRevenueStreamRow[]
  }>(fetch(`/api/commercial/revenue-streams${suffix}`))
  return revenueStreams
}

export async function createRevenueStream(
  body: CreateRevenueStreamBody,
): Promise<MonetizationRevenueStreamRow> {
  const { revenueStream } = await json<{
    revenueStream: MonetizationRevenueStreamRow
  }>(
    fetch('/api/commercial/revenue-streams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return revenueStream
}

export async function fetchCommercialPolicyRules(params: {
  ruleType?: CommercialPolicyRuleType
  status?: CommercialPlanStatus
  limit?: number
} = {}): Promise<CommercialPolicyRuleRow[]> {
  const qs = new URLSearchParams()
  if (params.ruleType) qs.set('ruleType', params.ruleType)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { commercialPolicyRules } = await json<{
    commercialPolicyRules: CommercialPolicyRuleRow[]
  }>(fetch(`/api/commercial/policy-rules${suffix}`))
  return commercialPolicyRules
}

export async function createCommercialPolicyRule(
  body: CreateCommercialPolicyRuleBody,
): Promise<CommercialPolicyRuleRow> {
  const { commercialPolicyRule } = await json<{
    commercialPolicyRule: CommercialPolicyRuleRow
  }>(
    fetch('/api/commercial/policy-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return commercialPolicyRule
}

export async function seedCommercialStrategy(): Promise<{
  plans: CommercialPlanRow[]
  revenueStreams: MonetizationRevenueStreamRow[]
  policyRules: CommercialPolicyRuleRow[]
}> {
  return json<{
    plans: CommercialPlanRow[]
    revenueStreams: MonetizationRevenueStreamRow[]
    policyRules: CommercialPolicyRuleRow[]
  }>(
    fetch('/api/commercial/seed', {
      method: 'POST',
    }),
  )
}

export interface CreateOpenSourceComponentBody {
  layer: SourceLicenseLayer
  name: string
  scope?: string
  license: string
  sourceVisibility?: string
  commercialUse?: string
  authorPolicy?: string
  status?: OpenSourceGovernanceStatus
}

export interface CreateCommunityGovernanceRoleBody {
  roleType: GovernanceRoleType
  name: string
  responsibilities?: string[]
  permissions?: string[]
  status?: OpenSourceGovernanceStatus
}

export interface CreateGovernanceRfcBody {
  title: string
  summary?: string
  proposer?: string
  discussionUrl?: string | null
}

export async function fetchOpenSourceComponents(params: {
  layer?: SourceLicenseLayer
  status?: OpenSourceGovernanceStatus
  limit?: number
} = {}): Promise<OpenSourceComponentRow[]> {
  const qs = new URLSearchParams()
  if (params.layer) qs.set('layer', params.layer)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { openSourceComponents } = await json<{
    openSourceComponents: OpenSourceComponentRow[]
  }>(fetch(`/api/open-source-governance/components${suffix}`))
  return openSourceComponents
}

export async function createOpenSourceComponent(
  body: CreateOpenSourceComponentBody,
): Promise<OpenSourceComponentRow> {
  const { openSourceComponent } = await json<{
    openSourceComponent: OpenSourceComponentRow
  }>(
    fetch('/api/open-source-governance/components', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return openSourceComponent
}

export async function fetchCommunityGovernanceRoles(params: {
  roleType?: GovernanceRoleType
  status?: OpenSourceGovernanceStatus
  limit?: number
} = {}): Promise<CommunityGovernanceRoleRow[]> {
  const qs = new URLSearchParams()
  if (params.roleType) qs.set('roleType', params.roleType)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { communityGovernanceRoles } = await json<{
    communityGovernanceRoles: CommunityGovernanceRoleRow[]
  }>(fetch(`/api/open-source-governance/roles${suffix}`))
  return communityGovernanceRoles
}

export async function createCommunityGovernanceRole(
  body: CreateCommunityGovernanceRoleBody,
): Promise<CommunityGovernanceRoleRow> {
  const { communityGovernanceRole } = await json<{
    communityGovernanceRole: CommunityGovernanceRoleRow
  }>(
    fetch('/api/open-source-governance/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return communityGovernanceRole
}

export async function fetchGovernanceRfcs(params: {
  status?: GovernanceRfcStatus
  proposer?: string
  limit?: number
} = {}): Promise<GovernanceRfcDecisionRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.proposer) qs.set('proposer', params.proposer)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { governanceRfcs } = await json<{
    governanceRfcs: GovernanceRfcDecisionRow[]
  }>(fetch(`/api/open-source-governance/rfcs${suffix}`))
  return governanceRfcs
}

export async function createGovernanceRfc(
  body: CreateGovernanceRfcBody,
): Promise<GovernanceRfcDecisionRow> {
  const { governanceRfc } = await json<{ governanceRfc: GovernanceRfcDecisionRow }>(
    fetch('/api/open-source-governance/rfcs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return governanceRfc
}

export async function advanceGovernanceRfc(
  id: string,
  body: {
    status: GovernanceRfcStatus
    discussionUrl?: string | null
    votesFor?: number
    votesAgainst?: number
    implementationNotes?: string
  },
): Promise<GovernanceRfcDecisionRow> {
  const { governanceRfc } = await json<{ governanceRfc: GovernanceRfcDecisionRow }>(
    fetch(`/api/open-source-governance/rfcs/${id}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return governanceRfc
}

export async function seedOpenSourceGovernance(): Promise<{
  components: OpenSourceComponentRow[]
  roles: CommunityGovernanceRoleRow[]
}> {
  return json<{
    components: OpenSourceComponentRow[]
    roles: CommunityGovernanceRoleRow[]
  }>(
    fetch('/api/open-source-governance/seed', {
      method: 'POST',
    }),
  )
}

export interface ContributorEnvironmentCheck {
  tool: ContributorTool
  required: boolean
  minimumVersion: string
  observed: string | boolean | null
  status: 'ok' | 'missing' | 'outdated'
}

export async function fetchContributorPrerequisites(params: {
  tool?: ContributorTool
  status?: OpenSourceGovernanceStatus
  limit?: number
} = {}): Promise<ContributorPrerequisiteRow[]> {
  const qs = new URLSearchParams()
  if (params.tool) qs.set('tool', params.tool)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { contributorPrerequisites } = await json<{
    contributorPrerequisites: ContributorPrerequisiteRow[]
  }>(fetch(`/api/contributor-guide/prerequisites${suffix}`))
  return contributorPrerequisites
}

export async function fetchContributionPolicies(params: {
  policyType?: ContributionPolicyType
  status?: OpenSourceGovernanceStatus
  limit?: number
} = {}): Promise<ContributionPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.policyType) qs.set('policyType', params.policyType)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { contributionPolicies } = await json<{
    contributionPolicies: ContributionPolicyRow[]
  }>(fetch(`/api/contributor-guide/policies${suffix}`))
  return contributionPolicies
}

export async function seedContributorGuide(): Promise<{
  prerequisites: ContributorPrerequisiteRow[]
  policies: ContributionPolicyRow[]
}> {
  return json<{
    prerequisites: ContributorPrerequisiteRow[]
    policies: ContributionPolicyRow[]
  }>(
    fetch('/api/contributor-guide/seed', {
      method: 'POST',
    }),
  )
}

export async function evaluateContributorEnvironment(body: {
  nodeVersion?: string
  rustVersion?: string
  pythonVersion?: string
  hasGit?: boolean
  hasChrome?: boolean
}): Promise<ContributorEnvironmentCheck[]> {
  const { checks } = await json<{ checks: ContributorEnvironmentCheck[] }>(
    fetch('/api/contributor-guide/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return checks
}

export async function fetchArchitecturePatterns(params: {
  patternKey?: ArchitecturePatternKey
  status?: OpenSourceGovernanceStatus
  limit?: number
} = {}): Promise<ArchitecturePatternRow[]> {
  const qs = new URLSearchParams()
  if (params.patternKey) qs.set('patternKey', params.patternKey)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { architecturePatterns } = await json<{
    architecturePatterns: ArchitecturePatternRow[]
  }>(fetch(`/api/architecture/patterns${suffix}`))
  return architecturePatterns
}

export async function fetchArchitectureInterfaces(params: {
  interfaceName?: string
  status?: OpenSourceGovernanceStatus
  limit?: number
} = {}): Promise<ArchitectureInterfaceRow[]> {
  const qs = new URLSearchParams()
  if (params.interfaceName) qs.set('interfaceName', params.interfaceName)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { architectureInterfaces } = await json<{
    architectureInterfaces: ArchitectureInterfaceRow[]
  }>(fetch(`/api/architecture/interfaces${suffix}`))
  return architectureInterfaces
}

export async function seedArchitecturePatterns(): Promise<{
  patterns: ArchitecturePatternRow[]
  interfaces: ArchitectureInterfaceRow[]
}> {
  return json<{
    patterns: ArchitecturePatternRow[]
    interfaces: ArchitectureInterfaceRow[]
  }>(
    fetch('/api/architecture/seed', {
      method: 'POST',
    }),
  )
}

export async function fetchTechnicalArchitectureManifest(): Promise<TechnicalArchitectureManifest> {
  const { manifest } = await json<{ manifest: TechnicalArchitectureManifest }>(
    fetch('/api/technical-architecture/manifest'),
  )
  return manifest
}

export async function evaluateTechnicalArchitecture(): Promise<TechnicalArchitectureEvaluationRow> {
  const { evaluation } = await json<{ evaluation: TechnicalArchitectureEvaluationRow }>(
    fetch('/api/technical-architecture/evaluate', { method: 'POST' }),
  )
  return evaluation
}

export async function fetchTechnicalArchitectureEvaluations(params: {
  status?: TechnicalArchitectureEvaluationStatus
  limit?: number
} = {}): Promise<TechnicalArchitectureEvaluationRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { evaluations } = await json<{ evaluations: TechnicalArchitectureEvaluationRow[] }>(
    fetch(`/api/technical-architecture/evaluations${suffix}`),
  )
  return evaluations
}

export async function fetchErrorCodeCatalog(params: {
  category?: ErrorCodeCategory
  code?: string
  status?: OpenSourceGovernanceStatus
  limit?: number
} = {}): Promise<ErrorCodeCatalogRow[]> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.code) qs.set('code', params.code)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { errorCodes } = await json<{ errorCodes: ErrorCodeCatalogRow[] }>(
    fetch(`/api/error-codes${suffix}`),
  )
  return errorCodes
}

export async function seedErrorCodeCatalog(): Promise<ErrorCodeCatalogRow[]> {
  const { errorCodes } = await json<{ errorCodes: ErrorCodeCatalogRow[] }>(
    fetch('/api/error-codes/seed', {
      method: 'POST',
    }),
  )
  return errorCodes
}

export async function fetchEntityStateMachines(params: {
  entityType?: EntityStateMachineType
  status?: OpenSourceGovernanceStatus
  limit?: number
} = {}): Promise<EntityStateMachineRow[]> {
  const qs = new URLSearchParams()
  if (params.entityType) qs.set('entityType', params.entityType)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { stateMachines } = await json<{ stateMachines: EntityStateMachineRow[] }>(
    fetch(`/api/state-machines${suffix}`),
  )
  return stateMachines
}

export async function fetchEntityStateTransitions(params: {
  machineId?: string
  entityType?: EntityStateMachineType
  fromState?: string
  status?: OpenSourceGovernanceStatus
  limit?: number
} = {}): Promise<EntityStateTransitionRow[]> {
  const qs = new URLSearchParams()
  if (params.machineId) qs.set('machineId', params.machineId)
  if (params.entityType) qs.set('entityType', params.entityType)
  if (params.fromState) qs.set('fromState', params.fromState)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { stateTransitions } = await json<{ stateTransitions: EntityStateTransitionRow[] }>(
    fetch(`/api/state-machines/transitions${suffix}`),
  )
  return stateTransitions
}

export async function seedEntityStateMachines(): Promise<{
  machines: EntityStateMachineRow[]
  transitions: EntityStateTransitionRow[]
}> {
  return json<{
    machines: EntityStateMachineRow[]
    transitions: EntityStateTransitionRow[]
  }>(
    fetch('/api/state-machines/seed', {
      method: 'POST',
    }),
  )
}

export async function evaluateEntityStateTransition(body: {
  entityType: EntityStateMachineType
  fromState: string
  toState: string
}): Promise<{
  allowed: boolean
  reason: string
  machine: EntityStateMachineRow | null
  transition: EntityStateTransitionRow | null
}> {
  const { evaluation } = await json<{
    evaluation: {
      allowed: boolean
      reason: string
      machine: EntityStateMachineRow | null
      transition: EntityStateTransitionRow | null
    }
  }>(
    fetch('/api/state-machines/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evaluation
}

export interface CreateHumanApprovalPolicyBody {
  agentProfileId?: string | null
  workflowId?: string | null
  name: string
  config?: Partial<HumanApprovalPolicyConfig>
  status?: HumanApprovalPolicyStatus
}

export interface HumanApprovalPolicyEvaluationDto {
  policy: HumanApprovalPolicyRow
  elapsedSeconds: number
  timedOut: boolean
  timeoutAction: ApprovalOnTimeout | 'not_timed_out'
  autoApproved: boolean
  matchedAutoApproveCondition: AutoApproveCondition | null
  escalationTarget: ApprovalEscalationStep | null
  batching: HumanApprovalPolicyConfig['batching'] & {
    shouldBatch: boolean
    suggestedBatchKey: string | null
  }
  recommendation: 'approve' | 'reject' | 'wait' | 'escalate' | 'batch'
}

export interface RecordPlanApprovalResultBody {
  approvalRequestId?: string | null
  agentProfileId?: string | null
  employeeRunId?: string | null
  workflowRunId?: string | null
  planId?: string | null
  stepDecisions: PlanStepDecision[]
  overallDecision?: PlanApprovalOverallDecision
  summary?: string
}

export interface StartTakeoverSessionBody {
  runId?: string | null
  agentProfileId?: string | null
  stepId: string
  resource: TakeoverResource
  observation?: JsonObject
}

export interface RecordTakeoverActionBody {
  type: TakeoverActionType
  payload?: JsonObject
  timestamp?: number
}

export async function createHumanApprovalPolicy(
  body: CreateHumanApprovalPolicyBody,
): Promise<HumanApprovalPolicyRow> {
  const { policy } = await json<{ policy: HumanApprovalPolicyRow }>(
    fetch('/api/human-collaboration/approval-policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return policy
}

export async function fetchHumanApprovalPolicies(params: {
  agentProfileId?: string
  workflowId?: string
  status?: HumanApprovalPolicyStatus
  limit?: number
} = {}): Promise<HumanApprovalPolicyRow[]> {
  const qs = new URLSearchParams()
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.workflowId) qs.set('workflowId', params.workflowId)
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { policies } = await json<{ policies: HumanApprovalPolicyRow[] }>(
    fetch(`/api/human-collaboration/approval-policies${suffix}`),
  )
  return policies
}

export async function evaluateHumanApprovalPolicy(
  policyId: string,
  body: {
    facts?: JsonObject
    requestedAt?: number | null
    elapsedSeconds?: number | null
    autoApprovalsUsedInRun?: number
    approvalType?: string | null
  },
): Promise<HumanApprovalPolicyEvaluationDto> {
  const { evaluation } = await json<{ evaluation: HumanApprovalPolicyEvaluationDto }>(
    fetch(`/api/human-collaboration/approval-policies/${policyId}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return evaluation
}

export async function recordPlanApprovalResult(
  body: RecordPlanApprovalResultBody,
): Promise<PlanApprovalResultRow> {
  const { result } = await json<{ result: PlanApprovalResultRow }>(
    fetch('/api/human-collaboration/plan-approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return result
}

export async function fetchPlanApprovalResults(params: {
  approvalRequestId?: string
  agentProfileId?: string
  employeeRunId?: string
  workflowRunId?: string
  limit?: number
} = {}): Promise<PlanApprovalResultRow[]> {
  const qs = new URLSearchParams()
  if (params.approvalRequestId) qs.set('approvalRequestId', params.approvalRequestId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.employeeRunId) qs.set('employeeRunId', params.employeeRunId)
  if (params.workflowRunId) qs.set('workflowRunId', params.workflowRunId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { results } = await json<{ results: PlanApprovalResultRow[] }>(
    fetch(`/api/human-collaboration/plan-approvals${suffix}`),
  )
  return results
}

export async function startTakeoverSession(
  body: StartTakeoverSessionBody,
): Promise<TakeoverSessionRow> {
  const { session } = await json<{ session: TakeoverSessionRow }>(
    fetch('/api/human-collaboration/takeovers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return session
}

export async function fetchTakeoverSessions(params: {
  runId?: string
  agentProfileId?: string
  status?: TakeoverSessionStatus
  resource?: TakeoverResource
  limit?: number
} = {}): Promise<TakeoverSessionRow[]> {
  const qs = new URLSearchParams()
  if (params.runId) qs.set('runId', params.runId)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.status) qs.set('status', params.status)
  if (params.resource) qs.set('resource', params.resource)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { sessions } = await json<{ sessions: TakeoverSessionRow[] }>(
    fetch(`/api/human-collaboration/takeovers${suffix}`),
  )
  return sessions
}

export async function recordTakeoverAction(
  takeoverSessionId: string,
  body: RecordTakeoverActionBody,
): Promise<TakeoverSessionRow> {
  const { session } = await json<{ session: TakeoverSessionRow }>(
    fetch(`/api/human-collaboration/takeovers/${takeoverSessionId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return session
}

export async function completeTakeoverSession(
  takeoverSessionId: string,
  body: {
    status?: Extract<TakeoverSessionStatus, 'completed' | 'cancelled'>
    observation?: JsonObject
  } = {},
): Promise<TakeoverSessionRow> {
  const { session } = await json<{ session: TakeoverSessionRow }>(
    fetch(`/api/human-collaboration/takeovers/${takeoverSessionId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return session
}

export async function fetchApprovalRequests(params: {
  status?: ApprovalRequestRow['status']
  agentProfileId?: string
  runId?: string
  limit?: number
} = {}): Promise<ApprovalRequestRow[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.agentProfileId) qs.set('agentProfileId', params.agentProfileId)
  if (params.runId) qs.set('runId', params.runId)
  if (params.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { approvalRequests } = await json<{ approvalRequests: ApprovalRequestRow[] }>(
    fetch(`/api/approvals${suffix}`),
  )
  return approvalRequests
}

export async function evaluateAutonomyAction(body: EvaluateAutonomyActionBody): Promise<{
  decision: AutonomyDecisionRow
  agent: AgentProfileRow | null
}> {
  return json<{ decision: AutonomyDecisionRow; agent: AgentProfileRow | null }>(
    fetch('/api/autonomy/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function fetchWorkflowRunSnapshot(
  workflowRunId: string,
): Promise<WorkflowRunSnapshot> {
  return json<WorkflowRunSnapshot>(fetch(`/api/workflow-runs/${workflowRunId}`))
}

export async function approveApprovalRequest(
  approvalRequestId: string,
  response: JsonObject = {},
): Promise<ApprovalRequestRow> {
  const { approvalRequest } = await json<{ approvalRequest: ApprovalRequestRow }>(
    fetch(`/api/approvals/${approvalRequestId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    }),
  )
  return approvalRequest
}

export async function rejectApprovalRequest(
  approvalRequestId: string,
  response: JsonObject = {},
): Promise<ApprovalRequestRow> {
  const { approvalRequest } = await json<{ approvalRequest: ApprovalRequestRow }>(
    fetch(`/api/approvals/${approvalRequestId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    }),
  )
  return approvalRequest
}

export async function fetchConversations(): Promise<ConversationWithMeta[]> {
  const { conversations } = await json<{ conversations: ConversationWithMeta[] }>(
    fetch('/api/conversations'),
  )
  return conversations
}

export interface CreateConversationBody {
  title?: string
  mode: 'single' | 'group'
  agentIds: string[]
  modelProfileId?: string | null
  boundPath?: string
}

export async function createConversation(body: CreateConversationBody): Promise<ConversationWithMeta> {
  const { conversation } = await json<{ conversation: ConversationWithMeta }>(
    fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return conversation
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' }),
  )
}

export async function addAgentsToConversation(
  conversationId: string,
  addAgentIds: string[],
): Promise<ConversationWithMeta> {
  const { conversation } = await json<{ conversation: ConversationWithMeta }>(
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addAgentIds }),
    }),
  )
  return conversation
}

export async function renameConversation(
  conversationId: string,
  title: string,
): Promise<ConversationWithMeta> {
  const { conversation } = await json<{ conversation: ConversationWithMeta }>(
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }),
  )
  return conversation
}

export async function togglePinConversation(conversationId: string): Promise<ConversationWithMeta> {
  const { conversation } = await json<{ conversation: ConversationWithMeta }>(
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ togglePin: true }),
    }),
  )
  return conversation
}

export async function toggleArchiveConversation(
  conversationId: string,
): Promise<ConversationWithMeta> {
  const { conversation } = await json<{ conversation: ConversationWithMeta }>(
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toggleArchive: true }),
    }),
  )
  return conversation
}

export async function setFsWriteApprovalMode(
  conversationId: string,
  mode: 'auto' | 'review',
): Promise<ConversationWithMeta> {
  const { conversation } = await json<{ conversation: ConversationWithMeta }>(
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fsWriteApprovalMode: mode }),
    }),
  )
  return conversation
}

// ─── Pending writes (fs_write review mode) ─────
export async function fetchPendingWrites(conversationId: string): Promise<PendingWrite[]> {
  const { pendingWrites } = await json<{ pendingWrites: PendingWrite[] }>(
    fetch(`/api/conversations/${conversationId}/pending-writes`),
  )
  return pendingWrites
}

export async function approvePendingWrite(
  conversationId: string,
  pendingId: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-writes/${pendingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    }),
  )
}

export async function rejectPendingWrite(
  conversationId: string,
  pendingId: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-writes/${pendingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    }),
  )
}

// ─── Pending bash commands ─────
export async function fetchPendingBashCommands(
  conversationId: string,
): Promise<PendingBashCommand[]> {
  const { pendingCommands } = await json<{ pendingCommands: PendingBashCommand[] }>(
    fetch(`/api/conversations/${conversationId}/pending-bash-commands`),
  )
  return pendingCommands
}

export async function approvePendingBashCommand(
  conversationId: string,
  pendingId: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-bash-commands/${pendingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    }),
  )
}

export async function rejectPendingBashCommand(
  conversationId: string,
  pendingId: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-bash-commands/${pendingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    }),
  )
}

// ─── Pending questions (ask_user) ───────────────
export async function fetchPendingQuestions(conversationId: string): Promise<PendingQuestion[]> {
  const { pendingQuestions } = await json<{ pendingQuestions: PendingQuestion[] }>(
    fetch(`/api/conversations/${conversationId}/pending-questions`),
  )
  return pendingQuestions
}

export async function submitQuestionAnswers(
  conversationId: string,
  questionId: string,
  answers: Record<string, AskUserAnswer>,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-questions/${questionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    }),
  )
}

// ─── Messages ───────────────────────────────────
// ─── Pending dispatch plans (Orchestrator plan review) ───
export async function fetchPendingDispatchPlans(
  conversationId: string,
): Promise<PendingDispatchPlan[]> {
  const { pendingDispatchPlans } = await json<{ pendingDispatchPlans: PendingDispatchPlan[] }>(
    fetch(`/api/conversations/${conversationId}/pending-dispatch-plans`),
  )
  return pendingDispatchPlans
}

export async function approvePendingDispatchPlan(
  conversationId: string,
  planId: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-dispatch-plans/${planId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    }),
  )
}

export async function reviseDispatchPlan(
  conversationId: string,
  planId: string,
  feedback: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-dispatch-plans/${planId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revise', feedback }),
    }),
  )
}

export async function rejectPendingDispatchPlan(
  conversationId: string,
  planId: string,
): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/conversations/${conversationId}/pending-dispatch-plans/${planId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    }),
  )
}

export async function fetchMessages(conversationId: string): Promise<MessageRow[]> {
  const { messages } = await json<{ messages: MessageRow[] }>(
    fetch(`/api/conversations/${conversationId}/messages`),
  )
  return messages
}

// ─── Search ──────────────────────────────────────
export interface SearchApiResult {
  hits: Array<{
    messageId: string
    conversationId: string
    conversationTitle: string
    role: 'user' | 'agent' | 'system'
    agentId: string | null
    agentName: string | null
    agentAvatar: string | null
    createdAt: number
    snippetHtml: string
  }>
  total: number
  tookMs: number
}

export async function searchMessagesApi(
  query: string,
  opts: { fallback?: 'like'; conversationId?: string; role?: 'user' | 'agent' } = {},
): Promise<SearchApiResult> {
  const params = new URLSearchParams({ q: query })
  if (opts.fallback) params.set('fallback', opts.fallback)
  if (opts.conversationId) params.set('conversationId', opts.conversationId)
  if (opts.role) params.set('role', opts.role)
  const { data } = await json<{ ok: true; data: SearchApiResult }>(
    fetch(`/api/search?${params}`),
  )
  return data
}

export interface ClearConversationHistoryResult {
  conversation: ConversationWithMeta
  deletedMessageCount: number
  deletedRunCount: number
  deletedSummaryCount: number
}

export async function clearConversationHistory(
  conversationId: string,
): Promise<ClearConversationHistoryResult> {
  return json<ClearConversationHistoryResult>(
    fetch(`/api/conversations/${conversationId}/messages`, { method: 'DELETE' }),
  )
}

export interface SendMessageBody {
  content: string
  mentionedAgentIds?: string[]
  parentMessageId?: string
  attachmentIds?: string[]
}

export interface SendMessageResult {
  messageId: string
  runIds: string[]
  messages?: MessageRow[]
  deploy?: DeployConversationResult
}

export async function sendMessage(
  conversationId: string,
  body: SendMessageBody,
): Promise<SendMessageResult> {
  return json<SendMessageResult>(
    fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export type DeployConversationResult =
  | {
      kind: 'no_candidates'
      candidates: []
      message: MessageRow
    }
  | {
      kind: 'candidate_selection'
      candidates: DeployCandidateRecord[]
      message: MessageRow
    }
  | {
      kind: 'deployed'
      deployment: DeployStatusRecord
      message: MessageRow
    }

export async function fetchDeployCandidates(
  conversationId: string,
): Promise<DeployCandidateRecord[]> {
  const { candidates } = await json<{ candidates: DeployCandidateRecord[] }>(
    fetch(`/api/conversations/${conversationId}/deploy`),
  )
  return candidates
}

export async function deployConversationArtifact(
  conversationId: string,
  artifactId?: string,
): Promise<DeployConversationResult> {
  return json<DeployConversationResult>(
    fetch(`/api/conversations/${conversationId}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(artifactId ? { artifactId } : {}),
    }),
  )
}

// ─── Runs ───────────────────────────────────────
export interface CompactConversationResult {
  summary: ContextSummaryRow
  message: MessageRow
}

export async function compactConversation(
  conversationId: string,
): Promise<CompactConversationResult> {
  return json<CompactConversationResult>(
    fetch(`/api/conversations/${conversationId}/compact`, { method: 'POST' }),
  )
}

export async function abortRun(runId: string): Promise<void> {
  await json<{ ok: true }>(fetch(`/api/runs/${runId}/abort`, { method: 'POST' }))
}

// ─── Messages: withdraw / edit ──────────────────
export interface WithdrawResult {
  deletedMessageIds: string[]
  deletedArtifactIds: string[]
}

export async function withdrawMessage(
  messageId: string,
  conversationId: string,
): Promise<WithdrawResult> {
  return json<WithdrawResult>(
    fetch(`/api/messages/${messageId}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }),
  )
}

export interface EditAndResendResult extends WithdrawResult {
  newMessage: MessageRow
  runIds: string[]
  messages?: MessageRow[]
}

export interface RegenerateResult extends WithdrawResult {
  triggerMessageId: string
  runIds: string[]
  messages?: MessageRow[]
}

export async function regenerateLastResponse(conversationId: string): Promise<RegenerateResult> {
  return json<RegenerateResult>(
    fetch(`/api/conversations/${conversationId}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }),
  )
}

export async function editAndResendMessage(
  messageId: string,
  conversationId: string,
  content: string,
): Promise<EditAndResendResult> {
  return json<EditAndResendResult>(
    fetch(`/api/messages/${messageId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, content }),
    }),
  )
}

export interface ToggleBookmarkResult {
  bookmarkedMessageIds: string[]
  bookmarked: boolean
}

export async function toggleMessageBookmark(
  messageId: string,
  conversationId: string,
): Promise<ToggleBookmarkResult> {
  return json<ToggleBookmarkResult>(
    fetch(`/api/messages/${messageId}/bookmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }),
  )
}

export interface TogglePinResult {
  pinnedMessageIds: string[]
  pinned: boolean
}

export async function toggleMessagePin(
  messageId: string,
  conversationId: string,
): Promise<TogglePinResult> {
  return json<TogglePinResult>(
    fetch(`/api/messages/${messageId}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }),
  )
}

// ─── Filesystem (DirPicker) ────────────────────
export interface ListDirResult {
  path: string
  parent: string | null
  entries: Array<{ name: string; isDirectory: boolean; path?: string }>
}

export type ServerPlatform = 'posix' | 'windows'

export async function getServerPlatform(): Promise<ServerPlatform> {
  const res = await json<{ platform: ServerPlatform }>(fetch('/api/platform'))
  return res.platform
}

export async function listDirectory(targetPath?: string): Promise<ListDirResult> {
  const qs = targetPath ? `?path=${encodeURIComponent(targetPath)}` : ''
  return json<ListDirResult>(fetch(`/api/fs/listdir${qs}`))
}

// ─── Filesystem (conversation-scoped, 文件浏览器面板用) ────────
export interface WorkspaceListResult {
  relPath: string
  absolutePath: string
  parent: string | null
  entries: Array<{ name: string; isDirectory: boolean; size?: number }>
}

export async function workspaceListDir(
  conversationId: string,
  relPath = '',
): Promise<WorkspaceListResult> {
  const qs = relPath ? `?path=${encodeURIComponent(relPath)}` : ''
  return json<WorkspaceListResult>(fetch(`/api/conversations/${conversationId}/fs/listdir${qs}`))
}

export interface WorkspaceReadResult {
  path: string
  absolutePath: string
  cwd: string
  size: number
  content: string
  truncated: boolean
}

export async function workspaceReadFile(
  conversationId: string,
  relPath: string,
): Promise<WorkspaceReadResult> {
  return json<WorkspaceReadResult>(
    fetch(`/api/conversations/${conversationId}/fs/read?path=${encodeURIComponent(relPath)}`),
  )
}

export interface WorkspaceWriteResult {
  path: string
  absolutePath: string
  cwd: string
  bytes: number
}

export async function workspaceWriteFile(
  conversationId: string,
  relPath: string,
  content: string,
): Promise<WorkspaceWriteResult> {
  return json<WorkspaceWriteResult>(
    fetch(`/api/conversations/${conversationId}/fs/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: relPath, content }),
    }),
  )
}

// ─── Artifacts ─────────────────────────────────
export async function fetchArtifacts(): Promise<ArtifactListItem[]> {
  const { artifacts } = await json<{ artifacts: ArtifactListItem[] }>(fetch('/api/artifacts'))
  return artifacts
}

export async function fetchArtifact(artifactId: string): Promise<ArtifactRow> {
  const { artifact } = await json<{ artifact: ArtifactRow }>(
    fetch(`/api/artifacts/${artifactId}`),
  )
  return artifact
}

export async function fetchArtifactVersions(artifactId: string): Promise<ArtifactRow[]> {
  const { versions } = await json<{ versions: ArtifactRow[] }>(
    fetch(`/api/artifacts/${artifactId}/versions`),
  )
  return versions
}

/** 以 artifactId 为父，提交编辑后的内容为新版本（version+1）；返回新产物行。 */
export async function createArtifactVersion(
  artifactId: string,
  body: { content: unknown; title?: string },
): Promise<ArtifactRow> {
  const { artifact } = await json<{ artifact: ArtifactRow }>(
    fetch(`/api/artifacts/${artifactId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return artifact
}

export async function compareArtifactSemanticDiff(body: {
  artifactV1Id: string
  artifactV2Id: string
}): Promise<ArtifactSemanticDiffRow> {
  const { semanticDiff } = await json<{ semanticDiff: ArtifactSemanticDiffRow }>(
    fetch('/api/artifact-semantic-diffs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return semanticDiff
}

export async function fetchArtifactSemanticDiffs(
  artifactId?: string,
): Promise<ArtifactSemanticDiffRow[]> {
  const qs = artifactId ? `?artifactId=${encodeURIComponent(artifactId)}` : ''
  const { semanticDiffs } = await json<{ semanticDiffs: ArtifactSemanticDiffRow[] }>(
    fetch(`/api/artifact-semantic-diffs${qs}`),
  )
  return semanticDiffs
}

export async function deleteArtifact(artifactId: string): Promise<void> {
  await json<{ ok: true }>(
    fetch(`/api/artifacts/${artifactId}`, { method: 'DELETE' }),
  )
}

// ─── Attachments ───────────────────────────────
export async function fetchAttachments(conversationId: string): Promise<AttachmentRow[]> {
  const { attachments } = await json<{ attachments: AttachmentRow[] }>(
    fetch(`/api/conversations/${conversationId}/attachments`),
  )
  return attachments
}

export async function uploadAttachment(
  conversationId: string,
  file: File,
): Promise<AttachmentRow> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`/api/conversations/${conversationId}/attachments`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body || res.statusText}`)
  }
  const { attachment } = (await res.json()) as { attachment: AttachmentRow }
  return attachment
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  await json<{ ok: true }>(fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' }))
}

export function attachmentDownloadUrl(attachmentId: string): string {
  return `/api/attachments/${attachmentId}`
}

// ─── Usage / Analytics ─────────────────────────────
export interface UsageBucket {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  totalTokens: number
  runs: number
}

export interface ContextUsageSummary {
  limitTokens: number
  usedTokens: number
  promptTokens: number
  completionTokens: number
  reasoningTokens: number
  otherTokens: number
  totalTokens: number
  percent: number
}

export interface RuntimeUsageSummary {
  elapsedMs: number
  requestCount: number
  conversationTokens: number
  cacheHitTokens: number
  cacheHitRate: number
  estimatedCostUsd: number
  contextStatus: 'normal' | 'near_limit' | 'over_limit'
  compressionPercent: number
  contextSummaryCount: number
}

export interface UsageCostBreakdown {
  inputCostUsd: number
  outputCostUsd: number
  cacheReadCostUsd: number
  cacheCreationCostUsd: number
  promptCostUsd: number
  totalCostUsd: number
  uncachedPromptCostUsd: number
  savedUsd: number
  effectivePromptCostPercent: number
}

export interface PromptCacheStrategySummary {
  mode: 'append_only_stable_prefix'
  label: string
  cacheablePrefixTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  cacheHitRate: number
  targetHitRate: number
  effectiveInputCostPercent: number
  estimatedSavedUsd: number
  targetInputCostPercent: number
  stablePrefixSections: string[]
  recommendations: string[]
}

export interface ProjectContextUsageSummary {
  mode: 'lazy_files'
  fileReadCharLimit: number
  artifactStrategy: 'lazy_reference'
  keepsPinnedMessages: boolean
  summaryTokens: number
  rules: string[]
}

export interface UsageSummary {
  today: UsageBucket
  week: UsageBucket
  allTime: UsageBucket
  context: ContextUsageSummary
  runtime: RuntimeUsageSummary
  promptCache: PromptCacheStrategySummary
  projectContext: ProjectContextUsageSummary
  topConversations: Array<{
    id: string
    title: string
    totalTokens: number
    runs: number
    updatedAt: number
  }>
  byAgent: Array<{
    agentId: string
    name: string
    totalTokens: number
    runs: number
    estimatedCostUsd: number
    sharePercent: number
    avgTokensPerRun: number
  }>
  byModel: Array<
    UsageBucket & {
      model: string
      provider: string | null
      estimatedCostUsd: number
      estimatedUncachedPromptCostUsd: number
      estimatedSavedUsd: number
      sharePercent: number
      costSharePercent: number
      avgTokensPerRun: number
      cacheHitRate: number
      last7dCostUsd: number
      projectedMonthlyCostUsd: number
      costBreakdown: UsageCostBreakdown
    }
  >
}

export async function fetchUsageSummary(): Promise<UsageSummary> {
  return json<UsageSummary>(fetch('/api/usage/summary'))
}

export type RunActivityKind = 'employee_run' | 'agent_run'
export type RunActivityBrainStatus =
  | 'not_applicable'
  | 'waiting_reflection'
  | 'learned'
  | 'needs_review'
  | 'failure_lesson'

export interface RunActivitySummaryRun {
  id: string
  kind: RunActivityKind
  title: string
  status: string
  agentName: string | null
  phase: string
  currentStep: string
  startedAt: number
  updatedAt: number
  artifactCount: number
  toolActionCount: number
  brainStatus: RunActivityBrainStatus
  brainLabel: string
}

export interface RunActivitySummaryEvent {
  id: string
  runId: string
  kind: 'employee_event' | 'agent_run'
  phase: string
  status: string
  message: string
  createdAt: number
}

export interface RunActivitySummary {
  totals: {
    running: number
    queued: number
    completedToday: number
    failedToday: number
    toolActions: number
    artifacts: number
  }
  recentRuns: RunActivitySummaryRun[]
  recentEvents: RunActivitySummaryEvent[]
}

export async function fetchRunActivitySummary(): Promise<RunActivitySummary> {
  return json<RunActivitySummary>(fetch('/api/run-activity/summary'))
}

// ─── Mobile companion connection hints ─────────────
export interface ConnectionHint {
  kind: 'tailscale' | 'lan' | 'local'
  label: string
  host: string
  url: string
  interfaceName?: string
}

export async function fetchConnectionHints(): Promise<ConnectionHint[]> {
  const { hints } = await json<{ hints: ConnectionHint[] }>(fetch('/api/connection-hints'))
  return hints
}

// ─── App Settings (全局 API key) ───────────────
export async function fetchAppSettings(): Promise<AppSettingsRow> {
  const { settings } = await json<{ settings: AppSettingsRow }>(fetch('/api/settings'))
  return settings
}

export interface AppSettingsPatchBody {
  anthropicApiKey?: string | null
  anthropicBaseUrl?: string | null
  openaiApiKey?: string | null
  deepseekApiKey?: string | null
  arkApiKey?: string | null
  companionMode?: 'off' | 'lan' | 'tailnet'
  mobileDeviceToken?: string | null
  deploymentPublishEnabled?: boolean
  deploymentPublishDir?: string | null
  deploymentPublicBaseUrl?: string | null
}

export async function updateAppSettings(patch: AppSettingsPatchBody): Promise<AppSettingsRow> {
  const { settings } = await json<{ settings: AppSettingsRow }>(
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
  return settings
}

export async function regenerateMobileDeviceToken(): Promise<AppSettingsRow> {
  const { settings } = await json<{ settings: AppSettingsRow }>(
    fetch('/api/settings/mobile-token', { method: 'POST' }),
  )
  return settings
}
