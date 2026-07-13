import { isStudyEnabled, isVideoEnabled } from "@repo/types";

export const TILE_SIZE = 32;

export type TileCoord = { x: number; y: number };

export type SpaceZone = {
  id: string;
  tiles: TileCoord[];
};

export type SpaceConfig = {
  id: string;
  imagePath: string;
  foregroundPath?: string;
  collisionPath: string;
  tileSize: number;
  spawnTile: TileCoord;
  zones: SpaceZone[];
  study?: boolean;
  music?: string;
  video?: boolean;
};

// Rendering config lives here; the study/video capability flags come from
// @repo/types so the http server authorizes against the same source of truth.
export const SPACES: Record<string, SpaceConfig> = {
  "garden-library": {
    id: "garden-library",
    imagePath: "/assets/spaces/garden-library/gardenlibspace.png",
    collisionPath: "/assets/spaces/garden-library/collision.json",
    tileSize: 40,
    spawnTile: { x: 27, y: 13 },
    zones: [],
  },
  "multiroom-house": {
    id: "multiroom-house",
    imagePath: "/assets/spaces/multiroom-house/space.png",
    collisionPath: "/assets/spaces/multiroom-house/collision.json",
    tileSize: 40,
    spawnTile: { x: 13, y: 13 },
    zones: [],
    music: "/assets/spaces/multiroom-house/music.mp3",
  },
  "virtual-office": {
    id: "virtual-office",
    imagePath: "/assets/spaces/virtual-office/space.png",
    collisionPath: "/assets/spaces/virtual-office/collision.json",
    tileSize: 40,
    spawnTile: { x: 19, y: 13 },
    zones: [],
  },
};

export const DEFAULT_SPACE_ID = "garden-library";

function withCapabilities(config: SpaceConfig): SpaceConfig {
  return {
    ...config,
    study: isStudyEnabled(config.imagePath),
    video: isVideoEnabled(config.imagePath),
  };
}

export function resolveSpaceConfig(mapImage: string | null): SpaceConfig {
  if (!mapImage) return withCapabilities(SPACES[DEFAULT_SPACE_ID]!);
  const known = Object.values(SPACES).find((s) => s.imagePath === mapImage);
  if (known) return withCapabilities(known);
  return {
    id: "custom",
    imagePath: mapImage,
    collisionPath: `${mapImage.slice(0, mapImage.lastIndexOf("/"))}/collision.json`,
    tileSize: TILE_SIZE,
    spawnTile: { x: 1, y: 1 },
    zones: [],
  };
}
