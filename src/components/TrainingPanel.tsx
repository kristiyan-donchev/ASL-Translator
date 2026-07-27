import { useState } from 'react'
import type { Point } from '../lib/landmarkFeatures'
import type { TrainableSignClassifier } from '../lib/knnSignClassifier'

const SUGGESTED_LABELS = [
  'HELLO', 'THANK YOU', 'PLEASE', 'YES', 'NO', 'SORRY', 'GOOD', 'BAD', 'MORE', 'HELP',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
  'T', 'U', 'V', 'W', 'X', 'Y'
]

interface TrainingPanelProps {
  getLandmarks: () => Point[] | null
  trainable: TrainableSignClassifier
}

/**
 * Lets the user teach the app new signs on the spot: pick or type a label,
 * hold the sign in frame, and capture a handful of landmark samples. Those
 * samples train the on-device KNN classifier (knnSignClassifier.ts) so it
 * can later recognize that exact sign for this user/camera setup -- a
 * genuine (if lightweight) supervised training loop, not a canned demo.
 */
export default function TrainingPanel({ getLandmarks, trainable }: TrainingPanelProps) {
  const [label, setLabel] = useState('HELLO')
  const [customLabel, setCustomLabel] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>(trainable.getCounts())
  const [feedback, setFeedback] = useState('')
  const [capturing, setCapturing] = useState(false)

  const activeLabel = (customLabel.trim() || label).toUpperCase()

  function captureBurst(n: number) {
    if (capturing) return
    setCapturing(true)
    let successes = 0
    let attempts = 0
    const maxAttempts = n * 3
    const interval = window.setInterval(() => {
      attempts += 1
      const lm = getLandmarks()
      if (lm) {
        trainable.addExample(lm, activeLabel)
        successes += 1
        setCounts(trainable.getCounts())
      }
      if (successes >= n || attempts >= maxAttempts) {
        window.clearInterval(interval)
        setCapturing(false)
        setFeedback(
          successes > 0
            ? `Captured ${successes} sample(s) for "${activeLabel}"`
            : 'No hand detected — hold your sign steady in view and try again'
        )
      }
    }, 150)
  }

  return (
    <div className="training-panel">
      <p className="training-hint">
        Hold a sign steady in frame, pick or type a label, then capture 8-10 samples from
        slightly different angles/distances to teach the app that sign.
      </p>
      <div className="training-row">
        <select value={label} onChange={e => setLabel(e.target.value)}>
          {SUGGESTED_LABELS.map(l => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <input
          placeholder="or type a custom label"
          value={customLabel}
          onChange={e => setCustomLabel(e.target.value)}
        />
      </div>
      <div className="training-row">
        <button className="btn" disabled={capturing} onClick={() => captureBurst(1)}>
          Capture 1
        </button>
        <button className="btn btn-primary" disabled={capturing} onClick={() => captureBurst(8)}>
          {capturing ? 'Capturing…' : 'Capture Burst (8)'}
        </button>
        <button
          className="btn btn-danger"
          onClick={() => {
            trainable.clearAll()
            setCounts(trainable.getCounts())
            setFeedback('Cleared all trained signs')
          }}
        >
          Reset All
        </button>
      </div>
      {feedback && <p className="training-feedback">{feedback}</p>}
      <div className="training-counts">
        {Object.entries(counts).map(([l, n]) => (
          <span key={l} className="count-chip">
            {l}: {n}
          </span>
        ))}
      </div>
    </div>
  )
}
