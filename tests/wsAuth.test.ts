import {
  createRoom,
  joinSpace,
  makeUser,
  nextOfType,
  openSocket,
  sendWs,
  waitForClose,
  type TestUser,
} from "./helpers";

const WS_CLOSE_UNAUTHORIZED = 4001;

function tamperSignature(token: string): string {
  const [header, payload, signature] = token.split(".");
  const flipped = signature!.endsWith("A")
    ? `${signature!.slice(0, -1)}B`
    : `${signature!.slice(0, -1)}A`;
  return `${header}.${payload}.${flipped}`;
}

describe("Websocket authentication", () => {
  let user: TestUser;
  let spaceId = "";

  beforeAll(async () => {
    user = await makeUser("wsauth");
    const room = await createRoom(user.token, "WS auth room");
    spaceId = room.spaceId;
  });

  test("A join with a garbage token closes the socket", async () => {
    const socket = await openSocket();
    const closed = waitForClose(socket.ws);

    joinSpace(socket.ws, spaceId, "not-a-real-token");

    const event = await closed;
    expect(event).not.toBeNull();
    expect(event!.code).toBe(WS_CLOSE_UNAUTHORIZED);
  });

  test("A join with a tampered signature closes the socket", async () => {
    const socket = await openSocket();
    const closed = waitForClose(socket.ws);

    joinSpace(socket.ws, spaceId, tamperSignature(user.token));

    const event = await closed;
    expect(event).not.toBeNull();
    expect(event!.code).toBe(WS_CLOSE_UNAUTHORIZED);
  });

  test("A join with no token at all closes the socket", async () => {
    const socket = await openSocket();
    const closed = waitForClose(socket.ws);

    sendWs(socket.ws, "join", { spaceId });

    const event = await closed;
    expect(event).not.toBeNull();
    expect(event!.code).toBe(WS_CLOSE_UNAUTHORIZED);
  });

  test("A valid join keeps the socket open", async () => {
    const socket = await openSocket();

    joinSpace(socket.ws, spaceId, user.token);

    const joined = await nextOfType(socket.messages, "space-joined");
    expect(joined).not.toBeNull();
    socket.ws.close();
  });
});
