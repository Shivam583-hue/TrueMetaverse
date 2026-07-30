import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../logger";

export const REQUEST_ID_HEADER = "x-request-id";

const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID = /^[A-Za-z0-9_.:-]+$/;

const SILENT_PATHS = new Set(["/healthz"]);

export const resolveRequestId = (
  header: string | string[] | undefined,
  generate: () => string = randomUUID,
): string => {
  const candidate = Array.isArray(header) ? header[0] : header;
  if (
    candidate !== undefined &&
    candidate.length > 0 &&
    candidate.length <= MAX_REQUEST_ID_LENGTH &&
    SAFE_REQUEST_ID.test(candidate)
  ) {
    return candidate;
  }
  return generate();
};

export const levelForStatus = (status: number): "error" | "warn" | "info" => {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
};

export const requestPath = (originalUrl: string | undefined): string =>
  (originalUrl ?? "").split("?")[0] ?? "";

export const routeTemplate = (req: Request): string => {
  const suffix = req.route?.path;
  if (typeof suffix !== "string") return req.path;
  return `${req.baseUrl}${suffix === "/" ? "" : suffix}` || "/";
};

export const requestContext = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
  req.id = requestId;
  req.log = logger.child({ requestId });
  res.setHeader("X-Request-Id", requestId);

  if (SILENT_PATHS.has(req.path)) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  res.on("close", () => {
    const elapsedNs = process.hrtime.bigint() - startedAt;
    const durationMs = Math.round(Number(elapsedNs) / 1e4) / 100;
    const level = levelForStatus(res.statusCode);
    req.log[level](
      {
        method: req.method,
        path: requestPath(req.originalUrl),
        route: routeTemplate(req),
        status: res.statusCode,
        durationMs,
        userId: req.userId,
        aborted: res.writableFinished ? undefined : true,
      },
      "request completed",
    );
  });

  next();
};
