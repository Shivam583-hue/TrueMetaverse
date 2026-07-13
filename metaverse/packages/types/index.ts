export type SpaceUser = {
  id: string;
  userId: string;
  x: number;
  y: number;
};

// Which official maps carry which capabilities, keyed by the map's image path
// (Space.mapImage in the database). Shared so the http server can authorize a
// video token for a space without trusting the client's own space config.
export type SpaceCapabilities = {
  study?: boolean;
  video?: boolean;
};

export const SPACE_CAPABILITIES: Record<string, SpaceCapabilities> = {
  "/assets/spaces/garden-library/gardenlibspace.png": { study: true },
  "/assets/spaces/virtual-office/space.png": { video: true },
};

export function isVideoEnabled(mapImage: string | null | undefined): boolean {
  return !!mapImage && SPACE_CAPABILITIES[mapImage]?.video === true;
}

export function isStudyEnabled(mapImage: string | null | undefined): boolean {
  return !!mapImage && SPACE_CAPABILITIES[mapImage]?.study === true;
}

export type ChatMessage = {
  id: string;
  userId: string;
  text: string;
  at: number;
};

export type IncomingMessage =
  | { type: "join"; payload: { spaceId: string; token: string } }
  | { type: "move"; payload: { x: number; y: number } }
  | { type: "chat"; payload: { text: string } };

export type OutgoingMessage =
  | {
      type: "space-joined";
      payload: {
        spawn: { x: number; y: number };
        users: SpaceUser[];
      };
    }
  | { type: "user-joined"; payload: SpaceUser }
  | { type: "movement"; payload: SpaceUser }
  | { type: "movement-rejected"; payload: { x: number; y: number } }
  | { type: "user-left"; payload: { id: string; userId: string } }
  | { type: "chat"; payload: ChatMessage };
