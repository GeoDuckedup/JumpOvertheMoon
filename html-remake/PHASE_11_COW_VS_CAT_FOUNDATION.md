# Phase 11 — Cow vs Cat Foundation

Phase 11 establishes Cow vs Cat as a separate game mode without changing the
public Classic game. It is an internal development foundation, not the combat
release.

## Implemented

- Internal `classic` and `cow-vs-cat` play modes.
- Cow vs Cat is available only through the `?dev=1` tools.
- An inactive ginger-and-white cat concept actor with a fiddle, separate bow,
  and navy neckerchief.
- Rival concept art scaled to approximately 80% of the cow's idle height.
- DEV controls to begin either mode and move the concept actor left or right.
- Separate local-best storage for Cow vs Cat.
- Classic Firebase leaderboard submission and leaderboard balloons are disabled
  in Cow vs Cat.
- Retry preserves the active play mode; returning to Classic restores the
  established Classic best and leaderboard balloons.
- Runtime state exposes the mode, rival state, attack implementation flags, and
  score-isolation status for repeatable browser tests.

## Intentionally inactive

- Cat pursuit and navigation.
- Cow/cat collision and damage.
- Bow quick attack.
- Fiddle heavy attack.
- Cat's Concerto special attack.
- Stagger, knockdown, retreat, return, and final balance.

The inactive actor cannot move, collide, deal damage, or affect a Classic score.
These boundaries keep the foundation testable before combat behavior is added.

## How to review

1. Open the game with `?dev=1`.
2. Open `DEV`.
3. Tap `COW VS CAT`.
4. Inspect the cat concept in play and use `CAT ◀` / `CAT ▶` to test its
   staging positions.
5. Start `CLASSIC TEST` and confirm the cat disappears and the established game
   returns unchanged.

## Next proposed phase

Phase 12 should implement pursuit movement only: the cat follows the cow with a
readable speed advantage, maintains a fair engagement distance, pauses after
stagger thresholds, and never attacks. Keeping attacks out of that phase lets us
approve the chase rhythm before building the three-move combat kit.
