import {
  BACKEND_URL,
  authHeader,
  createRoom,
  createVideoRoom,
  http,
  makeUser,
  type TestUser,
} from "./helpers";

function decodeJwtPayload(token: string): any {
  const payload = token.split(".")[1]!;
  return JSON.parse(Buffer.from(payload, "base64url").toString());
}

describe("LiveKit access tokens", () => {
  let user: TestUser;
  let videoSpaceId = "";
  let plainSpaceId = "";

  beforeAll(async () => {
    user = await makeUser("livekit");
    videoSpaceId = (await createVideoRoom(user.token, "LiveKit office"))
      .spaceId;
    // createRoom uses the Study Library map, which is not video-enabled.
    plainSpaceId = (await createRoom(user.token, "LiveKit library")).spaceId;
  });

  test("A token requires auth", async () => {
    const noAuth = await http.post(`${BACKEND_URL}/api/v1/livekit/token`, {
      spaceId: videoSpaceId,
    });
    expect(noAuth.status).toBe(403);

    const badToken = await http.post(
      `${BACKEND_URL}/api/v1/livekit/token`,
      { spaceId: videoSpaceId },
      authHeader("not-a-real-token"),
    );
    expect(badToken.status).toBe(401);
  });

  test("A missing spaceId is rejected", async () => {
    const response = await http.post(
      `${BACKEND_URL}/api/v1/livekit/token`,
      {},
      authHeader(user.token),
    );
    expect(response.status).toBe(400);
  });

  test("An unknown space returns 404", async () => {
    const response = await http.post(
      `${BACKEND_URL}/api/v1/livekit/token`,
      { spaceId: "no-such-space" },
      authHeader(user.token),
    );
    expect(response.status).toBe(404);
  });

  test("A space whose map has no video capability is refused", async () => {
    const response = await http.post(
      `${BACKEND_URL}/api/v1/livekit/token`,
      { spaceId: plainSpaceId },
      authHeader(user.token),
    );
    expect(response.status).toBe(403);
  });

  test("A video space returns a token granting access to that room only", async () => {
    const response = await http.post(
      `${BACKEND_URL}/api/v1/livekit/token`,
      { spaceId: videoSpaceId },
      authHeader(user.token),
    );
    expect(response.status).toBe(200);
    expect(typeof response.data.token).toBe("string");
    expect(typeof response.data.url).toBe("string");

    const payload = decodeJwtPayload(response.data.token);
    expect(payload.video.room).toBe(videoSpaceId);
    expect(payload.video.roomJoin).toBe(true);
    expect(payload.video.canPublish).toBe(true);
    expect(payload.video.canSubscribe).toBe(true);
    expect(payload.name).toBe(user.username);
    expect(payload.sub.startsWith(`${user.userId}:`)).toBe(true);
    // The SDK sets nbf/exp (no iat), so the TTL is exp - nbf.
    expect(payload.exp - payload.nbf).toBe(6 * 60 * 60);
  });

  test("Each request gets a fresh identity so one user can open two tabs", async () => {
    const first = await http.post(
      `${BACKEND_URL}/api/v1/livekit/token`,
      { spaceId: videoSpaceId },
      authHeader(user.token),
    );
    const second = await http.post(
      `${BACKEND_URL}/api/v1/livekit/token`,
      { spaceId: videoSpaceId },
      authHeader(user.token),
    );

    const a = decodeJwtPayload(first.data.token).sub;
    const b = decodeJwtPayload(second.data.token).sub;
    expect(a).not.toBe(b);
    expect(a.split(":")[0]).toBe(user.userId);
    expect(b.split(":")[0]).toBe(user.userId);
  });
});
