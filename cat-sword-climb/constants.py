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
MATCH_STREAK_TARGET = 2
COMBO_STREAK_TARGET = 3
MATCH_BOUNCE_HEIGHT_MULTIPLIER = 1.25
COMBO_BOUNCE_HEIGHT_MULTIPLIER = 1.75
MATCH_BOUNCE_SPEED = BOUNCE_SPEED * math.sqrt(MATCH_BOUNCE_HEIGHT_MULTIPLIER)
COMBO_BOUNCE_SPEED = BOUNCE_SPEED * math.sqrt(COMBO_BOUNCE_HEIGHT_MULTIPLIER)
COMBO_FEEDBACK_TIME = 0.75
SPEED_RAMP_HEIGHT = 5200.0
MAX_SPEED_MULTIPLIER = 1.7

MOBILE_CONTROL_MARGIN = 18
MOBILE_ARROW_W = 92
MOBILE_ARROW_H = 70
MOBILE_ARROW_GAP = 12
MOBILE_ACTION_SIZE = 112
MOBILE_CONTROL_ALPHA = 96
MOBILE_CONTROL_PRESSED_ALPHA = 150
MOBILE_CONTROL_BORDER_ALPHA = 175
MOBILE_CONTROL_SHADOW_ALPHA = 72
MOBILE_RETRY_ACTION_SUPPRESS_MS = 320
MOBILE_SYNTHETIC_MOUSE_SUPPRESS_MS = 700

WORLD_FLOOR_Y = 660.0
BALLOON_SPACING_MIN = 115
BALLOON_SPACING_MAX = 180
BALLOON_MAX_HORIZONTAL_DRIFT = 150
OPTIONAL_SIDE_BALLOON_CHANCE = 0.35
OPTIONAL_SIDE_BALLOON_MIN_X_OFFSET = 130
OPTIONAL_SIDE_BALLOON_MAX_X_OFFSET = 245
OPTIONAL_SIDE_BALLOON_Y_JITTER = 46
COLOR_REPEAT_CHANCE = 0.35

SKY_TOP = (42, 54, 86)
SKY_BOTTOM = (123, 177, 204)
SPACE_TOP = (3, 5, 18)
SPACE_BOTTOM = (13, 18, 42)
ATMOSPHERE_FADE_HEIGHT = 950.0
BACKGROUND_PHASES = (
    {
        "height": 0,
        "top": (47, 68, 113),
        "bottom": (140, 194, 218),
        "cloud": 1.0,
        "star": 0.0,
        "nebula": 0.0,
    },
    {
        "height": 900,
        "top": (24, 34, 78),
        "bottom": (92, 139, 190),
        "cloud": 0.45,
        "star": 0.18,
        "nebula": 0.0,
    },
    {
        "height": 1800,
        "top": (5, 11, 36),
        "bottom": (24, 42, 84),
        "cloud": 0.08,
        "star": 0.62,
        "nebula": 0.08,
    },
    {
        "height": 3300,
        "top": (1, 3, 16),
        "bottom": (8, 13, 38),
        "cloud": 0.0,
        "star": 0.95,
        "nebula": 0.34,
    },
    {
        "height": 5600,
        "top": (10, 3, 29),
        "bottom": (4, 7, 25),
        "cloud": 0.0,
        "star": 1.0,
        "nebula": 0.82,
    },
    {
        "height": 7600,
        "top": (22, 5, 46),
        "bottom": (5, 3, 19),
        "cloud": 0.0,
        "star": 1.0,
        "nebula": 1.0,
    },
)
SHOOTING_STAR_MIN_HEIGHT = 900
SHOOTING_STAR_INTERVALS = (
    (900, 1800, (30.0, 51.0)),
    (1800, 3300, (26.0, 45.0)),
    (3300, 5600, (21.0, 38.0)),
    (5600, math.inf, (19.0, 34.0)),
)
SHOOTING_STAR_LIFETIME = 0.82
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
        "height": 1133,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 84,
        "hit_width": 280,
        "hit_height": 130,
        "hit_offset_y": 0,
    },
    {
        "name": "Moon",
        "asset_name": "moon",
        "height": 1980,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 28,
        "hit_width": 230,
        "hit_height": 155,
        "hit_offset_y": 70,
    },
    {
        "name": "Mars",
        "asset_name": "mars",
        "height": 2921,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 30,
        "hit_width": 230,
        "hit_height": 155,
        "hit_offset_y": 70,
    },
    {
        "name": "Jupiter",
        "asset_name": "jupiter",
        "height": 3932,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 25,
        "hit_width": 240,
        "hit_height": 175,
        "hit_offset_y": 88,
    },
    {
        "name": "Saturn",
        "asset_name": "saturn",
        "height": 4991,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 35,
        "hit_width": 315,
        "hit_height": 125,
        "hit_offset_y": 78,
    },
    {
        "name": "Uranus",
        "asset_name": "uranus",
        "height": 6120,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 28,
        "hit_width": 205,
        "hit_height": 155,
        "hit_offset_y": 75,
    },
    {
        "name": "Neptune",
        "asset_name": "neptune",
        "height": 7320,
        "x": WIDTH * 0.5,
        "sprite_offset_y": 28,
        "hit_width": 205,
        "hit_height": 155,
        "hit_offset_y": 75,
    },
]
