import z from "zod";

export const SignupSchema = z.object({
  username: z.string(),
  password: z.string(),
  type: z.enum(["user", "admin"]),
})

export const SigninSchema = z.object({
  username: z.string(),
  password: z.string(),
})

export const UpdateMetadataSchema = z.object({
  avatarId: z.string()
})

// rooms are always created from a template map; dimensions come from the map
export const CreateSpaceSchema = z.object({
  name: z.string().min(1).max(60),
  mapId: z.string(),
})

export const StudyStartSchema = z.object({
  spaceId: z.string().optional(),
})


declare global {
  namespace Express {
    export interface Request {
      role?: "Admin" | "User";
      userId?: string;
    }
  }
}
