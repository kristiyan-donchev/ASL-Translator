export interface Point {
  x: number
  y: number
  z: number
}

/** Euclidean distance between two 3D landmark points. */
export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

/** A scale reference for the hand (wrist to middle-finger MCP) used to
 * normalize distances so classification is roughly invariant to how close
 * the hand is to the camera. */
export function palmScale(lm: Point[]): number {
  return dist(lm[0], lm[9]) || 1e-6
}

/** Distance between two landmark indices, normalized by hand scale. */
export function fingertipDistance(lm: Point[], a: number, b: number): number {
  return dist(lm[a], lm[b]) / palmScale(lm)
}

/**
 * Flattens + normalizes all 21 landmarks into a 63-length feature vector
 * (translated to the wrist origin, scaled by hand size). This is the
 * feature representation fed into the trainable KNN classifier.
 */
export function normalizeLandmarks(lm: Point[]): number[] {
  const origin = lm[0]
  const scale = palmScale(lm)
  const out: number[] = []
  for (const p of lm) {
    out.push((p.x - origin.x) / scale, (p.y - origin.y) / scale, (p.z - origin.z) / scale)
  }
  return out
}

/**
 * A finger is considered "extended" when its fingertip is meaningfully
 * farther from the wrist than both its PIP and MCP joints -- i.e. the
 * finger is straightened out away from the palm rather than curled in.
 * This distance-based test is tolerant of in-plane hand rotation, which
 * makes it more robust than a simple "tip.y < pip.y" check.
 */
export function isFingerExtended(lm: Point[], tip: number, pip: number, mcp: number): boolean {
  const wrist = lm[0]
  const tipDist = dist(lm[tip], wrist)
  const pipDist = dist(lm[pip], wrist)
  const mcpDist = dist(lm[mcp], wrist)
  return tipDist > pipDist * 1.05 && tipDist > mcpDist * 1.15
}

/**
 * The thumb doesn't fold the same way as the other fingers, so it gets a
 * dedicated heuristic: it's "extended" when the thumb tip has moved away
 * from the palm (measured against the pinky MCP) relative to its resting
 * (CMC joint) position.
 */
export function isThumbExtended(lm: Point[]): boolean {
  const scale = palmScale(lm)
  const tipToPinkyMcp = dist(lm[4], lm[17])
  const cmcToPinkyMcp = dist(lm[1], lm[17])
  return tipToPinkyMcp - cmcToPinkyMcp > 0.15 * scale
}

export interface FingerCurls {
  thumb: boolean
  index: boolean
  middle: boolean
  ring: boolean
  pinky: boolean
}

/** Computes extended/curled state for all five fingers from raw landmarks. */
export function getFingerCurls(lm: Point[]): FingerCurls {
  return {
    thumb: isThumbExtended(lm),
    index: isFingerExtended(lm, 8, 6, 5),
    middle: isFingerExtended(lm, 12, 10, 9),
    ring: isFingerExtended(lm, 16, 14, 13),
    pinky: isFingerExtended(lm, 20, 18, 17)
  }
}
