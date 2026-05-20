import asyncio
import sys

import pygame

from game import Game


async def main():
    game = Game()
    try:
        await game.run_async()
    except KeyboardInterrupt:
        pygame.quit()
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
