/**
 * 内置 Skill（方法论模块）seed 数据。
 *
 * Skill 是可复用的「工作方法」指令包：被 Agent 选用后由 AgentRunner 注入 system prompt
 * （见 specs/13-conversation-context.md）。Skill **不授予可执行工具权限**——`requiredToolNames`
 * 只用于 Agent Studio 的依赖提示，不影响实际 toolNames（见 openspec tools spec）。
 *
 * 与内置 Agent 一样，在 bootstrap 阶段幂等 seed（已有任意 builtin skill 就跳过）。
 */
import type { SkillInsert } from './schema'

type BuiltinSkill = Omit<SkillInsert, 'createdAt'>

const BUILTIN_SKILL_SEED: BuiltinSkill[] = [
  {
    id: 'skill_impl_plan',
    name: '实现计划',
    description: '先定位影响面，再小步修改并验证，避免大刀阔斧改坏。',
    category: 'coding',
    requiredToolNames: ['fs_read', 'fs_write', 'bash'],
    instruction: `采用「先定位、再小步、勤验证」的实现方法：
1. 动手前先读相关源码和约定，确认改动影响面与依赖关系。
2. 拆成可独立验证的小步，每步只改与目标直接相关的代码，不顺手重构。
3. 每步改完尽量运行最小必要的检查（类型/测试/构建）确认没破坏既有行为。
4. 交付时说明改了什么、怎么验证的、还剩什么风险。`,
  },
  {
    id: 'skill_code_review',
    name: '审查准则',
    description: '以发现真实风险为目标，问题优先、按严重度排序、引用具体位置。',
    category: 'review',
    requiredToolNames: ['fs_read', 'bash'],
    instruction: `审查时遵循「问题优先」的准则：
1. 先读变更和相关上下文，不凭文件名或摘要臆断。
2. 输出以问题为先，按严重程度（阻断/高/中/低）排序，每条引用具体文件与行。
3. 每个问题说明触发条件、影响和建议修复方向。
4. 指出缺失的测试覆盖；没有高价值问题时如实说明，并列残余风险。`,
  },
  {
    id: 'skill_requirement_clarify',
    name: '需求澄清',
    description: '先识别目标用户、核心场景与边界条件，再展开方案。',
    category: 'product',
    requiredToolNames: ['ask_user'],
    instruction: `面对模糊需求时先澄清再展开：
1. 先识别目标用户、核心问题、业务目标与明确的非目标。
2. 区分已确认事实、合理假设和待确认项；对关键不确定点用结构化提问澄清。
3. 不臆测用户偏好；缺信息时说明缺什么，而不是假装已知。
4. 澄清后再给方案，并标注每个决策依赖的前提。`,
  },
  {
    id: 'skill_structured_doc',
    name: '结构化文档产出',
    description: '产出有结构、可执行、面向读者的文档，而非营销式表达。',
    category: 'writing',
    requiredToolNames: ['write_artifact'],
    instruction: `产出文档时保证结构清晰、可执行：
1. 先确定读者与文档目标，据此决定结构、深度和示例密度。
2. 结构通常包含：概述/目标、范围与非范围、主体步骤、示例、验收标准、风险与未决项。
3. 示例尽量可复制可运行，术语和命名前后一致。
4. 保持可执行、可验收，避免空泛和营销式表达。`,
  },
  {
    id: 'skill_evidence_debug',
    name: '证据链排障',
    description: '先确认症状与时间线，再读日志配置定位，区分止血与根因。',
    category: 'operations',
    requiredToolNames: ['fs_read', 'bash'],
    instruction: `排障按证据链推进：
1. 先确认症状、时间线、影响范围、最近变更和回滚条件。
2. 读日志、配置、命令输出时保留关键证据，不跳步下结论。
3. 区分止血动作、根因修复和长期治理；优先给低风险止血方案。
4. 不执行破坏性命令；高风险操作前先确认。最终给出根因判断、证据与恢复步骤。`,
  },
  {
    id: 'skill_metric_modeling',
    name: '指标建模',
    description: '先统一口径，再分析趋势、分布与异常，区分事实与推断。',
    category: 'data',
    requiredToolNames: ['read_attachment'],
    instruction: `做数据分析时先统一口径再下结论：
1. 先确认指标定义、时间范围、样本范围、去重/聚合口径和异常定义。
2. 分析趋势、分布、异常时，区分数据事实、合理推断和待验证假设。
3. 结论说明证据来源和局限，不夸大数据含义、不编造数据。
4. 缺数据时明确说明需要补充什么，而不是用假设填空。`,
  },
  {
    id: 'skill_test_design',
    name: '测试用例设计',
    description: '覆盖正常、边界、异常与回归点，避免凑覆盖率的空断言。',
    category: 'coding',
    requiredToolNames: ['fs_read', 'fs_write', 'bash'],
    instruction: `设计测试时聚焦真实风险：
1. 先读被测代码与现有测试，识别未覆盖的关键路径和边界。
2. 用例覆盖正常路径、边界值、异常分支和已知回归点。
3. 避免只为提高覆盖率写无意义断言；断言要能真正捕获缺陷。
4. 跑测试以真实输出为准，失败时先判断是被测代码缺陷还是测试本身问题。`,
  },
  {
    id: 'skill_safe_change',
    name: '安全变更',
    description: '最小改动、可回滚、显式说明影响范围，先在小范围验证。',
    category: 'operations',
    requiredToolNames: ['fs_write', 'bash'],
    instruction: `做有风险的变更时坚持可控可回滚：
1. 改动范围尽量最小，只动与目标直接相关的部分。
2. 涉及写入、批量更新或部署时，先说明影响范围和回滚方式。
3. 优先在只读/小范围/副本上验证，再应用到正式环境。
4. 不执行破坏性或不可逆命令；不确定后果时先停下来确认。`,
  },
]

export const BUILTIN_SKILLS: SkillInsert[] = BUILTIN_SKILL_SEED.map((skill) => ({
  ...skill,
  source: 'builtin',
  isBuiltin: true,
  enabled: true,
  // 固定时间戳，保证 seed 幂等且排序稳定（不依赖 Date.now()）。
  createdAt: 1_717_000_000_000,
  updatedAt: 1_717_000_000_000,
}))
