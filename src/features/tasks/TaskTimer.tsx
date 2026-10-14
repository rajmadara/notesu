import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Timer as TimerIcon, X } from 'lucide-react'
import type { Task } from '../../lib/types'
import { beep, clearCountdown, countdownOf, formatClock, formatSpent, saveCountdown } from '../../lib/timer'

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
  onStop: (task: Task, at?: number) => Promise<void>
  onReset: (task: Task) => Promise<void>
  /** The whole panel. The Pomodoro button and the timer card are drawn by
   *  PomodoroButton and TimerCard wherever the panel places them. */
  children: ReactNode
}

interface TimerView {
  open: boolean
  setOpen: (open: boolean) => void
  state: 'idle' | 'running' | 'done'
  running: boolean
  digits: string
  buttonRef: RefObject<HTMLButtonElement | null>
  /** The expanded card, ready to place. */
  card: ReactNode
}

const TimerContext = createContext<TimerView | null>(null)

/**
 * A stopwatch or a countdown for one task.
 *
 * There's no timer on screen until it's asked for: the "Pomodoro" button (see
 * PomodoroButton, in the panel header) opens it as a card (see TimerCard) above
 * the notes, pushing them down, with the stopwatch / timer choice at the top.
 * Collapsing the card only hides it; a run carries on, and the button shows the
 * live clock meanwhile. Closing the *panel* doesn't stop a run either: it keeps
 * going on the server and shows on the task's row in the list. A countdown is
 * remembered (see lib/timer) so reopening the task finds it where it was.
 *
 * Both modes record against the task: a run is started and stopped on the
 * server, which adds it to the task's saved total, so time spent counts
 * whichever way it was tracked. The stopwatch's display *is* that total; the
 * countdown is its own session and shows the total underneath.
 */
export function TaskTimerProvider({ task, onStart, onStop, onReset, children }: Props) {
  // A run already going when the panel opens (it was left running, or the tab
  // was closed mid-run). It was a countdown if one was remembered for it,
  // otherwise a stopwatch.
  const leftover = task.running_since !== null && task.running_since !== undefined
  const [restored] = useState(() => (leftover ? countdownOf(task) : null))

  const [preferred, setPreferred] = useState<Mode>(() => (read(MODE_KEY) === 'timer' ? 'timer' : 'stopwatch'))
  const [minutes, setMinutes] = useState(() => {
    if (restored) return restored.minutes
    const saved = Number(read(MINUTES_KEY))
    return saved >= 1 && saved <= 600 ? saved : 25
  })
  const [custom, setCustom] = useState('')
  // Whether the card is showing. Closed by default; a run doesn't depend on it.
  const [open, setOpen] = useState(false)

  const [running, setRunning] = useState(leftover)
  const [runMode, setRunMode] = useState<Mode>(restored ? 'timer' : 'stopwatch')
  // Client clock at the start of the current run, and the task's total (ms) at
  // that moment — the display is base + elapsed, so it never waits on a request.
  const [runStart, setRunStart] = useState<number | null>(leftover ? Number(task.running_since) : null)
  const [baseMs, setBaseMs] = useState(Number(task.seconds) * 1000)
  const [now, setNow] = useState(() => Date.now())
  // Holds the display steady between pausing and the saved total coming back.
  const [frozenMs, setFrozenMs] = useState<number | null>(null)
  const [elapsedBefore, setElapsedBefore] = useState(restored?.before ?? 0) // countdown progress before this run

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
    // It really ended when what was left at the start ran out. With the panel
    // closed that can be a while ago: stop the run there so the idle time after
    // it isn't counted, and don't beep about something long past.
    const left = total - elapsedBefore
    const endedAt = (runStart ?? Date.now()) + left
    setElapsedBefore(total)
    setFrozenMs(baseMs + Math.min(runElapsed, left))
    setRunning(false)
    clearCountdown(task.id)
    if (Date.now() - endedAt < 2000) beep()
    void onStop(task, endedAt)
  }, [running, runMode, remaining, total, elapsedBefore, runStart, baseMs, runElapsed, task, onStop])

  // Remember a running countdown (once the server has given the run its start
  // time), so it survives the panel closing and can be shown on the list.
  useEffect(() => {
    if (running && runMode === 'timer' && task.running_since !== null && task.running_since !== undefined) {
      saveCountdown(task.id, { runningSince: Number(task.running_since), minutes, before: elapsedBefore })
    }
  }, [running, runMode, task.id, task.running_since, minutes, elapsedBefore])

  // Nothing is running, so nothing should be remembered as running.
  useEffect(() => {
    if (!leftover) clearCountdown(task.id)
  }, [leftover, task.id])

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
    if (preferred !== 'timer') clearCountdown(task.id)
    await onStart(task)
  }

  async function pause() {
    if (runMode === 'timer') setElapsedBefore(cdElapsed)
    setFrozenMs(taskMs)
    setRunning(false)
    clearCountdown(task.id)
    await onStop(task)
  }

  async function reset() {
    if (mode === 'timer') {
      if (running) {
        setFrozenMs(taskMs)
        setRunning(false)
        clearCountdown(task.id)
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

  // The countdown's length: a progress bar and the presets. Only in Timer mode.
  const countdownSetup = mode === 'timer' && (
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
  )

  // The expanded card. Drawn by <TimerCard />, wherever the panel puts it.
  const card = (
      <section className="timer" data-state={state} aria-label="Pomodoro timer">
        <div className="timer__head">
          <span className="timer__name">Pomodoro</span>
          {modeSwitch}
          <button
            ref={collapseBtn}
            type="button"
            className="timer__close"
            onClick={() => setOpen(false)}
            aria-label="Close the timer"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="timer__main">
          <div className="timer__reading">
            <div className="timer__digits">{digits}</div>
            <div className="timer__status">
              <span className="timer__dot" />
              {status}
              {mode === 'timer' && <span className="timer__spent"> · {formatSpent(taskMs)} on this task</span>}
            </div>
          </div>
          <div className="timer__controls">
            <button type="button" className="timer__btn timer__btn--primary" onClick={running ? pause : start}>
              {toggleLabel}
            </button>
            <button type="button" className="timer__btn" onClick={reset}>
              Reset
            </button>
          </div>
        </div>

        {countdownSetup}
      </section>
  )

  const view: TimerView = { open, setOpen, state, running, digits, buttonRef, card }

  return <TimerContext.Provider value={view}>{children}</TimerContext.Provider>
}

/** The timer card, when it's open. Place it where the panel wants it; the
 *  content below it moves down. */
export function TimerCard() {
  const timer = useContext(TimerContext)
  return timer?.open ? timer.card : null
}

/**
 * The button that opens (and closes) the timer. While a run is going and the
 * card is closed it shows the live clock (and "Time's up" when a countdown has
 * ended), so a running timer is never invisible.
 */
export function PomodoroButton() {
  const timer = useContext(TimerContext)
  if (!timer) return null
  const { open, setOpen, state, running, digits, buttonRef } = timer
  const showClock = !open && running
  const text = showClock ? digits : !open && state === 'done' ? "Time's up" : 'Pomodoro'
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`timer-trigger${open ? ' is-open' : ''}`}
      data-state={open ? 'idle' : state}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      aria-label={text === 'Pomodoro' ? 'Pomodoro timer' : text}
      title="Stopwatch or timer for this task"
    >
      {showClock ? <span className="timer-trigger__pulse" /> : <TimerIcon size={14} />}
      {/* The plain name gives way to the icon on a narrow screen; a live clock
          or "Time's up" is information, so it stays. */}
      <span className={text === 'Pomodoro' ? 'timer-trigger__label' : undefined}>{text}</span>
    </button>
  )
}
