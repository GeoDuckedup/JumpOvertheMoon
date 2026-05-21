import math

import pygame

from constants import *


class Renderer:
    def __init__(
        self,
        screen,
        font,
        big_font,
        small_font,
        cat_sprites,
        balloon_sprites,
        goal_marker_sprites,
    ):
        self.screen = screen
        self.font = font
        self.big_font = big_font
        self.small_font = small_font
        self.cat_sprites = cat_sprites
        self.balloon_sprites = balloon_sprites
        self.goal_marker_sprites = goal_marker_sprites

    def world_to_screen(self, x, y, camera_y):
        return int(x), int(y - camera_y)

    def blend_color(self, a, b, t):
        return (
            int(a[0] * (1 - t) + b[0] * t),
            int(a[1] * (1 - t) + b[1] * t),
            int(a[2] * (1 - t) + b[2] * t),
        )

    def smoothstep(self, t):
        t = min(1.0, max(0.0, t))
        return t * t * (3 - 2 * t)

    def background_phase_pair(self, height):
        phases = BACKGROUND_PHASES
        for index, phase in enumerate(phases[:-1]):
            next_phase = phases[index + 1]
            if height <= next_phase["height"]:
                span = next_phase["height"] - phase["height"]
                mix = self.smoothstep((height - phase["height"]) / span)
                return phase, next_phase, mix

        return phases[-1], phases[-1], 0.0

    def background_color(self, height, key):
        phase, next_phase, mix = self.background_phase_pair(height)
        return self.blend_color(phase[key], next_phase[key], mix)

    def background_value(self, height, key):
        phase, next_phase, mix = self.background_phase_pair(height)
        return phase[key] * (1 - mix) + next_phase[key] * mix

    def color_name(self, color):
        try:
            return BALLOON_SPRITE_NAMES[BALLOON_COLORS.index(color)]
        except ValueError:
            return "color"

    def goal_marker_hit_rect(self, marker):
        return pygame.Rect(
            round(marker.x - marker.hit_width * 0.5),
            round(marker.y + marker.hit_offset_y - marker.hit_height * 0.5),
            round(marker.hit_width),
            round(marker.hit_height),
        )

    def draw_gradient(self, height):
        sky_top = self.background_color(height, "top")
        sky_bottom = self.background_color(height, "bottom")
        for y in range(0, HEIGHT, 4):
            t = y / HEIGHT
            color = (
                int(sky_top[0] * (1 - t) + sky_bottom[0] * t),
                int(sky_top[1] * (1 - t) + sky_bottom[1] * t),
                int(sky_top[2] * (1 - t) + sky_bottom[2] * t),
            )
            pygame.draw.rect(self.screen, color, (0, y, WIDTH, 4))

    def draw_nebula(self, camera_y, height):
        nebula = self.background_value(height, "nebula")
        if nebula <= 0.02:
            return

        layer = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        scroll = camera_y * 0.012
        ticks = pygame.time.get_ticks() * 0.00008

        for y in range(0, HEIGHT, 6):
            wave = math.sin(y * 0.013 + scroll + ticks)
            color = self.blend_color((30, 75, 137), (130, 38, 142), (wave + 1) * 0.5)
            alpha = int((4 + 8 * abs(wave)) * nebula)
            pygame.draw.rect(layer, (*color, alpha), (0, y, WIDTH, 6))

        ribbons = (
            ((65, 139, 211), 0.11, 0.0),
            ((180, 73, 150), 0.08, 2.1),
            ((226, 132, 71), 0.06, 4.4),
        )
        for color, speed, phase in ribbons:
            base_y = (camera_y * speed + phase * 120) % (HEIGHT + 520) - 260
            sway = math.sin(ticks * 4 + phase) * 34
            alpha = int(18 * nebula)
            points = [
                (-80, base_y + sway),
                (WIDTH + 80, base_y + 110 - sway * 0.4),
                (WIDTH + 80, base_y + 205 - sway * 0.2),
                (-80, base_y + 92 + sway * 0.6),
            ]
            pygame.draw.polygon(layer, (*color, alpha), points)

        self.screen.blit(layer, (0, 0))

    def draw_stars(self, stars, camera_y, atmosphere, height):
        star_strength = max(
            self.background_value(height, "star"),
            min(1.0, max(0.0, (atmosphere - 0.05) / 0.65)),
        )
        if star_strength <= 0.02:
            return

        alpha = int(235 * star_strength)
        star_layer = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        ticks = pygame.time.get_ticks() * 0.002
        for x, y, size, phase in stars:
            sy = (y - camera_y * 0.08) % (HEIGHT + 220) - 110
            twinkle = 0.65 + 0.35 * math.sin(ticks + phase)
            star_alpha = int(alpha * twinkle)
            color = (245, 245, 226, star_alpha)
            pygame.draw.circle(star_layer, color, (int(x), int(sy)), size)
            if size > 1 and star_strength > 0.7:
                pygame.draw.line(star_layer, color, (x - 3, sy), (x + 3, sy), 1)
                pygame.draw.line(star_layer, color, (x, sy - 3), (x, sy + 3), 1)
        self.screen.blit(star_layer, (0, 0))

    def draw_shooting_stars(self, shooting_stars):
        if not shooting_stars:
            return

        layer = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        for star in shooting_stars:
            t = star["age"] / star["lifetime"]
            fade = math.sin(min(1.0, max(0.0, t)) * math.pi)
            if fade <= 0:
                continue

            speed = max(1.0, math.hypot(star["vx"], star["vy"]))
            dx = star["vx"] / speed
            dy = star["vy"] / speed
            head = (star["x"], star["y"])
            length = star["length"]
            alpha = int(205 * fade)
            width = star["width"]

            for segment in range(4):
                segment_start = segment / 4
                segment_end = (segment + 1) / 4
                start = (
                    head[0] - dx * length * segment_start,
                    head[1] - dy * length * segment_start,
                )
                end = (
                    head[0] - dx * length * segment_end,
                    head[1] - dy * length * segment_end,
                )
                segment_alpha = int(alpha * (1 - segment_start) ** 1.7)
                pygame.draw.line(
                    layer,
                    (245, 245, 226, segment_alpha),
                    (int(start[0]), int(start[1])),
                    (int(end[0]), int(end[1])),
                    max(1, width - segment // 2),
                )

            pygame.draw.circle(layer, (255, 255, 241, alpha), (int(head[0]), int(head[1])), 2)

        self.screen.blit(layer, (0, 0))

    def draw_clouds(self, clouds, camera_y, atmosphere, height):
        cloud_strength = min(
            self.background_value(height, "cloud"),
            max(0.0, 1.0 - atmosphere * 1.15),
        )
        cloud_alpha = int(230 * cloud_strength)
        if cloud_alpha <= 0:
            return

        cloud_layer = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        for x, y, size, drift in clouds:
            sy = y - camera_y * 0.32
            wrapped = (sy + 180) % (HEIGHT + 260) - 160
            sx = int((x + math.sin(pygame.time.get_ticks() * 0.0002 + drift) * 18) % WIDTH)
            color = (232, 239, 234, cloud_alpha)
            pygame.draw.ellipse(cloud_layer, color, (sx - size, wrapped, size * 1.8, size * 0.54))
            pygame.draw.ellipse(cloud_layer, color, (sx - size * 0.4, wrapped - size * 0.18, size, size * 0.54))
        self.screen.blit(cloud_layer, (0, 0))

    def draw_floor(self, camera_y):
        y = WORLD_FLOOR_Y - camera_y
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

    def draw_goal_marker_burst(self, marker, camera_y):
        if marker.popped_timer <= 0 or marker.popped_timer >= GOAL_POP_TIME:
            return

        sx, sy = self.world_to_screen(marker.x, marker.y + marker.hit_offset_y, camera_y)
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

    def draw_goal_markers(self, goal_markers, camera_y):
        for marker in goal_markers:
            if not marker.alive:
                self.draw_goal_marker_burst(marker, camera_y)
                continue

            sx, sy = self.world_to_screen(marker.x, marker.y, camera_y)
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
                x, y = self.world_to_screen(hit_rect.centerx, hit_rect.centery, camera_y)
                fallback_rect = pygame.Rect(0, 0, hit_rect.width, hit_rect.height)
                fallback_rect.center = (x, y)
                pygame.draw.rect(self.screen, (180, 187, 184), fallback_rect, border_radius=9)
                pygame.draw.rect(self.screen, INK, fallback_rect, 2, border_radius=9)
                self.draw_goal_marker_label(marker, x, fallback_rect.top - 22)

    def draw_balloon(self, balloon, camera_y):
        sx, sy = self.world_to_screen(
            balloon.x + math.sin(balloon.wobble) * 4,
            balloon.y + math.cos(balloon.wobble * 0.7) * 3,
            camera_y,
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

    def draw_pop_particles(self, pops, camera_y):
        for pop in pops:
            sx, sy = self.world_to_screen(pop.x, pop.y, camera_y)
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

    def draw_combo_feedback(self, combo_feedbacks, camera_y):
        for feedback in combo_feedbacks:
            sx, sy = self.world_to_screen(feedback.x, feedback.y, camera_y)
            t = feedback.age / COMBO_FEEDBACK_TIME
            if t >= 1:
                continue

            y = sy - int(72 * t) - 34
            pulse = 1.0 + math.sin(t * math.pi) * 0.14
            ring_radius = int((28 + 44 * t) * pulse)
            line_width = max(1, int(5 * (1 - t)))
            pygame.draw.circle(self.screen, (255, 236, 150), (sx, sy), ring_radius, line_width)
            pygame.draw.circle(self.screen, feedback.color, (sx, sy), max(4, int(ring_radius * 0.28)), 2)

            shadow = self.big_font.render(feedback.label, True, (13, 14, 22))
            label = self.big_font.render(feedback.label, True, (255, 236, 150))
            rect = label.get_rect(center=(sx, y))
            self.screen.blit(shadow, rect.move(2, 3))
            self.screen.blit(label, rect)

    def current_player_sprite_name(self, player):
        if player.slashing:
            return "slash"
        if player.on_ground:
            return "idle"
        if player.vy < -120:
            return "jump"
        return "fall"

    def draw_player_sprite(self, player, camera_y):
        p = player
        name = self.current_player_sprite_name(player)
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

        sx, sy = self.world_to_screen(p.x, p.y, camera_y)
        ox, oy = offsets[name]
        rect = image.get_rect(center=(sx + ox, sy + oy))
        self.screen.blit(image, rect)

    def draw_player(self, player, camera_y):
        if self.cat_sprites:
            self.draw_player_sprite(player, camera_y)
            return

        p = player
        sx, sy = self.world_to_screen(p.x, p.y, camera_y)

        if p.slashing:
            base_world, tip_world = p.sword_segment()
            base = self.world_to_screen(*base_world, camera_y)
            tip = self.world_to_screen(*tip_world, camera_y)
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

    def draw_hud(
        self,
        best_height,
        speed_multiplier,
        speed_ramp_enabled,
        hit_combo_streak,
        hit_combo_color,
        game_over,
        mobile_controls_visible,
    ):
        height_text = self.font.render(f"height {best_height}m", True, WHITE)
        self.screen.blit(height_text, (18, 16))
        speed_label = f"speed x{speed_multiplier:.2f}"
        if not speed_ramp_enabled:
            speed_label += " ramp off"
        speed_text = self.small_font.render(speed_label, True, (232, 239, 234))
        self.screen.blit(speed_text, (18, 44))

        if hit_combo_streak > 0 and hit_combo_color:
            combo_name = self.color_name(hit_combo_color)
            combo_label = f"combo {combo_name} {hit_combo_streak}/{COMBO_STREAK_TARGET}"
            combo_text = self.small_font.render(combo_label, True, hit_combo_color)
            combo_shadow = self.small_font.render(combo_label, True, (11, 13, 18))
            self.screen.blit(combo_shadow, (19, 68))
            self.screen.blit(combo_text, (18, 67))
            dot_x = 28 + combo_text.get_width()
            pygame.draw.circle(self.screen, hit_combo_color, (dot_x, 76), 6)
            pygame.draw.circle(self.screen, WHITE, (dot_x, 76), 6, 1)

        if not mobile_controls_visible:
            hint = self.small_font.render("arrows move   space jump/downslash   P speed ramp   esc quit", True, (232, 239, 234))
            self.screen.blit(hint, (18, HEIGHT - 30))

        if game_over:
            overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            overlay.fill((14, 15, 22, 170))
            self.screen.blit(overlay, (0, 0))
            title = self.big_font.render("FALLEN", True, WHITE)
            score = self.font.render(f"best height: {best_height}m", True, WHITE)
            retry_label = "tap action to climb again" if mobile_controls_visible else "press R to climb again"
            retry = self.font.render(retry_label, True, (255, 219, 116))
            self.screen.blit(title, title.get_rect(center=(WIDTH // 2, HEIGHT // 2 - 56)))
            self.screen.blit(score, score.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 2)))
            self.screen.blit(retry, retry.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 42)))

    def arrow_points(self, rect, direction):
        inset = max(18, rect.width // 3)
        if direction < 0:
            return [
                (rect.left, rect.centery),
                (rect.left + inset, rect.top),
                (rect.right, rect.top),
                (rect.right, rect.bottom),
                (rect.left + inset, rect.bottom),
            ]

        return [
            (rect.right, rect.centery),
            (rect.right - inset, rect.top),
            (rect.left, rect.top),
            (rect.left, rect.bottom),
            (rect.right - inset, rect.bottom),
        ]

    def draw_arrow_button(self, layer, rect, direction, pressed):
        fill_alpha = MOBILE_CONTROL_PRESSED_ALPHA if pressed else MOBILE_CONTROL_ALPHA
        fill = (15, 18, 27, fill_alpha)
        border = (245, 245, 239, MOBILE_CONTROL_BORDER_ALPHA)
        shadow_rect = rect.move(0, 5)
        shadow_points = self.arrow_points(shadow_rect, direction)
        pygame.draw.polygon(layer, (0, 0, 0, MOBILE_CONTROL_SHADOW_ALPHA), shadow_points)

        points = self.arrow_points(rect, direction)
        pygame.draw.polygon(layer, fill, points)
        pygame.draw.lines(layer, border, True, points, 3)

        notch = rect.width // 4
        stem_left = rect.left + notch if direction < 0 else rect.left + rect.width // 5
        stem_right = rect.right - rect.width // 5 if direction < 0 else rect.right - notch
        pygame.draw.line(
            layer,
            (245, 245, 239, 110 if not pressed else 185),
            (stem_left, rect.centery),
            (stem_right, rect.centery),
            5,
        )

    def draw_action_button(self, layer, rect, label, pressed):
        fill_alpha = MOBILE_CONTROL_PRESSED_ALPHA if pressed else MOBILE_CONTROL_ALPHA
        fill = (15, 18, 27, fill_alpha)
        border = (245, 245, 239, MOBILE_CONTROL_BORDER_ALPHA)
        shadow_rect = rect.move(0, 5)
        pygame.draw.rect(layer, (0, 0, 0, MOBILE_CONTROL_SHADOW_ALPHA), shadow_rect, border_radius=28)
        pygame.draw.rect(layer, fill, rect, border_radius=28)
        pygame.draw.rect(layer, border, rect, 3, border_radius=28)
        pygame.draw.circle(
            layer,
            (255, 236, 150, 150 if pressed else 95),
            rect.center,
            rect.width // 3,
            3,
        )

        text = self.font.render(label, True, (255, 236, 150) if label == "SLASH" else WHITE)
        layer.blit(text, text.get_rect(center=rect.center))

    def draw_mobile_controls(self, player, game_over, control_rects, pressed_controls):
        layer = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        self.draw_arrow_button(layer, control_rects["left"], -1, "left" in pressed_controls)
        self.draw_arrow_button(layer, control_rects["right"], 1, "right" in pressed_controls)
        if game_over:
            action_label = "RETRY"
        elif player.on_ground:
            action_label = "JUMP"
        else:
            action_label = "SLASH"
        self.draw_action_button(layer, control_rects["action"], action_label, "action" in pressed_controls)
        self.screen.blit(layer, (0, 0))

    def draw(
        self,
        player,
        balloons,
        goal_markers,
        pops,
        combo_feedbacks,
        clouds,
        stars,
        shooting_stars,
        camera_y,
        height,
        atmosphere,
        best_height,
        speed_multiplier,
        speed_ramp_enabled,
        game_over,
        hit_combo_streak,
        hit_combo_color,
        mobile_controls_visible=False,
        mobile_control_rects=None,
        pressed_mobile_controls=None,
    ):
        self.draw_gradient(height)
        self.draw_nebula(camera_y, height)
        self.draw_stars(stars, camera_y, atmosphere, height)
        self.draw_shooting_stars(shooting_stars)
        self.draw_clouds(clouds, camera_y, atmosphere, height)
        self.draw_floor(camera_y)
        self.draw_goal_markers(goal_markers, camera_y)
        for balloon in balloons:
            self.draw_balloon(balloon, camera_y)
        self.draw_pop_particles(pops, camera_y)
        self.draw_player(player, camera_y)
        self.draw_combo_feedback(combo_feedbacks, camera_y)
        self.draw_hud(
            best_height,
            speed_multiplier,
            speed_ramp_enabled,
            hit_combo_streak,
            hit_combo_color,
            game_over,
            mobile_controls_visible,
        )
        if mobile_controls_visible and mobile_control_rects:
            self.draw_mobile_controls(
                player,
                game_over,
                mobile_control_rects,
                pressed_mobile_controls or set(),
            )
        pygame.display.flip()
