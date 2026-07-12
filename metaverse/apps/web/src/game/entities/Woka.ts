import Phaser from "phaser";
import type { Direction } from "../systems/GridMovement";
import {
  DRAW_ORDER,
  normalizeAppearance,
  optionOf,
  type WokaAppearance,
  type WokaLayer,
} from "../woka/wokaConfig";
import { COLS, FRAME_H, FRAME_W, WALK_COLS } from "../woka/wokaRender";
import { CHARACTER_HEIGHT_TILES } from "./Player";

const DIR_ROW: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };
const WALK_FRAME_RATE = 8;

function ensureAnimations(scene: Phaser.Scene, texKey: string): void {
  for (const dir of Object.keys(DIR_ROW) as Direction[]) {
    const animKey = `${texKey}:${dir}`;
    if (scene.anims.exists(animKey)) continue;
    const base = DIR_ROW[dir] * COLS;
    scene.anims.create({
      key: animKey,
      frames: WALK_COLS.map((c) => ({ key: texKey, frame: base + c })),
      frameRate: WALK_FRAME_RATE,
      repeat: -1,
    });
  }
}

type LayerSprite = {
  layer: WokaLayer;
  url: string;
  sprite: Phaser.GameObjects.Sprite;
};

export class Woka extends Phaser.GameObjects.Container {
  private layerSprites: LayerSprite[] = [];
  private appearance: WokaAppearance;
  private facing: Direction = "down";
  private walking = false;
  private buildToken = 0;

  constructor(scene: Phaser.Scene, tileSize: number, appearance?: WokaAppearance) {
    super(scene, 0, 0);
    this.appearance = normalizeAppearance(appearance);
    this.setScale((CHARACTER_HEIGHT_TILES * tileSize) / FRAME_H);
    scene.add.existing(this);
    void this.rebuild();
  }

  get wokaHeight(): number {
    return FRAME_H * this.scaleY;
  }

  setAppearance(appearance: WokaAppearance): void {
    this.appearance = normalizeAppearance(appearance);
    void this.rebuild();
  }

  playWalk(dir: Direction): void {
    this.facing = dir;
    this.walking = true;
    for (const l of this.layerSprites) l.sprite.play(`${l.url}:${dir}`, true);
  }

  faceIdle(dir: Direction): void {
    this.facing = dir;
    this.walking = false;
    const idle = DIR_ROW[dir] * COLS + 1;
    for (const l of this.layerSprites) {
      l.sprite.stop();
      l.sprite.setFrame(idle);
    }
  }

  private async rebuild(): Promise<void> {
    const token = ++this.buildToken;
    const wanted: { layer: WokaLayer; url: string }[] = [];
    for (const layer of DRAW_ORDER) {
      const option = optionOf(layer, this.appearance[layer]);
      if (option.url) wanted.push({ layer, url: option.url });
    }

    const toLoad = wanted.filter((w) => !this.scene.textures.exists(w.url));
    if (toLoad.length > 0) {
      await new Promise<void>((resolve) => {
        for (const w of toLoad) {
          this.scene.load.spritesheet(w.url, w.url, {
            frameWidth: FRAME_W,
            frameHeight: FRAME_H,
          });
        }
        this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        this.scene.load.start();
      });
    }
    if (token !== this.buildToken || !this.scene) return;

    for (const l of this.layerSprites) l.sprite.destroy();
    this.layerSprites = [];
    const idle = DIR_ROW[this.facing] * COLS + 1;
    for (const w of wanted) {
      if (!this.scene.textures.exists(w.url)) continue;
      ensureAnimations(this.scene, w.url);
      const sprite = this.scene.add
        .sprite(0, 0, w.url, idle)
        .setOrigin(0.5, 1);
      this.add(sprite);
      this.layerSprites.push({ layer: w.layer, url: w.url, sprite });
    }
    if (this.walking) this.playWalk(this.facing);
    else this.faceIdle(this.facing);
  }
}
