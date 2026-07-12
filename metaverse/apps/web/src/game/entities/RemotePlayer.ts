import type Phaser from "phaser";
import type { TileCoord } from "../config/spaces";
import type { CollisionGrid } from "../systems/CollisionGrid";
import { GridMovement, type Direction } from "../systems/GridMovement";
import { Player } from "./Player";

export class RemotePlayer {
  readonly player: Player;
  private movement: GridMovement;
  private serverTile: TileCoord;

  constructor(
    scene: Phaser.Scene,
    grid: CollisionGrid,
    tileSize: number,
    readonly userId: string,
    start: TileCoord,
    depth: number,
  ) {
    this.player = new Player(scene, 0, 0, tileSize);
    this.player.setDepth(depth);
    this.serverTile = { ...start };
    this.movement = new GridMovement(
      scene,
      grid,
      this.player,
      tileSize,
      start,
      {
        onWalk: (dir) => this.player.playWalk(dir),
        onFace: (dir) => this.player.faceIdle(dir),
        onIdle: (dir) => this.player.faceIdle(dir),
      },
    );
  }

  update(): void {
    this.movement.update(null);
  }

  applyPosition(tile: TileCoord): void {
    const dx = tile.x - this.serverTile.x;
    const dy = tile.y - this.serverTile.y;
    const dir = singleStepDirection(dx, dy);
    if (!this.movement.moving) {
      const at = this.movement.tile;
      if (at.x !== this.serverTile.x || at.y !== this.serverTile.y) {
        this.movement.forceSetTile(this.serverTile);
      }
    }
    this.serverTile = { ...tile };
    if (dir) {
      this.movement.step(dir);
    } else {
      this.movement.forceSetTile(tile);
    }
  }

  destroy(): void {
    this.movement.forceSetTile(this.serverTile);
    this.player.destroy();
  }
}

function singleStepDirection(dx: number, dy: number): Direction | null {
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dx === 0 && dy === 1) return "down";
  if (dx === 0 && dy === -1) return "up";
  return null;
}
