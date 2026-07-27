export type FingerPose = 'up' | 'mid' | 'hook' | 'down'
export type ThumbPose = 'side' | 'front' | 'mid' | 'tuck'

export interface HandShapeSpec {
  thumb: ThumbPose
  index: FingerPose
  middle: FingerPose
  ring: FingerPose
  pinky: FingerPose
  /** Nudge index/ring outward for letters where fingers are visibly spread. */
  spread?: boolean
  note?: string
}

/**
 * Schematic handshape descriptions for the 24 static letters of the ASL
 * manual alphabet (J and Z require motion and are noted as such rather
 * than drawn). These drive the generated SVG diagrams in HandDiagram.tsx.
 * They are simplified, front-facing schematics -- not photographic
 * references -- see the README for why.
 */
export const FINGERSPELLING: Record<string, HandShapeSpec> = {
  A: { thumb: 'side', index: 'down', middle: 'down', ring: 'down', pinky: 'down' },
  B: { thumb: 'front', index: 'up', middle: 'up', ring: 'up', pinky: 'up' },
  C: {
    thumb: 'mid',
    index: 'mid',
    middle: 'mid',
    ring: 'mid',
    pinky: 'mid',
    note: 'Curve the whole hand into a C shape'
  },
  D: { thumb: 'front', index: 'up', middle: 'down', ring: 'down', pinky: 'down' },
  E: {
    thumb: 'front',
    index: 'down',
    middle: 'down',
    ring: 'down',
    pinky: 'down',
    note: 'Fingertips curl down toward the thumb'
  },
  F: {
    thumb: 'mid',
    index: 'mid',
    middle: 'up',
    ring: 'up',
    pinky: 'up',
    note: 'Thumb and index tip touch to form a circle'
  },
  G: {
    thumb: 'side',
    index: 'mid',
    middle: 'down',
    ring: 'down',
    pinky: 'down',
    note: 'Index and thumb point sideways (simplified here as a front-facing schematic)'
  },
  H: {
    thumb: 'tuck',
    index: 'mid',
    middle: 'mid',
    ring: 'down',
    pinky: 'down',
    note: 'Index and middle point sideways together (simplified schematic)'
  },
  I: { thumb: 'front', index: 'down', middle: 'down', ring: 'down', pinky: 'up' },
  J: {
    thumb: 'front',
    index: 'down',
    middle: 'down',
    ring: 'down',
    pinky: 'up',
    note: 'Same handshape as I, then trace a small "J" in the air'
  },
  K: {
    thumb: 'side',
    index: 'up',
    middle: 'mid',
    ring: 'down',
    pinky: 'down',
    spread: true
  },
  L: { thumb: 'side', index: 'up', middle: 'down', ring: 'down', pinky: 'down' },
  M: {
    thumb: 'front',
    index: 'down',
    middle: 'down',
    ring: 'down',
    pinky: 'down',
    note: 'Thumb tucked under the first three fingers'
  },
  N: {
    thumb: 'front',
    index: 'down',
    middle: 'down',
    ring: 'down',
    pinky: 'down',
    note: 'Thumb tucked under the first two fingers'
  },
  O: {
    thumb: 'mid',
    index: 'mid',
    middle: 'mid',
    ring: 'mid',
    pinky: 'mid',
    note: 'Fingertips meet the thumb to form an O'
  },
  P: {
    thumb: 'side',
    index: 'up',
    middle: 'mid',
    ring: 'down',
    pinky: 'down',
    spread: true,
    note: 'Hand points downward in real ASL'
  },
  Q: {
    thumb: 'side',
    index: 'mid',
    middle: 'down',
    ring: 'down',
    pinky: 'down',
    note: 'Hand points downward in real ASL'
  },
  R: {
    thumb: 'tuck',
    index: 'up',
    middle: 'up',
    ring: 'down',
    pinky: 'down',
    note: 'Index and middle finger are crossed (shown side-by-side here)'
  },
  S: {
    thumb: 'front',
    index: 'down',
    middle: 'down',
    ring: 'down',
    pinky: 'down',
    note: 'Fist with thumb wrapped across the front'
  },
  T: {
    thumb: 'front',
    index: 'down',
    middle: 'down',
    ring: 'down',
    pinky: 'down',
    note: 'Thumb tucked between index and middle finger'
  },
  U: { thumb: 'tuck', index: 'up', middle: 'up', ring: 'down', pinky: 'down' },
  V: { thumb: 'tuck', index: 'up', middle: 'up', ring: 'down', pinky: 'down', spread: true },
  W: { thumb: 'tuck', index: 'up', middle: 'up', ring: 'up', pinky: 'down', spread: true },
  X: { thumb: 'front', index: 'hook', middle: 'down', ring: 'down', pinky: 'down' },
  Y: { thumb: 'side', index: 'down', middle: 'down', ring: 'down', pinky: 'up' },
  Z: {
    thumb: 'front',
    index: 'up',
    middle: 'down',
    ring: 'down',
    pinky: 'down',
    note: 'Trace a "Z" shape in the air with the index finger'
  }
}

export interface WordSignSpec extends HandShapeSpec {
  description: string
}

/**
 * A small library of common signs that are shown as a single word-level
 * diagram instead of being spelled out letter by letter. Kept intentionally
 * small in this MVP -- most everyday ASL words involve motion (a hand
 * moving from the chin outward, circling on the chest, etc.) that a static
 * schematic can't faithfully represent, so only signs with a clear, static,
 * single-frame handshape are included here. See README for how to extend
 * this (and for training equivalent recognition in the KNN mode).
 */
export const COMMON_WORD_SIGNS: Record<string, WordSignSpec> = {
  'I LOVE YOU': {
    thumb: 'side',
    index: 'up',
    middle: 'down',
    ring: 'down',
    pinky: 'up',
    description:
      'Thumb, index, and pinky extended; middle and ring folded down. Hold steady with the palm facing out.'
  }
}
