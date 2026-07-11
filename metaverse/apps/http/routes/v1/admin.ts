import { Router } from "express";
import { adminMiddleware } from "../../middleware/admin";
import { AddElementSchema, CreateAvatarSchema, CreateElementSchema, CreateMapSchema, UpdateElementSchema, UpdateMapSchema, UpdateAvatarSchema } from "../../types";
import client from "@repo/db/client";
export const adminRouter = Router();
adminRouter.use(adminMiddleware)

adminRouter.post("/element", async (req, res) => {
  const parsedData = CreateElementSchema.safeParse(req.body)
  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" })
    return
  }

  const element = await client.element.create({
    data: {
      width: parsedData.data.width,
      height: parsedData.data.height,
      static: parsedData.data.static,
      imageUrl: parsedData.data.imageUrl,
    }
  })

  res.json({
    id: element.id
  })
})

adminRouter.put("/element/:elementId", async (req, res) => {
  const parsedData = UpdateElementSchema.safeParse(req.body)
  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" })
    return
  }
  await client.element.update({
    where: {
      id: req.params.elementId
    },
    data: {
      imageUrl: parsedData.data.imageUrl
    }
  })
  res.json({ message: "Element updated" })
})

adminRouter.post("/avatar", async (req, res) => {
  const parsedData = CreateAvatarSchema.safeParse(req.body)
  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" })
    return
  }
  const avatar = await client.avatar.create({
    data: {
      name: parsedData.data.name,
      imageUrl: parsedData.data.imageUrl
    }
  })
  res.json({ avatarId: avatar.id })
})

adminRouter.put("/avatar/:avatarId", async (req, res) => {
  const parsedData = UpdateAvatarSchema.safeParse(req.body)
  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" })
    return
  }

  const avatar = await client.avatar.findUnique({
    where: {
      id: req.params.avatarId
    }
  })
  if (!avatar) {
    res.status(400).json({ message: "Avatar not found" })
    return
  }

  await client.avatar.update({
    where: {
      id: req.params.avatarId
    },
    data: {
      name: parsedData.data.name,
      imageUrl: parsedData.data.imageUrl
    }
  })

  res.json({ message: "Avatar updated" })
})

adminRouter.delete("/avatar/:avatarId", async (req, res) => {
  const avatar = await client.avatar.findUnique({
    where: {
      id: req.params.avatarId
    }
  })
  if (!avatar) {
    res.status(400).json({ message: "Avatar not found" })
    return
  }

  await client.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: {
        avatarId: req.params.avatarId
      },
      data: {
        avatarId: null
      }
    })
    await tx.avatar.delete({
      where: {
        id: req.params.avatarId
      }
    })
  })

  res.json({ message: "Avatar deleted" })
})

adminRouter.post("/map", async (req, res) => {
  const parsedData = CreateMapSchema.safeParse(req.body)
  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" })
    return
  }
  const map = await client.map.create({
    data: {
      name: parsedData.data.name,
      width: parseInt(parsedData.data.dimensions.split("x")[0]),
      height: parseInt(parsedData.data.dimensions.split("x")[1]),
      thumbnail: parsedData.data.thumbnail,
      mapElements: {
        create: parsedData.data.defaultElements.map(e => ({
          elementId: e.elementId,
          x: e.x,
          y: e.y
        }))
      }
    }
  })

  res.json({
    id: map.id
  })
})

adminRouter.put("/map/:mapId", async (req, res) => {
  const parsedData = UpdateMapSchema.safeParse(req.body)
  if (!parsedData.success) {
    res.status(400).json({ message: "Validation failed" })
    return
  }

  const map = await client.map.findUnique({
    where: {
      id: req.params.mapId
    }
  })
  if (!map) {
    res.status(400).json({ message: "Map not found" })
    return
  }

  const dimensions = parsedData.data.dimensions

  await client.$transaction(async (tx) => {
    await tx.map.update({
      where: {
        id: req.params.mapId
      },
      data: {
        name: parsedData.data.name,
        thumbnail: parsedData.data.thumbnail,
        width: dimensions ? parseInt(dimensions.split("x")[0]!) : undefined,
        height: dimensions ? parseInt(dimensions.split("x")[1]!) : undefined,
      }
    })

    if (parsedData.data.defaultElements) {
      await tx.mapElements.deleteMany({
        where: {
          mapId: req.params.mapId
        }
      })
      await tx.mapElements.createMany({
        data: parsedData.data.defaultElements.map(e => ({
          mapId: req.params.mapId as string,
          elementId: e.elementId,
          x: e.x,
          y: e.y
        }))
      })
    }
  })

  res.json({ message: "Map updated" })
})

adminRouter.delete("/map/:mapId", async (req, res) => {
  const map = await client.map.findUnique({
    where: {
      id: req.params.mapId
    }
  })
  if (!map) {
    res.status(400).json({ message: "Map not found" })
    return
  }

  await client.$transaction(async (tx) => {
    await tx.mapElements.deleteMany({
      where: {
        mapId: req.params.mapId
      }
    })
    await tx.map.delete({
      where: {
        id: req.params.mapId
      }
    })
  })

  res.json({ message: "Map deleted" })
})
