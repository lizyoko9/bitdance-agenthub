export interface DeliveryInput {
  alias: string
  path: string
  format: 'json' | 'markdown' | 'text'
}

export interface DeliveryRequirement {
  id: string
  messageId: string
  quote: string
}

export interface DeliveryFixture {
  ruleId: string
  expected: 'pass' | 'fail'
  inputs: Record<string, string>
}

export type DeliveryValidationStatus = 'pass' | 'fail' | 'unverified'

export interface DeliveryCheckView {
  ruleId: string
  requirementId: string
  status: DeliveryValidationStatus
  location?: string
  expected?: string
  observed?: string
  reason?: string
}

export interface DeliveryReceiptView {
  id: string
  revisionId: string
  runId?: string
  createdAt: number
  status: DeliveryValidationStatus
  checks: DeliveryCheckView[]
  inputs: {
    alias: string
    path: string
    sha256?: string
    status: 'ready' | 'missing' | 'unavailable'
  }[]
}

export interface DeliveryRunAcceptance {
  revisionId: string
  status: 'pending' | DeliveryValidationStatus | 'not_run'
  receiptId?: string
  checks?: DeliveryCheckView[]
  reason?: string
}

export interface DeliveryPlanView {
  id: string
  planId: string
  revision: number
  title: string
  status: 'draft' | 'active' | 'revoked' | 'stale'
  statusReason?: string
  requirements: DeliveryRequirement[]
  inputs: DeliveryInput[]
  rules: {
    id: string
    requirementId: string
    title: string
    expression: string
    requiresFixtures: boolean
  }[]
  suggestedFixtures: DeliveryFixture[]
  generatorRunId: string
  modelId: string
  createdAt: number
  receipts: DeliveryReceiptView[]
}

export interface DeliveryCatalog {
  sources: { messageId: string; text: string }[]
  agents: { id: string; name: string }[]
  plans: DeliveryPlanView[]
}

export type DeliveryValidationRequest =
  | {
      action: 'draft'
      title: string
      agentId: string
      requirements: { messageId: string; quote: string }[]
      inputs: DeliveryInput[]
      previousRevisionId?: string
    }
  | { action: 'activate'; revisionId: string; fixtures: DeliveryFixture[]; reviewed: true }
  | { action: 'revoke' | 'validate'; revisionId: string }

export type DeliveryValidationResponse = { plan: DeliveryPlanView } | { receipt: DeliveryReceiptView }
