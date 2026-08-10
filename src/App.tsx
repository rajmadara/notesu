import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { DailyTasks } from './features/dailyTasks/DailyTasks'
import { Sidebar } from './features/sidebar/Sidebar'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  return (
    <div className="app-shell">
      {session && <Sidebar session={session} />}
      <div className="app">
        <header className="app__header">
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
