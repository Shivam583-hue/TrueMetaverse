import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import path from "path";
import { hasLineOfSight, loadHideSeekConfig } from "./hideSeekConfig";
import { loadCollision } from "./collision";

const MAP_IMAGE = "/assets/spaces/hide-and-seek/space.webp";
const ASSET_DIR = path.resolve(
  import.meta.dir,
  "../web/public/assets/spaces/hide-and-seek",
);

function webpInfo(file: string) {
  const bytes = readFileSync(file);
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const chunk = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (chunk === "VP8X") {
      return {
        width: 1 + bytes.readUIntLE(data + 4, 3),
        height: 1 + bytes.readUIntLE(data + 7, 3),
        alpha: (bytes[data]! & 0x10) !== 0,
      };
    }
    if (chunk === "VP8 ") {
      return {
        width: bytes.readUInt16LE(data + 6) & 0x3fff,
        height: bytes.readUInt16LE(data + 8) & 0x3fff,
        alpha: false,
      };
    }
    offset = data + size + (size % 2);
  }
  throw new Error(`No supported WebP image chunk in ${file}`);
}

describe("hide-and-seek map configuration", () => {
  test("loads an exact 57 by 57 playable grid", () => {
    const config = loadHideSeekConfig(MAP_IMAGE);
    const collision = loadCollision(MAP_IMAGE);
    expect(config).not.toBeNull();
    expect(collision).not.toBeNull();
    expect(config?.grid).toEqual({ cols: 57, rows: 57 });
    expect(collision?.cols).toBe(57);
    expect(collision?.rows).toBe(57);
    expect(config?.hiderSpawns).toHaveLength(12);
    expect(config?.settings.seekDurationMs).toBe(210_000);
    expect(collision?.walkable.length).toBeGreaterThanOrEqual(1_300);
    for (const spawn of [config!.seekerSpawn, ...config!.hiderSpawns]) {
      expect(collision?.blocked[spawn.y * 57 + spawn.x]).toBe(0);
    }
  });

  test("ships aligned 2508px base and transparent WebP layers", () => {
    expect(webpInfo(path.join(ASSET_DIR, "space.webp"))).toEqual({
      width: 2508,
      height: 2508,
      alpha: false,
    });
    expect(webpInfo(path.join(ASSET_DIR, "foreground.webp"))).toEqual({
      width: 2508,
      height: 2508,
      alpha: true,
    });
  });

  test("connects every spawn and approved river crossing", () => {
    const config = loadHideSeekConfig(MAP_IMAGE)!;
    const collision = loadCollision(MAP_IMAGE)!;
    const key = (x: number, y: number) => `${x},${y}`;
    const visited = new Set([key(config.seekerSpawn.x, config.seekerSpawn.y)]);
    const queue = [config.seekerSpawn];
    while (queue.length > 0) {
      const tile = queue.shift()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const x = tile.x + dx;
        const y = tile.y + dy;
        if (
          x < 0 ||
          y < 0 ||
          x >= collision.cols ||
          y >= collision.rows ||
          collision.blocked[y * collision.cols + x] === 1 ||
          visited.has(key(x, y))
        ) {
          continue;
        }
        visited.add(key(x, y));
        queue.push({ x, y });
      }
    }
    for (const tile of [
      ...config.hiderSpawns,
      { x: 41, y: 10 },
      { x: 24, y: 32 },
      { x: 38, y: 50 },
    ]) {
      expect(visited.has(key(tile.x, tile.y))).toBe(true);
    }
  });

  test("line of sight stops at an intervening collision tile", () => {
    const open = {
      cols: 5,
      rows: 1,
      blocked: new Uint8Array([0, 0, 0, 0, 0]),
      walkable: [],
    };
    expect(hasLineOfSight(open, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true);
    open.blocked[2] = 1;
    expect(hasLineOfSight(open, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
  });
});
