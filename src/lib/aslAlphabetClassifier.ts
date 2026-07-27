import { getFingerCurls, fingertipDistance } from './landmarkFeatures'
import type { Point } from './landmarkFeatures'

export interface ClassificationResult {
  label: string
  confidence: number
}

/**
 * Rule-based, geometry-only classifier for a subset of static ASL
 * fingerspelling handshapes plus one common word sign ("I LOVE YOU").
 *
 * This is intentionally conservative: it only returns letters whose
 * handshape is distinguishable from every other supported letter using
 * simple, rotation-tolerant landmark geometry (finger curl state + a
 * couple of fingertip distances). Letters that are highly ambiguous
 * without knowing hand orientation relative to the camera (e.g. G/H/K/P/Q,
 * or the A/S/T/M/N tight-fist cluster) are deliberately left out here --
 * see the README for the full accuracy/scope discussion. Those signs (and
 * any custom word) can still be recognized via the trainable KNN mode in
 * knnSignClassifier.ts, which learns from the user's own camera angle.
 */
export function classifyStaticSign(lm: Point[]): ClassificationResult | null {
  const c = getFingerCurls(lm)
  const thumbIndexDist = fingertipDistance(lm, 4, 8)
  const indexMiddleDist = fingertipDistance(lm, 8, 12)

  const extendedCount = [c.index, c.middle, c.ring, c.pinky].filter(Boolean).length

  // "I LOVE YOU": thumb + index + pinky extended, middle & ring curled.
  if (c.thumb && c.index && !c.middle && !c.ring && c.pinky) {
    return { label: 'I LOVE YOU', confidence: 0.85 }
  }

  // B: all four fingers extended together, thumb tucked across the palm.
  if (extendedCount === 4 && !c.thumb) {
    return { label: 'B', confidence: 0.75 }
  }

  // L: thumb + index extended only, forming an "L".
  if (c.thumb && c.index && !c.middle && !c.ring && !c.pinky) {
    return { label: 'L', confidence: 0.8 }
  }

  // Y: thumb + pinky extended only ("hang loose" shape).
  if (c.thumb && !c.index && !c.middle && !c.ring && c.pinky) {
    return { label: 'Y', confidence: 0.8 }
  }

  // I: pinky extended only.
  if (!c.thumb && !c.index && !c.middle && !c.ring && c.pinky) {
    return { label: 'I', confidence: 0.75 }
  }

  // D: index extended only, other fingers curled toward thumb.
  if (!c.thumb && c.index && !c.middle && !c.ring && !c.pinky) {
    return { label: 'D', confidence: 0.7 }
  }

  // V: index + middle extended and spread apart, ring/pinky curled.
  if (c.index && c.middle && !c.ring && !c.pinky && indexMiddleDist > 0.35) {
    return { label: 'V', confidence: 0.75 }
  }

  // U: index + middle extended and held together, ring/pinky curled.
  if (c.index && c.middle && !c.ring && !c.pinky && indexMiddleDist <= 0.35) {
    return { label: 'U', confidence: 0.7 }
  }

  // W: index + middle + ring extended, pinky curled.
  if (c.index && c.middle && c.ring && !c.pinky) {
    return { label: 'W', confidence: 0.75 }
  }

  // F: index and thumb pinched together, other three fingers extended.
  if (!c.index && c.middle && c.ring && c.pinky && thumbIndexDist < 0.3) {
    return { label: 'F', confidence: 0.65 }
  }

  // O: all fingertips curled in to meet the thumb, forming a circle.
  if (!c.index && !c.middle && !c.ring && !c.pinky && !c.thumb && thumbIndexDist < 0.35) {
    return { label: 'O', confidence: 0.6 }
  }

  // Closed-fist cluster (A / S) -- these two ASL letters differ mainly by
  // exact thumb placement, which our coarse extended/curled test can't
  // reliably separate. We report a best-effort, lower-confidence guess and
  // rely on the trainable mode for anyone who needs to disambiguate them.
  if (extendedCount === 0) {
    return c.thumb
      ? { label: 'A', confidence: 0.45 }
      : { label: 'S', confidence: 0.35 }
  }

  return null
}
