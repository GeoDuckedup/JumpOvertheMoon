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
SPEED_RAMP_HEIGHT = 2600.0
MAX_SPEED_MULTIPLIER = 1.7

WORLD_FLOOR_Y = 660.0
BALLOON_SPACING_MIN = 115
BALLOON_SPACING_MAX = 180

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


@dataclass
class Balloon:
    x: float
    y: float
    radius: float
    color: tuple[int, int, int]
    wobble: float
    popped_timer: float = 0.0

    @property
    def alive(self):
        return self.popped_timer <= 0


@dataclass
class Pop:
    x: float
    y: float
    color: tuple[int, int, int]
    age: float = 0.0


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
        pygame.display.set_caption("Cat Sword Climb")
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont("arial", 22, bold=True)
        self.big_font = pygame.font.SysFont("arial", 52, bold=True)
        self.small_font = pygame.font.SysFont("arial", 16, bold=True)
        self.cat_sprites = self.load_cat_sprites()
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

    def reset(self):
        self.player = Player()
        self.camera_y = 0.0
        self.best_height = 0
        self.speed_multiplier = 1.0
        self.hit_pause_timer = 0.0
        self.game_over = False
        self.has_popped_balloon = False
        self.pops = []
        self.clouds = self.make_clouds()
        self.stars = self.make_stars()
        self.balloons = []
        self.next_balloon_y = WORLD_FLOOR_Y - 150
        while self.next_balloon_y > -1800:
            self.spawn_balloon()

    def make_clouds(self):
        random.seed(8)
        return [
            (
                random.randrange(20, WIDTH - 20),
                random.randrange(-3600, HEIGHT),
                random.randrange(34, 78),
                random.random() * 2.0,
            )
            for _ in range(45)
        ]

    def make_stars(self):
        random.seed(19)
        return [
            (
                random.randrange(0, WIDTH),
                random.randrange(0, HEIGHT + 220),
                random.choice((1, 1, 1, 2)),
                random.random() * math.tau,
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

    def spawn_balloon(self):
        radius = random.randrange(23, 34)
        margin = radius + 32
        x = random.randrange(margin, WIDTH - margin)
        y = self.next_balloon_y
        color = random.choice(BALLOON_COLORS)
        self.balloons.append(Balloon(x, y, radius, color, random.random() * math.tau))
        self.next_balloon_y -= random.randrange(BALLOON_SPACING_MIN, BALLOON_SPACING_MAX)

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
                elif event.key == pygame.K_r and self.game_over:
                    self.reset()

    def update_speed_multiplier(self):
        current_height = self.current_height()
        self.speed_multiplier = min(
            MAX_SPEED_MULTIPLIER,
            1.0 + current_height / SPEED_RAMP_HEIGHT,
        )

    def update(self, dt):
        if self.game_over:
            for pop in self.pops:
                pop.age += dt
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
                self.pops.append(Pop(balloon.x, balloon.y, balloon.color))
                self.player.bounce(speed_multiplier=self.speed_multiplier)
                self.hit_pause_timer = HIT_PAUSE_TIME

        for balloon in self.balloons:
            if balloon.popped_timer > 0:
                balloon.popped_timer += dt

        for pop in self.pops:
            pop.age += dt
        self.pops = [pop for pop in self.pops if pop.age < 0.45]

        if self.player.y < self.camera_y + HEIGHT * 0.38:
            self.camera_y = self.player.y - HEIGHT * 0.38
        elif self.player.y > self.camera_y + HEIGHT * 0.64:
            self.camera_y = self.player.y - HEIGHT * 0.64
        self.camera_y = min(0.0, self.camera_y)

        height = max(0, int((WORLD_FLOOR_Y - self.player.y) / 10))
        self.best_height = max(self.best_height, height)
        self.update_speed_multiplier()

        self.ensure_balloons()

        if self.has_popped_balloon and self.player.on_ground:
            self.game_over = True

    def world_to_screen(self, x, y):
        return int(x), int(y - self.camera_y)

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

    def draw_balloon(self, balloon):
        sx, sy = self.world_to_screen(
            balloon.x + math.sin(balloon.wobble) * 4,
            balloon.y + math.cos(balloon.wobble * 0.7) * 3,
        )
        if sy < -90 or sy > HEIGHT + 90:
            return

        if balloon.alive:
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
            for i in range(10):
                angle = i * math.tau / 10
                distance = 12 + t * 52
                px = sx + math.cos(angle) * distance
                py = sy + math.sin(angle) * distance + t * 18
                pygame.draw.circle(self.screen, pop.color, (int(px), int(py)), max(1, int(5 * (1 - t))))

    def current_player_sprite_name(self):
        if self.player.slashing:
            return "slash"
        if self.player.vy < -120:
            return "jump"
        if self.player.vy > 170:
            return "fall"
        return "idle"

    def draw_player_sprite(self):
        p = self.player
        name = self.current_player_sprite_name()
        sprite = self.cat_sprites[name]
        target_heights = {
            "idle": 104,
            "jump": 118,
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
        speed_text = self.small_font.render(f"speed x{self.speed_multiplier:.2f}", True, (232, 239, 234))
        self.screen.blit(speed_text, (18, 44))

        hint = self.small_font.render("arrows move   space jump/downslash   esc quit", True, (232, 239, 234))
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
        for balloon in self.balloons:
            self.draw_balloon(balloon)
        self.draw_pop_particles()
        self.draw_player()
        self.draw_hud()
        pygame.display.flip()

    def run(self):
        while self.running:
            dt = min(1 / 30, self.clock.tick(FPS) / 1000)
            self.handle_events()
            self.update(dt)
            self.draw()

        pygame.quit()


def main():
    try:
        Game().run()
    except KeyboardInterrupt:
        pygame.quit()
        sys.exit(0)


if __name__ == "__main__":
    main()
