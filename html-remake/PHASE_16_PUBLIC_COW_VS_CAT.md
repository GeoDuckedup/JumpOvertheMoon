# Phase 16 — Public Cow vs Cat

Build `16.0.2` promotes Cow vs Cat from a developer-only test into a public
second mode while keeping one shared game runtime. Movement, balloons,
landmarks, backgrounds, audio, controls, performance work, and future shared
gameplay improvements continue to feed both modes. Cat AI and combat only run
in Cow vs Cat.

The cat remains completely offscreen until the cow pops its first balloon.
That pop starts the existing 2.3-second opening grace, so the player always
gets the opening route before the pursuit begins.

## Public flow

- `OVER THE MOON` starts Classic.
- `COW VS CAT` starts the rival mode from the same main menu.
- Both result cards offer their correct leaderboard, a same-mode retry, and
  `MAIN MENU`.
- The leaderboard has Classic and Cow vs Cat tabs. A finished run may only be
  submitted to the mode that produced it.
- How To Play includes a short Cow vs Cat combat note.

## Score isolation

| System | Over the Moon | Cow vs Cat |
| --- | --- | --- |
| Firebase scores | `/jumpoverthemoon/scores` | `/jumpoverthemoon/cowvscat/scores` |
| Browser cache | `jumpoverthemoon_highscore_cache` | `jumpoverthemoon_cowvscat_highscore_cache` |
| Local best | `over-the-moon.best-height` | `over-the-moon.cow-vs-cat.best-height` |
| Offline queue | Stored inside the Classic cache | Stored inside the Cow vs Cat cache |

The Classic endpoint and existing Classic entries are unchanged. Initials are
shared as a player convenience, but scores, bests, rows, and pending submissions
are not.

Each mode builds its shiny leaderboard balloons from that mode's top ten. The
balloons retain one of the four normal gameplay colors under the gold aura, so
the cow can pop them and continue a color combo. Cat attacks intentionally
ignore leaderboard balloons.

## Firebase rule update required before public deployment

Phase 16 does not publish Firebase rules automatically. In Firebase Console,
open **Realtime Database → Rules**, preserve any unrelated rules, merge in the
new `cowvscat` block, then publish. For the currently documented game-only rule
set, the complete merged rules are:

```json
{
  "rules": {
    "jumpoverthemoon": {
      "scores": {
        ".read": true,
        ".indexOn": ["score"],
        "$entry": {
          ".write": "!data.exists()",
          ".validate": "newData.hasChildren(['initials', 'score', 'timestamp']) && newData.child('initials').isString() && newData.child('initials').val().matches(/^[A-Z0-9]{3}$/) && !newData.child('initials').val().matches(/^(ASS|FUK|FUC|FCK|SHT|SHI|DIK|DIQ|DIC|COK|COC|CUM|FAG|FAT|GAY|GOD|JEW|KKK|NIG|NGA|NGR|PIS|POO|SEX|TIT|TTS|WTF|STF|SUK|SUC|VAG|WOP|KYS|RAP|FKU|CNT|CUN|HOR|HO3|ANU|ANL|BUT|BUM|DAM|DMN|HEL|JIZ|KIK|PEN|PHK|SCK|SLT|SMD)$/) && newData.child('score').isNumber() && newData.child('score').val() >= 0 && newData.child('score').val() <= 999999 && newData.child('timestamp').isNumber()"
        }
      },
      "cowvscat": {
        "scores": {
          ".read": true,
          ".indexOn": ["score"],
          "$entry": {
            ".write": "!data.exists()",
            ".validate": "newData.hasChildren(['initials', 'score', 'timestamp']) && newData.child('initials').isString() && newData.child('initials').val().matches(/^[A-Z0-9]{3}$/) && !newData.child('initials').val().matches(/^(ASS|FUK|FUC|FCK|SHT|SHI|DIK|DIQ|DIC|COK|COC|CUM|FAG|FAT|GAY|GOD|JEW|KKK|NIG|NGA|NGR|PIS|POO|SEX|TIT|TTS|WTF|STF|SUK|SUC|VAG|WOP|KYS|RAP|FKU|CNT|CUN|HOR|HO3|ANU|ANL|BUT|BUM|DAM|DMN|HEL|JIZ|KIK|PEN|PHK|SCK|SLT|SMD)$/) && newData.child('score').isNumber() && newData.child('score').val() >= 0 && newData.child('score').val() <= 999999 && newData.child('timestamp').isNumber()"
          }
        }
      }
    }
  }
}
```

This preserves the current create-only, validated, honor-system policy. It does
not use authentication or prevent a technical player from fabricating a score.

After publishing, these read-only URLs should return JSON or `null`, never a
permission error:

```text
https://over-the-moon-14b50-default-rtdb.firebaseio.com/jumpoverthemoon/scores.json
https://over-the-moon-14b50-default-rtdb.firebaseio.com/jumpoverthemoon/cowvscat/scores.json
```

## Verification

- The deterministic audit mocks both REST endpoints and proves a Cat submission
  performs one Cat-path POST and zero Classic-path POSTs.
- Separate browser storage keys verify bests and offline queues cannot mix.
- Both modes are exercised through the public menu, results, leaderboard tabs,
  retries, and Main Menu flow on phone and desktop layouts.
- No production Firebase write is performed by the automated tests.
- A dedicated first-pop audit holds the opening for 7.3 seconds, verifies that
  the cat remains absent and every opening balloon survives, then confirms the
  grace countdown and cat entrance begin only after the cow's first pop.
