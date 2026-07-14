import { useEffect, useMemo, useState } from "react";
import type { HideSeekRoundState } from "@repo/types";
import type { TileCoord } from "../game/config/spaces";
import type { UserMeta } from "../hooks/useArenaConnection";
import { button, cx } from "../lib/ui";

const phaseLabel = {
  lobby: "Waiting room",
  hiding: "Hide now",
  seeking: "Seekers released",
  finished: "Round over",
} as const;

function remainingSeconds(deadline: number | null, now: number): number | null {
  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function hideSeekMovementBlocked(
  state: HideSeekRoundState | null,
): boolean {
  if (!state) return false;
  if (state.phase === "finished") return true;
  if (state.phase === "lobby") return state.selfStatus !== "waiting";
  if (state.selfStatus !== "active") return true;
  return state.phase === "hiding" && state.selfRole === "seeker";
}

export default function HideSeekHud({
  state,
  error,
  localTile,
  visibleTiles,
  meta,
  onStart,
  onTag,
}: {
  state: HideSeekRoundState;
  error: string | null;
  localTile: TileCoord | null;
  visibleTiles: Record<string, TileCoord>;
  meta: Record<string, UserMeta>;
  onStart: () => void;
  onTag: (targetId: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (state.phaseEndsAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [state.phaseEndsAt]);

  const targetId = useMemo(() => {
    if (
      state.phase !== "seeking" ||
      state.selfRole !== "seeker" ||
      state.selfStatus !== "active" ||
      !localTile
    ) {
      return null;
    }
    return (
      state.participants
        .filter(
          (participant) =>
            participant.role === "hider" && participant.status === "active",
        )
        .map((participant) => ({
          id: participant.id,
          tile: visibleTiles[participant.id],
        }))
        .filter(
          (candidate): candidate is { id: string; tile: TileCoord } =>
            !!candidate.tile,
        )
        .map((candidate) => ({
          ...candidate,
          distance:
            Math.abs(candidate.tile.x - localTile.x) +
            Math.abs(candidate.tile.y - localTile.y),
        }))
        .filter((candidate) => candidate.distance <= 1)
        .sort((a, b) => a.distance - b.distance)[0]?.id ?? null
    );
  }, [localTile, state, visibleTiles]);

  useEffect(() => {
    if (!targetId) return;
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.code !== "Space" ||
        event.repeat ||
        target?.matches("input, textarea, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      onTag(targetId);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onTag, targetId]);

  const seconds = remainingSeconds(state.phaseEndsAt, now);
  const isHost = state.selfId === state.hostId;
  const canStart = state.phase === "lobby" || state.phase === "finished";
  const waitingCount = state.participants.filter(
    (participant) => participant.status === "waiting",
  ).length;
  const result =
    state.winner === "seeker"
      ? "The seeker found everyone"
      : state.winner === "hiders"
        ? "The hiders escaped"
        : null;
  const roleText =
    state.selfStatus === "spectator" || state.selfStatus === "tagged"
      ? state.selfStatus
      : state.selfRole;

  return (
    <section
      className="pointer-events-none absolute left-1/2 top-[4.75rem] z-[7] w-[min(27rem,calc(100vw-1.5rem))] -translate-x-1/2"
      aria-label="Hide and seek round"
    >
      <div className="pointer-events-auto overflow-hidden rounded-2xl border border-[#d5b76a66] bg-[#121724ed] shadow-[0_16px_42px_#05061199] backdrop-blur-lg">
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 sm:px-4">
          <div className="min-w-0">
            <div className="truncate font-pixel text-[0.58rem] uppercase tracking-[0.14em] text-[#ebd28b]">
              Enchanted hide &amp; seek
            </div>
            <div className="mt-1 text-xs font-semibold text-moonlight">
              {phaseLabel[state.phase]}
              <span className="ml-2 capitalize text-[#9fb5a3]">
                · {roleText}
              </span>
            </div>
          </div>
          {seconds !== null && (
            <div
              className={cx(
                "min-w-14 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-center font-mono text-lg font-bold text-[#f5e7b5]",
                seconds <= 10 && "border-alert/50 text-[#ff9aaa]",
              )}
              aria-live="polite"
            >
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-xs sm:px-4">
          <span className="rounded-full bg-white/7 px-2.5 py-1 text-[#ccd6d0]">
            {state.phase === "lobby"
              ? `${waitingCount}/${state.maxPlayers} ready`
              : `${state.hidersRemaining} hider${state.hidersRemaining === 1 ? "" : "s"} left`}
          </span>
          {state.phase === "hiding" && state.selfRole === "seeker" && (
            <span className="text-[#f1cf7a]">
              Stay in the cabin until the timer ends.
            </span>
          )}
          {state.phase === "hiding" && state.selfRole === "hider" && (
            <span className="text-[#a9d8b0]">
              Use tree cover before the seeker is released.
            </span>
          )}
          {result && (
            <strong className="text-[#f5e7b5]" aria-live="assertive">
              {result}
            </strong>
          )}
          {state.selfStatus === "tagged" && state.phase !== "finished" && (
            <span className="text-fog">
              You were tagged. Spectating until next round.
            </span>
          )}

          {canStart && isHost && (
            <button
              type="button"
              className={`${button.primary} ml-auto min-h-9 px-3 text-xs`}
              onClick={onStart}
              disabled={waitingCount < state.minPlayers}
            >
              Start round
            </button>
          )}
          {canStart && !isHost && (
            <span className="ml-auto text-fog">Waiting for the host</span>
          )}
          {state.phase === "seeking" && state.selfRole === "seeker" && (
            <button
              type="button"
              className={`${button.primary} ml-auto min-h-9 px-4 text-xs`}
              disabled={!targetId}
              onClick={() => targetId && onTag(targetId)}
              aria-keyshortcuts="Space"
            >
              {targetId
                ? `Tag ${meta[state.participants.find((p) => p.id === targetId)?.userId ?? ""]?.username ?? "hider"}`
                : "Get closer to tag"}
            </button>
          )}
        </div>
        {error && (
          <div
            className="border-t border-alert/20 bg-alert/10 px-3 py-2 text-xs text-[#ffb1bc] sm:px-4"
            role="alert"
          >
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
