// Seeds the fixed catalog: character avatars, the Study Library template,
// and the official Study Library room (join code LIBRARY).
// Asset files live in apps/web/public and are served by the web app.
// Idempotent: existing rows (matched by name/code) are left alone.
// Run with: DATABASE_URL=... bun run seed.ts

import client from "./client";

const avatars = [
  { name: "Wick", imageUrl: "/avatars/wick.png" },
  { name: "Dai", imageUrl: "/avatars/dai.png" },
  { name: "Mimi", imageUrl: "/avatars/mimi.png" },
];

// the library art is 1201x895px; 38x28 tiles at 32px (1216x896) fits it
const libraryMap = {
  name: "Study Library",
  width: 38,
  height: 28,
  thumbnail: "/maps/library.png",
  mapImage: "/maps/library.png",
};

const OFFICIAL_CODE = "LIBRARY";

async function main() {
  for (const avatar of avatars) {
    const existing = await client.avatar.findFirst({ where: { name: avatar.name } });
    if (existing) continue;
    await client.avatar.create({ data: avatar });
    console.log(`avatar created: ${avatar.name}`);
  }

  let map = await client.map.findFirst({ where: { name: libraryMap.name } });
  if (!map) {
    map = await client.map.create({ data: libraryMap });
    console.log(`map created: ${map.name}`);
  }

  const official = await client.space.findUnique({ where: { code: OFFICIAL_CODE } });
  if (!official) {
    // official rooms are owned by a system account nobody can sign in to
    // (the stored password is not a valid scrypt hash)
    let system = await client.user.findUnique({ where: { username: "system" } });
    if (!system) {
      system = await client.user.create({
        data: {
          username: "system",
          password: "!locked",
          role: "Admin",
        },
      });
    }

    await client.space.create({
      data: {
        name: "Study Library",
        width: map.width,
        height: map.height,
        thumbnail: map.thumbnail,
        mapImage: map.mapImage,
        code: OFFICIAL_CODE,
        official: true,
        creatorId: system.id,
      },
    });
    console.log(`official space created (code ${OFFICIAL_CODE})`);
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
