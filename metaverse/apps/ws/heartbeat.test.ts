import { afterEach, describe, expect, test } from "bun:test";
import {
  createHeartbeat,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  resolveHeartbeatInterval,
  type Heartbeat,
} from "./heartbeat";

type FakeClient = { pings: number; terminated: boolean };

const started: Heartbeat<any>[] = [];

function fakeClient(): FakeClient & { ping(): void; terminate(): void } {
  return {
    pings: 0,
    terminated: false,
    ping() {
      this.pings += 1;
    },
    terminate() {
      this.terminated = true;
    },
  };
}

function heartbeatOver(clients: ReturnType<typeof fakeClient>[]) {
  const heartbeat = createHeartbeat({ clients }, 60_000);
  started.push(heartbeat);
  return heartbeat;
}

afterEach(() => {
  for (const heartbeat of started.splice(0)) heartbeat.stop();
});

describe("resolveHeartbeatInterval", () => {
  test("An unset value falls back to the default", () => {
    expect(resolveHeartbeatInterval(undefined)).toBe(
      DEFAULT_HEARTBEAT_INTERVAL_MS,
    );
  });

  test("A valid integer is honoured", () => {
    expect(resolveHeartbeatInterval("5000")).toBe(5000);
  });

  test("Garbage, fractions and sub-100ms values fall back", () => {
    expect(resolveHeartbeatInterval("soon")).toBe(
      DEFAULT_HEARTBEAT_INTERVAL_MS,
    );
    expect(resolveHeartbeatInterval("1500.5")).toBe(
      DEFAULT_HEARTBEAT_INTERVAL_MS,
    );
    expect(resolveHeartbeatInterval("99")).toBe(DEFAULT_HEARTBEAT_INTERVAL_MS);
    expect(resolveHeartbeatInterval("-1000")).toBe(
      DEFAULT_HEARTBEAT_INTERVAL_MS,
    );
  });
});

describe("createHeartbeat", () => {
  test("A client that answers every ping is never terminated", () => {
    const client = fakeClient();
    const heartbeat = heartbeatOver([client]);
    heartbeat.markAlive(client);

    for (let round = 0; round < 5; round += 1) {
      expect(heartbeat.sweep()).toEqual([]);
      heartbeat.markAlive(client);
    }

    expect(client.terminated).toBe(false);
    expect(client.pings).toBe(5);
  });

  test("A client that misses one pong is terminated on the next sweep", () => {
    const client = fakeClient();
    const heartbeat = heartbeatOver([client]);
    heartbeat.markAlive(client);

    expect(heartbeat.sweep()).toEqual([]);
    expect(client.terminated).toBe(false);

    expect(heartbeat.sweep()).toEqual([client]);
    expect(client.terminated).toBe(true);
  });

  test("A silent client is terminated without being pinged again", () => {
    const client = fakeClient();
    const heartbeat = heartbeatOver([client]);

    heartbeat.sweep();

    expect(client.terminated).toBe(true);
    expect(client.pings).toBe(0);
  });

  test("A live client survives a sweep that reaps a dead one", () => {
    const live = fakeClient();
    const dead = fakeClient();
    const heartbeat = heartbeatOver([live, dead]);
    heartbeat.markAlive(live);

    expect(heartbeat.sweep()).toEqual([dead]);
    expect(dead.terminated).toBe(true);
    expect(live.terminated).toBe(false);
    expect(live.pings).toBe(1);
  });

  test("A stopped heartbeat runs no further sweeps", async () => {
    const client = fakeClient();
    const heartbeat = createHeartbeat({ clients: [client] }, 100);
    heartbeat.stop();

    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(client.terminated).toBe(false);
  });
});
