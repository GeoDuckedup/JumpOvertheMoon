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
