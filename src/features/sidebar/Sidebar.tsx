import { useEffect } from 'react'
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
  onClose: () => void
}

export function Sidebar({ session, onClose }: Props) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const meta = session.user.user_metadata as { full_name?: string; avatar_url?: string }
  const name = meta.full_name ?? session.user.email ?? 'Account'

  return (
    <div className="sidebar__backdrop" onClick={onClose}>
      <aside className="sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="sidebar__account">
          {meta.avatar_url ? (
            <img className="sidebar__avatar" src={meta.avatar_url} alt="" />
          ) : (
            <span className="sidebar__avatar sidebar__avatar--fallback">{initials(name)}</span>
          )}
          <span className="sidebar__name">{name}</span>
        </div>

        {/* More pages (Today, Upcoming, etc.) land here as real features exist. */}
        <nav className="sidebar__nav">
          <button
            type="button"
            className="sidebar__nav-item"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </nav>
      </aside>
    </div>
  )
}
