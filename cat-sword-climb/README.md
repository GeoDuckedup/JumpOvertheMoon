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
- R: restart after game over
- Escape: quit

Jump from the ground, then downslash balloons from above to pop them and bounce higher. The ground is safe until you pop your first balloon; after that, touching it ends the run. Falling below the camera is not a failure: the camera tracks you back down and missed balloons stay available for hail mary saves. The screen scrolls upward as you climb, and your score is the highest height reached. Gravity, movement, slash speed, and bounce speed ramp up slowly based on current height, then fall back down as you descend. The sky also shifts gradually from bright atmosphere to dark star field as you climb.

Photorealistic space milestone markers appear as you climb. The first pass includes a space station, the Moon, and Mars. These markers act like oversized one-time balloon targets: downslash them to clear the milestone, trigger a stronger bounce, and keep climbing.
