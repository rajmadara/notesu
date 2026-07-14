import { useEffect, useState } from 'react'
import type { Task } from '../../lib/types'

export function useTaskTimer(task: Task): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (task.running_since === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [task.running_since])

  if (task.running_since === null) {
    return task.seconds
  }
  const liveElapsed = Math.floor((now - task.running_since) / 1000)
  return task.seconds + Math.max(0, liveElapsed)
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
