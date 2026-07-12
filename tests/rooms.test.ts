import {
  BACKEND_URL,
  authHeader,
  createRoom,
  getLibraryMapId,
  http,
  makeUser,
  type TestUser,
} from "./helpers";

const LIBRARY_IMAGE = "/assets/spaces/garden-library/gardenlibspace.png";

describe("Rooms", () => {
  let user: TestUser;
  let otherUser: TestUser;
  let mapId = "";

  beforeAll(async () => {
    user = await makeUser();
    otherUser = await makeUser();
    mapId = await getLibraryMapId();
  });

  test("Creating a room requires a template", async () => {
    const response = await http.post(
      `${BACKEND_URL}/api/v1/space`,
      { name: "No template" },
      authHeader(user.token),
    );
    expect(response.status).toBe(400);
  });

  test("Creating a room from a template returns an id and a join code", async () => {
    const response = await http.post(
      `${BACKEND_URL}/api/v1/space`,
      { name: "Focus room", mapId },
      authHeader(user.token),
    );
    expect(response.status).toBe(200);
    expect(response.data.spaceId).toBeDefined();
    expect(response.data.code).toMatch(/^[A-Z2-9]{6}$/);
  });

  test("A room can be found by its join code", async () => {
    const created = await createRoom(user.token, "Code room");

    const response = await http.get(
      `${BACKEND_URL}/api/v1/space/code/${created.code}`,
    );
    expect(response.status).toBe(200);
    expect(response.data.spaceId).toBe(created.spaceId);

    const lower = await http.get(
      `${BACKEND_URL}/api/v1/space/code/${created.code.toLowerCase()}`,
    );
    expect(lower.data.spaceId).toBe(created.spaceId);
  });

  test("An unknown join code returns 400", async () => {
    const response = await http.get(`${BACKEND_URL}/api/v1/space/code/XXXXXX`);
    expect(response.status).toBe(400);
  });

  test("Room details include name, code, map image, and dimensions", async () => {
    const created = await createRoom(user.token, "Detail room");

    const response = await http.get(
      `${BACKEND_URL}/api/v1/space/${created.spaceId}`,
      authHeader(user.token),
    );
    expect(response.status).toBe(200);
    expect(response.data.name).toBe("Detail room");
    expect(response.data.code).toBe(created.code);
    expect(response.data.official).toBe(false);
    expect(response.data.mapImage).toBe(LIBRARY_IMAGE);
    expect(response.data.dimensions).toBe("43x24");
  });

  test("Room details require authentication", async () => {
    const created = await createRoom(user.token, "Private room");
    const response = await http.get(
      `${BACKEND_URL}/api/v1/space/${created.spaceId}`,
    );
    expect(response.status).toBe(403);
  });

  test("The join code is only exposed to the room's creator", async () => {
    const created = await createRoom(user.token, "Invite room");

    const asCreator = await http.get(
      `${BACKEND_URL}/api/v1/space/${created.spaceId}`,
      authHeader(user.token),
    );
    expect(asCreator.data.code).toBe(created.code);

    const asOther = await http.get(
      `${BACKEND_URL}/api/v1/space/${created.spaceId}`,
      authHeader(otherUser.token),
    );
    expect(asOther.status).toBe(200);
    expect(asOther.data.name).toBe("Invite room");
    expect(asOther.data.code).toBeNull();
  });

  test("Unknown room id returns 400", async () => {
    const response = await http.get(
      `${BACKEND_URL}/api/v1/space/123kasdk01`,
      authHeader(user.token),
    );
    expect(response.status).toBe(400);
  });

  test("My rooms list includes created rooms with their codes", async () => {
    const created = await createRoom(user.token, "Listed room");

    const response = await http.get(
      `${BACKEND_URL}/api/v1/space/all`,
      authHeader(user.token),
    );
    const found = response.data.spaces.find(
      (s: any) => s.id === created.spaceId,
    );
    expect(found).toBeDefined();
    expect(found.code).toBe(created.code);
  });

  test("Creator can delete their room", async () => {
    const created = await createRoom(user.token, "Doomed room");

    const response = await http.delete(
      `${BACKEND_URL}/api/v1/space/${created.spaceId}`,
      authHeader(user.token),
    );
    expect(response.status).toBe(200);
  });

  test("Deleting a room that doesn't exist returns 400", async () => {
    const response = await http.delete(
      `${BACKEND_URL}/api/v1/space/randomIdDoesntExist`,
      authHeader(user.token),
    );
    expect(response.status).toBe(400);
  });

  test("Someone else's room cannot be deleted", async () => {
    const created = await createRoom(user.token, "Protected room");

    const response = await http.delete(
      `${BACKEND_URL}/api/v1/space/${created.spaceId}`,
      authHeader(otherUser.token),
    );
    expect(response.status).toBe(403);
  });

  test("The official Study Library is listed", async () => {
    const response = await http.get(`${BACKEND_URL}/api/v1/space/official`);
    expect(response.status).toBe(200);
    const library = response.data.spaces.find((s: any) => s.code === "LIBRARY");
    expect(library).toBeDefined();
    expect(library.name).toBe("Study Library");
  });

  test("Official rooms cannot be deleted", async () => {
    const official = await http.get(`${BACKEND_URL}/api/v1/space/official`);
    const library = official.data.spaces.find((s: any) => s.code === "LIBRARY");

    const response = await http.delete(
      `${BACKEND_URL}/api/v1/space/${library.id}`,
      authHeader(user.token),
    );
    expect(response.status).toBe(403);
  });
});
