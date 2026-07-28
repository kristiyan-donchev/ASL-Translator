# ASL Translator

A real-time American Sign Language (ASL) ⇄ English translator that runs **entirely
on-device** in the browser — no server, no video upload, no API keys. Responsive layout
works on both mobile (portrait, touch-first) and desktop (≥860px, two-column) — same
camera/MediaPipe/classifier logic underneath, just laid out to fit the screen.

Built with React + Vite + TypeScript, [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
for hand-landmark detection, and [TensorFlow.js](https://www.tensorflow.org/js) for an
on-device trainable classifier. Installable as a PWA.

---

## What's implemented

### Sign → Text (live camera → captions)

- Live camera feed rendered full-screen (mobile portrait layout), mirrored for a natural
  selfie view.
- Real hand-landmark detection every frame via MediaPipe's `HandLandmarker` (21 3D
  landmarks per hand), running on-device via WebAssembly/WebGL (GPU delegate, with an
  automatic CPU fallback if GPU delegation isn't supported).
- Two classifier modes, switchable in the UI:
  - **Quick Start** — a deterministic, geometry-based classifier (`src/lib/aslAlphabetClassifier.ts`)
    that needs no training and recognizes handshapes from finger curl/extension state and
    fingertip distances computed from the landmarks.
  - **My Trained Signs** — an on-device k-NN classifier (`src/lib/knnSignClassifier.ts`,
    using `@tensorflow-models/knn-classifier`) that you train yourself in the "Train Signs"
    panel: hold a sign, capture a burst of samples, and it's immediately recognizable. This
    is a genuine transfer-learning pattern — MediaPipe's pretrained landmark model acts as
    the feature extractor, and the k-NN head is fit on your own recorded examples.
- Recognized letters/words are temporally smoothed (a sign must be held steadily for ~10
  consecutive frames before it "commits") and appended to a caption bar anchored at the
  bottom of the screen, updating live. Includes backspace, clear, and text-to-speech
  playback of the caption.

### Text → Sign (typed English → ASL reference)

- Type any English text; the app steps through (or auto-plays, with adjustable speed) a
  generated schematic hand diagram for each letter's ASL fingerspelling handshape.
- A small library of common whole-word signs (currently "I LOVE YOU") is shown as a single
  word-level diagram instead of being spelled out letter by letter.
- Diagrams are procedurally generated SVGs (`src/components/HandDiagram.tsx`) driven by a
  handshape spec per letter (`src/lib/fingerspellingData.ts`), not photographic references
  — see **Limitations** below for why.

### Responsive layout: mobile + desktop

One codebase, one set of components, driven entirely by CSS — there's no separate desktop
build or code path.

- **Mobile** (< 860px) is the original, unchanged design: a portrait, touch-first
  single-column layout (44px+ tap targets, safe-area insets, no pinch-zoom) that fits a
  phone screen without scrolling.
- **Desktop** (≥ 860px) reflows the same markup via a `@media (min-width: 860px)` block in
  `src/index.css`:
  - **Sign → Text** switches from a stacked column to camera-left / sidebar-right. The
    sidebar (mode toggle, trainer, caption bar) is wrapped in a `.sign-side` element that's
    `display: contents` on mobile (so it has zero layout effect and the original stacking
    order is preserved exactly) and becomes a real `display: flex; flex-direction: column`
    sidebar once the desktop media query takes over.
  - **Text → Sign** switches `.panel.text-to-sign` from a flex column to a CSS Grid with
    named `grid-template-areas`, reflowing into a diagram-left / input-and-controls-right
    two-column layout. Because the grid areas are assigned by existing class name
    (`.text-input`, `.diagram-stage`, `.progress-row`, `.controls-row`, `.speed-row`,
    `.scope-note`), **`TextToSignPanel.tsx` needed no JSX changes at all** — the desktop
    layout comes entirely from CSS Grid reassigning where each element renders.
- Configured as an installable PWA via `vite-plugin-pwa` (add-to-home-screen, offline app
  shell caching, auto-updating service worker).

---

## Model approach & accuracy expectations

**Hand detection** is a real, pretrained model (MediaPipe's `HandLandmarker`, float16
variant) — this part is robust and works well across lighting/skin tones/hand sizes, the
same way it does in Google's own MediaPipe demos.

**Sign classification** is intentionally split into two tiers because a single-frame,
geometry-only classifier has real, honest limits:

1. **Quick Start (rule-based)** reliably distinguishes handshapes that are geometrically
   very different from each other: **B, D, F, I, L, O, U, V, W, Y**, plus a rough best-effort
   for the closed-fist **A/S** pair, and the word sign **"I LOVE YOU."** That's the set with
   distinctive, rotation-tolerant finger-curl/distance signatures. Expect it to feel
   responsive and fairly reliable for these once you get your hand angle roughly facing the
   camera.
2. **Letters intentionally *not* covered by Quick Start**: **C, E, G, H, K, M, N, P, Q, R, S
   (fine-grained), T, X**, and the motion letters **J, Z**. Most of these are ambiguous from
   landmarks alone without knowing hand *orientation* relative to the camera (e.g. G/H point
   sideways; K vs. P differ mainly by whether the hand points up or down), or differ from a
   neighbor letter only by exact thumb placement a few millimeters away (A/S/T/M/N). A
   single static frame and simple distance heuristics can't reliably resolve that — claiming
   otherwise would be overselling it.
3. **My Trained Signs (k-NN)** is how this project reaches "a solid working set of signs"
   honestly: since it's trained on *your* camera angle and *your* hand, it naturally
   sidesteps the orientation ambiguity above. In practice, capturing ~8-10 examples per sign
   (a few seconds) gives noticeably reliable recognition for that sign in that session. This
   is also how you add words beyond the built-in alphabet — the Train panel suggests common
   words (HELLO, THANK YOU, PLEASE, YES, NO, SORRY, GOOD, BAD, MORE, HELP) as one-tap labels,
   or you can type any custom label.

**What's out of scope for this build, and why:** true continuous/motion signs (J, Z, and
most everyday words like HELLO, THANK YOU, PLEASE, which are defined by a *movement*, not a
static pose) aren't recognized from a single frame. Doing that properly needs a temporal
model over a sequence of landmark frames (e.g. an LSTM/temporal CNN or DTW-based sequence
matching), which is a meaningful follow-on project, not a one-off classifier. The trained
k-NN mode captures a single held pose per example, so it works best for signs that have a
distinct static handshape even if the "textbook" sign involves motion.

**Reverse-mode diagrams** are schematic (rectangles standing in for palm/fingers/thumb),
not photographic ASL charts, because no image assets are available in this build
environment. They're accurate about *which fingers are extended vs. curled* and thumb
position, which is enough to teach/recall a handshape, but they're not anatomically
detailed. A handful of letters (G, H, K, P, Q, R) are visually approximated because the
diagram template is front-facing/vertical only — noted in the on-screen caption for each of
those letters.

---

## Project structure

```
├── index.html
├── package.json
├── vite.config.ts              # Vite + vite-plugin-pwa config
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── public/
│   └── icons/icon.svg
└── src/
    ├── main.tsx
    ├── App.tsx                 # Mode switch (Sign→Text / Text→Sign)
    ├── index.css               # Responsive styling (mobile-first, + desktop media query)
    ├── lib/
    │   ├── handLandmarker.ts       # MediaPipe HandLandmarker setup
    │   ├── landmarkFeatures.ts     # Landmark geometry helpers (curl/extension, distances)
    │   ├── aslAlphabetClassifier.ts# Rule-based "Quick Start" classifier
    │   ├── knnSignClassifier.ts    # Trainable on-device k-NN classifier
    │   └── fingerspellingData.ts   # Handshape specs for the reverse-mode diagrams
    └── components/
        ├── CameraView.tsx          # Camera + detection loop + landmark overlay
        ├── CaptionBar.tsx          # Bottom-anchored live caption
        ├── ModeToggle.tsx          # Sign→Text / Text→Sign switch
        ├── SignToTextPanel.tsx     # Sign→Text screen (classification + smoothing)
        ├── TrainingPanel.tsx       # Record-your-own-sign UI for the k-NN classifier
        ├── TextToSignPanel.tsx     # Text→Sign screen (typed text → diagrams)
        └── HandDiagram.tsx         # Procedural SVG handshape renderer
```

---

## Setup & run instructions

Requires Node.js 18+ and npm.

```bash
# install dependencies
npm install

# start a local dev server (with HTTPS-free camera access on localhost)
npm run dev

# type-check + production build
npm run build

# preview the production build locally
npm run preview
```

Open the dev server URL on your phone's mobile browser to test the real camera + touch
experience (use `npm run dev -- --host` or check the "Network" URL Vite prints, since camera
access requires either `localhost` or HTTPS — testing over plain HTTP from another device on
your LAN will be blocked by the browser's secure-context requirement for `getUserMedia`. For
real device testing over the network, either use a tool like `ngrok`/`localtunnel` to get an
HTTPS URL, or deploy the production build to any static HTTPS host — the PWA config is
compatible with things like GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.).

Grant camera permission when prompted. No account, server, or API key is required — all
inference (hand tracking + classification) happens locally in the browser.

---

## Limitations summary

- Static-frame classification only — no motion/trajectory modeling (affects J, Z, and most
  everyday phrase-level ASL words).
- Rule-based classifier covers a deliberately limited, geometrically-unambiguous letter
  subset; the rest require the trainable k-NN mode.
- Trained k-NN signs are session-only (in-memory) in this build — there's no persistence
  across page reloads yet. Adding `IndexedDB` persistence for trained examples is a natural
  next step.
- Reverse-mode hand diagrams are schematic, not photographic, and a few letters (G, H, K,
  P, Q, R) are visually simplified due to being sideways/downward-facing signs in real ASL.
- Recognition assumes one hand, facing the camera, without heavy occlusion or extreme motion
  blur — the same conditions MediaPipe's hand model is generally evaluated under.
- Not evaluated against a formal accuracy benchmark/test set; accuracy expectations above
  are based on the geometric design of each rule, not a labeled validation run.
