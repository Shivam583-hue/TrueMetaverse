export type SpaceUser = {
  id: string;
  userId: string;
  x: number;
  y: number;
};

export type SpacePresence = Pick<SpaceUser, "id" | "userId">;

export type SpaceCapabilities = {
  study?: boolean;
  video?: boolean;
  whiteboard?: boolean;
  hideAndSeek?: boolean;
};

export const SPACE_CAPABILITIES: Record<string, SpaceCapabilities> = {
  "/assets/spaces/garden-library/gardenlibspace.png": { study: true },
  "/assets/spaces/virtual-office/space.png": { video: true },
  "/assets/spaces/classroom/classroom.png": { whiteboard: true },
  "/assets/spaces/hide-and-seek/space.webp": { hideAndSeek: true },
};

export function isVideoEnabled(mapImage: string | null | undefined): boolean {
  return !!mapImage && SPACE_CAPABILITIES[mapImage]?.video === true;
}

export function isStudyEnabled(mapImage: string | null | undefined): boolean {
  return !!mapImage && SPACE_CAPABILITIES[mapImage]?.study === true;
}

export function isWhiteboardEnabled(
  mapImage: string | null | undefined,
): boolean {
  return !!mapImage && SPACE_CAPABILITIES[mapImage]?.whiteboard === true;
}

export function isHideAndSeekEnabled(
  mapImage: string | null | undefined,
): boolean {
  return !!mapImage && SPACE_CAPABILITIES[mapImage]?.hideAndSeek === true;
}

export type HideSeekPhase = "lobby" | "hiding" | "seeking" | "finished";
export type HideSeekRole = "spectator" | "hider" | "seeker";
export type HideSeekPlayerStatus =
  "waiting" | "active" | "tagged" | "spectator";
export type HideSeekWinner = "hiders" | "seeker" | null;

export type HideSeekParticipant = SpacePresence & {
  role: HideSeekRole;
  status: HideSeekPlayerStatus;
};

export type HideSeekRoundState = {
  roundId: number;
  phase: HideSeekPhase;
  phaseEndsAt: number | null;
  hostId: string;
  seekerId: string | null;
  selfId: string;
  selfRole: HideSeekRole;
  selfStatus: HideSeekPlayerStatus;
  hidersRemaining: number;
  minPlayers: number;
  maxPlayers: number;
  winner: HideSeekWinner;
  participants: HideSeekParticipant[];
};

export type WhiteboardScene = {
  elements: unknown[];
  version: number;
};

export type ChatMessage = {
  id: string;
  userId: string;
  text: string;
  at: number;
};

export type IncomingMessage =
  | { type: "join"; payload: { spaceId: string; token: string } }
  | { type: "move"; payload: { x: number; y: number } }
  | { type: "chat"; payload: { text: string } }
  | { type: "whiteboard-update"; payload: { elements: unknown[] } }
  | { type: "hide-seek-start"; payload: Record<string, never> }
  | { type: "hide-seek-tag"; payload: { targetId: string } };

export type OutgoingMessage =
  | {
      type: "space-joined";
      payload: {
        spawn: { x: number; y: number };
        users: SpacePresence[];
        visibleUsers: SpaceUser[];
        whiteboard: WhiteboardScene | null;
      };
    }
  | { type: "user-joined"; payload: SpacePresence }
  | { type: "player-appeared"; payload: SpaceUser }
  | { type: "player-disappeared"; payload: { id: string } }
  | { type: "self-position"; payload: { x: number; y: number } }
  | { type: "movement"; payload: SpaceUser }
  | { type: "movement-rejected"; payload: { x: number; y: number } }
  | { type: "user-left"; payload: { id: string; userId: string } }
  | { type: "chat"; payload: ChatMessage }
  | { type: "whiteboard-update"; payload: WhiteboardScene }
  | { type: "hide-seek-state"; payload: HideSeekRoundState }
  | { type: "hide-seek-error"; payload: { message: string } };
