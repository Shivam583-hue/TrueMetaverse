import Phaser from "phaser";
import type { Direction } from "../systems/GridMovement";
import type { WokaAppearance } from "../woka/wokaConfig";
import { Woka } from "./Woka";

export const CHARACTER_HEIGHT_TILES = 1.4;

const LABEL_STYLE = {
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: "10px",
  color: "#e9eaf6",
  backgroundColor: "#14162bcc",
  padding: { x: 3, y: 1 },
};

export class Player extends Phaser.GameObjects.Container {
  private woka: Woka;
  private label: Phaser.GameObjects.Text;
  private timer: Phaser.GameObjects.Text | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    tileSize: number,
    appearance?: WokaAppearance,
  ) {
    super(scene, x, y);

    this.woka = new Woka(scene, tileSize, appearance);
    this.label = scene.add
      .text(0, 0, "", LABEL_STYLE)
      .setOrigin(0.5, 1)
      .setResolution(2);
    this.add([this.woka, this.label]);

    this.faceIdle("down");
    this.layoutLabels();
    scene.add.existing(this);
  }

  setDisplayName(name: string): void {
    this.label.setText(name.trim() || "player");
    this.layoutLabels();
  }

  setTimer(text: string | null): void {
    if (text === null) {
      this.timer?.setVisible(false);
      return;
    }
    if (!this.timer) {
      this.timer = this.scene.add
        .text(0, 0, "", { ...LABEL_STYLE, color: "#ffc53d" })
        .setOrigin(0.5, 1)
        .setResolution(2);
      this.add(this.timer);
    }
    this.timer.setText(`< ${text} >`).setVisible(true);
    this.layoutLabels();
  }

  setAppearance(appearance: WokaAppearance): void {
    this.woka.setAppearance(appearance);
  }

  playWalk(dir: Direction): void {
    this.woka.playWalk(dir);
  }

  faceIdle(dir: Direction): void {
    this.woka.faceIdle(dir);
  }

  private layoutLabels(): void {
    const top = -this.woka.wokaHeight - 4;
    this.label.setY(top);
    this.timer?.setY(top - this.label.height - 1);
  }
}
