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

### Sign → Text (camera or uploaded video → captions)

- Live camera feed rendered full-screen (mobile portrait layout), mirrored for a natural
  selfie view — or, via the **Live Camera / Upload Video** source toggle, a pre-recorded
  video file played back through the same detection pipeline (`src/components/VideoFileView.tsx`),
  for translating a clip of someone else signing instead of your own camera.
- Real hand-landmark detection every frame via MediaPipe's `HandLandmarker` (21 3D
  landmarks per hand), running on-device via WebAssembly/WebGL (GPU delegate, with an
  automatic CPU fallback if GPU delegation isn't supported).
- Three classifier modes, switchable in the UI:
  - **Quick Start** — a deterministic, geometry-based classifier (`src/lib/aslAlphabetClassifier.ts`)
    that needs no training and recognizes handshapes from finger curl/extension state and
    fingertip distances computed from the landmarks. Static single-frame letters only.
  - **My Trained Signs** — an on-device k-NN classifier (`src/lib/knnSignClassifier.ts`,
    using `@tensorflow-models/knn-classifier`) that you train yourself in the "Train Signs"
    panel: hold a sign, capture a burst of samples, and it's immediately recognizable. This
    is a genuine transfer-learning pattern — MediaPipe's pretrained landmark model acts as
    the feature extractor, and the k-NN head is fit on your own recorded examples. Static
    handshapes only (one held pose per example).
  - **Words & Phrases** — a trainable *motion* classifier (`src/lib/gestureClassifier.ts`) for
    signs defined by movement, which is most everyday ASL words ("HELLO", "THANK YOU",
    "PLEASE", ...) rather than a single static handshape. You record a short clip of the
    whole sign in the "Train Signs" panel's "Motion / Word" tab; recognition matches a
    completed motion (segmented automatically whenever your hand leaves frame, or manually
    via "Mark Sign Complete") against your recordings using Dynamic Time Warping, so the
    same sign performed faster or slower than it was recorded still matches. See **Model
    approach & accuracy expectations** below for how this works and its honest limits.
- Recognized letters/words are temporally smoothed (a sign must be held steadily for ~10
  consecutive frames before it "commits" in Quick Start / My Trained Signs mode) and
  appended to a caption bar anchored at the bottom of the screen, updating live. Includes
  backspace, clear, and text-to-speech playback of the caption.

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
3. **My Trained Signs (k-NN)** is how this project reaches "a solid working set of *static*
   signs" honestly: since it's trained on *your* camera angle and *your* hand, it naturally
   sidesteps the orientation ambiguity above. In practice, capturing ~8-10 examples per sign
   (a few seconds) gives noticeably reliable recognition for that sign in that session. It
   still only captures a single held pose per example, though, so it's best for signs that
   have a distinct static handshape even if the "textbook" ASL sign technically involves
   motion.
4. **Words & Phrases (DTW motion matching)** is what actually covers real ASL words and
   phrases, which are overwhelmingly defined by movement rather than a static handshape (a
   wave for HELLO, fingers moving from the chin outward for THANK YOU, etc.). Recording a
   sign captures the whole landmark sequence over the clip
   (`src/lib/gestureClassifier.ts`); recognizing one segments the live/video landmark stream
   automatically (whenever the tracked hand leaves frame, or via the manual "Mark Sign
   Complete" button) and compares that segment's landmark sequence against every recorded
   example using [Dynamic Time Warping](https://en.wikipedia.org/wiki/Dynamic_time_warping)
   — a band-constrained DTW, specifically, using the nearest example's distance (converted
   to a 0-1 confidence via a fixed distance-scale constant) as the match. DTW is the right
   tool here because it non-linearly aligns two sequences, so the same sign performed
   noticeably faster or slower than it was recorded still matches — a plain frame-by-frame
   comparison would require near-identical timing, which no two human performances of a
   sign actually have.
   - **Honest limits of this approach**: the landmark sequence is deliberately *not*
     wrist-normalized like the static classifiers' feature vector — a gesture's path across
     the frame is part of what makes it that sign — which means recognition is somewhat
     sensitive to signing in roughly the same on-screen position/distance-from-camera you
     recorded it in. There's no body/face landmark to anchor gestures to (e.g. "near the
     chin"), since the app only runs MediaPipe's hand-only model, not a full holistic-pose
     model, so "position" here really means "position in the camera frame," a weaker proxy.
     The confidence threshold and DTW band width are heuristics tuned against synthetic
     motion sequences (see `src/lib/gestureClassifier.ts` for the constants), not a labeled
     accuracy benchmark — same caveat as the rule-based classifier's confidence numbers.
     Segmentation assumes a natural pause (hand leaving frame) between signs; for continuous
     signing where the hand never fully leaves frame, use "Mark Sign Complete" to mark
     boundaries manually.

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
    │   ├── knnSignClassifier.ts    # Trainable on-device k-NN classifier (static poses)
    │   ├── gestureClassifier.ts    # Trainable DTW motion classifier (words/phrases)
    │   └── fingerspellingData.ts   # Handshape specs for the reverse-mode diagrams
    └── components/
        ├── CameraView.tsx          # Camera + detection loop + landmark overlay
        ├── VideoFileView.tsx       # Uploaded-video playback + same detection loop
        ├── CaptionBar.tsx          # Bottom-anchored live caption
        ├── ModeToggle.tsx          # Sign→Text / Text→Sign switch
        ├── SignToTextPanel.tsx     # Sign→Text screen (classification + smoothing)
        ├── TrainingPanel.tsx       # Record-your-own-sign UI (static pose + motion capture)
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

- Quick Start and My Trained Signs are static-frame classification only — no motion
  modeling. Motion signs (J, Z, and most everyday phrase-level ASL words) need the Words &
  Phrases (DTW) mode instead, and there's no built-in vocabulary for it — every word/phrase
  has to be recorded by the user first (see the honest-limits note under **Model approach**
  above for why: no bundled/pretrained word-level ASL model ships with this app).
- Rule-based classifier covers a deliberately limited, geometrically-unambiguous letter
  subset; the rest require the trainable k-NN mode.
- Trained signs (both the static k-NN and the DTW motion classifier) are session-only
  (in-memory) in this build — there's no persistence across page reloads yet. Adding
  `IndexedDB` persistence for trained examples is a natural next step.
- Reverse-mode hand diagrams are schematic, not photographic, and a few letters (G, H, K,
  P, Q, R) are visually simplified due to being sideways/downward-facing signs in real ASL.
- Recognition assumes one hand, facing the camera, without heavy occlusion or extreme motion
  blur — the same conditions MediaPipe's hand model is generally evaluated under.
- Not evaluated against a formal accuracy benchmark/test set; accuracy expectations above
  are based on the geometric design of each rule, not a labeled validation run.
