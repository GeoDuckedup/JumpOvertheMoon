# Phase 13 — Jetpack and Bow Swipe

Phase 13 replaces the balloon-dependent cat chase with an aerial rival that
can pressure the cow without consuming the route just to move. The mode is
still available only through `?dev=1`; Classic mode and its leaderboard remain
unchanged.

## Jetpack pursuit

- The 2.75-second opening grace period remains.
- The cat enters from the side opposite the cow, then uses a two-axis jetpack
  to hold a moving position beside and slightly above the cow.
- A coherent generated sprite set keeps the same fitted brass jetpack, harness,
  scarf, fiddle, bow, face, and proportions across hover, bow wind-up, bow
  slash, fiddle-heavy, Concerto, and knocked-down poses. Only the flickering
  blue/orange exhaust is drawn separately so it can animate continuously.
- The cat never wraps through the horizontal edges. It clamps at each boundary
  and turns back into the playfield.
- Merely touching a balloon no longer pops it.
- Three successful counters make the cat fall out of the fight briefly. It
  then returns at its previous horizontal position.

## Bow quick attack

The quick attack has three explicit windows:

1. `0.58 s` telegraph — a gold dashed arc and `SWIPE!` label show the attack
   side.
2. `0.20 s` active swipe — the cat dashes in the warned direction with a bright
   swish arc.
3. `0.52 s` recovery — the arc fades and the cat is vulnerable from above.

After recovery, the deterministic cooldown varies from `2.30–3.25 s`. The
attack begins only when the cow is within the configured horizontal and
vertical engagement range.

- A cow hit applies horizontal displacement and a strong downward knockback.
  It does not bypass the existing floor rule: landing is fatal only after the
  cow has already popped a balloon.
- A swipe may pop at most one ordinary route balloon as collateral.
- Cat balloon pops use the normal soft pop effect and sound, but never change
  the cow's pop count, combo, best combo, bounce, or fatal-floor state.
- Landmark-approach balloons are protected from the cat.
- Cow vs Cat generation adds a deterministic side backup near ordinary main
  balloons. Classic route generation is untouched.

## Counterplay

- The cow can counter by slashing the cat from above during the telegraph or
  recovery window.
- A successful counter shuts off the jetpack and knocks the cat downward.
- Every third counter triggers a retreat and short offscreen recovery.
- The active swipe itself cannot be countered; the warned lane must be dodged.

## DEV controls

- `RELEASE CAT` skips the opening grace period.
- `FREEZE CAT` / `RESUME CAT` pauses or resumes pursuit.
- `CHASE 0.80×`, `CHASE 1.00×`, and `CHASE 1.20×` remain available for tuning.
- `TEST BOW SWIPE` forces the warning and attack immediately, then closes the
  DEV panel so the full animation is visible.
- `CAT ◀` / `CAT ▶` still stage the rival horizontally.

## Still intentionally deferred

- Fiddle heavy attack.
- Cat's Concerto special attack.
- A public Cow vs Cat menu button.
- Firebase submission for rival-mode scores.

## Validation

The deterministic audit covers Classic isolation, jetpack entry, route
redundancy, touch-without-pop, one-balloon swipe collateral, landmark
protection, cow downward knockback, above-counter timing, three-hit retreat,
and non-wrapping edge turns. The phone browser audit covers the DEV entry,
jetpack render, warning arc, active swipe, collateral pop, cow hit, counter,
audio event routing, zero Firebase writes, and zero browser errors.

Build `13.1.0` additionally verifies all six transparent 768 x 512 rival
frames in the 31-asset offline manifest. The current bow attack and counter
flow use their corresponding pose frames; the fiddle-heavy and Concerto frames
are precached for their deferred gameplay implementations.
