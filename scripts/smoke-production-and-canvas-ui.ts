import { chromium, type Locator, type Page } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const uiText = {
  workbenchNav: '\u5de5\u4f5c\u53f0',
  workbenchTitle: '\u7535\u8111\u7aef\u5de5\u4f5c\u53f0',
  workbenchStart: '\u5f00\u59cb\u5de5\u4f5c',
  workbenchRunSite: '\u8fd0\u884c\u73b0\u573a',
  workbenchActivity: '\u5458\u5de5\u73b0\u573a',
  workbenchQueued: '\u6392\u961f',
  workbenchToolActions: '\u5de5\u5177\u52a8\u4f5c',
  workbenchNoRealRun: '\u8fd8\u6ca1\u6709\u771f\u5b9e\u8fd0\u884c\u8bb0\u5f55',
  workbenchRunDetail: '\u8fd0\u884c\u8be6\u60c5',
  workbenchPlanSteps: '\u8ba1\u5212\u6b65\u9aa4',
  workbenchRunEvents: '\u8fd0\u884c\u4e8b\u4ef6',
  workbenchRuntimeEnvironment: '\u8fd0\u884c\u5de5\u4f4d',
  workbenchWorkspacePath: '\u5de5\u4f5c\u76ee\u5f55',
  workbenchBrowserProfile: '\u6d4f\u89c8\u5668\u73af\u5883',
  workbenchCapabilities: '\u7535\u8111\u80fd\u529b',
  workbenchTeamMode: '\u56e2\u961f\u5458\u5de5\u6267\u884c',
  workbenchModelMode: '\u5355\u6a21\u578b\u5bf9\u8bdd',
  workbenchAssignment: '\u5c06\u4f7f\u7528\uff1a',
  workbenchReadiness: '\u5f00\u5de5\u524d\u68c0\u67e5',
  workbenchModelReady: '\u6a21\u578b\u53ef\u7528',
  workbenchAgentReady: '\u5458\u5de5\u53ef\u8fd0\u884c',
  workbenchSkillReady: '\u6280\u80fd\u5df2\u88c5\u597d',
  workbenchToolReady: '\u5de5\u5177\u5df2\u63a5\u5165',
  workbenchDesktopSafe: '\u684c\u9762\u5b89\u5168',
  workbenchReadyRatio: '\u5c31\u7eea',
  workbenchAutoPackage: '\u7cfb\u7edf\u4f1a\u81ea\u52a8\u51c6\u5907',
  workbenchPackageBadge: '\u5de5\u4f5c\u5305',
  workbenchCodePackage: '\u4ee3\u7801 / \u6587\u4ef6',
  workbenchCurrentTask: '\u5f53\u524d\u4efb\u52a1',
  workbenchAssignee: '\u8d1f\u8d23\u4eba',
  workbenchDeliverables: '\u4ea4\u4ed8\u7ed9\u5ba2\u6237\u770b\u5230',
  workbenchStablePrefix: '\u7a33\u5b9a\u524d\u7f00',
  workbenchSmokeGoal: 'Smoke workbench direct task',
  productionNav: '\u4ea4\u4ed8\u68c0\u67e5',
  settingsButton: 'API \u8bbe\u7f6e',
  settingsTitle: '\u8bbe\u7f6e',
  settingsKeysTab: '\u4f9b\u5e94\u5546 Key',
  mobileTab: '\u79fb\u52a8\u7aef',
  productionTitle: '\u4ea4\u4ed8\u68c0\u67e5',
  productionScore: '\u4ea4\u4ed8\u51c6\u5907\u5ea6',
  productionActions: '\u4ea4\u4ed8\u6d41\u7a0b',
  generateGoLive: '\u751f\u6210\u4ea4\u4ed8\u5224\u5b9a',
  generateLivePilot: '\u751f\u6210\u8bd5\u8fd0\u884c\u51ed\u8bc1',
  startLivePilot: '\u5f00\u59cb\u8bd5\u8fd0\u884c',
  exportActivation: '\u5bfc\u51fa\u73b0\u573a\u6fc0\u6d3b\u5305',
  exportCustomer: '\u5bfc\u51fa\u5ba2\u6237\u73af\u5883\u5305',
  deliveryStep: '\u68c0\u67e5\u57fa\u7840\u80fd\u529b',
  mobileCheck: '\u68c0\u67e5\u624b\u673a\u8fde\u63a5',
  conversationNav: '\u5bf9\u8bdd',
  newConversation: '\u65b0\u5efa\u5bf9\u8bdd',
  workArea: '\u5de5\u4f5c\u5bf9\u8bdd\u533a',
  plainModelConversationSection: '\u666e\u901a\u6a21\u578b\u5bf9\u8bdd',
  plainModelChatLabel: '\u666e\u901a\u5bf9\u8bdd \u00b7 \u6a21\u578b\u804a\u5929',
  workAreaNotModelChat: '\u4e0d\u662f\u666e\u901a\u6a21\u578b\u804a\u5929',
  modelPicker: '\u9009\u62e9\u6a21\u578b',
  chatInput: '\u8f93\u5165\u6d88\u606f',
  modelConversationCopy: '\u5355\u72ec\u7684\u666e\u901a\u804a\u5929\u7a97\u53e3',
  workAreaCopy: '\u591a\u667a\u80fd\u4f53\u534f\u4f5c',
  workspaceDirectory: '\u5de5\u4f5c\u76ee\u5f55',

  modelsNav: '\u6a21\u578b\u7ba1\u7406',
  modelsTitle: '\u6a21\u578b\u7ba1\u7406',
  addModel: '\u6dfb\u52a0\u6a21\u578b',
  saveModel: '\u4fdd\u5b58\u6a21\u578b',
  deleteModel: '\u5220\u9664\u6a21\u578b',
  confirmDeleteModel: '\u786e\u8ba4\u5220\u9664\u6a21\u578b',
  modelNamePlaceholder: '\u4f8b\u5982\uff1aDeepSeek \u4e3b\u6a21\u578b',
  modelIdPlaceholder: '\u4f8b\u5982\uff1adeepseek-v4-flash',
  modelWorkbench: '\u6a21\u578b\u8fde\u63a5\u5de5\u4f5c\u53f0',
  preferredModel: '\u9996\u9009\u6a21\u578b',
  modelConnectionStatus: '\u8fde\u63a5\u72b6\u6001',
  modelNetworkOutlet: '\u7f51\u7edc\u51fa\u53e3',
  modelFailureReason: '\u5931\u8d25\u539f\u56e0',
  oneClickTest: '\u4e00\u952e\u68c0\u6d4b',
  setPreferredModel: '\u8bbe\u4e3a\u9996\u9009\u6a21\u578b',

  agentsNav: '\u667a\u80fd\u4f53',
  oldFactoryNav: '\u667a\u80fd\u4f53\u5de5\u5382',
  createAgent: '\u65b0\u5efa',
  agentInlineSettingsCopy: '\u8fd9\u91cc\u5c31\u662f\u667a\u80fd\u4f53\u8bbe\u7f6e\u5165\u53e3',
  agentSettingsButtonTitle: '\u8bbe\u7f6e\u667a\u80fd\u4f53',
  agentOpenFullConfig: '\u6253\u5f00\u5b8c\u6574\u914d\u7f6e',
  agentLightSkills: '\u6280\u80fd\u4e0e\u5de5\u5177',
  agentLightMemory: '\u8bb0\u5fc6\u4e0e\u4e0a\u4e0b\u6587',
  agentLightSafety: '\u6743\u9650\u4e0e\u5b89\u5168',
  agentLightDelivery: '\u4ea4\u4ed8\u7269',
  agentAbilityTab: '\u80fd\u529b\u8bbe\u7f6e',
  agentIdentitySection: '\u8eab\u4efd\u4e0e\u4ea7\u7269',
  agentMemoryContextSection: '\u8bb0\u5fc6\u3001\u4e0a\u4e0b\u6587\u4e0e\u534f\u4f5c',
  agentSecuritySection: '\u5b89\u5168\u6743\u9650\u4e0e\u81ea\u4e3b\u6027',
  agentEmployeeControl: '\u5458\u5de5\u80fd\u529b\u63a7\u5236\u53f0',
  agentUnifiedSettings: '\u7edf\u4e00\u5728\u667a\u80fd\u4f53\u8bbe\u7f6e\u91cc\u7ba1\u7406',
  agentToolbox: '\u5458\u5de5\u5de5\u5177\u5305',
  agentToolboxCopy: '\u6a21\u578b\u3001\u6280\u80fd\u3001CLI\u3001MCP\u3001\u8f6f\u4ef6\u548c\u6743\u9650',
  agentAssignAbility: '\u5206\u914d\u80fd\u529b',
  agentCustomerDelivery: '\u4ea4\u4ed8\u7ed9\u5ba2\u6237\u770b\u5230',
  agentPermissionSafety: '\u6743\u9650\u4e0e\u5b89\u5168',
  agentCollaborationMode: '\u534f\u4f5c\u65b9\u5f0f',
  agentDeliveryOutput: '\u8f93\u51fa\u4ea4\u4ed8',
  agentUnifiedCapabilities: '\u6280\u80fd / MCP / CLI / \u8f6f\u4ef6',
  agentCurrentSummary: '\u8fd9\u4e2a\u667a\u80fd\u4f53\u73b0\u5728\u7684\u914d\u7f6e',
  agentEmployeeName: '\u5458\u5de5\u540d\u79f0',
  agentRequiredDelivery: '\u5fc5\u987b\u4ea4\u4ed8',
  agentUseModel: '\u4f7f\u7528\u6a21\u578b',
  agentWorkstation: '\u5de5\u4f5c\u4f4d\u7f6e',
  agentCommandAbility: '\u547d\u4ee4\u884c\u80fd\u529b',
  agentToolConnection: '\u5de5\u5177\u8fde\u63a5',
  agentSoftwareAbility: '\u8f6f\u4ef6\u80fd\u529b',
  saveCurrentAgent: '\u4fdd\u5b58\u5f53\u524d\u8bbe\u7f6e',
  newAgentProfile: '\u65b0\u5efa\u914d\u7f6e',
  detailedConfig: '\u8be6\u7ec6\u914d\u7f6e',
  abilityPromptTab: '\u80fd\u529b\u4e0e\u63d0\u793a\u8bcd',
  installedSkills: '\u5df2\u5b89\u88c5\u6280\u80fd',
  mcpTools: 'MCP \u5de5\u5177',
  cliCommands: '\u547d\u4ee4\u884c\u5de5\u5177',

  toolsNav: '\u5de5\u5177\u8fde\u63a5',
  toolsTitle: '\u8f6f\u4ef6\u80fd\u529b\u5546\u5e97',
  advancedTools: '\u9ad8\u7ea7\u914d\u7f6e',
  toolsSearchPlaceholder: '\u641c\u7d22\u8f6f\u4ef6\u3001CLI\u3001MCP',
  toolsCategory: '\u5f00\u53d1\u5de5\u5177',
  toolsSoftwareCard: 'Codex CLI',
  toolsModeStat: 'CLI / MCP \u6a21\u5f0f',
  toolsAccessAssistant: '\u8f6f\u4ef6\u63a5\u5165\u52a9\u624b',
  toolsCurrentSoftware: '\u5f53\u524d\u8f6f\u4ef6',
  toolsRecommendedAccess: '\u63a8\u8350\u63a5\u5165\u65b9\u5f0f',
  toolsViewCliOrMcp: '\u67e5\u770b CLI \u6216 MCP',
  toolsOneClickFindSoftware: '\u4e00\u952e\u627e\u8f6f\u4ef6',
  toolsNextStep: '\u4e0b\u4e00\u6b65',
  toolsIntro: '\u8f6f\u4ef6\u4ecb\u7ecd',
  toolsSoftwareCardHero: '\u8f6f\u4ef6\u540d\u7247',
  toolsConnectionOverview: '\u63a5\u5165\u603b\u89c8',
  toolsAssignmentPath: '\u5206\u914d\u8def\u5f84',
  toolsGoAssignToAgent: '\u53bb\u5206\u914d\u7ed9\u667a\u80fd\u4f53',
  toolsSoftwareDetail: '\u8f6f\u4ef6\u8be6\u60c5',
  toolsAccessMatrix: '\u80fd\u529b\u63a5\u5165\u9762\u677f',
  toolsCurrentChoice: '\u5f53\u524d\u9009\u62e9',
  toolsCliMode: 'CLI \u6a21\u5f0f',
  toolsMcpMode: 'MCP \u6a21\u5f0f',
  toolsPackagedCommands: '\u5c01\u88c5\u547d\u4ee4',
  toolsAssignableToAgent: '\u53ef\u5206\u914d\u7ed9\u667a\u80fd\u4f53',
  toolsAgentUse: '\u7ed9\u667a\u80fd\u4f53\u4f7f\u7528',
  toolsAssignToAgent: '\u6253\u5f00\u667a\u80fd\u4f53\u8bbe\u7f6e\u5e76\u5206\u914d',
  toolsUsePath: '\u8f6f\u4ef6\u600e\u4e48\u53d8\u6210\u667a\u80fd\u4f53\u80fd\u529b',
  toolsStepChoose: '\u9009\u62e9\u8f6f\u4ef6',
  toolsStepCheck: '\u68c0\u6d4b\u63a5\u5165',
  toolsStepAssign: '\u5206\u914d\u7ed9\u667a\u80fd\u4f53',
  toolsAssignmentPlan: '\u5206\u914d\u5efa\u8bae',
  toolsFitAgent: '\u9002\u5408\u667a\u80fd\u4f53',
  toolsAccessRoute: '\u63a5\u5165\u8def\u7ebf',
  toolsCliAccess: 'CLI \u63a5\u5165',
  toolsMcpAccess: 'MCP \u63a5\u5165',
  toolsAvailableCommands: '\u53ef\u7528\u547d\u4ee4',

  skillsNav: '\u6280\u80fd\u4e2d\u5fc3',
  skillsMarket: 'SkillsMP \u6280\u80fd\u5e02\u573a',
  skillsCli: 'SkillsMP CLI',
  removedSkillsSearchPlaceholder: '\u641c\u7d22\u6280\u80fd\uff0c\u6bd4\u5982\uff1a\u5199\u4ee3\u7801\u3001\u8fd0\u8425\u3001\u6d4f\u89c8\u5668\u3001\u89c6\u9891',
  skillsCommandBar: '\u6280\u80fd\u5e02\u573a\u5de5\u4f5c\u53f0',
  skillsInstallAssistant: '\u6280\u80fd\u5b89\u88c5\u52a9\u624b',
  skillsChooseRecommended: '\u9009\u62e9\u4e00\u4e2a\u63a8\u8350\u6280\u80fd',
  skillsSelectedSkill: '\u5f53\u524d\u9009\u4e2d\u6280\u80fd',
  skillsNextStep: '\u4e0b\u4e00\u6b65',
  skillsCurrentSkill: '\u5f53\u524d\u6280\u80fd',
  skillsRecommendAgent: '\u63a8\u8350\u7ed9',
  skillsFeatured: '\u63a8\u8350\u6280\u80fd',
  skillsUsePath: '\u6280\u80fd\u600e\u4e48\u53d8\u6210\u667a\u80fd\u4f53\u80fd\u529b',
  skillsStepChooseRecommended: '\u9009\u62e9\u63a8\u8350\u6280\u80fd',
  skillsStepInstall: '\u5b89\u88c5\u5230\u672c\u5730',
  skillsStepAssign: '\u5206\u914d\u7ed9\u667a\u80fd\u4f53',
  skillsInstalledHint: '\u5df2\u5b89\u88c5\u6280\u80fd\u4f1a\u51fa\u73b0\u5728\u667a\u80fd\u4f53\u8bbe\u7f6e\u91cc',
  skillsAssignmentPlan: '\u5206\u914d\u5efa\u8bae',
  skillsSmokeResult: 'code-review-plus',
  skillsDetailHero: '\u6280\u80fd\u540d\u7247',
  skillsMarketSignal: '\u5e02\u573a\u70ed\u5ea6',
  skillsInstallAssignPath: '\u5b89\u88c5\u4e0e\u5206\u914d\u8def\u5f84',
  skillsGoAssignToAgent: '\u53bb\u5206\u914d\u7ed9\u667a\u80fd\u4f53',
  skillsAgentFit: '\u667a\u80fd\u4f53\u9002\u914d',
  skillsSuitableRole: '\u9002\u5408\u5c97\u4f4d',
  skillsCapabilityBoost: '\u80fd\u529b\u589e\u76ca',
  skillsConfigLocation: '\u914d\u7f6e\u4f4d\u7f6e',
  skillsDetailAgentUse: '\u7ed9\u667a\u80fd\u4f53\u4f7f\u7528',
  skillsAssignToAgent: '\u6253\u5f00\u667a\u80fd\u4f53\u8bbe\u7f6e\u5e76\u5206\u914d',
  skillsInstallLocal: '\u5b89\u88c5\u5230\u672c\u5730',

  canvasNav: '\u7f16\u6392\u753b\u5e03',
  canvasTitle: '\u667a\u80fd\u4f53\u7f16\u6392\u753b\u5e03',
  addAgent: '\u6dfb\u52a0\u667a\u80fd\u4f53',
  canvasCustomerFinal: '\u5ba2\u6237\u6700\u7ec8\u80fd\u770b\u5230',
  artifactQuickPicker: '\u62a5\u544a',
  inlineEditor: '\u753b\u5e03\u5185\u7f16\u8f91',
  nodeName: '\u8282\u70b9\u540d\u79f0',
  customerDeliverables: '\u5ba2\u6237\u4ea4\u4ed8\u7269',
  canvasCustomerDeliverySummary: '\u5ba2\u6237\u4ea4\u4ed8\u603b\u89c8',
  canvasPrimaryDeliverable: '\u4e3b\u4ea4\u4ed8',
  canvasCustomerGets: '\u5ba2\u6237\u62ff\u5230',
  canvasAcceptanceNextStep: '\u9a8c\u6536\u4e0b\u4e00\u6b65',
  customerVisible: '\u5ba2\u6237\u53ef\u89c1',
  videoArtifact: '\u89c6\u9891',
  canvasNodeProgress: '\u8282\u70b9\u8fdb\u5ea6',
  canvasNodeDelivery: '\u4ea4\u4ed8 \u89c6\u9891',
  canvasVideoFileHint: '\u89c6\u9891 \u00b7 \u89c6\u9891\u6587\u4ef6',
  canvasNodeComplete: '\u5df2\u5b8c\u6210',
  canvasNodeCompleteStep: '\u5df2\u751f\u6210\u5ba2\u6237\u53ef\u89c1\u89c6\u9891\u4ea7\u7269',
  canvasDeliveryChecklist: '\u4ea4\u4ed8\u6e05\u5355',
  canvasCurrentArtifact: '\u5f53\u524d\u4ea7\u7269',
  canvasAcceptanceState: '\u9a8c\u6536\u72b6\u6001',
  canvasProduced: '\u5df2\u4ea7\u51fa',
  canvasPendingArtifact: '\u5f85\u4ea7\u51fa',
  canvasCustomerAcceptance: '\u5ba2\u6237\u9a8c\u6536\u89c6\u56fe',
  canvasPreviewMode: '\u9884\u89c8\u5f62\u5f0f',
  canvasDeliveryFile: '\u4ea4\u4ed8\u6587\u4ef6',
  canvasOwnerNode: '\u8d1f\u8d23\u8282\u70b9',
  canvasAcceptanceRule: '\u9a8c\u6536\u53e3\u5f84',
  canvasRunStatus: '\u8fd0\u884c\u72b6\u6001',
  canvasNextStep: '\u4e0b\u4e00\u6b65',
  startCanvasConnection: '\u4ece\u8fd9\u4e2a\u8282\u70b9\u5f00\u59cb\u8fde\u7ebf',
  connectingPaletteHint: '\u4f1a\u81ea\u52a8\u63a5\u5230\u5f53\u524d\u8fde\u7ebf\u6e90',
  canvasZoomIn: '\u653e\u5927\u753b\u5e03',
  canvasFitView: '\u9002\u914d\u89c6\u56fe',
  saveWorkflow: '\u4fdd\u5b58',
  runWorkflow: '\u8fd0\u884c',
  advancedSettings: '\u9ad8\u7ea7\u8bbe\u7f6e',
  runMonitor: '\u8fd0\u884c\u4e0e\u76d1\u63a7',
  analyticsNav: '\u6570\u636e\u5206\u6790',
  analyticsTitle: '\u6570\u636e\u5206\u6790',
  costCommandCenter: '\u6210\u672c\u9a7e\u9a76\u8231',
  modelActualConsumptionRanking: '\u6a21\u578b\u5b9e\u9645\u6d88\u8017\u6392\u884c',
  modelActualPaidTotal: '\u5b9e\u4ed8\u603b\u989d',
  modelActualTokenTotal: '\u603b token',
  modelActualCacheSaved: '\u7f13\u5b58\u7701\u4e0b',
  modelSpendRanking: '\u6a21\u578b\u82b1\u8d39\u6392\u884c',
  agentSpendRanking: 'Agent \u6d88\u8017\u6392\u884c',
  inputCostReducedTo: '\u8f93\u5165\u6210\u672c\u964d\u81f3',
  topSpendingModel: '\u6700\u70e7\u94b1\u6a21\u578b',
  modelBillOverview: '\u6a21\u578b\u8d26\u5355\u603b\u89c8',
  modelSpendLedger: '\u6a21\u578b\u5b9e\u4ed8\u8d26\u5355\u770b\u677f',
  actualTotalSpend: '\u5b9e\u9645\u603b\u82b1\u8d39',
  coveredModels: '\u8986\u76d6\u6a21\u578b',
  billReading: '\u8d26\u5355\u89e3\u8bfb',
  modelToWatch: '\u6700\u8be5\u76ef\u7684\u6a21\u578b',
  modelBillMonthlyProjection: '\u6708\u8d26\u5355\u9884\u4f30',
  modelAverageRequestCost: '\u6bcf\u6b21\u8bf7\u6c42\u5747\u4ef7',
  modelOptimizationAdvice: '\u4f18\u5316\u5efa\u8bae',
  modelActualUsage: '\u6a21\u578b\u5b9e\u9645\u6d88\u8017',
  modelBillRanking: '\u6a21\u578b\u8d39\u7528\u6392\u884c',
  modelCostDiagnosis: '\u6a21\u578b\u8d39\u7528\u8bca\u65ad',
  actualBill: '\u5b9e\u9645\u8d26\u5355',
  actualSpend: '\u5b9e\u9645\u82b1\u8d39',
  cacheSaved: '\u7f13\u5b58\u8282\u7701',
  cacheSavingRate: '\u7f13\u5b58\u7701\u94b1\u7387',
  noCacheEstimate: '\u65e0\u7f13\u5b58\u4f30\u7b97',
  avgCostPerRequest: '\u8bf7\u6c42\u5747\u4ef7',
  optimizableModel: '\u53ef\u4f18\u5316\u6a21\u578b',
  modelBillDetail: '\u6a21\u578b\u8d26\u5355\u660e\u7ec6',
  costShare: '\u6210\u672c\u5360\u6bd4',
  savedVsNoCache: '\u5b9e\u9645\u6bd4\u65e0\u7f13\u5b58\u5c11',
  contextWindow: '\u4e0a\u4e0b\u6587\u7a97\u53e3',
  runtimeMetrics: '\u8fd0\u884c\u6307\u6807',
  costTitle: '\u6210\u672c',
  sessionStatus: '\u4f1a\u8bdd\u72b6\u6001',
  promptCacheTitle: '\u957f\u4f1a\u8bdd\u7f13\u5b58',
  appendOnlyContext: '\u8ffd\u52a0\u5f0f\u4e0a\u4e0b\u6587',
  targetCacheHit: '\u76ee\u6807\u547d\u4e2d',
  projectContext: '\u5de5\u7a0b\u6587\u4ef6\u4e0a\u4e0b\u6587',
  schedulerNav: '\u4efb\u52a1\u8c03\u5ea6',
  schedulerTitle: '\u4efb\u52a1\u8c03\u5ea6',
  schedulerQueue: '\u4efb\u52a1\u961f\u5217',
  schedulerRules: '\u5b9a\u65f6\u89c4\u5219',
  schedulerQuickActions: '\u5feb\u901f\u64cd\u4f5c',
  schedulerRunDue: '\u7acb\u5373\u8fd0\u884c\u5230\u671f\u4efb\u52a1',
  artifactsNav: '\u4ea4\u4ed8\u7269',
  artifactsTitle: '\u4ea4\u4ed8\u7269\u4e2d\u5fc3',
  artifactsSearch: '\u641c\u7d22\u4ea4\u4ed8\u7269',
  artifactsVersions: '\u5168\u90e8\u7248\u672c',
  artifactsSource: '\u6765\u6e90\u4f1a\u8bdd',
  artifactsCustomerOverview: '\u5ba2\u6237\u53ef\u89c1\u4ea4\u4ed8\u603b\u89c8',
  artifactsAgentOutput: 'Agent \u6700\u7ec8\u4ea7\u7269',
  artifactsGenerateOutput: '\u751f\u6210\u4ea7\u7269',
  artifactsPreviewAcceptance: '\u9884\u89c8\u9a8c\u6536',
  artifactsPackageDelivery: '\u6253\u5305\u4ea4\u4ed8',
  artifactsPendingReview: '\u5f85\u4eba\u5de5\u786e\u8ba4',
  artifactsLoading: '\u6b63\u5728\u52a0\u8f7d\u4ea4\u4ed8\u7269',
  artifactsPackage: '\u5ba2\u6237\u4ea4\u4ed8\u5305',
  artifactsCustomerReadable: '\u5ba2\u6237\u53ef\u8bfb',
  artifactsPreviewable: '\u53ef\u9884\u89c8',
  artifactsTraceable: '\u53ef\u8ffd\u6eaf',
  artifactsDeliveryCheck: '\u4ea4\u4ed8\u68c0\u67e5',
  monitorNav: '\u8fd0\u884c\u73b0\u573a',
  monitorTitle: '\u8fd0\u884c\u73b0\u573a',
  monitorSceneOverview: '\u73b0\u573a\u603b\u89c8',
  monitorCurrentRuns: '\u4efb\u52a1\u961f\u5217\u4e0e\u5f53\u524d\u6b65\u9aa4',
  monitorRecentEvents: '\u6700\u8fd1\u4e8b\u4ef6',
  monitorNeedHandle: '\u662f\u5426\u9700\u8981\u5904\u7406',
  monitorDeliveryState: '\u4ea4\u4ed8\u7269\u72b6\u6001',
  monitorNextStep: '\u4e0b\u4e00\u6b65',
  monitorAdvanced: '\u9ad8\u7ea7\u76d1\u63a7',
  monitorArtifacts: '\u4ea7\u7269',
  moreFeatures: '\u66f4\u591a\u529f\u80fd',
  hiddenAdvancedNav: [
    '\u8bb0\u5fc6\u5b66\u4e60',
    '\u4e0a\u4e0b\u6587',
    '\u80fd\u529b\u56fe\u8c31',
    '\u56e2\u961f\u534f\u4f5c',
    '\u5b89\u5168\u6cbb\u7406',
    '\u914d\u7f6e\u7ba1\u7406',
  ],
}

async function main() {
  const baseUrl = process.env.AGENTHUB_UI_URL ?? 'http://127.0.0.1:3101'
  const outDir = path.resolve('output/playwright')
  mkdirSync(outDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveLocalBrowserExecutable(),
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.getByText('AgentHub').first().waitFor({ timeout: 90_000 })
  const sidebar = page.locator('aside').first()
  await page.getByTestId('desktop-workbench').waitFor({ timeout: 90_000 })
  await page.waitForTimeout(2_000)
  await cleanupSmokeModels(page, baseUrl)

  const workbenchText = await page.locator('main').innerText()
  const initialSidebarText = await sidebar.innerText()
  const workbenchScreenshot = path.join(outDir, 'desktop-workbench-home.png')
  await page.screenshot({ path: workbenchScreenshot, fullPage: true })
  const workbenchChecks = {
    defaultWorkbench: workbenchText.includes(uiText.workbenchTitle),
    startAction: workbenchText.includes(uiText.workbenchStart),
    runSite: workbenchText.includes(uiText.workbenchRunSite),
    liveActivity: workbenchText.includes(uiText.workbenchActivity),
    activityQueue: workbenchText.includes(uiText.workbenchQueued),
    activityToolActions: workbenchText.includes(uiText.workbenchToolActions),
    activityEmptyOrRows: workbenchText.includes(uiText.workbenchNoRealRun) ||
      workbenchText.includes('\u6700\u8fd1\u8fd0\u884c'),
    capabilities: workbenchText.includes(uiText.workbenchCapabilities),
    teamMode: workbenchText.includes(uiText.workbenchTeamMode),
    modelMode: workbenchText.includes(uiText.workbenchModelMode),
    assignmentPreview: workbenchText.includes(uiText.workbenchAssignment),
    readiness: workbenchText.includes(uiText.workbenchReadiness),
    readinessNode: await page.getByTestId('workbench-readiness-checklist').isVisible(),
    modelReady: workbenchText.includes(uiText.workbenchModelReady),
    agentReady: workbenchText.includes(uiText.workbenchAgentReady),
    skillReady: workbenchText.includes(uiText.workbenchSkillReady),
    toolReady: workbenchText.includes(uiText.workbenchToolReady),
    desktopSafe: workbenchText.includes(uiText.workbenchDesktopSafe),
    readyRatio: workbenchText.includes(uiText.workbenchReadyRatio),
    autoPackage: workbenchText.includes(uiText.workbenchAutoPackage),
    packageBadge: workbenchText.includes(uiText.workbenchPackageBadge),
    codePackage: workbenchText.includes(uiText.workbenchCodePackage),
    currentTaskPreview: workbenchText.includes(uiText.workbenchCurrentTask),
    assigneePreview: workbenchText.includes(uiText.workbenchAssignee),
    deliverablePreview: workbenchText.includes(uiText.workbenchDeliverables),
    stablePrefixPolicy: workbenchText.includes(uiText.workbenchStablePrefix),
    noGarbledRunTitle: !/\?{6,}/.test(workbenchText),
    productionHiddenFromPrimaryNav: !initialSidebarText.includes(uiText.productionNav),
  }
  for (const [key, value] of Object.entries(workbenchChecks)) {
    if (!value) throw new Error(`Desktop workbench check failed: ${key}.`)
  }
  await page.locator('main button', { hasText: uiText.workbenchModelMode }).click()
  await page.waitForFunction(() => document.querySelector('main')?.textContent?.includes('普通对话'), null, {
    timeout: 10_000,
  })
  if (!(await page.locator('main').innerText()).includes('\u666e\u901a\u5bf9\u8bdd')) {
    throw new Error('Workbench model mode should update the assignment preview.')
  }
  await page.locator('main button', { hasText: uiText.workbenchTeamMode }).click()

  let workbenchEmployeeRunStarted = 0
  await page.route('**/api/agent-profiles/*/run', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    workbenchEmployeeRunStarted += 1
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        employeeRun: {
          id: `run_smoke_workbench_${workbenchEmployeeRunStarted}`,
          agentProfileId: 'agent_profile_smoke',
          workflowRunId: null,
          goal: uiText.workbenchSmokeGoal,
          input: { source: 'desktop_workbench' },
          plan: ['Smoke employee run'],
          status: 'complete',
          currentPhase: 'complete',
          currentStep: 'Runtime lifecycle complete',
          output: { status: 'ready_for_executor' },
          error: null,
          budgetLimitCents: null,
          estimatedCostCents: 1,
          actualCostCents: 1,
          createdAt: Date.now(),
          startedAt: Date.now(),
          updatedAt: Date.now(),
          finishedAt: Date.now(),
        },
      }),
    })
  })
  await page.locator('main textarea').fill(uiText.workbenchSmokeGoal)
  await page.locator('main button', { hasText: uiText.workbenchStart }).click()
  await page.locator(`textarea[placeholder*="${uiText.chatInput}"]`).waitFor({ timeout: 90_000 })
  const directWorkbenchTaskVisible = (await page.locator('body').innerText()).includes(uiText.workbenchSmokeGoal)
  if (workbenchEmployeeRunStarted === 0 || !directWorkbenchTaskVisible) {
    throw new Error('Workbench start should create a conversation and start real employee runs for the typed goal.')
  }
  await page.unroute('**/api/agent-profiles/*/run')
  await clickSidebarButton(sidebar, uiText.workbenchNav)
  await page.getByTestId('desktop-workbench').waitFor({ timeout: 90_000 })
  const firstEmployeeRunRow = page.locator('[data-testid="run-activity-row"][data-kind="employee_run"]').first()
  await firstEmployeeRunRow.click({ timeout: 90_000 })
  const runSnapshotPanel = page.getByTestId('run-snapshot-panel')
  await runSnapshotPanel.waitFor({ timeout: 90_000 })
  await runSnapshotPanel.getByText(uiText.workbenchPlanSteps, { exact: true }).waitFor({ timeout: 90_000 })
  await runSnapshotPanel.getByText(uiText.workbenchRunEvents, { exact: true }).waitFor({ timeout: 90_000 })
  await runSnapshotPanel.scrollIntoViewIfNeeded()
  const runSnapshotPanelText = await runSnapshotPanel.innerText()
  const workbenchRunDetailScreenshot = path.join(outDir, 'workbench-run-detail.png')
  await page.screenshot({ path: workbenchRunDetailScreenshot, fullPage: true })
  const runDetailChecks = {
    title: runSnapshotPanelText.includes(uiText.workbenchRunDetail),
    planSteps: runSnapshotPanelText.includes(uiText.workbenchPlanSteps),
    runEvents: runSnapshotPanelText.includes(uiText.workbenchRunEvents),
    runtimeEnvironment: runSnapshotPanelText.includes(uiText.workbenchRuntimeEnvironment),
    workspacePath: runSnapshotPanelText.includes(uiText.workbenchWorkspacePath),
    browserProfile: runSnapshotPanelText.includes(uiText.workbenchBrowserProfile),
  }
  for (const [key, value] of Object.entries(runDetailChecks)) {
    if (!value) throw new Error(`Workbench run detail check failed: ${key}.`)
  }

  await sidebar.locator(`button[title="${uiText.settingsButton}"]`).click()
  const settingsDialog = page.locator('[role="dialog"]').filter({ hasText: uiText.settingsTitle }).first()
  await settingsDialog.getByText(uiText.settingsKeysTab, { exact: true }).waitFor({ timeout: 30_000 })
  const settingsDialogText = await settingsDialog.innerText()
  const settingsChecks = {
    keysVisible: settingsDialogText.includes(uiText.settingsKeysTab),
    mobileHiddenForNow: !settingsDialogText.includes(uiText.mobileTab),
  }
  for (const [key, value] of Object.entries(settingsChecks)) {
    if (!value) throw new Error(`Settings simplification check failed: ${key}.`)
  }
  await settingsDialog.getByRole('button', { name: '\u53d6\u6d88' }).click()
  await settingsDialog.waitFor({ state: 'hidden', timeout: 10_000 })

  await clickSidebarButton(sidebar, uiText.conversationNav)
  await page.getByRole('button', { name: uiText.newConversation }).click()
  await page.locator(`textarea[placeholder*="${uiText.chatInput}"]`).waitFor({ timeout: 90_000 })
  const modelPickerDialogCount = await page
    .locator('[role="dialog"]')
    .getByText(uiText.modelPicker, { exact: true })
    .count()
  if (modelPickerDialogCount > 0) {
    throw new Error('New conversation should jump directly into chat without model picker dialog.')
  }
  const directConversationScreenshot = path.join(outDir, 'new-conversation-direct-chat.png')
  await page.screenshot({ path: directConversationScreenshot, fullPage: true })
  const directConversationBodyText = await page.locator('body').innerText()
  const directConversationChecks = {
    chatInputVisible: await page.locator(`textarea[placeholder*="${uiText.chatInput}"]`).isVisible(),
    noModelPickerDialog: modelPickerDialogCount === 0,
    modelConversationSection: directConversationBodyText.includes(uiText.plainModelConversationSection),
    plainModelChatLabel: directConversationBodyText.includes(uiText.plainModelChatLabel),
  }
  for (const [key, value] of Object.entries(directConversationChecks)) {
    if (!value) throw new Error(`Direct new conversation check failed: ${key}.`)
  }

  const smokeModelName = `UI temp model ${Date.now()}`
  await openSidebarModeAndWait(page, sidebar, uiText.modelsNav, uiText.modelsTitle)
  await page.getByTestId('model-connection-workbench').waitFor({ timeout: 90_000 })
  const addModelButton = page.locator('main').getByRole('button', { name: uiText.addModel }).first()
  await addModelButton.waitFor({ timeout: 90_000 })
  await addModelButton.evaluate((element) => (element as HTMLButtonElement).click())
  const modelDialog = page.locator('[role="dialog"]').filter({ hasText: uiText.addModel }).first()
  await modelDialog.getByText(uiText.addModel, { exact: true }).waitFor({ timeout: 90_000 })
  await modelDialog.getByPlaceholder(uiText.modelNamePlaceholder).fill(smokeModelName)
  await modelDialog.getByPlaceholder(uiText.modelIdPlaceholder).fill('deepseek-v4-flash')
  await modelDialog.getByRole('button', { name: uiText.saveModel }).click()
  await modelDialog.waitFor({ state: 'hidden', timeout: 30_000 })
  const smokeModelCard = page.getByTestId('model-profile-card').filter({ hasText: smokeModelName }).first()
  await smokeModelCard.waitFor({ timeout: 90_000 })
  await smokeModelCard.getByRole('button', { name: `${uiText.deleteModel} ${smokeModelName}` }).click()
  await smokeModelCard.getByRole('button', { name: `${uiText.confirmDeleteModel} ${smokeModelName}` }).click()
  await smokeModelCard.waitFor({ state: 'hidden', timeout: 90_000 })
  const modelManagementScreenshot = path.join(outDir, 'model-management-add-delete.png')
  await page.screenshot({ path: modelManagementScreenshot, fullPage: true })
  const modelManagementBodyText = await page.locator('body').innerText()
  const modelManagementChecks = {
    title: await page.locator('main').getByText(uiText.modelsTitle, { exact: true }).isVisible(),
    addButton: await page.locator('main button', { hasText: uiText.addModel }).first().isVisible(),
    workbench: await page.getByTestId('model-connection-workbench').isVisible(),
    preferredModel: modelManagementBodyText.includes(uiText.preferredModel),
    connectionStatus: modelManagementBodyText.includes(uiText.modelConnectionStatus),
    networkOutlet: modelManagementBodyText.includes(uiText.modelNetworkOutlet),
    failureReason: modelManagementBodyText.includes(uiText.modelFailureReason),
    oneClickTest: modelManagementBodyText.includes(uiText.oneClickTest),
    setPreferredModel: modelManagementBodyText.includes(uiText.setPreferredModel),
    temporaryModelDeleted:
      (await page.getByTestId('model-profile-card').filter({ hasText: smokeModelName }).count()) === 0,
  }
  for (const [key, value] of Object.entries(modelManagementChecks)) {
    if (!value) throw new Error(`Model management UI check failed: ${key}.`)
  }

  await clickSidebarButton(sidebar, uiText.conversationNav)
  await sidebar.locator('button[title="新建工作对话区"]').click()
  const dialog = page.locator('[role="dialog"]')
  await dialog.getByText(uiText.workAreaCopy).waitFor({ timeout: 90_000 })
  await dialog.getByText(uiText.workAreaNotModelChat).waitFor({ timeout: 90_000 })
  await dialog.getByText(uiText.workspaceDirectory, { exact: true }).waitFor({ timeout: 90_000 })
  await dialog.getByRole('button', { name: '\u53d6\u6d88' }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 })

  await clickSidebarButton(sidebar, uiText.agentsNav)
  await page.getByText(uiText.createAgent, { exact: true }).waitFor({ timeout: 90_000 })
  const oldFactoryNavCount = await page.locator(`aside button[title="${uiText.oldFactoryNav}"]`).count()
  const settingsButtons = page.locator(`main button[title="${uiText.agentSettingsButtonTitle}"]`)
  const firstSettingsButton = settingsButtons.first()
  await firstSettingsButton.waitFor({ timeout: 90_000 })
  await firstSettingsButton.click()
  await page.getByText(uiText.agentOpenFullConfig, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.agentLightSkills, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.agentLightMemory, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.agentLightSafety, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.agentLightDelivery, { exact: true }).waitFor({ timeout: 90_000 })
  const agentLightBodyText = await page.locator('body').innerText()
  await page.getByText(uiText.agentOpenFullConfig, { exact: true }).click()
  await page.getByText(uiText.agentAbilityTab, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.agentIdentitySection, { exact: true }).waitFor({ timeout: 120_000 })
  await page.getByText(uiText.agentEmployeeControl, { exact: true }).waitFor({ timeout: 120_000 })
  await page.getByText(uiText.agentMemoryContextSection, { exact: true }).waitFor({ timeout: 120_000 })
  await page.getByText(uiText.agentSecuritySection, { exact: true }).waitFor({ timeout: 120_000 })
  const moreButton = sidebar.locator('button', { hasText: uiText.moreFeatures })
  if ((await moreButton.count()) > 0) await moreButton.first().click({ force: true })
  const sidebarText = await sidebar.innerText()
  const agentScreenshot = path.join(outDir, 'agents-unified-settings.png')
  await page.screenshot({ path: agentScreenshot, fullPage: true })
  const agentBodyText = await page.locator('body').innerText()
  const agentChecks = {
    singleAgentEntry: agentBodyText.includes(uiText.createAgent),
    oldFactoryNavHidden: oldFactoryNavCount === 0,
    settingsGear: (await settingsButtons.count()) > 0,
    cardSettingsEntry: (await page.getByTestId('agent-card').count()) > 0,
    agentCardToolbox: (await page.getByTestId('agent-card-toolbox').count()) > 0,
    inlineSettingsCopy: agentBodyText.includes(uiText.agentInlineSettingsCopy),
    lightSkills: agentLightBodyText.includes(uiText.agentLightSkills),
    lightMemory: agentLightBodyText.includes(uiText.agentLightMemory),
    lightSafety: agentLightBodyText.includes(uiText.agentLightSafety),
    lightDelivery: agentLightBodyText.includes(uiText.agentLightDelivery),
    settingsPanel: agentBodyText.includes(uiText.agentAbilityTab),
    currentSummary: agentBodyText.includes(uiText.agentCurrentSummary),
    employeeNameLabel: agentBodyText.includes(uiText.agentEmployeeName),
    requiredDeliveryLabel: agentBodyText.includes(uiText.agentRequiredDelivery),
    useModelLabel: agentBodyText.includes(uiText.agentUseModel),
    workstationLabel: agentBodyText.includes(uiText.agentWorkstation),
    commandAbility: agentBodyText.includes(uiText.agentCommandAbility),
    toolConnection: agentBodyText.includes(uiText.agentToolConnection),
    softwareAbility: agentBodyText.includes(uiText.agentSoftwareAbility),
    saveOrCreateProfile:
      agentBodyText.includes(uiText.saveCurrentAgent) || agentBodyText.includes(uiText.newAgentProfile),
    employeeControlPanel: agentBodyText.includes(uiText.agentEmployeeControl),
    unifiedSettingsCopy: agentBodyText.includes(uiText.agentUnifiedSettings),
    toolboxSummary: agentBodyText.includes(uiText.agentToolbox),
    toolboxCopy: agentBodyText.includes(uiText.agentToolboxCopy),
    toolboxAssignAction: agentBodyText.includes(uiText.agentAssignAbility),
    toolboxNode: await page.getByTestId('agent-toolbox-summary').isVisible(),
    customerDelivery: agentBodyText.includes(uiText.agentCustomerDelivery),
    permissionSafetySummary: agentBodyText.includes(uiText.agentPermissionSafety),
    collaborationSummary: agentBodyText.includes(uiText.agentCollaborationMode),
    deliverySummary: agentBodyText.includes(uiText.agentDeliveryOutput),
    unifiedCapabilitySummary: agentBodyText.includes(uiText.agentUnifiedCapabilities),
    memoryContextInAgentSettings: agentBodyText.includes(uiText.agentMemoryContextSection),
    securityInAgentSettings: agentBodyText.includes(uiText.agentSecuritySection),
    advancedNavHidden: uiText.hiddenAdvancedNav.every((label) => !sidebarText.includes(label)),
  }
  for (const [key, value] of Object.entries(agentChecks)) {
    if (!value) throw new Error(`Agent unified settings UI check failed: ${key}.`)
  }

  await page.locator('main').getByRole('button', { name: uiText.createAgent, exact: true }).first().click()
  await page.getByText(uiText.detailedConfig, { exact: true }).click()
  await page.getByText(uiText.abilityPromptTab, { exact: true }).click()
  await page.getByText(uiText.installedSkills, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.mcpTools, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.cliCommands, { exact: true }).waitFor({ timeout: 90_000 })
  const agentCreateCapabilitiesScreenshot = path.join(outDir, 'agent-create-capability-picker.png')
  await page.screenshot({ path: agentCreateCapabilitiesScreenshot, fullPage: true })
  const createDialogText = await page.locator('[role="dialog"]').innerText()
  const createDialogChecks = {
    tab: createDialogText.includes(uiText.abilityPromptTab),
    skills: createDialogText.includes(uiText.installedSkills),
    mcp: createDialogText.includes(uiText.mcpTools),
    cli: createDialogText.includes(uiText.cliCommands),
    noOldToolset: !createDialogText.includes('\u5de5\u5177\u96c6'),
  }
  for (const [key, value] of Object.entries(createDialogChecks)) {
    if (!value) throw new Error(`Create Agent capability picker check failed: ${key}.`)
  }
  await page.locator('[role="dialog"]').getByRole('button', { name: '\u53d6\u6d88' }).click()
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 10_000 })

  const productionNavCount = await sidebar.locator(`button[title="${uiText.productionNav}"]`).count()
  if (productionNavCount > 0) {
    throw new Error('Production/delivery check should stay hidden from the simplified desktop navigation.')
  }

  await clickSidebarButton(sidebar, uiText.toolsNav)
  await page.getByText(uiText.toolsTitle).waitFor({ timeout: 90_000 })
  await page.getByTestId('software-store-card-codex').click()
  await page.getByTestId('software-store-detail').getByText(uiText.toolsIntro, { exact: true }).waitFor({
    timeout: 90_000,
  })
  await page.getByTestId('software-store-card-codex-cli').click()
  await page
    .getByTestId('software-store-detail')
    .getByText(uiText.toolsCliAccess, { exact: true })
    .waitFor({ timeout: 90_000 })
  await page.getByTestId('software-store-card-codex').click()
  const toolsScreenshot = path.join(outDir, 'tools-simple-workbench.png')
  await page.screenshot({ path: toolsScreenshot, fullPage: true })
  const toolsBodyText = await page.locator('body').innerText()
  const toolsChecks = {
    title: toolsBodyText.includes(uiText.toolsTitle),
    advancedButton: toolsBodyText.includes(uiText.advancedTools),
    searchInput: await page.getByPlaceholder(uiText.toolsSearchPlaceholder).isVisible(),
    category: toolsBodyText.includes(uiText.toolsCategory),
    softwareCard: toolsBodyText.includes(uiText.toolsSoftwareCard),
    modeStat: toolsBodyText.includes(uiText.toolsModeStat),
    accessAssistantNode: await page.getByTestId('software-access-assistant').isVisible(),
    accessAssistantText: toolsBodyText.includes(uiText.toolsAccessAssistant),
    currentSoftware: toolsBodyText.includes(uiText.toolsCurrentSoftware),
    recommendedAccess: toolsBodyText.includes(uiText.toolsRecommendedAccess),
    viewCliOrMcp: toolsBodyText.includes(uiText.toolsViewCliOrMcp),
    oneClickFindSoftware: toolsBodyText.includes(uiText.toolsOneClickFindSoftware),
    nextStep: toolsBodyText.includes(uiText.toolsNextStep),
    usePathNode: await page.getByTestId('software-store-use-path').isVisible(),
    usePathText: toolsBodyText.includes(uiText.toolsUsePath),
    usePathChoose: toolsBodyText.includes(uiText.toolsStepChoose),
    usePathCheck: toolsBodyText.includes(uiText.toolsStepCheck),
    usePathAssign: toolsBodyText.includes(uiText.toolsStepAssign),
    detailHeroNode: await page.getByTestId('software-store-detail-hero').isVisible(),
    detailHeroText: toolsBodyText.includes(uiText.toolsSoftwareCardHero),
    connectionOverviewNode: await page.getByTestId('software-store-connection-overview').isVisible(),
    connectionOverviewText: toolsBodyText.includes(uiText.toolsConnectionOverview),
    assignmentPathNode: await page.getByTestId('software-store-assignment-path').isVisible(),
    assignmentPathText: toolsBodyText.includes(uiText.toolsAssignmentPath),
    heroAssignAction: toolsBodyText.includes(uiText.toolsGoAssignToAgent),
    intro: toolsBodyText.includes(uiText.toolsIntro),
    softwareDetail: toolsBodyText.includes(uiText.toolsSoftwareDetail),
    useGuideNode: await page.getByTestId('software-store-use-guide').isVisible(),
    accessMatrixNode: await page.getByTestId('software-store-access-matrix').isVisible(),
    accessMatrixText: toolsBodyText.includes(uiText.toolsAccessMatrix),
    currentChoiceText: toolsBodyText.includes(uiText.toolsCurrentChoice),
    accessCliNode: await page.getByTestId('software-store-access-cli').isVisible(),
    accessMcpNode: await page.getByTestId('software-store-access-mcp').isVisible(),
    accessCommandsNode: await page.getByTestId('software-store-access-commands').isVisible(),
    assignmentPlanNode: await page.getByTestId('software-store-assignment-plan').isVisible(),
    assignmentPlanText: toolsBodyText.includes(uiText.toolsAssignmentPlan),
    fitAgentText: toolsBodyText.includes(uiText.toolsFitAgent),
    accessRouteText: toolsBodyText.includes(uiText.toolsAccessRoute),
    cliMode: toolsBodyText.includes(uiText.toolsCliMode),
    mcpMode: toolsBodyText.includes(uiText.toolsMcpMode),
    packagedCommands: toolsBodyText.includes(uiText.toolsPackagedCommands),
    assignableToAgent: toolsBodyText.includes(uiText.toolsAssignableToAgent),
    agentUse: toolsBodyText.includes(uiText.toolsAgentUse),
    assignToAgent: toolsBodyText.includes(uiText.toolsAssignToAgent),
    cliAccess: toolsBodyText.includes(uiText.toolsCliAccess),
    mcpAccess: toolsBodyText.includes(uiText.toolsMcpAccess),
    availableCommands: toolsBodyText.includes(uiText.toolsAvailableCommands),
  }
  for (const [key, value] of Object.entries(toolsChecks)) {
    if (!value) throw new Error(`Tools UI check failed: ${key}.`)
  }
  await page.getByTestId('assign-software-to-agent').click()
  await page.getByText(uiText.agentCurrentSummary, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByTestId('agent-capabilities-section').waitFor({ timeout: 90_000 })
  const toolsToAgentScreenshot = path.join(outDir, 'tools-to-agent-settings.png')
  await page.screenshot({ path: toolsToAgentScreenshot, fullPage: true })
  const toolsToAgentText = await page.locator('body').innerText()
  const toolsToAgentChecks = {
    openedAgentSettings: toolsToAgentText.includes(uiText.agentCurrentSummary),
    toolboxSummary: toolsToAgentText.includes(uiText.agentToolbox),
    toolboxCopy: toolsToAgentText.includes(uiText.agentToolboxCopy),
    assignAbility: toolsToAgentText.includes(uiText.agentAssignAbility),
    toolboxNode: await page.getByTestId('agent-toolbox-summary').isVisible(),
    commandAbility: toolsToAgentText.includes(uiText.agentCommandAbility),
    toolConnection: toolsToAgentText.includes(uiText.agentToolConnection),
    softwareAbility: toolsToAgentText.includes(uiText.agentSoftwareAbility),
  }
  for (const [key, value] of Object.entries(toolsToAgentChecks)) {
    if (!value) throw new Error(`Tools to Agent assignment check failed: ${key}.`)
  }

  await clickSidebarButton(sidebar, uiText.skillsNav)
  await page.getByText(uiText.skillsMarket, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByTestId('skillsmp-featured-market').getByText(uiText.skillsFeatured, { exact: true }).waitFor({
    timeout: 90_000,
  })
  const smokeSkillCard = page.getByTestId('skillsmp-result-card').filter({ hasText: uiText.skillsSmokeResult }).first()
  await smokeSkillCard.waitFor({ timeout: 90_000 })
  await smokeSkillCard.click()
  await page
    .getByTestId('skillsmp-detail-panel')
    .filter({ hasText: uiText.skillsSmokeResult })
    .first()
    .waitFor({ timeout: 90_000 })
  const skillsScreenshot = path.join(outDir, 'skillsmp-cli-market.png')
  await page.screenshot({ path: skillsScreenshot, fullPage: true })
  const skillsBodyText = await page.locator('body').innerText()
  const skillsChecks = {
    title: skillsBodyText.includes(uiText.skillsMarket),
    cliBadge: skillsBodyText.includes(uiText.skillsCli),
    noSearchInput: (await page.getByPlaceholder(uiText.removedSkillsSearchPlaceholder).count()) === 0,
    noSearchButton: (await page.locator('main button', { hasText: '\u641c\u7d22' }).count()) === 0,
    installAssistantNode: await page.getByTestId('skills-install-assistant').isVisible(),
    installAssistantText: skillsBodyText.includes(uiText.skillsInstallAssistant),
    chooseRecommended: skillsBodyText.includes(uiText.skillsChooseRecommended),
    selectedSkillSummary: skillsBodyText.includes(uiText.skillsSelectedSkill),
    nextStepHint: skillsBodyText.includes(uiText.skillsNextStep),
    commandBarNode: await page.getByTestId('skills-market-command-bar').isVisible(),
    commandBarText: skillsBodyText.includes(uiText.skillsCommandBar),
    currentSkillText: skillsBodyText.includes(uiText.skillsCurrentSkill),
    recommendAgentText: skillsBodyText.includes(uiText.skillsRecommendAgent),
    noCategoryShelf: (await page.getByTestId('skills-market-category-shelf').count()) === 0,
    usePathNode: await page.getByTestId('skills-use-path').isVisible(),
    usePathText: skillsBodyText.includes(uiText.skillsUsePath),
    usePathChooseRecommended: skillsBodyText.includes(uiText.skillsStepChooseRecommended),
    usePathInstall: skillsBodyText.includes(uiText.skillsStepInstall),
    usePathAssign: skillsBodyText.includes(uiText.skillsStepAssign),
    installedAgentHint: skillsBodyText.includes(uiText.skillsInstalledHint),
    installedAgentHintNode: await page.getByTestId('installed-skills-agent-hint').isVisible(),
    resultCard: skillsBodyText.includes(uiText.skillsSmokeResult),
    selectedCard: await page
      .getByTestId('skillsmp-result-card')
      .filter({ hasText: uiText.skillsSmokeResult })
      .first()
      .evaluate((node) => node.getAttribute('data-selected') === 'true'),
    detailPanel: await page.getByTestId('skillsmp-detail-panel').isVisible(),
    detailHeroNode: await page.getByTestId('skillsmp-detail-hero').isVisible(),
    detailHeroText: skillsBodyText.includes(uiText.skillsDetailHero),
    marketSignalNode: await page.getByTestId('skillsmp-detail-market-signal').isVisible(),
    marketSignalText: skillsBodyText.includes(uiText.skillsMarketSignal),
    installAssignPathNode: await page.getByTestId('skillsmp-detail-assignment-path').isVisible(),
    installAssignPathText: skillsBodyText.includes(uiText.skillsInstallAssignPath),
    heroAssignAction: skillsBodyText.includes(uiText.skillsGoAssignToAgent),
    assignmentPlanNode: await page.getByTestId('skills-agent-assignment-plan').isVisible(),
    assignmentPlanText: skillsBodyText.includes(uiText.skillsAssignmentPlan),
    agentFitGuide: await page.getByTestId('skillsmp-agent-fit-guide').isVisible(),
    agentFit: skillsBodyText.includes(uiText.skillsAgentFit),
    suitableRole: skillsBodyText.includes(uiText.skillsSuitableRole),
    capabilityBoost: skillsBodyText.includes(uiText.skillsCapabilityBoost),
    configLocation: skillsBodyText.includes(uiText.skillsConfigLocation),
    agentUseCopy: skillsBodyText.includes(uiText.skillsDetailAgentUse),
    assignToAgent: skillsBodyText.includes(uiText.skillsAssignToAgent),
    installLocal: skillsBodyText.includes(uiText.skillsInstallLocal),
  }
  for (const [key, value] of Object.entries(skillsChecks)) {
    if (!value) throw new Error(`SkillsMP UI check failed: ${key}.`)
  }
  await page.getByTestId('assign-skill-to-agent').click()
  await page.getByText(uiText.agentCurrentSummary, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByTestId('agent-capabilities-section').waitFor({ timeout: 90_000 })
  const skillsToAgentText = await page.locator('body').innerText()
  const skillsToAgentChecks = {
    openedAgentSettings: skillsToAgentText.includes(uiText.agentCurrentSummary),
    toolboxSummary: skillsToAgentText.includes(uiText.agentToolbox),
    toolboxCopy: skillsToAgentText.includes(uiText.agentToolboxCopy),
    assignAbility: skillsToAgentText.includes(uiText.agentAssignAbility),
    toolboxNode: await page.getByTestId('agent-toolbox-summary').isVisible(),
  }
  for (const [key, value] of Object.entries(skillsToAgentChecks)) {
    if (!value) throw new Error(`Skills to Agent assignment check failed: ${key}.`)
  }

  await clickSidebarButton(sidebar, uiText.canvasNav)
  await page.getByText(uiText.canvasTitle, { exact: true }).waitFor({ timeout: 90_000 })
  const inlineEditorAlreadyVisible = await page
    .getByText(uiText.inlineEditor, { exact: true })
    .isVisible()
    .catch(() => false)
  if (!inlineEditorAlreadyVisible) {
    const addAgentInMain = page.locator('main button', { hasText: uiText.addAgent })
    if ((await addAgentInMain.count()) > 0) {
      await addAgentInMain.first().click()
    }
  }
  await page.getByText(uiText.inlineEditor, { exact: true }).waitFor({ timeout: 30_000 })
  const quickEditor = page.getByTestId('canvas-quick-editor')
  await quickEditor.waitFor({ timeout: 30_000 })
  const nodeNameInputVisible = await quickEditor.getByPlaceholder(uiText.nodeName).isVisible()
  await page.getByTestId('artifact-type-quick-picker').first().getByText(uiText.artifactQuickPicker).waitFor({
    timeout: 30_000,
  })
  const artifactQuickPickerVisible = await page.getByTestId('artifact-type-quick-picker').first().isVisible()
  await quickEditor.locator('select').nth(1).selectOption('video')
  await page.getByTestId('canvas-delivery-overview-bar').getByText(uiText.canvasCustomerFinal).waitFor({
    timeout: 30_000,
  })
  await page.getByTestId('canvas-customer-delivery-dock').getByText(uiText.videoArtifact).first().waitFor({
    timeout: 30_000,
  })
  const collapseQuickEditorButton = page.getByTestId('canvas-quick-editor-collapse')
  await collapseQuickEditorButton.waitFor({ timeout: 30_000 })
  const quickEditorCollapsed = page.getByTestId('canvas-quick-editor-collapsed')
  for (let attempt = 0; attempt < 3; attempt++) {
    await collapseQuickEditorButton.evaluate((element) => (element as HTMLButtonElement).click())
    const collapsed = await quickEditorCollapsed.isVisible().catch(() => false)
    if (collapsed) break
    await page.waitForTimeout(300)
  }
  await quickEditorCollapsed.waitFor({ timeout: 30_000 })
  const quickEditorCollapsedVisible = await quickEditorCollapsed.isVisible()
  await quickEditorCollapsed.evaluate((element) => (element as HTMLButtonElement).click())
  await quickEditor.waitFor({ timeout: 30_000 })
  const quickEditorExpandedAgain = await quickEditor.isVisible()
  const quickEditorOpened = quickEditorExpandedAgain
  const canvasSurface = page.getByTestId('workflow-canvas-surface')
  const findBlankCanvasPoint = async () => {
    return canvasSurface.evaluate((surface) => {
      const rect = surface.getBoundingClientRect()
      return {
        x: rect.left + rect.width * 0.42,
        y: rect.top + rect.height * 0.62,
      }
    })
  }
  const openCanvasPaletteAt = async (point: { x: number; y: number }) => {
    await canvasSurface.evaluate((surface, currentPoint) => {
      surface.dispatchEvent(
        new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true,
          clientX: currentPoint.x,
          clientY: currentPoint.y,
        }),
      )
    }, point)
  }
  const paletteOpenPoint = await findBlankCanvasPoint()
  const nodesBeforePalette = await page.getByTestId('workflow-canvas-node').count()
  const edgesBeforePalette = await page.getByTestId('workflow-canvas-edge').count()
  await openCanvasPaletteAt(paletteOpenPoint)
  const nodePalette = page.getByTestId('canvas-node-palette')
  await nodePalette.waitFor({ timeout: 30_000 })
  await nodePalette.getByRole('button', { name: /条件/ }).click()
  await page.waitForFunction((previous) => {
    return document.querySelectorAll('[data-testid="workflow-canvas-node"]').length > Number(previous)
  }, nodesBeforePalette)
  const paletteCreatedNode = (await page.getByTestId('workflow-canvas-node').count()) > nodesBeforePalette

  const firstCanvasNodeForConnect = page.getByTestId('workflow-canvas-node').first()
  const openConnectingPalette = async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await firstCanvasNodeForConnect
        .getByTitle(uiText.startCanvasConnection)
        .last()
        .evaluate((element) => (element as HTMLButtonElement).click())
      const connectedPaletteOpenPoint = await findBlankCanvasPoint()
      await openCanvasPaletteAt(connectedPaletteOpenPoint)
      await nodePalette.waitFor({ timeout: 30_000 })
      const hintVisible = await nodePalette
        .getByText(uiText.connectingPaletteHint)
        .isVisible()
        .catch(() => false)
      if (hintVisible) return true
      await page.keyboard.press('Escape')
    }
    return false
  }
  const connectedPaletteHint = await openConnectingPalette()
  await nodePalette.getByRole('button', { name: /产物/ }).click()
  await page.waitForFunction((previous) => {
    return document.querySelectorAll('[data-testid="workflow-canvas-edge"]').length > Number(previous)
  }, edgesBeforePalette)
  const paletteConnectedEdge =
    (await page.getByTestId('workflow-canvas-edge').count()) > edgesBeforePalette

  const edgesBeforeDragConnect = await page.getByTestId('workflow-canvas-edge').count()
  const newestCanvasNodeForDrag = page.getByTestId('workflow-canvas-node').last()
  const dragSourcePort = newestCanvasNodeForDrag.getByTestId('canvas-node-output-port')
  const dragTargetPort = firstCanvasNodeForConnect.getByTestId('canvas-node-input-port')
  const dragSourceBox = await dragSourcePort.boundingBox()
  const dragTargetBox = await dragTargetPort.boundingBox()
  if (!dragSourceBox || !dragTargetBox) throw new Error('Canvas UI check failed: dragPorts.')
  await page.mouse.move(
    dragSourceBox.x + dragSourceBox.width / 2,
    dragSourceBox.y + dragSourceBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    dragSourceBox.x + dragSourceBox.width / 2 + 90,
    dragSourceBox.y + dragSourceBox.height / 2,
    { steps: 5 },
  )
  const dragPreview = page.getByTestId('workflow-canvas-connection-preview')
  await dragPreview.waitFor({ timeout: 30_000 })
  const dragPreviewVisible = await dragPreview.isVisible()
  await page.mouse.move(
    dragTargetBox.x + dragTargetBox.width / 2,
    dragTargetBox.y + dragTargetBox.height / 2,
    { steps: 10 },
  )
  await page.mouse.up()
  await page.waitForFunction((previous) => {
    return document.querySelectorAll('[data-testid="workflow-canvas-edge"]').length > Number(previous)
  }, edgesBeforeDragConnect)
  const dragConnectedEdge =
    (await page.getByTestId('workflow-canvas-edge').count()) > edgesBeforeDragConnect

  const firstNode = page.getByTestId('workflow-canvas-node').first()
  const beforePan = await firstNode.boundingBox()
  const canvasBox = await canvasSurface.boundingBox()
  if (!beforePan || !canvasBox) throw new Error('Canvas UI check failed: panSetup.')
  const beforePanBackground = await canvasSurface.evaluate((surface) => getComputedStyle(surface).backgroundPosition)
  const panStart = await canvasSurface.evaluate((surface) => {
    const rect = surface.getBoundingClientRect()
    for (const yRatio of [0.22, 0.34, 0.46, 0.58, 0.7, 0.82]) {
      for (const xRatio of [0.16, 0.28, 0.4, 0.52, 0.64, 0.76, 0.88]) {
        const x = rect.left + rect.width * xRatio
        const y = rect.top + rect.height * yRatio
        if (document.elementFromPoint(x, y) === surface) return { x, y }
      }
    }
    return null
  })
  if (!panStart) throw new Error('Canvas UI check failed: noBlankPanPoint.')
  await page.mouse.move(panStart.x, panStart.y)
  await page.mouse.down()
  await page.mouse.move(panStart.x + 120, panStart.y + 60, {
    steps: 8,
  })
  await page.mouse.up()
  await page.waitForTimeout(100)
  const afterPan = await firstNode.boundingBox()
  const afterPanBackground = await canvasSurface.evaluate((surface) => getComputedStyle(surface).backgroundPosition)
  const canvasPan =
    !!afterPan &&
    ((
      Math.abs(afterPan.x - beforePan.x) >= 35 &&
      Math.abs(afterPan.y - beforePan.y) >= 18
    ) ||
      afterPanBackground !== beforePanBackground)

  const viewportControls = page.getByTestId('canvas-viewport-controls')
  await viewportControls.waitFor({ timeout: 30_000 })
  const zoomLevel = page.getByTestId('canvas-zoom-level')
  const beforeZoomText = await zoomLevel.innerText()
  await viewportControls.getByTitle(uiText.canvasZoomIn).click()
  await page.waitForFunction((previous) => {
    return document.querySelector('[data-testid="canvas-zoom-level"]')?.textContent !== previous
  }, beforeZoomText)
  const zoomedText = await zoomLevel.innerText()
  await zoomLevel.click()
  await page.waitForFunction(() => {
    return document.querySelector('[data-testid="canvas-zoom-level"]')?.textContent?.trim() === '100%'
  })
  const resetZoomText = await zoomLevel.innerText()
  await viewportControls.getByTitle(uiText.canvasFitView).click()
  await page.waitForTimeout(100)
  const fitButtonVisible = await viewportControls.getByTitle(uiText.canvasFitView).isVisible()
  const minimap = page.getByTestId('canvas-minimap')
  const minimapMap = page.getByTestId('canvas-minimap-map')
  await minimap.waitFor({ timeout: 30_000 })
  const beforeMinimapBackground = await canvasSurface.evaluate((surface) => getComputedStyle(surface).backgroundPosition)
  const minimapBox = await minimapMap.boundingBox()
  if (!minimapBox) throw new Error('Canvas UI check failed: minimapBox.')
  await page.mouse.click(minimapBox.x + 12, minimapBox.y + 12)
  await page.waitForTimeout(100)
  const afterMinimapBackground = await canvasSurface.evaluate((surface) => getComputedStyle(surface).backgroundPosition)

  let runPanelVisible = await page.getByText(uiText.runMonitor).isVisible().catch(() => false)
  if (!runPanelVisible) {
    await page.locator('main button', { hasText: uiText.advancedSettings }).first().click()
    runPanelVisible = await page.getByText(uiText.runMonitor).isVisible().catch(() => false)
  }
  await page
    .getByTestId('canvas-customer-preview-board')
    .getByText(uiText.canvasCustomerAcceptance, { exact: true })
    .waitFor({ timeout: 30_000 })

  const firstCanvasNode = page.getByTestId('workflow-canvas-node').first()
  const canvasNodeId = await firstCanvasNode.getAttribute('data-node-id')
  if (!canvasNodeId) throw new Error('Canvas UI check failed: missingNodeId.')
  await page.locator('main button', { hasText: uiText.saveWorkflow }).first().click()
  await page.waitForFunction((label) => {
    return [...document.querySelectorAll('main button')].some((button) => {
      const htmlButton = button as HTMLButtonElement
      return htmlButton.textContent?.includes(String(label)) && !htmlButton.disabled
    })
  }, uiText.runWorkflow)
  const smokeWorkflowRunId = `smoke_canvas_run_${Date.now()}`
  let smokeWorkflowId = 'smoke_canvas_workflow'
  const now = Date.now()
  await page.route('**/api/workflows/*/run', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    const matched = route.request().url().match(/\/api\/workflows\/([^/]+)\/run/)
    smokeWorkflowId = matched?.[1] ? decodeURIComponent(matched[1]) : smokeWorkflowId
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        workflowRun: {
          id: smokeWorkflowRunId,
          workflowId: smokeWorkflowId,
          status: 'complete',
          input: { goal: 'smoke canvas state' },
          output: { status: 'complete' },
          error: null,
          startedAt: now,
          finishedAt: now,
        },
      }),
    })
  })
  await page.route(`**/api/workflow-runs/${smokeWorkflowRunId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        workflowRun: {
          id: smokeWorkflowRunId,
          workflowId: smokeWorkflowId,
          status: 'complete',
          input: { goal: 'smoke canvas state' },
          output: { status: 'complete' },
          error: null,
          startedAt: now,
          finishedAt: now,
        },
        nodeRuns: [{
          id: 'wnr_smoke_canvas',
          workflowRunId: smokeWorkflowRunId,
          nodeId: canvasNodeId,
          status: 'complete',
          progressStatus: 'complete',
          currentStep: uiText.canvasNodeCompleteStep,
          output: { artifactType: 'video', customerVisible: true },
          error: null,
          startedAt: now,
          finishedAt: now,
        }],
        employeeRuns: [],
        softwareCommandRuns: [],
        computerSessions: [],
        computerActionEvents: [],
        artifactValidations: [],
        approvalRequests: [],
        resourceLocks: [],
      }),
    })
  })
  await page.locator('main button', { hasText: uiText.runWorkflow }).first().click()
  await page.waitForFunction((nodeId) => {
    return [...document.querySelectorAll('[data-testid="workflow-canvas-node"]')].some((node) => (
      node.getAttribute('data-node-id') === nodeId && node.getAttribute('data-run-state') === 'complete'
    ))
  }, canvasNodeId)

  const canvasScreenshot = path.join(outDir, 'canvas-inline-editor.png')
  await page.screenshot({ path: canvasScreenshot, fullPage: true })
  const canvasBodyText = await page.locator('main').innerText()
  const canvasChecks = {
    canvasTitle: await page.getByText(uiText.canvasTitle, { exact: true }).isVisible(),
    inlineEditor: quickEditorOpened,
    nodeNameInput: nodeNameInputVisible,
    quickEditorCollapsed: quickEditorCollapsedVisible,
    quickEditorExpandedAgain,
    nodePaletteCreatedNode: paletteCreatedNode,
    nodePaletteConnectedEdge: paletteConnectedEdge,
    connectingPaletteHint: connectedPaletteHint,
    connectionDragPreview: dragPreviewVisible,
    connectionDragEdge: dragConnectedEdge,
    deliveryOverviewBar: await page.getByTestId('canvas-delivery-overview-bar').isVisible(),
    deliveryOverviewText: canvasBodyText.includes(uiText.canvasCustomerFinal),
    artifactQuickPicker: artifactQuickPickerVisible,
    customerDeliverableDock: await page.getByTestId('canvas-customer-delivery-dock').isVisible(),
    customerDeliverablesPanel: await page.getByTestId('canvas-customer-deliverables-panel').isVisible(),
    customerDeliverySummary: await page.getByTestId('canvas-customer-delivery-summary').isVisible(),
    customerDeliverySummaryText: canvasBodyText.includes(uiText.canvasCustomerDeliverySummary),
    primaryDeliverable: canvasBodyText.includes(uiText.canvasPrimaryDeliverable),
    customerGets: canvasBodyText.includes(uiText.canvasCustomerGets),
    acceptanceNextStep: canvasBodyText.includes(uiText.canvasAcceptanceNextStep),
    customerPreviewBoard: await page.getByTestId('canvas-customer-preview-board').isVisible(),
    customerPreviewCard: await page.getByTestId('canvas-customer-preview-card').first().isVisible(),
    nodeProgress: await page.getByTestId('canvas-node-progress').first().isVisible(),
    nodeDeliveryCard: await page.getByTestId('canvas-node-delivery-card').first().isVisible(),
    nodeStatusStrip: await page.getByTestId('canvas-node-status-strip').first().isVisible(),
    nodeStateComplete: await page
      .locator(`[data-testid="workflow-canvas-node"][data-run-state="complete"]`)
      .first()
      .isVisible(),
    customerVisible: canvasBodyText.includes(uiText.customerVisible),
    videoArtifact: canvasBodyText.includes(uiText.videoArtifact),
    videoFileHint: canvasBodyText.includes(uiText.canvasVideoFileHint),
    nodeProgressText: canvasBodyText.includes(uiText.canvasNodeProgress),
    nodeDeliveryText: canvasBodyText.includes(uiText.canvasNodeDelivery),
    nodeCompleteText: canvasBodyText.includes(uiText.canvasNodeComplete),
    nodeCompleteStep: canvasBodyText.includes(uiText.canvasNodeCompleteStep),
    nodeCompletePercent: canvasBodyText.includes('100%'),
    runStatusText: canvasBodyText.includes(uiText.canvasRunStatus),
    nextStepText: canvasBodyText.includes(uiText.canvasNextStep),
    nodePhaseComplete: await page.locator('[data-testid="canvas-node-status-strip"][data-node-phase="complete"]').first().isVisible(),
    deliveryChecklist: canvasBodyText.includes(uiText.canvasDeliveryChecklist),
    currentArtifact: canvasBodyText.includes(uiText.canvasCurrentArtifact),
    acceptanceState: canvasBodyText.includes(uiText.canvasAcceptanceState),
    producedState: canvasBodyText.includes(uiText.canvasProduced),
    pendingState: canvasBodyText.includes(uiText.canvasPendingArtifact),
    customerAcceptanceView: canvasBodyText.includes(uiText.canvasCustomerAcceptance),
    previewMode: canvasBodyText.includes(uiText.canvasPreviewMode),
    deliveryFile: canvasBodyText.includes(uiText.canvasDeliveryFile),
    ownerNode: canvasBodyText.includes(uiText.canvasOwnerNode),
    acceptanceRule: canvasBodyText.includes(uiText.canvasAcceptanceRule),
    backgroundPan: canvasPan,
    viewportControls: await viewportControls.isVisible(),
    zoomChanged: beforeZoomText !== zoomedText,
    zoomReset: resetZoomText.trim() === '100%',
    fitView: fitButtonVisible,
    minimap: await minimap.isVisible(),
    minimapFocus: beforeMinimapBackground !== afterMinimapBackground,
    runPanel: runPanelVisible,
  }
  for (const [key, value] of Object.entries(canvasChecks)) {
    if (!value) throw new Error(`Canvas UI check failed: ${key}.`)
  }

  let schedulerNav = sidebar.locator(`button[title="${uiText.schedulerNav}"]`)
  if ((await schedulerNav.count()) === 0) {
    const collapsedMore = sidebar.locator('button', { hasText: uiText.moreFeatures })
    if ((await collapsedMore.count()) > 0) await collapsedMore.first().click({ force: true })
    schedulerNav = sidebar.locator(`button[title="${uiText.schedulerNav}"]`)
  }
  await schedulerNav.click({ force: true })
  await page.locator('main').getByText(uiText.schedulerTitle, { exact: true }).waitFor({ timeout: 90_000 })
  const schedulerScreenshot = path.join(outDir, 'scheduler-auto-tasks.png')
  await page.screenshot({ path: schedulerScreenshot, fullPage: true })
  const schedulerBodyText = await page.locator('main').innerText()
  const schedulerChecks = {
    title: schedulerBodyText.includes(uiText.schedulerTitle),
    queue: schedulerBodyText.includes(uiText.schedulerQueue),
    rules: schedulerBodyText.includes(uiText.schedulerRules),
    quickActions: schedulerBodyText.includes(uiText.schedulerQuickActions),
    runDue: schedulerBodyText.includes(uiText.schedulerRunDue),
    noEnglishTitle: !schedulerBodyText.includes('Task Scheduler'),
  }
  for (const [key, value] of Object.entries(schedulerChecks)) {
    if (!value) throw new Error(`Scheduler UI check failed: ${key}.`)
  }

  let artifactsNav = sidebar.locator(`button[title="${uiText.artifactsNav}"]`)
  if ((await artifactsNav.count()) === 0) {
    const collapsedMore = sidebar.locator('button', { hasText: uiText.moreFeatures })
    if ((await collapsedMore.count()) > 0) await collapsedMore.first().click({ force: true })
    artifactsNav = sidebar.locator(`button[title="${uiText.artifactsNav}"]`)
  }
  await artifactsNav.click({ force: true })
  await page.locator('main').getByText(uiText.artifactsTitle, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.artifactsLoading, { exact: true }).waitFor({
    state: 'hidden',
    timeout: 90_000,
  }).catch(() => undefined)
  const artifactsScreenshot = path.join(outDir, 'artifact-delivery-center.png')
  await page.screenshot({ path: artifactsScreenshot, fullPage: true })
  const artifactsBodyText = await page.locator('main').innerText()
  const schedulerNavDuringArtifacts = sidebar.locator(`button[title="${uiText.schedulerNav}"]`)
  const artifactsChecks = {
    title: artifactsBodyText.includes(uiText.artifactsTitle),
    navActive: await artifactsNav.evaluate((element) => element.className.includes('bg-primary')),
    schedulerInactive:
      (await schedulerNavDuringArtifacts.count()) === 0 ||
      !(await schedulerNavDuringArtifacts.first().evaluate((element) => element.className.includes('bg-primary'))),
    search: await page.locator(`input[placeholder*="${uiText.artifactsSearch}"]`).isVisible(),
    versions: artifactsBodyText.includes(uiText.artifactsVersions),
    source: artifactsBodyText.includes(uiText.artifactsSource),
    customerOverview: artifactsBodyText.includes(uiText.artifactsCustomerOverview),
    customerOverviewNode: await page.getByTestId('artifact-customer-delivery-overview').isVisible(),
    agentOutput: artifactsBodyText.includes(uiText.artifactsAgentOutput),
    generateOutput: artifactsBodyText.includes(uiText.artifactsGenerateOutput),
    previewAcceptance: artifactsBodyText.includes(uiText.artifactsPreviewAcceptance),
    packageDelivery: artifactsBodyText.includes(uiText.artifactsPackageDelivery),
    pendingReview: artifactsBodyText.includes(uiText.artifactsPendingReview),
    package: artifactsBodyText.includes(uiText.artifactsPackage),
    customerReadable: artifactsBodyText.includes(uiText.artifactsCustomerReadable),
    previewable: artifactsBodyText.includes(uiText.artifactsPreviewable),
    traceable: artifactsBodyText.includes(uiText.artifactsTraceable),
    deliveryCheck: artifactsBodyText.includes(uiText.artifactsDeliveryCheck),
    noBrokenEncoding: !artifactsBodyText.includes('\uFFFD') && !artifactsBodyText.includes('ArtifactLibrary'),
  }
  for (const [key, value] of Object.entries(artifactsChecks)) {
    if (!value) throw new Error(`Artifacts UI check failed: ${key}.`)
  }

  let monitorNav = sidebar.locator(`button[title="${uiText.monitorNav}"]`)
  if ((await monitorNav.count()) === 0) {
    const collapsedMore = sidebar.locator('button', { hasText: uiText.moreFeatures })
    if ((await collapsedMore.count()) > 0) await collapsedMore.first().click({ force: true })
    monitorNav = sidebar.locator(`button[title="${uiText.monitorNav}"]`)
  }
  await monitorNav.click({ force: true })
  await page.locator('main').getByText(uiText.monitorTitle, { exact: true }).waitFor({ timeout: 90_000 })
  const monitorScreenshot = path.join(outDir, 'run-scene-monitor.png')
  await page.screenshot({ path: monitorScreenshot, fullPage: true })
  const monitorBodyText = await page.locator('main').innerText()
  const monitorChecks = {
    title: monitorBodyText.includes(uiText.monitorTitle),
    navActive: await monitorNav.evaluate((element) => element.className.includes('bg-primary')),
    sceneOverview: monitorBodyText.includes(uiText.monitorSceneOverview),
    sceneOverviewNode: await page.getByTestId('run-scene-overview').isVisible(),
    currentRuns: monitorBodyText.includes(uiText.monitorCurrentRuns),
    recentEvents: monitorBodyText.includes(uiText.monitorRecentEvents),
    needHandle: monitorBodyText.includes(uiText.monitorNeedHandle),
    deliveryState: monitorBodyText.includes(uiText.monitorDeliveryState),
    nextStep: monitorBodyText.includes(uiText.monitorNextStep),
    advanced: monitorBodyText.includes(uiText.monitorAdvanced),
    artifacts: monitorBodyText.includes(uiText.monitorArtifacts),
    noEnglishTitle: !monitorBodyText.includes('Observability Center'),
  }
  for (const [key, value] of Object.entries(monitorChecks)) {
    if (!value) throw new Error(`Monitor UI check failed: ${key}.`)
  }

  const analyticsNav = sidebar.locator(`button[title="${uiText.analyticsNav}"]`)
  if ((await analyticsNav.count()) === 0) {
    const collapsedMore = sidebar.locator('button', { hasText: uiText.moreFeatures })
    if ((await collapsedMore.count()) > 0) await collapsedMore.first().click({ force: true })
  }
  await sidebar.locator(`button[title="${uiText.analyticsNav}"]`).click({ force: true })
  await page.getByText(uiText.analyticsTitle, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.modelActualUsage, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.modelBillRanking, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.modelCostDiagnosis, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.modelBillDetail, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.contextWindow, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.runtimeMetrics, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.promptCacheTitle, { exact: true }).waitFor({ timeout: 90_000 })
  await page.getByText(uiText.projectContext, { exact: true }).waitFor({ timeout: 90_000 })
  const analyticsScreenshot = path.join(outDir, 'usage-context-dashboard.png')
  await page.screenshot({ path: analyticsScreenshot, fullPage: true })
  const analyticsBodyText = await page.locator('body').innerText()
  const analyticsChecks = {
    title: analyticsBodyText.includes(uiText.analyticsTitle),
    costCommandCenter: analyticsBodyText.includes(uiText.costCommandCenter),
    modelActualConsumptionRanking: analyticsBodyText.includes(uiText.modelActualConsumptionRanking),
    modelActualPaidTotal: analyticsBodyText.includes(uiText.modelActualPaidTotal),
    modelActualTokenTotal: analyticsBodyText.includes(uiText.modelActualTokenTotal),
    modelActualCacheSaved: analyticsBodyText.includes(uiText.modelActualCacheSaved),
    modelActualConsumptionBoard: await page.getByTestId('model-actual-consumption-board').isVisible(),
    modelActualConsumptionRows: (await page.getByTestId('model-actual-consumption-row').count()) > 0,
    modelSpendRanking: analyticsBodyText.includes(uiText.modelSpendRanking),
    agentSpendRanking: analyticsBodyText.includes(uiText.agentSpendRanking),
    inputCostReducedTo: analyticsBodyText.includes(uiText.inputCostReducedTo),
    topSpendingModel: analyticsBodyText.includes(uiText.topSpendingModel),
    costCommandCenterNode: await page.getByTestId('cost-command-center').isVisible(),
    modelBillOverview: analyticsBodyText.includes(uiText.modelBillOverview),
    modelBillCommandPanel: await page.getByTestId('model-bill-command-panel').isVisible(),
    modelBillSummaryRows: (await page.getByTestId('model-bill-summary-row').count()) > 0,
    modelSpendLedger: analyticsBodyText.includes(uiText.modelSpendLedger),
    modelSpendLedgerNode: await page.getByTestId('model-spend-ledger-board').isVisible(),
    modelSpendLedgerRows: (await page.getByTestId('model-spend-ledger-row').count()) > 0,
    actualTotalSpend: analyticsBodyText.includes(uiText.actualTotalSpend),
    coveredModels: analyticsBodyText.includes(uiText.coveredModels),
    billReading: analyticsBodyText.includes(uiText.billReading),
    modelToWatch: analyticsBodyText.includes(uiText.modelToWatch),
    modelBillMonthlyProjection: analyticsBodyText.includes(uiText.modelBillMonthlyProjection),
    modelAverageRequestCost: analyticsBodyText.includes(uiText.modelAverageRequestCost),
    modelOptimizationAdvice: analyticsBodyText.includes(uiText.modelOptimizationAdvice),
    modelActualUsage: analyticsBodyText.includes(uiText.modelActualUsage),
    modelBillRanking: analyticsBodyText.includes(uiText.modelBillRanking),
    modelCostDiagnosis: analyticsBodyText.includes(uiText.modelCostDiagnosis),
    modelCostDiagnosisNode: await page.getByTestId('model-cost-diagnosis').isVisible(),
    modelDiagnosisRows: (await page.getByTestId('model-diagnosis-row').count()) > 0,
    actualBill: analyticsBodyText.includes(uiText.actualBill),
    actualSpend: analyticsBodyText.includes(uiText.actualSpend),
    cacheSaved: analyticsBodyText.includes(uiText.cacheSaved),
    cacheSavingRate: analyticsBodyText.includes(uiText.cacheSavingRate),
    noCacheEstimate: analyticsBodyText.includes(uiText.noCacheEstimate),
    avgCostPerRequest: analyticsBodyText.includes(uiText.avgCostPerRequest),
    optimizableModel: analyticsBodyText.includes(uiText.optimizableModel),
    modelBillDetail: analyticsBodyText.includes(uiText.modelBillDetail),
    billTable: await page.getByTestId('model-bill-table').isVisible(),
    costShare: analyticsBodyText.includes(uiText.costShare),
    savedVsNoCache: analyticsBodyText.includes(uiText.savedVsNoCache),
    contextWindow: analyticsBodyText.includes(uiText.contextWindow),
    runtimeMetrics: analyticsBodyText.includes(uiText.runtimeMetrics),
    cost: analyticsBodyText.includes(uiText.costTitle),
    sessionStatus: analyticsBodyText.includes(uiText.sessionStatus),
    promptCache: analyticsBodyText.includes(uiText.promptCacheTitle),
    appendOnlyContext: analyticsBodyText.includes(uiText.appendOnlyContext),
    targetCacheHit: analyticsBodyText.includes(uiText.targetCacheHit),
    projectContext: analyticsBodyText.includes(uiText.projectContext),
    modelCache: analyticsBodyText.includes('\u7f13\u5b58\u547d\u4e2d'),
    modelCost: analyticsBodyText.includes('\u8d39\u7528'),
    lazyProjectFiles: analyticsBodyText.includes('\u6309\u9700'),
  }
  for (const [key, value] of Object.entries(analyticsChecks)) {
    if (!value) throw new Error(`Usage dashboard UI check failed: ${key}.`)
  }

  await browser.close()
  console.log(JSON.stringify({
    baseUrl,
    workbenchChecks,
    workbenchStartChecks: {
      employeeRunsStarted: workbenchEmployeeRunStarted,
      directTaskVisible: directWorkbenchTaskVisible,
    },
    runDetailChecks,
    settingsChecks,
    directConversationChecks,
    modelManagementChecks,
    createDialogChecks,
    toolsChecks,
    skillsChecks,
    canvasChecks,
    schedulerChecks,
    artifactsChecks,
    monitorChecks,
    analyticsChecks,
    screenshots: {
      agentScreenshot,
      directConversationScreenshot,
      modelManagementScreenshot,
      agentCreateCapabilitiesScreenshot,
      workbenchScreenshot,
      workbenchRunDetailScreenshot,
      toolsScreenshot,
      skillsScreenshot,
      canvasScreenshot,
      schedulerScreenshot,
      artifactsScreenshot,
      monitorScreenshot,
      analyticsScreenshot,
    },
    consoleErrors: consoleErrors.slice(0, 10),
  }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

function resolveLocalBrowserExecutable(): string | undefined {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean) as string[]
  return candidates.find((candidate) => existsSync(candidate))
}

async function clickSidebarButton(sidebar: Locator, label: string) {
  let button = sidebar.locator(`button[title="${label}"]`)
  if ((await button.count()) === 0) {
    const collapsedMore = sidebar.locator('button', { hasText: uiText.moreFeatures })
    if ((await collapsedMore.count()) > 0) await collapsedMore.first().click({ force: true })
    button = sidebar.locator(`button[title="${label}"]`)
  }
  if ((await button.count()) === 0) {
    button = sidebar.getByRole('button', { name: label })
  }
  if ((await button.count()) === 0) {
    button = sidebar.locator('button', { hasText: label })
  }
  await button.first().click({ force: true })
}

async function openSidebarModeAndWait(page: Page, sidebar: Locator, label: string, mainText: string) {
  await clickSidebarButton(sidebar, label)
  const target = page.locator('main').getByText(mainText, { exact: true })
  try {
    await target.waitFor({ timeout: 30_000 })
  } catch {
    await clickSidebarButton(sidebar, label)
    await target.waitFor({ timeout: 90_000 })
  }
}

async function cleanupSmokeModels(page: Page, baseUrl: string) {
  const response = await page.request.get(`${baseUrl}/api/model-profiles`)
  if (!response.ok()) return
  const payload = (await response.json()) as {
    modelProfiles?: Array<{ id: string; name: string }>
  }
  const smokeModels =
    payload.modelProfiles?.filter((model) =>
      model.name.startsWith('UI 临时模型 ') || model.name.startsWith('UI temp model '),
    ) ?? []
  for (const model of smokeModels) {
    await page.request.delete(`${baseUrl}/api/model-profiles/${model.id}`)
  }
}

