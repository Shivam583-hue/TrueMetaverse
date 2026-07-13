export type SpaceUser = {
  id: string;
  userId: string;
  x: number;
  y: number;
  mic?: boolean;
  cam?: boolean;
};

export type ChatMessage = {
  id: string;
  userId: string;
  text: string;
  at: number;
};

export type MediaState = {
  id: string;
  userId: string;
  mic: boolean;
  cam: boolean;
};

export type IncomingMessage =
  | { type: "join"; payload: { spaceId: string; token: string } }
  | { type: "move"; payload: { x: number; y: number } }
  | { type: "chat"; payload: { text: string } }
  | { type: "rtc-signal"; payload: { to: string; data: unknown } }
  | { type: "media-state"; payload: { mic: boolean; cam: boolean } };

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
  | { type: "chat"; payload: ChatMessage }
  | { type: "rtc-signal"; payload: { from: string; data: unknown } }
  | { type: "media-state"; payload: MediaState };
