import { readFileSync, statSync } from "fs";
import path from "path";
import type { CollisionData } from "./collision";
import { isBlocked } from "./collision";

const WEB_PUBLIC = path.resolve(import.meta.dir, "../web/public");

export type TileCoord = { x: number; y: number };
export type TileRect = { x: number; y: number; w: number; h: number };

export type HideSeekConfig = {
  version: 1;
  mode: "hide-and-seek";
  grid: { cols: number; rows: number };
  seekerSpawn: TileCoord;
  hiderSpawns: TileCoord[];
  concealment: { id: string; rect: TileRect }[];
  settings: {
    hideDurationMs: number;
    seekDurationMs: number;
    resultsDurationMs: number;
    sightRadius: number;
    concealRevealRadius: number;
    tagRange: number;
    minPlayers: number;
    maxPlayers: number;
  };
};

const cache = new Map<string, { mtimeMs: number; config: HideSeekConfig }>();

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isTile(value: unknown): value is TileCoord {
  if (!value || typeof value !== "object") return false;
  const tile = value as Record<string, unknown>;
  return Number.isInteger(tile.x) && Number.isInteger(tile.y);
}

function parseConfig(value: unknown): HideSeekConfig | null {
  if (!value || typeof value !== "object") return null;
  const config = value as Partial<HideSeekConfig>;
  const settings = config.settings as
    Partial<HideSeekConfig["settings"]> | undefined;
  if (
    config.version !== 1 ||
    config.mode !== "hide-and-seek" ||
    !config.grid ||
    !isPositiveInteger(config.grid.cols) ||
    !isPositiveInteger(config.grid.rows) ||
    !isTile(config.seekerSpawn) ||
    !Array.isArray(config.hiderSpawns) ||
    config.hiderSpawns.length < 2 ||
    !config.hiderSpawns.every(isTile) ||
    !Array.isArray(config.concealment) ||
    !settings ||
    !isPositiveInteger(settings.hideDurationMs) ||
    !isPositiveInteger(settings.seekDurationMs) ||
    !isPositiveInteger(settings.resultsDurationMs) ||
    !isPositiveInteger(settings.sightRadius) ||
    !isPositiveInteger(settings.concealRevealRadius) ||
    !isPositiveInteger(settings.tagRange) ||
    !isPositiveInteger(settings.minPlayers) ||
    !isPositiveInteger(settings.maxPlayers)
  ) {
    return null;
  }
  for (const zone of config.concealment) {
    if (
      !zone ||
      typeof zone.id !== "string" ||
      !zone.rect ||
      !Number.isInteger(zone.rect.x) ||
      !Number.isInteger(zone.rect.y) ||
      !isPositiveInteger(zone.rect.w) ||
      !isPositiveInteger(zone.rect.h) ||
      zone.rect.x < 0 ||
      zone.rect.y < 0 ||
      zone.rect.x + zone.rect.w > config.grid.cols ||
      zone.rect.y + zone.rect.h > config.grid.rows
    ) {
      return null;
    }
  }
  const allSpawns = [config.seekerSpawn, ...config.hiderSpawns];
  if (
    allSpawns.some(
      (tile) =>
        tile.x < 0 ||
        tile.y < 0 ||
        tile.x >= config.grid!.cols ||
        tile.y >= config.grid!.rows,
    ) ||
    settings.minPlayers! < 3 ||
    settings.maxPlayers! < settings.minPlayers! ||
    settings.maxPlayers! > config.hiderSpawns.length + 1
  ) {
    return null;
  }
  return config as HideSeekConfig;
}

export function loadHideSeekConfig(
  mapImage: string | null,
): HideSeekConfig | null {
  if (!mapImage) return null;
  const dir = mapImage.slice(0, mapImage.lastIndexOf("/"));
  const file = path.join(WEB_PUBLIC, dir, "gameplay.json");
  let mtimeMs: number;
  try {
    mtimeMs = statSync(file).mtimeMs;
  } catch {
    cache.delete(file);
    return null;
  }
  const cached = cache.get(file);
  if (cached?.mtimeMs === mtimeMs) return cached.config;
  try {
    const config = parseConfig(JSON.parse(readFileSync(file, "utf8")));
    if (!config) return null;
    cache.set(file, { mtimeMs, config });
    return config;
  } catch {
    return null;
  }
}

export function tileInConcealment(
  config: HideSeekConfig,
  tile: TileCoord,
): boolean {
  return config.concealment.some(
    ({ rect }) =>
      tile.x >= rect.x &&
      tile.x < rect.x + rect.w &&
      tile.y >= rect.y &&
      tile.y < rect.y + rect.h,
  );
}

export function hasLineOfSight(
  collision: CollisionData | null,
  from: TileCoord,
  to: TileCoord,
): boolean {
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let error = dx - dy;

  while (x !== to.x || y !== to.y) {
    const doubled = error * 2;
    if (doubled > -dy) {
      error -= dy;
      x += sx;
    }
    if (doubled < dx) {
      error += dx;
      y += sy;
    }
    if ((x !== to.x || y !== to.y) && isBlocked(collision, x, y)) {
      return false;
    }
  }
  return true;
}
