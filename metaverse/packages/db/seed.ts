import client from "./client";

const avatars = [
  { name: "Wick", imageUrl: "/avatars/wick.png" },
  { name: "Dai", imageUrl: "/avatars/dai.png" },
  { name: "Mimi", imageUrl: "/avatars/mimi.png" },
];

const GARDEN_LIBRARY_IMAGE = "/assets/spaces/garden-library/gardenlibspace.png";
const libraryMap = {
  name: "Study Library",
  width: 43,
  height: 24,
  thumbnail: GARDEN_LIBRARY_IMAGE,
  mapImage: GARDEN_LIBRARY_IMAGE,
};

const OFFICIAL_CODE = "LIBRARY";

async function main() {
  for (const avatar of avatars) {
    const existing = await client.avatar.findFirst({
      where: { name: avatar.name },
    });
    if (existing) continue;
    await client.avatar.create({ data: avatar });
    console.log(`avatar created: ${avatar.name}`);
  }

  let map = await client.map.findFirst({ where: { name: libraryMap.name } });
  if (map) {
    map = await client.map.update({ where: { id: map.id }, data: libraryMap });
    console.log(`map updated: ${map.name}`);
  } else {
    map = await client.map.create({ data: libraryMap });
    console.log(`map created: ${map.name}`);
  }

  const spaceData = {
    name: libraryMap.name,
    width: map.width,
    height: map.height,
    thumbnail: map.thumbnail,
    mapImage: map.mapImage,
  };

  const official = await client.space.findUnique({
    where: { code: OFFICIAL_CODE },
  });
  if (official) {
    await client.space.update({
      where: { code: OFFICIAL_CODE },
      data: spaceData,
    });
    console.log(`official space updated (code ${OFFICIAL_CODE})`);
  } else {
    let system = await client.user.findUnique({
      where: { username: "system" },
    });
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
        ...spaceData,
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
