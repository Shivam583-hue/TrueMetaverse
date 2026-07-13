import { Router } from "express";
import client from "@repo/db/client";
import { userMiddleware } from "../../middleware/user";
import { CreateSpaceSchema } from "../../types";
export const spaceRouter = Router();

function generateCode(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

spaceRouter.post("/", userMiddleware, async (req, res) => {
  const parsedData = CreateSpaceSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" });
    return;
  }

  const map = await client.map.findFirst({
    where: {
      id: parsedData.data.mapId,
    },
    select: {
      mapElements: true,
      width: true,
      height: true,
      thumbnail: true,
      mapImage: true,
    },
  });
  if (!map) {
    res.status(400).json({ message: "Map not found" });
    return;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const space = await client.$transaction(async (tx) => {
        const space = await tx.space.create({
          data: {
            name: parsedData.data.name,
            width: map.width,
            height: map.height,
            thumbnail: map.thumbnail,
            mapImage: map.mapImage,
            code: generateCode(6),
            creatorId: req.userId!,
          },
        });

        if (map.mapElements.length > 0) {
          await tx.spaceElements.createMany({
            data: map.mapElements.map((e) => ({
              spaceId: space.id,
              elementId: e.elementId,
              x: e.x!,
              y: e.y!,
            })),
          });
        }

        return space;
      });
      res.json({ spaceId: space.id, code: space.code });
      return;
    } catch (e: any) {
      if (e?.code !== "P2002") {
        res.status(400).json({ message: "Could not create space" });
        return;
      }
    }
  }
  res.status(500).json({ message: "Could not create space" });
});

spaceRouter.get("/all", userMiddleware, async (req, res) => {
  const spaces = await client.space.findMany({
    where: {
      creatorId: req.userId!,
    },
  });

  res.json({
    spaces: spaces.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail,
      dimensions: `${s.width}x${s.height}`,
      code: s.code,
    })),
  });
});

spaceRouter.get("/official", async (req, res) => {
  const spaces = await client.space.findMany({
    where: {
      official: true,
    },
  });

  res.json({
    spaces: spaces.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail,
      dimensions: `${s.width}x${s.height}`,
      code: s.code,
    })),
  });
});

spaceRouter.get("/code/:code", async (req, res) => {
  const space = await client.space.findUnique({
    where: {
      code: (req.params.code as string).toUpperCase(),
    },
    select: {
      id: true,
    },
  });
  if (!space) {
    res.status(400).json({ message: "No room with that code" });
    return;
  }
  res.json({ spaceId: space.id });
});

spaceRouter.delete("/:spaceId", userMiddleware, async (req, res) => {
  const space = await client.space.findUnique({
    where: {
      id: req.params.spaceId as string,
    },
    select: {
      creatorId: true,
      official: true,
    },
  });
  if (!space) {
    res.status(400).json({ message: "Space not found" });
    return;
  }

  if (space.official || space.creatorId !== req.userId) {
    res.status(403).json({ message: "Unauthorized" });
    return;
  }

  await client.$transaction(async (tx) => {
    await tx.spaceElements.deleteMany({
      where: {
        spaceId: req.params.spaceId as string,
      },
    });
    await tx.space.delete({
      where: {
        id: req.params.spaceId as string,
      },
    });
  });
  res.json({ message: "Space deleted" });
});

spaceRouter.get("/:spaceId", userMiddleware, async (req, res) => {
  const space = await client.space.findUnique({
    where: {
      id: req.params.spaceId as string,
    },
    include: {
      elements: {
        include: {
          element: true,
        },
      },
    },
  });

  if (!space) {
    res.status(400).json({ message: "Space not found" });
    return;
  }

  res.json({
    name: space.name,
    code: space.creatorId === req.userId ? space.code : null,
    official: space.official,
    mapImage: space.mapImage,
    dimensions: `${space.width}x${space.height}`,
    elements: space.elements.map((e) => ({
      id: e.id,
      element: {
        id: e.element.id,
        imageUrl: e.element.imageUrl,
        width: e.element.width,
        height: e.element.height,
        static: e.element.static,
      },
      x: e.x,
      y: e.y,
    })),
  });
});
