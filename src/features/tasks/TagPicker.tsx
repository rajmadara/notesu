import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { getAllTags } from '../../lib/db'

/** Tags travel as one comma-separated string on the task. */
function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

interface Props {
  value: string
  readOnly?: boolean
  onChange: (tags: string[]) => void
}

/**
 * Pick a tag already in use, or type a new one. The suggestions are simply
 * every tag the user has used before, so a tag invented here is offered
 * everywhere else next time — there is no separate list to curate.
 */
export function TagPicker({ value, readOnly = false, onChange }: Props) {
  const tags = parseTags(value)
  const [draft, setDraft] = useState('')
  const [known, setKnown] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getAllTags()
      .then(setKnown)
      .catch(() => setKnown([]))
  }, [])

  // Reset the draft when the panel switches to a different task.
  useEffect(() => setDraft(''), [value])

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const has = (tag: string) => tags.some((t) => t.toLowerCase() === tag.toLowerCase())
  const query = draft.trim().toLowerCase()
  const suggestions = known
    .filter((tag) => !has(tag) && (!query || tag.toLowerCase().includes(query)))
    .slice(0, 8)
  // Only offer "create" when it isn't already one of the suggestions.
  const canCreate = query.length > 0 && !known.some((t) => t.toLowerCase() === query)

  function add(tag: string) {
    const trimmed = tag.trim()
    setDraft('')
    setOpen(false)
    if (!trimmed || has(trimmed)) return
    if (!known.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setKnown([...known, trimmed].sort())
    }
    onChange([...tags, trimmed])
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div className="tag-picker" ref={wrap}>
      {tags.length > 0 && (
        <ul className="tag-picker__tags">
          {tags.map((tag) => (
            <li key={tag} className="tag-chip">
              {tag}
              {!readOnly && (
                <button
                  type="button"
                  className="tag-chip__remove"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                >
                  <X size={11} strokeWidth={2.5} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="tag-picker__field">
          <input
            className="tag-picker__input"
            placeholder={tags.length ? 'Add another tag...' : 'Select or type a tag...'}
            value={draft}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setDraft(e.target.value)
              setOpen(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add(draft)
              } else if (e.key === 'Escape') {
                setOpen(false)
              } else if (e.key === 'Backspace' && !draft && tags.length) {
                removeTag(tags[tags.length - 1])
              }
            }}
            aria-label="Add a tag"
          />

          {open && (suggestions.length > 0 || canCreate) && (
            <ul className="tag-picker__menu">
              {suggestions.map((tag) => (
                <li key={tag}>
                  <button type="button" className="tag-picker__option" onClick={() => add(tag)}>
                    {tag}
                  </button>
                </li>
              ))}
              {canCreate && (
                <li>
                  <button
                    type="button"
                    className="tag-picker__option tag-picker__option--new"
                    onClick={() => add(draft)}
                  >
                    Create "{draft.trim()}"
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
