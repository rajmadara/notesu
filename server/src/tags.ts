const MAX_TAGS = 10
const MAX_LENGTH = 40

/**
 * Tags are stored as one comma-separated string on the task. Normalising in
 * one place keeps the personal and item-scoped endpoints storing the same
 * shape — trimmed, de-duplicated case-insensitively, capped, no empties.
 */
export function normalizeTags(value: unknown): string {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string') continue
    const tag = entry.trim().replace(/\s+/g, ' ').slice(0, MAX_LENGTH)
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
    if (out.length === MAX_TAGS) break
  }
  return out.join(',')
}
