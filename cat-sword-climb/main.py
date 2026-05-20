import asyncio
import math
import random
import sys
from dataclasses import dataclass
from pathlib import Path

import pygame


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


@dataclass
class Balloon:
    x: float
    y: float
    radius: float
    color: tuple[int, int, int]
    wobble: float
    route_role: str = "main"
    popped_timer: float = 0.0

    @property
    def alive(self):
        return self.popped_timer <= 0


@dataclass
class Pop:
    x: float
    y: float
    color: tuple[int, int, int]
    boosted: bool = False
    age: float = 0.0


@dataclass
class ComboFeedback:
    x: float
    y: float
    color: tuple[int, int, int]
    age: float = 0.0


@dataclass
class GoalMarker:
    name: str
    asset_name: str
    height: int
    x: float
    y: float
    sprite_offset_y: float
    hit_width: float
    hit_height: float
    hit_offset_y: float
    reached: bool = False
    popped_timer: float = 0.0

    @property
    def alive(self):
        return self.popped_timer <= 0


class Player:
    def __init__(self):
        self.x = WIDTH * 0.5
        self.y = WORLD_FLOOR_Y - CAT_H * 0.5
        self.vx = 0.0
        self.vy = 0.0
        self.facing = 1
        self.slash_timer = 0.0
        self.cooldown = 0.0
        self.on_ground = True

    @property
    def rect(self):
        return pygame.Rect(
            round(self.x - CAT_W * 0.5),
            round(self.y - CAT_H * 0.5),
            CAT_W,
            CAT_H,
        )

    @property
    def slashing(self):
        return self.slash_timer > 0

    @property
    def slash_progress(self):
        if not self.slashing:
            return 1.0
        return 1.0 - self.slash_timer / SLASH_TIME

    def start_slash(self):
        if self.cooldown > 0:
            return
        self.slash_timer = SLASH_TIME
        self.cooldown = SLASH_TIME + SLASH_COOLDOWN

    def sword_segment(self):
        progress = self.slash_progress
        base = (self.x + self.facing * 14, self.y + 12)

        if progress < SLASH_WINDUP_RATIO:
            t = progress / SLASH_WINDUP_RATIO
            tip_x = self.x + self.facing * (56 - 18 * t)
            tip_y = self.y - 8 + 42 * t
        else:
            t = (progress - SLASH_WINDUP_RATIO) / (1.0 - SLASH_WINDUP_RATIO)
            tip_x = self.x + self.facing * (38 - 28 * t)
            tip_y = self.y + 34 + 56 * t

        return base, (tip_x, tip_y)

    def circle_hits_segment(self, center_x, center_y, radius, start, end):
        sx, sy = start
        ex, ey = end
        vx = ex - sx
        vy = ey - sy
        length_squared = vx * vx + vy * vy
        if length_squared == 0:
            dx = center_x - sx
            dy = center_y - sy
            return dx * dx + dy * dy <= radius * radius

        t = ((center_x - sx) * vx + (center_y - sy) * vy) / length_squared
        t = max(0.0, min(1.0, t))
        closest_x = sx + vx * t
        closest_y = sy + vy * t
        dx = center_x - closest_x
        dy = center_y - closest_y
        return dx * dx + dy * dy <= radius * radius

    def sword_hit_circle(self, balloon):
        if not self.slashing or not balloon.alive:
            return False

        hit_radius = balloon.radius + 16
        return (
            self.circle_hits_segment(balloon.x, balloon.y, hit_radius, *self.sword_segment())
            and balloon.y > self.y + 4
        )

    def sword_hit_rect(self, rect):
        if not self.slashing:
            return False

        if rect.centery <= self.y:
            return False

        start, end = self.sword_segment()
        line = (
            round(start[0]),
            round(start[1]),
            round(end[0]),
            round(end[1]),
        )
        return bool(rect.clipline(line))

    def update(self, dt, keys, speed_multiplier):
        direction = 0
        if keys[pygame.K_LEFT]:
            direction -= 1
        if keys[pygame.K_RIGHT]:
            direction += 1

        if direction:
            self.facing = direction
            self.vx += direction * MOVE_ACCEL * speed_multiplier * dt
        else:
            self.vx *= AIR_DRAG

        max_run_speed = MAX_RUN_SPEED * speed_multiplier
        self.vx = max(-max_run_speed, min(max_run_speed, self.vx))
        self.vy += GRAVITY * speed_multiplier * dt

        if self.slashing and self.slash_progress >= SLASH_WINDUP_RATIO:
            self.vy = max(self.vy, SLASH_DIVE_SPEED * speed_multiplier)

        self.x += self.vx * dt
        self.y += self.vy * dt

        if self.x < -CAT_W:
            self.x = WIDTH + CAT_W
        elif self.x > WIDTH + CAT_W:
            self.x = -CAT_W

        if self.y > WORLD_FLOOR_Y - CAT_H * 0.5:
            self.y = WORLD_FLOOR_Y - CAT_H * 0.5
            self.vy = 0.0
            self.on_ground = True
        else:
            self.on_ground = False

        self.slash_timer = max(0.0, self.slash_timer - dt)
        self.cooldown = max(0.0, self.cooldown - dt)

    def bounce(self, speed_multiplier=1.0, speed=BOUNCE_SPEED):
        self.vy = -speed * speed_multiplier
        self.slash_timer = 0.0
        self.cooldown = 0.04

    def jump(self):
        if not self.on_ground:
            return
        self.vy = -GROUND_JUMP_SPEED
        self.on_ground = False
        self.cooldown = 0.08


class Game:
    def __init__(self):
        pygame.init()
        pygame.display.set_caption("Cow Sword Climb")
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont("arial", 22, bold=True)
        self.big_font = pygame.font.SysFont("arial", 52, bold=True)
        self.small_font = pygame.font.SysFont("arial", 16, bold=True)
        self.cat_sprites = self.load_cat_sprites()
        self.balloon_sprites = self.load_balloon_sprites()
        self.goal_marker_sprites = self.load_goal_marker_sprites()
        self.run_seed_rng = random.Random()
        self.running = True
        self.reset()

    def load_cat_sprites(self):
        sprites = {}
        try:
            for name in ("idle", "jump", "slash", "fall"):
                sprites[name] = pygame.image.load(ASSET_DIR / f"cat_{name}.png").convert_alpha()
        except (FileNotFoundError, pygame.error):
            return None
        return sprites

    def load_balloon_sprites(self):
        sprites = {}
        try:
            for color, name in zip(BALLOON_COLORS, BALLOON_SPRITE_NAMES):
                sprites[color] = pygame.image.load(ASSET_DIR / f"balloon_{name}.png").convert_alpha()
        except (FileNotFoundError, pygame.error):
            return None
        return sprites

    def load_goal_marker_sprites(self):
        sprites = {}
        try:
            for marker in GOAL_MARKER_DATA:
                name = marker["asset_name"]
                sprites[name] = pygame.image.load(ASSET_DIR / f"goal_{name}.png").convert_alpha()
        except (FileNotFoundError, pygame.error):
            return None
        return sprites

    def reset(self):
        self.player = Player()
        self.camera_y = 0.0
        self.best_height = 0
        self.speed_multiplier = 1.0
        self.speed_ramp_enabled = True
        self.hit_pause_timer = 0.0
        self.game_over = False
        self.has_popped_balloon = False
        self.hit_combo_color = None
        self.hit_combo_streak = 0
        self.combo_feedbacks = []
        self.pops = []
        self.clouds = self.make_clouds()
        self.stars = self.make_stars()
        self.goal_markers = self.make_goal_markers()
        self.balloons = []
        self.goal_approach_marker_names = set()
        self.balloon_rng = random.Random(self.run_seed_rng.randrange(1 << 63))
        self.last_balloon_x = WIDTH * 0.5
        self.last_balloon_color = None
        self.balloon_color_streak = 0
        self.pending_combo_steps = []
        self.current_side_color_override = None
        self.force_current_side_balloon = False
        self.balloons_until_combo_pattern = self.balloon_rng.randrange(
            COLOR_COMBO_FIRST_GAP_MIN,
            COLOR_COMBO_FIRST_GAP_MAX + 1,
        )
        self.next_balloon_y = WORLD_FLOOR_Y - 150
        while self.next_balloon_y > -1800:
            self.spawn_balloon()

    def make_goal_markers(self):
        return [
            GoalMarker(
                name=marker["name"],
                asset_name=marker["asset_name"],
                height=marker["height"],
                x=marker["x"],
                y=WORLD_FLOOR_Y - marker["height"] * 10,
                sprite_offset_y=marker["sprite_offset_y"],
                hit_width=marker["hit_width"],
                hit_height=marker["hit_height"],
                hit_offset_y=marker["hit_offset_y"],
            )
            for marker in GOAL_MARKER_DATA
        ]

    def make_clouds(self):
        rng = random.Random(8)
        return [
            (
                rng.randrange(20, WIDTH - 20),
                rng.randrange(-3600, HEIGHT),
                rng.randrange(34, 78),
                rng.random() * 2.0,
            )
            for _ in range(45)
        ]

    def make_stars(self):
        rng = random.Random(19)
        return [
            (
                rng.randrange(0, WIDTH),
                rng.randrange(0, HEIGHT + 220),
                rng.choice((1, 1, 1, 2)),
                rng.random() * math.tau,
            )
            for _ in range(95)
        ]

    def current_height(self):
        return max(0.0, (WORLD_FLOOR_Y - self.player.y) / 10)

    def atmosphere_amount(self):
        t = min(1.0, self.current_height() / ATMOSPHERE_FADE_HEIGHT)
        return t * t * (3 - 2 * t)

    def blend_color(self, a, b, t):
        return (
            int(a[0] * (1 - t) + b[0] * t),
            int(a[1] * (1 - t) + b[1] * t),
            int(a[2] * (1 - t) + b[2] * t),
        )

    def goal_marker_balloon_clearance_band(self, marker):
        sprite = self.goal_marker_sprites.get(marker.asset_name) if self.goal_marker_sprites else None
        sprite_height = sprite.get_height() if sprite else marker.hit_height
        top = marker.y - marker.sprite_offset_y - GOAL_BALLOON_CLEARANCE_TOP
        bottom = marker.y - marker.sprite_offset_y + sprite_height + GOAL_BALLOON_CLEARANCE_BOTTOM
        return top, bottom

    def goal_marker_near_balloon_y(self, y):
        for marker in self.goal_markers:
            top, bottom = self.goal_marker_balloon_clearance_band(marker)
            if top <= y <= bottom:
                return marker
        return None

    def next_balloon_x(self, margin):
        left = margin
        right = WIDTH - margin
        base_x = max(left, min(right, self.last_balloon_x))
        drift = self.balloon_rng.randrange(
            -BALLOON_MAX_HORIZONTAL_DRIFT,
            BALLOON_MAX_HORIZONTAL_DRIFT + 1,
        )
        x = base_x + drift

        # Reflect off the side margins so the randomized path never jumps
        # across the screen just because it hit an edge.
        while x < left or x > right:
            if x < left:
                x = left + (left - x)
            elif x > right:
                x = right - (x - right)

        return x

    def schedule_next_combo_pattern(self):
        self.balloons_until_combo_pattern = self.balloon_rng.randrange(
            COLOR_COMBO_REPEAT_GAP_MIN,
            COLOR_COMBO_REPEAT_GAP_MAX + 1,
        )

    def record_balloon_color(self, color):
        if color == self.last_balloon_color:
            self.balloon_color_streak += 1
        else:
            self.last_balloon_color = color
            self.balloon_color_streak = 1

    def combo_color_choices(self):
        choices = [color for color in BALLOON_COLORS if color != self.last_balloon_color]
        return choices or list(BALLOON_COLORS)

    def start_combo_pattern(self):
        combo_color = self.balloon_rng.choice(self.combo_color_choices())
        decoy_choices = [color for color in BALLOON_COLORS if color != combo_color]
        decoy_color = self.balloon_rng.choice(decoy_choices)
        pattern_name = self.balloon_rng.choice(("side_decoy", "side_finish", "side_middle"))

        if pattern_name == "side_finish":
            self.pending_combo_steps = [
                {"main": combo_color},
                {"main": combo_color},
                {"main": decoy_color, "side": combo_color, "force_side": True},
            ]
        elif pattern_name == "side_middle":
            self.pending_combo_steps = [
                {"main": combo_color},
                {"main": decoy_color, "side": combo_color, "force_side": True},
                {"main": combo_color},
            ]
        else:
            self.pending_combo_steps = [
                {"main": combo_color},
                {"main": combo_color, "side": decoy_color, "force_side": True},
                {"main": combo_color},
            ]

    def choose_main_balloon_color(self):
        self.current_side_color_override = None
        self.force_current_side_balloon = False

        if self.pending_combo_steps:
            step = self.pending_combo_steps.pop(0)
            color = step["main"]
            self.current_side_color_override = step.get("side")
            self.force_current_side_balloon = step.get("force_side", False)
            if not self.pending_combo_steps:
                self.schedule_next_combo_pattern()
            self.record_balloon_color(color)
            return color

        if self.balloons_until_combo_pattern <= 0:
            self.start_combo_pattern()
            return self.choose_main_balloon_color()

        self.balloons_until_combo_pattern -= 1
        choices = list(BALLOON_COLORS)
        if self.last_balloon_color and self.balloon_color_streak >= 2:
            choices = [color for color in choices if color != self.last_balloon_color]
        elif (
            self.last_balloon_color
            and self.balloon_color_streak == 1
            and self.balloon_rng.random() < COLOR_REPEAT_CHANCE
        ):
            choices = [self.last_balloon_color]

        color = self.balloon_rng.choice(choices)
        self.record_balloon_color(color)
        return color

    def choose_side_balloon_color(self, main_color):
        if self.balloon_rng.random() < 0.45:
            return main_color

        choices = [color for color in BALLOON_COLORS if color != main_color]
        return self.balloon_rng.choice(choices)

    def side_balloon_x(self, main_x, margin):
        left = margin
        right = WIDTH - margin
        candidates = []

        left_min = max(left, main_x - OPTIONAL_SIDE_BALLOON_MAX_X_OFFSET)
        left_max = min(right, main_x - OPTIONAL_SIDE_BALLOON_MIN_X_OFFSET)
        if left_min <= left_max:
            candidates.append((left_min, left_max))

        right_min = max(left, main_x + OPTIONAL_SIDE_BALLOON_MIN_X_OFFSET)
        right_max = min(right, main_x + OPTIONAL_SIDE_BALLOON_MAX_X_OFFSET)
        if right_min <= right_max:
            candidates.append((right_min, right_max))

        if candidates:
            low, high = self.balloon_rng.choice(candidates)
            return self.balloon_rng.randrange(round(low), round(high) + 1)

        return max(left, min(right, main_x))

    def maybe_spawn_side_balloon(self, main_x, main_y, main_color):
        force_side = self.force_current_side_balloon
        side_color_override = self.current_side_color_override
        self.force_current_side_balloon = False
        self.current_side_color_override = None

        if not force_side and self.balloon_rng.random() > OPTIONAL_SIDE_BALLOON_CHANCE:
            return

        radius = self.balloon_rng.randrange(22, 32)
        margin = radius + 32
        x = self.side_balloon_x(main_x, margin)
        if abs(x - main_x) < OPTIONAL_SIDE_BALLOON_MIN_X_OFFSET * 0.75:
            return

        y = main_y + self.balloon_rng.randrange(
            -OPTIONAL_SIDE_BALLOON_Y_JITTER,
            OPTIONAL_SIDE_BALLOON_Y_JITTER + 1,
        )
        if self.goal_marker_near_balloon_y(y):
            return

        color = side_color_override or self.choose_side_balloon_color(main_color)
        self.balloons.append(
            Balloon(x, y, radius, color, self.balloon_rng.random() * math.tau, route_role="side")
        )

    def spawn_goal_approach_balloon(self, marker):
        if marker.name in self.goal_approach_marker_names:
            return

        self.goal_approach_marker_names.add(marker.name)
        _, clearance_bottom = self.goal_marker_balloon_clearance_band(marker)
        radius = self.balloon_rng.randrange(27, 34)
        margin = radius + 32
        x = marker.x + self.balloon_rng.randrange(
            -GOAL_APPROACH_X_JITTER,
            GOAL_APPROACH_X_JITTER + 1,
        )
        x = max(margin, min(WIDTH - margin, x))
        y = clearance_bottom + GOAL_APPROACH_BALLOON_GAP
        color = self.choose_main_balloon_color()

        # Landmark approach balloons should be clean setup points, not side-choice clutter.
        self.current_side_color_override = None
        self.force_current_side_balloon = False
        self.balloons.append(
            Balloon(x, y, radius, color, self.balloon_rng.random() * math.tau, route_role="main")
        )

    def spawn_balloon(self):
        y = self.next_balloon_y
        self.next_balloon_y -= self.balloon_rng.randrange(BALLOON_SPACING_MIN, BALLOON_SPACING_MAX)
        nearby_marker = self.goal_marker_near_balloon_y(y)
        if nearby_marker:
            self.spawn_goal_approach_balloon(nearby_marker)
            self.last_balloon_x = nearby_marker.x
            return

        radius = self.balloon_rng.randrange(23, 34)
        margin = radius + 32
        x = self.next_balloon_x(margin)
        self.last_balloon_x = x
        color = self.choose_main_balloon_color()
        self.balloons.append(Balloon(x, y, radius, color, self.balloon_rng.random() * math.tau))
        self.maybe_spawn_side_balloon(x, y, color)

    def ensure_balloons(self):
        target_top = self.camera_y - 1200
        while self.next_balloon_y > target_top:
            self.spawn_balloon()

        self.balloons = [
            balloon
            for balloon in self.balloons
            if balloon.popped_timer < 0.35 and balloon.y < WORLD_FLOOR_Y + 220
        ]

    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False
                elif event.key == pygame.K_SPACE and not self.game_over:
                    if self.player.on_ground:
                        self.player.jump()
                    else:
                        self.player.start_slash()
                elif event.key == pygame.K_p:
                    self.speed_ramp_enabled = not self.speed_ramp_enabled
                    self.update_speed_multiplier()
                elif event.key == pygame.K_r and self.game_over:
                    self.reset()

    def update_speed_multiplier(self):
        if not self.speed_ramp_enabled:
            self.speed_multiplier = 1.0
            return

        current_height = self.current_height()
        self.speed_multiplier = min(
            MAX_SPEED_MULTIPLIER,
            1.0 + current_height / SPEED_RAMP_HEIGHT,
        )

    def register_balloon_combo_hit(self, color):
        if color == self.hit_combo_color:
            self.hit_combo_streak += 1
        else:
            self.hit_combo_color = color
            self.hit_combo_streak = 1

        return self.hit_combo_streak >= COMBO_STREAK_TARGET

    def color_name(self, color):
        try:
            return BALLOON_SPRITE_NAMES[BALLOON_COLORS.index(color)]
        except ValueError:
            return "color"

    def update(self, dt):
        if self.game_over:
            for pop in self.pops:
                pop.age += dt
            for feedback in self.combo_feedbacks:
                feedback.age += dt
            self.combo_feedbacks = [
                feedback for feedback in self.combo_feedbacks if feedback.age < COMBO_FEEDBACK_TIME
            ]
            return

        if self.hit_pause_timer > 0:
            self.hit_pause_timer = max(0.0, self.hit_pause_timer - dt)
            return

        keys = pygame.key.get_pressed()
        self.player.update(dt, keys, self.speed_multiplier)

        for balloon in self.balloons:
            balloon.wobble += dt * 4.0 * self.speed_multiplier
            if balloon.alive and self.player.sword_hit_circle(balloon):
                balloon.popped_timer = 0.001
                self.has_popped_balloon = True
                combo_boost = self.register_balloon_combo_hit(balloon.color)
                self.pops.append(Pop(balloon.x, balloon.y, balloon.color, boosted=combo_boost))
                if combo_boost:
                    self.combo_feedbacks.append(ComboFeedback(balloon.x, balloon.y, balloon.color))
                bounce_speed = COMBO_BOUNCE_SPEED if combo_boost else BOUNCE_SPEED
                self.player.bounce(speed_multiplier=self.speed_multiplier, speed=bounce_speed)
                self.hit_pause_timer = HIT_PAUSE_TIME

        for marker in self.goal_markers:
            if marker.alive and self.player.sword_hit_rect(self.goal_marker_hit_rect(marker)):
                marker.popped_timer = 0.001
                marker.reached = True
                self.has_popped_balloon = True
                self.pops.append(Pop(marker.x, marker.y + marker.hit_offset_y, (245, 245, 226)))
                self.player.bounce(speed_multiplier=self.speed_multiplier, speed=GOAL_BOUNCE_SPEED)
                self.hit_pause_timer = HIT_PAUSE_TIME

        for balloon in self.balloons:
            if balloon.popped_timer > 0:
                balloon.popped_timer += dt

        for marker in self.goal_markers:
            if marker.popped_timer > 0:
                marker.popped_timer += dt

        for pop in self.pops:
            pop.age += dt
        self.pops = [pop for pop in self.pops if pop.age < 0.45]

        for feedback in self.combo_feedbacks:
            feedback.age += dt
        self.combo_feedbacks = [
            feedback for feedback in self.combo_feedbacks if feedback.age < COMBO_FEEDBACK_TIME
        ]

        if self.player.y < self.camera_y + HEIGHT * 0.38:
            self.camera_y = self.player.y - HEIGHT * 0.38
        elif self.player.y > self.camera_y + HEIGHT * 0.64:
            self.camera_y = self.player.y - HEIGHT * 0.64
        self.camera_y = min(0.0, self.camera_y)

        height = max(0, int((WORLD_FLOOR_Y - self.player.y) / 10))
        self.best_height = max(self.best_height, height)
        self.update_speed_multiplier()

        self.ensure_balloons()

        if self.has_popped_balloon and self.player.on_ground and self.player_on_world_floor():
            self.game_over = True

    def world_to_screen(self, x, y):
        return int(x), int(y - self.camera_y)

    def player_on_world_floor(self):
        floor_player_y = WORLD_FLOOR_Y - CAT_H * 0.5
        return self.player.y >= floor_player_y - 0.5

    def goal_marker_hit_rect(self, marker):
        return pygame.Rect(
            round(marker.x - marker.hit_width * 0.5),
            round(marker.y + marker.hit_offset_y - marker.hit_height * 0.5),
            round(marker.hit_width),
            round(marker.hit_height),
        )

    def draw_gradient(self):
        atmosphere = self.atmosphere_amount()
        sky_top = self.blend_color(SKY_TOP, SPACE_TOP, atmosphere)
        sky_bottom = self.blend_color(SKY_BOTTOM, SPACE_BOTTOM, atmosphere)
        for y in range(0, HEIGHT, 4):
            t = y / HEIGHT
            color = (
                int(sky_top[0] * (1 - t) + sky_bottom[0] * t),
                int(sky_top[1] * (1 - t) + sky_bottom[1] * t),
                int(sky_top[2] * (1 - t) + sky_bottom[2] * t),
            )
            pygame.draw.rect(self.screen, color, (0, y, WIDTH, 4))

    def draw_stars(self):
        atmosphere = self.atmosphere_amount()
        if atmosphere <= 0.05:
            return

        alpha = int(235 * min(1.0, max(0.0, (atmosphere - 0.05) / 0.65)))
        star_layer = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        ticks = pygame.time.get_ticks() * 0.002
        for x, y, size, phase in self.stars:
            sy = (y - self.camera_y * 0.08) % (HEIGHT + 220) - 110
            twinkle = 0.65 + 0.35 * math.sin(ticks + phase)
            star_alpha = int(alpha * twinkle)
            color = (245, 245, 226, star_alpha)
            pygame.draw.circle(star_layer, color, (int(x), int(sy)), size)
            if size > 1 and atmosphere > 0.7:
                pygame.draw.line(star_layer, color, (x - 3, sy), (x + 3, sy), 1)
                pygame.draw.line(star_layer, color, (x, sy - 3), (x, sy + 3), 1)
        self.screen.blit(star_layer, (0, 0))

    def draw_clouds(self):
        atmosphere = self.atmosphere_amount()
        cloud_alpha = int(230 * max(0.0, 1.0 - atmosphere * 1.35))
        if cloud_alpha <= 0:
            return

        cloud_layer = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        for x, y, size, drift in self.clouds:
            sy = y - self.camera_y * 0.32
            wrapped = (sy + 180) % (HEIGHT + 260) - 160
            sx = int((x + math.sin(pygame.time.get_ticks() * 0.0002 + drift) * 18) % WIDTH)
            color = (232, 239, 234, cloud_alpha)
            pygame.draw.ellipse(cloud_layer, color, (sx - size, wrapped, size * 1.8, size * 0.54))
            pygame.draw.ellipse(cloud_layer, color, (sx - size * 0.4, wrapped - size * 0.18, size, size * 0.54))
        self.screen.blit(cloud_layer, (0, 0))

    def draw_floor(self):
        y = WORLD_FLOOR_Y - self.camera_y
        if -80 <= y <= HEIGHT + 80:
            pygame.draw.rect(self.screen, (78, 95, 83), (0, y, WIDTH, HEIGHT - y))
            pygame.draw.rect(self.screen, (48, 59, 55), (0, y, WIDTH, 10))

    def draw_goal_marker_label(self, marker, x, y):
        if marker.alive:
            text = f"{marker.name}  {marker.height}m"
            color = (232, 239, 234)
        else:
            text = f"{marker.name} cleared"
            color = (255, 219, 116)
        shadow = self.small_font.render(text, True, (11, 13, 18))
        label = self.small_font.render(text, True, color)
        rect = label.get_rect(center=(x, y))
        self.screen.blit(shadow, rect.move(1, 2))
        self.screen.blit(label, rect)

    def draw_goal_marker_burst(self, marker):
        if marker.popped_timer <= 0 or marker.popped_timer >= GOAL_POP_TIME:
            return

        sx, sy = self.world_to_screen(marker.x, marker.y + marker.hit_offset_y)
        t = marker.popped_timer / GOAL_POP_TIME
        for i in range(14):
            angle = i * math.tau / 14 + t * 0.8
            distance = 28 + t * 125
            end = (
                sx + int(math.cos(angle) * distance),
                sy + int(math.sin(angle) * distance),
            )
            color = (245, 245, 226) if i % 2 else (255, 219, 116)
            pygame.draw.line(self.screen, color, (sx, sy), end, max(1, int(5 * (1 - t))))
        self.draw_goal_marker_label(marker, sx, sy - 96 * t)

    def draw_goal_markers(self):
        for marker in self.goal_markers:
            if not marker.alive:
                self.draw_goal_marker_burst(marker)
                continue

            sx, sy = self.world_to_screen(marker.x, marker.y)
            sprite = self.goal_marker_sprites.get(marker.asset_name) if self.goal_marker_sprites else None
            if sprite:
                top = sy - round(marker.sprite_offset_y)
                left = sx - sprite.get_width() // 2
                if top > HEIGHT + 80 or top + sprite.get_height() < -80:
                    continue
                self.screen.blit(sprite, (left, top))
                self.draw_goal_marker_label(marker, sx, top - 16)
            else:
                hit_rect = self.goal_marker_hit_rect(marker)
                x, y = self.world_to_screen(hit_rect.centerx, hit_rect.centery)
                fallback_rect = pygame.Rect(0, 0, hit_rect.width, hit_rect.height)
                fallback_rect.center = (x, y)
                pygame.draw.rect(self.screen, (180, 187, 184), fallback_rect, border_radius=9)
                pygame.draw.rect(self.screen, INK, fallback_rect, 2, border_radius=9)
                self.draw_goal_marker_label(marker, x, fallback_rect.top - 22)

    def draw_balloon(self, balloon):
        sx, sy = self.world_to_screen(
            balloon.x + math.sin(balloon.wobble) * 4,
            balloon.y + math.cos(balloon.wobble * 0.7) * 3,
        )
        if sy < -90 or sy > HEIGHT + 90:
            return

        if balloon.alive:
            if self.balloon_sprites:
                sprite = self.balloon_sprites[balloon.color]
                scale = balloon.radius / BALLOON_SPRITE_BASE_RADIUS
                target_size = (
                    max(1, int(sprite.get_width() * scale)),
                    max(1, int(sprite.get_height() * scale)),
                )
                image = pygame.transform.smoothscale(sprite, target_size)
                self.screen.blit(
                    image,
                    (
                        sx - target_size[0] // 2,
                        sy - round(BALLOON_SPRITE_CENTER_Y * scale),
                    ),
                )
            else:
                pygame.draw.line(self.screen, (67, 77, 82), (sx, sy + balloon.radius), (sx, sy + balloon.radius + 24), 2)
                pygame.draw.circle(self.screen, balloon.color, (sx, sy), int(balloon.radius))
                pygame.draw.circle(self.screen, INK, (sx, sy), int(balloon.radius), 3)
                pygame.draw.circle(
                    self.screen,
                    (255, 255, 255),
                    (sx - int(balloon.radius * 0.35), sy - int(balloon.radius * 0.35)),
                    max(4, int(balloon.radius * 0.18)),
                )
                pygame.draw.polygon(
                    self.screen,
                    (60, 55, 58),
                    [
                        (sx - 5, sy + balloon.radius - 1),
                        (sx + 5, sy + balloon.radius - 1),
                        (sx, sy + balloon.radius + 8),
                    ],
                )
        else:
            burst = min(1.0, balloon.popped_timer / 0.25)
            radius = balloon.radius + int(26 * burst)
            for i in range(8):
                angle = i * math.tau / 8 + balloon.wobble
                end = (
                    sx + int(math.cos(angle) * radius),
                    sy + int(math.sin(angle) * radius),
                )
                pygame.draw.line(self.screen, balloon.color, (sx, sy), end, 3)

    def draw_pop_particles(self):
        for pop in self.pops:
            sx, sy = self.world_to_screen(pop.x, pop.y)
            t = pop.age / 0.45
            particle_count = 18 if pop.boosted else 10
            max_distance = 84 if pop.boosted else 52
            for i in range(particle_count):
                angle = i * math.tau / particle_count
                distance = 12 + t * max_distance
                px = sx + math.cos(angle) * distance
                py = sy + math.sin(angle) * distance + t * 18
                size = max(1, int((7 if pop.boosted else 5) * (1 - t)))
                pygame.draw.circle(self.screen, pop.color, (int(px), int(py)), size)
                if pop.boosted and i % 3 == 0:
                    pygame.draw.circle(self.screen, (255, 236, 150), (int(px), int(py)), max(1, size // 2))

    def draw_combo_feedback(self):
        for feedback in self.combo_feedbacks:
            sx, sy = self.world_to_screen(feedback.x, feedback.y)
            t = feedback.age / COMBO_FEEDBACK_TIME
            if t >= 1:
                continue

            y = sy - int(72 * t) - 34
            pulse = 1.0 + math.sin(t * math.pi) * 0.14
            ring_radius = int((28 + 44 * t) * pulse)
            line_width = max(1, int(5 * (1 - t)))
            pygame.draw.circle(self.screen, (255, 236, 150), (sx, sy), ring_radius, line_width)
            pygame.draw.circle(self.screen, feedback.color, (sx, sy), max(4, int(ring_radius * 0.28)), 2)

            shadow = self.big_font.render("combo!", True, (13, 14, 22))
            label = self.big_font.render("combo!", True, (255, 236, 150))
            rect = label.get_rect(center=(sx, y))
            self.screen.blit(shadow, rect.move(2, 3))
            self.screen.blit(label, rect)

    def current_player_sprite_name(self):
        if self.player.slashing:
            return "slash"
        if self.player.on_ground:
            return "idle"
        if self.player.vy < -120:
            return "jump"
        return "fall"

    def draw_player_sprite(self):
        p = self.player
        name = self.current_player_sprite_name()
        sprite = self.cat_sprites[name]
        target_heights = {
            "idle": 104,
            "jump": 142,
            "slash": 124,
            "fall": 112,
        }
        offsets = {
            "idle": (0, 2),
            "jump": (0, 0),
            "slash": (p.facing * 8, 15),
            "fall": (0, 4),
        }
        target_h = target_heights[name]
        scale = target_h / sprite.get_height()
        target_w = max(1, int(sprite.get_width() * scale))
        image = pygame.transform.smoothscale(sprite, (target_w, target_h))
        if p.facing < 0:
            image = pygame.transform.flip(image, True, False)

        sx, sy = self.world_to_screen(p.x, p.y)
        ox, oy = offsets[name]
        rect = image.get_rect(center=(sx + ox, sy + oy))
        self.screen.blit(image, rect)

    def draw_player(self):
        if self.cat_sprites:
            self.draw_player_sprite()
            return

        p = self.player
        sx, sy = self.world_to_screen(p.x, p.y)

        if p.slashing:
            base_world, tip_world = p.sword_segment()
            base = self.world_to_screen(*base_world)
            tip = self.world_to_screen(*tip_world)
            pygame.draw.line(self.screen, SWORD_EDGE, base, tip, 10)
            pygame.draw.line(self.screen, SWORD, base, tip, 6)
            pygame.draw.circle(self.screen, WHITE, tip, 4)
        else:
            base = (sx + p.facing * 13, sy + 13)
            tip = (sx + p.facing * 44, sy + 2)
            pygame.draw.line(self.screen, SWORD_EDGE, base, tip, 8)
            pygame.draw.line(self.screen, SWORD, base, tip, 4)

        body = pygame.Rect(sx - 18, sy - 18, 36, 42)
        pygame.draw.ellipse(self.screen, CAT_DARK, (body.x + 3, body.y + 7, body.w - 6, body.h - 2))
        pygame.draw.ellipse(self.screen, CAT, body)

        head = pygame.Rect(sx - 19, sy - 42, 38, 32)
        pygame.draw.ellipse(self.screen, CAT, head)
        pygame.draw.polygon(self.screen, CAT, [(sx - 16, sy - 31), (sx - 9, sy - 52), (sx - 2, sy - 32)])
        pygame.draw.polygon(self.screen, CAT, [(sx + 16, sy - 31), (sx + 9, sy - 52), (sx + 2, sy - 32)])
        pygame.draw.polygon(self.screen, CAT_DARK, [(sx - 12, sy - 34), (sx - 9, sy - 44), (sx - 5, sy - 34)])
        pygame.draw.polygon(self.screen, CAT_DARK, [(sx + 12, sy - 34), (sx + 9, sy - 44), (sx + 5, sy - 34)])

        eye_y = sy - 31
        pygame.draw.circle(self.screen, INK, (sx - 8, eye_y), 3)
        pygame.draw.circle(self.screen, INK, (sx + 8, eye_y), 3)
        pygame.draw.polygon(self.screen, (93, 61, 50), [(sx, sy - 24), (sx - 3, sy - 20), (sx + 3, sy - 20)])
        pygame.draw.arc(self.screen, INK, (sx - 6, sy - 23, 6, 7), 0.2, 2.7, 1)
        pygame.draw.arc(self.screen, INK, (sx, sy - 23, 6, 7), 0.4, 2.9, 1)

        pygame.draw.rect(self.screen, SCARF, (sx - 16, sy - 12, 32, 7), border_radius=3)
        pygame.draw.polygon(self.screen, SCARF, [(sx + 11, sy - 10), (sx + 33, sy - 15), (sx + 17, sy + 1)])

        foot_offset = 6 if p.vy < 0 else 2
        pygame.draw.ellipse(self.screen, CAT_DARK, (sx - 18, sy + 18 + foot_offset, 15, 8))
        pygame.draw.ellipse(self.screen, CAT_DARK, (sx + 3, sy + 18 - foot_offset, 15, 8))

    def draw_hud(self):
        height_text = self.font.render(f"height {self.best_height}m", True, WHITE)
        self.screen.blit(height_text, (18, 16))
        speed_label = f"speed x{self.speed_multiplier:.2f}"
        if not self.speed_ramp_enabled:
            speed_label += " ramp off"
        speed_text = self.small_font.render(speed_label, True, (232, 239, 234))
        self.screen.blit(speed_text, (18, 44))

        if self.hit_combo_streak > 0 and self.hit_combo_color:
            combo_name = self.color_name(self.hit_combo_color)
            combo_label = f"combo {combo_name} {self.hit_combo_streak}/{COMBO_STREAK_TARGET}"
            combo_text = self.small_font.render(combo_label, True, self.hit_combo_color)
            combo_shadow = self.small_font.render(combo_label, True, (11, 13, 18))
            self.screen.blit(combo_shadow, (19, 68))
            self.screen.blit(combo_text, (18, 67))
            dot_x = 28 + combo_text.get_width()
            pygame.draw.circle(self.screen, self.hit_combo_color, (dot_x, 76), 6)
            pygame.draw.circle(self.screen, WHITE, (dot_x, 76), 6, 1)

        hint = self.small_font.render("arrows move   space jump/downslash   P speed ramp   esc quit", True, (232, 239, 234))
        self.screen.blit(hint, (18, HEIGHT - 30))

        if self.game_over:
            overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            overlay.fill((14, 15, 22, 170))
            self.screen.blit(overlay, (0, 0))
            title = self.big_font.render("FALLEN", True, WHITE)
            score = self.font.render(f"best height: {self.best_height}m", True, WHITE)
            retry = self.font.render("press R to climb again", True, (255, 219, 116))
            self.screen.blit(title, title.get_rect(center=(WIDTH // 2, HEIGHT // 2 - 56)))
            self.screen.blit(score, score.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 2)))
            self.screen.blit(retry, retry.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 42)))

    def draw(self):
        self.draw_gradient()
        self.draw_stars()
        self.draw_clouds()
        self.draw_floor()
        self.draw_goal_markers()
        for balloon in self.balloons:
            self.draw_balloon(balloon)
        self.draw_pop_particles()
        self.draw_player()
        self.draw_combo_feedback()
        self.draw_hud()
        pygame.display.flip()

    def run_frame(self):
        dt = min(1 / 30, self.clock.tick(FPS) / 1000)
        self.handle_events()
        self.update(dt)
        self.draw()

    async def run_async(self):
        try:
            while self.running:
                self.run_frame()
                await asyncio.sleep(0)
        finally:
            pygame.quit()

    def run(self):
        asyncio.run(self.run_async())


async def main():
    game = Game()
    try:
        await game.run_async()
    except KeyboardInterrupt:
        pygame.quit()
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
