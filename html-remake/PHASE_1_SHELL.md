# Phase 1 — Responsive Browser Shell

## Status

Phase 1 is complete. The native rebuild now has a responsive single-canvas shell
that loads the existing game art without changing the Pygame game, Pygbag exports,
or source assets.

Gameplay and audio are intentionally not implemented in this phase. The shell
reports both as `false` through `window.render_game_to_text()` so later test runs
cannot mistake presentation scaffolding for a playable build.

## Architecture

- `index.html` owns the canvas, fullscreen control, rotate overlay, accessibility
  status, viewport metadata, and module entry point.
- `styles.css` owns full-viewport mobile layout, desktop framing, safe-area
  placement, dynamic viewport height, and landscape-phone presentation.
- `src/config.js` owns logical dimensions, quality profiles, and the native asset
  manifest.
- `src/assets.js` preloads and decodes images with progress and failure reporting.
- `src/layout.js` converts CSS stage dimensions into a fixed 540-unit logical width,
  adaptive logical height, and capped-DPR backing buffer.
- `src/renderer.js` draws the Phase 1 shell entirely into the canvas.
- `src/main.js` coordinates loading, rendering, fullscreen, layout updates, and
  deterministic browser-test hooks.

## Display contract implemented

- Portrait phones and touch tablets use the complete visible viewport.
- Logical width is always 540 units.
- Logical height is `round(540 × CSS height / CSS width)`.
- Fine-pointer desktop windows at least 700 pixels wide and 4:3 or wider center a
  portrait stage capped at 500 CSS pixels. The stage shrinks when viewport height
  is the limiting dimension.
- Canvas backing size follows CSS size multiplied by the selected quality profile's
  capped device-pixel ratio.
- `visualViewport` resize and scroll events, window resize, orientation change, and
  fullscreen change all trigger a fresh measurement without reloading.
- Safe-area values are exposed to both the DOM controls and canvas renderer.
- Coarse-pointer landscape devices receive a portrait-rotation overlay.
- The fullscreen control and `F` shortcut toggle browser fullscreen. Native Escape
  behavior remains available for leaving fullscreen.

## Deterministic test interface

`window.render_game_to_text()` returns JSON containing:

- phase and loading mode;
- viewport, CSS stage, logical canvas, backing-buffer, DPR, and safe-area values;
- desktop-frame, orientation-block, and fullscreen state;
- quality selection and asset progress/failures;
- explicit gameplay/audio implementation flags and the latest shell error.

`window.advanceTime(ms)` advances shell time and renders synchronously. Phase 2 can
preserve this interface while adding fixed-step simulation.

## Verification

The browser shell was served locally and exercised through Playwright. All 18
manifest images decoded and all tested pages reported zero console/page errors.

| Profile | Viewport | Stage CSS | Logical canvas | Result |
| --- | ---: | ---: | ---: | --- |
| Compact phone | 375 × 667 | 375 × 667 | 540 × 960 | Full viewport |
| Phone | 390 × 844 | 390 × 844 | 540 × 1169 | Full viewport |
| Tall phone | 430 × 932 | 430 × 932 | 540 × 1170 | Full viewport |
| Touch tablet | 768 × 1024 | 768 × 1024 | 540 × 720 | Full viewport |
| Desktop | 1440 × 900 | 500 × 868 | 540 × 937 | Centered/capped |
| Landscape phone | 844 × 390 | 844 × 390 | 540 × 250 | Rotate overlay |

Visual inspection confirmed that the splash artwork remains undistorted and the
title, cow, shell panel, fullscreen control, desktop frame, and rotate overlay stay
legible at each viewport. Automated interaction also verified fullscreen entry by
button, entry/exit with `F`, and deterministic `advanceTime()` execution.

## Phase 2 handoff

Phase 2 should add the performance/runtime foundation: a fixed 60 Hz simulation
clock, accumulator with a bounded catch-up budget, interpolation-ready rendering,
visibility pause/resume behavior, live frame timing, and runtime quality
adaptation. It should keep Phase 1's display contract and test interface intact.

## Post-phase iPhone cleanup

The Phase 2 implementation adds a portrait Home Screen manifest and replaces the
unsupported iPhone element-fullscreen call with `APP MODE` instructions. Supported
desktop/tablet browsers retain the fullscreen control and `F` shortcut.
