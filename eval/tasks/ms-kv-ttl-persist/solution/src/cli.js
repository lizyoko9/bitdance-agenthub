import { load, save } from './persist.js'

const [file, command, key, value, ...rest] = process.argv.slice(2)
const kv = load(file)

if (command === 'set') {
  const ttlIndex = rest.indexOf('--ttl')
  kv.set(key, value, ttlIndex === -1 ? {} : { ttlMs: Number(rest[ttlIndex + 1]) })
  save(kv, file)
} else if (command === 'get') {
  if (!kv.has(key)) process.exit(2)
  process.stdout.write(`${kv.get(key)}\n`)
} else if (command === 'dump') {
  process.stdout.write(JSON.stringify(kv.entries()) + '\n')
} else {
  process.stderr.write(`unknown command: ${command}\n`)
  process.exit(1)
}
