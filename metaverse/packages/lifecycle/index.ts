import type { Logger } from "@repo/logger";

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;
export const DEFAULT_STEP_TIMEOUT_MS = 3_000;

export type ShutdownStep = {
  name: string;
  run: () => Promise<void> | void;
};

export type ProcessLike = {
  on(event: string, handler: (...args: never[]) => void): unknown;
  exit(code: number): unknown;
};

export type LifecycleOptions = {
  logger: Logger;
  steps: ShutdownStep[];
  timeoutMs?: number;
  stepTimeoutMs?: number;
  proc?: ProcessLike;
};

const runStep = async (
  step: ShutdownStep,
  stepTimeoutMs: number,
): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outcome = await Promise.race([
      Promise.resolve(step.run()).then(() => "finished" as const),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), stepTimeoutMs);
      }),
    ]);
    return outcome === "finished";
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

export type Lifecycle = {
  shutdown(reason: string, code: number): Promise<void>;
};

export const installLifecycle = ({
  logger,
  steps,
  timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
  stepTimeoutMs = DEFAULT_STEP_TIMEOUT_MS,
  proc = process as unknown as ProcessLike,
}: LifecycleOptions): Lifecycle => {
  let running = false;

  const shutdown = async (reason: string, code: number): Promise<void> => {
    if (running) return;
    running = true;
    logger.info({ reason }, "shutdown started");

    const timer = setTimeout(() => {
      logger.error(
        { reason, timeoutMs },
        "shutdown timed out, exiting without finishing",
      );
      proc.exit(code === 0 ? 1 : code);
    }, timeoutMs);

    for (const step of steps) {
      try {
        if (await runStep(step, stepTimeoutMs)) {
          logger.debug({ step: step.name }, "shutdown step finished");
        } else {
          logger.warn(
            { step: step.name, stepTimeoutMs },
            "shutdown step did not finish in time, moving on",
          );
        }
      } catch (err) {
        logger.error({ err, step: step.name }, "shutdown step failed");
      }
    }

    clearTimeout(timer);
    logger.info({ reason, code }, "shutdown complete");
    proc.exit(code);
  };

  const onSignal = (signal: string) => () => {
    void shutdown(signal, 0);
  };

  proc.on("SIGTERM", onSignal("SIGTERM") as (...args: never[]) => void);
  proc.on("SIGINT", onSignal("SIGINT") as (...args: never[]) => void);

  proc.on("uncaughtException", ((err: unknown) => {
    logger.fatal({ err }, "uncaught exception, process state is unreliable");
    void shutdown("uncaughtException", 1);
  }) as (...args: never[]) => void);

  proc.on("unhandledRejection", ((reason: unknown) => {
    logger.fatal({ err: reason }, "unhandled rejection");
    void shutdown("unhandledRejection", 1);
  }) as (...args: never[]) => void);

  return { shutdown };
};
