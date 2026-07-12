import { BACKEND_URL, authHeader, http, makeUser } from "./helpers";

describe("User metadata", () => {
  let token = "";
  let userId = "";
  let avatarId = "";
  let avatarUrl = "";

  beforeAll(async () => {
    const user = await makeUser();
    token = user.token;
    userId = user.userId;
    const avatarsResponse = await http.get(`${BACKEND_URL}/api/v1/avatars`);
    avatarId = avatarsResponse.data.avatars[0].id;
    avatarUrl = avatarsResponse.data.avatars[0].imageUrl;
  });

  test("User cant update their metadata with a wrong avatar id", async () => {
    const response = await http.post(
      `${BACKEND_URL}/api/v1/user/metadata`,
      { avatarId: "123123123" },
      authHeader(token),
    );

    expect(response.status).toBe(400);
  });

  test("User can update their metadata with a seeded avatar id", async () => {
    const response = await http.post(
      `${BACKEND_URL}/api/v1/user/metadata`,
      { avatarId },
      authHeader(token),
    );

    expect(response.status).toBe(200);
  });

  test("User is not able to update their metadata if the auth header is not present", async () => {
    const response = await http.post(`${BACKEND_URL}/api/v1/user/metadata`, {
      avatarId,
    });

    expect(response.status).toBe(403);
  });

  test("Bulk metadata returns username and avatar url", async () => {
    const response = await http.get(
      `${BACKEND_URL}/api/v1/user/metadata/bulk?ids=[${userId}]`,
    );
    expect(response.data.avatars.length).toBe(1);
    expect(response.data.avatars[0].userId).toBe(userId);
    expect(response.data.avatars[0].username).toBeDefined();
    expect(response.data.avatars[0].avatarId).toBe(avatarUrl);
  });
});
