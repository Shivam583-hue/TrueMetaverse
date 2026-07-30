import { describe, expect, test } from "bun:test";
import { createLogger, type LogSink } from "@repo/logger";
import { installLifecycle, type ProcessLike, type ShutdownStep } from "./index";

type Harness = {
  proc: ProcessLike;
  handlers: Map<string, (arg?: unknown) => void>;
  exits: number[];
  records: () => Record<string, unknown>[];
  logger: ReturnType<typeof createLogger>;
};

const harness = (): Harness => {
  const handlers = new Map<string, (arg?: unknown) => void>();
  const exits: number[] = [];
  const lines: string[] = [];
  const sink: LogSink = {
    write(line) {
      lines.push(line);
    },
  };

  return {
    handlers,
    exits,
    logger: createLogger({
      service: "test",
      level: "debug",
      destination: sink,
    }),
    records: () => lines.map((line) => JSON.parse(line)),
    proc: {
      on(event: string, handler: (...args: never[]) => void) {
        handlers.set(event, handler as (arg?: unknown) => void);
        return this;
      },
      exit(code: number) {
        exits.push(code);
        return undefined;
      },
    },
  };
};

const step = (name: string, order: string[]): ShutdownStep => ({
  name,
  run: () => {
    order.push(name);
  },
});

describe("installLifecycle", () => {
  test("subscribes to signals and both crash events", () => {
    const h = harness();
    installLifecycle({ logger: h.logger, steps: [], proc: h.proc });

    expect([...h.handlers.keys()].sort()).toEqual([
      "SIGINT",
      "SIGTERM",
      "uncaughtException",
      "unhandledRejection",
    ]);
  });

  test("runs steps in order and exits zero on SIGTERM", async () => {
    const h = harness();
    const order: string[] = [];
    installLifecycle({
      logger: h.logger,
      steps: [step("sockets", order), step("server", order), step("db", order)],
      proc: h.proc,
    });

    h.handlers.get("SIGTERM")!();
    await Bun.sleep(5);

    expect(order).toEqual(["sockets", "server", "db"]);
    expect(h.exits).toEqual([0]);
  });

  test("exits non-zero and logs fatal on an uncaught exception", async () => {
    const h = harness();
    const order: string[] = [];
    installLifecycle({
      logger: h.logger,
      steps: [step("db", order)],
      proc: h.proc,
    });

    h.handlers.get("uncaughtException")!(new Error("boom"));
    await Bun.sleep(5);

    expect(order).toEqual(["db"]);
    expect(h.exits).toEqual([1]);
    const fatal = h.records().find((r) => r.level === "fatal");
    expect(fatal?.msg).toBe("uncaught exception, process state is unreliable");
    expect((fatal?.err as { message: string }).message).toBe("boom");
  });

  test("exits non-zero and logs fatal on an unhandled rejection", async () => {
    const h = harness();
    installLifecycle({ logger: h.logger, steps: [], proc: h.proc });

    h.handlers.get("unhandledRejection")!(new Error("nope"));
    await Bun.sleep(5);

    expect(h.exits).toEqual([1]);
    expect(h.records().find((r) => r.level === "fatal")?.msg).toBe(
      "unhandled rejection",
    );
  });

  test("ignores a second signal while a shutdown is already running", async () => {
    const h = harness();
    const order: string[] = [];
    installLifecycle({
      logger: h.logger,
      steps: [step("db", order)],
      proc: h.proc,
    });

    h.handlers.get("SIGTERM")!();
    h.handlers.get("SIGINT")!();
    h.handlers.get("SIGTERM")!();
    await Bun.sleep(5);

    expect(order).toEqual(["db"]);
    expect(h.exits).toEqual([0]);
  });

  test("keeps going when a step throws and still exits", async () => {
    const h = harness();
    const order: string[] = [];
    installLifecycle({
      logger: h.logger,
      steps: [
        {
          name: "flaky",
          run: () => {
            throw new Error("close failed");
          },
        },
        step("db", order),
      ],
      proc: h.proc,
    });

    h.handlers.get("SIGTERM")!();
    await Bun.sleep(5);

    expect(order).toEqual(["db"]);
    expect(h.exits).toEqual([0]);
    const failure = h.records().find((r) => r.msg === "shutdown step failed");
    expect(failure?.step).toBe("flaky");
  });

  test("abandons a stuck step so later steps still run", async () => {
    const h = harness();
    const order: string[] = [];
    installLifecycle({
      logger: h.logger,
      timeoutMs: 5_000,
      stepTimeoutMs: 10,
      steps: [
        { name: "stuck", run: () => new Promise<void>(() => {}) },
        step("db", order),
      ],
      proc: h.proc,
    });

    h.handlers.get("SIGTERM")!();
    await Bun.sleep(60);

    expect(order).toEqual(["db"]);
    expect(h.exits).toEqual([0]);
    const abandoned = h
      .records()
      .find((r) => r.msg === "shutdown step did not finish in time, moving on");
    expect(abandoned?.step).toBe("stuck");
  });

  test("forces an exit when the whole shutdown outruns its budget", async () => {
    const h = harness();
    installLifecycle({
      logger: h.logger,
      timeoutMs: 10,
      stepTimeoutMs: 5_000,
      steps: [{ name: "hangs", run: () => new Promise<void>(() => {}) }],
      proc: h.proc,
    });

    h.handlers.get("SIGTERM")!();
    await Bun.sleep(60);

    expect(h.exits).toEqual([1]);
    expect(
      h
        .records()
        .some((r) => r.msg === "shutdown timed out, exiting without finishing"),
    ).toBe(true);
  });
});
