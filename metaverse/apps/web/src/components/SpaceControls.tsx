import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { EventBus, SpaceEvent } from "../game/EventBus";
import type { Direction } from "../game/systems/GridMovement";
import { button } from "../lib/ui";

// Browsers suppress the synthesized click while a second finger is already
// touching the screen, so these fire on pointerdown to stay usable while the
// joystick is held. Keyboard activation is wired up explicitly in exchange.
function ZoomButton({
  label,
  event,
  path,
}: {
  label: string;
  event: typeof SpaceEvent.ZoomIn | typeof SpaceEvent.ZoomOut;
  path: string;
}) {
  const activate = () => EventBus.emit(event);
  return (
    <button
      type="button"
      className={`${button.base} grid h-11 min-h-11 w-11 touch-none place-items-center rounded-lg border-line bg-dusk-raised p-0 text-moonlight active:scale-[0.97] active:translate-y-0`}
      aria-label={label}
      title={label}
      onPointerDown={activate}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
        keyEvent.preventDefault();
        activate();
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    </button>
  );
}

export default function SpaceControls() {
  return (
    <div
      className="flex w-fit self-end items-center gap-1 rounded-xl border border-line bg-[#14162bf2] p-1 shadow-[0_8px_24px_#05061166] backdrop-blur-md"
      aria-label="Map zoom"
      role="group"
    >
      <ZoomButton
        label="Zoom out"
        event={SpaceEvent.ZoomOut}
        path="M4 10h12"
      />
      <ZoomButton
        label="Zoom in"
        event={SpaceEvent.ZoomIn}
        path="M10 4v12M4 10h12"
      />
    </div>
  );
}

const DIRECTION_GLYPH: Record<Direction, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

export function directionFromOffset(
  dx: number,
  dy: number,
  deadZone: number,
): Direction | null {
  if (Math.hypot(dx, dy) < deadZone) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

function directionFromKey(key: string): Direction | null {
  switch (key.toLowerCase()) {
    case "arrowup":
    case "w":
      return "up";
    case "arrowdown":
    case "s":
      return "down";
    case "arrowleft":
    case "a":
      return "left";
    case "arrowright":
    case "d":
      return "right";
    default:
      return null;
  }
}

export function MobileJoystick() {
  const knobRef = useRef<HTMLSpanElement>(null);
  const pointerRef = useRef<number | null>(null);
  const directionRef = useRef<Direction | null>(null);
  const [direction, setDirection] = useState<Direction | null>(null);
  const [active, setActive] = useState(false);

  const publishDirection = useCallback((next: Direction | null) => {
    if (directionRef.current === next) return;
    directionRef.current = next;
    setDirection(next);
    EventBus.emit(SpaceEvent.MoveDirection, next);
  }, []);

  const reset = useCallback(
    (pointerId?: number) => {
      if (pointerId !== undefined && pointerRef.current !== pointerId) return;
      pointerRef.current = null;
      setActive(false);
      publishDirection(null);
      const knob = knobRef.current;
      if (!knob) return;
      knob.style.transition =
        "transform 150ms cubic-bezier(0.23, 1, 0.32, 1)";
      knob.style.transform = "translate3d(0, 0, 0)";
    },
    [publishDirection],
  );

  const updatePointer = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (pointerRef.current !== event.pointerId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      const travel = rect.width * 0.28;
      const scale = distance > travel ? travel / distance : 1;
      if (knobRef.current) {
        knobRef.current.style.transform = `translate3d(${dx * scale}px, ${dy * scale}px, 0)`;
      }
      publishDirection(directionFromOffset(dx, dy, rect.width * 0.1));
    },
    [publishDirection],
  );

  useEffect(
    () => () => {
      EventBus.emit(SpaceEvent.MoveDirection, null);
    },
    [],
  );

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (pointerRef.current !== null) return;
    pointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (knobRef.current) knobRef.current.style.transition = "none";
    setActive(true);
    updatePointer(event);
  }

  function handlePointerEnd(event: PointerEvent<HTMLButtonElement>) {
    reset(event.pointerId);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = directionFromKey(event.key);
    if (!next) return;
    event.preventDefault();
    publishDirection(next);
  }

  function handleKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    const released = directionFromKey(event.key);
    if (!released || directionRef.current !== released) return;
    event.preventDefault();
    publishDirection(null);
  }

  return (
    <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] left-3 z-[6] hidden flex-col items-center gap-1 [@media(pointer:coarse)]:flex">
      <span className="rounded bg-midnight/80 px-1.5 py-0.5 font-pixel text-[0.48rem] uppercase tracking-wider text-fog backdrop-blur-sm">
        move
      </span>
      <button
        type="button"
        className="relative grid h-[6.5rem] w-[6.5rem] touch-none select-none place-items-center rounded-full border border-line-strong bg-[#111326d9] shadow-[0_10px_30px_#05061188,inset_0_0_0_1px_#ffffff08] outline-none backdrop-blur-md focus-visible:ring-2 focus-visible:ring-portal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
        aria-label="Move character. Drag the joystick or use arrow keys."
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight W A S D"
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={updatePointer}
        onPointerUp={handlePointerEnd}
        onLostPointerCapture={(event) => reset(event.pointerId)}
      >
        <span aria-hidden="true" className="absolute left-3 text-xs text-fog/65">
          ←
        </span>
        <span aria-hidden="true" className="absolute right-3 text-xs text-fog/65">
          →
        </span>
        <span aria-hidden="true" className="absolute top-2.5 text-xs text-fog/65">
          ↑
        </span>
        <span aria-hidden="true" className="absolute bottom-2.5 text-xs text-fog/65">
          ↓
        </span>
        <span
          ref={knobRef}
          aria-hidden="true"
          className={`relative z-[1] grid h-11 w-11 place-items-center rounded-full border text-lg font-bold shadow-[0_4px_12px_#05061199] ${
            active
              ? "border-coin bg-coin text-[#201800]"
              : "border-[#555b91] bg-dusk-raised text-moonlight"
          }`}
        >
          {direction ? DIRECTION_GLYPH[direction] : "·"}
        </span>
      </button>
    </div>
  );
}
