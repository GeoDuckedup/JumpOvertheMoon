# Over the Moon

The native HTML release of the sword-swinging cow climbing game. The original
Pygame implementation remains under `cat-sword-climb/` as the gameplay and
historical reference.

## Run the HTML game

```bash
python3 -m http.server 5173
```

Open `http://127.0.0.1:5173/html-remake/`.

## Build and verify the GitHub Pages release

```bash
cd html-remake
npm run ship:pages
```

This generates a protected, root-relative production build in `docs/`, which
GitHub Pages publishes at:

<https://geoduckedup.github.io/JumpOvertheMoon/>

The Pages build keeps the existing Firebase Realtime Database leaderboard at
`/jumpoverthemoon/scores`. The original Pygbag build script remains available
under `cat-sword-climb/` but no longer owns the public `docs/` deployment.

## Current production

Build `16.0.2` includes two public modes from one shared HTML game runtime:

- `OVER THE MOON` — the classic endless balloon climb.
- `COW VS CAT` — the same climb with the jetpack rival, Bow Swipe, Moonshot,
  Fiddle Drop, counters, and a separate leaderboard.

The cat waits until the cow pops its first balloon. An unprotected Moonshot
now applies full sideways/downward impact, while a correctly timed downward
slash clanks the attack and rebounds the cow. Each mode keeps isolated local
bests, offline queues, Firebase score paths, and interactive top-score
balloons. See `html-remake/PHASE_16_PUBLIC_COW_VS_CAT.md` for production flow,
Firebase rules, and verification details.
