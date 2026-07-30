import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createLogger } from "@repo/logger";
import { Prisma, PrismaClient } from "./generated/prisma/client";

const logger = createLogger({ service: "db" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on("error", (err) => {
  logger.error({ err }, "idle postgres client errored, pool will replace it");
});

const adapter = new PrismaPg(pool);

const client = new PrismaClient({ adapter });

let disconnected = false;

export const disconnect = async (): Promise<void> => {
  if (disconnected) return;
  disconnected = true;
  await client.$disconnect();
};

const hasPrismaCode = (error: unknown, code: string): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

export const isUniqueConstraintViolation = (error: unknown): boolean =>
  hasPrismaCode(error, "P2002");

export const isForeignKeyViolation = (error: unknown): boolean =>
  hasPrismaCode(error, "P2003");

export const isRecordNotFound = (error: unknown): boolean =>
  hasPrismaCode(error, "P2025");

export default client;
