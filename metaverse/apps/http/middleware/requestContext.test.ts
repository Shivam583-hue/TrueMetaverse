import { describe, expect, test } from "bun:test";
import type { Request } from "express";
import {
  levelForStatus,
  requestPath,
  resolveRequestId,
  routeTemplate,
} from "./requestContext";

const generated = () => "generated-id";

describe("resolveRequestId", () => {
  test("keeps a well formed inbound id", () => {
    expect(resolveRequestId("abc123", generated)).toBe("abc123");
    expect(resolveRequestId("a.b:c-d_e", generated)).toBe("a.b:c-d_e");
  });

  test("uses the first value when the header repeats", () => {
    expect(resolveRequestId(["first", "second"], generated)).toBe("first");
  });

  test("generates one when the header is absent or empty", () => {
    expect(resolveRequestId(undefined, generated)).toBe("generated-id");
    expect(resolveRequestId("", generated)).toBe("generated-id");
    expect(resolveRequestId([], generated)).toBe("generated-id");
  });

  test("rejects ids that could corrupt a log line or a response header", () => {
    expect(resolveRequestId("has space", generated)).toBe("generated-id");
    expect(resolveRequestId("line\nbreak", generated)).toBe("generated-id");
    expect(resolveRequestId("carriage\rreturn", generated)).toBe(
      "generated-id",
    );
    expect(resolveRequestId('quote"inside', generated)).toBe("generated-id");
  });

  test("rejects an unbounded id", () => {
    expect(resolveRequestId("a".repeat(128), generated)).toBe("a".repeat(128));
    expect(resolveRequestId("a".repeat(129), generated)).toBe("generated-id");
  });

  test("produces a distinct id per call by default", () => {
    expect(resolveRequestId(undefined)).not.toBe(resolveRequestId(undefined));
  });
});

describe("levelForStatus", () => {
  test("maps server errors to error, client errors to warn, rest to info", () => {
    expect(levelForStatus(500)).toBe("error");
    expect(levelForStatus(503)).toBe("error");
    expect(levelForStatus(400)).toBe("warn");
    expect(levelForStatus(429)).toBe("warn");
    expect(levelForStatus(200)).toBe("info");
    expect(levelForStatus(304)).toBe("info");
  });
});

describe("requestPath", () => {
  test("keeps the full path and drops the query string", () => {
    expect(requestPath("/api/v1/space/all")).toBe("/api/v1/space/all");
    expect(requestPath("/api/v1/user/metadata/bulk?ids=a,b")).toBe(
      "/api/v1/user/metadata/bulk",
    );
    expect(requestPath("/api/v1/study/leaderboard?period=weekly&x=1")).toBe(
      "/api/v1/study/leaderboard",
    );
  });

  test("tolerates a missing url so the error handler cannot itself throw", () => {
    expect(requestPath(undefined)).toBe("");
    expect(requestPath("")).toBe("");
  });
});

describe("routeTemplate", () => {
  const req = (parts: Partial<Request>) => parts as Request;

  test("joins the mount path with the route pattern", () => {
    expect(
      routeTemplate(
        req({
          baseUrl: "/api/v1/space",
          path: "/clx123",
          route: { path: "/:spaceId" },
        } as Partial<Request>),
      ),
    ).toBe("/api/v1/space/:spaceId");
  });

  test("does not leave a trailing slash for a root route", () => {
    expect(
      routeTemplate(
        req({
          baseUrl: "/api/v1/space",
          path: "/",
          route: { path: "/" },
        } as Partial<Request>),
      ),
    ).toBe("/api/v1/space");
  });

  test("falls back to the raw path when no route matched", () => {
    expect(routeTemplate(req({ baseUrl: "", path: "/nope" }))).toBe("/nope");
  });
});
