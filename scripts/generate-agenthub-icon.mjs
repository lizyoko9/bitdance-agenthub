import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const outputPath = path.join(projectRoot, 'build', 'icon.ico')
const iconSizes = [16, 24, 32, 48, 64, 128, 256]

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const mix = (from, to, amount) => from + (to - from) * amount
const smoothstep = (edge0, edge1, value) => {
  const x = clamp((value - edge0) / (edge1 - edge0))
  return x * x * (3 - 2 * x)
}

function blendPixel(rgba, offset, color, alpha) {
  const sourceAlpha = clamp(alpha)
  if (sourceAlpha <= 0) {
    return
  }

  const targetAlpha = rgba[offset + 3] / 255
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha)

  rgba[offset] = Math.round((color[0] * sourceAlpha + rgba[offset] * targetAlpha * (1 - sourceAlpha)) / outputAlpha)
  rgba[offset + 1] = Math.round((color[1] * sourceAlpha + rgba[offset + 1] * targetAlpha * (1 - sourceAlpha)) / outputAlpha)
  rgba[offset + 2] = Math.round((color[2] * sourceAlpha + rgba[offset + 2] * targetAlpha * (1 - sourceAlpha)) / outputAlpha)
  rgba[offset + 3] = Math.round(outputAlpha * 255)
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared)
  const closestX = ax + dx * t
  const closestY = ay + dy * t
  return Math.hypot(px - closestX, py - closestY)
}

function roundedRectAlpha(x, y, size) {
  const center = size / 2
  const half = size * 0.42
  const radius = size * 0.18
  const qx = Math.abs(x - center) - half + radius
  const qy = Math.abs(y - center) - half + radius
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  const inside = Math.min(Math.max(qx, qy), 0)
  const distance = outside + inside - radius

  return 1 - smoothstep(-1.2, 1.2, distance)
}

function lineAlpha(x, y, size, from, to, width) {
  const distance = distanceToSegment(x, y, from[0] * size, from[1] * size, to[0] * size, to[1] * size)
  return 1 - smoothstep(width - 0.9, width + 0.9, distance)
}

function circleAlpha(x, y, size, center, radius) {
  const distance = Math.hypot(x - center[0] * size, y - center[1] * size)
  return 1 - smoothstep(radius - 0.9, radius + 0.9, distance)
}

function renderIconRgba(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const strokeWidth = Math.max(1.7, size * 0.055)
  const nodeRadius = Math.max(1.8, size * 0.067)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4
      const backgroundAlpha = roundedRectAlpha(x + 0.5, y + 0.5, size)
      const gradientAmount = clamp((x + y) / (size * 1.9))
      const background = [
        mix(15, 3, gradientAmount),
        mix(22, 74, gradientAmount),
        mix(34, 77, gradientAmount),
      ]

      blendPixel(rgba, offset, background, backgroundAlpha)
    }
  }

  const hubLines = [
    [[0.34, 0.73], [0.5, 0.25]],
    [[0.5, 0.25], [0.66, 0.73]],
    [[0.41, 0.56], [0.59, 0.56]],
  ]
  const hubNodes = [
    [0.5, 0.25],
    [0.34, 0.73],
    [0.66, 0.73],
    [0.41, 0.56],
    [0.59, 0.56],
  ]

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4

      for (const [from, to] of hubLines) {
        const alpha = lineAlpha(x + 0.5, y + 0.5, size, from, to, strokeWidth)
        blendPixel(rgba, offset, [215, 252, 255], alpha * 0.86)
      }

      for (const node of hubNodes) {
        const halo = circleAlpha(x + 0.5, y + 0.5, size, node, nodeRadius * 1.55)
        const core = circleAlpha(x + 0.5, y + 0.5, size, node, nodeRadius)

        blendPixel(rgba, offset, [49, 218, 203], halo * 0.28)
        blendPixel(rgba, offset, [98, 255, 206], core)
      }
    }
  }

  return rgba
}

function createDibImage(size) {
  const rgba = renderIconRgba(size)
  const pixelBytes = Buffer.alloc(size * size * 4)
  const header = Buffer.alloc(40)
  const maskRowBytes = Math.ceil(size / 32) * 4
  const maskBytes = Buffer.alloc(maskRowBytes * size)

  for (let y = 0; y < size; y += 1) {
    const sourceY = size - 1 - y

    for (let x = 0; x < size; x += 1) {
      const source = (sourceY * size + x) * 4
      const target = (y * size + x) * 4

      pixelBytes[target] = rgba[source + 2]
      pixelBytes[target + 1] = rgba[source + 1]
      pixelBytes[target + 2] = rgba[source]
      pixelBytes[target + 3] = rgba[source + 3]
    }
  }

  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(0, 16)
  header.writeUInt32LE(pixelBytes.length, 20)
  header.writeInt32LE(0, 24)
  header.writeInt32LE(0, 28)
  header.writeUInt32LE(0, 32)
  header.writeUInt32LE(0, 36)

  return Buffer.concat([header, pixelBytes, maskBytes])
}

function createIco() {
  const images = iconSizes.map((size) => ({
    size,
    bytes: createDibImage(size),
  }))
  const headerBytes = 6
  const entryBytes = 16
  const header = Buffer.alloc(headerBytes + images.length * entryBytes)

  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  let offset = header.length
  images.forEach((image, index) => {
    const entryOffset = headerBytes + index * entryBytes

    header.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset)
    header.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset + 1)
    header.writeUInt8(0, entryOffset + 2)
    header.writeUInt8(0, entryOffset + 3)
    header.writeUInt16LE(1, entryOffset + 4)
    header.writeUInt16LE(32, entryOffset + 6)
    header.writeUInt32LE(image.bytes.length, entryOffset + 8)
    header.writeUInt32LE(offset, entryOffset + 12)

    offset += image.bytes.length
  })

  return Buffer.concat([header, ...images.map((image) => image.bytes)])
}

mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(outputPath, createIco())
console.log(`Generated ${path.relative(projectRoot, outputPath)}`)
