import { BACKEND_URL, authHeader, http, makeUser, type TestUser } from "./helpers";

describe("Study timer", () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await makeUser("scholar");
  });

  test("Stopping without a running timer returns 400", async () => {
    const response = await http.post(
      `${BACKEND_URL}/api/v1/study/stop`,
      {},
      authHeader(user.token),
    );
    expect(response.status).toBe(400);
  });

  test("Timer requires auth", async () => {
    const response = await http.post(`${BACKEND_URL}/api/v1/study/start`, {});
    expect(response.status).toBe(403);
  });

  test("Start, run, stop records a session with a duration", async () => {
    const startResponse = await http.post(
      `${BACKEND_URL}/api/v1/study/start`,
      {},
      authHeader(user.token),
    );
    expect(startResponse.status).toBe(200);
    expect(startResponse.data.startedAt).toBeDefined();

    const meResponse = await http.get(
      `${BACKEND_URL}/api/v1/study/me`,
      authHeader(user.token),
    );
    expect(meResponse.data.activeSession).not.toBeNull();

    await new Promise((r) => setTimeout(r, 1200));

    const stopResponse = await http.post(
      `${BACKEND_URL}/api/v1/study/stop`,
      {},
      authHeader(user.token),
    );
    expect(stopResponse.status).toBe(200);
    expect(stopResponse.data.durationSeconds).toBeGreaterThanOrEqual(1);

    const meAfter = await http.get(
      `${BACKEND_URL}/api/v1/study/me`,
      authHeader(user.token),
    );
    expect(meAfter.data.activeSession).toBeNull();
  });

  test("Starting a new timer discards a dangling open session", async () => {
    await http.post(
      `${BACKEND_URL}/api/v1/study/start`,
      {},
      authHeader(user.token),
    );
    await http.post(
      `${BACKEND_URL}/api/v1/study/start`,
      {},
      authHeader(user.token),
    );

    const stopResponse = await http.post(
      `${BACKEND_URL}/api/v1/study/stop`,
      {},
      authHeader(user.token),
    );
    expect(stopResponse.status).toBe(200);

    const secondStop = await http.post(
      `${BACKEND_URL}/api/v1/study/stop`,
      {},
      authHeader(user.token),
    );
    expect(secondStop.status).toBe(400);
  });

  test("Leaderboard ranks the user for every period", async () => {
    for (const period of ["all", "daily", "weekly", "monthly"]) {
      const response = await http.get(
        `${BACKEND_URL}/api/v1/study/leaderboard?period=${period}`,
      );
      expect(response.status).toBe(200);
      expect(response.data.period).toBe(period);
      const entries = response.data.entries;
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.length).toBeLessThanOrEqual(10);
      for (let i = 0; i < entries.length; i++) {
        expect(entries[i].rank).toBe(i + 1);
        if (i > 0) {
          expect(entries[i].totalSeconds).toBeLessThanOrEqual(
            entries[i - 1].totalSeconds,
          );
        }
      }
      const mine = entries.find((e: any) => e.userId === user.userId);
      if (mine) {
        expect(mine.username).toBe(user.username);
        expect(mine.totalSeconds).toBeGreaterThanOrEqual(1);
      } else {
        expect(entries.length).toBe(10);
        expect(entries[9].totalSeconds).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test("Leaderboard rejects an unknown period", async () => {
    const response = await http.get(
      `${BACKEND_URL}/api/v1/study/leaderboard?period=yearly`,
    );
    expect(response.status).toBe(400);
  });
});
