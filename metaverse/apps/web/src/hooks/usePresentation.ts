import { useMemo } from "react";
import {
  tileInZone,
  tilesWithin,
  type SpaceConfig,
  type TileCoord,
} from "../game/config/spaces";
import type { ScreenShare } from "./useVideoChat";

// Turns "where the player is standing" into what the presentation room offers
// them right now. A space with no presentation config gets nothing, so this is
// inert everywhere except the virtual office.
export function usePresentation({
  config,
  tile,
  screenShare,
}: {
  config: SpaceConfig | null;
  tile: TileCoord | null;
  screenShare: ScreenShare | null;
}) {
  return useMemo(() => {
    const presentation = config?.presentation;
    const inRoom =
      !!presentation &&
      !!tile &&
      !!config &&
      tileInZone(tile, config, presentation.zone);

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
  }, [config, tile, screenShare]);
}
