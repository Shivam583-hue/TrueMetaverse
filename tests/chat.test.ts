import {
  createRoom,
  joinSpace,
  makeUser,
  nextOfType,
  openSocket,
  sendWs,
  sleep,
  type Socket,
  type TestUser,
} from "./helpers";

describe("Websocket chat", () => {
  let user1: TestUser;
  let user2: TestUser;
  let spaceId = "";
  let s1: Socket;
  let s2: Socket;

  beforeAll(async () => {
    user1 = await makeUser("chat");
    user2 = await makeUser("chat");
    const room = await createRoom(user1.token, "Chat room");
    spaceId = room.spaceId;

    s1 = await openSocket();
    s2 = await openSocket();
    joinSpace(s1.ws, spaceId, user1.token);
    joinSpace(s2.ws, spaceId, user2.token);
    await sleep(300);
  });

  afterAll(() => {
    try {
      s1?.ws.close();
    } catch { }
    try {
      s2?.ws.close();
    } catch { }
  });

  function clearBuffers() {
    s1.messages.length = 0;
    s2.messages.length = 0;
  }

  test("A message is broadcast to everyone in the room, including the sender", async () => {
    clearBuffers();
    sendWs(s1.ws, "chat", { text: "hello room" });

    const forSender = await nextOfType(s1.messages, "chat");
    const forOther = await nextOfType(s2.messages, "chat");

    expect(forSender).not.toBeNull();
    expect(forOther).not.toBeNull();
    for (const msg of [forSender, forOther]) {
      expect(msg.payload.text).toBe("hello room");
      expect(msg.payload.userId).toBe(user1.userId);
      expect(typeof msg.payload.at).toBe("number");
      expect(msg.payload.id).toBeDefined();
    }
  });

  test("Leading and trailing whitespace is trimmed", async () => {
    clearBuffers();
    sendWs(s1.ws, "chat", { text: "   spaced out   " });

    const msg = await nextOfType(s2.messages, "chat");
    expect(msg).not.toBeNull();
    expect(msg.payload.text).toBe("spaced out");
  });

  test("Blank messages are dropped", async () => {
    clearBuffers();
    sendWs(s1.ws, "chat", { text: "      " });

    const msg = await nextOfType(s2.messages, "chat", 500);
    expect(msg).toBeNull();
  });

  test("Non-string message payloads are ignored without crashing the server", async () => {
    clearBuffers();
    sendWs(s1.ws, "chat", { text: 12345 });

    const bad = await nextOfType(s2.messages, "chat", 500);
    expect(bad).toBeNull();

    sendWs(s1.ws, "chat", { text: "still here" });
    const good = await nextOfType(s2.messages, "chat");
    expect(good).not.toBeNull();
    expect(good.payload.text).toBe("still here");
  });

  test("Chat is rate limited to at most 10 messages per window", async () => {
    clearBuffers();
    for (let i = 1; i <= 15; i++) sendWs(s2.ws, "chat", { text: `spam ${i}` });
    await sleep(500);

    const received = s1.messages.filter(
      (m) => m.type === "chat" && m.payload.text.startsWith("spam"),
    );
    expect(received.length).toBeGreaterThan(0);
    expect(received.length).toBeLessThanOrEqual(10);
  });

  test("Chat sent before joining a space is ignored", async () => {
    const lone = await openSocket();
    const observer = await openSocket();
    joinSpace(observer.ws, spaceId, user1.token);
    await sleep(200);
    observer.messages.length = 0;

    sendWs(lone.ws, "chat", { text: "am I here?" });
    const leaked = await nextOfType(observer.messages, "chat", 500);
    expect(leaked).toBeNull();

    lone.ws.close();
    observer.ws.close();
  });
});
