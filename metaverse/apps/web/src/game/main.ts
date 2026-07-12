import Phaser from "phaser";
import {
  DEFAULT_SPACE_ID,
  SPACES,
  resolveSpaceConfig,
  type SpaceConfig,
} from "./config/spaces";
import { BootScene } from "./scenes/BootScene";
import { SpaceScene } from "./scenes/SpaceScene";
import type { MultiplayerSpaceScene } from "./scenes/MultiplayerSpaceScene";

export function deviceScale(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

function createGame(
  parent: HTMLElement,
  config: SpaceConfig,
  scene: SpaceScene,
): Phaser.Game {
  const dpr = deviceScale();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: "#07080f",
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.max(1, parent.clientWidth) * dpr,
      height: Math.max(1, parent.clientHeight) * dpr,
      zoom: 1 / dpr,
    },
    scene: [new BootScene(config), scene],
  });

  const applySize = () => {
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    game.scale.resize(w * dpr, h * dpr);
    if (game.canvas) {
      game.canvas.style.width = `${w}px`;
      game.canvas.style.height = `${h}px`;
    }
  };
  game.events.once(Phaser.Core.Events.READY, applySize);
  const observer = new ResizeObserver(applySize);
  observer.observe(parent);
  game.events.once(Phaser.Core.Events.DESTROY, () => observer.disconnect());

  return game;
}

export function createSpaceGame(
  parent: HTMLElement,
  spaceId: string = DEFAULT_SPACE_ID,
): Phaser.Game {
  const config = SPACES[spaceId] ?? SPACES[DEFAULT_SPACE_ID]!;
  return createGame(parent, config, new SpaceScene());
}

export function createArenaGame(
  parent: HTMLElement,
  mapImage: string | null,
  scene: MultiplayerSpaceScene,
): Phaser.Game {
  return createGame(parent, resolveSpaceConfig(mapImage), scene);
}
