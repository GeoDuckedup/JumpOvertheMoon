# Cow Sword Climb

A small Pygame arcade prototype about a sword-swinging cow climbing as high as possible by downslashing balloons.

## Run

```bash
./run_local.sh
```

If Pygame is missing:

```bash
python3 -m pip install -r requirements.txt
```

## Web Build

```bash
./build_web.sh
```

This runs pygbag and copies the generated browser build to the repo-root `docs/` and `web/` folders. Use `docs/` for GitHub Pages.

## High Scores

The planned shared leaderboard uses Firebase Realtime Database through its REST API so it can work in both desktop Python and the pygbag web build. Scores will live in the Firebase project `over-the-moon-14b50` under this path:

```text
/jumpoverthemoon/scores
```

Before enabling the in-game leaderboard code, set up Firebase manually:

1. Open Firebase Console -> Realtime Database -> Data.
2. Copy the exact database URL shown at the top of the data view. It should look like either `https://over-the-moon-14b50-default-rtdb.firebaseio.com` or `https://over-the-moon-14b50-default-rtdb.<region>.firebasedatabase.app`.
3. Open Realtime Database -> Rules.
4. Replace the locked starter rules with the scoped rules below.
5. Click Publish.

```json
{
  "rules": {
    "jumpoverthemoon": {
      "scores": {
        ".read": true,
        ".indexOn": ["score"],
        "$entry": {
          ".write": "!data.exists()",
          ".validate": "newData.hasChildren(['initials', 'score', 'timestamp']) && newData.child('initials').isString() && newData.child('initials').val().matches(/^[A-Z0-9]{3}$/) && newData.child('score').isNumber() && newData.child('score').val() >= 0 && newData.child('score').val() <= 999999 && newData.child('timestamp').isNumber()"
        }
      }
    }
  }
}
```

These rules intentionally keep the rest of the database locked while allowing the game to create leaderboard entries and read the top scores. This is still an honor-system leaderboard: validation prevents malformed records and overwrites, but it does not prevent a technical player from submitting fake scores. A stricter version would require Firebase Auth, App Check, or a Cloud Function, which is a later-phase tradeoff.

After publishing the rules, test the REST endpoint in a browser:

```text
https://YOUR_DATABASE_URL/jumpoverthemoon/scores.json
```

An empty leaderboard should return `null`. A permission error means the rules are still locked or the URL/path is wrong.

## Controls

- Left/right arrows: move
- Spacebar on ground: jump
- Spacebar in air: downslash
- P: toggle speed ramp for testing
- R: restart after game over
- Escape: quit

Jump from the ground, then downslash balloons from above to pop them and bounce higher. The ground is safe until you pop your first balloon; after that, touching it ends the run. Falling below the camera is not a failure: the camera tracks you back down and missed balloons stay available for hail mary saves. The screen scrolls upward as you climb, and your score is the highest height reached. Gravity, movement, slash speed, and bounce speed ramp up slowly based on current height, then fall back down as you descend. The sky also shifts gradually from bright atmosphere to dark star field as you climb.

Photorealistic milestone markers appear as you climb. The current sequence is a prop plane, the space station, the Moon, Mars, Jupiter, Saturn, Uranus, and Neptune. These markers act like oversized one-time balloon targets: downslash them to clear the milestone, trigger a stronger bounce, and keep climbing.

The current milestone heights are 380m, 700m, 1060m, 1460m, 1890m, 2340m, 2820m, and 3330m so each landmark has more room to feel like a progression moment.

Each new run generates a fresh hybrid balloon layout with a guaranteed main route plus optional side balloons. Main-route balloons are constrained to drift by a limited amount from the previous target, and milestone gaps re-anchor the route at the landmark so the climb stays possible without relying on color bonuses. Each landmark also gets a clean approach balloon just below its no-balloon zone so the setup swing is fair. Side balloons appear near the route with left/right offsets, creating extra choices that can feel good to hit or skip. Color sequencing creates combo opportunity patterns around those side balloons, including wrong-color decoys and same-color side detours. If you pop three balloons of the same color in a row, the third pop and any continued same-color pops give a roughly 1.5x-height bounce until the streak breaks; skipped balloons and landmarks do not reset the streak. The HUD shows your current color streak, and boosted pops create a larger burst with a floating `combo!` callout.
