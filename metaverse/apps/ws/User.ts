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
      const parsedData = JSON.parse(data.toString()) as IncomingMessage;
      switch (parsedData.type) {
        case "join":
          const spaceId = parsedData.payload.spaceId;
          const token = parsedData.payload.token;
          const userId = (jwt.verify(token, JWT_PASSWORD) as JwtPayload).userId;
          if (!userId) {
            this.ws.close();
            return;
          }
          this.userId = userId;
          const space = await client.space.findFirst({
            where: {
              id: spaceId,
            },
          });
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
              spawn: {
                x: this.x,
                y: this.y,
              },
              users:
                RoomManager.getInstance()
                  .rooms.get(spaceId)
                  ?.filter((x) => x.id !== this.id)
                  ?.map((u) => ({
                    id: u.id,
                    userId: u.userId!,
                    x: u.x,
                    y: u.y,
                  })) ?? [],
            },
          });
          RoomManager.getInstance().broadcast(
            {
              type: "user-joined",
              payload: {
                id: this.id,
                userId: this.userId!,
                x: this.x,
                y: this.y,
              },
            },
            this,
            this.spaceId!,
          );
          break;
        case "move":
          const moveX = parsedData.payload.x;
          const moveY = parsedData.payload.y;
          const xDisplacement = Math.abs(this.x - moveX);
          const yDisplacement = Math.abs(this.y - moveY);
          const insideBounds =
            moveX >= 0 &&
            moveX < this.spaceWidth &&
            moveY >= 0 &&
            moveY < this.spaceHeight;
          if (
            insideBounds &&
            ((xDisplacement == 1 && yDisplacement == 0) ||
              (xDisplacement == 0 && yDisplacement == 1)) &&
            !isBlocked(this.collision, moveX, moveY)
          ) {
            this.x = moveX;
            this.y = moveY;
            RoomManager.getInstance().broadcast(
              {
                type: "movement",
                payload: {
                  id: this.id,
                  userId: this.userId!,
                  x: this.x,
                  y: this.y,
                },
              },
              this,
              this.spaceId!,
            );
            return;
          }

          this.send({
            type: "movement-rejected",
            payload: {
              x: this.x,
              y: this.y,
            },
          });
          break;
        case "chat": {
          if (!this.userId || !this.spaceId) return;
          const text = parsedData.payload.text.trim().slice(0, MAX_CHAT_LENGTH);
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
              payload: {
                id: this.id,
                userId: this.userId,
                text,
                at: now,
              },
            },
            this.spaceId,
          );
          break;
        }
      }
    });
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
