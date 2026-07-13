import z from "zod";

export const SignupSchema = z.object({
  username: z.string(),
  password: z.string(),
  type: z.enum(["user", "admin"]),
});

export const SigninSchema = z.object({
  username: z.string(),
  password: z.string(),
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
      role?: "Admin" | "User";
      userId?: string;
    }
  }
}
