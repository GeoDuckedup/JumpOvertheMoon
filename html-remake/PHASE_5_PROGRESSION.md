# Phase 5 — Into the Cosmos

Phase 5 adds the reference game’s major progression and presentation systems to
the native HTML run loop: eight slashable landmarks, landmark-aware route
generation, altitude background chapters, same-color rewards, and the long-fall
re-entry trail.

The Pygame implementation, Pygbag exports, and shared source artwork remain
unchanged.

## Landmarks

The eight reference milestones are active:

| Landmark | Height |
| --- | ---: |
| Prop Plane | 380 m |
| Space Station | 1,133 m |
| Moon | 1,980 m |
| Mars | 2,921 m |
| Jupiter | 3,932 m |
| Saturn | 4,991 m |
| Uranus | 6,120 m |
| Neptune | 7,320 m |

Each marker uses its existing image asset and source-game slash hitbox. A
successful downslash clears the marker, plays a short landmark chime, produces a
gold/white burst, arms the fatal-floor rule, and grants the reference 1,080-unit
bounce.

## Landmark-safe routes

The generator knows the real height of every landmark sprite. For each marker,
it reserves the source clearance band:

- 95 world units above the sprite;
- the complete sprite height;
- 80 world units below the sprite.

Main route steps inside a clearance band are skipped. A side balloon whose
vertical jitter enters the band is rejected. The first skipped step inserts one
main-route approach balloon 42 units below the band, within ±58 units of the
landmark center. The route anchor is reset to the landmark center while crossing
the band.

Approach balloons still participate in normal color rewards. Landmarks
themselves do not change or reset the balloon-color streak.

## Match and combo rewards

Only popped balloon colors count:

- first color hit: normal 920-unit bounce;
- second consecutive same-color hit: `match!`, with a physics-correct
  1.25×-height bounce (1,028.5913 units/second);
- third and every continued same-color hit: `combo!`, with a physics-correct
  1.75×-height bounce (1,217.0456 units/second);
- a different popped color begins a new one-hit streak.

Skipped balloons and cleared landmarks do not reset the streak. Match/combo
hits receive larger particles, a rising ring/callout, a color HUD chip, and short
ascending sound cues.

## Altitude backgrounds

The canvas now smoothly blends through the reference chapters:

- 0 m: sky;
- 900 m: high atmosphere;
- 1,800 m: near space;
- 3,300 m: deep space;
- 5,600 m: cosmic space;
- 7,600 m: far cosmos.

Each chapter interpolates top/bottom gradient colors, cloud strength, star
strength, and cosmic haze. The background follows current height, so a long fall
visually returns through the same chapters.

## Re-entry trail

The existing `reentry_trail_light.png` asset appears behind the normal falling
cow when all reference conditions are met:

- the fall began at or above 900 m;
- downward speed reaches at least 700 world units per second;
- the cow has fallen at least 220 meters from the latched peak.

The trail stays latched during that fall, then resets on a bounce, upward
movement, or landing.

## Performance

Landmarks are a fixed collection of eight. Balloon generation and culling remain
unchanged from Phase 4: 1,200 units generated ahead, 900 retained below the
viewport, and a defensive maximum of 42 active balloons.

The six background chapters remain Canvas 2D effects and use the existing
adaptive DPR profiles. No additional per-frame image allocations were added.

## Verification

The required web-game client completed after the Phase 5 integration, loaded all
18 image assets plus the recorded pop, exercised keyboard movement/jump, and
reported no page error.

A deterministic simulation audit then covered:

- 240 seeds;
- 159,533 generated balloons;
- 240 unique early routes and exact same-seed replay;
- all four colors;
- zero landmark-clearance violations;
- exactly one correctly placed approach balloon for all eight landmarks in
  every audited route;
- valid side-balloon margins, offsets, and jitter;
- all landmark approach IDs generated while keeping the 42-balloon rolling cap;
- landmark hit, clear, count, event, and 1,080-unit bounce;
- exact normal/match/combo bounce speeds and different-color streak reset;
- re-entry latch after the required fall and reset on upward movement.

The expanded headless screenshot suite could not launch because the local
browser-automation allowance was exhausted. The in-app browser was also blocked
from the local test address. The already-required client’s ground-play capture
was visually inspected; milestone, combo, deep-space, re-entry, and phone
captures therefore remain in the physical/manual checklist.

## Phase 6 handoff

Phase 6 should close the remaining progression gaps: the altitude speed ramp,
rare shooting stars, final sound/ambience decisions, and shared leaderboard or
initials flow. It should also perform physical-phone visual tuning of the Phase 5
landmark scale, high-altitude readability, combo callouts, and re-entry trail.
