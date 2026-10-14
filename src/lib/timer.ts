import type { Task } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

/** 4325 -> '1:12:05', 125 -> '02:05'. Hours only appear once there are some. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}

/** Time spent in words: '1h 12m', '45m', '0m'. */
export function formatSpent(ms: number): string {
  const mins = Math.floor(Math.max(0, ms) / 60000)
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`
}

/** Three short beeps for when a countdown ends. Silent if audio is unavailable. */
export function beep(): void {
  try {
    const AudioCtx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    ;[0, 0.28, 0.56].forEach((offset) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      const t = ctx.currentTime + offset
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
      osc.start(t)
      osc.stop(t + 0.24)
    })
  } catch {
    // No audio is fine — the "Time's up" state is on screen regardless.
  }
}

/**
 * A countdown in flight. The server only knows a run started — not that it was
 * a countdown, or how long — so that's kept here. It's what lets a countdown
 * carry on with its panel closed, and show on the task list.
 */
export interface Countdown {
  /** The server's running_since for the run this belongs to. */
  runningSince: number
  minutes: number
  /** Countdown progress (ms) banked by earlier, paused runs. */
  before: number
}

const countdownKey = (taskId: number) => `notesu-countdown-${taskId}`

export function saveCountdown(taskId: number, countdown: Countdown): void {
  try {
    localStorage.setItem(countdownKey(taskId), JSON.stringify(countdown))
  } catch {
    // Private window or full storage: the countdown just won't survive a closed panel.
  }
}

export function clearCountdown(taskId: number): void {
  try {
    localStorage.removeItem(countdownKey(taskId))
  } catch {
    // Nothing to clear if storage isn't available.
  }
}

/** The countdown belonging to the run now on `task`. A record left by an older
 *  run has a different start time, so it doesn't match and is ignored. */
export function countdownOf(task: Task): Countdown | null {
  if (task.running_since === null || task.running_since === undefined) return null
  try {
    const raw = localStorage.getItem(countdownKey(task.id))
    if (!raw) return null
    const c = JSON.parse(raw) as Partial<Countdown>
    if (typeof c.runningSince !== 'number' || typeof c.minutes !== 'number' || typeof c.before !== 'number') {
      return null
    }
    return c.runningSince === Number(task.running_since) ? (c as Countdown) : null
  } catch {
    return null
  }
}

export interface RunClock {
  label: string
  /** A countdown that has reached zero. */
  done: boolean
}

/** What a running task's row shows: the countdown's time left, or — for a plain
 *  stopwatch run — the task's total so far. Null when nothing is running. */
export function runClock(task: Task, now: number): RunClock | null {
  if (task.running_since === null || task.running_since === undefined) return null
  const since = Number(task.running_since)
  const sinceStart = Math.max(0, now - since)
  const countdown = countdownOf(task)
  if (countdown) {
    const left = countdown.minutes * 60000 - countdown.before - sinceStart
    return left > 0 ? { label: formatClock(Math.ceil(left / 1000)), done: false } : { label: "Time's up", done: true }
  }
  return { label: formatClock((Number(task.seconds) * 1000 + sinceStart) / 1000), done: false }
}
