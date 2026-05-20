#!/usr/bin/env python3
"""Characterize gameplay-sensitive state before/after refactors.

This is intentionally a lightweight smoke/behavior script rather than a full
test suite. It focuses on the systems most likely to drift during the main.py
split: milestones, deterministic balloon generation, combo state, and landmark
clearance/approach guarantees.
"""

import argparse
import hashlib
import importlib.util
import json
import os
import random
import sys
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
MAIN_PATH = ROOT / "main.py"
SEEDS = (101, 202, 303, 404)


def load_game_module():
    os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
    sys.path.insert(0, str(ROOT))
    spec = importlib.util.spec_from_file_location("cow_sword_climb_main", MAIN_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    import constants

    exported_constants = {
        name: getattr(constants, name)
        for name in dir(constants)
        if name.isupper()
    }
    return SimpleNamespace(Game=module.Game, **exported_constants)


def color_index(module, color):
    return module.BALLOON_COLORS.index(color)


def detect_combo_patterns(module, balloons):
    patterns = {"side_decoy": 0, "side_finish": 0, "side_middle": 0}
    main_indices = [i for i, balloon in enumerate(balloons) if balloon.route_role == "main"]

    for i, side in enumerate(balloons):
        if side.route_role != "side":
            continue

        previous_main_indices = [idx for idx in main_indices if idx < i]
        next_main_indices = [idx for idx in main_indices if idx > i]
        if not previous_main_indices:
            continue

        anchor = balloons[previous_main_indices[-1]]
        prev_before_anchor = (
            balloons[previous_main_indices[-2]] if len(previous_main_indices) >= 2 else None
        )
        prev_two_before_anchor = (
            balloons[previous_main_indices[-3]] if len(previous_main_indices) >= 3 else None
        )
        next_main = balloons[next_main_indices[0]] if next_main_indices else None

        if prev_before_anchor and next_main:
            if (
                prev_before_anchor.color == anchor.color == next_main.color
                and side.color != anchor.color
            ):
                patterns["side_decoy"] += 1
            if (
                prev_before_anchor.color == side.color == next_main.color
                and anchor.color != side.color
            ):
                patterns["side_middle"] += 1

        if prev_two_before_anchor and prev_before_anchor:
            if (
                prev_two_before_anchor.color == prev_before_anchor.color == side.color
                and anchor.color != side.color
            ):
                patterns["side_finish"] += 1

    return patterns


def reset_with_seed(game, seed):
    game.run_seed_rng = random.Random(seed)
    game.reset()


def balloon_gen(game):
    return getattr(game, "balloon_gen", game)


def extend_through_all_markers(game):
    marker_top = min(marker.y for marker in game.goal_markers)
    generator = balloon_gen(game)
    while generator.next_balloon_y > marker_top - 700:
        game.balloons.extend(generator.spawn_balloon())


def summarize_seed(module, game, seed):
    reset_with_seed(game, seed)
    extend_through_all_markers(game)

    balloons = game.balloons
    main_count = sum(1 for balloon in balloons if balloon.route_role == "main")
    side_count = sum(1 for balloon in balloons if balloon.route_role == "side")
    patterns = detect_combo_patterns(module, balloons)

    sample = [
        {
            "role": balloon.route_role,
            "x": round(balloon.x, 2),
            "y": round(balloon.y, 2),
            "radius": balloon.radius,
            "color": color_index(module, balloon.color),
        }
        for balloon in balloons[:32]
    ]

    approach_gaps = {}
    generator = balloon_gen(game)
    for marker in game.goal_markers:
        _, bottom = generator.goal_marker_balloon_clearance_band(marker)
        candidates = [
            balloon
            for balloon in balloons
            if balloon.route_role == "main"
            and balloon.y > bottom
            and balloon.y <= bottom + module.GOAL_APPROACH_BALLOON_GAP + 2
            and abs(balloon.x - marker.x) <= module.GOAL_APPROACH_X_JITTER + 1
        ]
        if not candidates:
            approach_gaps[marker.name] = None
            continue

        nearest = min(candidates, key=lambda balloon: balloon.y - bottom)
        approach_gaps[marker.name] = {
            "gap": round(nearest.y - bottom, 2),
            "dx": round(abs(nearest.x - marker.x), 2),
        }

    clearance_violations = [
        [balloon.route_role, round(balloon.y, 2)]
        for balloon in balloons
        if generator.goal_marker_near_balloon_y(balloon.y)
    ]

    return {
        "seed": seed,
        "balloon_count": len(balloons),
        "main_count": main_count,
        "side_count": side_count,
        "patterns": patterns,
        "sample": sample,
        "approach_gaps": approach_gaps,
        "clearance_violations": clearance_violations,
    }


def characterize():
    module = load_game_module()
    import pygame

    game = module.Game()
    marker_summary = [
        {
            "name": marker["name"],
            "asset": marker["asset_name"],
            "height": marker["height"],
        }
        for marker in module.GOAL_MARKER_DATA
    ]
    sprite_keys = sorted(game.goal_marker_sprites.keys()) if game.goal_marker_sprites else []

    red, yellow = module.BALLOON_COLORS[:2]
    combo_sequence = [game.register_balloon_combo_hit(red) for _ in range(5)]
    combo_state_after_five = [
        color_index(module, game.hit_combo_color),
        game.hit_combo_streak,
    ]
    break_result = game.register_balloon_combo_hit(yellow)
    combo_state_after_break = [
        color_index(module, game.hit_combo_color),
        game.hit_combo_streak,
    ]

    game.speed_ramp_enabled = False
    game.speed_multiplier = 1.37
    game.update_speed_multiplier()
    speed_ramp_off_multiplier = game.speed_multiplier

    seed_summaries = [summarize_seed(module, game, seed) for seed in SEEDS]

    pygame.quit()

    payload = {
        "markers": marker_summary,
        "goal_sprite_keys": sprite_keys,
        "combo": {
            "sequence_same_color": combo_sequence,
            "state_after_five": combo_state_after_five,
            "break_result": break_result,
            "state_after_break": combo_state_after_break,
            "height_multiplier": module.COMBO_BOUNCE_HEIGHT_MULTIPLIER,
            "speed": round(module.COMBO_BOUNCE_SPEED, 4),
        },
        "speed_ramp_off_multiplier": speed_ramp_off_multiplier,
        "seeds": seed_summaries,
    }

    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    payload["fingerprint"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return payload


def validate(payload):
    expected_markers = [
        ("Prop Plane", 380),
        ("Space Station", 700),
        ("Moon", 1060),
        ("Mars", 1460),
        ("Jupiter", 1890),
        ("Saturn", 2340),
        ("Uranus", 2820),
        ("Neptune", 3330),
    ]
    markers = [(marker["name"], marker["height"]) for marker in payload["markers"]]
    assert markers == expected_markers, markers
    assert payload["goal_sprite_keys"] == [
        "airplane",
        "jupiter",
        "mars",
        "moon",
        "neptune",
        "saturn",
        "station",
        "uranus",
    ]
    assert payload["combo"]["sequence_same_color"] == [False, False, True, True, True]
    assert payload["combo"]["state_after_five"] == [0, 5]
    assert payload["combo"]["break_result"] is False
    assert payload["combo"]["state_after_break"] == [1, 1]
    assert payload["combo"]["height_multiplier"] == 1.5
    assert payload["speed_ramp_off_multiplier"] == 1.0

    for seed_summary in payload["seeds"]:
        assert not seed_summary["clearance_violations"], seed_summary
        assert all(value is not None for value in seed_summary["approach_gaps"].values())
        assert seed_summary["main_count"] > seed_summary["side_count"]
        assert seed_summary["side_count"] > 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true", help="print full JSON payload")
    args = parser.parse_args()

    payload = characterize()
    validate(payload)

    if args.json:
        print(json.dumps(payload, indent=2, sort_keys=True))
        return

    print(f"fingerprint: {payload['fingerprint']}")
    print("markers:", ", ".join(f"{m['name']}={m['height']}m" for m in payload["markers"]))
    print("combo sequence:", payload["combo"]["sequence_same_color"])
    for seed_summary in payload["seeds"]:
        pattern_total = sum(seed_summary["patterns"].values())
        print(
            "seed {seed}: balloons={balloon_count} main={main_count} "
            "side={side_count} patterns={patterns}".format(
                seed=seed_summary["seed"],
                balloon_count=seed_summary["balloon_count"],
                main_count=seed_summary["main_count"],
                side_count=seed_summary["side_count"],
                patterns=pattern_total,
            )
        )


if __name__ == "__main__":
    main()
