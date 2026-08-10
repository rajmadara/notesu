import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { DailyTasks } from './features/dailyTasks/DailyTasks'
import { Sidebar } from './features/sidebar/Sidebar'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  return (
    <div className="app-shell">
      {session && sidebarOpen && (
        <Sidebar session={session} onClose={() => setSidebarOpen(false)} />
      )}
      <div className="app">
        <header className="app__header">
          {session && (
            <button
              type="button"
              className="app__menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
          )}
          <h1>
            Notes<span className="app__logo-accent">u</span>
          </h1>
        </header>
        <main>
          {session === undefined ? null : session === null ? (
            <div className="app__sign-in">
              <p>Sign in to see your tasks.</p>
              <button
                className="app__google-btn"
                onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
              >
                Sign in with Google
              </button>
            </div>
          ) : (
            <DailyTasks />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
