export type IncomingMessage =
  | { type: "join"; payload: { spaceId: string; token: string } }
  | { type: "move"; payload: { x: number; y: number } };

export type OutgoingMessage =
  | {
      type: "space-joined";
      payload: {
        spawn: { x: number; y: number };
        users: { id: string }[];
      };
    }
  | { type: "user-joined"; payload: { userId?: string; x: number; y: number } }
  | { type: "movement"; payload: { x: number; y: number } }
  | { type: "movement-rejected"; payload: { x: number; y: number } }
  | { type: "user-left"; payload: { userId?: string } };
