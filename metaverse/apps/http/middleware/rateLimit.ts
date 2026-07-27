import rateLimit, { type Options } from "express-rate-limit";

const MINUTE = 60_000;

export const DEFAULT_AUTH_LIMIT = 10;

export const resolveAuthLimit = (
  raw: string | undefined,
  fallback = DEFAULT_AUTH_LIMIT,
): number => {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
};

export const createRateLimiter = (options: Partial<Options>) =>
  rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later" },
    ...options,
  });

export const apiLimiter = createRateLimiter({
  windowMs: MINUTE,
  limit: 1000,
});

export const authLimiter = createRateLimiter({
  windowMs: 15 * MINUTE,
  limit: resolveAuthLimit(process.env.AUTH_RATE_LIMIT_MAX),
  skipSuccessfulRequests: true,
});

export const roomCodeLimiter = createRateLimiter({
  windowMs: MINUTE,
  limit: 30,
});
