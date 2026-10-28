import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import { createKv } from './kv.js'

export function save(kv, file) {
  writeFileSync(file, JSON.stringify(kv.entries()))
}

export function load(file, { now = Date.now } = {}) {
  const kv = createKv({ now })
  if (!existsSync(file)) return kv
  for (const { key, value, expiresAt } of JSON.parse(readFileSync(file, 'utf8'))) {
    if (expiresAt === null || expiresAt > now()) kv.setWithExpiry(key, value, expiresAt)
  }
  return kv
}
