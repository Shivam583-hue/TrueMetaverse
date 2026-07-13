import axios2 from "axios";

export const BACKEND_URL = "http://localhost:3000";
export const WS_URL = "ws://localhost:3001";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const http = {
  post: async (...args: any[]) => {
    try {
      return await (axios2.post as any)(...args);
    } catch (e: any) {
      return e.response;
    }
  },
  get: async (...args: any[]) => {
    try {
      return await (axios2.get as any)(...args);
    } catch (e: any) {
      return e.response;
    }
  },
  put: async (...args: any[]) => {
    try {
      return await (axios2.put as any)(...args);
    } catch (e: any) {
      return e.response;
    }
  },
  delete: async (...args: any[]) => {
    try {
      return await (axios2.delete as any)(...args);
    } catch (e: any) {
      return e.response;
    }
  },
};

export function authHeader(token: string) {
  return { headers: { authorization: `Bearer ${token}` } };
}

export type TestUser = { username: string; userId: string; token: string };

export async function makeUser(prefix = "user"): Promise<TestUser> {
  const username = `${prefix}-${Math.random()}`;
  const password = "123456";
  const signup = await http.post(`${BACKEND_URL}/api/v1/signup`, {
    username,
    password,
    type: "user",
  });
  const signin = await http.post(`${BACKEND_URL}/api/v1/signin`, {
    username,
    password,
  });
  return {
    username,
    userId: signup.data.userId as string,
    token: signin.data.token as string,
  };
}

export async function getLibraryMapId(): Promise<string> {
  const response = await http.get(`${BACKEND_URL}/api/v1/maps`);
  return response.data.maps.find((m: any) => m.name === "Study Library").id;
}

export async function getMapIdByName(name: string): Promise<string> {
  const response = await http.get(`${BACKEND_URL}/api/v1/maps`);
  return response.data.maps.find((m: any) => m.name === name).id;
}

export async function createVideoRoom(
  token: string,
  name = "Video room",
): Promise<{ spaceId: string; code: string }> {
  const mapId = await getMapIdByName("Virtual Office");
  const response = await http.post(
    `${BACKEND_URL}/api/v1/space`,
    { name, mapId },
    authHeader(token),
  );
  return { spaceId: response.data.spaceId, code: response.data.code };
}

export async function createRoom(
  token: string,
  name = "Test room",
): Promise<{ spaceId: string; code: string }> {
  const mapId = await getLibraryMapId();
  const response = await http.post(
    `${BACKEND_URL}/api/v1/space`,
    { name, mapId },
    authHeader(token),
  );
  return { spaceId: response.data.spaceId, code: response.data.code };
}

export type Socket = { ws: WebSocket; messages: any[] };

export function openSocket(): Promise<Socket> {
  const ws = new WebSocket(WS_URL);
  const messages: any[] = [];
  ws.onmessage = (event: any) => messages.push(JSON.parse(event.data));
  return new Promise((resolve) => {
    (ws as any).onopen = () => resolve({ ws, messages });
  });
}

export function sendWs(ws: WebSocket, type: string, payload: unknown) {
  ws.send(JSON.stringify({ type, payload }));
}

export function joinSpace(ws: WebSocket, spaceId: string, token: string) {
  sendWs(ws, "join", { spaceId, token });
}

export async function nextOfType(
  messages: any[],
  type: string,
  timeoutMs = 3000,
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const idx = messages.findIndex((m) => m.type === type);
    if (idx >= 0) return messages.splice(idx, 1)[0];
    await sleep(20);
  }
  return null;
}

export async function nextMessage(
  messages: any[],
  timeoutMs = 3000,
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (messages.length) return messages.shift();
    await sleep(20);
  }
  return null;
}
