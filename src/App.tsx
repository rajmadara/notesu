import { DailyTasks } from './features/dailyTasks/DailyTasks'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1>
          Note<span className="app__logo-accent">su</span>
        </h1>
      </header>
      <main>
        <DailyTasks />
      </main>
    </div>
  )
}

export default App
