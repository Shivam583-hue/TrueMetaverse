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
