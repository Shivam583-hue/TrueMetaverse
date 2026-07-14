import {
  createRoom,
  joinSpace,
  makeUser,
  nextOfType,
  openSocket,
  sleep,
  type Socket,
  type TestUser,
} from "./helpers";

describe("Websocket movement", () => {
  let user1: TestUser;
  let user2: TestUser;
  let spaceId = "";
  let s1: Socket;
  let s2: Socket;

  beforeAll(async () => {
    user1 = await makeUser("ws");
    user2 = await makeUser("ws");
    const room = await createRoom(user1.token, "WS room");
    spaceId = room.spaceId;

    s1 = await openSocket();
    s2 = await openSocket();

    joinSpace(s1.ws, spaceId, user1.token);
    await nextOfType(s1.messages, "space-joined");
    joinSpace(s2.ws, spaceId, user2.token);
    await nextOfType(s2.messages, "space-joined");
    await nextOfType(s1.messages, "user-joined");
  });

  afterAll(() => {
    try {
      s1?.ws.close();
    } catch { }
    try {
      s2?.ws.close();
    } catch { }
  });

  test("Leaving broadcasts a user-left event with identity", async () => {
    s1.ws.close();
    const message = await nextOfType(s2.messages, "user-left");
    expect(message).not.toBeNull();
    expect(message.payload.userId).toBe(user1.userId);
    expect(message.payload.id).toBeDefined();
  });

  test("Malformed frames are ignored and the connection stays usable", async () => {
    const s3 = await openSocket();
    s3.ws.send("this is not json at all");
    s3.ws.send(JSON.stringify({ type: "unknown-op", payload: { foo: 1 } }));
    await sleep(50);

    joinSpace(s3.ws, spaceId, user2.token);
    const joined = await nextOfType(s3.messages, "space-joined");
    expect(joined).not.toBeNull();
    s3.ws.close();
  });
});
