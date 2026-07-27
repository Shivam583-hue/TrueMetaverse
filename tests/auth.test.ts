import { BACKEND_URL, TEST_PASSWORD, http } from "./helpers";

describe("Authentication", () => {
  test("User is able to sign up only once", async () => {
    const username = "kirat" + Math.random();
    const password = TEST_PASSWORD;
    const response = await http.post(`${BACKEND_URL}/api/v1/signup`, {
      username,
      password,
    });

    expect(response.status).toBe(200);
    const updatedResponse = await http.post(`${BACKEND_URL}/api/v1/signup`, {
      username,
      password,
    });

    expect(updatedResponse.status).toBe(400);
  });

  test("Signup request fails if the username is empty", async () => {
    const response = await http.post(`${BACKEND_URL}/api/v1/signup`, {
      password: TEST_PASSWORD,
    });

    expect(response.status).toBe(400);
  });

  test("Signup rejects a password shorter than ten characters", async () => {
    const response = await http.post(`${BACKEND_URL}/api/v1/signup`, {
      username: `short-${Math.random()}`,
      password: "123456",
    });

    expect(response.status).toBe(400);
    expect(response.data.message).toContain("10 characters");
  });

  test("Signup rejects a well-known password", async () => {
    const response = await http.post(`${BACKEND_URL}/api/v1/signup`, {
      username: `common-${Math.random()}`,
      password: "password1234",
    });

    expect(response.status).toBe(400);
    expect(response.data.message).toContain("too common");
  });

  test("Signup rejects a password that matches the username", async () => {
    const username = `SameValue-${Math.random()}`;
    const response = await http.post(`${BACKEND_URL}/api/v1/signup`, {
      username,
      password: username.toLowerCase(),
    });

    expect(response.status).toBe(400);
    expect(response.data.message).toContain("username");
  });

  test("Signin succeeds if the username and password are correct", async () => {
    const username = `kirat-${Math.random()}`;
    const password = TEST_PASSWORD;

    await http.post(`${BACKEND_URL}/api/v1/signup`, { username, password });

    const response = await http.post(`${BACKEND_URL}/api/v1/signin`, {
      username,
      password,
    });

    expect(response.status).toBe(200);
    expect(response.data.token).toBeDefined();
  });

  test("An unknown username and a wrong password fail identically", async () => {
    const username = `kirat-${Math.random()}`;
    const password = TEST_PASSWORD;

    await http.post(`${BACKEND_URL}/api/v1/signup`, { username, password });

    const unknownUsername = await http.post(`${BACKEND_URL}/api/v1/signin`, {
      username: `no-such-user-${Math.random()}`,
      password,
    });
    const wrongPassword = await http.post(`${BACKEND_URL}/api/v1/signin`, {
      username,
      password: `${TEST_PASSWORD}-wrong`,
    });

    expect(unknownUsername.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknownUsername.data).toEqual(wrongPassword.data);
  });

  test("The seeded system account is not distinguishable from any other failure", async () => {
    const systemAccount = await http.post(`${BACKEND_URL}/api/v1/signin`, {
      username: "system",
      password: TEST_PASSWORD,
    });
    const unknownUsername = await http.post(`${BACKEND_URL}/api/v1/signin`, {
      username: `no-such-user-${Math.random()}`,
      password: TEST_PASSWORD,
    });

    expect(systemAccount.status).toBe(401);
    expect(systemAccount.data).toEqual(unknownUsername.data);
  });

  test("The issued token does not carry a role claim", async () => {
    const username = `claims-${Math.random()}`;
    await http.post(`${BACKEND_URL}/api/v1/signup`, {
      username,
      password: TEST_PASSWORD,
    });
    const response = await http.post(`${BACKEND_URL}/api/v1/signin`, {
      username,
      password: TEST_PASSWORD,
    });

    const claims = JSON.parse(
      Buffer.from(response.data.token.split(".")[1], "base64").toString(),
    );
    expect(claims.userId).toBeDefined();
    expect(claims.role).toBeUndefined();
  });
});
