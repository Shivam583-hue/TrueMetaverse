import Phaser from "phaser";
import type { SpaceDetail } from "../lib/api";

export const TILE = 32;

export type EditMode = "off" | "place" | "erase";

export type ArenaCallbacks = {
  onSceneReady: () => void;
  onMoveAttempt: (x: number, y: number) => void;
  onTileClick: (x: number, y: number) => void;
};

type Person = {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  userId: string;
  x: number;
  y: number;
};

const AVATAR_SIZE = 26;

export class ArenaScene extends Phaser.Scene {
  private widthTiles: number;
  private heightTiles: number;
  private spaceElements: SpaceDetail["elements"];

  private blocked = new Set<string>();
  private elementImages: Phaser.GameObjects.Image[] = [];

  private local: Person | null = null;
  private localMoving = false;
  private remotes = new Map<string, Person>();

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;

  private editMode: EditMode = "off";
  private editCursor: Phaser.GameObjects.Rectangle | null = null;

  constructor(
    detail: SpaceDetail,
    private callbacks: ArenaCallbacks,
  ) {
    super("arena");
    const [w, h] = detail.dimensions.split("x").map(Number);
    this.widthTiles = w!;
    this.heightTiles = h!;
    this.spaceElements = detail.elements;
  }

  preload() {
    this.load.setCORS("anonymous");
    for (const se of this.spaceElements) {
      this.load.image(`el-${se.element.id}`, se.element.imageUrl);
    }
  }

  create() {
    const worldW = this.widthTiles * TILE;
    const worldH = this.heightTiles * TILE;

    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBackgroundColor("#14162b");

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

    // fallback avatar texture: a coin-colored rounded square
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffc53d, 1);
    g.fillRoundedRect(0, 0, AVATAR_SIZE, AVATAR_SIZE, 6);
    g.generateTexture("av-fallback", AVATAR_SIZE, AVATAR_SIZE);
    g.destroy();

    this.drawElements();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as ArenaScene["wasd"];

    this.editCursor = this.add
      .rectangle(0, 0, TILE, TILE, 0xffc53d, 0.25)
      .setStrokeStyle(1, 0xffc53d)
      .setOrigin(0)
      .setVisible(false)
      .setDepth(50);

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.editMode === "off" || !this.editCursor) return;
      const world = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const tx = Math.floor(world.x / TILE);
      const ty = Math.floor(world.y / TILE);
      this.editCursor.setPosition(tx * TILE, ty * TILE);
      this.editCursor.setVisible(this.inBounds(tx, ty));
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.editMode === "off") return;
      const world = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const tx = Math.floor(world.x / TILE);
      const ty = Math.floor(world.y / TILE);
      if (this.inBounds(tx, ty)) this.callbacks.onTileClick(tx, ty);
    });

    this.callbacks.onSceneReady();
  }

  update() {
    if (!this.local || this.localMoving || this.editMode !== "off") return;

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
    this.cameras.main.startFollow(this.local.container, true, 0.15, 0.15);
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

  setElements(elements: SpaceDetail["elements"]) {
    this.spaceElements = elements;
    const missing = elements.filter((se) => !this.textures.exists(`el-${se.element.id}`));
    if (missing.length > 0) {
      for (const se of missing) this.load.image(`el-${se.element.id}`, se.element.imageUrl);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => this.drawElements());
      this.load.start();
    } else {
      this.drawElements();
    }
  }

  setEditMode(mode: EditMode) {
    this.editMode = mode;
    if (mode === "off" && this.editCursor) this.editCursor.setVisible(false);
  }

  elementAt(x: number, y: number): string | null {
    for (const se of this.spaceElements) {
      if (
        x >= se.x &&
        x < se.x + se.element.width &&
        y >= se.y &&
        y < se.y + se.element.height
      ) {
        return se.id;
      }
    }
    return null;
  }

  // ---------- internals ----------

  private inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.widthTiles && y < this.heightTiles;
  }

  private drawElements() {
    for (const img of this.elementImages) img.destroy();
    this.elementImages = [];
    this.blocked.clear();

    for (const se of this.spaceElements) {
      const key = `el-${se.element.id}`;
      if (this.textures.exists(key)) {
        const img = this.add
          .image(se.x * TILE, se.y * TILE, key)
          .setOrigin(0)
          .setDisplaySize(se.element.width * TILE, se.element.height * TILE)
          .setDepth(1);
        this.elementImages.push(img);
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
    const sprite = this.add
      .image(0, -6, "av-fallback")
      .setDisplaySize(AVATAR_SIZE, AVATAR_SIZE);
    const label = this.add
      .text(0, 14, labelText, {
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
      if (person.sprite.active) {
        person.sprite.setTexture(key).setDisplaySize(AVATAR_SIZE, AVATAR_SIZE);
      }
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
