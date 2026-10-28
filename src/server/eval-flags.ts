// 仅供评测对照组使用，见 specs/06-orchestrator-flow.md「评测开关」
export function evidenceGatesEnabled(): boolean {
  return process.env.AGENTHUB_EVAL_EVIDENCE_GATES !== 'off'
}
