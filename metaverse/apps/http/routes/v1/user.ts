import { Router } from "express";
import { UpdateMetadataSchema, UpdateWokaSchema } from "../../types";
import client from "@repo/db/client";
import { userMiddleware } from "../../middleware/user";

export const userRouter = Router();

userRouter.post("/woka", userMiddleware, async (req, res) => {
  const parsed = UpdateWokaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Validation failed" });
    return;
  }
  try {
    await client.user.update({
      where: { id: req.userId },
      data: { wokaAppearance: parsed.data.appearance },
    });
    res.json({ message: "Appearance updated" });
  } catch {
    res.status(400).json({ message: "Internal server error" });
  }
});

userRouter.post("/metadata", userMiddleware, async (req, res) => {
  const parsedData = UpdateMetadataSchema.safeParse(req.body);
  if (!parsedData.success) {
    console.log("parsed data incorrect");
    res.status(400).json({ message: "Validation failed" });
    return;
  }
  try {
    await client.user.update({
      where: {
        id: req.userId,
      },
      data: {
        avatarId: parsedData.data.avatarId,
      },
    });
    res.json({ message: "Metadata updated" });
  } catch (e) {
    console.log("error");
    res.status(400).json({ message: "Internal server error" });
  }
});

userRouter.get("/metadata/bulk", async (req, res) => {
  const userIdString = (req.query.ids ?? "[]") as string;
  const userIds = userIdString.slice(1, userIdString?.length - 1).split(",");
  console.log(userIds);
  const metadata = await client.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: {
      avatar: true,
      id: true,
      username: true,
      wokaAppearance: true,
    },
  });

  res.json({
    avatars: metadata.map((m) => ({
      userId: m.id,
      username: m.username,
      avatarId: m.avatar?.imageUrl,
      wokaAppearance: m.wokaAppearance ?? null,
    })),
  });
});
