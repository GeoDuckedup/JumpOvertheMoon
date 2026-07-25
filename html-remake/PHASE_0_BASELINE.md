# Phase 0 — Pygame Reference Baseline

## Status

Phase 0 preserves the current Pygame/Pygbag game as the behavioral source of truth
for the native HTML rebuild. No existing gameplay code or assets are changed by
this phase.

Reference revision:

- Commit: `4d7ac92211d1d20d747f19cb1e3803bc7592a5d4`
- Commit subject: `Fix web name entry arrows`
- Characterization fingerprint: `fd5e6dd79d43298cd9c592c362c9c4a92bff0b532536c0f5049a29ed70d97546`

## Product behavior to preserve

- The cow runs left and right, wraps across the horizontal screen edges, jumps from
  the floor, and downslashes only while airborne.
- A sword hit must approach a balloon or landmark from above.
- A balloon hit pops the target, creates a hit pause, and immediately bounces the
  cow upward.
- The second consecutive balloon of one color gives a `match!` bounce at 1.25×
  normal height.
- The third and later consecutive balloons of the same color give a `combo!`
  bounce at 1.75× normal height.
- Skipping balloons and hitting landmarks do not break the active color streak.
- The floor is safe until the first balloon or landmark is popped. Landing on it
  afterward ends the run.
- The score is the greatest integer height reached in meters.
- The camera follows upward and back downward, preserving missed balloons for
  recovery attempts.
- Each run contains a guaranteed main route, optional side balloons, landmark
  clearance bands, and one centered approach balloon beneath each landmark.
- Milestone order is Prop Plane, Space Station, Moon, Mars, Jupiter, Saturn,
  Uranus, and Neptune.
- Game over can lead to initials entry, leaderboard submission, and immediate retry.

The exact constants, assets, marker hitboxes, seeded layouts, and sample route
records are stored in `reference/reference.json`.

## Rebuild display contract

### Phone portrait

- The stage fills `100dvw × 100dvh`.
- The canvas is never stretched non-uniformly.
- Logical width remains 540 units.
- Logical height is `540 × viewportHeight / viewportWidth`, allowing tall phones
  to see more vertical world.
- HUD and touch controls respect all `env(safe-area-inset-*)` values.
- Dynamic browser chrome and `visualViewport` changes resize the stage without
  reloading or resetting the run.

### Desktop

- The stage is centered against a dark page background.
- The stage is capped at 500 CSS pixels wide.
- It uses the available viewport height with a small outer margin.
- It may shrink below 500 pixels only when necessary to fit the available height.
- Keyboard controls remain supported.

### Landscape phone

- Gameplay stays portrait.
- A branded rotate-device overlay replaces a distorted or severely cropped game.

### Render resolution

- Canvas backing resolution follows CSS size multiplied by a capped device pixel
  ratio.
- Initial DPR caps are LOW 1.15, MED 1.5, and HIGH 2.0.
- Changing quality or viewport size must not change logical coordinates, physics,
  collisions, or input mapping.

## Rebuild audio contract

The HTML rebuild includes sound from its first playable slice.

- Audio is unlocked by the explicit Start gesture for mobile Safari compatibility.
- Required effects: jump, slash, balloon pop, normal bounce, match, combo, landing,
  death, landmark hit, reentry, UI navigation, initials entry, submit, and retry.
- Effects are decoded before play and emitted through a bounded voice pool.
- Effects and ambience/music have independent gain controls.
- Mute and volume preferences persist locally.
- Audio suspends while the page is hidden and resumes safely on return.
- Missing or blocked audio must never block gameplay.
- Optional haptics may accompany major bounces, combos, landmarks, and death.

## Current browser delivery baseline

The Pygbag release currently loads:

| Artifact | Bytes |
| --- | ---: |
| `docs/index.html` | 18,164 |
| `docs/cat-sword-climb.tar.gz` | 5,653,022 |
| `docs/cat-sword-climb.apk` | 5,655,911 |
| `docs/splash_over_the_moon.png` | 2,929,053 |

The page also depends on the remote Pygbag 0.9.3 Python/browser runtime.

The browser baseline reaches active gameplay. Its current console baseline records
`** MEDIA USER ACTION REQUIRED [1] **` before the start gesture and
`PyMain: BrowserFS not found`. The latter is emitted even though the archived game
continues loading and becomes playable. The native HTML build should emit neither
message.

## Known performance risks to eliminate

- Runtime Python/Pygbag download, compilation, and archive unpacking.
- Repeated per-frame sprite scaling.
- Repeated full-screen alpha-surface allocation for clouds, stars, nebulae, and
  overlays.
- Balloon arrays that retain targets far below the active camera.
- Collision and render loops that traverse every retained balloon.
- A variable simulation delta that is capped at 1/30 second and can produce
  time-dilation during severe frame loss.
- No adaptive effect budget or runtime quality downgrade.

These observations guide the HTML architecture. They are not changes to the
reference game's intended feel.

## Phase 0 verification

Phase 0 is complete when:

- The existing characterization script passes with the recorded fingerprint.
- All Python modules compile.
- `capture_reference.py` regenerates `reference/reference.json`.
- Native reference screenshots exist for ground, 900 m, 3,300 m, and 5,600 m.
- Browser screenshots exist for the Pygbag splash and active ground scene.
- The browser build reaches active gameplay.
- Any existing browser console errors are recorded rather than silently ignored.
- `git diff` contains no changes under `cat-sword-climb/`, `docs/`, or `web/`.

## Phase 1 entry point

Phase 1 will create the native responsive browser shell: single canvas, dynamic
logical height, desktop width cap, safe areas, orientation handling, asset loading,
and deterministic browser test hooks. It will not yet port gameplay.
