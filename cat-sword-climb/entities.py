import math
from dataclasses import dataclass

import pygame

from constants import *


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

    def update(self, dt, keys, speed_multiplier, touch_direction=0):
        direction = 0
        if keys[pygame.K_LEFT]:
            direction -= 1
        if keys[pygame.K_RIGHT]:
            direction += 1
        direction += touch_direction
        direction = max(-1, min(1, direction))

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
