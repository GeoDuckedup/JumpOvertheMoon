# Phase 15 — Rival Pressure and Fiddle Drop

Phase 15 keeps Cow vs Cat behind `?dev=1` while making the cat more active,
less clingy, and more varied across the full playfield. Classic mode, its
Firebase leaderboard, and public menu remain unchanged.

## Wider pursuit rhythm

- The cat now orbits roughly 180–230 logical pixels to one side of the cow,
  with a slow vertical wander instead of hovering continuously at contact
  range.
- Its visible center stays at least 80 logical pixels from the side edges, so
  the larger generated sprite remains on-screen without gaining cow-style
  horizontal wrapping.
- The cat changes sides through attacks and recoveries, creating a back-and-
  forth chase rather than a single close pursuit lane.
- The opening grace period is 2.3 seconds. Attack cooldowns are shorter, and a
  weighted director chooses among Bow Swipe, Moonshot, and Fiddle Drop.
- The same attack cannot be selected twice in a row when another eligible move
  is available.

## Attack mix

- Bow Swipe: 45% base weight, fast lateral pressure.
- Moonshot: 30% base weight when the cow has enough clearance above the floor.
- Fiddle Drop: 25% base weight when there is enough screen space above the cow.

The weights are relative to the currently eligible attacks. Over a normal
32-second deterministic combat sample, the cat performs all three moves, has
no immediate repeats, and leaves no attack gap longer than six seconds.

## Fiddle Drop

Fiddle Drop adds a committed diagonal dive:

1. The cat moves above and to one side of the cow.
2. A `0.65 s` wind-up locks a predicted point beyond the cow. A faint dotted
   gold line communicates the route without adding a comic-style overlay.
3. The cat dives along that fixed line for up to `0.42 s` at 930 logical
   pixels per second.
4. It recovers for `0.70 s` and resumes its wider orbit from the far side.

The trajectory cannot track the cow after the warning begins, so moving out of
the lane is a reliable dodge. The warning and recovery can be countered from
above; the active dive cannot. A hit knocks the cow sideways and downward.

- The dive may pop at most two ordinary route balloons.
- Landmark-approach and leaderboard balloons remain protected.
- Cat balloon pops do not alter the cow's score, pop count, combo, bounce, or
  fatal-floor state.

## Generated frames

Two new transparent frames extend the approved orange-tabby rival set:

- `rival_cat_jetpack_fiddle_drop_windup_v1.png`
- `rival_cat_jetpack_fiddle_drop_active_v1.png`

They preserve the fitted brass twin-nozzle jetpack, leather harness, navy
scarf, fiddle, separate bow, realistic materials, and established cat scale.
The wind-up keeps animated jet flames; the active dive uses only the sprite and
movement so the strike stays visually restrained.

## DEV validation

- `TEST FIDDLE DROP` stages the locked warning and dive immediately.
- The DEV status reports selected attacks, Fiddle Drops, cat/cow hits, and
  collateral pops.
- Deterministic logic validates attack pressure, no-repeat selection, locked
  trajectory, two-balloon cap, protected balloons, combo isolation, cow
  knockback, and recovery countering.
- The focused phone browser audit captures the wider neutral orbit, warning,
  active dive, and hit with zero Firebase writes.

## Phase 15.1 combo catch-up

The cat now has a camera-relative vertical rubber band for rapid combo climbs:

- Catch-up begins while the cat is still visible when it drops into the lower
  30% of the camera or falls 190 logical pixels behind the cow.
- Only vertical acceleration and top speed are increased. The multiplier
  blends smoothly from 1× to a maximum of 1.55×, leaving the wider horizontal
  orbit unchanged.
- A Bow Swipe, Moonshot, or Fiddle Drop that has already begun completes with
  its authored timing and locked trajectory. Catch-up is queued for the first
  eligible recovery frame.
- No new attack may be selected while catch-up is active or waiting behind a
  committed move. Normal attack selection resumes immediately after the cat
  returns to the visible pursuit band.
- If the cat somehow remains below the view for three seconds, the existing
  retreat/reentry system is used as a final failsafe rather than teleporting it
  directly beside the cow.

The deterministic 1.75× combo-launch audit keeps the cat onscreen throughout
the ascent, reaches the capped 1.55× assist, preserves a committed Fiddle Drop,
and verifies the three-second failsafe. A 390 × 844 browser run repeats the
same ascent with a 1,169-unit logical viewport and records zero Firebase writes
or browser errors.

Build `15.1.0` expects 35/35 manifest assets. This phase remains local until
the user explicitly asks to push or deploy it.
