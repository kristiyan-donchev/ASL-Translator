import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

let landmarkerPromise: Promise<HandLandmarker> | null = null

async function create(delegate: 'GPU' | 'CPU'): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate
    },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.6
  })
}

/**
 * Lazily creates (and memoizes) a MediaPipe HandLandmarker instance.
 * Tries the GPU delegate first for best performance on mobile, and
 * falls back to CPU if the device/browser doesn't support WebGL delegation.
 */
export function getHandLandmarker(): Promise<HandLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = create('GPU').catch(() => create('CPU'))
  }
  return landmarkerPromise
}

export type { HandLandmarkerResult }
