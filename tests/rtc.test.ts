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

describe("WebRTC signaling", () => {
  let user1: TestUser;
  let user2: TestUser;
  let user3: TestUser;
  let spaceId = "";
  let s1: Socket;
  let s2: Socket;
  let s3: Socket;
  let id1 = "";
  let id2 = "";
  let id3 = "";

  beforeAll(async () => {
    user1 = await makeUser("rtc");
    user2 = await makeUser("rtc");
    user3 = await makeUser("rtc");
    const room = await createRoom(user1.token, "RTC room");
    spaceId = room.spaceId;

    s1 = await openSocket();
    joinSpace(s1.ws, spaceId, user1.token);
    await nextOfType(s1.messages, "space-joined");

    s2 = await openSocket();
    joinSpace(s2.ws, spaceId, user2.token);
    const joined2 = await nextOfType(s2.messages, "space-joined");
    id1 = joined2.payload.users.find((u: any) => u.userId === user1.userId).id;
    id2 = (await nextOfType(s1.messages, "user-joined")).payload.id;

    s3 = await openSocket();
    joinSpace(s3.ws, spaceId, user3.token);
    await nextOfType(s3.messages, "space-joined");
    id3 = (await nextOfType(s1.messages, "user-joined")).payload.id;
    await sleep(200);
  });

  afterAll(() => {
    for (const s of [s1, s2, s3]) {
      try {
        s?.ws.close();
      } catch { }
    }
  });

  function clearBuffers() {
    s1.messages.length = 0;
    s2.messages.length = 0;
    s3.messages.length = 0;
  }

  test("A signal is relayed to its target only, with from = sender's session id", async () => {
    clearBuffers();
    const data = { description: { type: "offer", sdp: "v=0 fake" } };
    sendWs(s1.ws, "rtc-signal", { to: id2, data });

    const relayed = await nextOfType(s2.messages, "rtc-signal");
    expect(relayed).not.toBeNull();
    expect(relayed.payload.from).toBe(id1);
    expect(relayed.payload.data).toEqual(data);

    const leaked = await nextOfType(s3.messages, "rtc-signal", 500);
    expect(leaked).toBeNull();
  });

  test("Signals do not cross rooms", async () => {
    const outsider = await makeUser("rtc-out");
    const observer = await makeUser("rtc-out");
    const otherRoom = await createRoom(outsider.token, "Other RTC room");

    const so = await openSocket();
    joinSpace(so.ws, otherRoom.spaceId, outsider.token);
    await nextOfType(so.messages, "space-joined");

    // A second member of the other room, so we can learn the outsider's id.
    const sObs = await openSocket();
    joinSpace(sObs.ws, otherRoom.spaceId, observer.token);
    const joined = await nextOfType(sObs.messages, "space-joined");
    const outsiderId = joined.payload.users.find(
      (u: any) => u.userId === outsider.userId,
    ).id;

    so.messages.length = 0;
    sendWs(s1.ws, "rtc-signal", { to: outsiderId, data: { x: 1 } });
    const leaked = await nextOfType(so.messages, "rtc-signal", 500);
    expect(leaked).toBeNull();

    so.ws.close();
    sObs.ws.close();
  });

  test("A signal to an unknown session id is dropped without killing the connection", async () => {
    clearBuffers();
    sendWs(s1.ws, "rtc-signal", { to: "no-such-session", data: { x: 1 } });
    await sleep(200);

    sendWs(s1.ws, "chat", { text: "still alive" });
    const chat = await nextOfType(s2.messages, "chat");
    expect(chat).not.toBeNull();
    expect(chat.payload.text).toBe("still alive");
  });

  test("A signal addressed to the sender itself is dropped", async () => {
    clearBuffers();
    sendWs(s1.ws, "rtc-signal", { to: id1, data: { x: 1 } });
    const echoed = await nextOfType(s1.messages, "rtc-signal", 500);
    expect(echoed).toBeNull();
  });

  test("Malformed signals are ignored and the connection stays usable", async () => {
    clearBuffers();
    sendWs(s1.ws, "rtc-signal", { to: 42, data: { x: 1 } });
    sendWs(s1.ws, "rtc-signal", { to: id2 });
    sendWs(s1.ws, "rtc-signal", { to: id2, data: "x".repeat(70 * 1024) });
    const bad = await nextOfType(s2.messages, "rtc-signal", 500);
    expect(bad).toBeNull();

    sendWs(s1.ws, "rtc-signal", { to: id2, data: { ok: true } });
    const good = await nextOfType(s2.messages, "rtc-signal");
    expect(good).not.toBeNull();
    expect(good.payload.data).toEqual({ ok: true });
  });

  test("media-state is broadcast to the room (not echoed) and seen by late joiners", async () => {
    clearBuffers();
    sendWs(s1.ws, "media-state", { mic: true, cam: true });

    for (const s of [s2, s3]) {
      const state = await nextOfType(s.messages, "media-state");
      expect(state).not.toBeNull();
      expect(state.payload).toEqual({
        id: id1,
        userId: user1.userId,
        mic: true,
        cam: true,
      });
    }
    const echoed = await nextOfType(s1.messages, "media-state", 500);
    expect(echoed).toBeNull();

    const late = await makeUser("rtc-late");
    const sLate = await openSocket();
    joinSpace(sLate.ws, spaceId, late.token);
    const joined = await nextOfType(sLate.messages, "space-joined");
    const entry1 = joined.payload.users.find((u: any) => u.id === id1);
    expect(entry1.mic).toBe(true);
    expect(entry1.cam).toBe(true);
    const entry2 = joined.payload.users.find((u: any) => u.id === id2);
    expect(entry2.mic).toBe(false);
    expect(entry2.cam).toBe(false);
    sLate.ws.close();
  });

  test("Non-boolean media-state payloads are coerced to false", async () => {
    clearBuffers();
    sendWs(s2.ws, "media-state", { mic: "yes", cam: 1 });
    const state = await nextOfType(s1.messages, "media-state");
    expect(state).not.toBeNull();
    expect(state.payload.mic).toBe(false);
    expect(state.payload.cam).toBe(false);
  });

  test("Signals sent before joining a space are ignored", async () => {
    clearBuffers();
    const lone = await openSocket();
    sendWs(lone.ws, "rtc-signal", { to: id1, data: { x: 1 } });
    sendWs(lone.ws, "media-state", { mic: true, cam: true });

    expect(await nextOfType(s1.messages, "rtc-signal", 500)).toBeNull();
    expect(await nextOfType(s1.messages, "media-state", 300)).toBeNull();
    lone.ws.close();
  });
});
