import { EventBus, SpaceEvent } from "../game/EventBus";
import { button } from "../lib/ui";

export default function SpaceControls() {
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-[#14162bd9] p-1 shadow-sm backdrop-blur-md">
      <button
        className={`${button.base} grid h-[34px] min-h-0 w-[34px] place-items-center rounded-full bg-dusk-raised p-0 text-lg`}
        aria-label="Zoom out"
        onClick={() => EventBus.emit(SpaceEvent.ZoomOut)}
      >
        −
      </button>
      <button
        className={`${button.base} grid h-[34px] min-h-0 w-[34px] place-items-center rounded-full bg-dusk-raised p-0 text-lg`}
        aria-label="Zoom in"
        onClick={() => EventBus.emit(SpaceEvent.ZoomIn)}
      >
        +
      </button>
    </div>
  );
}
