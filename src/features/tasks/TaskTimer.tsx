import { useEffect, useRef, useState } from 'react'
import type { Task } from '../../lib/types'
import { beep, formatClock, formatSpent } from '../../lib/timer'

type Mode = 'stopwatch' | 'timer'

const MODE_KEY = 'notesu-timer-mode'
const MINUTES_KEY = 'notesu-timer-minutes'
const PRESETS = [5, 15, 25, 45]

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private window or full storage: the choice just isn't remembered.
  }
}

interface Props {
  task: Task
  onStart: (task: Task) => Promise<void>
  onStop: (task: Task) => Promise<void>
  onReset: (task: Task) => Promise<void>
}

/**
 * A stopwatch or a countdown for one task, at the top of its panel.
 *
 * Both record against the task: a run is started and stopped on the server,
 * which adds it to the task's saved total, so time spent counts whichever way
 * it was tracked. The stopwatch's display *is* that total; the countdown is
 * its own session and shows the total underneath.
 *
 * It's compact by default; "Pomodoro" enlarges it for a focus session, and the
 * notes below give up the room. Closing the panel pauses a run started here.
 */
export function TaskTimer({ task, onStart, onStop, onReset }: Props) {
  // A run already going when the panel opens (the tab was closed mid-run) can
  // only have been a stopwatch — the countdown's progress isn't saved.
  const leftover = task.running_since !== null && task.running_since !== undefined

  const [preferred, setPreferred] = useState<Mode>(() => (read(MODE_KEY) === 'timer' ? 'timer' : 'stopwatch'))
  const [minutes, setMinutes] = useState(() => {
    const saved = Number(read(MINUTES_KEY))
    return saved >= 1 && saved <= 600 ? saved : 25
  })
  const [custom, setCustom] = useState('')
  const [big, setBig] = useState(false)

  const [running, setRunning] = useState(leftover)
  const [runMode, setRunMode] = useState<Mode>('stopwatch')
  // Client clock at the start of the current run, and the task's total (ms) at
  // that moment — the display is base + elapsed, so it never waits on a request.
  const [runStart, setRunStart] = useState<number | null>(leftover ? Number(task.running_since) : null)
  const [baseMs, setBaseMs] = useState(Number(task.seconds) * 1000)
  const [now, setNow] = useState(() => Date.now())
  // Holds the display steady between pausing and the saved total coming back.
  const [frozenMs, setFrozenMs] = useState<number | null>(null)
  const [elapsedBefore, setElapsedBefore] = useState(0) // countdown progress before this run

  const mode = running ? runMode : preferred
  const total = minutes * 60000
  const runElapsed = running && runStart !== null ? Math.max(0, now - runStart) : 0
  const taskMs = running ? baseMs + runElapsed : (frozenMs ?? Number(task.seconds) * 1000)
  const cdElapsed = Math.min(total, elapsedBefore + (running && runMode === 'timer' ? runElapsed : 0))
  const remaining = total - cdElapsed
  const finished = mode === 'timer' && !running && cdElapsed >= total

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [running])

  // The saved total came back: stop holding the frozen value.
  useEffect(() => setFrozenMs(null), [task.seconds])

  // The countdown reaching zero ends the run. `remaining` changes every tick,
  // so this is checked each time; it only acts once the run is over.
  useEffect(() => {
    if (!running || runMode !== 'timer' || remaining > 0) return
    setElapsedBefore(total)
    setFrozenMs(taskMs)
    setRunning(false)
    beep()
    void onStop(task)
  }, [running, runMode, remaining, total, taskMs, task, onStop])

  // Closing the panel pauses a run that was started from it.
  const startedHere = useRef(false)
  const live = useRef({ running, task, onStop })
  live.current = { running, task, onStop }
  useEffect(
    () => () => {
      if (startedHere.current && live.current.running) void live.current.onStop(live.current.task)
    },
    [],
  )

  async function start() {
    const begin = Date.now()
    if (finished) setElapsedBefore(0)
    setBaseMs(taskMs)
    setRunStart(begin)
    setNow(begin)
    setRunMode(preferred)
    setFrozenMs(null)
    setRunning(true)
    startedHere.current = true
    await onStart(task)
  }

  async function pause() {
    if (runMode === 'timer') setElapsedBefore(cdElapsed)
    setFrozenMs(taskMs)
    setRunning(false)
    await onStop(task)
  }

  async function reset() {
    if (mode === 'timer') {
      if (running) {
        setFrozenMs(taskMs)
        setRunning(false)
        void onStop(task)
      }
      setElapsedBefore(0)
      return
    }
    // Resetting the stopwatch erases the task's saved total, so ask first.
    if (!confirm('Reset the time on this task to 0?')) return
    setRunning(false)
    setFrozenMs(0)
    await onReset(task)
  }

  function chooseMode(next: Mode) {
    setPreferred(next)
    write(MODE_KEY, next)
  }

  function chooseMinutes(next: number) {
    setMinutes(next)
    setElapsedBefore(0)
    write(MINUTES_KEY, String(next))
  }

  const digits =
    mode === 'timer' ? formatClock(Math.ceil(Math.max(0, remaining) / 1000)) : formatClock(Math.floor(taskMs / 1000))
  const progressed = mode === 'timer' ? cdElapsed > 0 : taskMs > 0
  const state = finished ? 'done' : running ? 'running' : 'idle'
  const status = finished ? "Time's up" : running ? 'Running' : progressed ? 'Paused' : 'Ready'
  const toggleLabel = finished ? 'Start again' : running ? 'Pause' : progressed ? 'Resume' : 'Start'

  return (
    <section className={`timer${big ? ' timer--big' : ''}`} data-state={state} aria-label="Timer">
      <div className="timer__top">
        <div className="timer__seg" role="group" aria-label="Timer type">
          {(['stopwatch', 'timer'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? 'is-on' : undefined}
              disabled={running}
              onClick={() => chooseMode(m)}
            >
              {m === 'stopwatch' ? 'Stopwatch' : 'Timer'}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`timer__pomodoro${big ? ' is-on' : ''}`}
          aria-pressed={big}
          onClick={() => setBig((v) => !v)}
          title={big ? 'Back to the compact timer' : 'Enlarge the timer for a focus session'}
        >
          Pomodoro
        </button>
      </div>

      <div className="timer__digits">{digits}</div>
      <div className="timer__status">
        <span className="timer__dot" />
        {status}
        {mode === 'timer' && <span className="timer__spent"> · {formatSpent(taskMs)} on this task</span>}
      </div>

      {mode === 'timer' && (
        <>
          <div className="timer__bar" role="presentation">
            <span style={{ width: `${(Math.max(0, remaining) / total) * 100}%` }} />
          </div>
          <div className="timer__presets">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                className={`timer__chip${minutes === m ? ' is-on' : ''}`}
                disabled={running}
                onClick={() => {
                  setCustom('')
                  chooseMinutes(m)
                }}
              >
                {m} min
              </button>
            ))}
            <label className="timer__custom">
              or
              <input
                type="number"
                min={1}
                max={600}
                placeholder="30"
                value={custom}
                disabled={running}
                onChange={(e) => {
                  setCustom(e.target.value)
                  const v = Number(e.target.value)
                  if (v >= 1 && v <= 600) chooseMinutes(Math.floor(v))
                }}
              />
              min
            </label>
          </div>
        </>
      )}

      <div className="timer__controls">
        <button type="button" className="timer__btn timer__btn--primary" onClick={running ? pause : start}>
          {toggleLabel}
        </button>
        <button type="button" className="timer__btn" onClick={reset}>
          Reset
        </button>
      </div>
    </section>
  )
}
