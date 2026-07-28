import { useEffect, useRef, useState } from 'react'
import HandDiagram from './HandDiagram'
import { FINGERSPELLING, COMMON_WORD_SIGNS } from '../lib/fingerspellingData'
import type { HandShapeSpec } from '../lib/fingerspellingData'

interface Token {
  display: string
  spec: HandShapeSpec
  note?: string
}

function tokenize(input: string): Token[] {
  const trimmed = input.trim().toUpperCase()
  if (!trimmed) return []

  const tokens: Token[] = []
  for (const word of trimmed.split(/\s+/)) {
    const wordSign = COMMON_WORD_SIGNS[word]
    if (wordSign) {
      tokens.push({ display: word, spec: wordSign, note: wordSign.description })
      continue
    }
    for (const ch of word) {
      const spec = FINGERSPELLING[ch]
      if (spec) tokens.push({ display: ch, spec, note: spec.note })
    }
  }
  return tokens
}

/**
 * The "Text -> Sign" experience: type English text and step through (or
 * auto-play) a generated ASL fingerspelling diagram for each letter, or a
 * dedicated word-level diagram for the handful of common signs in
 * COMMON_WORD_SIGNS.
 */
export default function TextToSignPanel() {
  const [input, setInput] = useState('HELLO')
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(0)
  const [speedMs, setSpeedMs] = useState(900)
  const timerRef = useRef<number | undefined>(undefined)

  const tokens = tokenize(input)

  useEffect(() => {
    setIndex(0)
    setPlaying(false)
  }, [input])

  useEffect(() => {
    if (!playing || tokens.length === 0) return
    timerRef.current = window.setInterval(() => {
      setIndex(i => {
        if (i + 1 >= tokens.length) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, speedMs)
    return () => window.clearInterval(timerRef.current)
  }, [playing, tokens.length, speedMs])

  const current = tokens[index]

  return (
    <div className="panel text-to-sign">
      <div className="text-controls">
        <textarea
          className="text-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type English text to see it in ASL fingerspelling"
          rows={2}
        />

        <div className="progress-row">
          {tokens.map((t, i) => (
            <span
              key={`${t.display}-${i}`}
              className={i === index ? 'progress-dot active' : 'progress-dot'}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>

        <div className="controls-row">
          <button className="btn" onClick={() => setIndex(i => Math.max(0, i - 1))}>
            Prev
          </button>
          <button className="btn btn-primary" onClick={() => setPlaying(p => !p)}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            className="btn"
            onClick={() => setIndex(i => Math.min(tokens.length - 1, i + 1))}
          >
            Next
          </button>
        </div>

        <div className="speed-row">
          <label>Speed</label>
          <input
            type="range"
            min={400}
            max={1600}
            step={100}
            value={speedMs}
            onChange={e => setSpeedMs(Number(e.target.value))}
          />
        </div>

        <p className="scope-note">
          Letters not yet in the fingerspelling set are skipped. J and Z include a small motion
          in real ASL that this static diagram can't show.
        </p>
      </div>

      <div className="diagram-stage">
        {current ? (
          <>
            <HandDiagram spec={current.spec} label={current.display} />
            <div className="diagram-label">{current.display}</div>
            {current.note && <div className="diagram-note">{current.note}</div>}
          </>
        ) : (
          <div className="diagram-placeholder">Type something to see the sign</div>
        )}
      </div>
    </div>
  )
}
