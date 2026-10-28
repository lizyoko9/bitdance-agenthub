import { readJson, writeJson } from './json-file.js'

export const DEFAULTS = { theme: 'light', retries: 3 }

export async function loadConfig(path) {
  try {
    return { ...DEFAULTS, ...(await readJson(path)) }
  } catch (err) {
    if (err.code === 'ENOENT') return { ...DEFAULTS }
    throw err
  }
}

export async function saveConfig(path, patch) {
  const next = { ...(await loadConfig(path)), ...patch }
  await writeJson(path, next)
  return next
}
