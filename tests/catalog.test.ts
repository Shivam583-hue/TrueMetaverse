import { BACKEND_URL, http } from "./helpers";

const LIBRARY_IMAGE = "/assets/spaces/garden-library/gardenlibspace.png";

describe("Catalog", () => {
  test("Seeded avatars are listed", async () => {
    const response = await http.get(`${BACKEND_URL}/api/v1/avatars`);
    expect(response.status).toBe(200);
    const names = response.data.avatars.map((a: any) => a.name);
    expect(names).toEqual(expect.arrayContaining(["Wick", "Dai", "Mimi"]));
  });

  test("Study Library template is listed with its map image", async () => {
    const response = await http.get(`${BACKEND_URL}/api/v1/maps`);
    expect(response.status).toBe(200);
    const library = response.data.maps.find(
      (m: any) => m.name === "Study Library",
    );
    expect(library).toBeDefined();
    expect(library.dimensions).toBe("43x24");
    expect(library.mapImage).toBe(LIBRARY_IMAGE);
  });
});
