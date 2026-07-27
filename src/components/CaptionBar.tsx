interface CaptionBarProps {
  text: string
  liveLabel: string | null
  confidence: number
  onClear: () => void
  onBackspace: () => void
  onSpeak: () => void
}

/**
 * Anchored caption overlay: shows the accumulated recognized sentence plus
 * a small "live" chip for whatever sign is currently being held in front
 * of the camera, updating in real time as new signs are recognized.
 */
export default function CaptionBar({
  text,
  liveLabel,
  confidence,
  onClear,
  onBackspace,
  onSpeak
}: CaptionBarProps) {
  return (
    <div className="caption-bar">
      {liveLabel && (
        <div className="live-chip">
          <span>{liveLabel}</span>
          <span className="confidence">{Math.round(confidence * 100)}%</span>
        </div>
      )}
      <div className="caption-text" aria-live="polite">
        {text || 'Sign to the camera — recognized letters and words appear here'}
      </div>
      <div className="caption-actions">
        <button className="icon-btn" onClick={onBackspace} aria-label="Backspace">
          ⌫
        </button>
        <button className="icon-btn" onClick={onSpeak} aria-label="Speak caption aloud">
          🔊
        </button>
        <button className="icon-btn" onClick={onClear} aria-label="Clear caption">
          ✕
        </button>
      </div>
    </div>
  )
}
