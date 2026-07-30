import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "./generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const client = new PrismaClient({ adapter });

const hasPrismaCode = (error: unknown, code: string): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

export const isUniqueConstraintViolation = (error: unknown): boolean =>
  hasPrismaCode(error, "P2002");

export const isForeignKeyViolation = (error: unknown): boolean =>
  hasPrismaCode(error, "P2003");

export const isRecordNotFound = (error: unknown): boolean =>
  hasPrismaCode(error, "P2025");

export default client;
