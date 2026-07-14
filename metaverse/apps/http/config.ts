export const JWT_PASSWORD =
  process.env.JWT_PASSWORD ?? "local-development-jwt-secret";

// LiveKit SFU. The defaults match the local Compose environment and must never
// be used in production.
export const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "ws://localhost:7880";
export const LIVEKIT_INTERNAL_URL =
  process.env.LIVEKIT_INTERNAL_URL ?? LIVEKIT_URL;
export const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "devkey";
export const LIVEKIT_API_SECRET =
  process.env.LIVEKIT_API_SECRET ?? "devsecretdevsecretdevsecretdevsecret";

export const usingDevLivekitKeys =
  !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET;
