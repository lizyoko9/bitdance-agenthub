import { readFileSync } from 'node:fs'

import { countRows } from './aggregate.js'
import { parseCsv } from './parse.js'

const [file] = process.argv.slice(2)
const rows = parseCsv(readFileSync(file, 'utf8'))
process.stdout.write(JSON.stringify({ rows: countRows(rows) }) + '\n')
