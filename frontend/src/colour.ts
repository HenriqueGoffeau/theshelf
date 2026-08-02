import { coverProxy } from './api.ts'

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
}

export function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, '')
  const full = hex.length === 3 ? hex.replace(/./g, (char) => char + char) : hex
  return /^[0-9a-f]{6}$/i.test(full) ? `#${full.toLowerCase()}` : null
}

export async function sampleCoverColour(url: string): Promise<string | null> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = coverProxy(url)

  try {
    await image.decode()
  } catch {
    return null
  }

  const width = 40
  const height = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * width)) || 60
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image, 0, 0, width, height)

  let pixels: Uint8ClampedArray
  try {
    pixels = ctx.getImageData(0, 0, width, height).data
  } catch {
    return null
  }

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>()

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] as number
    const g = pixels[i + 1] as number
    const b = pixels[i + 2] as number
    if ((pixels[i + 3] as number) < 200) continue

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const lightness = (max + min) / 2
    if (lightness > 232 || lightness < 26) continue

    const key = `${r >> 4}|${g >> 4}|${b >> 4}`
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    bucket.count += 1 + (max - min) / 64
    bucket.r += r
    bucket.g += g
    bucket.b += b
    buckets.set(key, bucket)
  }

  let best: { count: number; r: number; g: number; b: number } | null = null
  let bestPixels = 0
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) {
      best = bucket
      bestPixels = bucket.count
    }
  }
  if (!best || bestPixels === 0) return null

  const divisor = Math.max(1, Math.round(best.count))
  let r = best.r / divisor
  let g = best.g / divisor
  let b = best.b / divisor

  const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2
  if (lightness > 150) {
    const scale = 150 / lightness
    r *= scale
    g *= scale
    b *= scale
  }

  return toHex(r, g, b)
}
