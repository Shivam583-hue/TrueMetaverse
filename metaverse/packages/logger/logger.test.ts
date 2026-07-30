import { describe, expect, it } from "bun:test";
import {
  DEFAULT_DEVELOPMENT_LOG_LEVEL,
  DEFAULT_LOG_LEVEL,
  createLogger,
  resolveLogLevel,
  type LogSink,
} from "./index";

const collect = () => {
  const lines: string[] = [];
  const sink: LogSink = {
    write(line) {
      lines.push(line);
    },
  };
  return {
    sink,
    records: () => lines.map((line) => JSON.parse(line)),
  };
};

describe("resolveLogLevel", () => {
  it("defaults to info in production and debug elsewhere", () => {
    expect(resolveLogLevel(undefined, "production")).toBe(DEFAULT_LOG_LEVEL);
    expect(resolveLogLevel(undefined, "development")).toBe(
      DEFAULT_DEVELOPMENT_LOG_LEVEL,
    );
    expect(resolveLogLevel(undefined, undefined)).toBe(
      DEFAULT_DEVELOPMENT_LOG_LEVEL,
    );
  });

  it("accepts every level pino understands, case and space insensitively", () => {
    expect(resolveLogLevel("warn", "production")).toBe("warn");
    expect(resolveLogLevel("  ERROR ", "production")).toBe("error");
    expect(resolveLogLevel("silent", "production")).toBe("silent");
    expect(resolveLogLevel("trace", "production")).toBe("trace");
  });

  it("falls back rather than throwing on an unusable override", () => {
    expect(resolveLogLevel("verbose", "production")).toBe(DEFAULT_LOG_LEVEL);
    expect(resolveLogLevel("", "production")).toBe(DEFAULT_LOG_LEVEL);
    expect(resolveLogLevel("9", "development")).toBe(
      DEFAULT_DEVELOPMENT_LOG_LEVEL,
    );
  });
});

describe("createLogger", () => {
  it("tags every record with the service name and a readable level", () => {
    const { sink, records } = collect();
    createLogger({ service: "http", level: "info", destination: sink }).info(
      "listening",
    );

    const [record] = records();
    expect(record.service).toBe("http");
    expect(record.level).toBe("info");
    expect(record.msg).toBe("listening");
    expect(typeof record.time).toBe("string");
  });

  it("redacts credentials at the top level and one level deep", () => {
    const { sink, records } = collect();
    const logger = createLogger({
      service: "http",
      level: "info",
      destination: sink,
    });

    logger.info(
      {
        token: "header.body.signature",
        password: "correct horse battery staple",
        payload: { token: "join-token", spaceId: "space-1" },
        req: { headers: { authorization: "Bearer abc", cookie: "a=b" } },
      },
      "join attempt",
    );

    const [record] = records();
    expect(record.token).toBe("[redacted]");
    expect(record.password).toBe("[redacted]");
    expect(record.payload.token).toBe("[redacted]");
    expect(record.req.headers.authorization).toBe("[redacted]");
    expect(record.req.headers.cookie).toBe("[redacted]");
    expect(JSON.stringify(record)).not.toContain("header.body.signature");
    expect(JSON.stringify(record)).not.toContain("correct horse");
    expect(JSON.stringify(record)).not.toContain("join-token");
    expect(record.payload.spaceId).toBe("space-1");
  });

  it("serialises errors with their message and stack", () => {
    const { sink, records } = collect();
    createLogger({ service: "ws", level: "info", destination: sink }).error(
      { err: new Error("boom") },
      "handler failed",
    );

    const [record] = records();
    expect(record.err.message).toBe("boom");
    expect(record.err.stack).toContain("boom");
  });

  it("honours the level threshold", () => {
    const { sink, records } = collect();
    const logger = createLogger({
      service: "http",
      level: "warn",
      destination: sink,
    });

    logger.debug("dropped");
    logger.info("dropped");
    logger.warn("kept");

    expect(records().map((r) => r.msg)).toEqual(["kept"]);
  });

  it("reads LOG_LEVEL from the supplied environment", () => {
    const { sink, records } = collect();
    const logger = createLogger({
      service: "http",
      env: { LOG_LEVEL: "error", NODE_ENV: "production" },
      destination: sink,
    });

    logger.warn("dropped");
    logger.error("kept");

    expect(records().map((r) => r.msg)).toEqual(["kept"]);
  });
});
