import { isStudyEnabled, isVideoEnabled } from "@repo/types";

export const TILE_SIZE = 32;

export type TileCoord = { x: number; y: number };

export type TileRect = { x: number; y: number; w: number; h: number };

// A named region of a map, in tiles. Room-scoped features key off these rather
// than off raw coordinates, so a new room is a config change, not a code change.
export type SpaceZone = {
  id: string;
  rect: TileRect;
};

// A room where one person at a time can present their screen: `zone` is the
// audience area (who may watch), `lectern` the tile you must stand next to in
// order to take the projector.
export type PresentationConfig = {
  zone: string;
  lectern: TileCoord;
  lecternRadius: number;
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
  presentation?: PresentationConfig;
};

export function tileInRect(tile: TileCoord, rect: TileRect): boolean {
  return (
    tile.x >= rect.x &&
    tile.x < rect.x + rect.w &&
    tile.y >= rect.y &&
    tile.y < rect.y + rect.h
  );
}

export function tileInZone(
  tile: TileCoord,
  config: SpaceConfig,
  zoneId: string,
): boolean {
  const zone = config.zones.find((z) => z.id === zoneId);
  return !!zone && tileInRect(tile, zone.rect);
}

// Chebyshev distance, so the tiles diagonally touching the lectern count too.
export function tilesWithin(a: TileCoord, b: TileCoord, radius: number) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= radius;
}

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
    // The presentation room in the west wing: walls at x 1-10 / y 8-16, so the
    // floor you can stand on is x 2-9 / y 9-15, with the projector screen on the
    // north wall and the lectern below its right edge.
    zones: [{ id: "presentation", rect: { x: 2, y: 9, w: 8, h: 7 } }],
    presentation: {
      zone: "presentation",
      lectern: { x: 8, y: 11 },
      lecternRadius: 1,
    },
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
