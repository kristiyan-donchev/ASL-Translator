import { useEffect, useRef, useState } from 'react'
import { getHandLandmarker } from '../lib/handLandmarker'
import type { Point } from '../lib/landmarkFeatures'

interface CameraViewProps {
  onLandmarks: (landmarks: Point[] | null) => void
  mirrored?: boolean
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
 * Owns the camera stream and the real-time MediaPipe HandLandmarker
 * detection loop. Calls onLandmarks(...) once per processed frame with
 * either the first detected hand's 21 landmarks, or null if no hand is
 * currently visible.
 */
export default function CameraView({ onLandmarks, mirrored = true }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const runningRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const onLandmarksRef = useRef(onLandmarks)
  onLandmarksRef.current = onLandmarks

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()

        const landmarker = await getHandLandmarker()
        if (cancelled) return
        runningRef.current = true

        const loop = () => {
          if (!runningRef.current) return
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
          rafRef.current = requestAnimationFrame(loop)
        }
        rafRef.current = requestAnimationFrame(loop)
      } catch (err) {
        console.error('Camera/model init failed', err)
        setError('Camera access failed. Please allow camera permission and reload the page.')
      }
    }

    start()

    return () => {
      cancelled = true
      runningRef.current = false
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  return (
    <div className="camera-view">
      <video
        ref={videoRef}
        className="camera-video"
        style={{ transform: mirrored ? 'scaleX(-1)' : undefined }}
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="camera-overlay"
        style={{ transform: mirrored ? 'scaleX(-1)' : undefined }}
      />
      {error && <div className="camera-error">{error}</div>}
    </div>
  )
}
