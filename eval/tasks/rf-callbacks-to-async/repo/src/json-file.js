import fs from 'node:fs'

export function readJson(path, cb) {
  fs.readFile(path, 'utf8', (err, text) => {
    if (err) return cb(err)
    let data
    try {
      data = JSON.parse(text)
    } catch (parseErr) {
      return cb(new Error(`invalid JSON in ${path}: ${parseErr.message}`))
    }
    cb(null, data)
  })
}

export function writeJson(path, data, cb) {
  fs.writeFile(path, JSON.stringify(data, null, 2) + '\n', cb)
}
