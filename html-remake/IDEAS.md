# Over the Moon — Tabled Gameplay Ideas

This document preserves promising concepts that are **not currently approved
for implementation**. They should not change the active phase plan until one is
explicitly selected for development.

## 1. Black Hole Finish and Timed Completion

**Status:** Tabled

The Black Hole at 18,500 m becomes the definite end of the climb rather than
another landmark.

### Player experience

- Reaching the Black Hole starts a short finish sequence.
- The Black Hole remains visible while it pulls the cow into orbit.
- The cow spirals toward the center, gradually shrinks, and disappears into the
  event horizon.
- Completing the climb is an achievement, but players can continue competing
  to reach the ending faster.

### Score and leaderboard rules

- Every run records both its greatest height and the elapsed time at which that
  height was first reached.
- Runs that do not reach the Black Hole rank primarily by height.
- All completed runs receive the same official maximum height: the Black Hole's
  18,500 m altitude.
- Completion time breaks the height tie, so the fastest Black Hole finish ranks
  highest among completed runs.
- The displayed maximum may be slightly adjusted, if needed, so the recorded
  finish height aligns cleanly with the Black Hole collision and cinematic.
- **Promoted independently in build 10.3.1:** each top-ten score is represented
  at its exact recorded height by a normal red, blue, green, or yellow balloon
  surrounded by a distinct animated gold aura and labeled with rank and
  initials. These are real optional gameplay balloons: the player can slash,
  pop, bounce from them, and continue the combo matching their displayed core
  color. They do not replace or alter the safe generated route or count against
  its active-entity limit.

### Questions to resolve before prototyping

- Should completed runs always rank above every incomplete run?
- Should the timer stop on first Black Hole contact or when the cow fully
  disappears?
- Should the leaderboard show one combined ranking or separate `HEIGHT` and
  `COMPLETION TIME` views?

## 2. Black Hole Portal and Inverted Realm

**Status:** Tabled

The Black Hole becomes a portal into a second, reversed version of the climb
instead of ending the run.

### Player experience

1. The cow reaches the Black Hole at 18,500 m.
2. The cow is pulled into orbit, spins inward, shrinks, and disappears.
3. A transition reveals an inverted realm with reversed colors and an
   upside-down world. The HUD and controls remain upright and readable.
4. The cow begins on an inverted starting platform and continues the climb
   while the camera scrolls downward.
5. When the player misses the route, the cow falls back toward the inverted
   ground.
6. Ground contact sends the cow back through the portal.
7. The cow emerges from the Black Hole in the normal world and continues
   falling down the original climb, where surviving balloons can still provide
   a recovery.

### Recommended physics and controls

- Reverse gravity in the inverted realm so it pulls the cow toward the top of
  the screen and the inverted starting platform.
- The jump/balloon launch direction points down the screen, away from that
  platform.
- The sword slash points upward toward approaching balloons.
- Left and right remain screen-relative. Do not reverse horizontal input.
- Rotate or flip world art and actors independently instead of rotating the
  entire canvas, which would unintentionally reverse left and right.
- Keep the HUD, altitude, sound control, and touch buttons in their normal
  orientation.

### Height and route rules

- Progress remains continuous and never becomes negative.
- Normal-world altitude covers 0–18,500 m.
- Inverted progress starts at 18,500 m and adds the distance traveled into the
  inverted realm.
- The run's peak height never decreases, including during the return fall.
- A first prototype should use a short, safe inverted balloon route before
  committing to a complete second set of chapters and landmarks.
- When the cow returns to the normal world, the retained normal-route balloon
  history should reappear so the long fall remains readable and recoverable.

### Visual and performance direction

- Use a designed inverse palette rather than a raw full-screen CSS or canvas
  inversion filter.
- Cache inverted/rotated sprite variants when assets load instead of processing
  every sprite every frame.
- Draw the world first and the normal upright UI afterward.
- Give the portal entry and exit clear audio and visual signatures so the
  realm change reads immediately.
- Suggested first-time instruction:
  `GRAVITY REVERSED · SLASH UPWARD`

### Leaderboard implications

- Scores at or below 18,500 m belong to the normal world.
- Scores above 18,500 m belong at the corresponding depth in the inverted
  realm.
- Four-color, gold-aura leaderboard balloons currently appear in the normal
  realm at their recorded height. If the inverted realm is adopted later,
  scores above the portal threshold would need to move into that realm while
  keeping the established interactive behavior.

### Questions to resolve before prototyping

- Can a player enter the inverted realm more than once during a single run?
- Does returning through the Black Hole merely continue the fall, or can the
  player recover and re-enter it?
- Should the inverted realm remix the original landmarks or introduce an
  entirely new landmark set?
- How extreme should the reversed palette and ambience become while preserving
  balloon readability?
- Does touching the inverted ground always trigger the return portal, or can
  another failure condition end the run there?

## Suggested prototype order if either idea is revived

1. Test the Black Hole pull, orbit, shrink, and disappearance sequence.
2. Confirm the scoring transition at exactly 18,500 m.
3. Prototype only the unique mechanic:
   - timed finish and ranking rules for Idea 1; or
   - reversed gravity, a short inverted route, and portal return for Idea 2.
4. Playtest the mechanic on phone before producing new art or changing the
   shared leaderboard schema.
5. Approve, revise, or discard the concept before integrating it into the full
   route.
