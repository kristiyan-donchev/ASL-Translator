type Mode = 'sign-to-text' | 'text-to-sign'

interface ModeToggleProps {
  mode: Mode
  onChange: (mode: Mode) => void
}

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="mode-toggle" role="tablist" aria-label="Translation direction">
      <button
        role="tab"
        aria-selected={mode === 'sign-to-text'}
        className={mode === 'sign-to-text' ? 'toggle-btn active' : 'toggle-btn'}
        onClick={() => onChange('sign-to-text')}
      >
        Sign → Text
      </button>
      <button
        role="tab"
        aria-selected={mode === 'text-to-sign'}
        className={mode === 'text-to-sign' ? 'toggle-btn active' : 'toggle-btn'}
        onClick={() => onChange('text-to-sign')}
      >
        Text → Sign
      </button>
    </div>
  )
}
