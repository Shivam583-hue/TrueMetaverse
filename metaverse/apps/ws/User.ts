import { WebSocket } from "ws";
import { RoomManager } from "./RoomManager";
import type { IncomingMessage, OutgoingMessage } from "@repo/types";
import client from "@repo/db/client";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { JWT_PASSWORD } from "./config";
import {
  centerSpawn,
  isBlocked,
  loadCollision,
  type CollisionData,
} from "./collision";

const MAX_CHAT_LENGTH = 500;
const CHAT_WINDOW_MS = 10_000;
const CHAT_MAX_IN_WINDOW = 10;
const MAX_RTC_SIGNAL_BYTES = 64 * 1024;

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
  public x: number;
  public y: number;
  public mic = false;
  public cam = false;
  private ws: WebSocket;
  private chatTimestamps: number[] = [];

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
          case "rtc-signal":
            this.handleRtcSignal(parsedData.payload);
            break;
          case "media-state":
            this.handleMediaState(parsedData.payload);
            break;
        }
      } catch (err) {
        console.error("Failed to handle ws message", err);
      }
    });
  }

  private async handleJoin(payload: Payload<"join">): Promise<void> {
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

    RoomManager.getInstance().addUser(spaceId, this);
    const spawn = centerSpawn(this.collision, space.width, space.height);
    this.x = spawn.x;
    this.y = spawn.y;

    this.send({
      type: "space-joined",
      payload: {
        spawn: { x: this.x, y: this.y },
        users:
          RoomManager.getInstance()
            .rooms.get(spaceId)
            ?.filter((u) => u.id !== this.id)
            ?.map((u) => ({
              id: u.id,
              userId: u.userId!,
              x: u.x,
              y: u.y,
              mic: u.mic,
              cam: u.cam,
            })) ?? [],
      },
    });
    RoomManager.getInstance().broadcast(
      {
        type: "user-joined",
        payload: { id: this.id, userId: this.userId!, x: this.x, y: this.y },
      },
      this,
      this.spaceId!,
    );
  }

  private handleMove(payload: Payload<"move">): void {
    const { x: moveX, y: moveY } = payload;
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
      !isBlocked(this.collision, moveX, moveY)
    ) {
      this.x = moveX;
      this.y = moveY;
      RoomManager.getInstance().broadcast(
        {
          type: "movement",
          payload: { id: this.id, userId: this.userId!, x: this.x, y: this.y },
        },
        this,
        this.spaceId!,
      );
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

    RoomManager.getInstance().broadcastAll(
      {
        type: "chat",
        payload: { id: this.id, userId: this.userId, text, at: now },
      },
      this.spaceId,
    );
  }

  private handleRtcSignal(payload: Payload<"rtc-signal">): void {
    if (!this.userId || !this.spaceId) return;
    if (typeof payload.to !== "string" || payload.data === undefined) return;
    if (JSON.stringify(payload.data).length > MAX_RTC_SIGNAL_BYTES) return;

    const target = RoomManager.getInstance()
      .rooms.get(this.spaceId)
      ?.find((u) => u.id === payload.to);
    if (!target || target.id === this.id) return;

    target.send({
      type: "rtc-signal",
      payload: { from: this.id, data: payload.data },
    });
  }

  private handleMediaState(payload: Payload<"media-state">): void {
    if (!this.userId || !this.spaceId) return;
    this.mic = payload.mic === true;
    this.cam = payload.cam === true;

    RoomManager.getInstance().broadcast(
      {
        type: "media-state",
        payload: {
          id: this.id,
          userId: this.userId,
          mic: this.mic,
          cam: this.cam,
        },
      },
      this,
      this.spaceId,
    );
  }

  destroy() {
    RoomManager.getInstance().broadcast(
      {
        type: "user-left",
        payload: {
          id: this.id,
          userId: this.userId!,
        },
      },
      this,
      this.spaceId!,
    );
    RoomManager.getInstance().removeUser(this, this.spaceId!);
  }

  send(payload: OutgoingMessage) {
    this.ws.send(JSON.stringify(payload));
  }
}
