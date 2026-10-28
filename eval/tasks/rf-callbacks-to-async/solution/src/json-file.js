import { readFile, rename, writeFile } from 'node:fs/promises'

export async function readJson(path) {
  const text = await readFile(path, 'utf8')
  try {
    return JSON.parse(text)
  } catch (parseErr) {
    throw new Error(`invalid JSON in ${path}: ${parseErr.message}`)
  }
}

export async function writeJson(path, data) {
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n')
  await rename(tmp, path)
}
