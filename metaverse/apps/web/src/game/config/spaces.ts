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
};

export const SPACES: Record<string, SpaceConfig> = {
  "garden-library": {
    id: "garden-library",
    imagePath: "/assets/spaces/garden-library/gardenlibspace.png",
    collisionPath: "/assets/spaces/garden-library/collision.json",
    tileSize: 40,
    spawnTile: { x: 27, y: 13 },
    zones: [],
  },
  "garden-library-sd": {
    id: "garden-library",
    imagePath: "/assets/spaces/garden-library/space.png",
    collisionPath: "/assets/spaces/garden-library/collision.json",
    tileSize: 24,
    spawnTile: { x: 27, y: 13 },
    zones: [],
  },
  "study-cafe": {
    id: "study-cafe",
    imagePath: "/assets/spaces/study-cafe/space.png",
    foregroundPath: "/assets/spaces/study-cafe/space-foreground.png",
    collisionPath: "/assets/spaces/study-cafe/collision.json",
    tileSize: TILE_SIZE,
    spawnTile: { x: 20, y: 12 },
    zones: [],
  },
};

export const DEFAULT_SPACE_ID = "garden-library";

export function resolveSpaceConfig(mapImage: string | null): SpaceConfig {
  if (!mapImage) return SPACES[DEFAULT_SPACE_ID]!;
  const known = Object.values(SPACES).find((s) => s.imagePath === mapImage);
  if (known) return known;
  return {
    id: "custom",
    imagePath: mapImage,
    collisionPath: `${mapImage.slice(0, mapImage.lastIndexOf("/"))}/collision.json`,
    tileSize: TILE_SIZE,
    spawnTile: { x: 1, y: 1 },
    zones: [],
  };
}
