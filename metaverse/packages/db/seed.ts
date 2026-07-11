// Seeds avatars, elements, and starter maps using open-source assets:
// - Avatars: DiceBear HTTP API (https://dicebear.com, MIT)
// - Element/thumbnail images: Twemoji via jsDelivr (CC-BY 4.0)
// Idempotent: existing rows (matched by name/imageUrl) are left alone.
// Run with: DATABASE_URL=... bun run seed.ts

import client from "./client";

const TWEMOJI = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72";
const DICEBEAR = "https://api.dicebear.com/9.x";

const avatars = [
  { name: "Ember", imageUrl: `${DICEBEAR}/pixel-art/png?size=64&seed=Ember` },
  { name: "Nova", imageUrl: `${DICEBEAR}/pixel-art/png?size=64&seed=Nova` },
  { name: "Pixel", imageUrl: `${DICEBEAR}/pixel-art/png?size=64&seed=Pixel` },
  { name: "Scout", imageUrl: `${DICEBEAR}/adventurer/png?size=64&seed=Scout` },
  { name: "Juniper", imageUrl: `${DICEBEAR}/adventurer/png?size=64&seed=Juniper` },
  { name: "Robo", imageUrl: `${DICEBEAR}/bottts/png?size=64&seed=Robo` },
  { name: "Circuit", imageUrl: `${DICEBEAR}/bottts/png?size=64&seed=Circuit` },
];

// key is only used to reference elements when laying out maps below
const elements = [
  { key: "chair", imageUrl: `${TWEMOJI}/1fa91.png`, width: 1, height: 1, static: false },
  { key: "couch", imageUrl: `${TWEMOJI}/1f6cb.png`, width: 2, height: 1, static: true },
  { key: "plant", imageUrl: `${TWEMOJI}/1fab4.png`, width: 1, height: 1, static: true },
  { key: "desktop", imageUrl: `${TWEMOJI}/1f5a5.png`, width: 1, height: 1, static: true },
  { key: "books", imageUrl: `${TWEMOJI}/1f4da.png`, width: 1, height: 1, static: true },
  { key: "coffee", imageUrl: `${TWEMOJI}/2615.png`, width: 1, height: 1, static: false },
  { key: "printer", imageUrl: `${TWEMOJI}/1f5a8.png`, width: 1, height: 1, static: true },
  { key: "tree", imageUrl: `${TWEMOJI}/1f332.png`, width: 1, height: 1, static: true },
];

type Placement = { key: string; x: number; y: number };

function officeLayout(): Placement[] {
  const placements: Placement[] = [];

  // desk pods: desktop with a chair below, in a 3x2 grid of pods
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const x = 6 + col * 10;
      const y = 5 + row * 8;
      placements.push({ key: "desktop", x, y });
      placements.push({ key: "chair", x, y: y + 1 });
      placements.push({ key: "desktop", x: x + 2, y });
      placements.push({ key: "chair", x: x + 2, y: y + 1 });
    }
  }

  // lounge corner
  placements.push({ key: "couch", x: 30, y: 22 });
  placements.push({ key: "coffee", x: 33, y: 22 });
  placements.push({ key: "books", x: 30, y: 20 });
  placements.push({ key: "printer", x: 3, y: 22 });

  // plants along the top and bottom edges
  for (let x = 2; x < 38; x += 6) {
    placements.push({ key: "plant", x, y: 1 });
    placements.push({ key: "plant", x, y: 27 });
  }

  return placements;
}

function parkLayout(): Placement[] {
  const placements: Placement[] = [];

  // tree ring around the park
  for (let x = 1; x < 30; x += 4) {
    placements.push({ key: "tree", x, y: 1 });
    placements.push({ key: "tree", x, y: 23 });
  }
  for (let y = 5; y < 22; y += 4) {
    placements.push({ key: "tree", x: 1, y });
    placements.push({ key: "tree", x: 29, y });
  }

  // benches (couches) and a coffee cart in the middle
  placements.push({ key: "couch", x: 12, y: 10 });
  placements.push({ key: "couch", x: 17, y: 14 });
  placements.push({ key: "coffee", x: 15, y: 12 });

  return placements;
}

const maps = [
  {
    name: "Cozy Office",
    width: 40,
    height: 30,
    thumbnail: `${TWEMOJI}/1f3e2.png`,
    layout: officeLayout(),
  },
  {
    name: "City Park",
    width: 31,
    height: 25,
    thumbnail: `${TWEMOJI}/1f333.png`,
    layout: parkLayout(),
  },
];

async function main() {
  for (const avatar of avatars) {
    const existing = await client.avatar.findFirst({ where: { name: avatar.name } });
    if (existing) continue;
    await client.avatar.create({ data: avatar });
    console.log(`avatar created: ${avatar.name}`);
  }

  const elementIdByKey: Record<string, string> = {};
  for (const { key, ...data } of elements) {
    let element = await client.element.findFirst({ where: { imageUrl: data.imageUrl } });
    if (!element) {
      element = await client.element.create({ data });
      console.log(`element created: ${key}`);
    }
    elementIdByKey[key] = element.id;
  }

  for (const { layout, ...map } of maps) {
    const existing = await client.map.findFirst({ where: { name: map.name } });
    if (existing) continue;
    await client.map.create({
      data: {
        ...map,
        mapElements: {
          create: layout.map((p) => ({
            elementId: elementIdByKey[p.key]!,
            x: p.x,
            y: p.y,
          })),
        },
      },
    });
    console.log(`map created: ${map.name} (${layout.length} elements)`);
  }
}

main()
  .then(() => {
    console.log("seed complete");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
