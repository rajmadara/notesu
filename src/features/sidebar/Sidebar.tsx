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

export function Sidebar({ session }: { session: Session }) {
  const meta = session.user.user_metadata as { full_name?: string; avatar_url?: string }
  const name = meta.full_name ?? session.user.email ?? 'Account'

  return (
    <aside className="sidebar">
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
  )
}
