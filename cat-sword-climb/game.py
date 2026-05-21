import asyncio
import math
import random

import pygame

from balloon_gen import BalloonGenerator
from constants import *
from entities import *
from renderer import Renderer


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
        self.renderer = Renderer(
            self.screen,
            self.font,
            self.big_font,
            self.small_font,
            self.cat_sprites,
            self.balloon_sprites,
            self.goal_marker_sprites,
        )
        self.mobile_controls_detected = self.detect_mobile_controls()
        self.mobile_controls_forced = False
        self.mobile_control_pointers = {}
        self.mobile_action_ignore_until = 0
        self.mobile_mouse_ignore_until = 0
        self.run_seed_rng = random.Random()
        self.running = True
        self.reset()

    def detect_mobile_controls(self):
        try:
            import platform

            window = platform.window
            navigator = platform.window.navigator
            if int(getattr(navigator, "maxTouchPoints", 0) or 0) > 0:
                return True

            user_agent = str(getattr(navigator, "userAgent", "")).lower()
            mobile_tokens = ("android", "iphone", "ipad", "ipod", "mobile")
            if any(token in user_agent for token in mobile_tokens):
                return True

            match_media = getattr(window, "matchMedia", None)
            if match_media and match_media("(pointer: coarse)").matches:
                return True
        except Exception:
            pass

        return False

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
        self.mobile_control_pointers.clear()
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
        self.balloon_rng = random.Random(self.run_seed_rng.randrange(1 << 63))
        self.balloon_gen = BalloonGenerator(
            rng=self.balloon_rng,
            goal_markers=self.goal_markers,
            goal_marker_sprites=self.goal_marker_sprites,
        )
        self.balloons = []
        while self.balloon_gen.next_balloon_y > -1800:
            self.balloons.extend(self.balloon_gen.spawn_balloon())

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

    def ensure_balloons(self):
        self.balloons.extend(self.balloon_gen.spawn_needed(self.camera_y))
        self.balloons = [
            balloon
            for balloon in self.balloons
            if balloon.popped_timer < 0.35 and balloon.y < WORLD_FLOOR_Y + 220
        ]

    def mobile_controls_visible(self):
        return self.mobile_controls_detected or self.mobile_controls_forced

    def mobile_now_ms(self):
        return pygame.time.get_ticks()

    def suppress_mobile_action(self, duration_ms=MOBILE_RETRY_ACTION_SUPPRESS_MS):
        self.mobile_action_ignore_until = max(
            self.mobile_action_ignore_until,
            self.mobile_now_ms() + duration_ms,
        )

    def suppress_synthetic_mouse(self):
        self.mobile_mouse_ignore_until = max(
            self.mobile_mouse_ignore_until,
            self.mobile_now_ms() + MOBILE_SYNTHETIC_MOUSE_SUPPRESS_MS,
        )

    def mobile_action_suppressed(self):
        return self.mobile_now_ms() < self.mobile_action_ignore_until

    def synthetic_mouse_suppressed(self):
        return self.mobile_now_ms() < self.mobile_mouse_ignore_until

    def mobile_control_rects(self):
        y = HEIGHT - MOBILE_CONTROL_MARGIN - MOBILE_ARROW_H
        left = pygame.Rect(
            MOBILE_CONTROL_MARGIN,
            y,
            MOBILE_ARROW_W,
            MOBILE_ARROW_H,
        )
        right = pygame.Rect(
            left.right + MOBILE_ARROW_GAP,
            y,
            MOBILE_ARROW_W,
            MOBILE_ARROW_H,
        )
        action = pygame.Rect(
            WIDTH - MOBILE_CONTROL_MARGIN - MOBILE_ACTION_SIZE,
            HEIGHT - MOBILE_CONTROL_MARGIN - MOBILE_ACTION_SIZE,
            MOBILE_ACTION_SIZE,
            MOBILE_ACTION_SIZE,
        )
        return {"left": left, "right": right, "action": action}

    def mobile_control_at(self, pos):
        for name, rect in self.mobile_control_rects().items():
            if rect.collidepoint(pos):
                return name
        return None

    def press_mobile_control(self, pointer_id, pos, trigger_action=True):
        control = self.mobile_control_at(pos)
        if not control:
            return False

        if trigger_action and control == "action" and self.mobile_action_suppressed():
            return True

        self.mobile_control_pointers[pointer_id] = control
        if trigger_action and control == "action":
            self.perform_action_button()
        return True

    def release_mobile_control(self, pointer_id):
        self.mobile_control_pointers.pop(pointer_id, None)

    def pressed_mobile_controls(self):
        return set(self.mobile_control_pointers.values())

    def touch_direction(self):
        pressed = self.pressed_mobile_controls()
        return int("right" in pressed) - int("left" in pressed)

    def perform_action_button(self):
        if self.game_over:
            self.suppress_mobile_action()
            self.suppress_synthetic_mouse()
            self.reset()
            return

        if self.player.on_ground:
            self.player.jump()
        else:
            self.player.start_slash()

    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False
                elif event.key == pygame.K_SPACE and not self.game_over:
                    self.perform_action_button()
                elif event.key == pygame.K_p:
                    self.speed_ramp_enabled = not self.speed_ramp_enabled
                    self.update_speed_multiplier()
                elif event.key == pygame.K_m:
                    self.mobile_controls_forced = not self.mobile_controls_forced
                    if not self.mobile_controls_forced:
                        self.mobile_control_pointers.clear()
                elif event.key == pygame.K_r and self.game_over:
                    self.reset()
            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                if self.mobile_controls_visible() and not self.synthetic_mouse_suppressed():
                    self.press_mobile_control("mouse", event.pos)
            elif event.type == pygame.MOUSEMOTION and event.buttons[0]:
                if "mouse" in self.mobile_control_pointers and not self.synthetic_mouse_suppressed():
                    self.release_mobile_control("mouse")
                    self.press_mobile_control("mouse", event.pos, trigger_action=False)
            elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
                self.release_mobile_control("mouse")
            elif event.type == pygame.FINGERDOWN:
                self.mobile_controls_detected = True
                self.suppress_synthetic_mouse()
                pos = (round(event.x * WIDTH), round(event.y * HEIGHT))
                self.press_mobile_control(event.finger_id, pos)
            elif event.type == pygame.FINGERUP:
                self.suppress_synthetic_mouse()
                self.release_mobile_control(event.finger_id)
            elif event.type == pygame.FINGERMOTION:
                self.suppress_synthetic_mouse()
                if event.finger_id in self.mobile_control_pointers:
                    self.release_mobile_control(event.finger_id)
                    pos = (round(event.x * WIDTH), round(event.y * HEIGHT))
                    self.press_mobile_control(event.finger_id, pos, trigger_action=False)

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

        return self.hit_combo_streak

    def combo_reward(self, streak):
        if streak >= COMBO_STREAK_TARGET:
            return COMBO_BOUNCE_SPEED, "combo!"
        if streak >= MATCH_STREAK_TARGET:
            return MATCH_BOUNCE_SPEED, "match!"
        return BOUNCE_SPEED, None

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
        self.player.update(dt, keys, self.speed_multiplier, self.touch_direction())

        for balloon in self.balloons:
            balloon.wobble += dt * 4.0 * self.speed_multiplier
            if balloon.alive and self.player.sword_hit_circle(balloon):
                balloon.popped_timer = 0.001
                self.has_popped_balloon = True
                streak = self.register_balloon_combo_hit(balloon.color)
                bounce_speed, feedback_label = self.combo_reward(streak)
                self.pops.append(Pop(balloon.x, balloon.y, balloon.color, boosted=feedback_label is not None))
                if feedback_label:
                    self.combo_feedbacks.append(
                        ComboFeedback(balloon.x, balloon.y, balloon.color, feedback_label)
                    )
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

    def draw(self):
        self.renderer.draw(
            player=self.player,
            balloons=self.balloons,
            goal_markers=self.goal_markers,
            pops=self.pops,
            combo_feedbacks=self.combo_feedbacks,
            clouds=self.clouds,
            stars=self.stars,
            camera_y=self.camera_y,
            atmosphere=self.atmosphere_amount(),
            best_height=self.best_height,
            speed_multiplier=self.speed_multiplier,
            speed_ramp_enabled=self.speed_ramp_enabled,
            game_over=self.game_over,
            hit_combo_streak=self.hit_combo_streak,
            hit_combo_color=self.hit_combo_color,
            mobile_controls_visible=self.mobile_controls_visible(),
            mobile_control_rects=self.mobile_control_rects(),
            pressed_mobile_controls=self.pressed_mobile_controls(),
        )

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
