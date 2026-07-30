import pino, { type Logger } from "pino";

export type { Logger };

export const DEFAULT_LOG_LEVEL = "info";
export const DEFAULT_DEVELOPMENT_LOG_LEVEL = "debug";

const VALID_LEVELS = new Set([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);

export const resolveLogLevel = (
  raw: string | undefined,
  nodeEnv: string | undefined,
): string => {
  const fallback =
    nodeEnv === "production"
      ? DEFAULT_LOG_LEVEL
      : DEFAULT_DEVELOPMENT_LOG_LEVEL;
  if (raw === undefined) return fallback;
  const normalized = raw.trim().toLowerCase();
  return VALID_LEVELS.has(normalized) ? normalized : fallback;
};

export const REDACT_PATHS = [
  "password",
  "token",
  "authorization",
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.token",
  "*.authorization",
];

export type LogSink = { write(line: string): void };

export type CreateLoggerOptions = {
  service: string;
  level?: string;
  env?: NodeJS.ProcessEnv;
  destination?: LogSink;
};

export const createLogger = (options: CreateLoggerOptions): Logger => {
  const env = options.env ?? process.env;
  const level = options.level ?? resolveLogLevel(env.LOG_LEVEL, env.NODE_ENV);

  return pino(
    {
      level,
      base: { service: options.service },
      redact: { paths: REDACT_PATHS, censor: "[redacted]" },
      formatters: { level: (label) => ({ level: label }) },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    options.destination ?? pino.destination({ dest: 1, sync: true }),
  );
};
