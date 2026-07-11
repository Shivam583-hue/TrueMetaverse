import axios2 from "axios"

const BACKEND_URL = "http://localhost:3000"
const WS_URL = "ws://localhost:3001"

// Prerequisite: the DB is seeded (packages/db/seed.ts) so the Study Library
// template and official room exist.

const axios = {
  post: async (...args: any[]) => {
    try {
      const res = await (axios2.post as any)(...args)
      return res
    } catch (e: any) {
      return e.response
    }
  },
  get: async (...args: any[]) => {
    try {
      const res = await (axios2.get as any)(...args)
      return res
    } catch (e: any) {
      return e.response
    }
  },
  put: async (...args: any[]) => {
    try {
      const res = await (axios2.put as any)(...args)
      return res
    } catch (e: any) {
      return e.response
    }
  },
  delete: async (...args: any[]) => {
    try {
      const res = await (axios2.delete as any)(...args)
      return res
    } catch (e: any) {
      return e.response
    }
  },
}

async function makeUser(prefix = "kirat") {
  const username = `${prefix}-${Math.random()}`
  const password = "123456"
  const signupResponse = await axios.post(`${BACKEND_URL}/api/v1/signup`, {
    username,
    password,
    type: "user"
  })
  const signinResponse = await axios.post(`${BACKEND_URL}/api/v1/signin`, {
    username,
    password
  })
  return {
    username,
    userId: signupResponse.data.userId as string,
    token: signinResponse.data.token as string
  }
}

async function getLibraryMapId(): Promise<string> {
  const response = await axios.get(`${BACKEND_URL}/api/v1/maps`)
  return response.data.maps.find((m: any) => m.name === "Study Library").id
}

describe("Authentication", () => {
  test('User is able to sign up only once', async () => {
    const username = "kirat" + Math.random();
    const password = "123456";
    const response = await axios.post(`${BACKEND_URL}/api/v1/signup`, {
      username,
      password,
      type: "admin"
    })

    expect(response.status).toBe(200)
    const updatedResponse = await axios.post(`${BACKEND_URL}/api/v1/signup`, {
      username,
      password,
      type: "admin"
    })

    expect(updatedResponse.status).toBe(400);
  });

  test('Signup request fails if the username is empty', async () => {
    const password = "123456"

    const response = await axios.post(`${BACKEND_URL}/api/v1/signup`, {
      password
    })

    expect(response.status).toBe(400)
  })

  test('Signin succeeds if the username and password are correct', async () => {
    const username = `kirat-${Math.random()}`
    const password = "123456"

    await axios.post(`${BACKEND_URL}/api/v1/signup`, {
      username,
      password,
      type: "admin"
    });

    const response = await axios.post(`${BACKEND_URL}/api/v1/signin`, {
      username,
      password
    });

    expect(response.status).toBe(200)
    expect(response.data.token).toBeDefined()
  })

  test('Signin fails if the username and password are incorrect', async () => {
    const username = `kirat-${Math.random()}`
    const password = "123456"

    await axios.post(`${BACKEND_URL}/api/v1/signup`, {
      username,
      password,
      type: "admin"
    });

    const response = await axios.post(`${BACKEND_URL}/api/v1/signin`, {
      username: "WrongUsername",
      password
    })

    expect(response.status).toBe(403)
  })
})

describe("Catalog", () => {
  test("Seeded avatars are listed", async () => {
    const response = await axios.get(`${BACKEND_URL}/api/v1/avatars`)
    expect(response.status).toBe(200)
    const names = response.data.avatars.map((a: any) => a.name)
    expect(names).toEqual(expect.arrayContaining(["Wick", "Dai", "Mimi"]))
  })

  test("Study Library template is listed with its map image", async () => {
    const response = await axios.get(`${BACKEND_URL}/api/v1/maps`)
    expect(response.status).toBe(200)
    const library = response.data.maps.find((m: any) => m.name === "Study Library")
    expect(library).toBeDefined()
    expect(library.dimensions).toBe("38x28")
    expect(library.mapImage).toBe("/maps/library.png")
  })
})

describe("User metadata", () => {
  let token = ""
  let userId = ""
  let avatarId = ""
  let avatarUrl = ""

  beforeAll(async () => {
    const user = await makeUser()
    token = user.token
    userId = user.userId
    const avatarsResponse = await axios.get(`${BACKEND_URL}/api/v1/avatars`)
    avatarId = avatarsResponse.data.avatars[0].id
    avatarUrl = avatarsResponse.data.avatars[0].imageUrl
  })

  test("User cant update their metadata with a wrong avatar id", async () => {
    const response = await axios.post(`${BACKEND_URL}/api/v1/user/metadata`, {
      avatarId: "123123123"
    }, {
      headers: {
        "authorization": `Bearer ${token}`
      }
    })

    expect(response.status).toBe(400)
  })

  test("User can update their metadata with a seeded avatar id", async () => {
    const response = await axios.post(`${BACKEND_URL}/api/v1/user/metadata`, {
      avatarId
    }, {
      headers: {
        "authorization": `Bearer ${token}`
      }
    })

    expect(response.status).toBe(200)
  })

  test("User is not able to update their metadata if the auth header is not present", async () => {
    const response = await axios.post(`${BACKEND_URL}/api/v1/user/metadata`, {
      avatarId
    })

    expect(response.status).toBe(403)
  })

  test("Bulk metadata returns username and avatar url", async () => {
    const response = await axios.get(`${BACKEND_URL}/api/v1/user/metadata/bulk?ids=[${userId}]`)
    expect(response.data.avatars.length).toBe(1)
    expect(response.data.avatars[0].userId).toBe(userId)
    expect(response.data.avatars[0].username).toBeDefined()
    expect(response.data.avatars[0].avatarId).toBe(avatarUrl)
  })
})

describe("Rooms", () => {
  let user: Awaited<ReturnType<typeof makeUser>>
  let otherUser: Awaited<ReturnType<typeof makeUser>>
  let mapId = ""

  beforeAll(async () => {
    user = await makeUser()
    otherUser = await makeUser()
    mapId = await getLibraryMapId()
  })

  test("Creating a room requires a template", async () => {
    const response = await axios.post(`${BACKEND_URL}/api/v1/space`, {
      name: "No template"
    }, {
      headers: { authorization: `Bearer ${user.token}` }
    })
    expect(response.status).toBe(400)
  })

  test("Creating a room from a template returns an id and a join code", async () => {
    const response = await axios.post(`${BACKEND_URL}/api/v1/space`, {
      name: "Focus room",
      mapId
    }, {
      headers: { authorization: `Bearer ${user.token}` }
    })
    expect(response.status).toBe(200)
    expect(response.data.spaceId).toBeDefined()
    expect(response.data.code).toMatch(/^[A-Z2-9]{6}$/)
  })

  test("A room can be found by its join code", async () => {
    const created = await axios.post(`${BACKEND_URL}/api/v1/space`, {
      name: "Code room",
      mapId
    }, {
      headers: { authorization: `Bearer ${user.token}` }
    })

    const response = await axios.get(`${BACKEND_URL}/api/v1/space/code/${created.data.code}`)
    expect(response.status).toBe(200)
    expect(response.data.spaceId).toBe(created.data.spaceId)

    // lowercase input works too
    const lower = await axios.get(`${BACKEND_URL}/api/v1/space/code/${created.data.code.toLowerCase()}`)
    expect(lower.data.spaceId).toBe(created.data.spaceId)
  })

  test("An unknown join code returns 400", async () => {
    const response = await axios.get(`${BACKEND_URL}/api/v1/space/code/XXXXXX`)
    expect(response.status).toBe(400)
  })

  test("Room details include name, code, map image, and dimensions", async () => {
    const created = await axios.post(`${BACKEND_URL}/api/v1/space`, {
      name: "Detail room",
      mapId
    }, {
      headers: { authorization: `Bearer ${user.token}` }
    })

    const response = await axios.get(`${BACKEND_URL}/api/v1/space/${created.data.spaceId}`)
    expect(response.status).toBe(200)
    expect(response.data.name).toBe("Detail room")
    expect(response.data.code).toBe(created.data.code)
    expect(response.data.official).toBe(false)
    expect(response.data.mapImage).toBe("/maps/library.png")
    expect(response.data.dimensions).toBe("38x28")
  })

  test("Unknown room id returns 400", async () => {
    const response = await axios.get(`${BACKEND_URL}/api/v1/space/123kasdk01`)
    expect(response.status).toBe(400)
  })

  test("My rooms list includes created rooms with their codes", async () => {
    const created = await axios.post(`${BACKEND_URL}/api/v1/space`, {
      name: "Listed room",
      mapId
    }, {
      headers: { authorization: `Bearer ${user.token}` }
    })

    const response = await axios.get(`${BACKEND_URL}/api/v1/space/all`, {
      headers: { authorization: `Bearer ${user.token}` }
    })
    const found = response.data.spaces.find((s: any) => s.id === created.data.spaceId)
    expect(found).toBeDefined()
    expect(found.code).toBe(created.data.code)
  })

  test("Creator can delete their room", async () => {
    const created = await axios.post(`${BACKEND_URL}/api/v1/space`, {
      name: "Doomed room",
      mapId
    }, {
      headers: { authorization: `Bearer ${user.token}` }
    })

    const response = await axios.delete(`${BACKEND_URL}/api/v1/space/${created.data.spaceId}`, {
      headers: { authorization: `Bearer ${user.token}` }
    })
    expect(response.status).toBe(200)
  })

  test("Deleting a room that doesn't exist returns 400", async () => {
    const response = await axios.delete(`${BACKEND_URL}/api/v1/space/randomIdDoesntExist`, {
      headers: { authorization: `Bearer ${user.token}` }
    })
    expect(response.status).toBe(400)
  })

  test("Someone else's room cannot be deleted", async () => {
    const created = await axios.post(`${BACKEND_URL}/api/v1/space`, {
      name: "Protected room",
      mapId
    }, {
      headers: { authorization: `Bearer ${user.token}` }
    })

    const response = await axios.delete(`${BACKEND_URL}/api/v1/space/${created.data.spaceId}`, {
      headers: { authorization: `Bearer ${otherUser.token}` }
    })
    expect(response.status).toBe(403)
  })

  test("The official Study Library is listed", async () => {
    const response = await axios.get(`${BACKEND_URL}/api/v1/space/official`)
    expect(response.status).toBe(200)
    const library = response.data.spaces.find((s: any) => s.code === "LIBRARY")
    expect(library).toBeDefined()
    expect(library.name).toBe("Study Library")
  })

  test("Official rooms cannot be deleted", async () => {
    const official = await axios.get(`${BACKEND_URL}/api/v1/space/official`)
    const library = official.data.spaces.find((s: any) => s.code === "LIBRARY")

    const response = await axios.delete(`${BACKEND_URL}/api/v1/space/${library.id}`, {
      headers: { authorization: `Bearer ${user.token}` }
    })
    expect(response.status).toBe(403)
  })
})

describe("Study timer", () => {
  let user: Awaited<ReturnType<typeof makeUser>>

  beforeAll(async () => {
    user = await makeUser("scholar")
  })

  test("Stopping without a running timer returns 400", async () => {
    const response = await axios.post(`${BACKEND_URL}/api/v1/study/stop`, {}, {
      headers: { authorization: `Bearer ${user.token}` }
    })
    expect(response.status).toBe(400)
  })

  test("Timer requires auth", async () => {
    const response = await axios.post(`${BACKEND_URL}/api/v1/study/start`, {})
    expect(response.status).toBe(403)
  })

  test("Start, run, stop records a session with a duration", async () => {
    const startResponse = await axios.post(`${BACKEND_URL}/api/v1/study/start`, {}, {
      headers: { authorization: `Bearer ${user.token}` }
    })
    expect(startResponse.status).toBe(200)
    expect(startResponse.data.startedAt).toBeDefined()

    const meResponse = await axios.get(`${BACKEND_URL}/api/v1/study/me`, {
      headers: { authorization: `Bearer ${user.token}` }
    })
    expect(meResponse.data.activeSession).not.toBeNull()

    await new Promise(r => setTimeout(r, 1200))

    const stopResponse = await axios.post(`${BACKEND_URL}/api/v1/study/stop`, {}, {
      headers: { authorization: `Bearer ${user.token}` }
    })
    expect(stopResponse.status).toBe(200)
    expect(stopResponse.data.durationSeconds).toBeGreaterThanOrEqual(1)

    const meAfter = await axios.get(`${BACKEND_URL}/api/v1/study/me`, {
      headers: { authorization: `Bearer ${user.token}` }
    })
    expect(meAfter.data.activeSession).toBeNull()
  })

  test("Starting a new timer discards a dangling open session", async () => {
    await axios.post(`${BACKEND_URL}/api/v1/study/start`, {}, {
      headers: { authorization: `Bearer ${user.token}` }
    })
    // start again without stopping: the first sitting is unverifiable and dropped
    await axios.post(`${BACKEND_URL}/api/v1/study/start`, {}, {
      headers: { authorization: `Bearer ${user.token}` }
    })

    const stopResponse = await axios.post(`${BACKEND_URL}/api/v1/study/stop`, {}, {
      headers: { authorization: `Bearer ${user.token}` }
    })
    expect(stopResponse.status).toBe(200)

    // only one session should remain stoppable
    const secondStop = await axios.post(`${BACKEND_URL}/api/v1/study/stop`, {}, {
      headers: { authorization: `Bearer ${user.token}` }
    })
    expect(secondStop.status).toBe(400)
  })

  test("Leaderboard ranks the user for every period", async () => {
    for (const period of ["all", "daily", "weekly", "monthly"]) {
      const response = await axios.get(`${BACKEND_URL}/api/v1/study/leaderboard?period=${period}`)
      expect(response.status).toBe(200)
      expect(response.data.period).toBe(period)
      expect(response.data.entries.length).toBeLessThanOrEqual(10)
      const mine = response.data.entries.find((e: any) => e.userId === user.userId)
      expect(mine).toBeDefined()
      expect(mine.username).toBe(user.username)
      expect(mine.totalSeconds).toBeGreaterThanOrEqual(1)
      expect(mine.rank).toBeGreaterThanOrEqual(1)
    }
  })

  test("Leaderboard rejects an unknown period", async () => {
    const response = await axios.get(`${BACKEND_URL}/api/v1/study/leaderboard?period=yearly`)
    expect(response.status).toBe(400)
  })
})

describe("Websocket", () => {
  let user1: Awaited<ReturnType<typeof makeUser>>
  let user2: Awaited<ReturnType<typeof makeUser>>
  let spaceId = ""
  let spaceWidth = 0
  let ws1: WebSocket
  let ws2: WebSocket
  let ws1Messages: any[] = []
  let ws2Messages: any[] = []
  let user1X = 0
  let user1Y = 0

  function waitForAndPopLatestMessage(messageArray: any[]): Promise<any> {
    return new Promise(resolve => {
      if (messageArray.length > 0) {
        resolve(messageArray.shift())
      } else {
        let interval = setInterval(() => {
          if (messageArray.length > 0) {
            resolve(messageArray.shift())
            clearInterval(interval)
          }
        }, 50)
      }
    })
  }

  beforeAll(async () => {
    user1 = await makeUser("ws")
    user2 = await makeUser("ws")
    const mapId = await getLibraryMapId()

    const spaceResponse = await axios.post(`${BACKEND_URL}/api/v1/space`, {
      name: "WS room",
      mapId
    }, {
      headers: { authorization: `Bearer ${user1.token}` }
    })
    spaceId = spaceResponse.data.spaceId

    const detail = await axios.get(`${BACKEND_URL}/api/v1/space/${spaceId}`)
    spaceWidth = parseInt(detail.data.dimensions.split("x")[0])

    ws1 = new WebSocket(WS_URL)
    ws1.onmessage = (event: any) => ws1Messages.push(JSON.parse(event.data))
    await new Promise(r => { (ws1 as any).onopen = r })

    ws2 = new WebSocket(WS_URL)
    ws2.onmessage = (event: any) => ws2Messages.push(JSON.parse(event.data))
    await new Promise(r => { (ws2 as any).onopen = r })
  })

  afterAll(() => {
    try { ws1?.close() } catch { }
    try { ws2?.close() } catch { }
  })

  test("Joining announces spawn, existing users, and identity", async () => {
    ws1.send(JSON.stringify({
      type: "join",
      payload: { spaceId, token: user1.token }
    }))
    const message1 = await waitForAndPopLatestMessage(ws1Messages)

    ws2.send(JSON.stringify({
      type: "join",
      payload: { spaceId, token: user2.token }
    }))
    const message2 = await waitForAndPopLatestMessage(ws2Messages)
    const message3 = await waitForAndPopLatestMessage(ws1Messages)

    expect(message1.type).toBe("space-joined")
    expect(message2.type).toBe("space-joined")
    expect(message1.payload.users.length).toBe(0)
    expect(message2.payload.users.length).toBe(1)
    expect(message2.payload.users[0].userId).toBe(user1.userId)
    expect(message2.payload.users[0].x).toBe(message1.payload.spawn.x)
    expect(message2.payload.users[0].y).toBe(message1.payload.spawn.y)
    expect(message3.type).toBe("user-joined")
    expect(message3.payload.userId).toBe(user2.userId)
    expect(message3.payload.id).toBeDefined()

    user1X = message1.payload.spawn.x
    user1Y = message1.payload.spawn.y
  })

  test("Moving two tiles at once is rejected", async () => {
    ws1.send(JSON.stringify({
      type: "move",
      payload: { x: user1X + 2, y: user1Y }
    }))

    const message = await waitForAndPopLatestMessage(ws1Messages)
    expect(message.type).toBe("movement-rejected")
    expect(message.payload.x).toBe(user1X)
    expect(message.payload.y).toBe(user1Y)
  })

  test("A valid step is broadcast to others with identity", async () => {
    const step = user1X > 0
      ? { x: user1X - 1, y: user1Y }
      : { x: user1X + 1, y: user1Y }
    ws1.send(JSON.stringify({ type: "move", payload: step }))

    const message = await waitForAndPopLatestMessage(ws2Messages)
    expect(message.type).toBe("movement")
    expect(message.payload.x).toBe(step.x)
    expect(message.payload.y).toBe(step.y)
    expect(message.payload.userId).toBe(user1.userId)
    expect(message.payload.id).toBeDefined()

    user1X = step.x
    user1Y = step.y
  })

  test("Walking past the right edge of the room is rejected at the boundary", async () => {
    // walk right one tile at a time; the server accepts each step until the
    // edge, then rejects the step that would leave the room
    let x = user1X
    let rejection: any = null
    for (let i = 0; i < spaceWidth + 2 && !rejection; i++) {
      ws1.send(JSON.stringify({ type: "move", payload: { x: x + 1, y: user1Y } }))
      await new Promise(r => setTimeout(r, 30))
      while (ws1Messages.length > 0) {
        const message = ws1Messages.shift()
        if (message.type === "movement-rejected") rejection = message
      }
      if (!rejection) x = x + 1
    }

    expect(rejection).not.toBeNull()
    expect(rejection.payload.x).toBe(spaceWidth - 1)
    user1X = rejection.payload.x
  }, 15000)

  test("Leaving broadcasts a user-left event with identity", async () => {
    ws1.close()
    // skip the broadcasts of user1's walk still queued for ws2
    let message = await waitForAndPopLatestMessage(ws2Messages)
    while (message.type === "movement") {
      message = await waitForAndPopLatestMessage(ws2Messages)
    }
    expect(message.type).toBe("user-left")
    expect(message.payload.userId).toBe(user1.userId)
    expect(message.payload.id).toBeDefined()
  })
})
