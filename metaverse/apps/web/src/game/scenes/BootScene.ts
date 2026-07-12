import Phaser from "phaser";
import type { SpaceConfig } from "../config/spaces";
import { CollisionGrid, type CollisionRows } from "../systems/CollisionGrid";

export const SPACE_TEXTURE = "space-image";
export const SPACE_FOREGROUND_TEXTURE = "space-foreground";

const MAX_TEXTURE_AXIS = 4096;

const PLACEHOLDER_COLS = 40;
const PLACEHOLDER_ROWS = 25;
const PLACEHOLDER_SOLIDS = [
  { x: 6, y: 4, w: 7, h: 3 },
  { x: 25, y: 7, w: 9, h: 2 },
  { x: 13, y: 16, w: 5, h: 5 },
];

export type SpaceSceneData = {
  config: SpaceConfig;
  collisionSource: CollisionRows | null;
};

export class BootScene extends Phaser.Scene {
  private dead = false;

  constructor(private spaceConfig: SpaceConfig) {
    super("boot");
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.dead = true;
    });
    void this.boot();
  }

  private async boot(): Promise<void> {
    const config = this.spaceConfig;
    const [imageOk, foregroundOk, collisionSource] = await Promise.all([
      probeAsset(config.imagePath, "image/"),
      config.foregroundPath
        ? probeAsset(config.foregroundPath, "image/")
        : Promise.resolve(false),
      fetchCollision(config.collisionPath),
    ]);
    if (this.dead) return;

    if (imageOk) this.load.image(SPACE_TEXTURE, config.imagePath);
    if (foregroundOk) {
      this.load.image(SPACE_FOREGROUND_TEXTURE, config.foregroundPath!);
    }

    if (this.load.list.size === 0) {
      this.finish(collisionSource);
      return;
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!this.dead) this.finish(collisionSource);
    });
    this.load.start();
  }

  private finish(collisionSource: CollisionRows | null): void {
    if (this.textures.exists(SPACE_TEXTURE)) {
      this.textures
        .get(SPACE_TEXTURE)
        .setFilter(Phaser.Textures.FilterMode.LINEAR);
      if (this.textures.exists(SPACE_FOREGROUND_TEXTURE)) {
        this.textures
          .get(SPACE_FOREGROUND_TEXTURE)
          .setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      const image = this.textures.get(SPACE_TEXTURE).getSourceImage();
      if (image.width > MAX_TEXTURE_AXIS || image.height > MAX_TEXTURE_AXIS) {
        console.warn(
          `space image is ${image.width}x${image.height}px; WebGL on some devices ` +
            `caps textures at ${MAX_TEXTURE_AXIS}px per axis - consider shrinking it`,
        );
      }
    } else {
      this.generatePlaceholderSpace(this.spaceConfig.tileSize);
    }

    this.scene.start("space", {
      config: this.spaceConfig,
      collisionSource,
    } satisfies SpaceSceneData);
  }

  private generatePlaceholderSpace(tileSize: number): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    for (let y = 0; y < PLACEHOLDER_ROWS; y++) {
      for (let x = 0; x < PLACEHOLDER_COLS; x++) {
        g.fillStyle((x + y) % 2 === 0 ? 0x1e2140 : 0x23274b, 1);
        g.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }
    for (const s of PLACEHOLDER_SOLIDS) {
      g.fillStyle(0x2c3166, 1);
      g.fillRect(
        s.x * tileSize,
        s.y * tileSize,
        s.w * tileSize,
        s.h * tileSize,
      );
      g.lineStyle(2, 0x3a3f7a, 1);
      g.strokeRect(
        s.x * tileSize,
        s.y * tileSize,
        s.w * tileSize,
        s.h * tileSize,
      );
    }
    g.generateTexture(
      SPACE_TEXTURE,
      PLACEHOLDER_COLS * tileSize,
      PLACEHOLDER_ROWS * tileSize,
    );
    g.destroy();
  }
}

async function probeAsset(path: string, typePrefix: string): Promise<boolean> {
  try {
    const res = await fetch(path);
    const type = res.headers.get("content-type") ?? "";
    return res.ok && type.startsWith(typePrefix);
  } catch {
    return false;
  }
}

async function fetchCollision(path: string): Promise<CollisionRows | null> {
  try {
    const res = await fetch(path, {
      headers: { Accept: "application/json" },
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.includes("json")) return null;
    const parsed = CollisionGrid.parse(await res.json());
    if (!parsed) {
      console.warn(`${path} is not a 2D array of 0/1; starting all-walkable`);
    }
    return parsed;
  } catch {
    return null;
  }
}
