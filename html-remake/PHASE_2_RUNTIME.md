# Phase 2 — Runtime and Performance Foundation

## Status

Phase 2 is complete. The native rebuild now has a deterministic fixed-step game
clock, bounded recovery from slow frames, live frame metrics, visibility
suspension, and adaptive render quality. Gameplay and audio remain deliberately
unimplemented until the first playable slice.

The Phase 1 responsive display contract and browser-test interface remain intact.

## Runtime architecture

`src/runtime.js` owns the browser loop:

- Simulation advances at exactly 60 Hz (`16.666… ms` per update).
- Rendering is scheduled with `requestAnimationFrame`.
- The accumulator exposes an interpolation fraction for later entity rendering.
- A real-time frame delta is capped at 250 ms.
- No more than five fixed updates may run during one rendered frame.
- Excess accumulated time is deliberately discarded and recorded instead of
  causing a spiral of death.
- Deterministic advances may process up to 60 seconds for browser testing without
  using the real-time catch-up limit.
- `visibilitychange` suspends the loop, clears partial accumulated time, and resets
  the frame timestamp. Returning to the page resumes without simulating time spent
  hidden.

`src/performance.js` owns adaptive quality:

- Frame timing uses a rolling 120-frame window.
- The first 60 samples form the warm-up period.
- Metrics include average frame time, 95th-percentile frame time, worst frame,
  estimated FPS, and long-frame count.
- Two sustained pressure windows lower quality one level.
- Four sustained headroom windows raise quality one level.
- An eight-second cooldown prevents rapid quality oscillation.
- Automatic recovery never exceeds the device's initial quality profile.
- LOW, MED, and HIGH alter only the canvas DPR cap. Logical coordinates, timing,
  physics, and input mapping remain unchanged.

`src/renderer.js` now caches the static splash backdrop at logical resolution.
The 3-megapixel source image is cropped, scaled, and shaded only when the layout
changes instead of being resampled during every animation frame.

## iPhone app mode cleanup

iPhone Safari does not reliably support element fullscreen for an HTML game.
Phase 2 completes the Phase 1 display cleanup by:

- adding a portrait `fullscreen`/`standalone` Web Application Manifest;
- replacing the dead iPhone fullscreen call with an `APP MODE` instruction;
- explaining Share → Add to Home Screen → launch from the new icon;
- hiding the instruction button after the page is running as a Home Screen app;
- retaining the fullscreen button and `F` shortcut on supported desktop/tablet
  browsers.

## Test and diagnostics interface

`window.render_game_to_text()` now adds:

- runtime status, fixed-step configuration, simulation time, accumulator,
  interpolation, update/render counts, dropped-time counters, visibility state,
  and rolling metrics;
- adaptive-quality state, thresholds, streaks, ceiling, and last change reason;
- fullscreen capability, standalone state, and app-mode guidance state.

`window.advanceTime(ms)` advances the fixed simulation clock. Focused browser tests
also use the `window.__OTM` diagnostics to switch to manual time, inject a frame
stall, suspend/resume, and feed synthetic performance windows.

## Verification

Focused browser assertions passed:

- A deterministic 1,000 ms advance produced exactly 60 updates and exactly
  1,000 ms of simulation time.
- A simulated 500 ms frame ran five catch-up updates, discarded ten additional
  capped updates, and recorded 416.667 ms of total dropped simulation time.
- While suspended, a 1,000 ms deterministic advance produced zero updates.
- Resuming and advancing 1,000 ms produced 60 updates.
- A real `visibilitychange` event entered `suspended` state with reason
  `visibility`, blocked updates, and resumed cleanly.
- Synthetic sustained pressure moved HIGH → MED → LOW.
- Synthetic sustained headroom recovered LOW → MED after the cooldown.
- On a 3× DPR viewport, quality changes produced DPR caps of 1.5, 1.15, and 2.0
  while the 540-unit logical coordinate system remained unchanged.

The complete six-viewport Phase 1 matrix was rerun. Phone, tablet, desktop,
landscape rotation, desktop fullscreen, iPhone app-mode instructions, simulated
installed-app mode, all 18 shared images, and the manifest passed with zero console
or page errors. Final screenshots were visually inspected.

Headless Chromium uses software rendering and the test client intentionally blocks
the page while reading canvas screenshots. Its displayed FPS is therefore useful
for exercising adaptive-quality behavior, not as a device-performance benchmark.

## Phase 3 handoff

Phase 3 should create the first playable native slice:

- start/menu state and explicit user gesture;
- input abstraction for keyboard and touch;
- cow movement, edge wrapping, jumping, airborne downslash, and landing;
- one deterministic balloon encounter with collision and bounce;
- camera-ready world coordinates;
- native Web Audio unlock plus the first jump, slash, pop, bounce, landing, and UI
  effects;
- deterministic gameplay state in `render_game_to_text()`.

This slice should preserve the Phase 0 physics constants and run entirely on the
Phase 2 fixed-step clock.
