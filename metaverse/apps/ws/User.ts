import { WebSocket } from "ws";
import { RoomManager } from "./RoomManager";
import {
  isHideAndSeekEnabled,
  isWhiteboardEnabled,
  WS_CLOSE_SESSION_REPLACED,
  WS_CLOSE_UNAUTHORIZED,
  type IncomingMessage,
  type OutgoingMessage,
} from "@repo/types";
import client from "@repo/db/client";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { JWT_ALGORITHM, JWT_PASSWORD } from "./config";
import {
  centerSpawn,
  isBlocked,
  loadCollision,
  type CollisionData,
} from "./collision";
import { loadHideSeekConfig } from "./hideSeekConfig";
import { logger } from "./logger";
import type { Logger } from "@repo/logger";
import z from "zod";

const JOIN_TIMEOUT_MS = 10_000;
const JoinPayloadSchema = z.object({
  spaceId: z.string().min(1).max(64),
  token: z.string().min(1).max(4096),
});

const MAX_CHAT_LENGTH = 500;
const CHAT_WINDOW_MS = 10_000;
const CHAT_MAX_IN_WINDOW = 10;
const MAX_WHITEBOARD_ELEMENTS = 5_000;
const MAX_WHITEBOARD_BYTES = 1_500_000;

type Payload<T extends IncomingMessage["type"]> = Extract<
  IncomingMessage,
  { type: T }
>["payload"];

function getRandomString(length: number) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export class User {
  public id: string;
  public userId?: string;
  private spaceId?: string;
  private spaceWidth = 0;
  private spaceHeight = 0;
  private collision: CollisionData | null = null;
  private whiteboardEnabled = false;
  private canEditWhiteboard = false;
  public x: number;
  public y: number;
  private ws: WebSocket;
  private chatTimestamps: number[] = [];
  private joinTimeout: ReturnType<typeof setTimeout> | undefined;
  private joining = false;
  private closed = false;
  private log: Logger;

  public get joinedSpaceId(): string | undefined {
    return this.spaceId;
  }

  public get isClosed(): boolean {
    return this.closed;
  }

  constructor(ws: WebSocket) {
    this.id = getRandomString(10);
    this.x = 0;
    this.y = 0;
    this.ws = ws;
    this.log = logger.child({ connectionId: this.id });
    this.joinTimeout = setTimeout(() => {
      if (this.spaceId) return;
      this.log.debug("closing socket that never sent a join");
      this.ws.close(WS_CLOSE_UNAUTHORIZED, "join timeout");
    }, JOIN_TIMEOUT_MS);
    this.initHandlers();
  }

  private clearJoinTimeout() {
    if (this.joinTimeout === undefined) return;
    clearTimeout(this.joinTimeout);
    this.joinTimeout = undefined;
  }

  initHandlers() {
    this.ws.on("message", async (data: any) => {
      let parsedData: IncomingMessage;
      try {
        parsedData = JSON.parse(data.toString()) as IncomingMessage;
      } catch {
        this.log.debug("discarded unparseable frame");
        return;
      }

      try {
        switch (parsedData.type) {
          case "join":
            await this.handleJoin(parsedData.payload);
            break;
          case "move":
            this.handleMove(parsedData.payload);
            break;
          case "chat":
            this.handleChat(parsedData.payload);
            break;
          case "whiteboard-update":
            this.handleWhiteboardUpdate(parsedData.payload);
            break;
          case "hide-seek-start":
            this.handleHideSeekStart();
            break;
          case "hide-seek-tag":
            this.handleHideSeekTag(parsedData.payload);
            break;
        }
      } catch (err) {
        this.log.error(
          { err, messageType: parsedData.type },
          "failed to handle ws message",
        );
      }
    });
  }

  private async handleJoin(payload: Payload<"join">): Promise<void> {
    if (this.spaceId || this.joining || this.closed) return;
    this.joining = true;
    try {
      await this.join(payload);
    } finally {
      this.joining = false;
    }
  }

  private async join(payload: Payload<"join">): Promise<void> {
    const parsed = JoinPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.log.debug("rejected join with a malformed payload");
      this.ws.close(WS_CLOSE_UNAUTHORIZED, "unauthorized");
      return;
    }
    const { spaceId, token } = parsed.data;

    let userId: string | undefined;
    try {
      const claims = jwt.verify(token, JWT_PASSWORD, {
        algorithms: [JWT_ALGORITHM],
      }) as JwtPayload;
      if (typeof claims.userId === "string") userId = claims.userId;
    } catch {
      userId = undefined;
    }
    if (!userId) {
      this.log.warn({ spaceId }, "rejected join with an unusable token");
      this.ws.close(WS_CLOSE_UNAUTHORIZED, "unauthorized");
      return;
    }
    this.userId = userId;

    const space = await client.space.findFirst({ where: { id: spaceId } });
    if (this.closed) return;
    if (!space) {
      this.log.debug({ spaceId }, "rejected join for an unknown space");
      this.ws.close();
      return;
    }
    this.clearJoinTimeout();
    this.spaceId = spaceId;
    this.log = this.log.child({ userId, spaceId });
    this.spaceWidth = space.width;
    this.spaceHeight = space.height;
    this.collision = loadCollision(space.mapImage);
    this.whiteboardEnabled = isWhiteboardEnabled(space.mapImage);
    this.canEditWhiteboard =
      this.whiteboardEnabled && space.creatorId === this.userId;

    const spawn = centerSpawn(this.collision, space.width, space.height);
    this.x = spawn.x;
    this.y = spawn.y;
    const hideSeekEnabled = isHideAndSeekEnabled(space.mapImage);
    const hideSeekConfig = hideSeekEnabled
      ? loadHideSeekConfig(space.mapImage)
      : null;
    if (
      hideSeekEnabled &&
      (!hideSeekConfig ||
        !this.collision ||
        hideSeekConfig.grid.cols !== space.width ||
        hideSeekConfig.grid.rows !== space.height ||
        this.collision.cols !== space.width ||
        this.collision.rows !== space.height)
    ) {
      this.log.error(
        { spaceId },
        "invalid hide-and-seek assets, refusing to admit player",
      );
      this.spaceId = undefined;
      this.ws.close();
      return;
    }
    RoomManager.getInstance().evictPreviousSessions(spaceId, this);
    RoomManager.getInstance().addUser(spaceId, this, {
      hideSeekConfig,
      collision: this.collision,
      creatorId: space.creatorId,
    });

    this.send({
      type: "space-joined",
      payload: {
        spawn: { x: this.x, y: this.y },
        users: RoomManager.getInstance().getPresence(spaceId, this.id),
        visibleUsers: RoomManager.getInstance().getVisibleUsers(spaceId, this),
        whiteboard: this.whiteboardEnabled
          ? RoomManager.getInstance().getWhiteboard(spaceId)
          : null,
      },
    });
    RoomManager.getInstance().announceJoined(this, spaceId);
    this.log.debug({ hideSeekEnabled }, "player joined space");
  }

  private handleMove(payload: Payload<"move">): void {
    if (!this.spaceId) return;
    const { x: moveX, y: moveY } = payload;
    if (!Number.isInteger(moveX) || !Number.isInteger(moveY)) return;
    const xDisplacement = Math.abs(this.x - moveX);
    const yDisplacement = Math.abs(this.y - moveY);
    const insideBounds =
      moveX >= 0 &&
      moveX < this.spaceWidth &&
      moveY >= 0 &&
      moveY < this.spaceHeight;

    const isSingleStep =
      (xDisplacement === 1 && yDisplacement === 0) ||
      (xDisplacement === 0 && yDisplacement === 1);

    if (
      insideBounds &&
      isSingleStep &&
      RoomManager.getInstance().canMove(this, this.spaceId) &&
      !isBlocked(this.collision, moveX, moveY)
    ) {
      this.x = moveX;
      this.y = moveY;
      RoomManager.getInstance().publishMovement(this, this.spaceId);
      return;
    }

    this.send({
      type: "movement-rejected",
      payload: { x: this.x, y: this.y },
    });
  }

  private handleChat(payload: Payload<"chat">): void {
    if (!this.userId || !this.spaceId) return;
    if (typeof payload.text !== "string") return;
    const text = payload.text.trim().slice(0, MAX_CHAT_LENGTH);
    if (!text) return;

    const now = Date.now();
    this.chatTimestamps = this.chatTimestamps.filter(
      (t) => now - t < CHAT_WINDOW_MS,
    );
    if (this.chatTimestamps.length >= CHAT_MAX_IN_WINDOW) return;
    this.chatTimestamps.push(now);

    RoomManager.getInstance().broadcastChat(
      { id: this.id, userId: this.userId, text, at: now },
      this,
      this.spaceId,
    );
  }

  private handleHideSeekStart(): void {
    if (!this.spaceId) return;
    RoomManager.getInstance().startHideSeek(this, this.spaceId);
  }

  private handleHideSeekTag(payload: Payload<"hide-seek-tag">): void {
    if (!this.spaceId || typeof payload.targetId !== "string") return;
    RoomManager.getInstance().tagHideSeek(this, this.spaceId, payload.targetId);
  }

  private handleWhiteboardUpdate(payload: Payload<"whiteboard-update">): void {
    if (!this.spaceId || !this.canEditWhiteboard) return;
    if (
      !Array.isArray(payload.elements) ||
      payload.elements.length > MAX_WHITEBOARD_ELEMENTS ||
      payload.elements.some(
        (element) =>
          element === null ||
          typeof element !== "object" ||
          Array.isArray(element),
      )
    ) {
      return;
    }

    const serialized = JSON.stringify(payload.elements);
    if (serialized.length > MAX_WHITEBOARD_BYTES) return;

    const scene = RoomManager.getInstance().updateWhiteboard(
      this.spaceId,
      payload.elements,
    );
    RoomManager.getInstance().broadcast(
      { type: "whiteboard-update", payload: scene },
      this,
      this.spaceId,
    );
  }

  public evict(code: number, reason: string): void {
    this.destroy();
    this.ws.close(code, reason);
  }

  destroy() {
    if (this.closed) return;
    this.closed = true;
    this.clearJoinTimeout();
    if (!this.spaceId || !this.userId) return;
    RoomManager.getInstance().removeUser(this, this.spaceId);
    this.spaceId = undefined;
  }

  send(payload: OutgoingMessage) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}
