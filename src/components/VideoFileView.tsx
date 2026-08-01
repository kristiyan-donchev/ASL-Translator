import { useEffect, useRef, useState } from 'react'
import { getHandLandmarker } from '../lib/handLandmarker'
import type { Point } from '../lib/landmarkFeatures'

interface VideoFileViewProps {
  file: File
  onLandmarks: (landmarks: Point[] | null) => void
  onEnded?: () => void
}

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
]

function drawLandmarks(ctx: CanvasRenderingContext2D, lm: Point[], width: number, height: number) {
  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.moveTo(lm[a].x * width, lm[a].y * height)
    ctx.lineTo(lm[b].x * width, lm[b].y * height)
  }
  ctx.stroke()

  ctx.fillStyle = '#22d3ee'
  for (const p of lm) {
    ctx.beginPath()
    ctx.arc(p.x * width, p.y * height, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * Same detection pipeline as CameraView, but reads frames from an
 * uploaded/local video file (played back via native <video controls>)
 * instead of a live camera stream. Detection timestamps use the real
 * wall clock, so they stay monotonic across pause/seek/replay.
 */
export default function VideoFileView({ file, onLandmarks, onEnded }: VideoFileViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const runningRef = useRef(false)
  const onLandmarksRef = useRef(onLandmarks)
  onLandmarksRef.current = onLandmarks
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const url = URL.createObjectURL(file)
    setError(null)

    async function init() {
      try {
        const landmarker = await getHandLandmarker()
        if (cancelled) return
        const video = videoRef.current
        if (!video) return

        const onFrame = () => {
          const v = videoRef.current
          const canvas = canvasRef.current
          if (v && v.readyState >= 2) {
            const result = landmarker.detectForVideo(v, performance.now())
            const ctx = canvas?.getContext('2d')
            if (canvas && ctx && (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight)) {
              canvas.width = v.videoWidth
              canvas.height = v.videoHeight
            }
            if (result.landmarks && result.landmarks.length > 0) {
              const lm = result.landmarks[0] as unknown as Point[]
              if (canvas && ctx) drawLandmarks(ctx, lm, canvas.width, canvas.height)
              onLandmarksRef.current(lm)
            } else {
              if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
              onLandmarksRef.current(null)
            }
          }
          if (!runningRef.current) return
          const vfcVideo = video as HTMLVideoElement & {
            requestVideoFrameCallback?: (cb: () => void) => number
          }
          if (typeof vfcVideo.requestVideoFrameCallback === 'function') {
            vfcVideo.requestVideoFrameCallback(onFrame)
          } else {
            rafRef.current = requestAnimationFrame(onFrame)
          }
        }

        const start = () => {
          if (runningRef.current) return
          runningRef.current = true
          onFrame()
        }
        const stop = () => {
          runningRef.current = false
          cancelAnimationFrame(rafRef.current)
        }
        const handleEnded = () => {
          stop()
          const canvas = canvasRef.current
          const ctx = canvas?.getContext('2d')
          if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
          onLandmarksRef.current(null)
          onEndedRef.current?.()
        }

        video.addEventListener('play', start)
        video.addEventListener('pause', stop)
        video.addEventListener('ended', handleEnded)
        video.src = url

        return () => {
          video.removeEventListener('play', start)
          video.removeEventListener('pause', stop)
          video.removeEventListener('ended', handleEnded)
        }
      } catch (err) {
        console.error('Video model init failed', err)
        setError('Could not load the sign-detection model for this video.')
      }
    }

    const cleanupPromise = init()

    return () => {
      cancelled = true
      runningRef.current = false
      cancelAnimationFrame(rafRef.current)
      void cleanupPromise.then(cleanup => cleanup?.())
      URL.revokeObjectURL(url)
    }
  }, [file])

  return (
    <div className="camera-view">
      <video ref={videoRef} className="camera-video" playsInline controls />
      <canvas ref={canvasRef} className="camera-overlay" />
      {error && <div className="camera-error">{error}</div>}
    </div>
  )
}
