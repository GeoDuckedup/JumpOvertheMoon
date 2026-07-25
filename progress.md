Original prompt: phase 1

## Notes

- Phase 1 is the safe-random balloon foundation before adding color combo gameplay.
- Balloons now use a per-run RNG so fresh starts and `R` restarts produce different routes and color sequences.
- Clouds and stars use local fixed-seed RNG instances so the background stays stable without forcing balloon layouts to repeat.
- Balloon x positions drift from the previous target by a bounded amount, and skipped milestone bands re-anchor the route at the milestone center.
- Verified 40 generated resets: all had unique early balloon layouts and unique color sequences, no balloons appeared inside milestone clearance bands, and no balloon-to-balloon route step exceeded the safe drift allowance.
- Rebuilt the pygbag browser export into `docs/` and `web/`.
- Phase 2 added color-aware balloon generation. The generator schedules occasional same-color triples as future bonus opportunities, allows natural two-balloon repeats, and prevents uncontrolled accidental triples so combo chances stay readable.
- Verified 80 generated resets: unique layouts/colors, at least one same-color triple opportunity in each opening route, no 4+ same-color chains, no route drift violations, and no landmark clearance violations. A deeper 65-balloon check averaged about five triple opportunities per run.
- Rebuilt the pygbag browser export again after phase 2.
- Revised phase 1 into a hybrid balloon layout. Each spawn step still creates one safe `main` route balloon, and now can add an optional `side` balloon nearby with a stronger left/right offset and small vertical jitter. Side balloons do not update the main route anchor, so they can create choices without becoming required.
- Verified 80 hybrid resets: unique layouts, main route stayed within safe drift limits, every run had side balloons, side balloons respected their offset/jitter rules, and no balloon appeared inside milestone clearance bands.
- Rebuilt the pygbag browser export after the hybrid layout change.
- Revised phase 2 into combo opportunity patterns for the hybrid layout. Scheduled patterns can force a side balloon as either a wrong-color decoy beside a combo route, a same-color side balloon that finishes a streak while the main balloon is wrong, or a same-color middle detour.
- Verified 120 generated resets: every run had at least one side-balloon combo opportunity, all three opportunity types appeared, main-route reachability stayed clean, side-balloon spacing stayed valid, and no balloons appeared inside milestone clearance bands.
- Rebuilt the pygbag browser export after combo opportunity pattern changes.
- Added guaranteed landmark approach balloons. When generation enters a landmark clearance band, it now adds one clean main-route balloon just below the band and near the landmark center before re-anchoring the route.
- Verified 120 generated runs: every landmark had a close centered approach balloon below its clearance band, and no balloons appeared inside milestone clearance bands.
- Phase 3 added the active combo mechanic. Only popped balloon colors count; skipped balloons and landmarks do not reset the streak. The third same-color balloon consumes the streak and uses a physics-correct `sqrt(3)` speed boost for roughly 3x jump height.
- Verified phase 3 with `py_compile`, focused combo-state tests, and a fresh pygbag web rebuild into `docs/` and `web/`.
- Tuned the combo boost down from roughly 3x jump height to roughly 2x jump height.
- Phase 4 added combo feedback: HUD streak text with the active color, boosted pop particles, and a floating `2x!` callout at the boosted balloon.
- Verified phase 4 with `py_compile`, a combo-state/render smoke test, and a fresh pygbag web rebuild into `docs/` and `web/`.
- Phase 5 tuning: kept the 2x combo boost, reduced optional side balloon chance from `0.42` to `0.35`, delayed the first combo opportunity gap from `3-6` to `5-9`, and spaced out repeat combo opportunities by increasing the repeat gap from `7-13` to `11-18`.
- Verified phase 5 with `py_compile` and 120 generated runs: opening side balloon average dropped, opening combo patterns are no longer guaranteed immediately, landmark approach balloons still appear, and no balloons appeared inside milestone clearance bands. Rebuilt `docs/` and `web/`.
- Changed combo behavior so the 3rd same-color pop and every continued same-color pop get a roughly 1.5x-height boost until the streak breaks. The pop callout now says `combo!` instead of `2x!`.
- Verified sustained combo behavior: same-color hit sequence is `[False, False, True, True, True]`, different color resets the streak, combo speed uses `sqrt(1.5)`, render smoke passed, and web export rebuilt.
- Added a prop-plane milestone before the space station. The prop plane uses the old 190m slot, the space station and planets shift upward, and Neptune now sits at 2400m.
- Replaced the rough procedural plane with an image-generated realistic red high-wing prop plane cutout. The asset is `goal_airplane.png`, 320x127 with a real alpha channel.
- Retuned existing milestone spacing so the plane starts at 380m and landmarks are spaced farther apart: 380, 700, 1060, 1460, 1890, 2340, 2820, 3330.
- Verified retuned milestones with `py_compile` and 80 generated runs: strict height ordering, sprites load, approach balloons still appear, no clearance violations. Rebuilt `docs/` and `web/`.

## TODO

- Phase 5 should be a feel pass: tune combo frequency, optional side-balloon density, landmark approach distance, and whether the 2x boost should be stronger/weaker.

## Refactor Notes

- Refactor phase 1 added `cat-sword-climb/scripts/refactor_characterization.py` as a repeatable no-behavior-change baseline.
- Baseline fingerprint before splitting `main.py`: `597a69a128638bd6bc910a6b2b62b8d391e34955cdb960dec4844f510e517fba`.
- Baseline checks cover milestone order/assets, seeded balloon layout summaries, combo streak behavior, speed-ramp-off behavior, landmark approach balloons, and clearance-band violations.
- Refactor phase 2 extracted constants/config into `cat-sword-climb/constants.py` and entity/player classes into `cat-sword-climb/entities.py`.
- Phase 2 kept the characterization fingerprint unchanged at `597a69a128638bd6bc910a6b2b62b8d391e34955cdb960dec4844f510e517fba` and the web build completed with the new modules packaged.
- Refactor phase 3 extracted balloon route/color/landmark-approach generation into `cat-sword-climb/balloon_gen.py`.
- Phase 3 kept the characterization fingerprint unchanged at `597a69a128638bd6bc910a6b2b62b8d391e34955cdb960dec4844f510e517fba`; seeded balloon totals, side counts, combo pattern counts, landmark approach balloons, and clearance checks stayed identical. The web build completed with `balloon_gen.py` packaged.
- Refactor phase 4 extracted drawing into `cat-sword-climb/renderer.py`; `Game` now delegates `draw()` to `Renderer` while keeping input, state updates, physics, and collision.
- Phase 4 kept the characterization fingerprint unchanged at `597a69a128638bd6bc910a6b2b62b8d391e34955cdb960dec4844f510e517fba`, passed a dummy-video draw smoke test, and the web build completed with `renderer.py` packaged.
- Refactor phase 5 moved the `Game` orchestrator into `cat-sword-climb/game.py`; `main.py` now launches the game by importing `Game`.
- Phase 5 kept the characterization fingerprint unchanged at `597a69a128638bd6bc910a6b2b62b8d391e34955cdb960dec4844f510e517fba`, passed the dummy-video draw smoke test, and the web build completed with `game.py` packaged.
- Refactor phase 6 cleaned `main.py` into a true entry point only and updated the characterization script to import constants independently of `main.py`.
- Phase 6 kept the characterization fingerprint unchanged at `597a69a128638bd6bc910a6b2b62b8d391e34955cdb960dec4844f510e517fba`, passed `py_compile`, passed the dummy-video draw smoke test, and rebuilt the web export with the final split layout.
- Mobile controls phase 1 added touch/mobile input plumbing and an overlay. Mobile/touch detection auto-enables controls in web builds, and `M` forces the overlay on desktop for testing.
- The mobile overlay uses semi-transparent fat-arrow left/right controls on the bottom-left and a large jump/slash action button on the bottom-right. The action button jumps on ground, slashes in air, and restarts after game-over for mobile playability.
- Verified mobile controls phase 1 with `py_compile`, the refactor characterization fingerprint, a focused mobile-control smoke test, a forced-mobile screenshot, and a fresh web build.
- Tightened mobile detection so desktop web builds do not auto-show the overlay merely because they are running through pygbag. Desktop testing now uses `M`; automatic display requires touch/mobile signals such as touch points, mobile user agent, or coarse pointer.
- Mobile controls phase 2 polished the overlay: action text is contextual (`JUMP`, `SLASH`, or `RETRY`), mobile game-over copy says to tap action, controls have a subtle shadow, and dragging between controls no longer accidentally triggers jump/slash.
- Verified mobile controls phase 2 with `py_compile`, the refactor characterization fingerprint, a focused drag/action smoke test, forced-mobile screenshots for ground and airborne states, and a fresh web build.
- Mobile controls phase 3 hardened the web shell generated by `scripts/prepare_web_build.py`: the exported page now uses a single no-zoom viewport tag, dynamic visual-viewport height sizing, `100dvw`/`100dvh` canvas sizing, fixed/overflow-hidden body layout, disabled selection/callouts, touchmove prevention, and mobile Safari gesture prevention.
- Verified phase 3 with `py_compile`, the refactor characterization fingerprint, a forced-mobile draw smoke test, a fresh web build, and generated HTML inspection for the viewport/touch/visual-viewport rules. A Playwright browser smoke was attempted but skipped because Playwright is not installed in this repo.
- Fixed mobile retry double-input: retry now suppresses immediate follow-up action presses and touch events temporarily suppress synthetic mouse events, preventing the next run from starting with an accidental jump.
- Verified the retry fix with `py_compile`, the refactor characterization fingerprint, a focused retry suppression smoke test, and a fresh web build.
- Color randomness option A removed authored combo scheduling from balloon generation. There are no pending combo steps, forced side balloons, forced side colors, or combo gap timers anymore.
- Side balloon colors are now selected uniformly from all balloon colors. Main-route colors still keep the anti-streak guardrail that prevents 3+ same-color main-route balloons in a row.
- Verified the color randomness change with `py_compile`, updated characterization checks for removed scheduler state and natural side-color match rates, and a fresh web build. New intentional characterization fingerprint: `8fb4f137838464c63e4626cee54a4d1a950ef0a4197658149dfa49b0a5c1fa58`.
- Increased combo reward from 1.5x to 2.0x jump height. `COMBO_BOUNCE_SPEED` still derives from `sqrt(COMBO_BOUNCE_HEIGHT_MULTIPLIER)`, so the combo bounce speed is physics-correct for 2x height.
- Verified the 2x combo tuning with `py_compile`, updated characterization, and a fresh web build. New intentional characterization fingerprint: `4544752b6da365d22af92c97680f375d7d28cae18a045406749c76a109c5f941`.
- Added tiered color rewards: the 2nd same-color balloon gives a 1.25x-height `match!` bounce, while the 3rd and continued same-color balloons give a 2.0x-height `combo!` bounce.
- Verified match/combo tiers with `py_compile`, updated characterization, a focused tier/label draw smoke test, and a fresh web build. New intentional characterization fingerprint: `edb4f003a21af21a01996ddd7422ae02640608c1170697755f9eb17c4fda6f59`.
- Tuned the 3rd+ `combo!` tier from 2.0x down to 1.75x jump height while keeping the 2nd-hit `match!` tier at 1.25x.
- Verified the 1.75x combo tuning with `py_compile`, updated characterization, and a fresh web build. New intentional characterization fingerprint: `f942727eaf3fe1a922d2dbba4e07962c076591febe455ad26670d28035530ee4`.
- Expanded landmark spacing by applying the 33% gap increase three times while keeping the Prop Plane at 380m. New milestones: 380, 1133, 1980, 2921, 3932, 4991, 6120, 7320.
- Verified expanded landmark spacing with `py_compile`, updated characterization, and a fresh web build. New intentional characterization fingerprint: `8eb69e8b2bddcf175dc8dd8187fe035c65a88e98e8723b761d6d57e23096d10d`.
- Added the visual background overhaul. The renderer now blends through altitude chapters for sky, high atmosphere, near space, deep space, and cosmic space, with altitude-aware cloud fade, star density, Earth-horizon glow, and subtle cosmic haze.
- Verified the background overhaul with `py_compile`, the unchanged gameplay characterization fingerprint `8eb69e8b2bddcf175dc8dd8187fe035c65a88e98e8723b761d6d57e23096d10d`, altitude screenshot contact sheets, and a fresh web build.
- Removed the Earth-horizon glow after visual review; near space and deep space now keep the cleaner gradient/star treatment without the blue band.
- Added rare visual-only shooting stars. They use a separate per-run visual RNG, appear only at 900m+, run at most one active streak at a time, and use slower timing from 900-3300m with slightly more frequent timing above 3300m.
- Verified shooting stars with `py_compile`, the unchanged gameplay characterization fingerprint `8eb69e8b2bddcf175dc8dd8187fe035c65a88e98e8723b761d6d57e23096d10d`, forced visual screenshot captures, and a fresh web build.
- Retuned shooting stars to four altitude bands with roughly 15% shorter wait times: 900-1800m every 30-51s, 1800-3300m every 26-45s, 3300-5600m every 21-38s, and 5600m+ every 19-34s. Direction now stays mostly down-left with a 25% chance of down-right streaks.
- Verified the shooting-star retune with `py_compile`, the unchanged gameplay characterization fingerprint, a 400-spawn direction sample near the intended 75/25 split, and a fresh web build.
- Added the web splash screen asset `splash_over_the_moon.png` and updated the pygbag web prep script so `docs/` and `web/` use it as the browser start-screen background. The start/loading prompt boxes no longer show `COW SWORD CLIMB`; the prompt begins with `PRESS SPACEBAR TO START`.
- Verified the splash update with `py_compile`, the unchanged gameplay characterization fingerprint, generated HTML inspection for the splash URL/title removal, and a fresh web build.
- Increased mobile/web controls: left/right arrow buttons from 92x70 to 122x93 (about 33% larger) and the action button from 112x112 to 129x129 (about 15% larger). Verified with `py_compile`, unchanged gameplay characterization fingerprint, a forced mobile-controls screenshot, and a fresh web build.
- Fixed splash visibility after start: the web shell now uses `splash-active` only before media/game start and switches to `game-active` with a plain dark page background during active play, so the splash is not visible behind or around the game canvas. Verified with `py_compile`, unchanged gameplay characterization fingerprint, generated HTML inspection, and a fresh web build.
- Reentry visual phase 1 now uses a latched three-stage fall state instead of a smooth intensity. The stage only progresses upward during a long fast fall (`0 -> 1 -> 2 -> 3`), stays intense until the fall ends, and resets on ground, rising, or bounce.
- Reentry rendering was changed back to the normal `cat_fall.png` cow plus a separate behind-the-cow wind/heat overlay. The generated full-cow reentry frames were removed so there are no transparency artifacts, sprite-size jumps, or unused packaged assets.
- Verified reentry with `py_compile`, unchanged gameplay characterization fingerprint, a focused monotonic-stage smoke test, a forced stage contact sheet, and a fresh web build that no longer packages `cat_fall_reentry_*` assets.
- Prepared static reentry overlay art assets only, without wiring them into gameplay yet: `reentry_overlay_light.png`, `reentry_overlay_medium.png`, and `reentry_overlay_intense.png`. The raw imagegen files came back RGB on a light matte, so the project copies were converted into true RGBA overlays and previewed on dark/light backgrounds.
- Wired the static RGBA reentry overlays into the existing latched stage logic. The renderer now blits `reentry_overlay_light/medium/intense.png` behind the normal fall cow sprite, replacing the Python-drawn reentry lines and keeping cow scale/transparency stable.
- Verified the static-overlay implementation with `py_compile`, unchanged gameplay characterization fingerprint, RGBA asset checks, an in-game forced stage contact sheet, and a fresh web build that packages the overlay assets.
- Regenerated the medium/intense reentry overlays on chroma green so extraction is more reliable. The new assets keep the stage 1 vertical-speed-line language instead of the older horseshoe shape, were keyed/despilled into RGBA, previewed in-game, and rebuilt into the web export.
- Created test-only full-cow reentry frames on chroma green (`cat_fall_reentry_test_light/medium/intense.png`) and keyed them into RGBA for visual evaluation only. These are not wired into gameplay.
- Reentry experiment switched to a two-phase full-cow setup: `cat_fall_reentry_light.png` and `cat_fall_reentry_intense.png` are loaded at runtime, the medium frame and old overlay assets were removed, and the renderer crossfades from light to intense during a long fall.
- Verified the two-phase full-cow reentry test with `py_compile`, unchanged gameplay characterization fingerprint, RGBA asset checks, a forced blend contact sheet, and a fresh web build packaging only the two full-cow reentry frames.
- Added a temporary debug shortcut: pressing `T` jumps the cow to about 2000m altitude with zero velocity, resets reentry state, centers the camera, and pre-spawns balloons so reentry can be tested quickly.
- Simplified reentry back to the small trail only. Full-body reentry sprites, medium/intense phases, and crossfade code were removed; the game now draws a single `reentry_trail_light.png` behind the normal fall cow after a long fast fall.
- Fixed desktop splash cropping by switching the splash background to `contain` only on wide screens while keeping the existing portrait/mobile `cover` behavior. Verified with desktop and mobile Playwright screenshots after rebuilding the web export.
- High-score phase 1 documented the Firebase Realtime Database setup for the planned shared leaderboard: `/jumpoverthemoon/scores`, scoped read/create-only rules with validation, endpoint testing instructions, and local desktop cache ignores for future implementation.
- High-score phase 2 added `cat-sword-climb/highscore.py`, a standalone Firebase/local-cache service using desktop `urllib` and a pygbag browser `fetch` bridge. Verified with `py_compile`, a mocked refresh/submit/cache smoke test, and a read-only live Firebase endpoint check returning `null`.
- High-score phase 3 added `cat-sword-climb/name_entry.py`, a standalone three-character arcade initials state machine for keyboard and mobile wiring. Verified sanitization, letter wrapping, advance/backspace behavior, and done-state locking with `py_compile` and a focused smoke test.
- High-score phase 4 wired high-score state into `Game`: game-over now starts a forced leaderboard refresh, opens initials entry for new local/likely top-10 scores, submits once after initials are confirmed, and maps keyboard/mobile action controls into the entry flow. Added a temporary renderer overlay/action label so Phase 4 remains playable before the full leaderboard UI. Verified with `py_compile` and a dummy-video game-over/name-entry smoke test.
- High-score phase 5 replaced the temporary game-over overlay with a structured initials/leaderboard panel. The renderer now shows top climbers, local best, Firebase status text, highlighted local entries, desktop/mobile instructions, and the mobile action button changes to `ENTER` during name entry. Verified with `py_compile`, a dummy-video render smoke for entry and leaderboard states, and the unchanged gameplay characterization fingerprint `8eb69e8b2bddcf175dc8dd8187fe035c65a88e98e8723b761d6d57e23096d10d`.
- High-score phase 6 rebuilt the pygbag web export into `docs/` and `web/`, verified the packaged bundle includes `highscore.py` and `name_entry.py`, loaded the rebuilt page through a local HTTP server, confirmed the game starts in the browser without the splash leaking into gameplay, performed a live Firebase REST write/read smoke with a tiny `TST` 1m score, and verified mobile name-entry controls with a focused dummy-video input smoke.
- High-score phase 7 cleanup removed the overlapping `your best` leaderboard footer, added the Bartender blocked-initials list, added a post-initials `SUBMIT`/`REDO` confirmation state, flashes invalid blocked initials instead of submitting, and added a name-entry action debounce that also prevents the final confirm tap from falling through as retry. Verified with `py_compile`, name-entry confirm/blocked tests, mobile duplicate-action smoke, renderer smoke, unchanged characterization fingerprint, and a fresh web build.
- Balloon color tuning removed purple from active balloon colors and made main-route colors pure random, matching side balloons. The active set is now red/yellow/green/blue, with no main-route repeat guardrail or forced repeat chance. Verified with `py_compile`, a 4-color render smoke, characterization, and a fresh web build. New intentional characterization fingerprint: `fd5e6dd79d43298cd9c592c362c9c4a92bff0b532536c0f5049a29ed70d97546`.
- Fixed Safari/pygbag desktop name-entry arrows by adding a `pygame.key.get_pressed()` edge fallback while initials entry is active. `KEYDOWN` still handles browsers/desktops where it works, and the fallback seeds handled arrow keys to avoid double-cycling. Verified with `py_compile`, an arrow-edge smoke test, real `get_pressed()` dummy check, unchanged characterization fingerprint, and a fresh web build.

## Native HTML Rebuild

- Phase 0 established `html-remake/` without changing the Pygame source, Pygbag
  exports, or existing assets.
- Added `html-remake/PHASE_0_BASELINE.md` as the human-readable behavior, responsive
  display, audio, performance-risk, and verification contract for the rebuild.
- Added `html-remake/reference/capture_reference.py`, which records the source
  revision, exact gameplay constants, controls, collision assumptions, milestones,
  seeded generation characterization, asset dimensions/hashes, release artifact
  sizes, responsive requirements, audio requirements, and indicative native
  dummy-driver frame work.
- Generated `html-remake/reference/reference.json` from commit
  `4d7ac92211d1d20d747f19cb1e3803bc7592a5d4`. The protected gameplay
  characterization fingerprint remains
  `fd5e6dd79d43298cd9c592c362c9c4a92bff0b532536c0f5049a29ed70d97546`.
- Captured and visually inspected deterministic native screenshots at 0 m, 900 m,
  3300 m, and 5600 m, plus browser captures of the Pygbag splash and active ground
  scene.
- The Pygbag browser baseline reaches active gameplay and currently emits two
  recorded console messages: `** MEDIA USER ACTION REQUIRED [1] **` and
  `PyMain: BrowserFS not found`.
- Indicative 300-frame native dummy-driver samples measured about 0.83 ms of work
  per ground frame with 20 retained balloons and about 2.08 ms at the 5000 m
  setup with 456 retained balloons. These are relative workload observations, not
  browser FPS claims.
- Verified Phase 0 with full Python compilation, the characterization script, JSON
  contract assertions, Playwright browser captures, visual screenshot inspection,
  and confirmation that `cat-sword-climb/`, `docs/`, and `web/` have no diffs.
- Phase 1 added the native single-canvas shell under `html-remake/` with a fixed
  540-unit logical width, viewport-derived logical height, capped-DPR backing
  buffer, shared native-asset preloader, canvas splash renderer, safe-area
  plumbing, fullscreen control/shortcut, and deterministic browser-test hooks.
- Phone and touch-tablet layouts fill the visible viewport. Fine-pointer desktop
  layouts are centered and capped at 500 CSS pixels wide, shrinking only when
  viewport height requires it. Landscape touch devices receive a rotate-to-portrait
  overlay.
- Verified Phase 1 at 375x667, 390x844, 430x932, 768x1024, 1440x900, and 844x390.
  All 18 image assets decoded; the viewport matrix, fullscreen button, `F`
  enter/exit shortcut, and `advanceTime()` passed with no console or page errors.
  Final screenshots were visually inspected at each layout.
- Added `html-remake/PHASE_1_SHELL.md` as the architecture, display-contract,
  verification, and Phase 2 handoff record. Gameplay and audio remain explicitly
  unimplemented at this shell-only milestone.
- Phone review exposed a launch-instructions issue: opening `html-remake/index.html`
  through a raw file preview loads only the HTML and produces an unstyled white
  `Loading Over the Moon.` page because the stylesheet, JavaScript modules, and
  shared assets are unavailable. Updated the README with explicit local HTTP and
  same-Wi-Fi phone instructions. Reverified the complete server path, all 18
  assets, rendered canvas, and zero browser errors.
- Phase 1 iPhone cleanup added a portrait fullscreen/standalone web manifest and
  an `APP MODE` instruction overlay. iPhone no longer invokes its unsupported
  element-fullscreen path; it explains Share -> Add to Home Screen instead. The
  control hides once standalone mode is detected, while desktop/tablet fullscreen
  and the `F` shortcut remain active.
- Phase 2 added `html-remake/src/runtime.js`: a fixed 60 Hz accumulator loop,
  250 ms real-frame cap, five-step catch-up ceiling, explicit excess-time
  accounting, interpolation output, deterministic advance path, rolling frame
  metrics, and visibility suspension/resume without hidden-tab catch-up.
- Added `html-remake/src/performance.js`: sustained-pressure quality downgrades,
  sustained-headroom recovery, eight-second anti-oscillation cooldown, and an
  initial device-profile ceiling. LOW/MED/HIGH change only DPR caps.
- Cached the static splash backdrop at logical resolution so the 3-megapixel
  source image is cropped/scaled only after asset or layout changes instead of
  during every rendered frame.
- Verified Phase 2 deterministic timing (60 updates per second), bounded 500 ms
  stall handling (five updates plus recorded discarded time), test and real
  visibility suspension, HIGH -> MED -> LOW pressure response, LOW -> MED
  recovery, DPR backing-buffer changes without logical-coordinate changes,
  desktop fullscreen, iPhone app-mode open/close, and installed-app control
  hiding.
- Reran and visually inspected the six-viewport matrix at 375x667, 390x844,
  430x932, 768x1024, 1440x900, and 844x390. All 18 assets and the manifest loaded;
  all browser scenarios reported zero console/page errors.
- Added `html-remake/PHASE_2_RUNTIME.md` as the Phase 2 architecture, verification,
  performance caveat, and Phase 3 handoff record. Gameplay and audio remain
  explicitly unimplemented until the first playable slice.
- Phase 3 added the first native HTML playable slice: explicit start flow,
  shared keyboard/multi-touch input, reference cow movement/jump/downslash
  physics, horizontal wrapping, one deterministic balloon collision from above,
  pop/bounce/landing feedback, and camera-ready world coordinates.
- Added native Web Audio with lazy gesture unlock and generated UI, jump, slash,
  balloon-pop, bounce, and landing sounds. Mute plus effects/ambience volume
  persist locally, page visibility suspends/resumes audio, and the source pool is
  bounded at 16 voices.
- Preserved the responsive shell during active play: phone viewport fill,
  desktop 500 CSS-pixel width cap, safe-area controls, iPhone APP MODE,
  installed-app detection, touch-landscape rotation blocking, capped-DPR quality,
  and desktop fullscreen.
- Verified Phase 3 with JavaScript syntax checks, the required web-game client,
  and a real-browser regression suite covering keyboard/touch gameplay, above-hit
  success, below-hit rejection, bounce/landing, wrapping, camera, audio lifecycle
  and persistence, voice bounding, fullscreen, iPhone app mode, installed mode,
  and touch landscape. All 18 assets loaded with zero console/page errors, and
  desktop/mobile captures were visually inspected.
- Added `html-remake/PHASE_3_PLAYABLE_SLICE.md` as the gameplay, audio,
  verification, deliberate-slice-limit, and Phase 4 handoff record.
- Phase 3 phone-review audio tuning replaced the tonal sawtooth sword effect with
  a 190 ms descending filtered-noise swish. The balloon effect now uses a quiet
  rounded sine transient plus a subtle filtered click for a softer bubble pop.
  Jump audio and gameplay timing were left unchanged.
- Reverified the tuned effects through the real jump/slash/pop browser sequence
  and the complete Phase 3 regression suite. Sound-design identifiers, event/play
  counts, audio suspension/resume, persistent mute, and the bounded voice pool
  passed with zero console/page errors; the resulting gameplay frame was visually
  inspected.
- Phase 3 balloon-pop option 3 responds to phone feedback that the soft bubble
  version sounded too watery. Removed the long descending sine and replaced it
  with a dry 42 ms low-passed/high-passed noise snap plus a 38 ms low triangle
  body transient. The accepted sword swish and jump sound are unchanged.
- Reverified option 3 with the required live jump/slash/pop client and the full
  Phase 3 browser suite. The new `dry-mellow-balloon-pop-v3` path played once per
  pop, stayed inside the 16-voice cap, and produced zero console/page errors; the
  final pop frame was visually inspected.
- Phase 3 balloon-pop option 4 abandons synthesis after continued phone feedback
  that option 3 still did not read as a pop. Added a real 0.547-second mono
  balloon recording from OpenGameArt's CC0 Balloon Sounds pack, converted it to a
  48 kHz 16-bit PCM WAV for broad browser support, and documented its source and
  hash under `html-remake/assets/audio/`.
- `GameAudio` now decodes the recorded pop during the existing Start gesture and
  plays it at reduced gain through a 4.8 kHz low-pass filter. The synthesized v3
  effect remains only as a load-failure fallback; accepted jump and sword sounds
  are unchanged.
- Verified option 4 through the required live jump/slash/pop client and the full
  Phase 3 browser suite. The WAV decoded successfully in desktop and phone
  contexts, `recorded-cc0-mellow-balloon-pop-v4` played once, audio asset failures
  stayed empty, voice bounding/lifecycle tests passed, and there were zero
  console/page errors. Final desktop and phone pop frames were visually inspected.
- Softened the accepted recorded balloon pop after phone review: runtime gain
  changed from `0.32` to `0.24` and the low-pass cutoff moved from 4.8 kHz to
  3.2 kHz. The authentic recorded transient remains; jump, sword, and gameplay
  behavior are unchanged.
- Reverified the `recorded-cc0-soft-balloon-pop-v4b` mix with the required live
  pop client and the full desktop/phone audio regression suite. The WAV loaded
  without fallback or errors, sound/event counts matched, and the final phone pop
  frame was visually inspected.
- Reduced only the recorded balloon-pop gain by the requested 50%, from `0.24`
  to `0.12`. The 3.2 kHz filter, recording, jump sound, sword swish, and gameplay
  remain unchanged.
- Reverified `recorded-cc0-soft-balloon-pop-v4c` with the required live pop client
  and the full desktop/phone browser suite. The recording loaded without fallback
  or errors, event/play counts matched, and the final phone pop frame was visually
  inspected.
- Touch-direction controls now follow one held finger across both buttons. A
  pointer that begins on left can slide to right and back repeatedly without
  lifting; input direction and pressed-button visuals switch immediately, while
  jump/slash and other simultaneous pointers remain independent.
- Verified directional swiping in a 390x844 touch context with a continuous
  left -> right -> left pointer sequence. Each switch updated the input snapshot
  and button highlight, reversed cow velocity, and cleared cleanly on release.
  The required gameplay client and full browser suite passed with zero errors, and
  the final phone frame was visually inspected.

## Native HTML Rebuild

- Phase 4 completed the endless native run loop with fresh seeded main/side
  routes using red, yellow, green, and blue balloons. Source spacing, drift,
  radius, optional-side chance, side offset, and side jitter are preserved.
- Added a rolling route lifecycle: generation stays 1,200 world units ahead,
  balloons 900 units below the viewport are culled, and a defensive cap limits
  the active collection to 42 instead of retaining the full climb.
- Added the source floor rule: safe before the first pop, fatal after it. Game
  over records the greatest height, persists a higher local best, and supports
  fresh-seed retry with R, Enter, Space, or the phone action button.
- Added responsive desktop/phone game-over presentation and changed the touch
  action label to RETRY. The 500 CSS-pixel desktop cap, full-phone viewport,
  safe areas, fullscreen/app mode, and swipe steering remain intact.
- Added soft game-over and retry sound cues without changing the accepted jump,
  sword swish, or recorded balloon-pop mix.
- Verified Phase 4 with syntax checks, the required web-game client, and a
  real-browser suite. A 400-seed audit covered 38,876 balloons with 400 unique
  early routes and no spacing, drift, margin, side-placement, color, or
  deterministic-replay failures. Long-climb culling, fatal/safe floor states,
  game over, local persistence, keyboard/touch retry, new seeds, audio, desktop
  sizing, phone fill, and touch swiping passed with zero browser errors.
- Added `html-remake/PHASE_4_RUN_LOOP.md`. Phase 5 should add
  landmark/background progression, route clearance around landmarks, re-entry
  presentation, and color-combo feedback while preserving the bounded route
  lifecycle.
- Phase 5 implementation began by importing the eight reference landmark
  definitions at 380, 1133, 1980, 2921, 3932, 4991, 6120, and 7320 meters.
  Route generation now skips each sprite clearance band, rejects side balloons
  that jitter into one, inserts one centered approach balloon below every band,
  and re-anchors the route at the landmark.
- Added landmark slash collision/bounce/clear state, exact 1.25x-height second
  color match and 1.75x-height third-and-later combo rewards, match/combo
  feedback, six blended background chapters, and the reference long-fall
  re-entry trail state. New landmark/match/combo audio cues use the existing
  bounded effects bus; the accepted jump, sword, and balloon pop are unchanged.
- The required web-game client completed after integration with all 18 image
  assets and the recorded pop loaded, Phase 5 state exposed, and no page error.
  Its active-ground screenshot was visually inspected.
- Phase 5 deterministic audit passed 240 seeds and 159,533 balloons: 240 unique
  early routes, exact replay, all colors, zero landmark clearance violations,
  one valid approach for every landmark in every route, valid side balloons,
  and bounded long-climb state. Landmark collision/bounce, exact match/combo
  speeds and reset, and re-entry latch/reset also passed.
- The expanded Phase 5 headless browser suite could not launch because the local
  browser-automation allowance was exhausted; the in-app browser was separately
  blocked from the local test address. Physical-phone checks remain for
  landmark/background/combo/re-entry visual tuning.
- Added `html-remake/PHASE_5_PROGRESSION.md`. Recommended Phase 6 work is the
  altitude speed ramp, rare shooting stars, final ambience decisions, shared
  score/initials parity, and physical-phone Phase 5 visual tuning.
- Phase 6 core parity is implemented in the HTML remake. The reference
  altitude ramp now scales acceleration, top speed, gravity, slash dive,
  balloon/landmark bounce, and wobble up to 1.7x; the ground jump remains
  unchanged. Rare shooting stars begin at 900m, retain the four reference
  timing bands, and use a separate seeded visual RNG so they cannot change a
  balloon route.
- Added a low-volume adaptive Web Audio ambience bed that shifts from filtered
  air into a subtle space hum with altitude, fades down after game over,
  respects the existing mute/ambience bus, and suspends with the page.
- Added three-character initials entry with submit/redo, blocked-name feedback,
  keyboard and touch/swipe navigation, a Firebase top-ten service, cached
  leaderboard reads, and a persistent offline submission queue. Network score
  writes occur only after the player explicitly confirms SUBMIT.
- Phase 6 deterministic logic audit passes the speed cap/scaled bounce,
  repeatable shooting-star trajectories, initials sanitization and blocked-name
  guard, confirm/redo flow, single submit event, leaderboard normalization, and
  top-ten qualification without performing a network write. The complete Phase
  5 route/mechanics regression still passes all 240 seeds and 159,533 balloons.
- The existing phone server remains live on port 5174 and returns HTTP 200 for
  the Phase 6 page, main module, leaderboard module, and recorded pop. A
  read-only Firebase request returned the current top-score payload; no test
  score was submitted.
- Added `html-remake/PHASE_6_FINAL_PARITY.md` with implementation details,
  verification, the physical-phone checklist, and a Phase 7 release-QA handoff.
- Fixed iPhone Safari long-press magnification on held touch controls by adding
  Safari-specific user-selection, touch-callout, drag, and tap-highlight
  suppression across the game stage and control descendants. Control labels no
  longer receive pointer events, and native drag/select starts are canceled
  without changing pointer hold, release, or left/right swipe routing.
- Added and passed `safari-control-audit.mjs`: held direction, swipe switching,
  release, and context/drag/selection cancellation all pass. The live phone
  server returns HTTP 200 for the updated stylesheet and input module; physical
  Safari long-press confirmation remains for the user.
- Safari standalone/app-mode follow-up removes the selectable arrow and action
  text nodes from the touch buttons. Arrows are now CSS shapes and the dynamic
  action label is generated content. Touch controls use `!important`
  Safari-selection/callout guards, non-passive native touch suppression, and a
  page-level selection cleanup fallback while pointer events remain the source
  of held movement and swipe switching.
- Added a `6.0.2` cache-busting query to the stylesheet, main module, and input
  module so an installed Safari Home Screen app does not keep running the
  earlier control CSS/JavaScript after this fix.
- Fixed the apparent mid-air death freeze. Very fast final falls could leave
  `previousY` hundreds of units above the clamped floor; because game-over
  stops simulation, interpolation kept rendering that stale position. Entering
  game over now snaps previous player/camera state to the landed state.
- Added per-run duration and best-color-streak tracking to the existing peak
  height, balloon, and landmark counts. Game over now opens a results-first
  death splash with those stats and dedicated `VIEW LEADERBOARD` /
  `CLIMB AGAIN` actions, following the attached Endless Powder structure.
  Initials are created only after the player opens the leaderboard; completed
  entry reveals the shared top-ten view with back/results and retry actions.
- Replaced the recorded/fallback balloon playback path with a substantially
  quieter synthesized mouth-pop (`quiet-mouth-pop-v5`): a short low-passed lip
  release, small falling mouth body, and very soft oral resonance. The accepted
  sword and all other effects are unchanged.
- Bumped the served stylesheet and changed gameplay module URLs to `6.1.0` so
  Safari/Home Screen mode fetches the landed-position, sound, and results-flow
  changes instead of retaining the preceding standalone-app cache.
- Leaderboard initials now accept direct desktop typing (`A-Z` / `0-9`) in
  addition to the existing arrows, Backspace, and confirm/redo flow. Typing the
  third character advances to submit confirmation; name-entry typing suppresses
  the normal `F` fullscreen shortcut.
- Phase 6 audit now covers results-before-leaderboard, exposed run stats, direct
  initials typing, and a 30,000-unit/second landing with interpolation at zero;
  the landed cow renders exactly at its clamped floor position. Phase 5’s full
  240-seed/159,533-balloon regression and the Safari hold/swipe audit still pass.
- The live phone server returns the `6.1.0` HTML and HTTP 200 for the versioned
  game, audio, and renderer modules. Physical-phone review remains for the
  mouth-pop timbre/volume and final results-screen spacing.
- Leaderboard entry is now the same inline native-input flow as Endless Powder:
  the rankings remain visible while a real three-character field and
  `SUBMIT RUN` sit above them, with `BACK TO RESULTS` and `CLIMB AGAIN` still
  available below. There is no separate initials screen or submit/redo step.
  Native input focus bypasses gameplay/fullscreen shortcuts, blocked initials
  stay local, and all positive runs may be submitted even below the visible top
  ten. Accepted entries are optimistically inserted into the cached board while
  Firebase saves or queues them offline.
- Bumped changed stylesheet/game/input/leaderboard/renderer entry URLs to
  `6.2.0` for Safari and installed Home Screen cache separation.
- Phase 6 and Phase 5 regressions plus the Safari control/input audit pass after
  the inline form change. The audit now confirms every positive run can be
  submitted, blocked/short names cannot submit, only one score event fires, and
  focused native input is not intercepted by `R`, movement, action, or
  fullscreen shortcuts. The phone server returns the `6.2.0` form HTML and HTTP
  200 for its versioned main, leaderboard, and stylesheet resources.
- Rebuilt the leaderboard presentation after Chrome/Safari phone review. The
  entire leaderboard is now one responsive DOM card containing the run score,
  native initials form, top-ten rows, and both navigation actions. The canvas
  only draws the dimmed game scene behind it, so there is no second leaderboard
  layout underneath and no canvas/DOM coordinate drift.
- Mobile orientation blocking now uses the physical screen orientation rather
  than the keyboard-shortened visual viewport. Focusing an editable control
  explicitly enters a compact keyboard layout and cannot raise the
  rotate-to-portrait overlay.
- Removed the document-wide `selectionchange` cleanup that was disrupting the
  native Safari caret. Selection clearing remains scoped to the held game
  controls, normal initials input no longer rewrites lowercase characters on
  every keystroke, and frequently rendered UI properties are changed only when
  their value actually changes.
- Bumped the served stylesheet/main/layout/input/renderer URLs to `6.3.0`.
  Syntax checks, the Phase 6 audit, the complete Phase 5 240-seed/159,533-balloon
  regression, and the Safari control audit pass. A real Chromium phone audit
  verified the portrait and keyboard-height layouts, focus retention through
  typing and Backspace, physical-orientation stability, ten rendered rankings,
  Run Again without submission, and zero console/page errors. Both generated
  leaderboard screenshots were visually inspected.
- Restored phone testing after the turn-scoped port 5174 process stopped. A
  transient macOS background job named
  `com.openai.codex.overthemoon-preview-5174` now serves an isolated `/tmp`
  preview containing only the HTML runtime and public game assets, rather than
  exposing the repository. Both localhost and `192.168.86.20` returned HTTP
  200, and the required web-game client started the game from the exact LAN URL;
  its state and screenshot were inspected with all 18 assets loaded and no
  reported game error.
- Retuned the altitude speed curve by request. The multiplier is now
  `min(2, 1 + height / 7320)`, reaching 1.25× at 1,830 m, 1.5× at 3,660 m,
  1.75× at 5,490 m, and 2× at Neptune (7,320 m). This replaces the earlier
  curve that capped at 1.7× around 3,640 m, so acceleration is spread across
  twice as much climbing distance while the final section is faster. Ground
  jump remains unchanged.
- Bumped the changed main/game/config/route/renderer module graph to `6.4.0`,
  refreshed the isolated phone preview, and passed syntax checks, the Phase 6
  speed/scaled-bounce audit, the complete Phase 5 240-seed/159,533-balloon
  regression, and the Safari input audit. The required web-game client loaded
  the exact LAN preview URL with `maximumMultiplier: 2`,
  `referenceHeightMeters: 7320`, all 18 assets, and no game error; its gameplay
  screenshot was visually inspected.
- Phase 7 extends the landmark route from eight to fifteen destinations. Added
  Pluto at 8,600 m, Kuiper Belt Object at 10,000 m, Heliopause at 11,500 m,
  Voyager 1 at 13,100 m, Oort Cloud Comet at 14,800 m, Proxima Centauri at
  16,600 m, and Black Hole at 18,500 m.
- Each new landmark now participates in deterministic clearance-band route
  generation, gets exactly one centered approach balloon, can be cleared with
  the existing downslash/bounce mechanic, and uses a distinct code-native
  placeholder silhouette. Generation continues indefinitely above the black
  hole, and the rolling active route remains capped at 42 balloons.
- Results now derive the landmark denominator from game state and display
  `/ 15`. Added `debugJumpToLandmark()` access by ID, exact name, or index, plus
  Phase 7 state describing the total, final height, placeholder-art status, and
  endless continuation.
- Phase 7 passed syntax checks, its focused cosmic audit, the full Phase 6 and
  Safari control regressions, and an extended 240-seed Phase 5 route audit
  covering 401,430 balloons with zero clearance or approach failures. The
  required web-game client loaded all 18 existing assets.
- Captured and visually inspected all seven new landmarks and the `/ 15`
  results card at 390 × 844. The same browser audit passed against the exact
  `http://192.168.86.20:5174/html-remake/` phone preview with all 15 landmarks,
  all 15 generated approaches, phone viewport fill, bounded state, and zero
  console/page errors. Phase 8 can replace the placeholders with final art;
  Phase 9 can add distinct upper-cosmos background chapters.
- Phase 7.1 adds temporary query-gated landmark cheat controls for physical
  review. Opening the game with `?dev=1` reveals a phone-friendly `DEV` button
  and destination panel; the normal URL keeps both hidden. A warp always starts
  a clean run and places the cow immediately above the third main-route balloon
  below the selected landmark, so the remaining approach can be played rather
  than merely viewed.
- The Phase 7.1 logic audit verified the playable warp target for all 15
  landmarks. A real 390 × 844 Chromium flow verified normal-URL hiding, all 15
  selector choices, panel pause/resume, previous/next navigation, fresh-run
  Pluto and black-hole warps, bounded route state, and an immediate successful
  slash/pop from the arrival balloon, with zero console or page errors. The
  panel, Pluto arrival, and black-hole arrival captures were visually inspected.
- Bumped the changed HTML, stylesheet, main module, and game module graph to
  `7.1.0` and refreshed the isolated phone preview. The required web-game client
  loaded `http://192.168.86.20:5174/html-remake/?dev=1` with dev tools enabled,
  all 18 assets, and no game error. The complete interactive smoke then passed
  against that same LAN URL with zero browser errors.
- Dev activation now persists locally after visiting `?dev=1`, allowing the
  iOS Home Screen app to retain the DEV button when its manifest start URL
  drops the query string. Visiting `?dev=0` clears the temporary setting. The
  main entry cache key is `7.1.1`; the final live persistence/disable flow also
  passed with zero browser errors.
- Phase 7.2 restores the old-game descent experience without making the full
  route live at once. Every generated balloon placement is retained in compact
  1,600 px world chunks; ascent and descent rehydrate only the chunks around
  the camera, while collisions and rendering remain capped at 42 active
  balloons. Popped balloon IDs persist separately, so collected balloons never
  respawn during a fall.
- A deterministic black-hole-to-ground stress audit archived 1,708 balloons in
  118 chunks, rehydrated 1,791 nearby entities across 149 descent positions,
  and observed a maximum of 34 active balloons. The same audit confirms a
  popped balloon remains gone and that returning to old altitude does not
  generate a duplicate route.
- The temporary DEV panel now includes a `1× SPEED LOCK` toggle. Enabling it
  bypasses the altitude multiplier and survives fresh landmark-warp runs;
  disabling it immediately restores the normal ramp up to 2×. The game
  snapshot and `window.__OTM.setSpeedRampLocked()` expose the setting for
  deterministic testing.
- Bumped the changed HTML, stylesheet, main, game, route, renderer, and config
  module graph to `7.2.0`, refreshed the isolated port 5174 phone preview, and
  passed syntax checks, the Phase 7 cosmic audit, Phase 6 logic, Safari input,
  and the complete 240-seed / 401,430-balloon Phase 5 regression. A real
  390 × 844 Chromium flow on the exact LAN URL verified the DEV toggle, lock
  persistence through Pluto and black-hole warps, Neptune-altitude descent
  rehydration, normal-ramp restoration, bounded state, and zero browser errors.
  The DEV panel and long-fall route captures were visually inspected, and the
  required web-game client loaded all 18 assets with no game error.
- Phase 8 landmark-art approval has begun one asset at a time. Pluto candidate
  v1 was approved, trimmed and resized into the production
  `cat-sword-climb/assets/goal_pluto.png` sprite at 320 × 190 with alpha, and
  added to the HTML asset manifest. The natural sprite path now replaces only
  Pluto's procedural fallback; the remaining six cosmic landmarks stay
  procedural until separately approved.
- The changed entry/config graph uses cache key `7.3.0`, and the isolated phone
  preview now loads 19/19 assets with no failure or game error. The exact-LAN
  Phase 7 mobile audit passed with zero browser errors, and the Pluto gameplay
  capture at 390 × 844 was visually inspected for scale, transparency, label
  clearance, and route readability.
- Generated Kuiper Belt Object approval candidate v1 as a realistic,
  reddish-brown Arrokoth-inspired contact binary with an exaggerated
  two-lobed silhouette. The 1536 × 1024 alpha candidate is saved under
  `html-remake/art-approvals/` and is intentionally not in the asset manifest
  while awaiting user approval.
- Kuiper Belt Object candidate v1 was approved, trimmed and resized into
  `cat-sword-climb/assets/goal_kuiper-object.png` at 320 × 185 with alpha, and
  added to the manifest under cache key `7.4.0`. The exact phone preview now
  loads 20/20 assets; the required web-game client and live Phase 7 mobile
  audit passed with no failures or browser errors. Its gameplay capture was
  visually inspected for the two-lobed silhouette, readable surface detail,
  label separation, scale, and transparent edges.
- Generated Heliopause approval candidate v1 as a realistic NASA-style
  heliosphere visualization: an enlarged Sun inside warm solar-wind filaments,
  bounded by a thick blue-violet compressed shell and rounded tail. The
  1610 × 977 alpha image is saved under `html-remake/art-approvals/` and
  remains outside the manifest pending user approval.
- Heliopause candidate v1 was approved, trimmed and resized into
  `cat-sword-climb/assets/goal_heliopause.png` at 320 × 235 with alpha, and
  added under cache key `7.5.0`. The exact phone preview loads 21/21 assets;
  the required client and live landmark audit passed without failures or
  browser errors. The 390 × 844 gameplay capture was visually inspected and
  retains the enlarged Sun, warm interior flow, bright compressed boundary,
  readable silhouette, and clean label spacing.
- Generated Voyager 1 approval candidate v1 as a realistic, isolated
  deep-space probe with an oversized readable dish, gold instrument bus,
  RTG cluster, lattice boom, and antenna rods. The 1672 × 941 alpha image is
  saved under `html-remake/art-approvals/` and remains outside the manifest
  pending user approval.
- Voyager 1 candidate v1 was approved, alpha-trimmed and fitted into
  `cat-sword-climb/assets/goal_voyager-1.png` at 360 × 180, then added to the
  HTML manifest under cache key `7.6.0`. The required web-game client loaded
  22/22 assets, and the exact 390 × 844 phone audit passed all 15 landmark,
  route-history, results, and layout checks with zero browser errors. The
  13,100 m capture was visually inspected for full boom visibility, dish
  readability, label clearance, scale, and transparent edges.
- Generated Oort Cloud Comet approval candidate v1 as a realistic,
  deliberately oversized fractured ice-and-rock nucleus with a dense pale
  dust tail and a separate narrow cyan ion tail. The 1619 × 972 alpha image is
  saved under `html-remake/art-approvals/`; transparent corners, subject
  coverage, and key-color cleanup were validated. The user rejected v1
  because the long tail looked sloppy and incorrectly suggested that the tail
  itself was a bounce surface.
- Generated Oort Cloud Comet candidate v2 with a much larger, centered solid
  nucleus and two short, smooth, secondary tails. A magenta key was used so
  the cyan tail could be retained cleanly; the final 1024 × 1536 alpha
  candidate is
  `html-remake/art-approvals/oort-cloud-comet-candidate-v2-clean-tail-final.png`
  and remains outside the manifest. The user accepted its nucleus-first
  direction but rejected the smooth triangular tails as too cartoonish.
- Generated Oort Cloud Comet candidate v3 by retaining the large centered
  nucleus and replacing only the tails with a short photographic dust plume,
  fine particulate falloff, and a subtler ion filament. Magenta-key removal
  was followed by targeted spill neutralization while preserving alpha; the
  final 1024 × 1536 candidate is
  `html-remake/art-approvals/oort-cloud-comet-candidate-v3-clean.png`. The user
  ultimately chose and approved the pointed-tail v2 shown in their attachment;
  v3 remains unused.
- The approved pointed-tail Oort candidate was key-spill-cleaned, padded so
  its nucleus sits exactly on the interaction center, and fitted into
  `cat-sword-climb/assets/goal_oort-comet.png` at 320 × 200. It was added to
  the HTML manifest under cache key `7.7.0`, and the collision width was
  narrowed from 300 to 150 so only the nucleus is interactive. The required
  client loaded 23/23 assets, and the 390 × 844 live audit passed all route,
  landmark, results, and layout checks with zero browser errors. A dedicated
  regression verified that a slash through the visible tail leaves the comet
  alive, while a nucleus slash clears it and produces a -1850 upward bounce.
- Generated Proxima Centauri approval candidate v1 as a realistic deep-red
  dwarf star with turbulent photospheric granulation, dark starspots, bright
  active regions, and compact prominence loops. Green-key extraction used a
  one-pixel edge contraction followed by targeted yellow-green spill
  neutralization; the final 1254 × 1254 alpha candidate is
  `html-remake/art-approvals/proxima-centauri-candidate-v1-final.png`. It
  remains outside the asset manifest pending user approval.
- Proxima Centauri candidate v1 was approved, alpha-trimmed and fitted into
  `cat-sword-climb/assets/goal_proxima-centauri.png` at 260 × 235, then added
  to the HTML manifest under cache key `7.8.0`. The required client loaded
  24/24 assets, and the exact 390 × 844 landmark audit passed all route,
  results, phone-layout, and Oort collision checks with zero browser errors.
  The 16,600 m capture was visually inspected for surface detail, prominence
  visibility, label clearance, scale, and transparent edges.
- Generated Black Hole approval candidate v1 as a realistic central event
  horizon, thin photon ring, turbulent orange-white accretion disk, and
  gravitationally lensed upper and lower arcs. Green-key extraction used a
  one-pixel edge contraction followed by targeted color-spill neutralization;
  the final 1619 × 971 alpha candidate is
  `html-remake/art-approvals/black-hole-candidate-v1-final.png`. It remains
  outside the asset manifest pending user approval.
- Black Hole candidate v1 was approved, alpha-trimmed and fitted into
  `cat-sword-climb/assets/goal_black-hole.png` at 360 × 255, then added to the
  manifest under cache key `7.9.0`. All seven cosmic landmarks now use
  approved production art, so `phaseSeven.proceduralPlaceholderArt` is false.
  The required web-game client loaded 25/25 assets, and the exact 390 × 844
  landmark audit passed all 15 approaches, bounded route state, Oort
  nucleus-only collision, `/ 15` results, and phone-fill checks with zero
  browser errors. The 18,500 m capture was visually inspected for complete
  disk visibility, event-horizon clarity, label separation, scale, and clean
  transparent edges. The landmark-art pass is complete.
- Replaced the death-summary headline `THE GROUND GOT YOU` with `SPLAT!` and
  bumped the renderer/entry cache key to `7.9.1`. The isolated phone preview
  was refreshed; the required client loaded 25/25 assets, and the complete
  390 × 844 landmark/results regression passed with zero browser errors. The
  updated results capture was visually inspected for centered copy, spacing,
  and readability.
- Phase 9 replaces the repeated post-Neptune backdrop with five lightweight
  upper-cosmos chapters: Kuiper Belt at 7,600 m, Heliopause at 10,000 m,
  Interstellar Space at 12,500 m, Proxima Region at 15,500 m, and Black Hole
  Region at 17,500 m. Short smoothstep crossfades connect cold dust/debris,
  blue-violet boundary arcs, sparse interstellar darkness, a directional
  red-dwarf glow, and faint gravitational-lensing rings without adding live
  entities or collision geometry.
- The existing two-node ambience bed now follows the same chapter progression:
  heliopause is subtly brighter, interstellar space thins out, Proxima warms,
  and the black-hole hum shifts lower. Accepted jump, sword, mouth-pop, combo,
  landmark, landing, and game-over effects remain unchanged on their separate
  bus. Phase 9 background motif weights and interpolated ambience targets are
  exposed through `render_game_to_text()`.
- Phase 9 uses cache key `9.0.0`, updates the phase badge/state to 9, and is
  documented in `html-remake/PHASE_9_UPPER_COSMOS.md`. Its logic audit passed
  all five stable regions, four midpoint transitions, and bounded values
  through 22,000 m. The complete 240-seed / 401,430-balloon route audit,
  Phase 6 logic, Phase 7 landmark/history/dev tools, Safari input, required
  web client, and full 15-landmark/results browser regressions pass. All five
  390 × 844 chapter captures were visually inspected; measured deterministic
  browser work ranged from about 1.7 ms to 3.5 ms per phone frame with zero
  browser errors.
- Phase 9 presentation polish is complete. The live HUD no longer renders a
  persistent pop total and now shows the color badge only from the second
  same-color hit onward; iPhone `APP MODE` is limited to the start splash; and
  the death card omits landmark progress and reflows its three remaining run
  statistics. The straight nebula ribbons, Heliopause strokes, and Black Hole
  ellipses were replaced with bounded, cached half-resolution soft-haze
  textures.
- The dedicated 390 × 844 presentation audit verified exact 9,883 m and
  17,974 m captures, first-hit badge hiding, second-hit `MATCH` visibility,
  splash-only `APP MODE`, the three-stat death card, sub-0.13 ms local cached
  background render work, and zero browser errors. Phase 6 logic, Phase 9
  chapter logic, retained-route descent, Safari controls, all 15 landmark
  approaches, Oort nucleus-only collision, dev warps, 1× speed lock, and both
  required web-game clients also pass. The exact phone preview was refreshed
  under cache key `9.1.0` at
  `http://192.168.86.20:5174/html-remake/`.
- Ground-impact deaths now reuse the existing idle cow art in a canvas-only
  `belly-up` pose: the sprite rotates 180 degrees after the fatal landing, with
  no additional image asset. The pose is exposed in `render_game_to_text()` and
  resets to `upright` on a new run. Cache key `9.1.1` covers the renderer/entry
  update.
- The focused 390 × 844 fatal-landing regression triggered a real armed fall,
  verified `gameover + onGround + belly-up`, clicked `CLIMB AGAIN`, verified the
  upright reset, and recorded zero browser errors. Both phone captures were
  visually inspected, and the required web-game client also completed.
- Phase 9 ambient-flyby implementation adds one distant bird from 0–899 m and
  one distant flying-saucer event from 12,500–17,499 m. Birds use a relaxed
  horizontal crossing with alternating wingbeats, glides, and only slight
  vertical drift; saucers use a quicker crossing with roughly two to three
  smooth, deliberately cartoonish vertical bobs and matching tilt.
- Birds, saucers, and shooting stars share one visual-event lane, draw behind
  all gameplay, have no collision or sound, and use a second seeded visual RNG
  that cannot alter the route or the established shooting-star sequence.
  `render_game_to_text()` exposes eligibility, timers, counts, active position,
  path progress, wing state, bob settings, and motion.
- The query-gated DEV panel now includes `TEST BIRD` and `TEST SAUCER` buttons.
  Either button forces its pass at the current view and closes the panel so the
  movement can be watched immediately; natural appearances retain their
  altitude limits and rare timers. Cache key `9.2.0` covers the changed HTML,
  CSS, config, game, renderer, and entry modules.
- The focused 390 × 844 phone audit passed the complete DEV-button flow and
  natural altitude gates with zero browser errors. The seeded bird crossed in
  7.47 seconds, varied only 12.36 logical pixels vertically, and exercised its
  full wing range; the saucer crossed in 5.06 seconds, covered 49.31 logical
  pixels through three vertical reversals, and stayed out of the black-hole
  region. A forced flyby also displaced an active shooting star as required by
  the shared single-event lane.
- The DEV card, bird midflight, and saucer midflight phone captures were
  visually inspected. Both read as small background details behind the route:
  the bird is a muted flapping silhouette and the saucer is a tiny metallic
  shape with a faint glow and lights. The required web-game client, Phase 6
  logic (including deterministic shooting stars), and Phase 9 chapter audit
  all pass.
- The isolated port 5174 phone preview was refreshed and the complete focused
  audit passed again against that served copy with identical motion values and
  zero browser errors. The required client also loaded 25/25 assets from the
  live preview, completed movement/slash input, and reported no game error.
- Phase 10 release-candidate baseline is green. JavaScript syntax checks and the
  Phase 5, 6, 7, route-history, Phase 9, and Safari-input logic audits all pass;
  the deterministic route sample still covers 240 seeds and 401,430 balloons
  with no clearance or approach failures. Real Chromium checks also passed the
  15-landmark phone route, five upper-cosmos chapters, leaderboard/native-input
  flow, belly-up landing/reset, and presentation polish with zero browser
  errors. The Phase 5 browser script itself still hardcodes its historical
  port 5175, so its first launch missed the active 5173 server; equivalent
  route/mechanics coverage passed through the current logic and later browser
  suites.
- Phase 10 baseline review found three release-surface issues rather than a
  gameplay regression: the start splash still displayed `PHASE 7`, JavaScript
  and CSS cache keys were mixed across old phase versions, and the static game
  had no reproducible offline/production packaging step. These are the active
  release-hardening targets; core balance values remain unchanged unless the
  release audits identify a concrete fairness failure.
- Phase 10 release hardening is implemented under a unified `10.0.0`
  release-candidate identity. The splash, stylesheet, entry point, every local
  JavaScript import, runtime state, package metadata, and new service-worker
  cache now share that version. The service worker precaches the complete
  25-image/audio/runtime shell on HTTPS or localhost; a real controlled browser
  went offline, reloaded, and decoded all 25 assets without a failure.
- A fresh public URL now hides both the DEV button and score-mutating
  `window.__OTM` hooks. `?dev=1` still exposes the full deterministic toolkit
  and persists for iPhone Home Screen testing; `?dev=0` still clears it.
  Malformed initials, blocked initials, and zero scores received from Firebase
  are filtered before the leaderboard is rendered.
- The Phase 10 full-climb fairness audit generated 1,672,034 balloons across
  1,000 complete seeded routes through all 15 landmarks and 1,200 world units
  beyond the Black Hole. It found zero unreachable required altitude groups;
  the tightest modeled route retained 48.31 px of vertical reserve and
  84.76 px of horizontal reserve. Accepted route density, physics, combo
  rewards, speed ramp, and landmark geometry therefore remain unchanged.
- The release builder creates a marked, replace-safe
  `release/over-the-moon/` directory containing only the public runtime and
  referenced game assets. The current 6.46 MB package has 46 files, 25 game
  assets, and a SHA-256 release manifest; all 46 hashes pass. The release
  directory is ignored by Git and can be regenerated with `npm run build`,
  followed by `npm run audit`.
- The strict 390 × 844 release matrix passed the fresh public build, explicit
  DEV build, held-direction swipe, audio unlock, Black Hole warp, 1× speed
  lock, true offline reload, and the packaged 1,440 × 900 desktop build capped
  at 500 CSS pixels. Current landmark, retained-route, leaderboard, belly-up
  death, presentation, Safari-input, bird, saucer, background, ambience, and
  required-client regressions pass with zero unexpected browser errors.
- Phase 10 is documented in
  `html-remake/PHASE_10_RELEASE_CANDIDATE.md`. Remaining work is physical-device
  release review and an explicit production host/domain decision; no public
  deployment has been performed.
- The isolated LAN preview on port 5174 was refreshed from the exact generated
  Phase 10 release package. Both localhost and `192.168.86.20` return the
  `10.0.0` release-candidate entry page, and the required web-game client
  started a run from the LAN URL, loaded all 25 assets, accepted movement and
  jump input, kept DEV tools hidden on `?dev=0`, and reported no game error.
- Release-candidate polish build `10.1.0` replaces the old phase/title card
  with a clean splash menu: the large `OVER THE MOON` start button, smaller
  full-width `HOW TO PLAY` and `LEADERBOARD` buttons, and the existing sound
  button. Visible phase/build copy and inline instructions are gone, and
  fullscreen/App Mode no longer add utility clutter to the main splash.
- `HOW TO PLAY` now opens a phone-fitting four-row dialog for movement, jump,
  slash/bounce, and color rewards, with the iPhone Home Screen tip moved inside
  that dialog. The menu leaderboard is a separate read-only state with no
  initials, submission, run score, or Run Again controls; the established
  post-run initials/submission flow remains unchanged.
- Tall coarse-pointer layouts now use a 230-unit floor-framing margin while
  desktop and test/default layouts retain 140. At 390 × 844 the grass moved to
  678.17 CSS px and the grounded cow clears the touch-control row by 32.24 CSS
  px. This is camera framing only: world floor, height mapping, physics, route,
  and desktop framing did not change.
- The distant bird now uses a 0.70–0.84 scale, pale two-tone body with a darker
  edge, broader wing pose, and 4.2–5 Hz flap rate. The full motion regression
  observed the complete -1 to +1 wing range over the same relaxed 7.47-second
  crossing; the saucer path and shared visual-event lane remain unchanged.
- The focused phone audit passed the full main menu → instructions → back →
  read-only leaderboard → back → start sequence, ground/control clearance, and
  forced bird preview with zero browser errors. The `10.1.0` release matrix
  also passed public/DEV isolation, touch swipe, audio, true offline reload,
  Black Hole warp, 1× lock, packaged fixed-width desktop controls, all 46
  hashes, and the 1,000-seed / 1,672,034-balloon fairness audit. Existing
  route, speed/combo, retained descent, Safari input, post-run leaderboard, and
  belly-up death regressions remain green.
- The isolated port 5174 LAN preview was refreshed from the final hashed
  `10.1.0` release package. Localhost and `192.168.86.20` both return the new
  menu shell, and the required client loaded 25/25 assets from the exact phone
  URL, started a public run, accepted movement/jump input, kept DEV hooks
  hidden, and reported no game or browser error.
- Release-candidate build `10.1.1` removes the on-screen fullscreen button
  from desktop gameplay while preserving the `F` keyboard shortcut and `Esc`
  exit behavior. The button starts hidden in HTML to prevent a loading flash
  and remains hidden through all runtime states.
- The focused web-game client and full Phase 10 browser matrix passed build
  `10.1.1`: the public/DEV, phone, offline, fixed-width desktop, controls, and
  asset checks remain green with no browser errors. The packaged desktop
  screenshot confirms that only the sound control remains in the upper-right
  gameplay utility area.
- Release-candidate build `10.1.2` shifts the camera follow zone from 38%–64%
  to 50%–72%. During sustained ascent the cow now stays at screen center with
  more upcoming route visible above it; during descent it may travel to 72%
  before the camera follows. Physics, route positions, collision, height
  scoring, controls, and ground framing are unchanged.
- The required web-game client passed movement, jump, landing, and error checks.
  The full release matrix asserted the exact 50% ascent and 72% descent camera
  positions on a 390 × 844 phone, preserved fixed-width desktop play, offline
  loading, touch swiping, DEV tools, all 25 assets, and the route fairness
  audit. Visual inspection confirmed both phone positions remain clear of the
  touch controls, with no browser errors.
- Release-candidate build `10.1.3` narrows the camera follow zone to 47%–57%
  after physical review found the 50%–72% version too low. The cow now remains
  close to screen center with a small 10-point dead zone, avoiding both the old
  upper-screen bias and a camera rigidly locked to every vertical movement.
- The required client passed movement, jumping, landing, and error checks. The
  full release matrix asserted the exact 47% rising and 57% falling positions,
  and its phone captures were visually inspected: both positions read as
  centered and remain comfortably above the controls. Offline, public/DEV,
  fixed-width desktop, asset, performance, and route-fairness checks remain
  green with no browser errors.
- Release-candidate build `10.1.4` raises only the sustained-ascent camera line
  from 47% to 44%, leaving the accepted 57% descent line unchanged. This is a
  roughly 25-CSS-pixel upward adjustment on the 390 × 844 phone audit and keeps
  the tighter camera behavior introduced in `10.1.3`.
- The required gameplay client passed movement, jump, landing, and error checks.
  The complete release matrix asserted the exact 44% ascent and 57% descent
  positions; both regenerated phone captures were visually inspected and
  remain clear of the HUD and controls. Offline, desktop, public/DEV, asset,
  performance, and route-fairness checks remain green with no browser errors.
- Shipping review confirmed GitHub Pages is currently a legacy Pages build from
  `main:/docs`, with HTTPS enforced and the established public URL
  `https://geoduckedup.github.io/JumpOvertheMoon/`. The live root still serves
  the old Pygbag export; simply pushing the untracked `html-remake/` directory
  would not replace the public game.
- Both the old Python client and the HTML remake use the same Firebase Realtime
  Database (`over-the-moon-14b50`) and exact
  `/jumpoverthemoon/scores` path. A live read returned the established top ten,
  and the current rules support the remake's score query and POST schema.
  Publishing the frontend will not migrate, reset, or rewrite leaderboard data.
- Recommended shipping work is a Pages-root packaging step that replaces
  `docs/` with the tested HTML build while adapting its asset, manifest, and
  service-worker paths for the existing root URL. After a final packaged-root
  browser/leaderboard smoke test, commit the runtime source, required goal art,
  and generated `docs/` output, then push `main`; no Pages setting or Firebase
  rule change should be required.
- Added a protected GitHub Pages builder and audit. `npm run ship:pages`
  rebuilds the marked release, accepts only the recognized legacy or previously
  marked `docs/` target, flattens the HTML game to the established Pages root,
  rewrites generated asset/manifest/service-worker paths, adds `.nojekyll`, and
  verifies all 46 file hashes. The old Pygbag APK/tar/splash payload is removed
  from `docs/`; its Python source and separate `web/` reference remain intact.
- Promoted the public package to production build `10.2.0`, channel
  `production`, with cache `over-the-moon-10.2.0`. The exact local URL shape
  `/JumpOvertheMoon/` passed the required client and the complete public/DEV,
  390 × 844 phone, true-offline, camera, touch-swipe, audio, Black Hole warp,
  speed-lock, and 1,440 × 900 fixed-width desktop matrix. All 25 assets loaded,
  the root service worker controlled the page, the shared leaderboard returned
  its existing top ten read-only, and no browser errors occurred.
- Exported all 97 existing Firebase entries before deployment to the ignored
  backup `release/firebase-backups/jumpoverthemoon-scores-2026-07-25.json`
  (SHA-256
  `1515d36721873abf8b6d404666b0723420a3ad3f51814b75d4a8e3157e8dfad7`).
  No Firebase write or rule change was performed.
