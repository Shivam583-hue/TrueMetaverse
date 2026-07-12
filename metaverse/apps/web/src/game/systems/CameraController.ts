import Phaser from "phaser";
import { EventBus, SpaceEvent } from "../EventBus";
import { deviceScale } from "../main";
import { CHARACTER_HEIGHT_TILES } from "../entities/Player";

export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.25;
const FOLLOW_LERP = 0.12;
const ZOOM_SMOOTHING = 10;
const WHEEL_ZOOM_FACTOR = 0.0015;
const CHARACTER_SCREEN_PX = 72;

export class CameraController {
  private camera: Phaser.Cameras.Scene2D.Camera;
  private targetZoom: number;
  private minZoom = 0.01;
  private pinchDistance: number | null = null;
  private dpr = deviceScale();

  constructor(
    private scene: Phaser.Scene,
    follow: Phaser.GameObjects.Container,
    private spaceWidth: number,
    private spaceHeight: number,
    tileSize: number,
  ) {
    this.camera = scene.cameras.main;
    this.camera.setBounds(0, 0, spaceWidth, spaceHeight);
    this.camera.startFollow(follow, true, FOLLOW_LERP, FOLLOW_LERP);

    this.recomputeMinZoom();
    const characterZoom =
      (CHARACTER_SCREEN_PX * this.dpr) / (CHARACTER_HEIGHT_TILES * tileSize);
    this.targetZoom = Phaser.Math.Clamp(
      characterZoom,
      this.minZoom,
      this.maxZoom(),
    );
    this.camera.setZoom(this.targetZoom);

    scene.input.addPointer(1);
    scene.input.on("wheel", this.onWheel, this);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    EventBus.on(SpaceEvent.ZoomIn, this.zoomIn, this);
    EventBus.on(SpaceEvent.ZoomOut, this.zoomOut, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
  }

  update(deltaMs: number): void {
    this.updatePinch();
    const t = 1 - Math.exp((-ZOOM_SMOOTHING * deltaMs) / 1000);
    const next = this.camera.zoom + (this.targetZoom - this.camera.zoom) * t;
    this.camera.setZoom(
      Math.abs(this.targetZoom - next) < 0.001 ? this.targetZoom : next,
    );
  }

  private zoomIn(): void {
    this.setTargetZoom(this.targetZoom + ZOOM_STEP * this.dpr);
  }

  private zoomOut(): void {
    this.setTargetZoom(this.targetZoom - ZOOM_STEP * this.dpr);
  }

  private setTargetZoom(zoom: number): void {
    this.targetZoom = Phaser.Math.Clamp(zoom, this.minZoom, this.maxZoom());
  }

  private maxZoom(): number {
    return Math.max(MAX_ZOOM * this.dpr, this.minZoom * 3);
  }

  private onWheel(
    _pointer: unknown,
    _over: unknown,
    _dx: number,
    dy: number,
  ): void {
    this.setTargetZoom(this.targetZoom * Math.exp(-dy * WHEEL_ZOOM_FACTOR));
  }

  private updatePinch(): void {
    const p1 = this.scene.input.pointer1;
    const p2 = this.scene.input.pointer2;
    if (p1 && p2 && p1.isDown && p2.isDown) {
      const distance = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (this.pinchDistance !== null && this.pinchDistance > 0) {
        this.setTargetZoom(this.targetZoom * (distance / this.pinchDistance));
      }
      this.pinchDistance = distance;
    } else {
      this.pinchDistance = null;
    }
  }

  private recomputeMinZoom(): void {
    const { width, height } = this.scene.scale;
    this.minZoom = Math.max(width / this.spaceWidth, height / this.spaceHeight);
  }

  private onResize(): void {
    this.recomputeMinZoom();
    this.setTargetZoom(this.targetZoom);
    if (this.camera.zoom < this.minZoom) this.camera.setZoom(this.minZoom);
  }

  private teardown(): void {
    this.scene.input.off("wheel", this.onWheel, this);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    EventBus.off(SpaceEvent.ZoomIn, this.zoomIn, this);
    EventBus.off(SpaceEvent.ZoomOut, this.zoomOut, this);
  }
}
