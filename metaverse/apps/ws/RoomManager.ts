import type { User } from "./User";
import type { OutgoingMessage, WhiteboardScene } from "@repo/types";

export class RoomManager {
  rooms: Map<string, User[]> = new Map();
  whiteboards: Map<string, WhiteboardScene> = new Map();
  static instance: RoomManager;

  private constructor() {
    this.rooms = new Map();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new RoomManager();
    }
    return this.instance;
  }

  public removeUser(user: User, spaceId: string) {
    if (!this.rooms.has(spaceId)) {
      return;
    }
    const users =
      this.rooms.get(spaceId)?.filter((u) => u.id !== user.id) ?? [];
    if (users.length === 0) {
      this.rooms.delete(spaceId);
      this.whiteboards.delete(spaceId);
      return;
    }
    this.rooms.set(spaceId, users);
  }

  public addUser(spaceId: string, user: User) {
    if (!this.rooms.has(spaceId)) {
      this.rooms.set(spaceId, [user]);
      return;
    }
    this.rooms.set(spaceId, [...(this.rooms.get(spaceId) ?? []), user]);
  }

  public broadcast(message: OutgoingMessage, user: User, roomId: string) {
    if (!this.rooms.has(roomId)) {
      return;
    }
    this.rooms.get(roomId)?.forEach((u) => {
      if (u.id !== user.id) {
        u.send(message);
      }
    });
  }

  public broadcastAll(message: OutgoingMessage, roomId: string) {
    this.rooms.get(roomId)?.forEach((u) => u.send(message));
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
}
