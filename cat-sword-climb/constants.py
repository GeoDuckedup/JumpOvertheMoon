import math
from pathlib import Path


WIDTH = 540
HEIGHT = 800
FPS = 60
ASSET_DIR = Path(__file__).resolve().parent / "assets"

GRAVITY = 1550.0
MOVE_ACCEL = 2400.0
MAX_RUN_SPEED = 360.0
AIR_DRAG = 0.86

CAT_W = 38
CAT_H = 46
SLASH_TIME = 0.28
SLASH_WINDUP_RATIO = 0.38
SLASH_COOLDOWN = 0.12
SLASH_DIVE_SPEED = 560.0
HIT_PAUSE_TIME = 0.055
GROUND_JUMP_SPEED = 860.0
BOUNCE_SPEED = 920.0
COMBO_STREAK_TARGET = 3
COMBO_BOUNCE_HEIGHT_MULTIPLIER = 1.5
COMBO_BOUNCE_SPEED = BOUNCE_SPEED * math.sqrt(COMBO_BOUNCE_HEIGHT_MULTIPLIER)
COMBO_FEEDBACK_TIME = 0.75
SPEED_RAMP_HEIGHT = 5200.0
MAX_SPEED_MULTIPLIER = 1.7

WORLD_FLOOR_Y = 660.0
BALLOON_SPACING_MIN = 115
BALLOON_SPACING_MAX = 180
BALLOON_MAX_HORIZONTAL_DRIFT = 150
OPTIONAL_SIDE_BALLOON_CHANCE = 0.35
OPTIONAL_SIDE_BALLOON_MIN_X_OFFSET = 130
OPTIONAL_SIDE_BALLOON_MAX_X_OFFSET = 245
OPTIONAL_SIDE_BALLOON_Y_JITTER = 46
COLOR_COMBO_FIRST_GAP_MIN = 5
COLOR_COMBO_FIRST_GAP_MAX = 9
COLOR_COMBO_REPEAT_GAP_MIN = 11
COLOR_COMBO_REPEAT_GAP_MAX = 18
COLOR_REPEAT_CHANCE = 0.35

SKY_TOP = (42, 54, 86)
SKY_BOTTOM = (123, 177, 204)
SPACE_TOP = (3, 5, 18)
SPACE_BOTTOM = (13, 18, 42)
ATMOSPHERE_FADE_HEIGHT = 950.0
INK = (28, 25, 31)
WHITE = (245, 245, 239)
CAT = (236, 190, 124)
CAT_DARK = (132, 88, 58)
SCARF = (210, 58, 62)
SWORD = (226, 238, 242)
SWORD_EDGE = (101, 134, 148)
BALLOON_COLORS = [
    (239, 86, 94),
    (255, 190, 81),
    (108, 209, 132),
    (88, 177, 235),
    (190, 112, 230),
]
BALLOON_SPRITE_NAMES = ("red", "yellow", "green", "blue", "purple")
BALLOON_SPRITE_BASE_RADIUS = 43.0
BALLOON_SPRITE_CENTER_Y = 48.0
GOAL_BOUNCE_SPEED = 1080.0
GOAL_POP_TIME = 0.5
GOAL_BALLOON_CLEARANCE_TOP = 95
GOAL_BALLOON_CLEARANCE_BOTTOM = 80
GOAL_APPROACH_BALLOON_GAP = 42
GOAL_APPROACH_X_JITTER = 58
GOAL_MARKER_DATA = [
    {
        "name": "Prop Plane",
        "asset_name": "airplane",
        "height": 380,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 80,
        "hit_width": 270,
        "hit_height": 95,
        "hit_offset_y": 18,
    },
    {
        "name": "Space Station",
        "asset_name": "station",
        "height": 700,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 84,
        "hit_width": 280,
        "hit_height": 130,
        "hit_offset_y": 0,
    },
    {
        "name": "Moon",
        "asset_name": "moon",
        "height": 1060,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 28,
        "hit_width": 230,
        "hit_height": 155,
        "hit_offset_y": 70,
    },
    {
        "name": "Mars",
        "asset_name": "mars",
        "height": 1460,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 30,
        "hit_width": 230,
        "hit_height": 155,
        "hit_offset_y": 70,
    },
    {
        "name": "Jupiter",
        "asset_name": "jupiter",
        "height": 1890,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 25,
        "hit_width": 240,
        "hit_height": 175,
        "hit_offset_y": 88,
    },
    {
        "name": "Saturn",
        "asset_name": "saturn",
        "height": 2340,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 35,
        "hit_width": 315,
        "hit_height": 125,
        "hit_offset_y": 78,
    },
    {
        "name": "Uranus",
        "asset_name": "uranus",
        "height": 2820,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 28,
        "hit_width": 205,
        "hit_height": 155,
        "hit_offset_y": 75,
    },
    {
        "name": "Neptune",
        "asset_name": "neptune",
        "height": 3330,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 28,
        "hit_width": 205,
        "hit_height": 155,
        "hit_offset_y": 75,
    },
]
