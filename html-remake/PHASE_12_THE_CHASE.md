# Phase 12 — The Chase

> Historical prototype: Phase 13 replaces this balloon-dependent pursuit with
> jetpack movement and the bow swipe. This file records the approved Phase 12
> behavior for comparison.

Phase 12 turns the approved rival concept into a deterministic pursuer inside
the DEV-only Cow vs Cat mode. This phase is exclusively about movement rhythm;
combat remains disabled.

## Chase behavior

- The cow receives a 2.75-second opening grace period.
- The cat enters from the side opposite the cow.
- Cat movement uses the same fixed-step world physics, gravity, and altitude
  speed ramp as the cow, but it cannot wrap through the left or right edge.
  It turns inward at both boundaries.
- Its horizontal maximum is 405 versus the cow's 360, and its jump/bounce is
  slightly stronger.
- The cat selects reachable nearby balloons, steers toward them, bounces from
  their tops, and pops them.
- Cat pops create the established soft pop sound and particles, but never
  change the cow's pop count, combo, best combo, bounce, or fatal-floor state.
- The cat prefers optional side balloons. Lone main-route balloons and every
  landmark-approach balloon are reserved for the cow; a main balloon is only
  available to the cat while a nearby side alternative remains alive.
- A lead limit prevents the cat from continuing to climb far above the cow.
- A soft 105-unit horizontal engagement band keeps the cat from habitually
  overlapping the cow when both are at similar altitude.
- Short deterministic breathers interrupt continuous pursuit.
- If the cat fully falls below the visible screen, it disappears briefly and
  returns from the lower edge at the same horizontal position. Recovery no
  longer depends on an arbitrary distance from the cow.
- The old artificial ellipse shadow beneath the cat has been removed.

## DEV controls

- `RELEASE CAT` skips the opening grace period.
- `FREEZE CAT` / `RESUME CAT` pauses and resumes all rival physics.
- `CHASE 0.80×`, `CHASE 1.00×`, and `CHASE 1.20×` provide pursuit tuning.
- `CAT ◀` / `CAT ▶` still reposition the actor for visual checks.

## Still intentionally disabled

- Cow/cat collision and damage.
- Cow knockback or cat knockdown.
- Bow quick attack.
- Fiddle heavy attack.
- Cat's Concerto special attack.
- Cat combo scoring or interference with the cow's stats.
- Public menu access and Firebase leaderboard submission.

## Validation

The deterministic logic audit covers opening grace, entry, jumps, side-balloon
pops, protected main/landmark routes, cow stat isolation, direct edge turns,
breathers, freeze, speed limits, visible-screen recovery, same-x return,
Classic isolation, and zero Firebase writes. The 390 × 844 browser audit
exercises the same flow with real controls and captures the visible chase
states.

## Next proposed phase

Phase 13 should add only the bow quick attack: a short-range, clearly
telegraphed swipe that can be dodged horizontally or avoided from above. It
should include its own warning pose, active window, cooldown, and DEV slow-motion
test before the fiddle or damage escalation is added.
