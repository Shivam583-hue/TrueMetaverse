import Phaser from "phaser";

export const EventBus = new Phaser.Events.EventEmitter();

export const SpaceEvent = {
  SceneReady: "space:scene-ready",
  PlayerName: "space:player-name",
  ZoomIn: "zoom:in",
  ZoomOut: "zoom:out",
} as const;
