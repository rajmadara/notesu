import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { SharePermission } from '../../lib/types'
import {
  getItemShares,
  getSpaceShares,
  shareItem,
  shareSpace,
  unshareItem,
  unshareSpace,
} from '../../lib/workspace'

/** One row of the list, whichever kind of thing is being shared. */
interface Share {
  id: number
  email: string
  permission: SharePermission
}

interface Props {
  /** A space share cascades to every item inside it. */
  kind: 'space' | 'item'
  id: number
  name: string
  onClose: () => void
  onChanged: () => void
}

export function ShareDialog({ kind, id, name, onClose, onChanged }: Props) {
  const [shares, setShares] = useState<Share[]>([])
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<SharePermission>('view')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const rows = kind === 'space' ? await getSpaceShares(id) : await getItemShares(id)
    setShares(rows.map((r) => ({ id: r.id, email: r.email, permission: r.permission })))
  }, [kind, id])

  useEffect(() => {
    load().catch(() => setShares([]))
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [load, onClose])

  async function grant(to: string, level: SharePermission) {
    if (kind === 'space') await shareSpace(id, to, level)
    else await shareItem(id, to, level)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await grant(trimmed, permission)
      setEmail('')
      await load()
      onChanged()
    } catch (err) {
      setError(
        err instanceof Error && /400/.test(err.message)
          ? 'Enter a valid email address.'
          : 'Could not share. Try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function changePermission(share: Share, next: SharePermission) {
    await grant(share.email, next).catch(() => null)
    await load()
  }

  async function remove(share: Share) {
    const drop = kind === 'space' ? unshareSpace : unshareItem
    await drop(share.id).catch(() => null)
    await load()
    onChanged()
  }

  return (
    <div className="dialog__backdrop" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${name}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="dialog__head">
          <h2 className="dialog__title">Share “{name}”</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <p className="dialog__hint">
          They'll find it under <strong>Shared with me</strong> when they sign in with this email.
          {kind === 'space'
            ? ' Everything in this space comes with it.'
            : ' It stays yours — nothing is copied.'}{' '}
          <strong>Can view</strong> gets a read-only page of the details.
        </p>

        <form className="share-form" onSubmit={add}>
          <input
            type="email"
            className="input"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            aria-label="Email"
          />
          <select
            className="input input--select"
            value={permission}
            onChange={(e) => setPermission(e.target.value as SharePermission)}
            aria-label="Permission"
          >
            <option value="view">Can view</option>
            <option value="edit">Can edit</option>
          </select>
          <button type="submit" className="btn btn--primary" disabled={!email.trim() || busy}>
            Share
          </button>
        </form>
        {error && <p className="form-error">{error}</p>}

        {shares.length > 0 && (
          <ul className="share-list">
            {shares.map((share) => (
              <li key={share.id} className="share-row">
                <span className="share-row__email">{share.email}</span>
                <select
                  className="input input--select input--sm"
                  value={share.permission}
                  onChange={(e) => changePermission(share, e.target.value as SharePermission)}
                  aria-label={`Permission for ${share.email}`}
                >
                  <option value="view">Can view</option>
                  <option value="edit">Can edit</option>
                </select>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => remove(share)}
                  aria-label={`Stop sharing with ${share.email}`}
                  title="Remove"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
