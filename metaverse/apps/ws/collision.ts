import { readFileSync, statSync } from "fs";
import path from "path";

const WEB_PUBLIC = path.resolve(import.meta.dir, "../web/public");

export type CollisionData = {
  cols: number;
  rows: number;
  blocked: Uint8Array;
  walkable: { x: number; y: number }[];
};

const cache = new Map<string, { mtimeMs: number; data: CollisionData }>();

export function loadCollision(mapImage: string | null): CollisionData | null {
  if (!mapImage) return null;
  const dir = mapImage.slice(0, mapImage.lastIndexOf("/"));
  const file = path.join(WEB_PUBLIC, dir, "collision.json");

  let mtimeMs: number;
  try {
    mtimeMs = statSync(file).mtimeMs;
  } catch {
    cache.delete(file);
    return null;
  }
  const cached = cache.get(file);
  if (cached && cached.mtimeMs === mtimeMs) return cached.data;

  try {
    const rows = JSON.parse(readFileSync(file, "utf8")) as number[][];
    if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(rows[0])) {
      return null;
    }
    const height = rows.length;
    const width = rows[0]!.length;
    const blocked = new Uint8Array(width * height);
    const walkable: { x: number; y: number }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (rows[y]?.[x] === 1) {
          blocked[y * width + x] = 1;
        } else {
          walkable.push({ x, y });
        }
      }
    }
    const data = { cols: width, rows: height, blocked, walkable };
    cache.set(file, { mtimeMs, data });
    return data;
  } catch {
    return null;
  }
}

export function isBlocked(
  collision: CollisionData | null,
  x: number,
  y: number,
): boolean {
  if (!collision) return false;
  if (x < 0 || y < 0 || x >= collision.cols || y >= collision.rows) return true;
  return collision.blocked[y * collision.cols + x] === 1;
}

export function centerSpawn(
  collision: CollisionData | null,
  width: number,
  height: number,
): { x: number; y: number } {
  const cols = collision?.cols ?? width;
  const rows = collision?.rows ?? height;
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);

  if (!isBlocked(collision, cx, cy)) return { x: cx, y: cy };

  const maxRing = Math.max(cols, rows);
  for (let r = 1; r <= maxRing; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!isBlocked(collision, x, y)) return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}
