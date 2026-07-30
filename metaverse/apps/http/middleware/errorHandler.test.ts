import { describe, expect, test } from "bun:test";
import type { NextFunction, Request, Response } from "express";
import z from "zod";
import { AppError } from "../errors";
import { classifyError, errorHandler, notFoundHandler } from "./errorHandler";

const zodError = () => {
  const parsed = z.object({ name: z.string() }).safeParse({ name: 1 });
  if (parsed.success) throw new Error("expected the fixture to fail parsing");
  return parsed.error;
};

type Outcome = {
  status?: number;
  body?: { message?: string; requestId?: string };
  destroyed: boolean;
  logged: { level: string; message: string }[];
};

const run = (err: unknown, headersSent = false) => {
  const outcome: Outcome = { destroyed: false, logged: [] };
  const record = (level: string) => (_fields: unknown, message?: string) => {
    outcome.logged.push({
      level,
      message: typeof _fields === "string" ? _fields : (message ?? ""),
    });
  };

  const req = {
    id: "req-1",
    originalUrl: "/api/v1/space?draft=1",
    path: "/",
    method: "POST",
    log: { error: record("error"), debug: record("debug") },
  } as unknown as Request;

  const res = {
    headersSent,
    status(code: number) {
      outcome.status = code;
      return res;
    },
    json(body: unknown) {
      outcome.body = body as Outcome["body"];
      return res;
    },
    destroy() {
      outcome.destroyed = true;
    },
  } as unknown as Response;

  errorHandler(err, req, res, (() => {}) as NextFunction);
  return outcome;
};

describe("classifyError", () => {
  test("passes an AppError through untouched", () => {
    expect(classifyError(new AppError(403, "Not your session"))).toEqual({
      status: 403,
      message: "Not your session",
    });
  });

  test("maps a ZodError to a generic validation failure", () => {
    expect(classifyError(zodError())).toEqual({
      status: 400,
      message: "Validation failed",
    });
  });

  test("honours a 4xx from body-parser style errors", () => {
    const malformed = Object.assign(new SyntaxError("Unexpected token"), {
      status: 400,
      type: "entity.parse.failed",
    });
    expect(classifyError(malformed)).toEqual({
      status: 400,
      message: "Malformed request",
    });

    const tooLarge = Object.assign(new Error("too big"), { statusCode: 413 });
    expect(classifyError(tooLarge)).toEqual({
      status: 413,
      message: "Request rejected",
    });
  });

  test("treats anything else as an internal error", () => {
    expect(classifyError(new Error("connect ECONNREFUSED"))).toEqual({
      status: 500,
      message: "Internal server error",
    });
    expect(classifyError(undefined)).toEqual({
      status: 500,
      message: "Internal server error",
    });
    expect(classifyError({ status: 500 })).toEqual({
      status: 500,
      message: "Internal server error",
    });
    expect(classifyError({ status: 302 })).toEqual({
      status: 500,
      message: "Internal server error",
    });
  });
});

describe("errorHandler", () => {
  test("never leaks an internal message and always returns the request id", () => {
    const outcome = run(new Error("password=hunter2 at db.internal:5432"));
    expect(outcome.status).toBe(500);
    expect(outcome.body).toEqual({
      message: "Internal server error",
      requestId: "req-1",
    });
    expect(JSON.stringify(outcome.body)).not.toContain("hunter2");
  });

  test("logs server errors at error level and client errors at debug", () => {
    expect(run(new Error("boom")).logged).toEqual([
      { level: "error", message: "request failed" },
    ]);
    expect(run(new AppError(403, "Not your session")).logged).toEqual([
      { level: "debug", message: "request rejected" },
    ]);
  });

  test("surfaces a client-safe message for 4xx", () => {
    const outcome = run(new AppError(409, "Someone else is presenting"));
    expect(outcome.status).toBe(409);
    expect(outcome.body?.message).toBe("Someone else is presenting");
  });

  test("destroys the response instead of double-sending headers", () => {
    const outcome = run(new Error("late failure"), true);
    expect(outcome.destroyed).toBe(true);
    expect(outcome.status).toBeUndefined();
    expect(outcome.logged).toHaveLength(1);
  });
});

describe("notFoundHandler", () => {
  test("answers unmatched routes as json carrying the request id", () => {
    let status: number | undefined;
    let body: unknown;
    const res = {
      status(code: number) {
        status = code;
        return res;
      },
      json(payload: unknown) {
        body = payload;
        return res;
      },
    } as unknown as Response;

    notFoundHandler({ id: "req-2" } as unknown as Request, res);
    expect(status).toBe(404);
    expect(body).toEqual({ message: "Not found", requestId: "req-2" });
  });
});
