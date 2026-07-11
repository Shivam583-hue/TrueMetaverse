// Shared protocol types for the WebSocket server and the web client.

// A user as seen inside a space. `id` is the per-connection session id
// (stable key for rendering, unique even if one account opens two tabs),
// `userId` is the database user id (key for avatar/username lookups).
export type SpaceUser = {
  id: string;
  userId: string;
  x: number;
  y: number;
};

export type IncomingMessage =
  | { type: "join"; payload: { spaceId: string; token: string } }
  | { type: "move"; payload: { x: number; y: number } };

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
  | { type: "user-left"; payload: { id: string; userId: string } };
