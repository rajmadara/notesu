import { useCallback, useEffect, useState } from 'react'
import { Info, Plus, Settings2, Trash2 } from 'lucide-react'
import type { Page, PageColumn, Person } from '../../../lib/types'
import {
  createPerson,
  deletePerson,
  getPeople,
  setPageColumns,
  updatePerson,
} from '../../../lib/workspace'
import { ColumnDialog } from '../ColumnDialog'

// The columns every People page starts with. Custom ones are appended after
// these; "About" is the long one, so it sits last of the built-ins.
const BUILT_INS = [
  { key: 'name', label: 'Name', placeholder: 'Name' },
  { key: 'role', label: 'Role', placeholder: 'Role' },
  { key: 'contact', label: 'Contact', placeholder: 'Email or phone' },
  { key: 'note', label: 'About', placeholder: 'Anything worth remembering' },
] as const

type BuiltInKey = (typeof BUILT_INS)[number]['key']

interface Props {
  page: Page
  readOnly: boolean
  /** Called after the column definitions change, so the page reloads. */
  onPageChanged: () => Promise<void>
}

/**
 * A People page is a small table: four built-in columns plus whatever the user
 * adds. The column definitions live on the page and the values live on each
 * row, keyed by column id — so a column can be renamed or retyped without
 * touching the rows.
 */
export function PeoplePage({ page, readOnly, onPageChanged }: Props) {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<PageColumn | null>(null)
  const [adding, setAdding] = useState(false)

  const columns = page.columns ?? []

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
    const trimmed = name.trim()
    if (!trimmed) return
    setName('')
    await createPerson(page.id, {
      name: trimmed,
      role: '',
      contact: '',
      note: '',
      fields: {},
    }).catch(() => null)
    await load()
  }

  async function patch(person: Person, next: Parameters<typeof updatePerson>[1]) {
    await updatePerson(person.id, next).catch(() => null)
    await load()
  }

  async function remove(person: Person) {
    await deletePerson(person.id).catch(() => null)
    await load()
  }

  async function saveColumns(next: PageColumn[]) {
    await setPageColumns(page.id, next).catch(() => null)
    await onPageChanged()
  }

  async function removeColumn(column: PageColumn) {
    if (!confirm(`Remove the "${column.name}" column? Its values are lost.`)) return
    await saveColumns(columns.filter((c) => c.id !== column.id))
  }

  if (loading) return <p className="empty-state">Loading...</p>

  const cell = (person: Person, column: PageColumn) => {
    const value = person.fields?.[column.id] ?? ''
    const save = (next: string) => next !== value && patch(person, { fields: { [column.id]: next } })

    if (column.type === 'select') {
      return (
        <select
          className="table__select"
          value={column.options.includes(value) ? value : ''}
          disabled={readOnly}
          onChange={(e) => save(e.target.value)}
          aria-label={column.name}
        >
          <option value="">-</option>
          {column.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )
    }
    return (
      <input
        className="table__input"
        type={column.type === 'number' ? 'number' : 'text'}
        defaultValue={value}
        readOnly={readOnly}
        onBlur={(e) => save(e.target.value.trim())}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        aria-label={column.name}
      />
    )
  }

  const builtIn = (person: Person, key: BuiltInKey, placeholder: string) => (
    <input
      className="table__input"
      defaultValue={person[key]}
      placeholder={readOnly ? '' : placeholder}
      readOnly={readOnly}
      onBlur={(e) => {
        const next = e.target.value.trim()
        if (next === person[key]) return
        // A row has to keep its name; put the old one back rather than saving.
        if (key === 'name' && !next) {
          e.target.value = person.name
          return
        }
        patch(person, { [key]: next })
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      aria-label={placeholder}
    />
  )

  return (
    <div className="page-table">
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              {BUILT_INS.map((column) => (
                <th key={column.key} className={`table__head table__head--${column.key}`}>
                  {column.label}
                </th>
              ))}
              {columns.map((column) => (
                <th key={column.id} className="table__head">
                  <span className="table__head-inner">
                    {column.name}
                    {column.description && (
                      <span className="table__hint" title={column.description}>
                        <Info size={12} />
                      </span>
                    )}
                    {!readOnly && (
                      <span className="table__head-actions">
                        <button
                          type="button"
                          className="icon-btn icon-btn--xs"
                          onClick={() => setEditing(column)}
                          aria-label={`Edit ${column.name} column`}
                        >
                          <Settings2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--xs"
                          onClick={() => removeColumn(column)}
                          aria-label={`Remove ${column.name} column`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    )}
                  </span>
                </th>
              ))}
              <th className="table__head table__head--add">
                {!readOnly && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setAdding(true)}
                    title="Add a column"
                    aria-label="Add a column"
                  >
                    <Plus size={15} />
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                {BUILT_INS.map((column) => (
                  <td key={column.key}>{builtIn(person, column.key, column.placeholder)}</td>
                ))}
                {columns.map((column) => (
                  <td key={column.id}>{cell(person, column)}</td>
                ))}
                <td className="table__row-actions">
                  {!readOnly && (
                    <button
                      type="button"
                      className="icon-btn icon-btn--xs"
                      onClick={() => remove(person)}
                      aria-label={`Remove ${person.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!readOnly && (
              <tr className="table__add-row">
                <td colSpan={BUILT_INS.length + columns.length + 1}>
                  <form className="table__add" onSubmit={add}>
                    <Plus size={14} className="table__add-icon" />
                    <input
                      className="table__add-input"
                      placeholder="Add a row..."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </form>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {people.length === 0 && readOnly && <p className="empty-state">No one added yet.</p>}

      {(adding || editing) && (
        <ColumnDialog
          column={editing}
          onCancel={() => {
            setAdding(false)
            setEditing(null)
          }}
          onSave={async (column) => {
            const next = editing
              ? columns.map((c) => (c.id === column.id ? column : c))
              : [...columns, column]
            setAdding(false)
            setEditing(null)
            await saveColumns(next)
          }}
        />
      )}
    </div>
  )
}
