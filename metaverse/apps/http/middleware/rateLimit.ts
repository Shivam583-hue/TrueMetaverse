import rateLimit, { type Options } from "express-rate-limit";

const MINUTE = 60_000;

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
  limit: 10,
  skipSuccessfulRequests: true,
});

export const roomCodeLimiter = createRateLimiter({
  windowMs: MINUTE,
  limit: 30,
});
