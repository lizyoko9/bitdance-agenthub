import { customAlphabet } from 'nanoid'

// 12 字符，base62（字母+数字），冲突概率足够低
const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 12)

export const newAgentId = () => `ag_${nano()}`
export const newConversationId = () => `conv_${nano()}`
export const newMessageId = () => `msg_${nano()}`
export const newArtifactId = () => `art_${nano()}`
export const newWorkspaceId = () => `ws_${nano()}`
export const newRunId = () => `run_${nano()}`
export const newToolCallId = () => `call_${nano()}`
export const newAttachmentId = () => `att_${nano()}`
export const newPendingWriteId = () => `pwr_${nano()}`
export const newPendingBashCommandId = () => `pbc_${nano()}`
export const newPendingQuestionId = () => `pq_${nano()}`
export const newPendingDispatchPlanId = () => `pdp_${nano()}`
export const newContextSummaryId = () => `ctx_${nano()}`
export const newDeploymentId = () => `dep_${nano()}`
export const newSkillId = () => `skill_${nano()}`
export const newPendingSkillInstallId = () => `psi_${nano()}`
