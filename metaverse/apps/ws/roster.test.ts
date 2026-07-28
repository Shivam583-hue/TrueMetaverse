import { afterEach, describe, expect, test } from "bun:test";
import { WS_CLOSE_SESSION_REPLACED, type OutgoingMessage } from "@repo/types";
import { RoomManager } from "./RoomManager";
import type { User } from "./User";

type FakeUser = User & {
  messages: OutgoingMessage[];
  evictions: { code: number; reason: string }[];
};

const roomsToClean = new Set<string>();

function fakeUser(id: string, userId: string): FakeUser {
  const messages: OutgoingMessage[] = [];
  const evictions: { code: number; reason: string }[] = [];
  const user = {
    id,
    userId,
    x: 0,
    y: 0,
    messages,
    evictions,
    send(message: OutgoingMessage) {
      messages.push(message);
    },
    evict(code: number, reason: string) {
      evictions.push({ code, reason });
      RoomManager.getInstance().removeUser(user as unknown as User, roomOf(id));
    },
  };
  return user as unknown as FakeUser;
}

const rooms = new Map<string, string>();
const roomOf = (id: string) => rooms.get(id)!;

function join(roomId: string, user: FakeUser) {
  rooms.set(user.id, roomId);
  roomsToClean.add(roomId);
  const manager = RoomManager.getInstance();
  manager.evictPreviousSessions(roomId, user);
  manager.addUser(roomId, user, {
    hideSeekConfig: null,
    collision: null,
    creatorId: user.userId!,
  });
  return manager;
}

const rosterIds = (roomId: string) =>
  (RoomManager.getInstance().rooms.get(roomId) ?? []).map((user) => user.id);

afterEach(() => {
  const manager = RoomManager.getInstance();
  for (const roomId of roomsToClean) {
    for (const user of [...(manager.rooms.get(roomId) ?? [])]) {
      manager.removeUser(user, roomId);
    }
  }
  roomsToClean.clear();
  rooms.clear();
});

describe("one live session per user per space", () => {
  test("A second connection for the same account replaces the first", () => {
    const roomId = `roster-${crypto.randomUUID()}`;
    const first = fakeUser("conn-1", "alice");
    const second = fakeUser("conn-2", "alice");

    join(roomId, first);
    join(roomId, second);

    expect(first.evictions).toEqual([
      { code: WS_CLOSE_SESSION_REPLACED, reason: "session replaced" },
    ]);
    expect(rosterIds(roomId)).toEqual(["conn-2"]);
  });

  test("Bystanders are told the replaced session left", () => {
    const roomId = `roster-${crypto.randomUUID()}`;
    const bystander = fakeUser("conn-0", "bob");
    const first = fakeUser("conn-1", "alice");
    const second = fakeUser("conn-2", "alice");

    join(roomId, bystander);
    join(roomId, first);
    bystander.messages.length = 0;
    join(roomId, second);

    expect(bystander.messages).toEqual([
      { type: "user-left", payload: { id: "conn-1", userId: "alice" } },
    ]);
  });

  test("A different account in the same space is left alone", () => {
    const roomId = `roster-${crypto.randomUUID()}`;
    const alice = fakeUser("conn-1", "alice");
    const bob = fakeUser("conn-2", "bob");

    join(roomId, alice);
    join(roomId, bob);

    expect(alice.evictions).toEqual([]);
    expect(rosterIds(roomId)).toEqual(["conn-1", "conn-2"]);
  });

  test("The same account in another space is left alone", () => {
    const lobby = `roster-${crypto.randomUUID()}`;
    const library = `roster-${crypto.randomUUID()}`;
    const inLobby = fakeUser("conn-1", "alice");
    const inLibrary = fakeUser("conn-2", "alice");

    join(lobby, inLobby);
    join(library, inLibrary);

    expect(inLobby.evictions).toEqual([]);
    expect(rosterIds(lobby)).toEqual(["conn-1"]);
    expect(rosterIds(library)).toEqual(["conn-2"]);
  });

  test("An unauthenticated connection evicts nobody", () => {
    const roomId = `roster-${crypto.randomUUID()}`;
    const alice = fakeUser("conn-1", "alice");
    const anonymous = fakeUser("conn-2", undefined as unknown as string);

    join(roomId, alice);

    expect(
      RoomManager.getInstance().evictPreviousSessions(roomId, anonymous),
    ).toBe(0);
    expect(alice.evictions).toEqual([]);
  });

  test("Rejoining an empty space evicts nothing and reports zero", () => {
    const roomId = `roster-${crypto.randomUUID()}`;
    const alice = fakeUser("conn-1", "alice");

    expect(RoomManager.getInstance().evictPreviousSessions(roomId, alice)).toBe(
      0,
    );
  });
});
