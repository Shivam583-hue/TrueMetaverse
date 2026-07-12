import Phaser from "phaser";
import type { TileCoord } from "../config/spaces";
import type { CollisionGrid } from "./CollisionGrid";

export type Direction = "up" | "down" | "left" | "right";

export const MOVE_DURATION_MS = 170;
const INPUT_BUFFER_MS = 60;

const DELTAS: Record<Direction, TileCoord> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export type GridMovementHooks = {
  onWalk?: (dir: Direction) => void;
  onFace?: (dir: Direction) => void;
  onIdle?: (facing: Direction) => void;
};

export class GridMovement {
  private tileX: number;
  private tileY: number;
  private facingDir: Direction = "down";
  private tween: Phaser.Tweens.Tween | null = null;
  private queued: Direction | null = null;
  private walking = false;

  constructor(
    private scene: Phaser.Scene,
    private grid: CollisionGrid,
    private target: Phaser.GameObjects.Container,
    private tileSize: number,
    start: TileCoord,
    private hooks: GridMovementHooks = {},
  ) {
    this.tileX = start.x;
    this.tileY = start.y;
    this.snapToTile();
  }

  get tile(): TileCoord {
    return { x: this.tileX, y: this.tileY };
  }

  get facing(): Direction {
    return this.facingDir;
  }

  get moving(): boolean {
    return this.tween !== null;
  }

  update(intent: Direction | null): void {
    if (this.tween) {
      if (intent && this.remainingMs() <= INPUT_BUFFER_MS) this.queued = intent;
      return;
    }
    const dir = this.queued ?? intent;
    this.queued = null;
    if (dir) {
      this.tryStep(dir);
    } else if (this.walking) {
      this.walking = false;
      this.hooks.onIdle?.(this.facingDir);
    }
  }

  step(dir: Direction): boolean {
    if (this.tween) {
      this.queued = dir;
      return false;
    }
    return this.tryStep(dir);
  }

  forceSetTile(tile: TileCoord): void {
    this.tween?.remove();
    this.tween = null;
    this.queued = null;
    this.tileX = tile.x;
    this.tileY = tile.y;
    this.snapToTile();
  }

  private tryStep(dir: Direction): boolean {
    this.facingDir = dir;
    const nx = this.tileX + DELTAS[dir].x;
    const ny = this.tileY + DELTAS[dir].y;
    if (this.grid.isBlocked(nx, ny)) {
      this.walking = false;
      this.hooks.onFace?.(dir);
      return false;
    }
    this.tileX = nx;
    this.tileY = ny;
    this.walking = true;
    this.hooks.onWalk?.(dir);
    this.tween = this.scene.tweens.add({
      targets: this.target,
      x: this.pixelX(nx),
      y: this.pixelY(ny),
      duration: MOVE_DURATION_MS,
      ease: "Linear",
      onComplete: () => {
        this.tween = null;
        if (this.queued) {
          const next = this.queued;
          this.queued = null;
          this.tryStep(next);
        }
      },
    });
    return true;
  }

  private remainingMs(): number {
    if (!this.tween) return 0;
    return Math.max(0, MOVE_DURATION_MS * (1 - this.tween.progress));
  }

  private snapToTile(): void {
    this.target.setPosition(this.pixelX(this.tileX), this.pixelY(this.tileY));
  }

  private pixelX(tx: number): number {
    return (tx + 0.5) * this.tileSize;
  }

  private pixelY(ty: number): number {
    return (ty + 1) * this.tileSize;
  }
}
