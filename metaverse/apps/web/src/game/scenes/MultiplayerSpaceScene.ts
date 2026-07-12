import { SpaceScene } from "./SpaceScene";
import { RemotePlayer } from "../entities/RemotePlayer";
import type { WokaAppearance } from "../woka/wokaConfig";

export type ArenaCallbacks = {
  onSceneReady: () => void;
  onMoveAttempt: (x: number, y: number) => void;
};

const DEPTH_REMOTE = 9;

export class MultiplayerSpaceScene extends SpaceScene {
  private remotes = new Map<string, RemotePlayer>();
  private localUserId: string | null = null;
  private knownAppearances = new Map<string, WokaAppearance>();

  constructor(private callbacks: ArenaCallbacks) {
    super();
  }

  override create(): void {
    super.create();
    this.player.setDisplayName("you");
    this.callbacks.onSceneReady();
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    for (const remote of this.remotes.values()) remote.update();
  }

  protected override onLocalStep(): void {
    const tile = this.movement.tile;
    this.callbacks.onMoveAttempt(tile.x, tile.y);
  }

  spawnLocal(x: number, y: number, userId: string): void {
    this.localUserId = userId;
    this.movement.forceSetTile({ x, y });
    this.cameras.main.centerOn(this.player.x, this.player.y);
  }

  addRemote(id: string, userId: string, x: number, y: number): void {
    if (this.remotes.has(id)) this.removeRemote(id);
    this.remotes.set(
      id,
      new RemotePlayer(
        this,
        this.grid,
        this.spaceConfig.tileSize,
        userId,
        { x, y },
        DEPTH_REMOTE,
      ),
    );
    const known = this.knownAppearances.get(userId);
    if (known) this.remotes.get(id)!.player.setAppearance(known);
  }

  moveRemote(id: string, x: number, y: number): void {
    this.remotes.get(id)?.applyPosition({ x, y });
  }

  removeRemote(id: string): void {
    this.remotes.get(id)?.destroy();
    this.remotes.delete(id);
  }

  rollbackLocal(x: number, y: number): void {
    this.movement.forceSetTile({ x, y });
  }

  setLocalTimer(text: string | null): void {
    this.player.setTimer(text);
  }

  setUserMeta(
    userId: string,
    username: string | null,
    appearance: WokaAppearance | null,
  ): void {
    if (appearance) this.knownAppearances.set(userId, appearance);
    if (userId === this.localUserId) {
      if (username) this.player.setDisplayName(`${username} (you)`);
      if (appearance) this.player.setAppearance(appearance);
    }
    for (const remote of this.remotes.values()) {
      if (remote.userId !== userId) continue;
      if (username) remote.player.setDisplayName(username);
      if (appearance) remote.player.setAppearance(appearance);
    }
  }
}
