import { dist } from './landmarkFeatures'
import type { Point } from './landmarkFeatures'

/** One frame of a recorded gesture: the raw (image-relative) 21 hand
 * landmarks, deliberately *not* wrist-normalized like `normalizeLandmarks`
 * -- unlike static-pose classification, a gesture's overall path through
 * the frame (e.g. a hand moving outward from the chin) is part of what
 * makes it that sign, so position has to be preserved here. */
export type GestureFrame = Point[]

const MAX_SEQUENCE_FRAMES = 45
const MIN_SEQUENCE_FRAMES = 5
const DISTANCE_SCALE = 0.22

/** Uniformly downsamples a sequence so DTW cost stays bounded regardless of
 * how long the user held the recording/gesture for. */
function resample(seq: GestureFrame[], maxLen: number): GestureFrame[] {
  if (seq.length <= maxLen) return seq
  const out: GestureFrame[] = []
  for (let i = 0; i < maxLen; i++) {
    out.push(seq[Math.floor((i * seq.length) / maxLen)])
  }
  return out
}

function frameDistance(a: GestureFrame, b: GestureFrame): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += dist(a[i], b[i])
  return sum / a.length
}

/**
 * Dynamic Time Warping distance between two landmark-sequence gestures.
 * DTW aligns the two sequences non-linearly, so it tolerates the same sign
 * being performed faster/slower or with uneven pacing -- unlike a plain
 * frame-by-frame comparison, which would require near-identical timing.
 * Returned distance is normalized by warp-path length so it's roughly
 * comparable across sequences of different lengths.
 *
 * The warp path is constrained to a diagonal band (a Sakoe-Chiba band):
 * without it, unconstrained DTW can pathologically warp through
 * uncorrelated/random motion by matching each of its frames to whichever
 * template frame happens to be nearest, reporting a misleadingly low
 * distance for a gesture that isn't actually a match. The band still
 * widens with |n - m| so genuinely faster/slower performances of the same
 * gesture remain reachable.
 */
function dtwDistance(a: GestureFrame[], b: GestureFrame[]): number {
  const n = a.length
  const m = b.length
  const band = Math.max(4, Math.abs(n - m) + 4)
  let prev = new Float64Array(m + 1).fill(Infinity)
  let curr = new Float64Array(m + 1).fill(Infinity)
  prev[0] = 0
  for (let i = 1; i <= n; i++) {
    curr.fill(Infinity)
    const jLo = Math.max(1, i - band)
    const jHi = Math.min(m, i + band)
    for (let j = jLo; j <= jHi; j++) {
      const cost = frameDistance(a[i - 1], b[j - 1])
      curr[j] = cost + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[m] / (n + m)
}

interface GestureExample {
  label: string
  frames: GestureFrame[]
}

/**
 * Trainable, on-device recognizer for whole signs defined by *movement*
 * (most everyday ASL words and phrases) rather than a single static
 * handshape -- the counterpart to knnSignClassifier.ts's per-frame k-NN,
 * which can only ever learn a held pose. A recorded example is a short
 * clip of landmark frames; recognition matches a completed motion segment
 * against the nearest stored example by DTW distance (1-nearest-neighbor
 * across all examples, same "genuinely trained on your own recordings"
 * spirit as the static classifier).
 */
export class TrainableGestureClassifier {
  private examples: GestureExample[] = []

  addExample(frames: GestureFrame[], label: string): boolean {
    if (frames.length < MIN_SEQUENCE_FRAMES) return false
    this.examples.push({ label, frames: resample(frames, MAX_SEQUENCE_FRAMES) })
    return true
  }

  predict(frames: GestureFrame[]): { label: string; confidence: number } | null {
    if (this.examples.length === 0 || frames.length < MIN_SEQUENCE_FRAMES) return null
    const query = resample(frames, MAX_SEQUENCE_FRAMES)

    let best: { label: string; distance: number } | null = null
    for (const ex of this.examples) {
      const distance = dtwDistance(query, ex.frames)
      if (!best || distance < best.distance) best = { label: ex.label, distance }
    }
    if (!best) return null

    const confidence = Math.max(0, 1 - best.distance / DISTANCE_SCALE)
    return { label: best.label, confidence }
  }

  clearLabel(label: string): void {
    this.examples = this.examples.filter(e => e.label !== label)
  }

  clearAll(): void {
    this.examples = []
  }

  getCounts(): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const e of this.examples) counts[e.label] = (counts[e.label] ?? 0) + 1
    return counts
  }
}

export const GESTURE_MIN_FRAMES_TO_COMMIT = 6
export const GESTURE_MAX_BUFFER_FRAMES = 90
export const GESTURE_MIN_CONFIDENCE = 0.35
