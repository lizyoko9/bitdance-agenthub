import { readJson, writeJson } from './json-file.js'

export const DEFAULTS = { theme: 'light', retries: 3 }

export function loadConfig(path, cb) {
  readJson(path, (err, data) => {
    if (err && err.code === 'ENOENT') return cb(null, { ...DEFAULTS })
    if (err) return cb(err)
    cb(null, { ...DEFAULTS, ...data })
  })
}

export function saveConfig(path, patch, cb) {
  loadConfig(path, (err, current) => {
    if (err) return cb(err)
    const next = { ...current, ...patch }
    writeJson(path, next, (writeErr) => cb(writeErr ?? null, writeErr ? undefined : next))
  })
}
