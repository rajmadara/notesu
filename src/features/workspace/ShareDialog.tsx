import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ItemShare, SharePermission } from '../../lib/types'
import { getItemShares, shareItem, unshareItem } from '../../lib/workspace'

interface Props {
  itemId: number
  itemName: string
  onClose: () => void
  onChanged: () => void
}

export function ShareDialog({ itemId, itemName, onClose, onChanged }: Props) {
  const [shares, setShares] = useState<ItemShare[]>([])
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<SharePermission>('view')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setShares(await getItemShares(itemId).catch(() => []))
  }

  useEffect(() => {
    load()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await shareItem(itemId, trimmed, permission)
      setEmail('')
      await load()
      onChanged()
    } catch (err) {
      setError(err instanceof Error && /400/.test(err.message) ? 'Enter a valid email address.' : 'Could not share. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function changePermission(share: ItemShare, next: SharePermission) {
    await shareItem(itemId, share.email, next).catch(() => null)
    await load()
  }

  async function remove(share: ItemShare) {
    await unshareItem(share.id).catch(() => null)
    await load()
    onChanged()
  }

  return (
    <div className="dialog__backdrop" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={`Share ${itemName}`} onMouseDown={(e) => e.stopPropagation()}>
        <header className="dialog__head">
          <h2 className="dialog__title">Share “{itemName}”</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <p className="dialog__hint">
          They'll find it under <strong>Shared with me</strong> when they sign in with this email. It stays yours — nothing is copied.
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
          <select className="input input--select" value={permission} onChange={(e) => setPermission(e.target.value as SharePermission)} aria-label="Permission">
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
                <button type="button" className="icon-btn" onClick={() => remove(share)} aria-label={`Stop sharing with ${share.email}`} title="Remove">
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
