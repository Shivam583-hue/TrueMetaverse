import Phaser from "phaser";
import type { SpaceConfig } from "../config/spaces";
import { SPACE_TEXTURE } from "../scenes/BootScene";
import type { CollisionGrid } from "./CollisionGrid";
import type { GridMovement } from "./GridMovement";

const DEPTH_OVERLAY = 30;
const DEPTH_UI = 40;

const VOID_COVERAGE = 0.85;
const VOID_RGB_MAX = 30;

export class CollisionEditor {
  private debugOn = false;
  private editOn = false;
  private fillDirty = true;

  private gridLines: Phaser.GameObjects.Graphics;
  private blockedFill: Phaser.GameObjects.Graphics;
  private rectPreview: Phaser.GameObjects.Graphics;
  private status: Phaser.GameObjects.Text;
  private downloadButton: Phaser.GameObjects.Text;
  private shiftKey: Phaser.Input.Keyboard.Key;
  private altKey: Phaser.Input.Keyboard.Key;

  private rectAnchor: { x: number; y: number } | null = null;
  private rectErase = false;
  private pointerWasDown = false;

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saveState = "";

  constructor(
    private scene: Phaser.Scene,
    private grid: CollisionGrid,
    private tileSize: number,
    private movement: GridMovement,
    private config: SpaceConfig,
  ) {
    this.gridLines = scene.add
      .graphics()
      .setDepth(DEPTH_OVERLAY)
      .setVisible(false);
    this.blockedFill = scene.add
      .graphics()
      .setDepth(DEPTH_OVERLAY)
      .setVisible(false);
    this.rectPreview = scene.add.graphics().setDepth(DEPTH_OVERLAY);
    this.drawGridLines();

    const textStyle = {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: "11px",
      backgroundColor: "#14162bcc",
      padding: { x: 6, y: 3 },
    };
    this.status = scene.add
      .text(0, 0, "", { ...textStyle, color: "#3ee6c1" })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI)
      .setResolution(2)
      .setVisible(false);
    this.downloadButton = scene.add
      .text(0, 0, "⤓ collision.json", { ...textStyle, color: "#ffc53d" })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(DEPTH_UI)
      .setResolution(2)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.download());

    const keyboard = scene.input.keyboard!;
    this.shiftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.altKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ALT);
    keyboard.on("keydown-BACKTICK", this.toggleDebug, this);
    keyboard.on(
      "keydown-E",
      () => {
        if (this.debugOn) this.editOn = !this.editOn;
      },
      this,
    );
    keyboard.on(
      "keydown-X",
      () => {
        if (this.debugOn) this.download();
      },
      this,
    );
    keyboard.on(
      "keydown-I",
      () => {
        if (!this.debugOn || !this.editOn) return;
        this.grid.invertAll();
        this.markChanged();
      },
      this,
    );
    keyboard.on(
      "keydown-V",
      () => {
        if (!this.debugOn || !this.editOn) return;
        const blocked = autoBlockVoid(this.scene, this.grid, this.tileSize);
        console.log(`auto-void: blocked ${blocked} tile(s)`);
        this.markChanged();
      },
      this,
    );
    scene.input.mouse?.disableContextMenu();
  }

  update(): void {
    if (!this.debugOn) return;
    if (this.editOn) this.handlePainting();
    if (this.fillDirty) {
      this.drawBlockedFill();
      this.fillDirty = false;
    }

    const tile = this.movement.tile;
    const fps = Math.round(this.scene.game.loop.actualFps);
    this.status.setText(
      `tile ${tile.x},${tile.y}   fps ${fps}   ` +
      (this.editOn
        ? "EDIT: drag paints, right/shift erases, alt-drag rect, I invert, V void, X export"
        : "E: edit collision") +
      (this.saveState ? `   ${this.saveState}` : ""),
    );
    const h = this.scene.scale.height;
    this.status.setPosition(10, h - 10);
    this.downloadButton.setPosition(10, h - 38);
  }

  private toggleDebug(): void {
    this.debugOn = !this.debugOn;
    if (!this.debugOn) {
      this.editOn = false;
      this.cancelRect();
    }
    this.fillDirty = true;
    this.gridLines.setVisible(this.debugOn);
    this.blockedFill.setVisible(this.debugOn);
    this.status.setVisible(this.debugOn);
    this.downloadButton.setVisible(this.debugOn);
  }

  private handlePainting(): void {
    const pointer = this.scene.input.activePointer;
    const overButton = this.downloadButton
      .getBounds()
      .contains(pointer.x, pointer.y);

    if (pointer.isDown && !this.pointerWasDown && !overButton) {
      if (this.altKey.isDown) {
        this.rectAnchor = this.pointerTile(pointer);
        this.rectErase = pointer.rightButtonDown() || this.shiftKey.isDown;
      }
    }
    if (!pointer.isDown && this.pointerWasDown && this.rectAnchor) {
      this.commitRect(this.pointerTile(pointer));
    }
    this.pointerWasDown = pointer.isDown;

    if (!pointer.isDown) return;
    if (this.rectAnchor) {
      this.drawRectPreview(this.pointerTile(pointer));
      return;
    }
    if (overButton) return;

    const t = this.pointerTile(pointer);
    if (t.x < 0 || t.y < 0 || t.x >= this.grid.cols || t.y >= this.grid.rows)
      return;
    const erase = pointer.rightButtonDown() || this.shiftKey.isDown;
    const value = !erase;
    if (this.grid.isBlocked(t.x, t.y) !== value) {
      this.grid.setBlocked(t.x, t.y, value);
      this.markChanged();
    }
  }

  private markChanged(): void {
    this.fillDirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.save(), 600);
  }

  private async save(): Promise<void> {
    this.saveState = "saving...";
    try {
      const res = await fetch(`/__space-tools/collision/${this.config.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.grid.toRows()),
      });
      this.saveState = res.ok ? "saved ✓" : "SAVE FAILED";
    } catch {
      this.saveState = "SAVE FAILED";
    }
  }

  private pointerTile(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    const point = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return {
      x: Math.floor(point.x / this.tileSize),
      y: Math.floor(point.y / this.tileSize),
    };
  }

  private drawRectPreview(to: { x: number; y: number }): void {
    if (!this.rectAnchor) return;
    const x0 = Math.min(this.rectAnchor.x, to.x) * this.tileSize;
    const y0 = Math.min(this.rectAnchor.y, to.y) * this.tileSize;
    const w = (Math.abs(this.rectAnchor.x - to.x) + 1) * this.tileSize;
    const h = (Math.abs(this.rectAnchor.y - to.y) + 1) * this.tileSize;
    this.rectPreview.clear();
    this.rectPreview.lineStyle(2, this.rectErase ? 0x3ee6c1 : 0xffc53d, 1);
    this.rectPreview.strokeRect(x0, y0, w, h);
  }

  private commitRect(to: { x: number; y: number }): void {
    if (!this.rectAnchor) return;
    const x0 = Math.max(0, Math.min(this.rectAnchor.x, to.x));
    const x1 = Math.min(this.grid.cols - 1, Math.max(this.rectAnchor.x, to.x));
    const y0 = Math.max(0, Math.min(this.rectAnchor.y, to.y));
    const y1 = Math.min(this.grid.rows - 1, Math.max(this.rectAnchor.y, to.y));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        this.grid.setBlocked(x, y, !this.rectErase);
      }
    }
    this.cancelRect();
    this.markChanged();
  }

  private cancelRect(): void {
    this.rectAnchor = null;
    this.rectPreview.clear();
  }

  private drawGridLines(): void {
    const w = this.grid.cols * this.tileSize;
    const h = this.grid.rows * this.tileSize;
    this.gridLines.lineStyle(1, 0xffffff, 0.15);
    for (let x = 0; x <= this.grid.cols; x++) {
      this.gridLines.lineBetween(x * this.tileSize, 0, x * this.tileSize, h);
    }
    for (let y = 0; y <= this.grid.rows; y++) {
      this.gridLines.lineBetween(0, y * this.tileSize, w, y * this.tileSize);
    }
  }

  private drawBlockedFill(): void {
    this.blockedFill.clear();
    this.blockedFill.fillStyle(0xff6b81, 0.35);
    for (let y = 0; y < this.grid.rows; y++) {
      for (let x = 0; x < this.grid.cols; x++) {
        if (this.grid.isBlocked(x, y)) {
          this.blockedFill.fillRect(
            x * this.tileSize,
            y * this.tileSize,
            this.tileSize,
            this.tileSize,
          );
        }
      }
    }
  }

  private download(): void {
    const json = JSON.stringify(this.grid.toRows());
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "collision.json";
    anchor.click();
    URL.revokeObjectURL(url);
    console.log(
      `collision.json: ${this.grid.changedSinceLoad()} tile(s) changed since load - ` +
      `commit it as public/assets/spaces/${this.config.id}/collision.json`,
    );
  }
}

function autoBlockVoid(
  scene: Phaser.Scene,
  grid: CollisionGrid,
  tileSize: number,
): number {
  const source = scene.textures.get(SPACE_TEXTURE).getSourceImage() as
    HTMLImageElement | HTMLCanvasElement;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0);

  let blockedCount = 0;
  for (let ty = 0; ty < grid.rows; ty++) {
    for (let tx = 0; tx < grid.cols; tx++) {
      if (grid.isBlocked(tx, ty)) continue;
      const w = Math.min(tileSize, source.width - tx * tileSize);
      const h = Math.min(tileSize, source.height - ty * tileSize);
      if (w <= 0 || h <= 0) {
        grid.setBlocked(tx, ty, true);
        blockedCount++;
        continue;
      }
      const data = ctx.getImageData(tx * tileSize, ty * tileSize, w, h).data;
      let voidPixels = 0;
      const total = w * h;
      for (let i = 0; i < data.length; i += 4) {
        const dark =
          data[i]! < VOID_RGB_MAX &&
          data[i + 1]! < VOID_RGB_MAX &&
          data[i + 2]! < VOID_RGB_MAX;
        if (dark || data[i + 3]! < 40) voidPixels++;
      }
      const coverage =
        (voidPixels + (tileSize * tileSize - total)) / (tileSize * tileSize);
      if (coverage >= VOID_COVERAGE) {
        grid.setBlocked(tx, ty, true);
        blockedCount++;
      }
    }
  }
  return blockedCount;
}
