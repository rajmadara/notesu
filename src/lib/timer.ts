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
