import z from "zod";
import { COMMON_PASSWORDS } from "../commonPasswords";

export const SignupSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(40, "Username must be at most 40 characters"),
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .max(128, "Password must be at most 128 characters"),
  })
  .refine((data) => !COMMON_PASSWORDS.has(data.password.toLowerCase()), {
    message: "Password is too common, pick something less guessable",
    path: ["password"],
  })
  .refine(
    (data) => data.password.toLowerCase() !== data.username.toLowerCase(),
    {
      message: "Password must not match the username",
      path: ["password"],
    },
  );

export const SigninSchema = z.object({
  username: z.string().max(40),
  password: z.string().max(128),
});

export const UpdateMetadataSchema = z.object({
  avatarId: z.string(),
});

export const WOKA_LAYER_KEYS = [
  "body",
  "clothes",
  "eyes",
  "hair",
  "hat",
  "accessory",
] as const;

export const UpdateWokaSchema = z.object({
  appearance: z.object(
    Object.fromEntries(
      WOKA_LAYER_KEYS.map((k) => [k, z.string().max(64)]),
    ) as Record<(typeof WOKA_LAYER_KEYS)[number], z.ZodString>,
  ),
});

export const CreateSpaceSchema = z.object({
  name: z.string().min(1).max(60),
  mapId: z.string(),
});

export const StudyStartSchema = z.object({
  spaceId: z.string().optional(),
});

export const LivekitTokenSchema = z.object({
  spaceId: z.string().min(1),
});

export const PresentSchema = z.object({
  spaceId: z.string().min(1),
  identity: z.string().min(1),
});

declare global {
  namespace Express {
    export interface Request {
      userId?: string;
    }
  }
}
