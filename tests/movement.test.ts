import {
  BACKEND_URL,
  authHeader,
  createRoom,
  http,
  joinSpace,
  makeUser,
  nextMessage,
  nextOfType,
  openSocket,
  sendWs,
  sleep,
  type Socket,
  type TestUser,
} from "./helpers";

describe("Websocket movement", () => {
  let user1: TestUser;
  let user2: TestUser;
  let spaceId = "";
  let spaceWidth = 0;
  let s1: Socket;
  let s2: Socket;
  let user1X = 0;
  let user1Y = 0;

  beforeAll(async () => {
    user1 = await makeUser("ws");
    user2 = await makeUser("ws");
    const room = await createRoom(user1.token, "WS room");
    spaceId = room.spaceId;

    const detail = await http.get(
      `${BACKEND_URL}/api/v1/space/${spaceId}`,
      authHeader(user1.token),
    );
    spaceWidth = parseInt(detail.data.dimensions.split("x")[0]);

    s1 = await openSocket();
    s2 = await openSocket();
  });

  afterAll(() => {
    try {
      s1?.ws.close();
    } catch {}
    try {
      s2?.ws.close();
    } catch {}
  });

  test("Joining announces spawn, existing users, and identity", async () => {
    joinSpace(s1.ws, spaceId, user1.token);
    const message1 = await nextMessage(s1.messages);

    joinSpace(s2.ws, spaceId, user2.token);
    const message2 = await nextOfType(s2.messages, "space-joined");
    const message3 = await nextOfType(s1.messages, "user-joined");

    expect(message1.type).toBe("space-joined");
    expect(message2.type).toBe("space-joined");
    expect(message1.payload.users.length).toBe(0);
    expect(message2.payload.users.length).toBe(1);
    expect(message2.payload.users[0].userId).toBe(user1.userId);
    expect(message2.payload.users[0].x).toBe(message1.payload.spawn.x);
    expect(message2.payload.users[0].y).toBe(message1.payload.spawn.y);
    expect(message3.type).toBe("user-joined");
    expect(message3.payload.userId).toBe(user2.userId);
    expect(message3.payload.id).toBeDefined();

    user1X = message1.payload.spawn.x;
    user1Y = message1.payload.spawn.y;
  });

  test("Moving two tiles at once is rejected", async () => {
    sendWs(s1.ws, "move", { x: user1X + 2, y: user1Y });

    const message = await nextOfType(s1.messages, "movement-rejected");
    expect(message).not.toBeNull();
    expect(message.payload.x).toBe(user1X);
    expect(message.payload.y).toBe(user1Y);
  });

  test("A valid step is broadcast to others with identity", async () => {
    const step =
      user1X > 0 ? { x: user1X - 1, y: user1Y } : { x: user1X + 1, y: user1Y };
    sendWs(s1.ws, "move", step);

    const message = await nextOfType(s2.messages, "movement");
    expect(message).not.toBeNull();
    expect(message.payload.x).toBe(step.x);
    expect(message.payload.y).toBe(step.y);
    expect(message.payload.userId).toBe(user1.userId);
    expect(message.payload.id).toBeDefined();

    user1X = step.x;
    user1Y = step.y;
  });

  test("Walking into a wall or the edge is rejected and keeps the player in place", async () => {
    let lastGoodX = user1X;
    let rejection: any = null;
    for (let i = 0; i < spaceWidth + 2 && !rejection; i++) {
      sendWs(s1.ws, "move", { x: lastGoodX + 1, y: user1Y });
      await sleep(30);
      const rej = await nextOfType(s1.messages, "movement-rejected", 60);
      if (rej) rejection = rej;
      else lastGoodX += 1;
    }

    // A rejection happens either at map collision or at the room boundary, and
    // it always reports the last valid position rather than advancing.
    expect(rejection).not.toBeNull();
    expect(rejection.payload.x).toBe(lastGoodX);
    expect(rejection.payload.x).toBeGreaterThanOrEqual(0);
    expect(rejection.payload.x).toBeLessThanOrEqual(spaceWidth - 1);
    user1X = rejection.payload.x;
  }, 15000);

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
