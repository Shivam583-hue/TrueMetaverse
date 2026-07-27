import { describe, expect, test } from "bun:test";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { userMiddleware } from "./user";
import { JWT_PASSWORD } from "../config";

type Outcome = {
  status?: number;
  body?: unknown;
  nextCalled: boolean;
  userId?: string;
};

const run = (authorization?: string): Outcome => {
  const req = { headers: { authorization } } as unknown as Request;
  const outcome: Outcome = { nextCalled: false };
  const res = {
    status(code: number) {
      outcome.status = code;
      return res;
    },
    json(body: unknown) {
      outcome.body = body;
      return res;
    },
  } as unknown as Response;

  userMiddleware(req, res, (() => {
    outcome.nextCalled = true;
  }) as NextFunction);

  outcome.userId = (req as Request).userId;
  return outcome;
};

const signValid = () =>
  jwt.sign({ userId: "user-1" }, JWT_PASSWORD, {
    expiresIn: "7d",
    algorithm: "HS256",
  });

describe("userMiddleware", () => {
  test("accepts a valid token and exposes the user id", () => {
    const outcome = run(`Bearer ${signValid()}`);
    expect(outcome.nextCalled).toBe(true);
    expect(outcome.userId).toBe("user-1");
  });

  test("rejects a missing authorization header", () => {
    const outcome = run(undefined);
    expect(outcome.nextCalled).toBe(false);
    expect(outcome.status).toBe(401);
  });

  test("rejects a header with no token", () => {
    const outcome = run("Bearer");
    expect(outcome.nextCalled).toBe(false);
    expect(outcome.status).toBe(401);
  });

  test("rejects a token with a tampered signature", () => {
    const token = signValid();
    const [header, payload, signature] = token.split(".");
    const flipped = signature!.endsWith("A")
      ? `${signature!.slice(0, -1)}B`
      : `${signature!.slice(0, -1)}A`;

    const outcome = run(`Bearer ${header}.${payload}.${flipped}`);
    expect(outcome.nextCalled).toBe(false);
    expect(outcome.status).toBe(401);
  });

  test("rejects a token with a tampered payload", () => {
    const token = signValid();
    const [header, , signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ userId: "someone-else" }))
      .toString("base64url")
      .replace(/=+$/, "");

    const outcome = run(`Bearer ${header}.${forged}.${signature}`);
    expect(outcome.nextCalled).toBe(false);
    expect(outcome.status).toBe(401);
  });

  test("rejects an expired token", () => {
    const expired = jwt.sign({ userId: "user-1" }, JWT_PASSWORD, {
      algorithm: "HS256",
      expiresIn: "-1s",
    });

    const outcome = run(`Bearer ${expired}`);
    expect(outcome.nextCalled).toBe(false);
    expect(outcome.status).toBe(401);
  });

  test("rejects a token signed with an algorithm outside the allowlist", () => {
    const hs512 = jwt.sign({ userId: "user-1" }, JWT_PASSWORD, {
      algorithm: "HS512",
      expiresIn: "7d",
    });

    const outcome = run(`Bearer ${hs512}`);
    expect(outcome.nextCalled).toBe(false);
    expect(outcome.status).toBe(401);
  });

  test("rejects a token signed with a different secret", () => {
    const foreign = jwt.sign(
      { userId: "user-1" },
      "a-completely-other-secret",
      {
        algorithm: "HS256",
        expiresIn: "7d",
      },
    );

    const outcome = run(`Bearer ${foreign}`);
    expect(outcome.nextCalled).toBe(false);
    expect(outcome.status).toBe(401);
  });
});
