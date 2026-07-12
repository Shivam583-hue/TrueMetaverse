import { EventBus, SpaceEvent } from "../game/EventBus";

export default function SpaceControls() {
  return (
    <div className="space-controls">
      <button
        className="btn"
        aria-label="Zoom out"
        onClick={() => EventBus.emit(SpaceEvent.ZoomOut)}
      >
        −
      </button>
      <button
        className="btn"
        aria-label="Zoom in"
        onClick={() => EventBus.emit(SpaceEvent.ZoomIn)}
      >
        +
      </button>
    </div>
  );
}
