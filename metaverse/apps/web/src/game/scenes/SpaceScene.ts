import Phaser from "phaser";
import { EventBus, SpaceEvent } from "../EventBus";
import type { SpaceConfig, TileCoord } from "../config/spaces";
import { CollisionGrid, type CollisionRows } from "../systems/CollisionGrid";
import { GridMovement, type Direction } from "../systems/GridMovement";
import { CameraController } from "../systems/CameraController";
import type { CollisionEditor } from "../systems/CollisionEditor";
import { Player } from "../entities/Player";
import {
  SPACE_FOREGROUND_TEXTURE,
  SPACE_TEXTURE,
  type SpaceSceneData,
} from "./BootScene";

const DEPTH_SPACE = 0;
const DEPTH_PLAYER = 10;
const DEPTH_FOREGROUND = 20;

export class SpaceScene extends Phaser.Scene {
  protected spaceConfig!: SpaceConfig;
  private collisionSource: CollisionRows | null = null;

  protected grid!: CollisionGrid;
  protected player!: Player;
  protected movement!: GridMovement;
  private cameraController!: CameraController;
  private editor: CollisionEditor | null = null;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;

  constructor() {
    super("space");
  }

  init(data: SpaceSceneData): void {
    this.spaceConfig = data.config;
    this.collisionSource = data.collisionSource;
  }

  create(): void {
    const tileSize = this.spaceConfig.tileSize;

    const image = this.add
      .image(0, 0, SPACE_TEXTURE)
      .setOrigin(0)
      .setDepth(DEPTH_SPACE);
    if (this.textures.exists(SPACE_FOREGROUND_TEXTURE)) {
      this.add
        .image(0, 0, SPACE_FOREGROUND_TEXTURE)
        .setOrigin(0)
        .setDepth(DEPTH_FOREGROUND);
    }

    const cols = Math.ceil(image.width / tileSize);
    const rows = Math.ceil(image.height / tileSize);
    this.grid = new CollisionGrid(cols, rows, this.collisionSource);

    const spawn = this.resolveSpawn(this.spaceConfig.spawnTile);
    this.player = new Player(this, 0, 0, tileSize);
    this.player.setDepth(DEPTH_PLAYER);
    this.movement = new GridMovement(
      this,
      this.grid,
      this.player,
      tileSize,
      spawn,
      {
        onWalk: (dir) => {
          this.player.playWalk(dir);
          this.onLocalStep();
        },
        onFace: (dir) => this.player.faceIdle(dir),
        onIdle: (dir) => this.player.faceIdle(dir),
      },
    );

    this.cameraController = new CameraController(
      this,
      this.player,
      image.width,
      image.height,
      tileSize,
    );

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as SpaceScene["wasd"];

    if (import.meta.env.DEV) {
      import("../systems/CollisionEditor").then(({ CollisionEditor }) => {
        if (!this.sys.isActive()) return;
        this.editor = new CollisionEditor(
          this,
          this.grid,
          tileSize,
          this.movement,
          this.spaceConfig,
        );
      });
    }

    EventBus.on(SpaceEvent.PlayerName, this.onPlayerName, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(SpaceEvent.PlayerName, this.onPlayerName, this);
    });
    EventBus.emit(SpaceEvent.SceneReady);
  }

  update(_time: number, delta: number): void {
    this.movement.update(this.readDirection());
    this.cameraController.update(delta);
    this.editor?.update();
  }

  protected onLocalStep(): void {}

  private onPlayerName(name: string): void {
    this.player.setDisplayName(name);
  }

  private readDirection(): Direction | null {
    if (this.cursors.left.isDown || this.wasd.A.isDown) return "left";
    if (this.cursors.right.isDown || this.wasd.D.isDown) return "right";
    if (this.cursors.up.isDown || this.wasd.W.isDown) return "up";
    if (this.cursors.down.isDown || this.wasd.S.isDown) return "down";
    return null;
  }

  private resolveSpawn(preferred: TileCoord): TileCoord {
    const cx = Phaser.Math.Clamp(preferred.x, 0, this.grid.cols - 1);
    const cy = Phaser.Math.Clamp(preferred.y, 0, this.grid.rows - 1);
    if (!this.grid.isBlocked(cx, cy)) return { x: cx, y: cy };
    for (let r = 1; r < Math.max(this.grid.cols, this.grid.rows); r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!this.grid.isBlocked(cx + dx, cy + dy))
            return { x: cx + dx, y: cy + dy };
        }
      }
    }
    return { x: cx, y: cy };
  }
}
