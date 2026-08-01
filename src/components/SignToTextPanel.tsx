import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CameraView from './CameraView'
import VideoFileView from './VideoFileView'
import CaptionBar from './CaptionBar'
import TrainingPanel from './TrainingPanel'
import { classifyStaticSign } from '../lib/aslAlphabetClassifier'
import { TrainableSignClassifier } from '../lib/knnSignClassifier'
import {
  TrainableGestureClassifier,
  GESTURE_MIN_FRAMES_TO_COMMIT,
  GESTURE_MAX_BUFFER_FRAMES,
  GESTURE_MIN_CONFIDENCE
} from '../lib/gestureClassifier'
import type { GestureFrame } from '../lib/gestureClassifier'
import type { Point } from '../lib/landmarkFeatures'

type ClassifierMode = 'rules' | 'trained' | 'gesture'
type Source = 'camera' | 'upload'

const STABLE_FRAMES = 10
const COMMIT_COOLDOWN_MS = 700
const MIN_CONFIDENCE = 0.4

function appendToken(prev: string, token: string): string {
  const t = token.toUpperCase()
  if (t.length > 1) return (prev ? prev + ' ' : '') + t
  return prev + t
}

function speak(text: string) {
  if (!text || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}

export default function SignToTextPanel() {
  const [caption, setCaption] = useState('')
  const [liveLabel, setLiveLabel] = useState<string | null>(null)
  const [confidence, setConfidence] = useState(0)
  const [mode, setMode] = useState<ClassifierMode>('rules')
  const [showTraining, setShowTraining] = useState(false)
  const [noHand, setNoHand] = useState(true)
  const [source, setSource] = useState<Source>('camera')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoDone, setVideoDone] = useState(false)
  const [gestureFrameCount, setGestureFrameCount] = useState(0)

  const trainable = useMemo(() => new TrainableSignClassifier(), [])
  const gestureTrainable = useMemo(() => new TrainableGestureClassifier(), [])
  const modeRef = useRef(mode)
  modeRef.current = mode

  const fileInputRef = useRef<HTMLInputElement>(null)
  const bufferRef = useRef<string[]>([])
  const lastCommitRef = useRef<{ label: string; time: number }>({ label: '', time: 0 })
  const lastLandmarksRef = useRef<Point[] | null>(null)
  const busyRef = useRef(false)
  const gestureBufferRef = useRef<GestureFrame[]>([])

  const resetTranscript = useCallback(() => {
    setCaption('')
    setLiveLabel(null)
    setConfidence(0)
    setNoHand(true)
    bufferRef.current = []
    lastCommitRef.current = { label: '', time: 0 }
    gestureBufferRef.current = []
    setGestureFrameCount(0)
  }, [])

  const handlePickVideo = useCallback(
    (file: File) => {
      resetTranscript()
      setVideoDone(false)
      setVideoFile(file)
      setSource('upload')
    },
    [resetTranscript]
  )

  const switchToCamera = useCallback(() => {
    resetTranscript()
    setSource('camera')
  }, [resetTranscript])

  // Discard any in-progress gesture recording when the classifier mode
  // changes, so frames from one mode never leak into another, and clear
  // the stale "live" indicator left over from whichever mode was active.
  useEffect(() => {
    gestureBufferRef.current = []
    setGestureFrameCount(0)
    setLiveLabel(null)
    setConfidence(0)
  }, [mode])

  const commitGesture = useCallback(() => {
    const frames = gestureBufferRef.current
    gestureBufferRef.current = []
    setGestureFrameCount(0)
    if (frames.length < GESTURE_MIN_FRAMES_TO_COMMIT) return

    const result = gestureTrainable.predict(frames)
    if (result && result.confidence >= GESTURE_MIN_CONFIDENCE) {
      setLiveLabel(result.label)
      setConfidence(result.confidence)
      setCaption(prev => appendToken(prev, result.label))
    }
  }, [gestureTrainable])

  const handleGestureFrame = useCallback(
    (lm: Point[] | null) => {
      if (lm) {
        setNoHand(false)
        const buf = gestureBufferRef.current
        buf.push(lm)
        setGestureFrameCount(buf.length)
        if (buf.length >= GESTURE_MAX_BUFFER_FRAMES) commitGesture()
      } else {
        setNoHand(true)
        commitGesture()
      }
    },
    [commitGesture]
  )

  const handleLandmarks = useCallback(
    (lm: Point[] | null) => {
      lastLandmarksRef.current = lm

      if (modeRef.current === 'gesture') {
        handleGestureFrame(lm)
        return
      }

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
    [trainable, handleGestureFrame]
  )

  return (
    <div className="panel sign-to-text">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="visually-hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handlePickVideo(file)
          e.target.value = ''
        }}
      />

      {source === 'camera' ? (
        <CameraView onLandmarks={handleLandmarks} />
      ) : videoFile ? (
        <VideoFileView
          key={videoFile.name + videoFile.lastModified}
          file={videoFile}
          onLandmarks={handleLandmarks}
          onEnded={() => setVideoDone(true)}
        />
      ) : null}

      <div className="sign-side">
        <div className="mode-row">
          <button
            className={source === 'camera' ? 'chip chip-active' : 'chip'}
            onClick={switchToCamera}
          >
            Live Camera
          </button>
          <button
            className={source === 'upload' ? 'chip chip-active' : 'chip'}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Video
          </button>
        </div>

        {source === 'upload' && videoDone && (
          <p className="training-feedback">
            Reached the end of the video — replay it, or upload another, to keep translating.
          </p>
        )}

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
          <button
            className={mode === 'gesture' ? 'chip chip-active' : 'chip'}
            onClick={() => setMode('gesture')}
          >
            Words &amp; Phrases
          </button>
          <button className="chip" onClick={() => setShowTraining(v => !v)}>
            {showTraining ? 'Hide Trainer' : 'Train Signs'}
          </button>
        </div>

        {mode === 'gesture' && (
          <div className="gesture-status">
            <span>
              {noHand
                ? 'Show your hand and perform a sign, then pause or move it out of frame.'
                : `Signing… ${gestureFrameCount} frame(s) captured`}
            </span>
            <button
              className="chip"
              onClick={commitGesture}
              disabled={gestureFrameCount < GESTURE_MIN_FRAMES_TO_COMMIT}
            >
              Mark Sign Complete
            </button>
          </div>
        )}

        {showTraining && (
          <TrainingPanel
            getLandmarks={() => lastLandmarksRef.current}
            trainable={trainable}
            gestureTrainable={gestureTrainable}
          />
        )}

        <CaptionBar
          text={caption}
          liveLabel={mode === 'gesture' ? liveLabel : noHand ? null : liveLabel}
          confidence={confidence}
          onClear={() => setCaption('')}
          onBackspace={() =>
            setCaption(prev => prev.trim().split(' ').slice(0, -1).join(' '))
          }
          onSpeak={() => speak(caption)}
        />
      </div>
    </div>
  )
}
