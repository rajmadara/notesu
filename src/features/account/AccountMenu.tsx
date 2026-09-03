import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

interface Props {
  session: Session
}

/**
 * The account lives in the top-right corner as just the display picture;
 * the name and sign-out sit behind it rather than taking up sidebar room.
 */
export function AccountMenu({ session }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const meta = session.user.user_metadata as { full_name?: string; avatar_url?: string }
  const name = meta.full_name ?? session.user.email ?? 'Account'

  return (
    <div className="account-menu" ref={ref}>
      <button
        type="button"
        className="account-menu__button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name}
        title={name}
      >
        {meta.avatar_url ? (
          <img className="account-menu__avatar" src={meta.avatar_url} alt="" />
        ) : (
          <span className="account-menu__avatar account-menu__avatar--fallback">
            {initials(name)}
          </span>
        )}
      </button>

      {open && (
        <div className="account-menu__popover" role="menu">
          <div className="account-menu__identity">
            <p className="account-menu__name">{name}</p>
            {session.user.email && <p className="account-menu__email">{session.user.email}</p>}
          </div>
          <button
            type="button"
            className="account-menu__item"
            role="menuitem"
            onClick={() => supabase.auth.signOut()}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
