import { useRef, useState } from 'react'
import type { Point } from '../lib/landmarkFeatures'
import type { TrainableSignClassifier } from '../lib/knnSignClassifier'
import type { GestureFrame, TrainableGestureClassifier } from '../lib/gestureClassifier'

const STATIC_SUGGESTED_LABELS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
  'T', 'U', 'V', 'W', 'X', 'Y'
]

const GESTURE_SUGGESTED_LABELS = [
  'HELLO', 'THANK YOU', 'PLEASE', 'YES', 'NO', 'SORRY', 'GOOD', 'BAD', 'MORE', 'HELP', 'J', 'Z'
]

const GESTURE_SAMPLE_INTERVAL_MS = 60
const GESTURE_MIN_FRAMES = 5

type CaptureType = 'static' | 'gesture'

interface TrainingPanelProps {
  getLandmarks: () => Point[] | null
  trainable: TrainableSignClassifier
  gestureTrainable: TrainableGestureClassifier
}

/**
 * Lets the user teach the app new signs on the spot. Two capture types,
 * matching the two recognizers: a "static pose" burst-capture for signs
 * with one held handshape (feeds knnSignClassifier.ts), and a "motion"
 * record-a-clip capture for signs defined by movement -- most everyday
 * words and phrases -- which feeds gestureClassifier.ts instead.
 */
export default function TrainingPanel({ getLandmarks, trainable, gestureTrainable }: TrainingPanelProps) {
  const [captureType, setCaptureType] = useState<CaptureType>('gesture')
  const [label, setLabel] = useState('HELLO')
  const [customLabel, setCustomLabel] = useState('')
  const [staticCounts, setStaticCounts] = useState<Record<string, number>>(trainable.getCounts())
  const [gestureCounts, setGestureCounts] = useState<Record<string, number>>(gestureTrainable.getCounts())
  const [feedback, setFeedback] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [recordingFrames, setRecordingFrames] = useState(0)

  const gestureBufferRef = useRef<GestureFrame[]>([])
  const recordIntervalRef = useRef<number | null>(null)

  const suggestions = captureType === 'static' ? STATIC_SUGGESTED_LABELS : GESTURE_SUGGESTED_LABELS
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
        setStaticCounts(trainable.getCounts())
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

  function startRecording() {
    if (recordIntervalRef.current !== null) return
    gestureBufferRef.current = []
    setRecordingFrames(0)
    setFeedback('')
    recordIntervalRef.current = window.setInterval(() => {
      const lm = getLandmarks()
      if (lm) {
        gestureBufferRef.current.push(lm)
        setRecordingFrames(gestureBufferRef.current.length)
      }
    }, GESTURE_SAMPLE_INTERVAL_MS)
  }

  function stopRecording() {
    if (recordIntervalRef.current !== null) {
      window.clearInterval(recordIntervalRef.current)
      recordIntervalRef.current = null
    }
    const frames = gestureBufferRef.current
    gestureBufferRef.current = []
    if (frames.length >= GESTURE_MIN_FRAMES) {
      gestureTrainable.addExample(frames, activeLabel)
      setGestureCounts(gestureTrainable.getCounts())
      setFeedback(`Captured a ${frames.length}-frame recording for "${activeLabel}"`)
    } else {
      setFeedback('Too short — hold your hand up, perform the whole sign, then stop')
    }
    setRecordingFrames(0)
  }

  const isRecording = recordIntervalRef.current !== null

  return (
    <div className="training-panel">
      <div className="mode-row">
        <button
          className={captureType === 'static' ? 'chip chip-active' : 'chip'}
          onClick={() => setCaptureType('static')}
          disabled={isRecording || capturing}
        >
          Static Pose
        </button>
        <button
          className={captureType === 'gesture' ? 'chip chip-active' : 'chip'}
          onClick={() => setCaptureType('gesture')}
          disabled={isRecording || capturing}
        >
          Motion / Word
        </button>
      </div>

      {captureType === 'static' ? (
        <p className="training-hint">
          Hold a sign steady in frame, pick or type a label, then capture 8-10 samples from
          slightly different angles/distances to teach the app that sign.
        </p>
      ) : (
        <p className="training-hint">
          For signs with real movement (most words/phrases): pick or type a label, press Start,
          perform the whole sign at a natural pace, then press Stop. Repeat 2-3 times per label
          for better accuracy.
        </p>
      )}

      <div className="training-row">
        <select value={label} onChange={e => setLabel(e.target.value)} disabled={isRecording}>
          {suggestions.map(l => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <input
          placeholder="or type a custom label"
          value={customLabel}
          onChange={e => setCustomLabel(e.target.value)}
          disabled={isRecording}
        />
      </div>

      {captureType === 'static' ? (
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
              setStaticCounts(trainable.getCounts())
              setFeedback('Cleared all static-pose signs')
            }}
          >
            Reset All
          </button>
        </div>
      ) : (
        <div className="training-row">
          {!isRecording ? (
            <button className="btn btn-primary" onClick={startRecording}>
              Start Recording
            </button>
          ) : (
            <button className="btn btn-danger" onClick={stopRecording}>
              Stop &amp; Save ({recordingFrames} frames)
            </button>
          )}
          <button
            className="btn btn-danger"
            disabled={isRecording}
            onClick={() => {
              gestureTrainable.clearAll()
              setGestureCounts(gestureTrainable.getCounts())
              setFeedback('Cleared all motion/word signs')
            }}
          >
            Reset All
          </button>
        </div>
      )}

      {feedback && <p className="training-feedback">{feedback}</p>}

      <div className="training-counts">
        {Object.entries(captureType === 'static' ? staticCounts : gestureCounts).map(([l, n]) => (
          <span key={l} className="count-chip">
            {l}: {n}
          </span>
        ))}
      </div>
    </div>
  )
}
