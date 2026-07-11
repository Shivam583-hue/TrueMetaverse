import Phaser from "phaser";
import type { SpaceDetail } from "../lib/api";

export const TILE = 32;

export type ArenaCallbacks = {
  onSceneReady: () => void;
  onMoveAttempt: (x: number, y: number) => void;
};

type Person = {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  userId: string;
  x: number;
  y: number;
};

// portrait character sprites, displayed a bit taller than a tile
const AVATAR_H = 44;

export class ArenaScene extends Phaser.Scene {
  private widthTiles: number;
  private heightTiles: number;
  private mapImage: string | null;
  private spaceElements: SpaceDetail["elements"];

  private blocked = new Set<string>();

  private local: Person | null = null;
  private localTimer: Phaser.GameObjects.Text | null = null;
  private localMoving = false;
  private remotes = new Map<string, Person>();

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;

  constructor(
    detail: SpaceDetail,
    private callbacks: ArenaCallbacks,
  ) {
    super("arena");
    const [w, h] = detail.dimensions.split("x").map(Number);
    this.widthTiles = w!;
    this.heightTiles = h!;
    this.mapImage = detail.mapImage;
    this.spaceElements = detail.elements;
  }

  preload() {
    this.load.setCORS("anonymous");
    if (this.mapImage) {
      this.load.image("map-bg", this.mapImage);
    }
    for (const se of this.spaceElements) {
      this.load.image(`el-${se.element.id}`, se.element.imageUrl);
    }
  }

  create() {
    const worldW = this.widthTiles * TILE;
    const worldH = this.heightTiles * TILE;

    // everything beyond the room is void
    this.cameras.main.setBackgroundColor("#07080f");
    // centerOn: keep a room smaller than the window centered in it
    this.cameras.main.setBounds(0, 0, worldW, worldH, true);

    if (this.textures.exists("map-bg")) {
      this.add.image(0, 0, "map-bg").setOrigin(0).setDisplaySize(worldW, worldH).setDepth(0);
    } else {
      const grid = this.add.graphics();
      grid.fillStyle(0x1a1d38, 1);
      grid.fillRect(0, 0, worldW, worldH);
      grid.lineStyle(1, 0x272b52, 1);
      for (let x = 0; x <= this.widthTiles; x++) {
        grid.lineBetween(x * TILE, 0, x * TILE, worldH);
      }
      for (let y = 0; y <= this.heightTiles; y++) {
        grid.lineBetween(0, y * TILE, worldW, y * TILE);
      }
    }

    // fallback avatar: a coin-colored rounded card until the real look loads
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffc53d, 1);
    g.fillRoundedRect(0, 0, 30, AVATAR_H, 6);
    g.generateTexture("av-fallback", 30, AVATAR_H);
    g.destroy();

    this.drawElements();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as ArenaScene["wasd"];

    this.callbacks.onSceneReady();
  }

  update() {
    if (!this.local || this.localMoving) return;

    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -1;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) dx = 1;
    else if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -1;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) dy = 1;
    if (dx === 0 && dy === 0) return;

    const nx = this.local.x + dx;
    const ny = this.local.y + dy;
    if (!this.inBounds(nx, ny) || this.blocked.has(`${nx},${ny}`)) return;

    // optimistic step; the server broadcasts to others and only replies
    // to us with movement-rejected if it disagrees
    this.local.x = nx;
    this.local.y = ny;
    this.localMoving = true;
    this.callbacks.onMoveAttempt(nx, ny);
    this.tweenTo(this.local, nx, ny, () => {
      this.localMoving = false;
    });
  }

  // ---------- called from React ----------

  spawnLocal(x: number, y: number, userId: string) {
    this.local = this.makePerson(x, y, userId, "you");
    this.localTimer = this.add
      .text(0, -44, "", {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: "11px",
        color: "#ffc53d",
        backgroundColor: "#14162bcc",
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2)
      .setVisible(false);
    this.local.container.add(this.localTimer);
    this.cameras.main.startFollow(this.local.container, true, 0.15, 0.15);
  }

  setLocalTimer(text: string | null) {
    if (!this.localTimer) return;
    if (text === null) {
      this.localTimer.setVisible(false);
    } else {
      this.localTimer.setText(`< ${text} >`).setVisible(true);
    }
  }

  addRemote(id: string, userId: string, x: number, y: number) {
    if (this.remotes.has(id)) this.removeRemote(id);
    this.remotes.set(id, this.makePerson(x, y, userId, ""));
  }

  moveRemote(id: string, x: number, y: number) {
    const person = this.remotes.get(id);
    if (!person) return;
    person.x = x;
    person.y = y;
    this.tweenTo(person, x, y);
  }

  removeRemote(id: string) {
    const person = this.remotes.get(id);
    if (!person) return;
    person.container.destroy();
    this.remotes.delete(id);
  }

  rollbackLocal(x: number, y: number) {
    if (!this.local) return;
    this.tweens.killTweensOf(this.local.container);
    this.local.x = x;
    this.local.y = y;
    this.local.container.setPosition((x + 0.5) * TILE, (y + 0.5) * TILE);
    this.localMoving = false;
  }

  setUserMeta(userId: string, username: string | null, avatarUrl: string | null) {
    const people = [...this.remotes.values()].filter((p) => p.userId === userId);
    const isLocal = this.local?.userId === userId;
    if (isLocal) people.push(this.local!);

    for (const person of people) {
      if (username) {
        person.label.setText(person === this.local ? `${username} (you)` : username);
      }
      if (avatarUrl) this.applyAvatar(person, avatarUrl);
    }
  }

  // ---------- internals ----------

  private inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.widthTiles && y < this.heightTiles;
  }

  private drawElements() {
    this.blocked.clear();
    for (const se of this.spaceElements) {
      const key = `el-${se.element.id}`;
      if (this.textures.exists(key)) {
        this.add
          .image(se.x * TILE, se.y * TILE, key)
          .setOrigin(0)
          .setDisplaySize(se.element.width * TILE, se.element.height * TILE)
          .setDepth(1);
      }
      if (se.element.static) {
        for (let dx = 0; dx < se.element.width; dx++) {
          for (let dy = 0; dy < se.element.height; dy++) {
            this.blocked.add(`${se.x + dx},${se.y + dy}`);
          }
        }
      }
    }
  }

  private makePerson(x: number, y: number, userId: string, labelText: string): Person {
    const sprite = this.add.image(0, -10, "av-fallback");
    sprite.setDisplaySize(30, AVATAR_H);
    const label = this.add
      .text(0, 18, labelText, {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: "10px",
        color: "#e9eaf6",
        backgroundColor: "#14162bcc",
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2);
    const container = this.add
      .container((x + 0.5) * TILE, (y + 0.5) * TILE, [sprite, label])
      .setDepth(10);
    return { container, sprite, label, userId, x, y };
  }

  private applyAvatar(person: Person, url: string) {
    const key = `av-${person.userId}`;
    const swap = () => {
      if (!person.sprite.active || !this.textures.exists(key)) return;
      person.sprite.setTexture(key);
      // scale to a fixed height, keep the sprite's own aspect ratio
      const src = this.textures.get(key).getSourceImage() as { width: number; height: number };
      person.sprite.setDisplaySize(AVATAR_H * (src.width / src.height), AVATAR_H);
    };
    if (this.textures.exists(key)) {
      swap();
      return;
    }
    this.load.image(key, url);
    this.load.once(`${Phaser.Loader.Events.FILE_KEY_COMPLETE}image-${key}`, swap);
    this.load.start();
  }

  private tweenTo(person: Person, x: number, y: number, onComplete?: () => void) {
    this.tweens.add({
      targets: person.container,
      x: (x + 0.5) * TILE,
      y: (y + 0.5) * TILE,
      duration: 130,
      ease: "Linear",
      onComplete,
    });
  }
}
