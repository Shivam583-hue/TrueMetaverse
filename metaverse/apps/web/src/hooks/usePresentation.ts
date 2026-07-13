import { useMemo } from "react";
import {
  tileInZone,
  tilesWithin,
  type SpaceConfig,
  type TileCoord,
} from "../game/config/spaces";
import { OPEN_ZONE, type ScreenShare } from "./useVideoChat";

// Which audio group a player standing here belongs to: the room they are inside,
// or the open floor with everybody else. Kept as a plain function because the
// video hook needs it before the presentation state can be derived.
export function resolveZone(
  config: SpaceConfig | null,
  tile: TileCoord | null,
): string {
  const presentation = config?.presentation;
  if (!presentation || !tile || !config) return OPEN_ZONE;
  return tileInZone(tile, config, presentation.zone)
    ? presentation.zone
    : OPEN_ZONE;
}

// Turns "where the player is standing" into what the presentation room offers
// them right now. A space with no presentation config gets nothing, so this is
// inert everywhere except the virtual office.
export function usePresentation({
  config,
  tile,
  zone,
  screenShare,
}: {
  config: SpaceConfig | null;
  tile: TileCoord | null;
  zone: string;
  screenShare: ScreenShare | null;
}) {
  return useMemo(() => {
    const presentation = config?.presentation;
    const inRoom = !!presentation && zone === presentation.zone;

    const atLectern =
      inRoom &&
      !!tile &&
      tilesWithin(tile, presentation.lectern, presentation.lecternRadius);

    const isPresenter = screenShare?.isSelf === true;
    const someoneElsePresenting = !!screenShare && !screenShare.isSelf;

    return {
      inRoom,
      // The lectern is free and you are standing at it.
      canShare: atLectern && !screenShare,
      // You hold the projector, so you can give it back (from anywhere - you
      // should not have to walk back to the lectern to stop).
      canStopSharing: isPresenter,
      // Someone is presenting and you are in the room to watch it.
      canWatch: inRoom && !!screenShare,
      // You are at the lectern but it is taken.
      blockedBy: atLectern && someoneElsePresenting ? screenShare.name : null,
    };
  }, [config, tile, zone, screenShare]);
}
