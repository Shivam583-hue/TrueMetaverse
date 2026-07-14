import { randomInt } from "crypto";
import type {
  ChatMessage,
  HideSeekParticipant,
  HideSeekPlayerStatus,
  HideSeekRole,
  HideSeekRoundState,
  HideSeekWinner,
  OutgoingMessage,
  SpaceUser,
  WhiteboardScene,
} from "@repo/types";
import type { User } from "./User";
import type { CollisionData } from "./collision";
import {
  hasLineOfSight,
  tileInConcealment,
  type HideSeekConfig,
} from "./hideSeekConfig";

type RuntimeParticipant = {
  role: HideSeekRole;
  status: HideSeekPlayerStatus;
};

type HideSeekRoom = {
  config: HideSeekConfig;
  collision: CollisionData | null;
  creatorId: string;
  hostId: string;
  roundId: number;
  phase: HideSeekRoundState["phase"];
  phaseEndsAt: number | null;
  seekerId: string | null;
  previousSeekerUserId: string | null;
  winner: HideSeekWinner;
  participants: Map<string, RuntimeParticipant>;
  visibleByViewer: Map<string, Set<string>>;
  timer: ReturnType<typeof setTimeout> | null;
};

type AddUserOptions = {
  hideSeekConfig: HideSeekConfig | null;
  collision: CollisionData | null;
  creatorId: string;
};

export class RoomManager {
  rooms: Map<string, User[]> = new Map();
  whiteboards: Map<string, WhiteboardScene> = new Map();
  private hideSeekRooms: Map<string, HideSeekRoom> = new Map();
  static instance: RoomManager;

  private constructor() {}

  static getInstance() {
    if (!this.instance) this.instance = new RoomManager();
    return this.instance;
  }

  public addUser(spaceId: string, user: User, options: AddUserOptions): void {
    const users = this.rooms.get(spaceId) ?? [];
    this.rooms.set(spaceId, [...users, user]);
    if (!options.hideSeekConfig) return;

    let game = this.hideSeekRooms.get(spaceId);
    if (!game) {
      game = {
        config: options.hideSeekConfig,
        collision: options.collision,
        creatorId: options.creatorId,
        hostId: user.id,
        roundId: 0,
        phase: "lobby",
        phaseEndsAt: null,
        seekerId: null,
        previousSeekerUserId: null,
        winner: null,
        participants: new Map(),
        visibleByViewer: new Map(),
        timer: null,
      };
      this.hideSeekRooms.set(spaceId, game);
    }
    game.participants.set(user.id, { role: "spectator", status: "waiting" });
    game.visibleByViewer.set(user.id, new Set());
    if (game.phase === "lobby") this.rebalanceLobby(spaceId, game);
    else
      game.participants.set(user.id, {
        role: "spectator",
        status: "spectator",
      });
    game.hostId = this.chooseHost(spaceId, game)?.id ?? user.id;
  }

  public announceJoined(user: User, spaceId: string): void {
    if (!user.userId) return;
    this.broadcast(
      { type: "user-joined", payload: { id: user.id, userId: user.userId } },
      user,
      spaceId,
    );
    const game = this.hideSeekRooms.get(spaceId);
    if (game) {
      this.syncVisibility(spaceId, game);
      this.broadcastRoundState(spaceId, game);
      return;
    }
    this.broadcast(
      { type: "player-appeared", payload: this.toSpaceUser(user) },
      user,
      spaceId,
    );
  }

  public removeUser(user: User, spaceId: string): void {
    const current = this.rooms.get(spaceId);
    if (!current) return;
    const game = this.hideSeekRooms.get(spaceId);
    const participant = game?.participants.get(user.id);
    const wasLiveRound = game?.phase === "hiding" || game?.phase === "seeking";
    const wasSeeker =
      participant?.role === "seeker" && participant.status === "active";
    const wasHider =
      participant?.role === "hider" && participant.status === "active";
    const users = current.filter((candidate) => candidate.id !== user.id);

    for (const remaining of users) {
      remaining.send({
        type: "user-left",
        payload: { id: user.id, userId: user.userId ?? "" },
      });
    }

    if (users.length === 0) {
      if (game?.timer) clearTimeout(game.timer);
      this.rooms.delete(spaceId);
      this.whiteboards.delete(spaceId);
      this.hideSeekRooms.delete(spaceId);
      return;
    }
    this.rooms.set(spaceId, users);
    if (!game) return;

    game.participants.delete(user.id);
    game.visibleByViewer.delete(user.id);
    for (const visible of game.visibleByViewer.values())
      visible.delete(user.id);
    game.hostId = this.chooseHost(spaceId, game)?.id ?? users[0]!.id;

    if (wasLiveRound && wasSeeker) {
      this.finishRound(spaceId, game, "hiders");
      return;
    }
    if (wasLiveRound && wasHider && this.activeHiderCount(game) === 0) {
      this.finishRound(spaceId, game, "seeker");
      return;
    }
    if (game.phase === "lobby") this.rebalanceLobby(spaceId, game);
    this.broadcastRoundState(spaceId, game);
    this.syncVisibility(spaceId, game);
  }

  public getPresence(spaceId: string, exceptId: string) {
    return (this.rooms.get(spaceId) ?? [])
      .filter((user) => user.id !== exceptId && user.userId)
      .map((user) => ({ id: user.id, userId: user.userId! }));
  }

  public getVisibleUsers(spaceId: string, viewer: User): SpaceUser[] {
    const others = (this.rooms.get(spaceId) ?? []).filter(
      (user) => user.id !== viewer.id && user.userId,
    );
    const game = this.hideSeekRooms.get(spaceId);
    if (!game) return others.map((user) => this.toSpaceUser(user));
    const visible = game.visibleByViewer.get(viewer.id) ?? new Set<string>();
    game.visibleByViewer.set(viewer.id, visible);
    const result: SpaceUser[] = [];
    for (const target of others) {
      if (!this.canSee(game, viewer, target)) continue;
      visible.add(target.id);
      result.push(this.toSpaceUser(target));
    }
    return result;
  }

  public isHideSeekRoom(spaceId: string | undefined): boolean {
    return !!spaceId && this.hideSeekRooms.has(spaceId);
  }

  public canMove(user: User, spaceId: string): boolean {
    const game = this.hideSeekRooms.get(spaceId);
    if (!game) return true;
    const participant = game.participants.get(user.id);
    if (!participant) return false;
    if (game.phase === "lobby") return participant.status === "waiting";
    if (game.phase === "hiding") {
      return participant.role === "hider" && participant.status === "active";
    }
    if (game.phase === "seeking") return participant.status === "active";
    return false;
  }

  public publishMovement(user: User, spaceId: string): void {
    const game = this.hideSeekRooms.get(spaceId);
    if (!game) {
      this.broadcast(
        { type: "movement", payload: this.toSpaceUser(user) },
        user,
        spaceId,
      );
      return;
    }
    this.syncVisibility(spaceId, game, user);
  }

  public startHideSeek(user: User, spaceId: string): void {
    const game = this.hideSeekRooms.get(spaceId);
    if (!game) return;
    if (game.hostId !== user.id) {
      this.sendError(user, "Only the host can start the round.");
      return;
    }
    if (game.phase !== "lobby" && game.phase !== "finished") {
      this.sendError(user, "A round is already running.");
      return;
    }
    const eligible = this.eligibleUsers(spaceId, game);
    if (eligible.length < game.config.settings.minPlayers) {
      this.sendError(
        user,
        `At least ${game.config.settings.minPlayers} players are required.`,
      );
      return;
    }
    if (game.timer) clearTimeout(game.timer);
    game.roundId += 1;
    game.phase = "hiding";
    game.phaseEndsAt = Date.now() + game.config.settings.hideDurationMs;
    game.winner = null;

    const seekerCandidates =
      eligible.length > 1
        ? eligible.filter(
            (candidate) => candidate.userId !== game.previousSeekerUserId,
          )
        : eligible;
    const seeker = seekerCandidates[randomInt(seekerCandidates.length)]!;
    game.seekerId = seeker.id;
    game.previousSeekerUserId = seeker.userId ?? null;

    for (const participant of game.participants.values()) {
      participant.role = "spectator";
      participant.status = "spectator";
    }
    game.participants.set(seeker.id, { role: "seeker", status: "active" });
    seeker.x = game.config.seekerSpawn.x;
    seeker.y = game.config.seekerSpawn.y;
    seeker.send({ type: "self-position", payload: game.config.seekerSpawn });

    const hiderSpawns = this.shuffle(game.config.hiderSpawns);
    let spawnIndex = 0;
    for (const participant of eligible) {
      if (participant.id === seeker.id) continue;
      game.participants.set(participant.id, {
        role: "hider",
        status: "active",
      });
      const spawn = hiderSpawns[spawnIndex % hiderSpawns.length]!;
      spawnIndex += 1;
      participant.x = spawn.x;
      participant.y = spawn.y;
      participant.send({ type: "self-position", payload: spawn });
    }
    this.broadcastRoundState(spaceId, game);
    this.syncVisibility(spaceId, game, undefined, true);
    const roundId = game.roundId;
    game.timer = setTimeout(
      () => this.beginSeeking(spaceId, roundId),
      game.config.settings.hideDurationMs,
    );
  }

  public tagHideSeek(user: User, spaceId: string, targetId: string): void {
    const game = this.hideSeekRooms.get(spaceId);
    if (!game || game.phase !== "seeking") return;
    const seeker = game.participants.get(user.id);
    const target = this.rooms
      .get(spaceId)
      ?.find((candidate) => candidate.id === targetId);
    const targetState = target ? game.participants.get(target.id) : undefined;
    if (
      seeker?.role !== "seeker" ||
      seeker.status !== "active" ||
      !target ||
      targetState?.role !== "hider" ||
      targetState.status !== "active"
    ) {
      this.sendError(user, "That player cannot be tagged.");
      return;
    }
    const distance = Math.abs(user.x - target.x) + Math.abs(user.y - target.y);
    if (
      distance > game.config.settings.tagRange ||
      !this.canSee(game, user, target)
    ) {
      this.sendError(user, "Move closer before tagging.");
      return;
    }
    targetState.status = "tagged";
    this.broadcastRoundState(spaceId, game);
    this.syncVisibility(spaceId, game);
    if (this.activeHiderCount(game) === 0) {
      this.finishRound(spaceId, game, "seeker");
    }
  }

  public broadcastChat(
    message: ChatMessage,
    sender: User,
    spaceId: string,
  ): void {
    const game = this.hideSeekRooms.get(spaceId);
    if (!game || game.phase === "lobby" || game.phase === "finished") {
      this.broadcastAll({ type: "chat", payload: message }, spaceId);
      return;
    }
    const senderState = game.participants.get(sender.id);
    if (senderState?.role !== "hider" || senderState.status !== "active")
      return;
    for (const user of this.rooms.get(spaceId) ?? []) {
      const state = game.participants.get(user.id);
      if (state?.role === "hider" && state.status === "active") {
        user.send({ type: "chat", payload: message });
      }
    }
  }

  public broadcast(message: OutgoingMessage, user: User, roomId: string) {
    this.rooms.get(roomId)?.forEach((candidate) => {
      if (candidate.id !== user.id) candidate.send(message);
    });
  }

  public broadcastAll(message: OutgoingMessage, roomId: string) {
    this.rooms.get(roomId)?.forEach((user) => user.send(message));
  }

  public getWhiteboard(roomId: string): WhiteboardScene {
    return this.whiteboards.get(roomId) ?? { elements: [], version: 0 };
  }

  public updateWhiteboard(
    roomId: string,
    elements: unknown[],
  ): WhiteboardScene {
    const scene = {
      elements,
      version: this.getWhiteboard(roomId).version + 1,
    };
    this.whiteboards.set(roomId, scene);
    return scene;
  }

  private beginSeeking(spaceId: string, roundId: number): void {
    const game = this.hideSeekRooms.get(spaceId);
    if (!game || game.roundId !== roundId || game.phase !== "hiding") return;
    game.phase = "seeking";
    game.phaseEndsAt = Date.now() + game.config.settings.seekDurationMs;
    this.broadcastRoundState(spaceId, game);
    this.syncVisibility(spaceId, game);
    game.timer = setTimeout(() => {
      const current = this.hideSeekRooms.get(spaceId);
      if (current?.roundId === roundId && current.phase === "seeking") {
        this.finishRound(spaceId, current, "hiders");
      }
    }, game.config.settings.seekDurationMs);
  }

  private finishRound(
    spaceId: string,
    game: HideSeekRoom,
    winner: Exclude<HideSeekWinner, null>,
  ): void {
    if (game.timer) clearTimeout(game.timer);
    game.phase = "finished";
    game.phaseEndsAt = Date.now() + game.config.settings.resultsDurationMs;
    game.winner = winner;
    this.broadcastRoundState(spaceId, game);
    this.syncVisibility(spaceId, game, undefined, true);
    const roundId = game.roundId;
    game.timer = setTimeout(
      () => this.returnToLobby(spaceId, roundId),
      game.config.settings.resultsDurationMs,
    );
  }

  private returnToLobby(spaceId: string, roundId: number): void {
    const game = this.hideSeekRooms.get(spaceId);
    if (!game || game.roundId !== roundId || game.phase !== "finished") return;
    game.phase = "lobby";
    game.phaseEndsAt = null;
    game.seekerId = null;
    game.winner = null;
    game.timer = null;
    this.rebalanceLobby(spaceId, game);
    game.hostId = this.chooseHost(spaceId, game)?.id ?? game.hostId;
    this.broadcastRoundState(spaceId, game);
    this.syncVisibility(spaceId, game, undefined, true);
  }

  private rebalanceLobby(spaceId: string, game: HideSeekRoom): void {
    const eligibleIds = new Set(
      this.eligibleUsers(spaceId, game).map((user) => user.id),
    );
    for (const [id, participant] of game.participants) {
      participant.role = "spectator";
      participant.status = eligibleIds.has(id) ? "waiting" : "spectator";
    }
  }

  private eligibleUsers(spaceId: string, game: HideSeekRoom): User[] {
    const seen = new Set<string>();
    const result: User[] = [];
    for (const user of this.rooms.get(spaceId) ?? []) {
      if (!user.userId || seen.has(user.userId)) continue;
      seen.add(user.userId);
      result.push(user);
      if (result.length === game.config.settings.maxPlayers) break;
    }
    return result;
  }

  private chooseHost(spaceId: string, game: HideSeekRoom): User | undefined {
    const eligible = this.eligibleUsers(spaceId, game);
    return (
      eligible.find((user) => user.userId === game.creatorId) ?? eligible[0]
    );
  }

  private canSee(game: HideSeekRoom, viewer: User, target: User): boolean {
    if (viewer.id === target.id) return false;
    if (game.phase === "lobby" || game.phase === "finished") return true;
    const viewerState = game.participants.get(viewer.id);
    const targetState = game.participants.get(target.id);
    if (viewerState?.status !== "active" || targetState?.status !== "active") {
      return false;
    }
    if (viewerState.role === "hider" && targetState.role === "hider") {
      return true;
    }
    if (game.phase === "hiding" && viewerState.role === "seeker") return false;
    const distance = Math.max(
      Math.abs(viewer.x - target.x),
      Math.abs(viewer.y - target.y),
    );
    if (distance > game.config.settings.sightRadius) return false;
    if (!hasLineOfSight(game.collision, viewer, target)) return false;
    if (
      viewerState.role === "seeker" &&
      targetState.role === "hider" &&
      tileInConcealment(game.config, target) &&
      distance > game.config.settings.concealRevealRadius
    ) {
      return false;
    }
    return true;
  }

  private syncVisibility(
    spaceId: string,
    game: HideSeekRoom,
    moved?: User,
    forceSnapshots = false,
  ): void {
    const users = this.rooms.get(spaceId) ?? [];
    for (const viewer of users) {
      const visible = game.visibleByViewer.get(viewer.id) ?? new Set<string>();
      game.visibleByViewer.set(viewer.id, visible);
      for (const target of users) {
        if (target.id === viewer.id || !target.userId) continue;
        const wasVisible = visible.has(target.id);
        const isVisible = this.canSee(game, viewer, target);
        if (isVisible && !wasVisible) {
          visible.add(target.id);
          viewer.send({
            type: "player-appeared",
            payload: this.toSpaceUser(target),
          });
        } else if (!isVisible && wasVisible) {
          visible.delete(target.id);
          viewer.send({
            type: "player-disappeared",
            payload: { id: target.id },
          });
        } else if (isVisible && (target.id === moved?.id || forceSnapshots)) {
          viewer.send({ type: "movement", payload: this.toSpaceUser(target) });
        }
      }
    }
  }

  private broadcastRoundState(spaceId: string, game: HideSeekRoom): void {
    for (const user of this.rooms.get(spaceId) ?? []) {
      user.send({
        type: "hide-seek-state",
        payload: this.roundState(game, user),
      });
    }
  }

  private roundState(game: HideSeekRoom, viewer: User): HideSeekRoundState {
    const self = game.participants.get(viewer.id) ?? {
      role: "spectator" as const,
      status: "spectator" as const,
    };
    const participants: HideSeekParticipant[] = [];
    for (const user of this.rooms.get(viewer.joinedSpaceId ?? "") ?? []) {
      if (!user.userId) continue;
      const state = game.participants.get(user.id) ?? {
        role: "spectator" as const,
        status: "spectator" as const,
      };
      participants.push({ id: user.id, userId: user.userId, ...state });
    }
    return {
      roundId: game.roundId,
      phase: game.phase,
      phaseEndsAt: game.phaseEndsAt,
      hostId: game.hostId,
      seekerId: game.seekerId,
      selfId: viewer.id,
      selfRole: self.role,
      selfStatus: self.status,
      hidersRemaining: this.activeHiderCount(game),
      minPlayers: game.config.settings.minPlayers,
      maxPlayers: game.config.settings.maxPlayers,
      winner: game.winner,
      participants,
    };
  }

  private activeHiderCount(game: HideSeekRoom): number {
    let count = 0;
    for (const participant of game.participants.values()) {
      if (participant.role === "hider" && participant.status === "active") {
        count += 1;
      }
    }
    return count;
  }

  private toSpaceUser(user: User): SpaceUser {
    return { id: user.id, userId: user.userId!, x: user.x, y: user.y };
  }

  private sendError(user: User, message: string): void {
    user.send({ type: "hide-seek-error", payload: { message } });
  }

  private shuffle<T>(source: readonly T[]): T[] {
    const result = [...source];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = randomInt(index + 1);
      [result[index], result[target]] = [result[target]!, result[index]!];
    }
    return result;
  }
}
