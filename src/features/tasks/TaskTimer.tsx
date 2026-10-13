import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Timer as TimerIcon, X } from 'lucide-react'
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
  /** The panel content that sits below the timer; the timer's card is drawn
   *  above it, so opening the timer pushes this down. */
  children: ReactNode
}

interface TimerView {
  open: boolean
  setOpen: (open: boolean) => void
  state: 'idle' | 'running' | 'done'
  running: boolean
  digits: string
  buttonRef: RefObject<HTMLButtonElement | null>
}

const TimerContext = createContext<TimerView | null>(null)

/**
 * A stopwatch or a countdown for one task.
 *
 * There's no timer on screen until it's asked for: the "Pomodoro" button (see
 * PomodoroButton, which lives in the notes toolbar) opens it as a card above
 * the notes, pushing them down, with the stopwatch / timer choice at the top.
 * Collapsing the card only hides it; a run carries on, and the button shows the
 * live clock meanwhile. Closing the *panel* pauses a run started here.
 *
 * Both modes record against the task: a run is started and stopped on the
 * server, which adds it to the task's saved total, so time spent counts
 * whichever way it was tracked. The stopwatch's display *is* that total; the
 * countdown is its own session and shows the total underneath.
 */
export function TaskTimerProvider({ task, onStart, onStop, onReset, children }: Props) {
  // A run already going when the panel opens (the tab was closed mid-run) can
  // only have been a stopwatch — the countdown's progress isn't saved.
  const leftover = task.running_since !== null && task.running_since !== undefined

  const [preferred, setPreferred] = useState<Mode>(() => (read(MODE_KEY) === 'timer' ? 'timer' : 'stopwatch'))
  const [minutes, setMinutes] = useState(() => {
    const saved = Number(read(MINUTES_KEY))
    return saved >= 1 && saved <= 600 ? saved : 25
  })
  const [custom, setCustom] = useState('')
  // Whether the card is showing. Closed by default; a run doesn't depend on it.
  const [open, setOpen] = useState(false)

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

  // Opening moves focus into the card, collapsing hands it back to the button,
  // so keyboard users aren't dropped at the top of the page.
  const buttonRef = useRef<HTMLButtonElement>(null)
  const collapseBtn = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current === open) return
    wasOpen.current = open
    ;(open ? collapseBtn : buttonRef).current?.focus()
  }, [open])

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

  const modeSwitch = (
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
  )

  // Everything below the mode choice: the clock, its status, presets, controls.
  const face = (
    <>
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
    </>
  )

  const view: TimerView = { open, setOpen, state, running, digits, buttonRef }

  return (
    <TimerContext.Provider value={view}>
      {open && (
        <section className="timer" data-state={state} aria-label="Pomodoro timer">
          <div className="timer__head">
            <span className="timer__name">Pomodoro</span>
            <button
              ref={collapseBtn}
              type="button"
              className="timer__close"
              onClick={() => setOpen(false)}
              aria-label="Close the timer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
          {modeSwitch}
          {face}
        </section>
      )}
      {children}
    </TimerContext.Provider>
  )
}

/**
 * The toolbar button that opens the timer. While a run is going and the card is
 * closed it shows the live clock (and "Time's up" when a countdown has ended),
 * so a running timer is never invisible.
 */
export function PomodoroButton() {
  const timer = useContext(TimerContext)
  if (!timer) return null
  const { open, setOpen, state, running, digits, buttonRef } = timer
  const showClock = !open && running
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`notes-editor__tool notes-editor__tool--pomodoro${open ? ' is-active' : ''}`}
      data-state={open ? 'idle' : state}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      title="Stopwatch or timer for this task"
    >
      {showClock ? <span className="notes-editor__pulse" /> : <TimerIcon size={13} />}
      {showClock ? digits : !open && state === 'done' ? "Time's up" : 'Pomodoro'}
    </button>
  )
}
