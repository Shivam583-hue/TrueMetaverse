import jwt from "jsonwebtoken";
import { JWT_ALGORITHM, JWT_PASSWORD } from "../config";
import type { NextFunction, Request, Response } from "express";

export const userMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const header = req.headers["authorization"];
  const token = header?.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_PASSWORD, {
      algorithms: [JWT_ALGORITHM],
    }) as {
      userId: string;
    };
    req.userId = decoded.userId;
    next();
  } catch (e) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
