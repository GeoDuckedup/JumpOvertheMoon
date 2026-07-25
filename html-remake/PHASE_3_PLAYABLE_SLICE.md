# Phase 3 — First Playable Slice

Completed July 23, 2026.

## Outcome

The native HTML rebuild is now playable. A run begins from an explicit Start
gesture, the cow can move, wrap, jump, downslash, pop one deterministic balloon
from above, bounce, and land, and the camera follows the climb. Keyboard and touch
controls drive the same fixed-step simulation.

Phase 3 also adds the first native browser sound pass. Start unlocks Web Audio,
and UI, jump, slash, balloon-pop, bounce, and landing events have sound effects.

The Pygame source, Pygbag exports, and shared image assets remain unchanged.

## Implementation

- `src/game-config.js` records the protected Phase 0 gameplay constants used by
  this slice.
- `src/game.js` owns the menu/play state, cow physics, sword collision, balloon
  state, bounce, horizontal wrapping, camera, height, and pop effects.
- `src/input.js` combines keyboard and multi-pointer touch input into one
  directional state plus a queued contextual action. Directional pointers follow
  the finger across the left/right buttons without requiring a lift.
- `src/audio.js` owns lazy Web Audio creation, synthesized and recorded effects,
  effects and ambience buses, persistent settings, visibility suspension, and a
  bounded 16-voice pool.
- `src/renderer.js` now draws the gameplay sky, floor, balloon, cow sprites, pop
  burst, score HUD, and desktop instructions while retaining the cached menu
  splash.
- `src/main.js` wires gameplay, input, audio, fixed-step timing, adaptive quality,
  responsive layout, fullscreen/app mode, and browser-test state together.

## Controls

Desktop:

- Left/Right arrows: move.
- Space on the ground: jump.
- Space in the air: slash downward.
- `F`: enter/exit supported desktop fullscreen.
- Sound button: mute/unmute.

Phone and touch tablet:

- Hold the left/right buttons to move.
- Slide a held directional finger between left and right to steer continuously;
  the active button and movement direction switch under the finger.
- Tap `JUMP` from the ground.
- Tap `SLASH` while airborne and above the balloon.
- On iPhone, `APP MODE` explains how to use Add to Home Screen for the
  full-screen standalone presentation.

## Preserved gameplay contract

The first slice runs at a fixed 60 Hz and uses the reference values:

- gravity `1550`;
- movement acceleration `2400` and maximum horizontal speed `360`;
- ground jump speed `860`;
- balloon bounce speed `920`;
- slash duration `0.28 s`, windup ratio `0.38`, and dive speed `560`;
- hit pause `0.055 s`;
- player collision body `38 x 46`;
- horizontal wrap padding `38`;
- camera follow thresholds at `38%` and `64%` of the logical viewport.

The sword uses a swept segment against the balloon circle plus the reference
padding. The balloon must be below the cow, so a slash from underneath is
rejected.

## Audio contract

Audio is created only after Start or a sound-button gesture, which satisfies
mobile browser autoplay rules. UI, movement, and sword effects are synthesized
with oscillators and short noise buffers. Balloon pop uses a small decoded WAV
recording because physical-phone review showed that synthesis was not reading as
a real latex balloon.

The sound system provides:

- UI, jump, slash, balloon-pop, bounce, and landing effects;
- persistent mute, effects-volume, and ambience-volume settings;
- separate effects and ambience buses for future music/atmosphere;
- suspension while the page is hidden and resume when visible;
- a maximum of 16 active source voices.

The ambience bus is ready, but Phase 3 does not yet play a continuous ambience
loop.

After physical-phone review, slash was retuned to a descending filtered-noise
sweep without the former sawtooth tone, producing an air/sword swish. Three
synthesized balloon attempts read as bubble-like or effect-like instead of a
convincing pop. The current effect uses a real CC0 balloon recording, played at
reduced gain through a gentle low-pass filter for a mellow result. A final phone
tuning pass reduced that gain by another 25% and moved the cutoff from 4.8 kHz to
3.2 kHz to soften the crack without removing the recorded pop transient. A final
requested mix adjustment then halved the pop gain from `0.24` to `0.12`. The jump
and accepted sword sounds were intentionally left unchanged.

## Responsive display

The Phase 1 and 2 display contract is unchanged:

- phones fill the visible viewport and derive logical height from their aspect
  ratio;
- desktop remains centered at a fixed maximum width of 500 CSS pixels, shrinking
  only when the window height requires it;
- touch landscape receives the rotate-to-portrait overlay;
- safe-area padding, iPhone app mode, desktop fullscreen, and capped-DPR quality
  profiles remain active.

## Deterministic state and test hooks

`window.render_game_to_text()` reports the complete gameplay, input, audio,
runtime, quality, asset, layout, and display state. The object includes explicit
Phase 3 slice limits so later features are not mistaken for implemented systems.

`window.advanceTime(ms)` and `window.__OTM` expose deterministic stepping and
scoped debug controls for browser verification.

## Verification

The final pass included:

- JavaScript syntax checks for every module;
- the required web-game client using real Space key events to jump, slash, pop,
  and bounce;
- a browser regression suite covering desktop keyboard movement, edge wrapping,
  upward camera tracking, above-hit success, below-hit rejection, landing, and
  generated audio event counts;
- Web Audio unlock, running/suspended/resumed state, persistent mute, and the
  16-voice limit;
- 1440x900 desktop play at a 500-pixel stage width;
- 390x844 iPhone viewport fill, touch movement, touch jump/slash, APP MODE
  open/close, continuous left-right-left swipe steering, and pop audio;
- simulated installed iPhone mode with APP MODE hidden;
- 844x390 touch landscape rotation blocking;
- desktop fullscreen enter/exit;
- visual inspection of desktop menu, desktop pop, phone menu, phone gameplay, and
  touch-landscape captures.

All 18 shared image assets and the recorded balloon-pop asset loaded. The final
web-game client and browser suite reported zero console or page errors.

Headless Chromium timing while screenshots are being read is not a device FPS
benchmark. Gameplay correctness is tied to the fixed 60 Hz simulation, and the
existing adaptive DPR system remains responsible for sustained render pressure.

## Deliberate Phase 3 limits

This is a focused vertical slice, not yet the endless game:

- one deterministic red balloon;
- no generated main/side balloon route;
- no landmark progression;
- no match/combo color rewards;
- no fatal fall, game-over, or retry loop;
- no final scoring, local best, or shared leaderboard;
- no continuous ambience/music layer.

## Phase 4 handoff

Phase 4 should turn the slice into a short complete run:

1. Add bounded/cullable multi-balloon route generation using all four active
   colors while preserving reachable spacing and landmark clearance rules.
2. Add the fatal-floor, game-over, and retry loop.
3. Track run height and local best without wiring the shared leaderboard yet.
4. Extend browser tests to generated-route reachability, bounded entity counts,
   restart cleanup, and game-over input on keyboard and touch.
