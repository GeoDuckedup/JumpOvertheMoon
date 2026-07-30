# Phase 10 — Production Release and Full-Run Balance

Phase 10 turns the native HTML game into a reproducible production release.
It does not change the accepted physics, route density, combo rewards, speed
ramp, landmark geometry, sound design, backgrounds, or ambient-event timing.
The balance pass found no unreachable route, so those values remain intact.

## Release identity

- Phase: `10`
- Build version: `10.3.1`
- Channel: `production`
- Public URL: developer UI and score-mutating test hooks hidden
- DEV URL: append `?dev=1`
- Clear remembered DEV mode: append `?dev=0`

The splash, runtime state, manifest, stylesheet, entry module, internal module
graph, service-worker cache, package metadata, and release manifest now use the
same version. This removes the mixed Phase 6/7/9 cache graph that could leave an
installed Safari app running an older module.

## Full-climb fairness

The release audit generated the complete route through the Black Hole and
1,200 world units beyond it for 1,000 seeds:

| Check | Result |
| --- | ---: |
| Generated balloons | 1,672,034 |
| Landmarks per route | 15 |
| Missing landmark approaches | 0 |
| Landmark-clearance violations | 0 |
| Unreachable required altitude groups | 0 |
| Smallest modeled vertical reserve | 48.31 px |
| Smallest modeled horizontal reserve | 84.76 px |
| Largest required vertical step | 435 px |

The reachability model follows the main route, treats same-altitude main
balloons as legitimate route choices, includes the ground jump and every
landmark bounce, uses the real altitude multiplier, allows a conservative
70-pixel portion of the sword's downward reach, and calculates horizontal
travel to the descending collision pass. Actual maximum sword reach is larger,
so the model retains a deliberate safety margin.

At the Black Hole, the retained-route stress run held 1,697 historical balloons
in 118 compact chunks while only 25 balloons and three nearby chunks were
active. A separate descent regression still restores old balloons, preserves
popped IDs, and keeps the active collection at or below 42. The old-game fall
experience therefore remains without drawing or colliding against the entire
climb every frame.

## Runtime and browser hardening

- Added an HTTPS/localhost service worker with a versioned offline shell.
- Precached all 25 image assets, the audio file, HTML, CSS, manifest, and every
  JavaScript module.
- Verified a real browser can go offline, reload, decode all 25 assets, and
  return to the Phase 10 splash with no asset failure.
- Kept navigation network-first so a connected launch can receive a new build;
  cached shell fallback is used when offline.
- Kept normal LAN HTTP testing functional. Service workers require HTTPS or
  localhost, so the same-Wi-Fi IP preview does not claim offline installability.
- Hid the developer button and mutation/debug API on a fresh public URL.
  Explicit DEV activation remains persistent for iPhone Home Screen testing.
- Filtered malformed, zero-score, and blocked-initial rows received from the
  shared leaderboard before rendering them.
- Simplified the public splash to the artwork, `OVER THE MOON`,
  `HOW TO PLAY`, `LEADERBOARD`, and sound. The menu leaderboard is read-only;
  initials and submission remain available only after a completed run.
- Raised only the tall touch-screen camera framing so the grounded cow clears
  the controls by 32 CSS pixels in the 390 × 844 audit. Physics, height
  calculations, route geometry, and desktop framing remain unchanged.
- Reduced the distant bird scale, changed it to an off-white two-tone
  silhouette, and increased its wingbeat to 4.2–5 Hz.
- Removed the on-screen fullscreen button from desktop play while retaining the
  `F` keyboard shortcut and `Esc` exit behavior.
- Tuned the vertical camera follow zone to 44%–57%, placing the rising cow
  slightly above center while retaining a restrained, natural camera range.

## Reproducible package

From `html-remake/`:

```bash
npm run build
npm run audit
```

The build writes `release/over-the-moon/`. It contains only the public HTML
runtime and the 25 game assets it references—not source history, approval
images, test captures, Python code, or repository metadata. The current bundle
contains 46 hashed files and is about 6.46 MB.

The builder will replace only a directory containing its own
`.over-the-moon-release` marker. It refuses to delete an unrelated directory.
`release-manifest.json` records the build identity, file count, byte total, and
SHA-256 hash of every packaged file.

Serve the release directory as the web root and open `/html-remake/`:

```bash
python3 -m http.server 5174 \
  --bind 0.0.0.0 \
  --directory release/over-the-moon
```

Production hosting should use HTTPS.

### GitHub Pages root package

The established public URL is
`https://geoduckedup.github.io/JumpOvertheMoon/`, published from `main:/docs`.
Build and audit the exact root deployment with:

```bash
npm run ship:pages
```

This replaces the old Pygbag files in `docs/` with the HTML release at the same
root URL. It rewrites only the generated asset, manifest, and service-worker
paths needed by that hosting layout. The source runtime continues to use the
same Firebase project and `/jumpoverthemoon/scores` path, so deploying the
frontend does not migrate or replace leaderboard entries.

## Verification

Phase 10 passed:

- syntax checks for the complete runtime, service worker, build script, and
  release audits;
- the Phase 5 240-seed / 401,430-balloon route and mechanics regression;
- Phase 6 speed, combo, landing, initials, and leaderboard logic;
- Phase 7 landmark, DEV warp, compact history, descent rehydration, and 1×
  speed-lock checks;
- Phase 9 background, ambience, HUD/results, belly-up death, bird, saucer, and
  shared-event-lane checks;
- Safari hold, release, swipe-direction, selection, callout, and native-input
  isolation checks;
- the required gameplay client with movement and jump/slash input;
- a fresh public 390 × 844 phone context;
- a query-gated DEV 390 × 844 phone context;
- a true service-worker-controlled offline reload;
- the packaged 1,440 × 900 desktop build, capped at 500 CSS pixels wide; and
- all 46 release hashes.

Focused stable-chapter renders remain around 0.08–0.11 ms in the local headless
measurement. A deliberately harsher 180-frame tight-loop test that lets the cow
fall through and rehydrate route history ranged from about 1.5 ms near ground
to 17.0 ms around the Black Hole on the MED profile. These are local comparative
work measurements, not physical-device FPS claims. The existing adaptive
MED-to-LOW downgrade remains the safety net under sustained real-frame pressure.

## Physical-device release checklist

1. On iPhone Safari, open the normal URL with `?dev=0`. Confirm the clean
   three-button menu, open and close `HOW TO PLAY`, view the read-only
   leaderboard, then start a run with `OVER THE MOON`.
2. Hold left, slide the same finger to right and back, then release. Confirm
   direction and pressed highlights follow the finger with no selection,
   magnifier, or callout.
3. Play one normal run with sound on. Judge the jump, sword swish, quiet mouth
   pop, ambience, and late-climb 2× control feel.
4. Open the DEV URL, warp to two lower landmarks and two upper landmarks, and
   play the remaining three-balloon approaches.
5. Warp to the Black Hole, then fall several thousand meters. Confirm the old
   balloons reappear smoothly and the phone does not hitch.
6. Trigger one bird and one saucer from the DEV panel. Confirm the bird reads
   as a small pale flapping bird rather than a dark streak.
7. Die, inspect `SPLAT!`, open the leaderboard, edit three initials, dismiss the
   keyboard, and start another run without submitting.
8. Submit one real run only if you want it on the shared board.
9. Add the production HTTPS build to the Home Screen, launch it once online,
   then test one offline relaunch.
10. On desktop Chrome or Safari, confirm the game remains centered at a fixed
    width and keyboard movement, Space, sound, and fullscreen work.

## Next handoff

Build `10.3.1` is the current GitHub Pages-ready production package. Top-ten
scores now appear at their exact recorded heights as optional, interactive
four-color balloons with a gold aura, rank, and initials. They pop and bounce
like normal balloons, participate in the combo matching their displayed color,
and do not alter the generated safe route. Future changes should preserve the
Pages-root build and run the same physical-device, offline, leaderboard, and
exact-URL checks before each push.
