const API_BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Element = {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  static: boolean;
};

export type Avatar = { id: string; imageUrl: string | null; name: string | null };

export type MapTemplate = {
  id: string;
  name: string;
  thumbnail: string;
  dimensions: string;
  defaultElements: (Element & { elementId: string; x: number; y: number })[];
};

export type SpaceSummary = {
  id: string;
  name: string;
  thumbnail: string | null;
  dimensions: string;
};

export type SpaceDetail = {
  dimensions: string;
  elements: { id: string; element: Element; x: number; y: number }[];
};

export type UserMetadata = {
  userId: string;
  username: string;
  avatarId?: string; // the avatar's imageUrl, per backend contract
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("tm.token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  signup: (username: string, password: string, type: "user" | "admin") =>
    request<{ userId: string }>("/signup", {
      method: "POST",
      body: JSON.stringify({ username, password, type }),
    }),

  signin: (username: string, password: string) =>
    request<{ token: string }>("/signin", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  elements: () => request<{ elements: Element[] }>("/elements"),
  avatars: () => request<{ avatars: Avatar[] }>("/avatars"),
  maps: () => request<{ maps: MapTemplate[] }>("/maps"),

  mySpaces: () => request<{ spaces: SpaceSummary[] }>("/space/all"),
  space: (spaceId: string) => request<SpaceDetail>(`/space/${spaceId}`),
  createSpace: (name: string, dimensions: string, mapId?: string) =>
    request<{ spaceId: string }>("/space", {
      method: "POST",
      body: JSON.stringify({ name, dimensions, ...(mapId ? { mapId } : {}) }),
    }),
  deleteSpace: (spaceId: string) =>
    request<{ message: string }>(`/space/${spaceId}`, { method: "DELETE" }),
  addSpaceElement: (spaceId: string, elementId: string, x: number, y: number) =>
    request<{ message: string }>("/space/element", {
      method: "POST",
      body: JSON.stringify({ spaceId, elementId, x, y }),
    }),
  deleteSpaceElement: (id: string) =>
    request<{ message: string }>("/space/element", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }),

  updateMetadata: (avatarId: string) =>
    request<{ message: string }>("/user/metadata", {
      method: "POST",
      body: JSON.stringify({ avatarId }),
    }),
  metadataBulk: (userIds: string[]) =>
    request<{ avatars: UserMetadata[] }>(
      `/user/metadata/bulk?ids=[${userIds.join(",")}]`,
    ),

  admin: {
    createElement: (data: { imageUrl: string; width: number; height: number; static: boolean }) =>
      request<{ id: string }>("/admin/element", { method: "POST", body: JSON.stringify(data) }),
    updateElement: (elementId: string, imageUrl: string) =>
      request<{ message: string }>(`/admin/element/${elementId}`, {
        method: "PUT",
        body: JSON.stringify({ imageUrl }),
      }),
    createAvatar: (data: { name: string; imageUrl: string }) =>
      request<{ avatarId: string }>("/admin/avatar", { method: "POST", body: JSON.stringify(data) }),
    updateAvatar: (avatarId: string, data: { name?: string; imageUrl?: string }) =>
      request<{ message: string }>(`/admin/avatar/${avatarId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteAvatar: (avatarId: string) =>
      request<{ message: string }>(`/admin/avatar/${avatarId}`, { method: "DELETE" }),
    createMap: (data: {
      name: string;
      dimensions: string;
      thumbnail: string;
      defaultElements: { elementId: string; x: number; y: number }[];
    }) => request<{ id: string }>("/admin/map", { method: "POST", body: JSON.stringify(data) }),
    updateMap: (
      mapId: string,
      data: {
        name?: string;
        dimensions?: string;
        thumbnail?: string;
        defaultElements?: { elementId: string; x: number; y: number }[];
      },
    ) =>
      request<{ message: string }>(`/admin/map/${mapId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteMap: (mapId: string) =>
      request<{ message: string }>(`/admin/map/${mapId}`, { method: "DELETE" }),
  },
};
