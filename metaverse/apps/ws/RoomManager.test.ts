import { afterEach, describe, expect, test } from "bun:test";
import type { HideSeekRoundState, OutgoingMessage } from "@repo/types";
import { RoomManager } from "./RoomManager";
import type { User } from "./User";
import type { HideSeekConfig } from "./hideSeekConfig";

type FakeUser = User & { messages: OutgoingMessage[] };

const roomsToClean = new Set<{ id: string; users: FakeUser[] }>();

function fakeUser(id: string, userId = id): FakeUser {
  const messages: OutgoingMessage[] = [];
  return {
    id,
    userId,
    x: 1,
    y: 1,
    joinedSpaceId: "test-room",
    messages,
    send(message: OutgoingMessage) {
      messages.push(message);
    },
  } as unknown as FakeUser;
}

function stateOf(user: FakeUser): HideSeekRoundState {
  const message = [...user.messages]
    .reverse()
    .find((item) => item.type === "hide-seek-state");
  if (!message || message.type !== "hide-seek-state") {
    throw new Error("missing hide-seek state");
  }
  return message.payload;
}

function setupRoom(
  hideDurationMs = 30_000,
  concealment: HideSeekConfig["concealment"] = [],
) {
  const manager = RoomManager.getInstance();
  const roomId = `test-room-${crypto.randomUUID()}`;
  const users = [fakeUser("a"), fakeUser("b"), fakeUser("c")];
  for (const user of users) {
    Object.defineProperty(user, "joinedSpaceId", { value: roomId });
  }
  const config: HideSeekConfig = {
    version: 1,
    mode: "hide-and-seek",
    grid: { cols: 12, rows: 12 },
    seekerSpawn: { x: 1, y: 1 },
    hiderSpawns: [
      { x: 9, y: 9 },
      { x: 10, y: 9 },
    ],
    concealment,
    settings: {
      hideDurationMs,
      seekDurationMs: 1_000,
      resultsDurationMs: 10,
      sightRadius: 7,
      concealRevealRadius: 2,
      tagRange: 1,
      minPlayers: 3,
      maxPlayers: 12,
    },
  };
  const collision = {
    cols: 12,
    rows: 12,
    blocked: new Uint8Array(12 * 12),
    walkable: [],
  };
  for (const user of users) {
    manager.addUser(roomId, user, {
      hideSeekConfig: config,
      collision,
      creatorId: users[0]!.userId!,
    });
    manager.getVisibleUsers(roomId, user);
  }
  roomsToClean.add({ id: roomId, users });
  return { manager, roomId, users };
}

afterEach(() => {
  const manager = RoomManager.getInstance();
  for (const room of roomsToClean) {
    for (const user of room.users) manager.removeUser(user, room.id);
  }
  roomsToClean.clear();
});

describe("authoritative hide-and-seek rounds", () => {
  test("selects one seeker and withholds hider coordinates during hiding", () => {
    const { manager, roomId, users } = setupRoom();
    users.forEach((user) => (user.messages.length = 0));
    manager.startHideSeek(users[0]!, roomId);

    const states = users.map(stateOf);
    expect(states.filter((state) => state.selfRole === "seeker")).toHaveLength(
      1,
    );
    expect(states.filter((state) => state.selfRole === "hider")).toHaveLength(
      2,
    );
    const seekerIndex = states.findIndex(
      (state) => state.selfRole === "seeker",
    );
    const seeker = users[seekerIndex]!;
    const leakedHider = seeker.messages.some(
      (message) =>
        (message.type === "player-appeared" || message.type === "movement") &&
        states.find((state) => state.selfId === message.payload.id)
          ?.selfRole === "hider",
    );
    expect(leakedHider).toBe(false);
    expect(manager.canMove(seeker, roomId)).toBe(false);
  });

  test("only the host can start a round", () => {
    const { manager, roomId, users } = setupRoom();
    users[1]!.messages.length = 0;
    manager.startHideSeek(users[1]!, roomId);
    expect(users[1]!.messages.at(-1)).toEqual({
      type: "hide-seek-error",
      payload: { message: "Only the host can start the round." },
    });
  });

  test("the seeker can tag only an adjacent visible active hider", async () => {
    const { manager, roomId, users } = setupRoom(5);
    manager.startHideSeek(users[0]!, roomId);
    await Bun.sleep(12);
    const seeker = users.find((user) => stateOf(user).selfRole === "seeker")!;
    const hider = users.find((user) => stateOf(user).selfRole === "hider")!;
    seeker.x = 5;
    seeker.y = 5;
    hider.x = 6;
    hider.y = 5;
    manager.publishMovement(seeker, roomId);
    manager.tagHideSeek(seeker, roomId, hider.id);
    expect(stateOf(hider).selfStatus).toBe("tagged");
    expect(manager.canMove(hider, roomId)).toBe(false);
  });

  test("concealed hiders appear only inside the reveal radius", async () => {
    const { manager, roomId, users } = setupRoom(5, [
      { id: "test-cover", rect: { x: 4, y: 4, w: 3, h: 3 } },
    ]);
    manager.startHideSeek(users[0]!, roomId);
    await Bun.sleep(12);
    const seeker = users.find((user) => stateOf(user).selfRole === "seeker")!;
    const hider = users.find((user) => stateOf(user).selfRole === "hider")!;
    seeker.messages.length = 0;
    seeker.x = 1;
    seeker.y = 5;
    hider.x = 5;
    hider.y = 5;
    manager.publishMovement(seeker, roomId);
    expect(
      seeker.messages.some(
        (message) =>
          message.type === "player-appeared" && message.payload.id === hider.id,
      ),
    ).toBe(false);

    seeker.x = 3;
    manager.publishMovement(seeker, roomId);
    expect(
      seeker.messages.some(
        (message) =>
          message.type === "player-appeared" && message.payload.id === hider.id,
      ),
    ).toBe(true);
  });

  test("a seeker disconnect awards the round to the hiders", () => {
    const { manager, roomId, users } = setupRoom();
    manager.startHideSeek(users[0]!, roomId);
    const seeker = users.find((user) => stateOf(user).selfRole === "seeker")!;
    manager.removeUser(seeker, roomId);
    const remaining = users.find((user) => user.id !== seeker.id)!;
    expect(stateOf(remaining).phase).toBe("finished");
    expect(stateOf(remaining).winner).toBe("hiders");
  });
});
