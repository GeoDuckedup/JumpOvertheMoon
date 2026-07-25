# Phase 7 — Cosmic Route Foundation

Phase 7 extends the endless climb beyond Neptune and establishes the gameplay
contract for the game's upper chapters. The route now has 15 slashable
landmarks, remains bounded on long runs, and continues generating after the
black hole.

## Landmark route

The seven new milestones are deliberately spread farther apart as the climb
leaves the solar system:

| Landmark | Height |
| --- | ---: |
| Pluto | 8,600 m |
| Kuiper Belt Object | 10,000 m |
| Heliopause | 11,500 m |
| Voyager 1 | 13,100 m |
| Oort Cloud Comet | 14,800 m |
| Proxima Centauri | 16,600 m |
| Black Hole | 18,500 m |

They follow the existing Prop Plane, Space Station, Moon, Mars, Jupiter,
Saturn, Uranus, and Neptune milestones. Every marker uses the same established
rules:

- an empty clearance band protects the full landmark silhouette;
- one reachable main-route balloon is generated immediately below the band;
- the route re-anchors near the center of the landmark;
- a valid downslash clears it, counts it, and grants the landmark bounce; and
- balloon generation resumes normally above it.

The black hole is a milestone rather than an ending. The route continues
indefinitely above 18,500 m, while the existing 42-balloon active-state cap
still bounds memory and drawing work.

## Approved production art

All seven upper destinations now use individually approved transparent PNG
sprites: Pluto, Kuiper Belt Object, Heliopause, Voyager 1, Oort Cloud Comet,
Proxima Centauri, and Black Hole. The code-native Canvas drawings remain only
as defensive fallbacks if an image cannot load.

The asset replacements preserve each landmark's ID, height, route rules, and
phone-readable composition. The Oort comet intentionally uses a narrower
nucleus-only hitbox so its decorative tails cannot be mistaken for a bounce
surface. The existing far-cosmos backdrop continues above Neptune; additional
upper-background chapters remain a separate future pass.

## Dynamic progression state

The run-results denominator is no longer hardcoded. It reads the live marker
count and now displays `LANDMARKS CLEARED  … / 15`.

Historical note: Phase 7 introduced and verified that rendered row. The later
Phase 9 presentation polish intentionally removes landmark progress from the
death card while preserving `runStats.totalLandmarks` and the other dynamic
state for route diagnostics.

The rendered/debug state exposes:

- `runStats.totalLandmarks`;
- `phaseSeven.totalLandmarks`;
- `phaseSeven.finalLandmarkHeightMeters`;
- `phaseSeven.proceduralPlaceholderArt` (now `false`); and
- `phaseSeven.endlessBeyondFinalLandmark`.

Every milestone can be framed immediately for development:

```js
await window.__OTM.startWithSeed(7);
window.__OTM.setManualMode(true);
window.__OTM.debugJumpToLandmark("black-hole");
```

The helper accepts a marker ID, exact name, or zero-based marker index.

For physical phone review, the temporary query-gated panel is easier:

```text
http://MAC_IP:5174/html-remake/?dev=1
```

That URL reveals a `DEV` button. Choose any of the 15 landmarks and tap
`WARP 3 BALLOONS BELOW`; the game starts a clean run with the cow immediately
above the third main-route balloon below that destination. Simulation pauses
while the panel is open and resumes after the warp or close button. The normal
URL does not show the button or panel until dev mode has been enabled on that
device. The setting is remembered so an installed Home Screen app keeps the
tools even if iOS drops the query string. Open the same URL with `?dev=0` to
hide the tools again.

## Verification

Phase 7 passed:

- JavaScript syntax checks for every changed runtime and audit module;
- the dedicated Phase 7 audit for exact order/heights, separated clearance
  bands, all 15 debug targets, black-hole collision, dynamic result totals,
  the 2× speed cap, bounded active state, and continuation above 18,500 m;
- the extended Phase 5 deterministic audit across 240 seeds and 401,430
  generated balloons, with 240 unique early routes, exact replay, all four
  colors, zero landmark-clearance violations, and zero missing approaches;
- the complete Phase 6 speed, sound-state, initials, leaderboard, and
  high-speed landing regression;
- the Safari hold/swipe/selection/input regression;
- the required web-game client with all 25 production assets loaded; and
- a real Chromium 390 × 844 phone audit against the exact same-Wi-Fi preview,
  including captures of all seven approved landmarks and the `/ 15` result,
  with zero console or page errors.

All seven landmark captures and the results capture were visually inspected.
The final Black Hole capture also verified that the complete accretion disk,
event horizon, photon ring, and gravitational-lensing arcs remain readable
without clipping.

## Physical-phone checklist

1. Open the same-Wi-Fi preview and confirm the start badge says `PHASE 7`.
2. Confirm the game still fills the portrait phone screen and the controls
   still hold, release, and swipe between left and right normally.
3. Play a normal run and confirm the established speed still reaches 2× at
   Neptune without getting faster above it.
4. Inspect any upper landmark you reach for readable scale and enough room to
   approach from below.
5. Clear an upper landmark and confirm its chime, burst, count, and bounce.
6. Continue above the black hole and confirm the route does not stop.
7. End a run and confirm the results card says `/ 15`.
8. Report any approved landmark that still feels too large, too small, or
   unclear during actual play so its production scale can be tuned.

## Phase 9 completion

Phase 9 now supplies the distinct upper-cosmos background and ambience
chapters described by this handoff. See `PHASE_9_UPPER_COSMOS.md` for the
chapter boundaries, rendering contract, performance measurements, and
physical-phone checklist.
