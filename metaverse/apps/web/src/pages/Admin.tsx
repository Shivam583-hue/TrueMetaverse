import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import TopBar from "../components/TopBar";
import { api, ApiError } from "../lib/api";
import type { Avatar, Element, MapTemplate } from "../lib/api";
import { useAuth } from "../lib/auth";

type Tab = "elements" | "avatars" | "maps";

export default function Admin() {
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("elements");

  if (session?.role !== "Admin") {
    return (
      <>
        <TopBar />
        <main className="page">
          <div className="empty">Only admin accounts can manage the catalog.</div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <main className="page">
        <p className="eyebrow">catalog</p>
        <div className="admin-layout">
          <nav className="admin-nav">
            {(["elements", "avatars", "maps"] as const).map((t) => (
              <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </nav>
          <div>
            {tab === "elements" && <ElementsTab />}
            {tab === "avatars" && <AvatarsTab />}
            {tab === "maps" && <MapsTab />}
          </div>
        </div>
      </main>
    </>
  );
}

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
    }
  }, []);
  return { error, run };
}

function ElementsTab() {
  const [elements, setElements] = useState<Element[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [width, setWidth] = useState(1);
  const [height, setHeight] = useState(1);
  const [isStatic, setIsStatic] = useState(true);
  const { error, run } = useAction();

  const refresh = useCallback(() => {
    api.elements().then((r) => setElements(r.elements)).catch(() => {});
  }, []);
  useEffect(refresh, [refresh]);

  function create(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      await api.admin.createElement({ imageUrl, width, height, static: isStatic });
      setImageUrl("");
      refresh();
    });
  }

  function editImage(el: Element) {
    const next = prompt("New image URL for this element:", el.imageUrl);
    if (!next || next === el.imageUrl) return;
    run(async () => {
      await api.admin.updateElement(el.id, next);
      refresh();
    });
  }

  return (
    <section>
      <form className="card" onSubmit={create}>
        <h3 style={{ fontSize: "0.85rem" }}>new element</h3>
        <label className="field">
          <span className="label">Image URL</span>
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            required
          />
        </label>
        <div className="form-row">
          <label className="field">
            <span className="label">Width (tiles)</span>
            <input type="number" min={1} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="label">Height (tiles)</span>
            <input type="number" min={1} value={height} onChange={(e) => setHeight(Number(e.target.value))} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={isStatic} onChange={(e) => setIsStatic(e.target.checked)} />
          Blocks walking (static)
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button className="btn primary">Add element</button>
        </div>
      </form>

      <div className="section">
        <table className="table">
          <thead>
            <tr>
              <th>image</th>
              <th>size</th>
              <th>walkable</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {elements.map((el) => (
              <tr key={el.id}>
                <td>
                  <img src={el.imageUrl} alt="" />
                </td>
                <td>
                  {el.width}x{el.height}
                </td>
                <td>{el.static ? "no" : "yes"}</td>
                <td>
                  <div className="actions">
                    <button className="btn ghost" onClick={() => editImage(el)}>
                      Change image
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AvatarsTab() {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const { error, run } = useAction();

  const refresh = useCallback(() => {
    api.avatars().then((r) => setAvatars(r.avatars)).catch(() => {});
  }, []);
  useEffect(refresh, [refresh]);

  function randomize() {
    const seed = Math.random().toString(36).slice(2, 10);
    setImageUrl(`https://api.dicebear.com/9.x/pixel-art/png?size=64&seed=${seed}`);
  }

  function create(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      await api.admin.createAvatar({ name, imageUrl });
      setName("");
      setImageUrl("");
      refresh();
    });
  }

  function rename(avatar: Avatar) {
    const next = prompt("New name:", avatar.name ?? "");
    if (!next || next === avatar.name) return;
    run(async () => {
      await api.admin.updateAvatar(avatar.id, { name: next });
      refresh();
    });
  }

  function remove(avatar: Avatar) {
    if (!confirm(`Delete avatar "${avatar.name}"? Users wearing it go back to the default look.`))
      return;
    run(async () => {
      await api.admin.deleteAvatar(avatar.id);
      refresh();
    });
  }

  return (
    <section>
      <form className="card" onSubmit={create}>
        <h3 style={{ fontSize: "0.85rem" }}>new avatar</h3>
        <div className="form-row">
          <label className="field">
            <span className="label">Name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="field">
            <span className="label">Image URL</span>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              required
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <button type="button" className="btn ghost" onClick={randomize}>
            Random DiceBear look
          </button>
          {imageUrl && <img src={imageUrl} alt="" className="pixel" style={{ width: 34, height: 34 }} />}
        </div>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button className="btn primary">Add avatar</button>
        </div>
      </form>

      <div className="section">
        <table className="table">
          <thead>
            <tr>
              <th>look</th>
              <th>name</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {avatars.map((avatar) => (
              <tr key={avatar.id}>
                <td>{avatar.imageUrl && <img src={avatar.imageUrl} alt="" />}</td>
                <td>{avatar.name}</td>
                <td>
                  <div className="actions">
                    <button className="btn ghost" onClick={() => rename(avatar)}>
                      Rename
                    </button>
                    <button className="btn danger" onClick={() => remove(avatar)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type DraftPlacement = { elementId: string; x: number; y: number };

function MapsTab() {
  const [maps, setMaps] = useState<MapTemplate[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [name, setName] = useState("");
  const [width, setWidth] = useState(40);
  const [height, setHeight] = useState(30);
  const [thumbnail, setThumbnail] = useState("");
  const [placements, setPlacements] = useState<DraftPlacement[]>([]);
  const { error, run } = useAction();

  const refresh = useCallback(() => {
    api.maps().then((r) => setMaps(r.maps)).catch(() => {});
    api.elements().then((r) => setElements(r.elements)).catch(() => {});
  }, []);
  useEffect(refresh, [refresh]);

  function addPlacement() {
    if (elements.length === 0) return;
    setPlacements((prev) => [...prev, { elementId: elements[0]!.id, x: 0, y: 0 }]);
  }

  function updatePlacement(index: number, patch: Partial<DraftPlacement>) {
    setPlacements((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function create(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      await api.admin.createMap({
        name,
        dimensions: `${width}x${height}`,
        thumbnail,
        defaultElements: placements,
      });
      setName("");
      setThumbnail("");
      setPlacements([]);
      refresh();
    });
  }

  function rename(map: MapTemplate) {
    const next = prompt("New name:", map.name);
    if (!next || next === map.name) return;
    run(async () => {
      await api.admin.updateMap(map.id, { name: next });
      refresh();
    });
  }

  function remove(map: MapTemplate) {
    if (!confirm(`Delete template "${map.name}"? Existing spaces built from it keep working.`))
      return;
    run(async () => {
      await api.admin.deleteMap(map.id);
      refresh();
    });
  }

  return (
    <section>
      <form className="card" onSubmit={create}>
        <h3 style={{ fontSize: "0.85rem" }}>new map template</h3>
        <div className="form-row">
          <label className="field">
            <span className="label">Name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="field">
            <span className="label">Thumbnail URL</span>
            <input
              type="text"
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              placeholder="https://..."
              required
            />
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span className="label">Width (tiles)</span>
            <input type="number" min={5} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="label">Height (tiles)</span>
            <input type="number" min={5} value={height} onChange={(e) => setHeight(Number(e.target.value))} />
          </label>
        </div>

        <p className="muted" style={{ margin: "0.25rem 0" }}>
          Default furniture ({placements.length})
        </p>
        {placements.map((p, i) => (
          <div key={i} className="form-row" style={{ gridTemplateColumns: "2fr 1fr 1fr auto", marginBottom: "0.4rem" }}>
            <select value={p.elementId} onChange={(e) => updatePlacement(i, { elementId: e.target.value })}>
              {elements.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.imageUrl.split("/").pop()} ({el.width}x{el.height})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={p.x}
              onChange={(e) => updatePlacement(i, { x: Number(e.target.value) })}
              aria-label="x"
            />
            <input
              type="number"
              min={0}
              value={p.y}
              onChange={(e) => updatePlacement(i, { y: Number(e.target.value) })}
              aria-label="y"
            />
            <button
              type="button"
              className="btn ghost"
              onClick={() => setPlacements((prev) => prev.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn ghost" onClick={addPlacement} disabled={elements.length === 0}>
          + Add furniture
        </button>

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button className="btn primary">Add template</button>
        </div>
      </form>

      <div className="section">
        <table className="table">
          <thead>
            <tr>
              <th>thumb</th>
              <th>name</th>
              <th>size</th>
              <th>furniture</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {maps.map((map) => (
              <tr key={map.id}>
                <td>
                  <img src={map.thumbnail} alt="" />
                </td>
                <td>{map.name}</td>
                <td>{map.dimensions}</td>
                <td>{map.defaultElements.length}</td>
                <td>
                  <div className="actions">
                    <button className="btn ghost" onClick={() => rename(map)}>
                      Rename
                    </button>
                    <button className="btn danger" onClick={() => remove(map)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
