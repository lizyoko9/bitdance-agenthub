import { describe, expect, it } from 'vitest'

import {
  evaluateDeliveryDraft,
  parseDeliveryDraft,
  qualifyDeliveryDraft,
  renderDeliveryRule,
  type DeliveryExpression,
  type DeliverySnapshot,
  type DeliveryValidationContext,
} from './delivery-validation-engine'

const context: DeliveryValidationContext = {
  requirements: [{ id: 'r1', quote: 'Check the submitted files against the agreed structure.' }],
  inputs: [
    { alias: 'rows', path: 'output/rows.json', format: 'json' },
    { alias: 'summary', path: 'output/summary.json', format: 'json' },
    { alias: 'report', path: 'output/report.md', format: 'markdown' },
  ],
}
const idFields = { id: 'check1', requirementId: 'r1', title: 'Check expected output' }
const input = (alias: string): DeliveryExpression => ({ op: 'input', alias })
const field = (value: DeliveryExpression, key: string): DeliveryExpression => ({ op: 'field', value, key })
const tally: DeliveryExpression = {
  op: 'equals',
  left: { op: 'count', value: input('rows') },
  right: { op: 'add', left: field(input('summary'), 'deleted'), right: field(input('summary'), 'kept') },
}
const checkFunction = { ...idFields, kind: 'function', expression: tally }
const ready = (text: string): DeliverySnapshot => ({ status: 'ready', text, sha256: 'fixture' })
const readyInputs = {
  rows: ready('["A", "B"]'), summary: ready('{"deleted":1,"kept":1}'), report: ready('## Summary\n'),
}

describe('delivery validation engine', () => {
  it('rejects a syntactically valid map with a wrong nested value and reports the path', () => {
    const draft = parseDeliveryDraft({
      rules: [{
        ...idFields, kind: 'json_shape', input: 'rows', shape: { types: ['object'], values: { types: ['string', 'null'] } },
      }],
    }, context)
    const correct = evaluateDeliveryDraft(draft, context, { ...readyInputs, rows: ready('{"alpha":"AB12CD34","beta":null}') })
    expect(correct.status).toBe('pass')
    const wrong = evaluateDeliveryDraft(draft, context, {
      ...readyInputs, rows: ready('{"alpha":{"code":"AB12CD34"},"beta":null}'),
    })
    expect(wrong).toEqual({
      status: 'fail', checks: [{
        requirementId: 'r1', ruleId: 'check1', status: 'fail',
        location: 'output/rows.json → $["alpha"]', expected: 'string or null', observed: 'object',
      }],
    })
  })

  it('does not accept duplicate decoded JSON keys', () => {
    const draft = parseDeliveryDraft({
      rules: [{ ...idFields, kind: 'json_shape', input: 'rows', shape: { types: ['object'] } }],
    }, context)
    const result = evaluateDeliveryDraft(draft, context, {
      ...readyInputs, rows: ready(String.raw`{"entry":1,"\u0065ntry":2}`),
    })
    expect(result.checks[0]).toMatchObject({ status: 'fail', expected: 'valid JSON with unique keys' })
    expect(() => parseDeliveryDraft('{"rules":[],"rules":[]}', context)).toThrow(/valid JSON/)
  })

  it('authorizes only known requirement, input and function operations', () => {
    expect(() => parseDeliveryDraft({ rules: [{
      ...idFields, kind: 'presence', requirementId: 'another-requirement', input: 'rows',
    }] }, context)).toThrow('unselected requirement')
    expect(() => parseDeliveryDraft({ rules: [{
      ...checkFunction, expression: { op: 'input', alias: 'unknown' },
    }] }, context)).toThrow('undeclared input')
    expect(() => parseDeliveryDraft({ rules: [{
      ...checkFunction, expression: { op: 'read_file', value: 'output/report.md' },
    }] }, context)).toThrow('Invalid validation draft')
    expect(() => parseDeliveryDraft({ rules: [{
      ...checkFunction, expression: { op: 'literal', value: true },
    }] }, context)).toThrow('must reference a declared input')
  })

  it('requires reviewed positive and negative fixtures and reuses a qualified rule across snapshots', () => {
    const positive = { ruleId: 'check1', expected: 'pass' as const, inputs: { rows: '[1,2]', summary: '{"deleted":1,"kept":1}' } }
    const negative = { ruleId: 'check1', expected: 'fail' as const, inputs: { rows: '[1,2]', summary: '{"deleted":1,"kept":0}' } }
    const draft = parseDeliveryDraft({ rules: [checkFunction], suggestedFixtures: [positive, negative] }, context)
    expect(qualifyDeliveryDraft(draft, context, []).ok).toBe(false)
    expect(qualifyDeliveryDraft(draft, context, [positive, { ...negative, inputs: positive.inputs }])).toMatchObject({
      ok: false, checks: [{ actual: 'pass' }, { expected: 'fail', actual: 'pass' }],
    })
    expect(qualifyDeliveryDraft(draft, context, [positive, negative])).toMatchObject({
      ok: true, checks: [{ actual: 'pass' }, { actual: 'fail' }],
    })
    expect(renderDeliveryRule(draft.rules[0])).toBe('equals(count(rows), add(summary["deleted"], summary["kept"]))')
    expect(evaluateDeliveryDraft(draft, context, readyInputs).status).toBe('pass')
    expect(evaluateDeliveryDraft(draft, context, { ...readyInputs, summary: ready('{"deleted":2,"kept":1}') }).status).toBe('fail')
  })

  it('uses own JSON keys and returns unverified when a function cannot access its input', () => {
    const draft = parseDeliveryDraft({ rules: [{ ...checkFunction, expression: {
      op: 'is_type', value: field(input('summary'), 'constructor'), types: ['string'],
    } }] }, context)
    expect(evaluateDeliveryDraft(draft, context, readyInputs).checks[0]).toMatchObject({
      status: 'unverified', reason: 'Expression field is unavailable',
    })
    const sumDraft = parseDeliveryDraft({ rules: [checkFunction] }, context)
    expect(evaluateDeliveryDraft(sumDraft, context, { ...readyInputs, summary: ready('not JSON') }).status).toBe('unverified')
  })

  it('checks heading level and excludes examples inside code fences', () => {
    const draft = parseDeliveryDraft({ rules: [{
      ...idFields, kind: 'markdown_heading', input: 'report', heading: 'Summary', level: 2,
    }] }, context)
    for (const text of ['### Summary\n', '```md\n## Summary\n```\n', '~~~md\n## Summary\n~~~\n']) {
      expect(evaluateDeliveryDraft(draft, context, { ...readyInputs, report: ready(text) }).status).toBe('fail')
    }
    expect(evaluateDeliveryDraft(draft, context, { ...readyInputs, report: ready('## Summary ##\r\n') }).status).toBe('pass')
  })

  it('does not pass missing requirement coverage, unavailable inputs or an empty plan', () => {
    const expanded = { ...context, requirements: [...context.requirements, { id: 'r2', quote: 'Also verify freshness.' }] }
    expect(evaluateDeliveryDraft(parseDeliveryDraft({ rules: [] }, context), context, readyInputs).status).toBe('unverified')
    const draft = parseDeliveryDraft({ rules: [{ ...idFields, kind: 'presence', input: 'report' }] }, expanded)
    expect(evaluateDeliveryDraft(draft, expanded, readyInputs)).toMatchObject({
      status: 'unverified', checks: [{ status: 'pass' }, { requirementId: 'r2', status: 'unverified' }],
    })
    expect(evaluateDeliveryDraft(draft, context, {
      ...readyInputs, report: { status: 'missing', reason: 'missing' },
    }).status).toBe('fail')
    expect(evaluateDeliveryDraft(draft, context, {
      ...readyInputs, rows: { status: 'unavailable', reason: 'too large' },
    }).status).toBe('unverified')
  })

  it('bounds nested model drafts and per-item evaluation on large collections', () => {
    let expression = input('rows')
    for (let i = 0; i < 12; i++) expression = { op: 'not', value: expression }
    expect(() => parseDeliveryDraft({ rules: [{ ...checkFunction, expression }] }, context)).toThrow(/depth bound/)
    const draft = parseDeliveryDraft({ rules: [{
      ...checkFunction, expression: {
        op: 'every', value: input('rows'), predicate: { op: 'is_type', value: { op: 'item' }, types: ['number'] },
      },
    }] }, context)
    expect(evaluateDeliveryDraft(draft, context, {
      ...readyInputs, rows: ready(JSON.stringify(new Array(5000).fill(1))),
    }).checks[0]).toMatchObject({ status: 'unverified', reason: 'Validation work limit reached' })
  })
})
