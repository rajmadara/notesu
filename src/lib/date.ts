export function formatTimestamp(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Today's date as 'YYYY-MM-DD' in the user's own timezone (not UTC). */
export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD' -> 'Jan 27' (adds the year when it isn't this year). */
export function formatShortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** 'YYYY-MM-DD' -> 'Tuesday, January 27' */
export function formatLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later'

/** How urgently a due date should read: overdue / today / within a week / later. */
export function dueTone(iso: string): DueTone {
  const today = todayISO()
  if (iso < today) return 'overdue'
  if (iso === today) return 'today'
  const diff = (new Date(`${iso}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000
  return diff <= 7 ? 'soon' : 'later'
}

export function dueLabel(iso: string): string {
  const tone = dueTone(iso)
  if (tone === 'today') return 'Today'
  const today = todayISO()
  const diff = Math.round(
    (new Date(`${iso}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000,
  )
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return formatShortDate(iso)
}

export function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
