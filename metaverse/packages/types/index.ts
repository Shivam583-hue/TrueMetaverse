export type SpaceUser = {
  id: string;
  userId: string;
  x: number;
  y: number;
};

export type SpaceCapabilities = {
  study?: boolean;
  video?: boolean;
  whiteboard?: boolean;
};

export const SPACE_CAPABILITIES: Record<string, SpaceCapabilities> = {
  "/assets/spaces/garden-library/gardenlibspace.png": { study: true },
  "/assets/spaces/virtual-office/space.png": { video: true },
  "/assets/spaces/classroom/classroom.png": { whiteboard: true },
};

export function isVideoEnabled(mapImage: string | null | undefined): boolean {
  return !!mapImage && SPACE_CAPABILITIES[mapImage]?.video === true;
}

export function isStudyEnabled(mapImage: string | null | undefined): boolean {
  return !!mapImage && SPACE_CAPABILITIES[mapImage]?.study === true;
}

export function isWhiteboardEnabled(mapImage: string | null | undefined,): boolean {
  return !!mapImage && SPACE_CAPABILITIES[mapImage]?.whiteboard === true;
}

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
  | { type: "whiteboard-update"; payload: { elements: unknown[] } };

export type OutgoingMessage =
  | {
    type: "space-joined";
    payload: {
      spawn: { x: number; y: number };
      users: SpaceUser[];
      whiteboard: WhiteboardScene | null;
    };
  }
  | { type: "user-joined"; payload: SpaceUser }
  | { type: "movement"; payload: SpaceUser }
  | { type: "movement-rejected"; payload: { x: number; y: number } }
  | { type: "user-left"; payload: { id: string; userId: string } }
  | { type: "chat"; payload: ChatMessage }
  | { type: "whiteboard-update"; payload: WhiteboardScene };
