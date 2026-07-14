import {
  isStudyEnabled,
  isVideoEnabled,
  isWhiteboardEnabled,
  isHideAndSeekEnabled,
} from "@repo/types";

export const TILE_SIZE = 32;

export type TileCoord = { x: number; y: number };

export type TileRect = { x: number; y: number; w: number; h: number };

export type SpaceZone = {
  id: string;
  rect: TileRect;
};

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
  whiteboard?: boolean;
  hideAndSeek?: boolean;
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

export function tilesWithin(a: TileCoord, b: TileCoord, radius: number) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= radius;
}

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
    zones: [{ id: "presentation", rect: { x: 2, y: 9, w: 8, h: 7 } }],
    presentation: {
      zone: "presentation",
      lectern: { x: 8, y: 11 },
      lecternRadius: 1,
    },
  },
  classroom: {
    id: "classroom",
    imagePath: "/assets/spaces/classroom/classroom.png",
    collisionPath: "/assets/spaces/classroom/collision.json",
    tileSize: 40,
    spawnTile: { x: 19, y: 13 },
    zones: [],
  },
  "hide-and-seek": {
    id: "hide-and-seek",
    imagePath: "/assets/spaces/hide-and-seek/space.webp",
    foregroundPath: "/assets/spaces/hide-and-seek/foreground.webp",
    collisionPath: "/assets/spaces/hide-and-seek/collision.json",
    tileSize: 44,
    spawnTile: { x: 17, y: 13 },
    zones: [],
  },
};

export const DEFAULT_SPACE_ID = "garden-library";

function withCapabilities(config: SpaceConfig): SpaceConfig {
  return {
    ...config,
    study: isStudyEnabled(config.imagePath),
    video: isVideoEnabled(config.imagePath),
    whiteboard: isWhiteboardEnabled(config.imagePath),
    hideAndSeek: isHideAndSeekEnabled(config.imagePath),
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
