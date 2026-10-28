export function parseCsv(text) {
  const [header, ...lines] = text.split('\n')
  const columns = header.split(',')
  return lines.map((line) => {
    const cells = line.split(',')
    return Object.fromEntries(columns.map((c, i) => [c, cells[i]]))
  })
}
