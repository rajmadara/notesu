import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

interface Props {
  onSearch: (query: string) => void
}

/**
 * Always a full box on desktop. On a phone the bar has no room for it next
 * to the page title, so it collapses to an icon and expands over the bar on
 * tap — the CSS decides which, this just tracks open/closed.
 */
export function SearchBox({ onSearch }: Props) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clear() {
    setValue('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    onSearch('')
  }

  function close() {
    clear()
    setOpen(false)
  }

  function handleChange(next: string) {
    setValue(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onSearch(next.trim()), 300)
  }

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className={`app__search-wrap${open ? ' is-open' : ''}`}>
      <button type="button" className="app__search-toggle" onClick={() => setOpen(true)} aria-label="Search">
        <Search size={18} />
      </button>
      <div className="app__search">
        <Search size={16} className="app__search-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          className="app__search-input"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') (open ? close : clear)()
          }}
          placeholder="Search titles and notes..."
          aria-label="Search tasks and notes"
        />
        {/* Desktop: clears the query once there's one. Mobile (open): also
            collapses the box back to its icon. */}
        {(value || open) && (
          <button type="button" className="app__search-close" onClick={open ? close : clear} aria-label={open ? 'Close search' : 'Clear search'}>
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
