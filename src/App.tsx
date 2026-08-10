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
      <div className={`app${session ? '' : ' app--centered'}`}>
        {session && (
          <header className="app__header">
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
            <h1>
              Notes<span className="app__logo-accent">u</span>
            </h1>
          </header>
        )}
        <main>
          {session === undefined ? null : session === null ? (
            <div className="welcome">
              <div className="welcome__card">
                <h1 className="welcome__title">
                  Welcome to Notes<span className="app__logo-accent">u</span>
                </h1>
                <p className="welcome__subtitle">Turn productivity into a passion</p>

                <div className="welcome__actions">
                  <button
                    type="button"
                    className="welcome__google"
                    onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
                  >
                    <span className="welcome__google-icon">
                      <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                      </svg>
                    </span>
                    Sign in with Google
                  </button>
                </div>
              </div>
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
