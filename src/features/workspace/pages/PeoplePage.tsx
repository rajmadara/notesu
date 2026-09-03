import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Page, Person } from '../../../lib/types'
import { createPerson, deletePerson, getPeople, updatePerson } from '../../../lib/workspace'

interface Props {
  page: Page
  readOnly: boolean
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export function PeoplePage({ page, readOnly }: Props) {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState({ name: '', role: '', contact: '' })

  const load = useCallback(async () => {
    setPeople(await getPeople(page.id).catch(() => []))
    setLoading(false)
  }, [page.id])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const name = draft.name.trim()
    if (!name) return
    await createPerson(page.id, { name, role: draft.role.trim(), contact: draft.contact.trim(), note: '' }).catch(
      () => null,
    )
    setDraft({ name: '', role: '', contact: '' })
    await load()
  }

  async function patch(person: Person, next: Partial<Person>) {
    if (next.name !== undefined && !next.name.trim()) return
    await updatePerson(person.id, next).catch(() => null)
    await load()
  }

  async function remove(person: Person) {
    await deletePerson(person.id).catch(() => null)
    await load()
  }

  if (loading) return <p className="empty-state">Loading...</p>

  const field = (person: Person, key: 'name' | 'role' | 'contact', placeholder: string) => (
    <input
      className={`person__${key}`}
      defaultValue={person[key]}
      placeholder={readOnly ? '' : placeholder}
      readOnly={readOnly}
      onBlur={(e) => e.target.value.trim() !== person[key] && patch(person, { [key]: e.target.value.trim() })}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      aria-label={placeholder}
    />
  )

  return (
    <div className="page-people">
      {!readOnly && (
        <form className="person person--add" onSubmit={add}>
          <span className="person__avatar person__avatar--add">
            <Plus size={14} />
          </span>
          <input
            className="person__name"
            placeholder="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <input
            className="person__role"
            placeholder="Role"
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          />
          <input
            className="person__contact"
            placeholder="Email or phone"
            value={draft.contact}
            onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
          />
          <button type="submit" className="btn btn--primary btn--sm" disabled={!draft.name.trim()}>
            Add
          </button>
        </form>
      )}

      {people.length === 0 ? (
        <p className="empty-state">{readOnly ? 'No one added yet.' : 'Add the people involved.'}</p>
      ) : (
        <ul className="people-list">
          {people.map((person) => (
            <li key={person.id} className="person">
              <span className="person__avatar">{initials(person.name)}</span>
              {field(person, 'name', 'Name')}
              {field(person, 'role', 'Role')}
              {field(person, 'contact', 'Email or phone')}
              {!readOnly && (
                <button
                  type="button"
                  className="person__delete"
                  onClick={() => remove(person)}
                  aria-label={`Remove ${person.name}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
