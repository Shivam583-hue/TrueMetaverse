import Phaser from "phaser";

export const EventBus = new Phaser.Events.EventEmitter();

export const SpaceEvent = {
  SceneReady: "space:scene-ready",
  PlayerName: "space:player-name",
  PlayerAppearance: "space:player-appearance",
  MoveDirection: "space:move-direction",
  ZoomIn: "zoom:in",
  ZoomOut: "zoom:out",
} as const;
