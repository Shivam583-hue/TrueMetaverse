import Phaser from "phaser";
import type { Direction } from "../systems/GridMovement";
import {
  DRAW_ORDER,
  normalizeAppearance,
  type WokaAppearance,
  type WokaLayer,
} from "../woka/wokaConfig";
import {
  buildLayerSheet,
  COLS,
  FRAME_H,
  FRAME_W,
  ROWS,
} from "../woka/wokaRender";
import { CHARACTER_HEIGHT_TILES } from "./Player";

const DIR_ROW: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };

const WALK_FRAME_RATE = 8;

function textureKey(layer: WokaLayer, optionId: string): string {
  return `woka:${layer}:${optionId}`;
}

function ensureTexture(scene: Phaser.Scene, layer: WokaLayer, optionId: string): string {
  const key = textureKey(layer, optionId);
  if (!scene.textures.exists(key)) {
    const canvas = buildLayerSheet(layer, optionId);
    const texture = scene.textures.addCanvas(key, canvas);
    if (texture) {
      let index = 0;
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          texture.add(index, 0, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H);
          index++;
        }
      }
    }
  }
  ensureAnimations(scene, key);
  return key;
}

function ensureAnimations(scene: Phaser.Scene, texKey: string): void {
  for (const dir of Object.keys(DIR_ROW) as Direction[]) {
    const animKey = `${texKey}:${dir}`;
    if (scene.anims.exists(animKey)) continue;
    const base = DIR_ROW[dir] * COLS;
    scene.anims.create({
      key: animKey,
      frames: [base, base + 1, base + 2, base + 1].map((frame) => ({
        key: texKey,
        frame,
      })),
      frameRate: WALK_FRAME_RATE,
      repeat: -1,
    });
  }
}

type LayerSprite = { layer: WokaLayer; optionId: string; sprite: Phaser.GameObjects.Sprite };

export class Woka extends Phaser.GameObjects.Container {
  private layers: LayerSprite[] = [];
  private appearance: WokaAppearance;
  private facing: Direction = "down";
  private walking = false;

  constructor(scene: Phaser.Scene, tileSize: number, appearance?: WokaAppearance) {
    super(scene, 0, 0);
    this.appearance = normalizeAppearance(appearance);

    const scale = Math.min(
      (CHARACTER_HEIGHT_TILES * tileSize) / FRAME_H,
      tileSize / (FRAME_W * 0.6),
    );
    this.setScale(scale);

    this.rebuild();
    scene.add.existing(this);
  }

  get displayHeight(): number {
    return FRAME_H * this.scaleY;
  }

  setAppearance(appearance: WokaAppearance): void {
    this.appearance = normalizeAppearance(appearance);
    this.rebuild();
    if (this.walking) this.playWalk(this.facing);
    else this.faceIdle(this.facing);
  }

  playWalk(dir: Direction): void {
    this.facing = dir;
    this.walking = true;
    for (const l of this.layers) {
      l.sprite.play(`${textureKey(l.layer, l.optionId)}:${dir}`, true);
    }
  }

  faceIdle(dir: Direction): void {
    this.facing = dir;
    this.walking = false;
    const idle = DIR_ROW[dir] * COLS + 1;
    for (const l of this.layers) {
      l.sprite.stop();
      l.sprite.setFrame(idle);
    }
  }

  private rebuild(): void {
    for (const l of this.layers) l.sprite.destroy();
    this.layers = [];
    for (const layer of DRAW_ORDER) {
      const optionId = this.appearance[layer];
      if (optionId === "none") continue;
      const texKey = ensureTexture(this.scene, layer, optionId);
      const sprite = this.scene.add
        .sprite(0, 0, texKey, DIR_ROW[this.facing] * COLS + 1)
        .setOrigin(0.5, 1);
      this.add(sprite);
      this.layers.push({ layer, optionId, sprite });
    }
  }
}
