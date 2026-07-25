#!/usr/bin/env python3
"""Capture the Pygame behavior contract used by the native HTML rebuild.

The generated JSON intentionally mixes exact behavior data with indicative native
dummy-driver performance samples. Exact fields should remain stable until a
gameplay change is deliberately approved. Performance fields are observations and
must not be treated as deterministic test expectations.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import random
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Optional


REPO_ROOT = Path(__file__).resolve().parents[2]
PYGAME_ROOT = REPO_ROOT / "cat-sword-climb"
PYGAME_SCRIPTS = PYGAME_ROOT / "scripts"

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

sys.path.insert(0, str(PYGAME_ROOT))
sys.path.insert(0, str(PYGAME_SCRIPTS))

import pygame  # noqa: E402

import constants as C  # noqa: E402
from game import Game  # noqa: E402
from name_entry import ALPHABET, BLOCKED_INITIALS, NAME_LENGTH  # noqa: E402
from refactor_characterization import characterize, validate  # noqa: E402


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_text(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def file_record(path: Path) -> dict[str, Any]:
    return {
        "path": path.relative_to(REPO_ROOT).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }


def asset_manifest() -> list[dict[str, Any]]:
    pygame.init()
    records = []
    active_names = {
        "cat_idle.png",
        "cat_jump.png",
        "cat_slash.png",
        "cat_fall.png",
        *(f"balloon_{name}.png" for name in C.BALLOON_SPRITE_NAMES),
        *(f"goal_{marker['asset_name']}.png" for marker in C.GOAL_MARKER_DATA),
        "reentry_trail_light.png",
        "splash_over_the_moon.png",
    }

    for path in sorted(C.ASSET_DIR.glob("*.png")):
        surface = pygame.image.load(path)
        record = file_record(path)
        record.update(
            {
                "width": surface.get_width(),
                "height": surface.get_height(),
                "active": path.name in active_names,
            }
        )
        records.append(record)
    pygame.quit()
    return records


def exact_contract() -> dict[str, Any]:
    return {
        "display": {
            "logical_width": C.WIDTH,
            "logical_height": C.HEIGHT,
            "fps_cap": C.FPS,
            "maximum_delta_seconds": round(1 / 30, 8),
            "world_floor_y": C.WORLD_FLOOR_Y,
            "camera_follow_top_ratio": 0.38,
            "camera_follow_bottom_ratio": 0.64,
            "debug_camera_anchor_ratio": 0.48,
        },
        "physics": {
            "gravity": C.GRAVITY,
            "move_acceleration": C.MOVE_ACCEL,
            "maximum_run_speed": C.MAX_RUN_SPEED,
            "air_drag_per_update": C.AIR_DRAG,
            "player_width": C.CAT_W,
            "player_height": C.CAT_H,
            "ground_jump_speed": C.GROUND_JUMP_SPEED,
            "normal_bounce_speed": C.BOUNCE_SPEED,
            "match_bounce_speed": C.MATCH_BOUNCE_SPEED,
            "combo_bounce_speed": C.COMBO_BOUNCE_SPEED,
            "goal_bounce_speed": C.GOAL_BOUNCE_SPEED,
            "slash_time": C.SLASH_TIME,
            "slash_windup_ratio": C.SLASH_WINDUP_RATIO,
            "slash_cooldown": C.SLASH_COOLDOWN,
            "slash_dive_speed": C.SLASH_DIVE_SPEED,
            "balloon_sword_hit_padding": 16,
            "balloon_must_be_below_player_by": 4,
            "horizontal_wrap_padding": C.CAT_W,
            "hit_pause_seconds": C.HIT_PAUSE_TIME,
        },
        "combo": {
            "match_streak_target": C.MATCH_STREAK_TARGET,
            "combo_streak_target": C.COMBO_STREAK_TARGET,
            "match_height_multiplier": C.MATCH_BOUNCE_HEIGHT_MULTIPLIER,
            "combo_height_multiplier": C.COMBO_BOUNCE_HEIGHT_MULTIPLIER,
            "feedback_seconds": C.COMBO_FEEDBACK_TIME,
            "skips_break_streak": False,
            "landmarks_break_streak": False,
        },
        "route_generation": {
            "balloon_spacing_min": C.BALLOON_SPACING_MIN,
            "balloon_spacing_max_exclusive": C.BALLOON_SPACING_MAX,
            "maximum_main_horizontal_drift": C.BALLOON_MAX_HORIZONTAL_DRIFT,
            "optional_side_chance": C.OPTIONAL_SIDE_BALLOON_CHANCE,
            "side_x_offset_min": C.OPTIONAL_SIDE_BALLOON_MIN_X_OFFSET,
            "side_x_offset_max": C.OPTIONAL_SIDE_BALLOON_MAX_X_OFFSET,
            "side_y_jitter": C.OPTIONAL_SIDE_BALLOON_Y_JITTER,
            "goal_clearance_top": C.GOAL_BALLOON_CLEARANCE_TOP,
            "goal_clearance_bottom": C.GOAL_BALLOON_CLEARANCE_BOTTOM,
            "goal_approach_gap": C.GOAL_APPROACH_BALLOON_GAP,
            "goal_approach_x_jitter": C.GOAL_APPROACH_X_JITTER,
            "initial_preload_top_y": -1800,
            "runtime_spawn_ahead_pixels": 1200,
            "active_color_rgb": [list(color) for color in C.BALLOON_COLORS],
            "active_color_names": list(C.BALLOON_SPRITE_NAMES),
        },
        "progression": {
            "speed_ramp_height": C.SPEED_RAMP_HEIGHT,
            "maximum_speed_multiplier": C.MAX_SPEED_MULTIPLIER,
            "atmosphere_fade_height": C.ATMOSPHERE_FADE_HEIGHT,
            "reentry_minimum_height": C.REENTRY_MIN_HEIGHT,
            "reentry_fall_distance": C.REENTRY_LIGHT_FALL_DISTANCE,
            "reentry_minimum_fall_speed": C.REENTRY_MIN_FALL_SPEED,
            "markers": [dict(marker) for marker in C.GOAL_MARKER_DATA],
        },
        "run_rules": {
            "score": "greatest integer height reached in meters",
            "floor_safe_before_first_pop": True,
            "floor_fatal_after_first_pop": True,
            "falling_below_camera_is_fatal": False,
            "horizontal_edges_wrap": True,
        },
        "controls": {
            "keyboard": {
                "move": ["ArrowLeft", "ArrowRight"],
                "jump_or_downslash": "Space",
                "speed_ramp_debug_toggle": "P",
                "mobile_overlay_debug_toggle": "M",
                "altitude_debug_jump": "T",
                "retry_after_game_over": "R",
                "quit": "Escape",
            },
            "touch": {
                "buttons": ["left", "right", "action"],
                "action_ground": "jump",
                "action_air": "downslash",
                "action_game_over": "retry",
                "action_name_entry": "enter",
            },
        },
        "name_entry": {
            "alphabet": ALPHABET,
            "length": NAME_LENGTH,
            "blocked_initials": sorted(BLOCKED_INITIALS),
            "confirmation_choices": ["submit", "redo"],
        },
    }


def rebuild_contract() -> dict[str, Any]:
    return {
        "display": {
            "phone_portrait_css": "100dvw x 100dvh",
            "desktop_max_css_width": 500,
            "logical_width": 540,
            "logical_height_formula": "540 * viewport_height / viewport_width",
            "safe_area_aware": True,
            "landscape_phone_behavior": "rotate-device overlay",
            "dpr_caps": {"LOW": 1.15, "MED": 1.5, "HIGH": 2.0},
        },
        "runtime": {
            "fixed_simulation_hz": 60,
            "render_driver": "requestAnimationFrame",
            "pause_while_hidden": True,
            "bounded_transient_arrays": True,
            "prune_world_behind_camera": True,
            "deterministic_hooks": [
                "window.advanceTime(ms)",
                "window.render_game_to_text()",
            ],
        },
        "audio": {
            "required": True,
            "unlock_gesture": "Start",
            "independent_buses": ["effects", "ambience_or_music"],
            "persistent_mute_and_volume": True,
            "pause_while_hidden": True,
            "required_events": [
                "jump",
                "slash",
                "balloon_pop",
                "bounce",
                "match",
                "combo",
                "landing",
                "death",
                "landmark_hit",
                "reentry",
                "ui_navigation",
                "initials_entry",
                "submit",
                "retry",
            ],
        },
        "target_viewports": [
            {"width": 375, "height": 667, "class": "compact_phone"},
            {"width": 390, "height": 844, "class": "phone"},
            {"width": 430, "height": 932, "class": "tall_phone"},
            {"width": 768, "height": 1024, "class": "tablet"},
            {"width": 1440, "height": 900, "class": "desktop"},
        ],
    }


def disable_network_tick(game: Game) -> None:
    game.highscore_service.tick = lambda: None


def make_seeded_game(seed: int = 101) -> Game:
    game = Game()
    game.run_seed_rng = random.Random(seed)
    game.reset()
    disable_network_tick(game)
    return game


def profile_scene(height: int, frames: int) -> dict[str, Any]:
    game = make_seeded_game()
    if height:
        game.debug_jump_to_altitude(height)

    for _ in range(12):
        game.update(1 / C.FPS)
        game.draw()

    initial_balloons = len(game.balloons)
    start = time.perf_counter()
    for _ in range(frames):
        game.update(1 / C.FPS)
        game.draw()
    elapsed = time.perf_counter() - start
    result = {
        "height_requested_m": height,
        "frames": frames,
        "elapsed_seconds": round(elapsed, 6),
        "average_frame_work_ms": round(elapsed * 1000 / frames, 4),
        "initial_balloon_count": initial_balloons,
        "final_balloon_count": len(game.balloons),
        "note": "Native Pygame dummy-driver observation; not a browser FPS claim.",
    }
    pygame.quit()
    return result


def capture_native_screenshots(output_dir: Path) -> list[dict[str, Any]]:
    if not output_dir.is_absolute():
        output_dir = REPO_ROOT / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    captures = []
    for height in (0, 900, 3300, 5600):
        game = make_seeded_game()
        if height:
            game.debug_jump_to_altitude(height)
        game.draw()
        filename = f"height-{height:04d}m.png"
        path = output_dir / filename
        pygame.image.save(game.screen, path)
        captures.append(
            {
                "height_m": height,
                "path": path.relative_to(REPO_ROOT).as_posix(),
                "width": game.screen.get_width(),
                "height": game.screen.get_height(),
                "sha256": sha256(path),
            }
        )
        pygame.quit()
    return captures


def browser_capture_manifest() -> list[dict[str, Any]]:
    screenshot_root = REPO_ROOT / "html-remake" / "reference" / "screenshots"
    captures = []
    for name in ("browser-splash", "browser-gameplay"):
        directory = screenshot_root / name
        shot = directory / "shot-0.png"
        errors = directory / "errors-0.json"
        if not shot.exists():
            continue
        record = {
            "name": name,
            "screenshot": file_record(shot),
            "console_errors": [],
        }
        if errors.exists():
            record["errors_file"] = file_record(errors)
            record["console_errors"] = json.loads(errors.read_text(encoding="utf-8"))
        captures.append(record)
    return captures


def build_payload(profile_frames: int, screenshots_dir: Optional[Path]) -> dict[str, Any]:
    characterization = characterize()
    validate(characterization)

    release_files = [
        REPO_ROOT / "docs" / "index.html",
        REPO_ROOT / "docs" / "cat-sword-climb.tar.gz",
        REPO_ROOT / "docs" / "cat-sword-climb.apk",
        REPO_ROOT / "docs" / "splash_over_the_moon.png",
    ]
    payload = {
        "schema": "over-the-moon-html-rebuild-reference-v1",
        "source": {
            "commit": git_text("rev-parse", "HEAD"),
            "commit_subject": git_text("show", "-s", "--format=%s", "HEAD"),
            "python": platform.python_version(),
            "pygame": pygame.version.ver,
            "characterization_fingerprint": characterization["fingerprint"],
        },
        "exact_contract": exact_contract(),
        "rebuild_contract": rebuild_contract(),
        "characterization": characterization,
        "assets": asset_manifest(),
        "browser_release_files": [file_record(path) for path in release_files],
    }

    if profile_frames:
        payload["native_dummy_performance"] = {
            "ground": profile_scene(0, profile_frames),
            "height_5000m": profile_scene(5000, profile_frames),
        }
    if screenshots_dir is not None:
        payload["native_screenshots"] = capture_native_screenshots(screenshots_dir)
    browser_captures = browser_capture_manifest()
    if browser_captures:
        payload["browser_captures"] = browser_captures
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--profile-frames",
        type=int,
        default=0,
        help="capture indicative native dummy-driver frame work",
    )
    parser.add_argument(
        "--screenshots-dir",
        type=Path,
        help="save native reference screenshots to this directory",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="write JSON to this path instead of stdout",
    )
    args = parser.parse_args()
    if args.profile_frames < 0:
        parser.error("--profile-frames must be non-negative")

    payload = build_payload(args.profile_frames, args.screenshots_dir)
    encoded = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding="utf-8")
        print(
            f"wrote {args.output} "
            f"(fingerprint {payload['source']['characterization_fingerprint']})"
        )
    else:
        print(encoded, end="")


if __name__ == "__main__":
    main()
