import { randomUUID } from "crypto";
import { Router } from "express";
import { AccessToken } from "livekit-server-sdk";
import client from "@repo/db/client";
import { isVideoEnabled } from "@repo/types";
import { userMiddleware } from "../../middleware/user";
import {
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
  LIVEKIT_URL,
  usingDevLivekitKeys,
} from "../../config";
import { LivekitTokenSchema } from "../../types";

export const livekitRouter = Router();

const TOKEN_TTL = "6h";

if (usingDevLivekitKeys && process.env.NODE_ENV === "production") {
  console.warn(
    "LiveKit is using the --dev placeholder credentials in production. " +
      "Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.",
  );
}

// Mints a LiveKit access token for the caller to join the space's room. The
// room name is the space id, so each space is its own call.
livekitRouter.post("/token", userMiddleware, async (req, res) => {
  const parsedData = LivekitTokenSchema.safeParse(req.body ?? {});
  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" });
    return;
  }

  const space = await client.space.findUnique({
    where: { id: parsedData.data.spaceId },
    select: { id: true, mapImage: true },
  });
  if (!space) {
    res.status(404).json({ message: "Space not found" });
    return;
  }
  if (!isVideoEnabled(space.mapImage)) {
    res.status(403).json({ message: "Video is not enabled for this space" });
    return;
  }

  const user = await client.user.findUnique({
    where: { id: req.userId! },
    select: { username: true },
  });
  if (!user) {
    res.status(403).json({ message: "Unauthorized" });
    return;
  }

  // One identity per tab, not per user: a user with two tabs open would
  // otherwise have their older session kicked for a duplicate identity. The
  // client recovers the user id with identity.split(":")[0] (cuids have no ":").
  const identity = `${req.userId}:${randomUUID().slice(0, 8)}`;

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: user.username,
    ttl: TOKEN_TTL,
  });
  at.addGrant({
    roomJoin: true,
    room: space.id,
    canPublish: true,
    canSubscribe: true,
  });

  res.json({ token: await at.toJwt(), url: LIVEKIT_URL });
});
