export function countRows(rows) {
  return rows.length
}

export function groupBy(rows, key, valueColumn) {
  const groups = new Map()
  for (const row of rows) {
    const group = groups.get(row[key]) ?? { key: row[key], count: 0, sum: 0 }
    group.count++
    group.sum += Number(row[valueColumn])
    groups.set(row[key], group)
  }
  return [...groups.values()]
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((g) => ({ ...g, avg: Math.round((g.sum / g.count) * 100) / 100 }))
}
