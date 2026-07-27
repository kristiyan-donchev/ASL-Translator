import type { HandShapeSpec } from '../lib/fingerspellingData'

interface HandDiagramProps {
  spec: HandShapeSpec
  label?: string
}

type FingerName = 'index' | 'middle' | 'ring' | 'pinky'

const FINGER_X: Record<FingerName, number> = {
  index: 78,
  middle: 100,
  ring: 122,
  pinky: 144
}

const FINGER_TOP_Y: Record<string, number> = {
  up: 30,
  mid: 65,
  hook: 45,
  down: 100
}

const BASE_Y = 155

/**
 * Renders a simplified, schematic front-facing hand illustration from a
 * HandShapeSpec (which finger is extended/curled/hooked, and where the
 * thumb sits). Generated procedurally rather than using photographic
 * reference images, since no such assets are bundled in this project --
 * see the README for details.
 */
export default function HandDiagram({ spec, label }: HandDiagramProps) {
  const fingers: FingerName[] = ['index', 'middle', 'ring', 'pinky']

  return (
    <svg
      viewBox="0 0 220 260"
      className="hand-diagram"
      role="img"
      aria-label={label ? `ASL handshape for ${label}` : 'ASL handshape diagram'}
    >
      <rect x="55" y="150" width="110" height="80" rx="24" fill="var(--hand-fill)" />
      <rect x="80" y="220" width="60" height="30" rx="10" fill="var(--hand-fill)" />

      {fingers.map(finger => {
        let x = FINGER_X[finger]
        if (spec.spread) {
          if (finger === 'index') x -= 8
          if (finger === 'ring') x += 8
        }
        const pose = spec[finger]
        const topY = FINGER_TOP_Y[pose]

        if (pose === 'down') {
          return (
            <rect
              key={finger}
              x={x - 9}
              y={BASE_Y - 12}
              width={18}
              height={16}
              rx={6}
              fill="var(--hand-fill)"
              stroke="rgba(0,0,0,0.15)"
            />
          )
        }

        if (pose === 'hook') {
          return (
            <path
              key={finger}
              d={`M ${x - 9} ${BASE_Y} L ${x - 9} ${topY + 12} Q ${x - 9} ${topY} ${x} ${topY} Q ${x + 9} ${topY} ${x + 9} ${topY + 12} L ${x + 9} ${BASE_Y} Z`}
              fill="var(--hand-fill)"
              stroke="rgba(0,0,0,0.15)"
            />
          )
        }

        return (
          <rect
            key={finger}
            x={x - 9}
            y={topY}
            width={18}
            height={BASE_Y - topY}
            rx={9}
            fill="var(--hand-fill)"
            stroke="rgba(0,0,0,0.15)"
          />
        )
      })}

      <ThumbShape pose={spec.thumb} />
    </svg>
  )
}

function ThumbShape({ pose }: { pose: HandShapeSpec['thumb'] }) {
  switch (pose) {
    case 'side':
      return (
        <rect
          x="30"
          y="140"
          width="34"
          height="18"
          rx="9"
          fill="var(--hand-fill)"
          stroke="rgba(0,0,0,0.15)"
          transform="rotate(-25 47 149)"
        />
      )
    case 'mid':
      return (
        <rect
          x="55"
          y="165"
          width="36"
          height="16"
          rx="8"
          fill="var(--hand-fill)"
          stroke="rgba(0,0,0,0.15)"
          transform="rotate(-10 73 173)"
        />
      )
    case 'front':
      return (
        <rect
          x="60"
          y="175"
          width="40"
          height="16"
          rx="8"
          fill="var(--hand-fill)"
          stroke="rgba(0,0,0,0.15)"
        />
      )
    case 'tuck':
    default:
      return (
        <rect
          x="58"
          y="185"
          width="20"
          height="12"
          rx="6"
          fill="var(--hand-fill)"
          stroke="rgba(0,0,0,0.15)"
        />
      )
  }
}
