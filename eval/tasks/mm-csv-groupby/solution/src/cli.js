import { readFileSync } from 'node:fs'

import { countRows, groupBy } from './aggregate.js'
import { parseCsv } from './parse.js'

const args = process.argv.slice(2)
const file = args[0]
const option = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}

const rows = parseCsv(readFileSync(file, 'utf8'))
const groupColumn = option('--group-by')
if (groupColumn === undefined) {
  process.stdout.write(JSON.stringify({ rows: countRows(rows) }) + '\n')
} else {
  const valueColumn = option('--value')
  const known = new Set(Object.keys(rows[0] ?? {}))
  for (const column of [groupColumn, valueColumn]) {
    if (!known.has(column)) {
      process.stderr.write(`unknown column: ${column}\n`)
      process.exit(1)
    }
  }
  process.stdout.write(JSON.stringify(groupBy(rows, groupColumn, valueColumn)) + '\n')
}
