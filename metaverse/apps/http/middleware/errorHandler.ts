import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors";
import { logger } from "../logger";
import { requestPath } from "./requestContext";

type StatusCarryingError = {
  status?: unknown;
  statusCode?: unknown;
  message?: unknown;
};

export type Classification = { status: number; message: string };

export const classifyError = (err: unknown): Classification => {
  if (err instanceof AppError) {
    return { status: err.status, message: err.message };
  }
  if (err instanceof ZodError) {
    return { status: 400, message: "Validation failed" };
  }

  const carrier = err as StatusCarryingError | null;
  const raw = carrier?.statusCode ?? carrier?.status;
  if (typeof raw === "number" && raw >= 400 && raw < 500) {
    return {
      status: raw,
      message: raw === 400 ? "Malformed request" : "Request rejected",
    };
  }

  return { status: 500, message: "Internal server error" };
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const { status, message } = classifyError(err);
  const log = req.log ?? logger;

  if (status >= 500) {
    log.error(
      { err, path: requestPath(req.originalUrl), method: req.method },
      "request failed",
    );
  } else {
    log.debug(
      {
        path: requestPath(req.originalUrl),
        method: req.method,
        status,
        reason: String(err),
      },
      "request rejected",
    );
  }

  if (res.headersSent) {
    res.destroy();
    return;
  }

  res.status(status).json({ message, requestId: req.id });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ message: "Not found", requestId: req.id });
};
