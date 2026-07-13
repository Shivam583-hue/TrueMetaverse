import { randomUUID } from "crypto";
import { Router, type Response } from "express";
import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
  type ParticipantInfo,
} from "livekit-server-sdk";
import client from "@repo/db/client";
import { isVideoEnabled } from "@repo/types";
import { userMiddleware } from "../../middleware/user";
import {
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
  LIVEKIT_URL,
  usingDevLivekitKeys,
} from "../../config";
import { LivekitTokenSchema, PresentSchema } from "../../types";

export const livekitRouter = Router();

const TOKEN_TTL = "6h";

// Everyone may publish their camera and mic. Screen share is deliberately left
// out: the presentation room's projector takes one presenter at a time, and that
// is enforced by only granting this source to whoever holds the lectern.
const DEFAULT_SOURCES = [TrackSource.CAMERA, TrackSource.MICROPHONE];
const PRESENTER_SOURCES = [...DEFAULT_SOURCES, TrackSource.SCREEN_SHARE];

if (usingDevLivekitKeys && process.env.NODE_ENV === "production") {
  console.warn(
    "LiveKit is using the --dev placeholder credentials in production. " +
      "Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.",
  );
}

const roomService = new RoomServiceClient(
  LIVEKIT_URL.replace(/^ws/, "http"),
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
);

const isPresenting = (p: ParticipantInfo) =>
  p.tracks.some((t) => t.source === TrackSource.SCREEN_SHARE);

const holdsPresenterGrant = (p: ParticipantInfo) =>
  p.permission?.canPublishSources.includes(TrackSource.SCREEN_SHARE) === true;

async function setSources(
  room: string,
  identity: string,
  sources: TrackSource[],
) {
  await roomService.updateParticipant(room, identity, {
    permission: {
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      canPublishSources: sources,
      hidden: false,
      recorder: false,
      canUpdateMetadata: false,
      agent: false,
      canSubscribeMetrics: false,
    },
  });
}

// Resolves the space for a video request, or writes the error response.
async function requireVideoSpace(spaceId: string, res: Response) {
  const space = await client.space.findUnique({
    where: { id: spaceId },
    select: { id: true, mapImage: true },
  });
  if (!space) {
    res.status(404).json({ message: "Space not found" });
    return null;
  }
  if (!isVideoEnabled(space.mapImage)) {
    res.status(403).json({ message: "Video is not enabled for this space" });
    return null;
  }
  return space;
}

// Mints a LiveKit access token for the caller to join the space's room. The
// room name is the space id, so each space is its own call.
livekitRouter.post("/token", userMiddleware, async (req, res) => {
  const parsedData = LivekitTokenSchema.safeParse(req.body ?? {});
  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" });
    return;
  }

  const space = await requireVideoSpace(parsedData.data.spaceId, res);
  if (!space) return;

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
    canPublishSources: DEFAULT_SOURCES,
  });

  res.json({ token: await at.toJwt(), url: LIVEKIT_URL });
});

// Takes the lectern. The projector seats one presenter, so this succeeds only
// if nobody else is presenting - and because it works by granting the screen
// share source, the SFU itself rejects anyone who tries to share without it.
livekitRouter.post("/present", userMiddleware, async (req, res) => {
  const parsedData = PresentSchema.safeParse(req.body ?? {});
  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" });
    return;
  }
  const { spaceId, identity } = parsedData.data;

  // The identity carries the tab suffix, so check the user owns it rather than
  // letting anyone claim the lectern on someone else's behalf.
  if (identity.split(":")[0] !== req.userId) {
    res.status(403).json({ message: "Not your session" });
    return;
  }

  const space = await requireVideoSpace(spaceId, res);
  if (!space) return;

  let participants: ParticipantInfo[];
  try {
    participants = await roomService.listParticipants(space.id);
  } catch {
    res.status(409).json({ message: "Nobody is in this room yet" });
    return;
  }

  const me = participants.find((p) => p.identity === identity);
  if (!me) {
    res.status(409).json({ message: "You are not connected to this room" });
    return;
  }

  const others = participants.filter((p) => p.identity !== identity);
  const presenter = others.find(isPresenting);
  if (presenter) {
    res.status(409).json({
      message: "Someone else is already presenting",
      presenter: presenter.name || presenter.identity,
    });
    return;
  }

  // Someone can hold the grant without presenting: they stopped sharing but the
  // release never landed, or their tab froze. Nobody is on the projector, so
  // take it from them rather than leaving the room stuck with a dead lock.
  for (const stale of others.filter(holdsPresenterGrant)) {
    await setSources(space.id, stale.identity, DEFAULT_SOURCES);
  }

  await setSources(space.id, identity, PRESENTER_SOURCES);
  res.json({ message: "You have the lectern" });
});

// Gives the lectern back, so the next person can present.
livekitRouter.post("/present/release", userMiddleware, async (req, res) => {
  const parsedData = PresentSchema.safeParse(req.body ?? {});
  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" });
    return;
  }
  const { spaceId, identity } = parsedData.data;

  if (identity.split(":")[0] !== req.userId) {
    res.status(403).json({ message: "Not your session" });
    return;
  }

  const space = await requireVideoSpace(spaceId, res);
  if (!space) return;

  try {
    await setSources(space.id, identity, DEFAULT_SOURCES);
  } catch {
    // Already gone from the room, which releases the lectern anyway.
  }
  res.json({ message: "Lectern released" });
});
