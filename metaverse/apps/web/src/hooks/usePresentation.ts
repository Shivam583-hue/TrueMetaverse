import { useMemo } from "react";
import {
  tileInZone,
  tilesWithin,
  type SpaceConfig,
  type TileCoord,
} from "../game/config/spaces";
import { OPEN_ZONE, type ScreenShare } from "./useVideoChat";

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
      canShare: atLectern && !screenShare,
      canStopSharing: isPresenter,
      canWatch: inRoom && !!screenShare,
      blockedBy: atLectern && someoneElsePresenting ? screenShare.name : null,
    };
  }, [config, tile, zone, screenShare]);
}
