import { z } from 'zod'

export const DELIVERY_VALIDATION_ENGINE_VERSION = 1
export const MAX_DELIVERY_INPUTS = 8
export const MAX_DELIVERY_FILE_BYTES = 256 * 1024
export const MAX_DELIVERY_SNAPSHOT_BYTES = 1024 * 1024
const MAX_DRAFT_BYTES = 64 * 1024
const MAX_RULES = 32
const MAX_EXPRESSION_DEPTH = 12
const MAX_EXPRESSION_NODES = 256
const MAX_CHECK_STEPS = 10_000

export interface DeliveryValidationContext {
  requirements: { id: string; quote: string }[]
  inputs: { alias: string; path: string; format: 'json' | 'markdown' | 'text' }[]
}

export type DeliveryValidationInput = DeliveryValidationContext['inputs'][number]
export type DeliverySnapshot = { status: 'ready'; text: string; sha256: string }
  | { status: 'missing' | 'unavailable'; reason: string }
export type DeliveryStatus = 'pass' | 'fail' | 'unverified'

export interface DeliveryCheck {
  requirementId: string
  ruleId: string
  status: DeliveryStatus
  location?: string
  expected?: string
  observed?: string
  reason?: string
}

export interface DeliveryFixture {
  ruleId: string
  expected: 'pass' | 'fail'
  inputs: Record<string, string>
}

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/)
const shortText = z.string().trim().min(1).max(180)
const propertyKey = z.string().max(128)
const valueType = z.enum(['object', 'array', 'string', 'number', 'boolean', 'null'])
const valueTypes = z.array(valueType).min(1).max(6)
type ValueType = z.infer<typeof valueType>
type Scalar = string | number | boolean | null

type JsonShape = {
  types: ValueType[]
  fields?: { key: string; shape: JsonShape; required?: boolean }[]
  exactFields?: boolean
  values?: JsonShape
  items?: JsonShape
}

export type DeliveryExpression =
  | { op: 'literal'; value: Scalar }
  | { op: 'input'; alias: string }
  | { op: 'item' }
  | { op: 'field'; value: DeliveryExpression; key: string }
  | { op: 'is_type'; value: DeliveryExpression; types: ValueType[] }
  | { op: 'count' | 'sum' | 'not'; value: DeliveryExpression }
  | { op: 'and' | 'or'; values: DeliveryExpression[] }
  | { op: 'equals' | 'add'; left: DeliveryExpression; right: DeliveryExpression }
  | { op: 'every'; value: DeliveryExpression; predicate: DeliveryExpression }

const jsonShapeSchema: z.ZodType<JsonShape> = z.lazy(() => z.strictObject({
  types: valueTypes,
  fields: z.array(z.strictObject({
    key: propertyKey, shape: jsonShapeSchema, required: z.boolean().optional(),
  })).max(32).optional(),
  exactFields: z.boolean().optional(),
  values: jsonShapeSchema.optional(),
  items: jsonShapeSchema.optional(),
}))

const expressionSchema: z.ZodType<DeliveryExpression> = z.lazy(() => z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('literal'), value: z.union([z.string().max(512), z.number(), z.boolean(), z.null()]) }),
  z.strictObject({ op: z.literal('input'), alias: identifier }),
  z.strictObject({ op: z.literal('item') }),
  z.strictObject({ op: z.literal('field'), value: expressionSchema, key: propertyKey }),
  z.strictObject({ op: z.literal('is_type'), value: expressionSchema, types: valueTypes }),
  z.strictObject({ op: z.enum(['count', 'sum', 'not']), value: expressionSchema }),
  z.strictObject({ op: z.enum(['and', 'or']), values: z.array(expressionSchema).min(1).max(16) }),
  z.strictObject({ op: z.enum(['equals', 'add']), left: expressionSchema, right: expressionSchema }),
  z.strictObject({ op: z.literal('every'), value: expressionSchema, predicate: expressionSchema }),
]))

const namedRuleFields = { id: identifier, requirementId: identifier, title: shortText }
const ruleSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...namedRuleFields, kind: z.literal('presence'), input: identifier }),
  z.strictObject({ ...namedRuleFields, kind: z.literal('json_shape'), input: identifier, shape: jsonShapeSchema }),
  z.strictObject({
    ...namedRuleFields, kind: z.literal('markdown_heading'), input: identifier,
    heading: shortText, level: z.number().int().min(1).max(6).optional(),
  }),
  z.strictObject({ ...namedRuleFields, kind: z.literal('function'), expression: expressionSchema }),
  z.strictObject({ ...namedRuleFields, kind: z.literal('unverified'), reason: shortText }),
])
const draftSchema = z.strictObject({
  rules: z.array(ruleSchema).max(MAX_RULES),
  suggestedFixtures: z.array(z.strictObject({
    ruleId: identifier, expected: z.enum(['pass', 'fail']),
    inputs: z.record(identifier, z.string().max(MAX_DELIVERY_FILE_BYTES)),
  })).max(MAX_RULES).optional(),
})
export type DeliveryRule = z.infer<typeof ruleSchema>
export type DeliveryDraft = z.infer<typeof draftSchema>

export const DELIVERY_VALIDATION_GRAMMAR = [
  'Return only a JSON object {"rules":[...]}. Each rule has unique id, requirementId from the supplied requirements, title and kind.',
  'Rule kinds: presence {input}; json_shape {input,shape}; markdown_heading {input,heading,level?}; function {expression}; unverified {reason}. Input names are supplied aliases.',
  'A JSON shape is {types:[object|array|string|number|boolean|null],fields?:[{key,shape,required?:boolean}],values?:shape,items?:shape,exactFields?:boolean}. Fields are required by default. values checks each object value; items checks each array item. exactFields permits only listed fields.',
  'Expression nodes: {op:"literal",value:<scalar>}, {op:"input",alias}, {op:"item"}, {op:"field",value,key}, {op:"is_type",value,types}, {op:"count"|"sum"|"not",value}, {op:"and"|"or",values:[...]}, {op:"equals"|"add",left,right}, {op:"every",value,predicate}. Node operands are expression nodes unless a name, field key, type list or scalar is specified.',
  'A function returns a boolean and references at least one supplied input. field reads an object field. count counts array items, object keys or UTF-16 code units in a string. sum adds a numeric array. add and sum require finite numbers. equals compares scalars of the same type. every checks an array or object values, with item referring to the current value inside predicate.',
  'Optional suggestedFixtures are review candidates only: [{ruleId,expected:"pass"|"fail",inputs:{alias:"input bytes as text"}}]. Use only known custom function IDs, declared aliases and small synthetic input examples.',
  'Use up to 32 rules and at most 256 nodes across all shapes and functions, with at most 12 levels of shape or expression nesting. State requirements outside these operations as unverified. Do not invent requirements, paths, values or evidence.',
].join('\n')

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function own<T>(fields: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(fields, key) ? fields[key] : undefined
}

function assertBoundedDraft(value: unknown) {
  let remaining = 4096
  let bytes = MAX_DRAFT_BYTES
  function visit(node: unknown, depth: number) {
    if (--remaining < 0 || depth > MAX_EXPRESSION_DEPTH * 3 + 4) throw new Error('Validation draft exceeds its structural bounds')
    if (typeof node === 'string') bytes -= Buffer.byteLength(node)
    else if (Array.isArray(node)) {
      if (node.length > remaining) throw new Error('Validation draft has too many items')
      for (const item of node) visit(item, depth + 1)
    } else if (isObject(node)) {
      for (const key of Object.keys(node)) {
        bytes -= Buffer.byteLength(key)
        visit(node[key], depth + 1)
      }
    }
    if (bytes < 0) throw new Error('Validation draft exceeds its size bound')
  }
  visit(value, 0)
}

export function parseDeliveryDraft(raw: unknown, context: DeliveryValidationContext): DeliveryDraft {
  if (typeof raw === 'string') {
    if (Buffer.byteLength(raw) > MAX_DRAFT_BYTES) throw new Error('Validation draft exceeds its size bound')
    try { raw = parseJson(raw) } catch { throw new Error('Validation draft must be one valid JSON object with unique keys') }
  }
  assertBoundedDraft(raw)
  const parsed = draftSchema.safeParse(raw)
  if (!parsed.success) throw new Error(`Invalid validation draft at ${parsed.error.issues[0]?.path.join('.') || 'root'}`)

  const inputs = new Map(context.inputs.map(input => [input.alias, input]))
  const requirements = new Set(context.requirements.map(requirement => requirement.id))
  const ruleIds = new Set<string>()
  let remaining = MAX_EXPRESSION_NODES
  function charge(depth: number) {
    if (--remaining < 0 || depth > MAX_EXPRESSION_DEPTH) throw new Error('Validation rules exceed their size or depth bound')
  }
  function validateShape(shape: JsonShape, depth: number) {
    charge(depth)
    if ((shape.fields || shape.values || shape.exactFields !== undefined) && !shape.types.includes('object')) {
      throw new Error('Object shape constraints require type object')
    }
    if (shape.items && !shape.types.includes('array')) throw new Error('Item shape requires type array')
    if (shape.exactFields && !shape.fields) throw new Error('Exact fields require a field list')
    if (new Set(shape.fields?.map(field => field.key)).size !== (shape.fields?.length ?? 0)) {
      throw new Error('JSON shape contains duplicate field keys')
    }
    for (const field of shape.fields ?? []) validateShape(field.shape, depth + 1)
    if (shape.values) validateShape(shape.values, depth + 1)
    if (shape.items) validateShape(shape.items, depth + 1)
  }
  function validateExpression(node: DeliveryExpression, depth: number, insideItem: boolean): boolean {
    charge(depth)
    switch (node.op) {
      case 'input':
        if (!inputs.has(node.alias)) throw new Error('Validation function references an undeclared input')
        return true
      case 'literal': return false
      case 'item':
        if (!insideItem) throw new Error('Validation function uses item outside an every predicate')
        return false
      case 'every': {
        const input = validateExpression(node.value, depth + 1, insideItem)
        return validateExpression(node.predicate, depth + 1, true) || input
      }
      case 'and':
      case 'or':
        return node.values.map(value => validateExpression(value, depth + 1, insideItem)).includes(true)
      case 'equals':
      case 'add': {
        const input = validateExpression(node.left, depth + 1, insideItem)
        return validateExpression(node.right, depth + 1, insideItem) || input
      }
      default: return validateExpression(node.value, depth + 1, insideItem)
    }
  }
  for (const rule of parsed.data.rules) {
    if (ruleIds.has(rule.id)) throw new Error('Validation draft contains duplicate rule IDs')
    ruleIds.add(rule.id)
    if (!requirements.has(rule.requirementId)) throw new Error('Validation rule references an unselected requirement')
    if ('input' in rule && !inputs.has(rule.input)) throw new Error('Validation rule references an undeclared input')
    if (rule.kind === 'json_shape') {
      if (inputs.get(rule.input)?.format !== 'json') throw new Error('JSON check requires a declared JSON input')
      validateShape(rule.shape, 1)
    }
    if (rule.kind === 'markdown_heading' && inputs.get(rule.input)?.format !== 'markdown') {
      throw new Error('Markdown check requires a declared Markdown input')
    }
    if (rule.kind === 'function' && !validateExpression(rule.expression, 1, false)) {
      throw new Error('Validation function must reference a declared input')
    }
  }
  const functionIds = new Set(parsed.data.rules.filter(rule => rule.kind === 'function').map(rule => rule.id))
  for (const fixture of parsed.data.suggestedFixtures ?? []) {
    if (!functionIds.has(fixture.ruleId)) throw new Error('Suggested fixture references an unknown custom function')
    const files = Object.entries(fixture.inputs)
    if (files.length > MAX_DELIVERY_INPUTS || files.some(([alias, text]) =>
      !inputs.has(alias) || Buffer.byteLength(text) > MAX_DELIVERY_FILE_BYTES)) {
      throw new Error('Suggested fixture has an unknown input or exceeds input bounds')
    }
  }
  return parsed.data
}

function parseJson(text: string): unknown {
  const parsed: unknown = JSON.parse(text)
  const tokens = /"(?:[^"\\]|\\[\s\S])*"|[{}\[\],:]/g
  const stack: ({ keys: Set<string>; expectKey: boolean } | null)[] = []
  for (const [token] of text.matchAll(tokens)) {
    const frame = stack.at(-1)
    if (frame?.expectKey && token.startsWith('"')) {
      const key = JSON.parse(token) as string
      if (frame.keys.has(key)) throw new Error('Duplicate JSON key')
      frame.keys.add(key)
      frame.expectKey = false
    } else if (token === '{' || token === '[') {
      stack.push(token === '{' ? { keys: new Set(), expectKey: true } : null)
    } else if (token === '}' || token === ']') {
      stack.pop()
    } else if (token === ',' && frame) {
      frame.expectKey = true
    }
  }
  return parsed
}

function typeOf(value: unknown): ValueType | 'invalid_number' | 'unavailable' {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (isObject(value)) return 'object'
  if (typeof value === 'number') return Number.isFinite(value) ? 'number' : 'invalid_number'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'boolean') return 'boolean'
  return 'unavailable'
}

function hasType(types: ValueType[], value: unknown): boolean {
  return types.some(type => type === typeOf(value))
}

function fieldLocation(parent: string, key: string | number): string {
  const path = `${parent}[${JSON.stringify(typeof key === 'string' ? key.slice(0, 128) : key)}]`
  return path.length <= 768 ? path : `${path.slice(0, 765)}…`
}

type CheckDetail = Pick<DeliveryCheck, 'location' | 'expected' | 'observed'>
type EvaluatedValue = { value: unknown; location?: string }

class Unverified extends Error {}
class InvalidJson extends Error {}

function shapeMismatch(shape: JsonShape, value: unknown, location: string, step: () => void): CheckDetail | undefined {
  step()
  if (!hasType(shape.types, value)) return { location, expected: shape.types.join(' or '), observed: typeOf(value) }
  if (isObject(value)) {
    for (const field of shape.fields ?? []) {
      step()
      const fieldPath = fieldLocation(location, field.key)
      if (!Object.hasOwn(value, field.key)) {
        if (field.required !== false) return { location: fieldPath, expected: 'required field', observed: 'missing' }
        continue
      }
      const mismatch = shapeMismatch(field.shape, value[field.key], fieldPath, step)
      if (mismatch) return mismatch
    }
    if (shape.exactFields || shape.values) {
      const allowed = new Set(shape.fields?.map(field => field.key))
      for (const key of Object.keys(value)) {
        step()
        const fieldPath = fieldLocation(location, key)
        if (shape.exactFields && !allowed.has(key)) {
          return { location: fieldPath, expected: 'only declared fields', observed: 'extra field' }
        }
        if (shape.values) {
          const mismatch = shapeMismatch(shape.values, value[key], fieldPath, step)
          if (mismatch) return mismatch
        }
      }
    }
  }
  if (Array.isArray(value) && shape.items) {
    for (let index = 0; index < value.length; index++) {
      const mismatch = shapeMismatch(shape.items, value[index], fieldLocation(location, index), step)
      if (mismatch) return mismatch
    }
  }
}

function hasMarkdownHeading(text: string, required: string, level: number | undefined): boolean {
  let fence: { marker: string; size: number } | undefined
  for (const line of text.split(/\r?\n/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    if (fence) {
      if (marker?.[1][0] === fence.marker && marker[1].length >= fence.size && !marker[2].trim()) fence = undefined
      continue
    }
    if (marker && (marker[1][0] === '~' || !marker[2].includes('`'))) {
      fence = { marker: marker[1][0], size: marker[1].length }
      continue
    }
    const heading = line.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*)|$)/)
    if (!heading) continue
    const title = (heading[2] ?? '').replace(/(?:^|[ \t]+)#+[ \t]*$/, '').trim()
    if (title === required && (level === undefined || heading[1].length === level)) return true
  }
  return false
}

function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Unverified('Expression requires a boolean operand')
  return value
}

function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Unverified('Expression requires finite numbers')
  return value
}

function isScalar(value: unknown): value is Scalar {
  return value === null || typeof value === 'boolean' || typeof value === 'string'
    || (typeof value === 'number' && Number.isFinite(value))
}

function evaluateExpression(
  node: DeliveryExpression,
  input: (alias: string) => EvaluatedValue,
  step: () => void,
  currentItem?: EvaluatedValue,
): EvaluatedValue {
  step()
  const evaluate = (expression: DeliveryExpression) => evaluateExpression(expression, input, step, currentItem)
  switch (node.op) {
    case 'literal': return { value: node.value }
    case 'input': return input(node.alias)
    case 'item':
      if (!currentItem) throw new Unverified('Item is unavailable')
      return currentItem
    case 'field': {
      const parent = evaluate(node.value)
      if (!isObject(parent.value) || !Object.hasOwn(parent.value, node.key)) throw new Unverified('Expression field is unavailable')
      return { value: parent.value[node.key], location: fieldLocation(parent.location ?? '$', node.key) }
    }
    case 'is_type': {
      const candidate = evaluate(node.value)
      return { value: hasType(node.types, candidate.value), location: candidate.location }
    }
    case 'count': {
      const { value, location } = evaluate(node.value)
      if (typeof value === 'string' || Array.isArray(value)) return { value: value.length, location }
      if (isObject(value)) return { value: Object.keys(value).length, location }
      throw new Unverified('Count requires an array, object or string')
    }
    case 'sum': {
      const { value, location } = evaluate(node.value)
      if (!Array.isArray(value)) throw new Unverified('Sum requires an array of finite numbers')
      let sum = 0
      for (const item of value) {
        step()
        sum = finite(sum + finite(item))
      }
      return { value: sum, location }
    }
    case 'add': return { value: finite(finite(evaluate(node.left).value) + finite(evaluate(node.right).value)) }
    case 'equals': {
      const left = evaluate(node.left)
      const right = evaluate(node.right)
      if (!isScalar(left.value) || !isScalar(right.value)) throw new Unverified('Equality requires scalar operands')
      return { value: left.value === right.value, location: left.location ?? right.location }
    }
    case 'not': {
      const { value, location } = evaluate(node.value)
      return { value: !boolean(value), location }
    }
    case 'and':
    case 'or': {
      const operands = node.values.map(evaluate)
      const booleans = operands.map(operand => boolean(operand.value))
      const match = node.op === 'and' ? booleans.every(Boolean) : booleans.some(Boolean)
      return { value: match, location: operands.find(operand => operand.location)?.location }
    }
    case 'every': {
      const source = evaluate(node.value)
      if (!Array.isArray(source.value) && !isObject(source.value)) throw new Unverified('Every requires an array or object')
      const entries = Object.entries(source.value)
      if (entries.length > MAX_CHECK_STEPS) throw new Unverified('Expression has too many collection entries')
      for (const [key, value] of entries) {
        step()
        const location = fieldLocation(source.location ?? '$', Array.isArray(source.value) ? Number(key) : key)
        const next = evaluateExpression(node.predicate, input, step, { value, location })
        if (!boolean(next.value)) return { value: false, location: next.location ?? location }
      }
      return { value: true, location: source.location }
    }
  }
}

function evaluateRules(
  rules: DeliveryRule[],
  context: DeliveryValidationContext,
  snapshots: Record<string, DeliverySnapshot>,
): DeliveryCheck[] {
  const inputs = new Map(context.inputs.map(input => [input.alias, input]))
  const parsed = new Map<string, EvaluatedValue | InvalidJson>()
  let remaining = MAX_CHECK_STEPS
  const step = () => {
    if (--remaining < 0) throw new Unverified('Validation work limit reached')
  }
  const inputValue = (alias: string): EvaluatedValue => {
    const cached = parsed.get(alias)
    if (cached instanceof InvalidJson) throw cached
    if (cached) return cached
    const input = inputs.get(alias)
    const snapshot = own(snapshots, alias)
    if (!input) throw new Unverified('Declared input unavailable')
    if (snapshot?.status !== 'ready') throw new Unverified(snapshot?.reason ?? 'Declared input unavailable')
    const location = input.path
    try {
      const value = input.format === 'json'
        ? { value: parseJson(snapshot.text), location: `${location} → $` }
        : { value: snapshot.text, location }
      parsed.set(alias, value)
      return value
    } catch {
      const error = new InvalidJson('Input is not valid JSON with unique keys')
      parsed.set(alias, error)
      throw error
    }
  }
  return rules.map<DeliveryCheck>(rule => {
    const base = { ruleId: rule.id, requirementId: rule.requirementId }
    const location = 'input' in rule ? inputs.get(rule.input)?.path : undefined
    try {
      step()
      switch (rule.kind) {
        case 'unverified': return { ...base, status: 'unverified', reason: rule.reason }
        case 'presence': {
          const input = own(snapshots, rule.input)
          if (input?.status === 'ready') return { ...base, status: 'pass', location }
          if (input?.status === 'missing') return { ...base, status: 'fail', location, expected: 'regular file', observed: 'missing' }
          throw new Unverified(input?.reason ?? 'Declared input unavailable')
        }
        case 'json_shape': {
          const subject = inputValue(rule.input)
          const detail = shapeMismatch(rule.shape, subject.value, subject.location ?? '$', step)
          return detail ? { ...base, status: 'fail', ...detail } : { ...base, status: 'pass', location }
        }
        case 'markdown_heading': {
          const parsed = inputValue(rule.input)
          if (typeof parsed.value !== 'string') throw new Unverified('Markdown input is unavailable')
          const found = hasMarkdownHeading(parsed.value, rule.heading, rule.level)
          return found ? { ...base, status: 'pass', location } : {
            ...base, status: 'fail', location, expected: `ATX heading "${rule.heading}"`, observed: 'no matching heading',
          }
        }
        case 'function': {
          const result = evaluateExpression(rule.expression, inputValue, step)
          return boolean(result.value) ? { ...base, status: 'pass', location: result.location } : {
            ...base, status: 'fail', location: result.location, expected: 'true', observed: 'false',
          }
        }
      }
    } catch (error) {
      if (error instanceof InvalidJson && rule.kind === 'json_shape') {
        return { ...base, status: 'fail', location, expected: 'valid JSON with unique keys', observed: 'invalid JSON' }
      }
      return {
        ...base, status: 'unverified', location,
        reason: error instanceof Unverified || error instanceof InvalidJson ? error.message : 'Validation could not finish',
      }
    }
  })
}

export function evaluateDeliveryDraft(
  draft: DeliveryDraft,
  context: DeliveryValidationContext,
  snapshots: Record<string, DeliverySnapshot>,
): { status: DeliveryStatus; checks: DeliveryCheck[] } {
  const checks = evaluateRules(draft.rules, context, snapshots)
  const covered = new Set(checks.map(check => check.requirementId))
  for (const requirement of context.requirements) {
    if (!covered.has(requirement.id)) checks.push({
      requirementId: requirement.id, ruleId: '', status: 'unverified', reason: 'Requirement has no validation rule',
    })
  }
  for (const input of context.inputs) {
    const snapshot = own(snapshots, input.alias)
    if (snapshot?.status === 'ready' || checks.some(check => check.location === input.path && check.status !== 'pass')) continue
    checks.push({
      ruleId: '', requirementId: '', location: input.path, status: 'unverified',
      reason: snapshot?.reason ?? 'Declared input unavailable',
    })
  }
  if (checks.some(check => check.status === 'fail')) return { status: 'fail', checks }
  const allChecksPass = checks.length > 0 && checks.every(check => check.status === 'pass')
  return { status: allChecksPass ? 'pass' : 'unverified', checks }
}

export function qualifyDeliveryDraft(draft: DeliveryDraft, context: DeliveryValidationContext, fixtures: DeliveryFixture[]) {
  const errors: string[] = []
  const checks: { ruleId: string; expected: DeliveryFixture['expected']; actual: DeliveryStatus }[] = []
  const functions = new Map(draft.rules.filter(rule => rule.kind === 'function').map(rule => [rule.id, rule]))
  const aliases = new Set(context.inputs.map(input => input.alias))
  if (fixtures.length > MAX_RULES * 2) return { ok: false, checks, errors: ['Too many qualification fixtures'] }
  let totalBytes = 0
  for (const fixture of fixtures) {
    const rule = functions.get(fixture.ruleId)
    if (!rule) {
      errors.push(`No custom function for fixture rule ${fixture.ruleId}`)
      continue
    }
    const snapshots: Record<string, DeliverySnapshot> = Object.create(null)
    const files = Object.entries(fixture.inputs)
    let valid = files.length <= MAX_DELIVERY_INPUTS
    for (const [alias, text] of files) {
      const size = Buffer.byteLength(text)
      totalBytes += size
      if (size > MAX_DELIVERY_FILE_BYTES || !aliases.has(alias)) valid = false
      snapshots[alias] = { status: 'ready', text, sha256: '' }
    }
    if (totalBytes > MAX_DELIVERY_SNAPSHOT_BYTES) return { ok: false, checks, errors: ['Qualification fixtures exceed the total size bound'] }
    if (!valid) {
      errors.push(`Invalid qualification inputs for rule ${rule.id}`)
      continue
    }
    const [actual] = evaluateRules([rule], context, snapshots)
    checks.push({ ruleId: rule.id, expected: fixture.expected, actual: actual.status })
    if (actual.status !== fixture.expected) {
      errors.push(`Rule ${rule.id} expected ${fixture.expected} but returned ${actual.status}`)
    }
  }
  for (const rule of functions.values()) {
    if (!(['pass', 'fail'] as const).every(expected => checks.some(check =>
      check.ruleId === rule.id && check.expected === expected && check.actual === expected))) {
      errors.push(`Rule ${rule.id} requires a passing and a failing qualification fixture`)
    }
  }
  return { ok: errors.length === 0, checks, errors }
}

export function renderDeliveryRule(rule: DeliveryRule): string {
  switch (rule.kind) {
    case 'presence': return `exists(${rule.input})`
    case 'json_shape': return `shape(${rule.input}, ${JSON.stringify(rule.shape)})`
    case 'markdown_heading': return `heading(${rule.input}, ${JSON.stringify(rule.heading)}${rule.level === undefined ? '' : `, level=${rule.level}`})`
    case 'unverified': return rule.reason
    case 'function': return renderExpression(rule.expression)
  }
}

function renderExpression(node: DeliveryExpression): string {
  switch (node.op) {
    case 'literal': return JSON.stringify(node.value)
    case 'input': return node.alias
    case 'item': return 'item'
    case 'field': return `${renderExpression(node.value)}[${JSON.stringify(node.key)}]`
    case 'is_type': return `is_type(${renderExpression(node.value)}, ${node.types.join(' | ')})`
    case 'and':
    case 'or': return `${node.op}(${node.values.map(renderExpression).join(', ')})`
    case 'equals':
    case 'add': return `${node.op}(${renderExpression(node.left)}, ${renderExpression(node.right)})`
    case 'every': return `every(${renderExpression(node.value)}, item => ${renderExpression(node.predicate)})`
    default: return `${node.op}(${renderExpression(node.value)})`
  }
}
