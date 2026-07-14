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

const MULTIROOM_HOUSE_IMAGE = "/assets/spaces/multiroom-house/space.png";
const multiroomHouseMap = {
  name: "Multi-room House",
  width: 26,
  height: 26,
  thumbnail: MULTIROOM_HOUSE_IMAGE,
  mapImage: MULTIROOM_HOUSE_IMAGE,
};

const VIRTUAL_OFFICE_IMAGE = "/assets/spaces/virtual-office/space.png";
const virtualOfficeMap = {
  name: "Virtual Office",
  width: 39,
  height: 26,
  thumbnail: VIRTUAL_OFFICE_IMAGE,
  mapImage: VIRTUAL_OFFICE_IMAGE,
};

const CLASSROOM_IMAGE = "/assets/spaces/classroom/classroom.png";
const classroomMap = {
  name: "Classroom",
  width: 37,
  height: 28,
  thumbnail: CLASSROOM_IMAGE,
  mapImage: CLASSROOM_IMAGE,
};

const HIDE_AND_SEEK_IMAGE = "/assets/spaces/hide-and-seek/space.webp";
const hideAndSeekMap = {
  name: "Enchanted Forest Hide & Seek",
  width: 57,
  height: 57,
  thumbnail: HIDE_AND_SEEK_IMAGE,
  mapImage: HIDE_AND_SEEK_IMAGE,
};

const templateMaps = [
  libraryMap,
  multiroomHouseMap,
  virtualOfficeMap,
  classroomMap,
  hideAndSeekMap,
];

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

  const maps = new Map<string, Awaited<ReturnType<typeof client.map.create>>>();
  for (const template of templateMaps) {
    const existing = await client.map.findFirst({
      where: { name: template.name },
    });
    const map = existing
      ? await client.map.update({
          where: { id: existing.id },
          data: template,
        })
      : await client.map.create({ data: template });
    console.log(`map ${existing ? "updated" : "created"}: ${map.name}`);
    maps.set(template.name, map);
  }

  const map = maps.get(libraryMap.name)!;
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
