import math

from constants import *
from entities import Balloon


class BalloonGenerator:
    def __init__(self, rng, goal_markers, goal_marker_sprites):
        self.rng = rng
        self.goal_markers = goal_markers
        self.goal_marker_sprites = goal_marker_sprites
        self.last_balloon_x = WIDTH * 0.5
        self.next_balloon_y = WORLD_FLOOR_Y - 150
        self.goal_approach_marker_names = set()

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
        drift = self.rng.randrange(
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

    def choose_main_balloon_color(self):
        return self.rng.choice(BALLOON_COLORS)

    def choose_side_balloon_color(self):
        return self.rng.choice(BALLOON_COLORS)

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
            low, high = self.rng.choice(candidates)
            return self.rng.randrange(round(low), round(high) + 1)

        return max(left, min(right, main_x))

    def maybe_spawn_side_balloon(self, main_x, main_y):
        if self.rng.random() > OPTIONAL_SIDE_BALLOON_CHANCE:
            return None

        radius = self.rng.randrange(22, 32)
        margin = radius + 32
        x = self.side_balloon_x(main_x, margin)
        if abs(x - main_x) < OPTIONAL_SIDE_BALLOON_MIN_X_OFFSET * 0.75:
            return None

        y = main_y + self.rng.randrange(
            -OPTIONAL_SIDE_BALLOON_Y_JITTER,
            OPTIONAL_SIDE_BALLOON_Y_JITTER + 1,
        )
        if self.goal_marker_near_balloon_y(y):
            return None

        color = self.choose_side_balloon_color()
        return Balloon(x, y, radius, color, self.rng.random() * math.tau, route_role="side")

    def spawn_goal_approach_balloon(self, marker):
        if marker.name in self.goal_approach_marker_names:
            return None

        self.goal_approach_marker_names.add(marker.name)
        _, clearance_bottom = self.goal_marker_balloon_clearance_band(marker)
        radius = self.rng.randrange(27, 34)
        margin = radius + 32
        x = marker.x + self.rng.randrange(
            -GOAL_APPROACH_X_JITTER,
            GOAL_APPROACH_X_JITTER + 1,
        )
        x = max(margin, min(WIDTH - margin, x))
        y = clearance_bottom + GOAL_APPROACH_BALLOON_GAP
        color = self.choose_main_balloon_color()

        return Balloon(x, y, radius, color, self.rng.random() * math.tau, route_role="main")

    def spawn_balloon(self):
        results = []
        y = self.next_balloon_y
        self.next_balloon_y -= self.rng.randrange(BALLOON_SPACING_MIN, BALLOON_SPACING_MAX)
        nearby_marker = self.goal_marker_near_balloon_y(y)
        if nearby_marker:
            balloon = self.spawn_goal_approach_balloon(nearby_marker)
            if balloon:
                results.append(balloon)
            self.last_balloon_x = nearby_marker.x
            return results

        radius = self.rng.randrange(23, 34)
        margin = radius + 32
        x = self.next_balloon_x(margin)
        self.last_balloon_x = x
        color = self.choose_main_balloon_color()
        results.append(Balloon(x, y, radius, color, self.rng.random() * math.tau))
        side = self.maybe_spawn_side_balloon(x, y)
        if side:
            results.append(side)
        return results

    def spawn_needed(self, camera_y):
        new_balloons = []
        target_top = camera_y - 1200
        while self.next_balloon_y > target_top:
            new_balloons.extend(self.spawn_balloon())
        return new_balloons
