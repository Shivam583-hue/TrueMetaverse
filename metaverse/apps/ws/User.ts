import { WebSocket } from "ws";
import { RoomManager } from "./RoomManager";
import {
  isHideAndSeekEnabled,
  isWhiteboardEnabled,
  type IncomingMessage,
  type OutgoingMessage,
} from "@repo/types";
import client from "@repo/db/client";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { JWT_PASSWORD } from "./config";
import {
  centerSpawn,
  isBlocked,
  loadCollision,
  type CollisionData,
} from "./collision";
import { loadHideSeekConfig } from "./hideSeekConfig";

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

  public get joinedSpaceId(): string | undefined {
    return this.spaceId;
  }

  constructor(ws: WebSocket) {
    this.id = getRandomString(10);
    this.x = 0;
    this.y = 0;
    this.ws = ws;
    this.initHandlers();
  }

  initHandlers() {
    this.ws.on("message", async (data: any) => {
      let parsedData: IncomingMessage;
      try {
        parsedData = JSON.parse(data.toString()) as IncomingMessage;
      } catch {
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
        console.error("Failed to handle ws message", err);
      }
    });
  }

  private async handleJoin(payload: Payload<"join">): Promise<void> {
    if (this.spaceId) return;
    const { spaceId, token } = payload;
    const userId = (jwt.verify(token, JWT_PASSWORD) as JwtPayload).userId;
    if (!userId) {
      this.ws.close();
      return;
    }
    this.userId = userId;

    const space = await client.space.findFirst({ where: { id: spaceId } });
    if (!space) {
      this.ws.close();
      return;
    }
    this.spaceId = spaceId;
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
      console.error(`Invalid hide-and-seek assets for space ${spaceId}`);
      this.spaceId = undefined;
      this.ws.close();
      return;
    }
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

  destroy() {
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
