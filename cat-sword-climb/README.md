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
