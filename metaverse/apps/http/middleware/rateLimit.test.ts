import { afterEach, describe, expect, test } from "bun:test";
import express from "express";
import type { Server } from "node:http";
import {
  DEFAULT_AUTH_LIMIT,
  createRateLimiter,
  resolveAuthLimit,
} from "./rateLimit";

let server: Server | undefined;

const listen = async (app: express.Express): Promise<string> => {
  server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });
  const { port } = server.address() as { port: number };
  return `http://127.0.0.1:${port}`;
};

afterEach(() => {
  server?.close();
  server = undefined;
});

describe("createRateLimiter", () => {
  test("rejects with 429 once the limit is exceeded", async () => {
    const app = express();
    app.use(createRateLimiter({ windowMs: 60_000, limit: 3 }));
    app.get("/", (_req, res) => {
      res.json({ ok: true });
    });
    const base = await listen(app);

    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await fetch(base)).status);
    }

    expect(statuses).toEqual([200, 200, 200, 429]);

    const limited = await fetch(base);
    expect(await limited.json()).toEqual({
      message: "Too many requests, please try again later",
    });
  });

  test("skipSuccessfulRequests only counts failed responses", async () => {
    const app = express();
    app.use(
      createRateLimiter({
        windowMs: 60_000,
        limit: 2,
        skipSuccessfulRequests: true,
      }),
    );
    app.get("/ok", (_req, res) => {
      res.json({ ok: true });
    });
    app.get("/fail", (_req, res) => {
      res.status(401).json({ message: "Unauthorized" });
    });
    const base = await listen(app);

    for (let i = 0; i < 6; i++) {
      expect((await fetch(`${base}/ok`)).status).toBe(200);
    }

    expect((await fetch(`${base}/fail`)).status).toBe(401);
    expect((await fetch(`${base}/fail`)).status).toBe(401);
    expect((await fetch(`${base}/fail`)).status).toBe(429);
  });
});

describe("resolveAuthLimit", () => {
  test("uses the strict default when the override is unset", () => {
    expect(resolveAuthLimit(undefined)).toBe(DEFAULT_AUTH_LIMIT);
    expect(DEFAULT_AUTH_LIMIT).toBe(10);
  });

  test("honours a positive integer override", () => {
    expect(resolveAuthLimit("100000")).toBe(100000);
    expect(resolveAuthLimit("1")).toBe(1);
  });

  test("falls back to the default rather than disabling the guard", () => {
    for (const raw of ["", "0", "-5", "abc", "10.5", "1e3x", "NaN", " "]) {
      expect(resolveAuthLimit(raw)).toBe(DEFAULT_AUTH_LIMIT);
    }
  });
});
