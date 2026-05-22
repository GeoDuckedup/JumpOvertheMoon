import asyncio
import math
import random
from pathlib import Path

import pygame

from balloon_gen import BalloonGenerator
from constants import *
from entities import *
from highscore import HighScoreService
from name_entry import NameEntry
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
        self.reentry_sprites = self.load_reentry_sprites()
        self.renderer = Renderer(
            self.screen,
            self.font,
            self.big_font,
            self.small_font,
            self.cat_sprites,
            self.balloon_sprites,
            self.goal_marker_sprites,
            self.reentry_sprites,
        )
        self.mobile_controls_detected = self.detect_mobile_controls()
        self.mobile_controls_forced = False
        self.mobile_control_pointers = {}
        self.mobile_action_ignore_until = 0
        self.mobile_name_entry_action_ignore_until = 0
        self.mobile_mouse_ignore_until = 0
        self.run_seed_rng = random.Random()
        self.highscore_service = HighScoreService(Path(__file__).resolve().parent)
        self.name_entry = None
        self.name_entry_submitted = False
        self.highscore_entry_score = 0
        self.name_entry_pressed_keys = set()
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

    def load_reentry_sprites(self):
        sprites = {}
        try:
            for phase, name in (
                (1, "light"),
            ):
                path = ASSET_DIR / f"reentry_trail_{name}.png"
                sprites[phase] = pygame.image.load(path).convert_alpha()
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
        self.name_entry = None
        self.name_entry_submitted = False
        self.highscore_entry_score = 0
        self.name_entry_pressed_keys.clear()
        self.has_popped_balloon = False
        self.hit_combo_color = None
        self.hit_combo_streak = 0
        self.fall_peak_height = 0.0
        self.reentry_stage = 0
        self.combo_feedbacks = []
        self.pops = []
        self.clouds = self.make_clouds()
        self.stars = self.make_stars()
        self.visual_rng = random.Random()
        self.shooting_stars = []
        self.shooting_star_timer = self.next_shooting_star_delay(0)
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

    def update_reentry_state(self):
        height = self.current_height()
        if self.player.on_ground:
            self.fall_peak_height = height
            self.reentry_stage = 0
            return

        if self.player.vy <= 0:
            self.fall_peak_height = max(self.fall_peak_height, height)
            self.reentry_stage = 0
            return

        fall_distance = max(0.0, self.fall_peak_height - height)
        if height < REENTRY_MIN_HEIGHT and self.reentry_stage == 0:
            return
        if self.player.vy < REENTRY_MIN_FALL_SPEED and self.reentry_stage == 0:
            return

        if fall_distance >= REENTRY_LIGHT_FALL_DISTANCE:
            self.reentry_stage = max(self.reentry_stage, 1)

    def next_shooting_star_delay(self, height):
        interval = SHOOTING_STAR_INTERVALS[-1][2]
        for min_height, max_height, candidate in SHOOTING_STAR_INTERVALS:
            if min_height <= height < max_height:
                interval = candidate
                break
        return self.visual_rng.uniform(*interval)

    def spawn_shooting_star(self):
        travels_right = self.visual_rng.random() < 0.25
        if travels_right:
            start_side = self.visual_rng.choice(("top", "left"))
            if start_side == "top":
                x = self.visual_rng.uniform(-WIDTH * 0.05, WIDTH * 0.82)
                y = self.visual_rng.uniform(-40, HEIGHT * 0.18)
            else:
                x = self.visual_rng.uniform(-70, WIDTH * 0.22)
                y = self.visual_rng.uniform(HEIGHT * 0.05, HEIGHT * 0.42)
            angle = self.visual_rng.uniform(math.radians(24), math.radians(48))
        else:
            start_side = self.visual_rng.choice(("top", "right"))
            if start_side == "top":
                x = self.visual_rng.uniform(WIDTH * 0.18, WIDTH * 1.05)
                y = self.visual_rng.uniform(-40, HEIGHT * 0.18)
            else:
                x = self.visual_rng.uniform(WIDTH * 0.78, WIDTH + 70)
                y = self.visual_rng.uniform(HEIGHT * 0.05, HEIGHT * 0.42)
            angle = self.visual_rng.uniform(math.radians(132), math.radians(156))

        speed = self.visual_rng.uniform(520, 760)
        self.shooting_stars.append(
            {
                "x": x,
                "y": y,
                "vx": math.cos(angle) * speed,
                "vy": math.sin(angle) * speed,
                "age": 0.0,
                "lifetime": SHOOTING_STAR_LIFETIME * self.visual_rng.uniform(0.82, 1.14),
                "length": self.visual_rng.uniform(62, 108),
                "width": self.visual_rng.choice((2, 2, 3)),
            }
        )

    def update_shooting_stars(self, dt):
        height = self.current_height()
        if height >= SHOOTING_STAR_MIN_HEIGHT and not self.shooting_stars:
            self.shooting_star_timer -= dt
            if self.shooting_star_timer <= 0:
                self.spawn_shooting_star()
                self.shooting_star_timer = self.next_shooting_star_delay(height)

        for star in self.shooting_stars:
            star["age"] += dt
            star["x"] += star["vx"] * dt
            star["y"] += star["vy"] * dt

        self.shooting_stars = [
            star
            for star in self.shooting_stars
            if star["age"] < star["lifetime"]
            and star["x"] > -160
            and star["y"] < HEIGHT + 160
        ]

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

    def suppress_mobile_name_entry_action(self):
        self.mobile_name_entry_action_ignore_until = max(
            self.mobile_name_entry_action_ignore_until,
            self.mobile_now_ms() + MOBILE_NAME_ENTRY_ACTION_SUPPRESS_MS,
        )

    def mobile_action_suppressed(self):
        return self.mobile_now_ms() < self.mobile_action_ignore_until

    def mobile_name_entry_action_suppressed(self):
        return self.mobile_now_ms() < self.mobile_name_entry_action_ignore_until

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
        if (
            trigger_action
            and control == "action"
            and self.highscore_entry_active()
            and self.mobile_name_entry_action_suppressed()
        ):
            return True

        self.mobile_control_pointers[pointer_id] = control
        if trigger_action and self.highscore_entry_active():
            if control == "left":
                self.name_entry.cycle_letter(-1)
                return True
            if control == "right":
                self.name_entry.cycle_letter(1)
                return True

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
            if self.highscore_entry_active():
                self.suppress_mobile_name_entry_action()
                self.suppress_mobile_action(MOBILE_NAME_ENTRY_ACTION_SUPPRESS_MS)
                self.suppress_synthetic_mouse()
                self.advance_name_entry()
                return

            self.suppress_mobile_action()
            self.suppress_synthetic_mouse()
            self.reset()
            return

        if self.player.on_ground:
            self.player.jump()
        else:
            self.player.start_slash()

    def highscore_entry_active(self):
        return self.name_entry is not None and not self.name_entry.done

    def should_enter_name_for_score(self, score):
        if score <= 0:
            return False
        return (
            self.highscore_service.is_new_local_best(score)
            or self.highscore_service.qualifies_for_leaderboard(score)
        )

    def enter_game_over(self):
        self.game_over = True
        self.highscore_entry_score = self.best_height
        self.highscore_service.request_refresh(force=True)
        if self.should_enter_name_for_score(self.highscore_entry_score):
            self.name_entry = NameEntry(self.highscore_service.local_initials)
            self.name_entry_submitted = False
            self.name_entry_pressed_keys = self.current_name_entry_arrow_keys()

    def submit_name_entry(self):
        if self.name_entry is None or self.name_entry_submitted:
            return
        self.highscore_service.submit(self.name_entry.initials, self.highscore_entry_score)
        self.name_entry_submitted = True

    def advance_name_entry(self):
        if self.name_entry is None:
            return
        self.name_entry.advance()
        if self.name_entry.done:
            self.submit_name_entry()

    def handle_name_entry_key(self, key):
        if not self.highscore_entry_active():
            return False

        if key in (pygame.K_LEFT, pygame.K_DOWN):
            self.name_entry_pressed_keys.add(key)
            self.name_entry.cycle_letter(-1)
            return True
        if key in (pygame.K_RIGHT, pygame.K_UP):
            self.name_entry_pressed_keys.add(key)
            self.name_entry.cycle_letter(1)
            return True
        if key in (pygame.K_SPACE, pygame.K_RETURN):
            self.advance_name_entry()
            return True
        if key == pygame.K_BACKSPACE:
            self.name_entry.backspace()
            return True
        if key == pygame.K_r:
            return True
        return False

    def current_name_entry_arrow_keys(self):
        keys = pygame.key.get_pressed()
        return {
            key
            for key in (pygame.K_LEFT, pygame.K_RIGHT, pygame.K_UP, pygame.K_DOWN)
            if keys[key]
        }

    def update_name_entry_key_edges(self):
        if not self.highscore_entry_active():
            self.name_entry_pressed_keys.clear()
            return

        pressed = self.current_name_entry_arrow_keys()
        for key in (pygame.K_LEFT, pygame.K_RIGHT, pygame.K_UP, pygame.K_DOWN):
            if key in pressed and key not in self.name_entry_pressed_keys:
                self.handle_name_entry_key(key)
        self.name_entry_pressed_keys = pressed

    def debug_jump_to_altitude(self, height=DEBUG_ALTITUDE_JUMP_HEIGHT):
        self.game_over = False
        self.has_popped_balloon = True
        self.player.x = WIDTH * 0.5
        self.player.y = WORLD_FLOOR_Y - height * 10
        self.player.vx = 0.0
        self.player.vy = 0.0
        self.player.on_ground = False
        self.player.slash_timer = 0.0
        self.camera_y = min(0.0, self.player.y - HEIGHT * 0.48)
        self.best_height = max(self.best_height, round(height))
        self.fall_peak_height = height
        self.reentry_stage = 0
        self.hit_pause_timer = 0.0
        self.ensure_balloons()

    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False
                elif self.handle_name_entry_key(event.key):
                    pass
                elif event.key == pygame.K_SPACE and not self.game_over:
                    self.perform_action_button()
                elif event.key == pygame.K_p:
                    self.speed_ramp_enabled = not self.speed_ramp_enabled
                    self.update_speed_multiplier()
                elif event.key == pygame.K_m:
                    self.mobile_controls_forced = not self.mobile_controls_forced
                    if not self.mobile_controls_forced:
                        self.mobile_control_pointers.clear()
                elif event.key == pygame.K_t:
                    self.debug_jump_to_altitude()
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
        self.highscore_service.tick()
        if self.name_entry is not None:
            self.name_entry.update(dt)
        self.update_shooting_stars(dt)

        if self.game_over:
            self.update_name_entry_key_edges()
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
        self.update_reentry_state()

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
                self.fall_peak_height = self.current_height()
                self.reentry_stage = 0
                self.hit_pause_timer = HIT_PAUSE_TIME

        for marker in self.goal_markers:
            if marker.alive and self.player.sword_hit_rect(self.goal_marker_hit_rect(marker)):
                marker.popped_timer = 0.001
                marker.reached = True
                self.has_popped_balloon = True
                self.pops.append(Pop(marker.x, marker.y + marker.hit_offset_y, (245, 245, 226)))
                self.player.bounce(speed_multiplier=self.speed_multiplier, speed=GOAL_BOUNCE_SPEED)
                self.fall_peak_height = self.current_height()
                self.reentry_stage = 0
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
            self.enter_game_over()

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
            shooting_stars=self.shooting_stars,
            camera_y=self.camera_y,
            height=self.current_height(),
            atmosphere=self.atmosphere_amount(),
            best_height=self.best_height,
            speed_multiplier=self.speed_multiplier,
            speed_ramp_enabled=self.speed_ramp_enabled,
            game_over=self.game_over,
            hit_combo_streak=self.hit_combo_streak,
            hit_combo_color=self.hit_combo_color,
            reentry_stage=self.reentry_stage,
            mobile_controls_visible=self.mobile_controls_visible(),
            mobile_control_rects=self.mobile_control_rects(),
            pressed_mobile_controls=self.pressed_mobile_controls(),
            name_entry=self.name_entry,
            highscore_service=self.highscore_service,
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
