import { useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Theme } from '../../lib/theme'

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
  theme: Theme
  onChangeTheme: (theme: Theme) => void
}

export function Sidebar({ session, onClose, theme, onChangeTheme }: Props) {
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

        <div className="sidebar__footer">
          <div className="theme-toggle" role="group" aria-label="Theme">
            <button
              type="button"
              className={`theme-toggle__option${theme === 'light' ? ' is-active' : ''}`}
              onClick={() => onChangeTheme('light')}
              aria-pressed={theme === 'light'}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.5v2.4M12 19.1v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
              </svg>
              Light
            </button>
            <button
              type="button"
              className={`theme-toggle__option${theme === 'dark' ? ' is-active' : ''}`}
              onClick={() => onChangeTheme('dark')}
              aria-pressed={theme === 'dark'}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
                <path d="M20.4 14.7A8.4 8.4 0 0 1 9.3 3.6a8.9 8.9 0 1 0 11.1 11.1z" />
              </svg>
              Dark
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
