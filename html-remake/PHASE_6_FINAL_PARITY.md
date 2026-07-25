# Phase 6 — Over the Moon

Phase 6 closes the remaining gameplay and presentation gaps between the native
HTML remake and the Pygame reference: the altitude speed ramp, rare shooting
stars, adaptive ambience, initials entry, and shared top-ten scores.

The Pygame source, Pygbag exports, and shared artwork remain unchanged.

## Altitude speed ramp

The release-tuned multiplier is recalculated from current height:

```text
min(2.0, 1 + current height / 7320)
```

As in the reference, it scales:

- horizontal acceleration and maximum run speed;
- gravity;
- slash dive speed;
- balloon, combo, and landmark bounce speed;
- balloon wobble speed.

The normal ground jump remains unchanged. The wider ramp reaches 1.25× at
1,830 m, 1.5× at 3,660 m, 1.75× at 5,490 m, and the 2× cap at Neptune
(7,320 m). This keeps the early climb more gradual while making the late route
meaningfully faster.

## Shooting stars

Shooting stars are visual only and begin at 900 meters. At most one streak is
active at a time. Their reference wait bands are:

| Altitude | Wait |
| --- | ---: |
| 900–1,800 m | 30–51 seconds |
| 1,800–3,300 m | 26–45 seconds |
| 3,300–5,600 m | 21–38 seconds |
| 5,600 m and above | 19–34 seconds |

Seventy-five percent travel down-left and twenty-five percent travel down-right.
Each has the reference speed, length, lifetime, fade, and segmented trail range.
A separate per-run seeded visual generator ensures a shooting star never changes
the generated balloon route.

## Adaptive ambience

The accepted jump, sword swish, and other event sounds are unchanged. The
balloon now uses a quieter synthesized mouth-style pop: a short lip-pressure
release, small low body, and soft oral resonance. Phase 6 also adds one
intentionally quiet continuous ambience bed:

- lower altitude emphasizes soft filtered air;
- the air opens and fades as the climb rises;
- a very low space hum gradually appears at cosmic altitude;
- the bed fades to 45% after game over;
- mute, the persisted ambience volume, and page-hidden suspension apply to it.

The ambience sources are persistent Web Audio nodes, not new sounds allocated
every frame, and they do not consume the bounded transient sound-effect voices.

## Initials and shared scores

Game over first opens a results splash with peak height, balloons popped, best
color streak, and flight time. Landmark progress remains available in run
state but was intentionally removed from the rendered card during the Phase 9
presentation pass. `VIEW LEADERBOARD` opens the shared-score flow. Every
positive run can be submitted there, even when it will not enter the visible
top ten. The leaderboard, real three-character input, `SUBMIT RUN`,
`BACK TO RESULTS`, and `RUN AGAIN` actions all share one screen.

- Desktop and phone both type directly into the native `A-Z` / `0-9` field.
- On iPhone, tapping the field opens the normal keyboard; Done or
  `SUBMIT RUN` submits once all three characters are present.
- Game shortcuts do not intercept typing while the field is focused.
- A blocked-initials list matches the reference and flashes a correction prompt
  without sending the entry.

Confirmed scores use the existing Firebase REST leaderboard. A successful read
is cached locally. A failed submission stays in a persistent queue and is
retried after a later user-started run, so offline play never blocks retry or
loses an explicitly submitted score.

No score write occurs on load, game over, automated audit, or initials editing.
The write begins only when the player confirms `SUBMIT`.

## Verification

The Phase 6 deterministic audit verifies:

- the exact 7,320-meter formula, 1.5× midpoint, and 2× cap at Neptune;
- altitude-scaled bounce behavior;
- same-seed shooting-star replay, downward direction, and speed/length bounds;
- initials sanitization, native-input isolation, blocked-name handling, and
  one-action submission;
- exactly one submission event after confirmation;
- leaderboard normalization, stable sorting, and top-ten qualification;
- zero network writes during the audit.

The complete Phase 5 regression also still passes 240 seeds and 159,533
balloons with exact route replay, every landmark approach, no clearance
violations, bounded entities, combo behavior, and re-entry behavior.

The phone server serves the Phase 6 page and updated game modules successfully.
A separate read-only request confirmed the existing Firebase leaderboard
endpoint is reachable. Local browser automation remains
unavailable after the earlier allowance was exhausted, so the final screen and
sound judgments stay in the physical checklist.

## Physical phone checklist

1. Reload the existing phone URL and confirm the title says
   `PHASE 6 · OVER THE MOON`.
2. Start a run and listen for a very quiet air bed beneath the accepted jump,
   sword, and balloon sounds.
3. Climb high enough to judge whether the later speed increase is exciting but
   still controllable.
4. At 900 meters or above, leave the game open long enough to see a shooting
   star; the first can take up to 51 seconds after reaching the band.
5. Finish a positive run and confirm the cow is visibly standing on the ground
   behind the new results splash.
6. Check all results rows, then choose `VIEW LEADERBOARD`; tap the initials
   field, type three characters with the phone keyboard, and tap `SUBMIT RUN`.
7. Confirm the top-climbers panel appears and that the game can immediately
   start `RUN AGAIN` even without submitting, or if the network says the score
   is queued locally.
8. Toggle sound off/on and confirm the continuous ambience mutes with the sound
   effects.
9. Check one high-altitude landmark, combo callout, and re-entry fall for visual
   readability on the physical screen.

## Recommended next phase

Phase 7 should be release QA and tuning: use the physical-phone notes to adjust
ambience level, high-altitude speed feel, shooting-star visibility, landmark
scale, combo/re-entry readability, and leaderboard spacing; then complete the
deployment/package pass without changing the core mechanics.
