# Phase 14 — Jet Polish and Moonshot

Phase 14 keeps Cow vs Cat behind `?dev=1` while improving the cat's jetpack
presentation and adding a second, vertically oriented attack. Classic mode,
its score data, and Firebase submission remain isolated from rival mode.

## Jetpack polish

- Every rendered cat pose has its own authored exhaust anchor and direction.
  Hover and bow poses trail behind the fitted pack; vertical boost poses fire
  straight down from the visible nozzle.
- The animated flame remains renderer-driven so it flickers independently of
  the generated cat art.
- A short, capped heat-haze trail persists behind the cat. It is made from
  fading translucent distortion rings rather than a full-screen post-process,
  keeping the effect inexpensive on phones.
- The trail lasts `0.42 s`, emits more densely during Moonshot, and is capped
  at 18 points.

## Counter bounce

- Slashing the cat from above during a vulnerable telegraph or recovery window
  knocks it down and gives the cow a small upward bump.
- The bump is 75% of a normal balloon bounce (`690` versus `920` base
  vertical speed).
- A counter never changes the current balloon color, streak, best combo, pop
  count, score, or fatal-floor state.
- One bounce is awarded per successful knockdown.

## Moonshot vertical boost

The cat now mixes a vertical boost into its bow swipe pressure:

1. It moves beneath the cow and locks its horizontal launch line.
2. A `0.58 s` faint gold dashed guide shows the fixed launch path.
3. It rockets upward for `0.32 s` with the bow pointed like a lance.
4. It has a `0.64 s` recovery before resuming pursuit.

The launch line is fixed once telegraphed, so moving left or right is always a
valid dodge. The warning and recovery can be countered. During the active
ascent, a well-timed cow slash can clank against the cat's raised weapon,
prevent the hit, and rebound the cow at 50% of a normal balloon bounce. The
cat is not knocked down and finishes the Moonshot. A missed clank knocks the
cow sideways and downward.

- The Moonshot clank has its own short, softened metal-tink sound and does not
  alter the cow's balloon combo, score, pop count, or fatal-floor state.

- Moonshot has a 34% selection chance when eligible.
- It cannot be selected twice in a row.
- It may pop at most two ordinary route balloons in its path.
- Landmark-approach and leaderboard balloons remain protected.
- Cat balloon pops do not affect the cow's scoring, combo, bounce, or floor
  state.

## Generated frames

Two new transparent frames extend the approved orange-tabby rival set:

- `rival_cat_jetpack_boost_charge_v2.png`
- `rival_cat_jetpack_boost_active_v2.png`

Both preserve the brass jetpack, leather harness, navy scarf, fiddle, bow,
face, and proportions used by the Phase 13 frames. Exhaust and attack-lane
effects are drawn in code.

## DEV validation

- `TEST BOOST` stages the warning and launch immediately.
- `TEST COUNTER BOUNCE` stages a successful vulnerable-window counter while
  preserving an active combo.
- The DEV status line reports boosts, cow hits, and collateral balloon pops.

Build `14.0.1` expects 33/33 manifest assets. The deterministic audit covers
trail lifetime, boost timing, locked trajectory, ordinary-balloon cap,
protected balloons, cow knockback, counter-bounce strength, and combo
preservation. The phone browser audit captures hover exhaust, boost warning,
active launch, and counter bounce with zero Firebase writes.

This phase remains local until the user explicitly asks to push or deploy it.

## Phase 14.0.1 visual restraint pass

- Removed the large cyan swipe crescents, active-boost beam, arrowhead, and
  comic-style `SWIPE!` / `BOOST!` labels.
- Bow swipe now uses only a small, low-opacity gold glint at the bow tip during
  its wind-up. The generated attack pose, movement, and swish sound carry the
  strike itself.
- Moonshot keeps a narrow 12–22% opacity dashed guide only during its warning
  window. The guide vanishes at launch, leaving the generated pose, flame,
  heat haze, and audio to communicate the active attack.
- The counter confirmation ring is retained at lower opacity and line weight.

## Build 16.0.2 impact pass

- The active Moonshot column is modestly wider and extends farther above the
  cat so its damaging path better matches the generated boost sprite.
- An unprotected hit now uses the same authoritative `430` horizontal and
  `560` downward base knockback as Bow Swipe.
- A cow that is already falling receives an additional `180` downward speed
  instead of allowing the existing fall to hide the impact.
- The active downward-slash sword clank remains the only no-damage exception;
  its timing, sound, 50% balloon rebound, and combo preservation are unchanged.
