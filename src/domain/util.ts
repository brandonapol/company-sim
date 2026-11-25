export const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 10)

export type Rng = () => number

export const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)]

export const sampleWeighted = <T>(items: readonly T[], weight: (item: T) => number, count: number, rng: Rng): T[] => {
  const go = (pool: readonly T[], left: number, acc: T[]): T[] => {
    if (left <= 0 || pool.length === 0) return acc
    const weights = pool.map((item) => Math.max(weight(item), 0.0001))
    const total = weights.reduce((sum, w) => sum + w, 0)
    const target = rng() * total
    const index = weights.reduce(
      (found, w, i) =>
        found.done ? found : found.sum + w >= target ? { sum: 0, done: true, at: i } : { ...found, sum: found.sum + w },
      { sum: 0, done: false, at: pool.length - 1 },
    ).at
    return go(
      pool.filter((_, i) => i !== index),
      left - 1,
      [...acc, pool[index]],
    )
  }
  return go(items, count, [])
}

export const money = (value: number) => {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`
  return `${sign}$${Math.round(abs)}`
}

export const dayKey = (ts: number) => {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const extractJson = <T>(text: string): T | null => {
  const starts = [text.indexOf('{'), text.indexOf('[')].filter((i) => i >= 0)
  if (starts.length === 0) return null
  const start = Math.min(...starts)
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
  if (end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

export const firstName = (name: string) => name.split(' ')[0] ?? name

export const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match)
