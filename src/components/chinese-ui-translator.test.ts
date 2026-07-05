import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('ChineseUiTranslator runtime source guard', () => {
  const readTranslatorSource = () =>
    readFileSync(resolve(process.cwd(), 'src/components/chinese-ui-translator.tsx'), 'utf8')

  it('removes leaked runtime source text nodes before translating the UI', () => {
    const source = readTranslatorSource()

    expect(source).toContain('removeRuntimeSourceTextNodes(root)')
    expect(source).toContain('looksLikeRuntimeSource(node.textContent)')
    expect(source).toContain('node.remove()')
  })
})
