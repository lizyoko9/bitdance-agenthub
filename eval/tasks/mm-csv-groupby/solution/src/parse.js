function splitRecords(text) {
  const records = []
  let record = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      record.push(field)
      field = ''
    } else if (ch === '\n') {
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }
  record.push(field)
  records.push(record)
  return records.filter((r) => !(r.length === 1 && r[0] === ''))
}

export function parseCsv(text) {
  const [columns, ...records] = splitRecords(text)
  return records.map((cells) => Object.fromEntries(columns.map((c, i) => [c, cells[i]])))
}
