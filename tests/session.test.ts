import {
  createRoom,
  joinSpace,
  makeUser,
  nextOfType,
  openSocket,
  sleep,
  waitForClose,
  type TestUser,
} from "./helpers";

const WS_CLOSE_SESSION_REPLACED = 4002;

describe("Room roster lifecycle", () => {
  let alice: TestUser;
  let observer: TestUser;
  let spaceId = "";

  beforeAll(async () => {
    alice = await makeUser("session-alice");
    observer = await makeUser("session-observer");
    const room = await createRoom(alice.token, "Session room");
    spaceId = room.spaceId;
  });

  // The roster is not exposed over HTTP, so a fresh socket reads it back
  // through the presence list it receives on join.
  async function roster(): Promise<string[]> {
    const socket = await openSocket();
    joinSpace(socket.ws, spaceId, observer.token);
    const joined = await nextOfType(socket.messages, "space-joined");
    expect(joined).not.toBeNull();
    const users = joined.payload.users.map((user: any) => user.userId);
    socket.ws.close();
    await sleep(150);
    return users;
  }

  test("A clean leave removes the user from the roster", async () => {
    const socket = await openSocket();
    joinSpace(socket.ws, spaceId, alice.token);
    expect(await nextOfType(socket.messages, "space-joined")).not.toBeNull();
    expect(await roster()).toContain(alice.userId);

    socket.ws.close();
    await sleep(300);

    expect(await roster()).not.toContain(alice.userId);
  });

  test("A socket closed while the join is still in flight leaves no ghost", async () => {
    const socket = await openSocket();
    joinSpace(socket.ws, spaceId, alice.token);
    socket.ws.close();
    await sleep(1000);

    expect(await roster()).not.toContain(alice.userId);
  });

  test("A second connection for the same account replaces the first", async () => {
    const first = await openSocket();
    joinSpace(first.ws, spaceId, alice.token);
    expect(await nextOfType(first.messages, "space-joined")).not.toBeNull();
    const replaced = waitForClose(first.ws);

    const second = await openSocket();
    joinSpace(second.ws, spaceId, alice.token);
    const joined = await nextOfType(second.messages, "space-joined");

    expect(joined).not.toBeNull();
    expect(joined.payload.users).toEqual([]);
    const event = await replaced;
    expect(event).not.toBeNull();
    expect(event!.code).toBe(WS_CLOSE_SESSION_REPLACED);
    expect(await roster()).toEqual([alice.userId]);

    second.ws.close();
    await sleep(200);
  });

  test("Other players are told when a replaced session is dropped", async () => {
    const bystander = await openSocket();
    joinSpace(bystander.ws, spaceId, observer.token);
    expect(await nextOfType(bystander.messages, "space-joined")).not.toBeNull();

    const first = await openSocket();
    joinSpace(first.ws, spaceId, alice.token);
    expect(await nextOfType(first.messages, "space-joined")).not.toBeNull();
    expect(await nextOfType(bystander.messages, "user-joined")).not.toBeNull();

    const second = await openSocket();
    joinSpace(second.ws, spaceId, alice.token);
    expect(await nextOfType(second.messages, "space-joined")).not.toBeNull();

    const left = await nextOfType(bystander.messages, "user-left");
    expect(left).not.toBeNull();
    expect(left.payload.userId).toBe(alice.userId);

    bystander.ws.close();
    second.ws.close();
    await sleep(200);
  });
});
