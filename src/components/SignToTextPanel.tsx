import { useCallback, useMemo, useRef, useState } from 'react'
import CameraView from './CameraView'
import CaptionBar from './CaptionBar'
import TrainingPanel from './TrainingPanel'
import { classifyStaticSign } from '../lib/aslAlphabetClassifier'
import { TrainableSignClassifier } from '../lib/knnSignClassifier'
import type { Point } from '../lib/landmarkFeatures'

type ClassifierMode = 'rules' | 'trained'

const STABLE_FRAMES = 10
const COMMIT_COOLDOWN_MS = 700
const MIN_CONFIDENCE = 0.4

function appendToken(prev: string, token: string): string {
  const t = token.toUpperCase()
  // Multi-character tokens are word-level signs (e.g. "I LOVE YOU") and get
  // their own space-separated slot; single letters are appended directly
  // to build up a fingerspelled word.
  if (t.length > 1) return (prev ? prev + ' ' : '') + t
  return prev + t
}

function speak(text: string) {
  if (!text || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}

/**
 * The "Sign -> Text" experience: live camera + hand-landmark detection,
 * running either the built-in geometric classifier or a user-trained KNN
 * classifier, with temporal smoothing so a held sign commits to the
 * caption once (rather than spamming duplicate letters every frame).
 */
export default function SignToTextPanel() {
  const [caption, setCaption] = useState('')
  const [liveLabel, setLiveLabel] = useState<string | null>(null)
  const [confidence, setConfidence] = useState(0)
  const [mode, setMode] = useState<ClassifierMode>('rules')
  const [showTraining, setShowTraining] = useState(false)
  const [noHand, setNoHand] = useState(true)

  const trainable = useMemo(() => new TrainableSignClassifier(), [])
  const modeRef = useRef(mode)
  modeRef.current = mode

  const bufferRef = useRef<string[]>([])
  const lastCommitRef = useRef<{ label: string; time: number }>({ label: '', time: 0 })
  const lastLandmarksRef = useRef<Point[] | null>(null)
  const busyRef = useRef(false)

  const handleLandmarks = useCallback(
    (lm: Point[] | null) => {
      lastLandmarksRef.current = lm

      if (!lm) {
        setNoHand(true)
        setLiveLabel(null)
        bufferRef.current = []
        return
      }
      setNoHand(false)

      if (busyRef.current) return
      busyRef.current = true

      void (async () => {
        try {
          const result =
            modeRef.current === 'trained' ? await trainable.predict(lm) : classifyStaticSign(lm)

          if (!result) {
            setLiveLabel(null)
            bufferRef.current = []
            return
          }

          setLiveLabel(result.label)
          setConfidence(result.confidence)

          const buf = bufferRef.current
          buf.push(result.label)
          if (buf.length > STABLE_FRAMES) buf.shift()

          const allSame = buf.length === STABLE_FRAMES && buf.every(l => l === buf[0])
          const now = performance.now()
          const last = lastCommitRef.current
          const canCommit =
            allSame &&
            result.confidence >= MIN_CONFIDENCE &&
            now - last.time > COMMIT_COOLDOWN_MS &&
            (result.label !== last.label || now - last.time > 1600)

          if (canCommit) {
            lastCommitRef.current = { label: result.label, time: now }
            setCaption(prev => appendToken(prev, result.label))
            buf.length = 0
          }
        } finally {
          busyRef.current = false
        }
      })()
    },
    [trainable]
  )

  return (
    <div className="panel sign-to-text">
      <CameraView onLandmarks={handleLandmarks} />

      <div className="mode-row">
        <button
          className={mode === 'rules' ? 'chip chip-active' : 'chip'}
          onClick={() => setMode('rules')}
        >
          Quick Start
        </button>
        <button
          className={mode === 'trained' ? 'chip chip-active' : 'chip'}
          onClick={() => setMode('trained')}
        >
          My Trained Signs
        </button>
        <button className="chip" onClick={() => setShowTraining(v => !v)}>
          {showTraining ? 'Hide Trainer' : 'Train Signs'}
        </button>
      </div>

      {showTraining && (
        <TrainingPanel getLandmarks={() => lastLandmarksRef.current} trainable={trainable} />
      )}

      <CaptionBar
        text={caption}
        liveLabel={noHand ? null : liveLabel}
        confidence={confidence}
        onClear={() => setCaption('')}
        onBackspace={() =>
          setCaption(prev => prev.trim().split(' ').slice(0, -1).join(' '))
        }
        onSpeak={() => speak(caption)}
      />
    </div>
  )
}
