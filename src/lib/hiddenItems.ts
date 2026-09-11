const KEY = 'notesu-hidden-items'

/**
 * Items the user has hidden from Home's Today list — a personal display
 * preference, not shared data, so it lives in this browser rather than the
 * database. Hiding an item never touches its tasks: they're still all there
 * on the item's own page, in search, and in Upcoming — only the default
 * browsing list leaves them out.
 */
export function getHiddenItems(): number[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

export function setHiddenItems(ids: number[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // A private window or full storage just means it won't persist — the
    // list still works for this session.
  }
}
