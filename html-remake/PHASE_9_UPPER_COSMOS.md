# Phase 9 — Upper-Cosmos Chapters

Phase 9 replaces the single repeated backdrop above Neptune with five
lightweight, smoothly connected regions. It changes presentation only:
landmark heights and hitboxes, balloon routes, physics, scoring, controls, and
the 2× speed cap remain unchanged.

## Chapter map

| Region | Nominal start | Stable visual review point |
| --- | ---: | ---: |
| Kuiper Belt | 7,600 m | Pluto, 8,600 m |
| Heliopause | 10,000 m | Heliopause, 11,500 m |
| Interstellar Space | 12,500 m | Voyager 1, 13,100 m |
| Proxima Region | 15,500 m | Proxima Centauri, 16,600 m |
| Black Hole Region | 17,500 m | Black Hole, 18,500 m |

Short crossfade bands center on 10,000 m, 12,450 m, 15,450 m, and 17,500 m.
Colors, motif strengths, star density/tint, and ambience targets all use the
same smoothstep interpolation, so no region snaps into place.

## Visual language

- **Kuiper Belt:** cold navy space, a soft diagonal dust band, and tiny
  deterministic ice/rock fragments.
- **Heliopause:** blue-violet boundary glow and broad overlapping plasma haze
  with soft, irregular solar-wind wisps.
- **Interstellar Space:** the darkest and sparsest chapter, with restrained
  red/blue distant motes and a soft edge vignette.
- **Proxima Region:** a directional red-dwarf glow with warm dust and warmer
  star tinting, kept dark enough that red balloons retain their silhouette.
- **Black Hole Region:** a deep near-black field, a soft central sink, and
  irregular warm/violet dust glow that leaves the landmark as the focal point.

The shared cosmic nebula, Heliopause haze, and Black Hole dust are cached on
half-resolution transparent canvases and enlarged smoothly during rendering.
This removes the former straight-edged ribbons, stroked boundary arcs, complete
lensing ellipses, and tangential line marks without adding live entities,
collision objects, external images, or unbounded particle systems.

## HUD and results polish

- The live HUD always shows height and local best.
- The total pop count is reserved for the death summary.
- A color badge appears only after the second consecutive same-color pop, when
  `MATCH` or `COMBO` information becomes actionable.
- On iPhone, `APP MODE` remains available on the start splash but is removed
  from the active climb and results screens.
- The death summary omits landmark progress and presents only balloons popped,
  best color streak, and flight time beneath peak height.

## Ambience

The existing filtered-air and sine-hum nodes remain the only persistent
ambience sources. Phase 9 changes their low-volume targets by chapter:

- Kuiper keeps the established high-space hum;
- Heliopause becomes slightly brighter and higher;
- interstellar space becomes quieter and thinner;
- Proxima restores a restrained warm presence; and
- the black-hole region lowers the hum frequency while reducing the air bed.

Effects remain on their independent bus, so the accepted jump, sword, mouth
pop, combo, landmark, landing, and game-over sounds are unchanged.

## Exposed test state

`render_game_to_text()` now includes:

- `game.background.dominant` and `dominantLabel`;
- five continuous values under `game.background.motifs`;
- the five chapter definitions under `game.phaseNine.chapters`; and
- the current interpolated target under
  `audio.adaptiveAmbience.chapter`.

## Verification

Phase 9 passed:

- JavaScript syntax checks for every changed runtime and audit module;
- a deterministic chapter audit through 22,000 m, including all five stable
  regions and all four 50/50 transition points;
- the full 240-seed route audit covering 401,430 generated balloons with zero
  clearance violations or missing landmark approaches;
- the Phase 6 speed, scoring, leaderboard, and high-speed landing audit;
- the Phase 7 landmark, endless-route, compact-history, dev-warp, and 1× speed
  lock audits;
- the Safari hold/swipe/selection/input audit;
- the required web-game client with 25/25 decoded assets;
- a 390 × 844 Chromium phone pass with captures of every chapter, zero browser
  errors, and the same full-viewport layout; and
- the complete 15-landmark/Oort-collision/results regression.

The five deterministic-frame measurements ranged from about 1.7 ms to 3.5 ms
per phone frame in the local headless benchmark. These are comparative local
render-work measurements, not claims about physical-device FPS.

The later `9.1.0` presentation audit additionally verified splash-only
`APP MODE`, the hidden first-hit badge, the visible second-hit `MATCH` badge,
the three-stat death summary, exact captures at 9,883 m and 17,974 m, and zero
browser errors. Cached-background-only render measurements were below 0.13 ms
per local headless frame.

## Physical-phone checklist

1. Open the same-Wi-Fi DEV build and confirm the start badge says `PHASE 9`.
2. Warp to Pluto and confirm the Kuiper dust band feels soft rather than like a
   platform or wall.
3. Warp to Heliopause and confirm the blue-violet plasma reads as soft haze,
   with no straight beams or sharp boundary lines.
4. Warp to Voyager 1 and confirm interstellar space feels intentionally empty,
   not unfinished.
5. Warp to Proxima Centauri and confirm red balloons remain readable against
   the warm right-side glow.
6. Warp to the Black Hole and confirm the diffuse dust glow has no complete
   rings and keeps the Black Hole landmark visually dominant.
7. Play with sound on and confirm the ambience changes are subtle; jump,
   sword, balloon pop, and landmark sounds should be unchanged.
8. Continue above 18,500 m and confirm the Black Hole Region persists while
   balloon generation continues.
9. Start a normal phone run and confirm `APP MODE` leaves the HUD, the pop total
   stays off the play screen, and the color badge appears on a matching second
   pop.
10. End a run and confirm the death card contains no landmark count.

## Next handoff

The next phase should be release QA and balance: physical iPhone/Safari and
Android/Chrome checks, real-run difficulty tuning, leaderboard verification,
performance observation on older hardware, and packaging/deployment decisions.
