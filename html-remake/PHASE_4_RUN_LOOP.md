# Phase 4 — Complete Run Loop

Phase 4 turns the native browser slice into an endless playable climb. Every run
has a fresh seeded four-color balloon route, the route stays bounded as the
camera rises, returning to the ground after the first pop ends the run, and the
result can be retried immediately. The best height is stored on the device.

The Pygame implementation, Pygbag exports, and shared source assets remain
unchanged.

## Generated route

`src/route.js` owns a small deterministic PRNG and the balloon generator. A seed
can reproduce a route for testing, while normal starts and retries request a new
seed.

The generator preserves the source-game route values:

- main vertical spacing: 115–179 world units;
- main horizontal drift: at most 150 units before edge reflection;
- main radius: 23–33 units;
- optional side-balloon chance: 35%;
- side offset: 130–245 units where space permits;
- side vertical jitter: ±46 units;
- active colors: red, yellow, green, and blue.

The game generates 1,200 world units ahead of the camera. Balloons more than 900
units below the viewport are culled, and the active collection has a defensive
hard cap of 42. This specifically avoids the original browser build’s retained
balloon count growing for the entire run.

## Run rules

- The floor is safe until the player has popped a balloon.
- The first successful downslash arms the fatal-floor rule.
- Landing on the world floor after that pop ends the run.
- Falling below the camera is not independently fatal, matching the reference.
- Score is the greatest integer height reached during the run.
- A higher final score replaces the local best in `localStorage`.
- `R`, Enter, Space, or the touch `RETRY` button starts a clean run with a new
  seed.

The game-over panel displays the run score and local best. It deliberately does
not include the shared leaderboard or initials entry yet.

## Sound

The accepted jump, sword swish, and quiet recorded balloon pop are unchanged.
Phase 4 adds a soft descending two-tone game-over cue and a short rising
two-tone retry cue. Both use the existing effects bus, mute setting, and bounded
voice pool.

## Responsive behavior

The existing responsive contract is unchanged:

- phones fill the visible portrait viewport;
- fine-pointer desktop play stays centered and capped at 500 CSS pixels wide;
- the logical width remains 540 units while logical height follows the viewport;
- safe areas, touch controls, swipe steering, iPhone APP MODE, desktop
  fullscreen, portrait blocking, and adaptive DPR remain active.

On game over, the phone action control becomes `RETRY`. Keyboard instructions
replace the touch instruction on desktop.

## Verification

The final browser suite passed with no console or page errors. It covered:

- 400 seeds and 38,876 generated balloons;
- 400 unique early routes with exact same-seed replay;
- all four colors, safe margins, bounded vertical/horizontal main steps, and
  valid side-balloon offsets/jitter;
- generation/culling after a 20,000-world-unit climb;
- a safe floor before the first pop;
- a successful jump/downslash/pop/bounce sequence;
- a fatal floor after the first pop;
- game-over event/audio, saved best, reload persistence, and fresh-seed retry;
- `R` retry on desktop and touch `RETRY` on a 390×844 iPhone viewport;
- the previously approved continuous left-to-right touch steering;
- the 500 CSS-pixel desktop cap and full-height/full-width phone play.

The required web-game client also completed, and the final high-route, desktop
game-over, and phone game-over screenshots were visually inspected.

## Deliberate limits

Phase 4 does not yet include:

- altitude landmark progression or route clearance around landmarks;
- color combo rewards;
- re-entry trail presentation;
- shared online scores or initials;
- continuous ambience/music.

## Phase 5 handoff

Phase 5 should be the progression/presentation pass: altitude landmarks and
their route-clearance rules, the altitude background stages, the long-fall
re-entry trail, and same-color combo feedback. Route generation must remain
bounded and should be re-audited around every new landmark clearance band.
