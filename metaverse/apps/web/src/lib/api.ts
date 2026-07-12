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

export type Avatar = {
  id: string;
  imageUrl: string | null;
  name: string | null;
};

export type MapTemplate = {
  id: string;
  name: string;
  thumbnail: string;
  mapImage: string | null;
  dimensions: string;
};

export type SpaceSummary = {
  id: string;
  name: string;
  thumbnail: string | null;
  dimensions: string;
  code: string;
};

export type SpaceDetail = {
  name: string;
  code: string;
  official: boolean;
  mapImage: string | null;
  dimensions: string;
  elements: { id: string; element: Element; x: number; y: number }[];
};

export type UserMetadata = {
  userId: string;
  username: string;
  avatarId?: string;
  wokaAppearance?: Record<string, string> | null;
};

export type LeaderboardPeriod = "all" | "daily" | "weekly" | "monthly";

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalSeconds: number;
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
    throw new ApiError(
      res.status,
      body.message ?? `Request failed (${res.status})`,
    );
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

  avatars: () => request<{ avatars: Avatar[] }>("/avatars"),
  maps: () => request<{ maps: MapTemplate[] }>("/maps"),

  mySpaces: () => request<{ spaces: SpaceSummary[] }>("/space/all"),
  officialSpaces: () => request<{ spaces: SpaceSummary[] }>("/space/official"),
  spaceByCode: (code: string) =>
    request<{ spaceId: string }>(
      `/space/code/${encodeURIComponent(code.trim())}`,
    ),
  space: (spaceId: string) => request<SpaceDetail>(`/space/${spaceId}`),
  createSpace: (name: string, mapId: string) =>
    request<{ spaceId: string; code: string }>("/space", {
      method: "POST",
      body: JSON.stringify({ name, mapId }),
    }),
  deleteSpace: (spaceId: string) =>
    request<{ message: string }>(`/space/${spaceId}`, { method: "DELETE" }),

  updateMetadata: (avatarId: string) =>
    request<{ message: string }>("/user/metadata", {
      method: "POST",
      body: JSON.stringify({ avatarId }),
    }),
  updateWoka: (appearance: Record<string, string>) =>
    request<{ message: string }>("/user/woka", {
      method: "POST",
      body: JSON.stringify({ appearance }),
    }),
  metadataBulk: (userIds: string[]) =>
    request<{ avatars: UserMetadata[] }>(
      `/user/metadata/bulk?ids=[${userIds.join(",")}]`,
    ),

  study: {
    start: (spaceId?: string) =>
      request<{ sessionId: string; startedAt: string }>("/study/start", {
        method: "POST",
        body: JSON.stringify(spaceId ? { spaceId } : {}),
      }),
    stop: () =>
      request<{ durationSeconds: number }>("/study/stop", { method: "POST" }),
    me: () =>
      request<{
        activeSession: { sessionId: string; startedAt: string } | null;
      }>("/study/me"),
    leaderboard: (period: LeaderboardPeriod) =>
      request<{ period: string; entries: LeaderboardEntry[] }>(
        `/study/leaderboard?period=${period}`,
      ),
  },
};
