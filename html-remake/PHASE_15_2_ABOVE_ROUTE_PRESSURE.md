# Phase 15.2 — Above-Route Pressure

Build `15.2.0` changes Cow vs Cat's vertical rhythm without adding another
attack. The cat now uses the existing jetpack and Moonshot to get ahead of the
cow and threaten balloons that are still above the player.

## Gameplay behavior

- Neutral pursuit targets roughly 100–140 logical pixels above the cow while
  keeping the accepted 180–230 pixel horizontal orbit.
- A cat that falls at least 72 pixels behind commits to a telegraphed
  Moonshot overtake. Once queued, ordinary thrust cannot silently swap it for
  a different attack.
- The Moonshot still uses its established positioning, warning, active, and
  recovery windows. It can still pop at most two ordinary route balloons.
- After a successful overtake, the cat holds its world-space height for
  1.15 seconds. This is the deliberate opening for a skilled cow to chain a
  balloon, climb above the cat, and prepare a counter.
- After that opening, a cat left below the cow can queue another Moonshot.
- Long-run deterministic combat spends about 69% of engaged time above the
  cow. Fiddle Drop, Moonshot setup, recoveries, and counters keep the cat from
  permanently camping overhead.
- Bow Swipe now locks the vertical lane shown during its warning. The stronger
  neutral target cannot pull the cat into a different lane before the dash.

## Fairness preserved

- Normal hovering still does not pop balloons.
- Only committed Bow Swipe, Moonshot, and Fiddle Drop paths can pop balloons.
- Leaderboard balloons and landmark-approach balloons remain protected.
- The cat's collateral pops still do not affect the cow's score, combo, pop
  count, bounce, or fatal-floor state.
- Camera-relative catch-up and the three-second below-screen failsafe remain
  active. A post-overtake hold yields to the safety catch-up only if the cat is
  genuinely being lost from view.
- Cow vs Cat remains DEV-only and uses the isolated local-best namespace. No
  Firebase writes were introduced.

## DEV review

Open:

`http://192.168.86.20:5197/html-remake/?dev=1&build=15.2.0`

1. Tap `DEV`, then `COW VS CAT`.
2. Tap `DEV` again and choose `TEST OVERTAKE`.
3. Watch the cat start below the cow, move into its lane, show the faint
   Moonshot guide, boost past, and settle above.
4. During the short post-boost opening, use a balloon to climb above the cat.
   The cat should not instantly copy that vertical movement.
5. Keep climbing. Once the opening ends, the cat should re-engage rather than
   remaining below or disappearing offscreen.
6. Play naturally for several attacks. The cat should usually pressure the
   upcoming route from above, but Fiddle Drop and Moonshot setup should still
   create readable chances to overtake and counter it.

## Automated verification

- Dedicated logic audit: neutral target band, 60-second pressure balance,
  complete overtake state sequence, skill window, and re-engagement.
- Dedicated 390 × 844 browser audit on source, release package, and exact LAN
  preview with four inspected screenshots and zero browser errors/Firebase
  writes.
- Phase 13 Bow Swipe, Phase 14 Moonshot, Phase 15 Fiddle Drop, and Phase 15.1
  combo catch-up regressions pass.
- Full release matrix passes phone fill, touch swipe, audio, true offline
  reload, fixed-width desktop play, performance sampling, and all 35 assets.
- Release audit verifies 56/56 hashes and the 1,000-seed / 1,672,034-balloon
  route-fairness sample.

This build is local only. GitHub Pages and Firebase production state were not
changed.
