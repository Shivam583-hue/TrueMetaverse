import { Router } from "express";
import client from "@repo/db/client";
import { userMiddleware } from "../../middleware/user";
import { StudyStartSchema } from "../../types";

export const studyRouter = Router();

const MAX_SESSION_SECONDS = 12 * 60 * 60;

studyRouter.post("/start", userMiddleware, async (req, res) => {
  const parsedData = StudyStartSchema.safeParse(req.body ?? {});
  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" });
    return;
  }

  await client.studySession.deleteMany({
    where: {
      userId: req.userId!,
      endedAt: null,
    },
  });

  const session = await client.studySession.create({
    data: {
      userId: req.userId!,
      spaceId: parsedData.data.spaceId ?? null,
    },
  });

  res.json({ sessionId: session.id, startedAt: session.startedAt });
});

studyRouter.post("/stop", userMiddleware, async (req, res) => {
  const session = await client.studySession.findFirst({
    where: {
      userId: req.userId!,
      endedAt: null,
    },
    orderBy: {
      startedAt: "desc",
    },
  });
  if (!session) {
    res.status(400).json({ message: "No running timer" });
    return;
  }

  const endedAt = new Date();
  const durationSeconds = Math.min(
    Math.max(
      0,
      Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000),
    ),
    MAX_SESSION_SECONDS,
  );

  await client.studySession.update({
    where: {
      id: session.id,
    },
    data: {
      endedAt,
      durationSeconds,
    },
  });

  res.json({ durationSeconds });
});

studyRouter.get("/me", userMiddleware, async (req, res) => {
  const session = await client.studySession.findFirst({
    where: {
      userId: req.userId!,
      endedAt: null,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  res.json({
    activeSession: session
      ? { sessionId: session.id, startedAt: session.startedAt }
      : null,
  });
});

function periodStart(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case "daily": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case "weekly": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const mondayOffset = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - mondayOffset);
      return start;
    }
    case "monthly":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return null;
  }
}

studyRouter.get("/leaderboard", async (req, res) => {
  const period = (req.query.period as string) ?? "all";
  if (!["all", "daily", "weekly", "monthly"].includes(period)) {
    res.status(400).json({ message: "Invalid period" });
    return;
  }
  const boundary = periodStart(period);

  const grouped = await client.studySession.groupBy({
    by: ["userId"],
    where: {
      endedAt: boundary ? { gte: boundary } : { not: null },
      durationSeconds: { not: null },
    },
    _sum: {
      durationSeconds: true,
    },
    orderBy: {
      _sum: {
        durationSeconds: "desc",
      },
    },
    take: 10,
  });

  const users = await client.user.findMany({
    where: {
      id: { in: grouped.map((g) => g.userId) },
    },
    select: {
      id: true,
      username: true,
      avatar: { select: { imageUrl: true } },
    },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  res.json({
    period,
    entries: grouped.map((g, i) => ({
      rank: i + 1,
      userId: g.userId,
      username: userById.get(g.userId)?.username ?? "unknown",
      avatarUrl: userById.get(g.userId)?.avatar?.imageUrl ?? null,
      totalSeconds: g._sum.durationSeconds ?? 0,
    })),
  });
});
