import { useState } from 'react'
import ModeToggle from './components/ModeToggle'
import SignToTextPanel from './components/SignToTextPanel'
import TextToSignPanel from './components/TextToSignPanel'

type Mode = 'sign-to-text' | 'text-to-sign'

export default function App() {
  const [mode, setMode] = useState<Mode>('sign-to-text')

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>ASL Translator</h1>
        <ModeToggle mode={mode} onChange={setMode} />
      </header>

      <main className="app-main">
        {mode === 'sign-to-text' ? <SignToTextPanel /> : <TextToSignPanel />}
      </main>

      <footer className="app-footer">On-device only — video never leaves your phone.</footer>
    </div>
  )
}
