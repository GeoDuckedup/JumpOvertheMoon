# Over the Moon — HTML Rebuild

This directory contains the native HTML/JavaScript production release of
**Over the Moon**. The existing `cat-sword-climb/` Pygame project remains the
historical behavior and shared-art reference.

## Current status

- Phase 0: complete — reference preservation and baseline capture
- Phase 1: complete — responsive single-canvas browser shell
- Phase 2: complete — fixed-step runtime and adaptive performance foundation
- Phase 3: complete — first playable jump/slash/balloon-bounce slice with sound
- Phase 4: complete — generated endless route, bounded entities, game over,
  retry, and locally saved best height
- Phase 5: complete — landmark progression, altitude sky chapters, color
  match/combo rewards, and long-fall re-entry trail
- Phase 6: complete — altitude speed ramp, rare shooting stars, adaptive
  ambience, initials entry, and shared/offline-safe leaderboard
- Phase 7: complete — seven upper-cosmos landmarks, extended safe route,
  compact retained history, DEV landmark warps, and endless continuation
- Phase 8: complete — approved production art for all seven upper landmarks
- Phase 9: complete — upper-cosmos backgrounds/ambience, presentation polish,
  belly-up death pose, and subtle bird/saucer flybys
- Phase 10: complete — production cache graph, offline shell, public/DEV
  isolation, full-climb fairness audit, reproducible hashed package, and the
  `10.2.0` shipping build with the desktop fullscreen button
  removed and slightly elevated centered camera framing

## GitHub Pages shipping build

The repository publishes `main:/docs` at
`https://geoduckedup.github.io/JumpOvertheMoon/`. Generate the exact root
deployment with:

```bash
npm run ship:pages
```

The command rebuilds the protected release package, adapts asset, manifest, and
service-worker paths for the Pages root, replaces only a recognized legacy or
marked `docs/` target, and verifies every generated file hash. It preserves the
existing Firebase project and `/jumpoverthemoon/scores` leaderboard path.

## Non-negotiable rebuild requirements

- Full-viewport portrait playfield on phones.
- Centered portrait playfield capped at 500 CSS pixels wide on desktop.
- Fixed 540-unit logical width with a logical height that adapts to the viewport.
- Safe-area-aware HUD and controls.
- Native browser audio with sound effects, ambience support, mute, and persistent volume.
- Fixed-step gameplay simulation with `requestAnimationFrame` rendering.
- Adaptive LOW, MED, and HIGH rendering profiles.
- Existing Pygame assets and gameplay behavior reused unless a later phase deliberately
  approves a change.

## Phase 0 artifacts

- `PHASE_0_BASELINE.md`: human-readable reference and acceptance contract.
- `reference/reference.json`: generated machine-readable source baseline.
- `reference/capture_reference.py`: repeatable baseline generator.
- `reference/screenshots/`: native and browser reference captures.

## Rebuild phase artifacts

- `IDEAS.md`: tabled gameplay concepts, including the timed Black Hole finish
  and the Black Hole portal into an inverted realm.
- `PHASE_1_SHELL.md`: shell architecture, responsive display contract, automated
  viewport matrix, verification results, and Phase 2 handoff.
- `PHASE_2_RUNTIME.md`: fixed-step clock, visibility handling, frame metrics,
  adaptive quality, iPhone app mode, verification, and Phase 3 handoff.
- `PHASE_3_PLAYABLE_SLICE.md`: controls, gameplay/physics contract, Web Audio
  behavior, verification, known slice limits, and Phase 4 handoff.
- `PHASE_4_RUN_LOOP.md`: route generation, bounded balloon lifecycle,
  floor/game-over/retry rules, local persistence, verification, and Phase 5
  handoff.
- `PHASE_5_PROGRESSION.md`: landmark clearance/approach rules, background
  chapters, color rewards, re-entry behavior, verification, and Phase 6 handoff.
- `PHASE_6_FINAL_PARITY.md`: speed ramp, shooting stars, ambience, initials,
  shared scores, verification, phone checklist, and release-QA handoff.
- `PHASE_7_COSMIC_FOUNDATION.md`: upper landmark map, extended route contract,
  temporary art, deterministic verification, phone checklist, and Phase 8 art
  handoff.
- `PHASE_9_UPPER_COSMOS.md`: upper background/ambience chapters, presentation
  polish, verification, and phone checklist.
- `PHASE_10_RELEASE_CANDIDATE.md`: release identity, full-climb balance
  evidence, offline/package design, verification, and final device checklist.

## Build the production release

From `html-remake/`:

```bash
npm run build
npm run audit
```

The deployable output is `../release/over-the-moon/`. Serve that directory as
the web root and open `/html-remake/`. Production hosting should use HTTPS so
the offline service worker and installed-app cache are available.

## Regenerate the source baseline

From the repository root:

```bash
SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy \
PYTHONPYCACHEPREFIX=/tmp/jump-over-the-moon-pycache \
python3 html-remake/reference/capture_reference.py \
  --profile-frames 300 \
  --screenshots-dir html-remake/reference/screenshots/native \
  --output html-remake/reference/reference.json
```

The performance numbers use Pygame's dummy video driver. They are useful for
relative workload comparisons, not as claims about browser or GPU frame rates.

## Run the current native shell

Serve the repository root so the rebuild can reuse the existing Pygame assets:

```bash
python3 -m http.server 5173
```

Then open:

```text
http://127.0.0.1:5173/html-remake/
```

Do not open `index.html` directly from Finder, Codex's file preview, iCloud Drive,
or the iPhone Files app. The rebuild uses JavaScript modules and shared assets, so
it must be opened through an HTTP server. A direct file preview will show an
unstyled white page with `Loading Over the Moon.` and will never start.

### Test on a phone

Keep the Mac and phone on the same Wi-Fi network, then start a network-visible
server from the repository root:

```bash
python3 -m http.server 5173 --bind 0.0.0.0
```

Find the Mac's Wi-Fi IP address and open this URL in the phone's browser, replacing
`MAC_IP` with that address:

```text
http://MAC_IP:5173/html-remake/
```

Keep the Terminal window running during the test. If macOS asks whether Python may
accept incoming connections, allow it for the local-network test.

### Release-candidate DEV controls

Append `?dev=1` to the phone URL to reveal the Phase 7 landmark-jump panel:

```text
http://MAC_IP:5173/html-remake/?dev=1
```

Tap `DEV`, choose a destination, and tap `WARP 3 BALLOONS BELOW`. Every warp
starts a fresh test run on the playable route beneath that landmark. Dev mode
is remembered on that device so the controls also remain available in an
installed Home Screen app. Open the URL with `?dev=0` to hide them again.

The current Phase 10 production release validates:

- Full-viewport phone sizing.
- A centered desktop stage capped at 500 CSS pixels.
- Dynamic logical height with a fixed 540-unit logical width.
- DPR caps and initial device-quality selection.
- Safe-area plumbing and portrait-orientation blocking.
- Asset preloading and failure reporting.
- Desktop/tablet `F`/`Esc` fullscreen behavior.
- iPhone Add-to-Home-Screen guidance inside `HOW TO PLAY`.
- A fixed 60 Hz simulation clock with bounded frame recovery.
- Visibility suspension, frame metrics, and adaptive DPR quality.
- A user-gesture start flow that unlocks native Web Audio.
- A clean splash menu containing only `OVER THE MOON`, `HOW TO PLAY`,
  `LEADERBOARD`, and the sound control, with no visible phase/debug copy.
- A read-only leaderboard reachable before a run, while post-run initials and
  submission remain isolated to the results flow.
- Keyboard and multi-touch movement with contextual jump/slash input.
- A fresh seeded route on every run using red, yellow, green, and blue main/side
  balloons with bounded spacing and drift.
- Fifteen altitude landmarks with empty sprite clearance bands and one
  reachable approach balloon below each.
- Pluto, Kuiper Belt Object, Heliopause, Voyager 1, Oort Cloud Comet, Proxima
  Centauri, and Black Hole milestones between 8,600 m and 18,500 m.
- Individually approved transparent production sprites for all seven upper
  milestones, with code-native silhouettes retained only as load fallbacks.
- Endless route generation above the black hole with the same bounded
  42-balloon active-state ceiling.
- Compact chunked history for the full generated climb, with only nearby
  balloons rehydrated into a rolling active window capped at 42.
- Sword collision from above, pop feedback, bounce physics, landing, horizontal
  wrapping, and camera tracking.
- A floor that is safe before the first pop and fatal after it, followed by a
  keyboard/touch retry loop.
- Raised tall-phone ground framing that keeps the starting cow fully above the
  touch controls without changing desktop framing or gameplay geometry.
- Run height plus a locally persisted best height.
- A second same-color pop with a 1.25×-height `match!` bounce and third/later
  same-color pops with a 1.75×-height `combo!` bounce.
- Smooth lower-atmosphere/space progression followed by five distinct
  upper-cosmos chapters: Kuiper Belt, Heliopause, Interstellar Space, Proxima
  Region, and Black Hole Region.
- The existing re-entry trail after a fall of at least 220 meters while above
  900 meters and moving downward at 700+ world units per second.
- A release-tuned altitude speed ramp across movement, gravity, dive, balloon
  and landmark bounce, and balloon wobble, reaching 2× at Neptune (7,320 m).
- Rare seeded shooting stars beginning at 900 meters without altering route
  generation.
- Native three-character initials input directly on the leaderboard, with
  blocked-name feedback and one-tap submission.
- A shared top-ten leaderboard with cached reads and a persistent local queue
  when Firebase is unavailable.
- A results-first death splash with peak height, balloons, best color streak,
  and flight time; initials entry begins only after choosing
  `VIEW LEADERBOARD`, where `RUN AGAIN` remains immediately available.
- A streamlined live HUD with height/local best always visible, no persistent
  pop total, and a color badge beginning only with a second matching pop.
- A smaller off-white distant bird with a faster full wingbeat, plus the
  existing high-altitude bobbing saucer.
- Generated UI, jump, slash, pop, bounce, landing, game-over, and retry sound
  effects plus match, combo, and landmark cues with persistent
  mute/effects/ambience settings.
- A quiet synthesized mouth-style balloon pop in place of the earlier recorded
  playback.
- A quiet altitude-adaptive ambience bed that shifts from filtered air to a
  subtle space hum, evolves across the five upper-cosmos chapters, and fades
  down after game over.
- Cached soft cosmic haze in place of the former straight nebula ribbons,
  Heliopause linework, and complete Black Hole rings.
- `window.advanceTime(ms)` and `window.render_game_to_text()`.
