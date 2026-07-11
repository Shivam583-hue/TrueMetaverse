import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import { api, ApiError } from "../lib/api";
import type { Avatar, MapTemplate, SpaceSummary } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Dashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<SpaceSummary[] | null>(null);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSpaces = useCallback(() => {
    api
      .mySpaces()
      .then((res) => setSpaces(res.spaces))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load spaces"));
  }, []);

  useEffect(() => {
    refreshSpaces();
    api.avatars().then((res) => setAvatars(res.avatars)).catch(() => {});
    if (session) {
      api
        .metadataBulk([session.userId])
        .then((res) => setCurrentAvatarUrl(res.avatars[0]?.avatarId ?? null))
        .catch(() => {});
    }
  }, [refreshSpaces, session]);

  async function pickAvatar(avatar: Avatar) {
    await api.updateMetadata(avatar.id);
    setCurrentAvatarUrl(avatar.imageUrl);
  }

  async function removeSpace(space: SpaceSummary) {
    if (!confirm(`Delete "${space.name}"? Everyone loses access to it.`)) return;
    await api.deleteSpace(space.id);
    refreshSpaces();
  }

  return (
    <>
      <TopBar />
      <main className="page">
        <section>
          <p className="eyebrow">your spaces</p>
          {error && <p className="error">{error}</p>}
          {spaces && spaces.length === 0 && (
            <div className="empty">
              No spaces yet. Create one and invite people to walk around with you.
            </div>
          )}
          <div className="space-grid">
            {(spaces ?? []).map((space) => (
              <div
                key={space.id}
                className="space-card"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/space/${space.id}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/space/${space.id}`)}
              >
                <div className="thumb">
                  {space.thumbnail ? (
                    <img src={space.thumbnail} alt="" className="pixel" />
                  ) : (
                    <span style={{ fontFamily: "var(--font-pixel)", color: "var(--fog)" }}>
                      {space.name.slice(0, 2).toLowerCase()}
                    </span>
                  )}
                </div>
                <div className="meta">
                  <span className="name">{space.name}</span>
                  <span className="dims">{space.dimensions}</span>
                </div>
                <div style={{ padding: "0 0.9rem 0.75rem" }}>
                  <button
                    className="btn danger"
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSpace(space);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            <button className="space-card new" onClick={() => setShowCreate(true)}>
              + New space
            </button>
          </div>
        </section>

        <section className="section">
          <p className="eyebrow">your avatar</p>
          {avatars.length === 0 ? (
            <p className="muted">No avatars available yet. Ask an admin to add some.</p>
          ) : (
            <div className="avatar-row">
              {avatars.map((avatar) => (
                <button
                  key={avatar.id}
                  className={`avatar-choice${avatar.imageUrl === currentAvatarUrl ? " selected" : ""}`}
                  onClick={() => pickAvatar(avatar)}
                >
                  {avatar.imageUrl && <img src={avatar.imageUrl} alt="" className="pixel" />}
                  <span className="label">{avatar.name ?? "unnamed"}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      {showCreate && (
        <CreateSpaceModal
          onClose={() => setShowCreate(false)}
          onCreated={(spaceId) => navigate(`/space/${spaceId}`)}
        />
      )}
    </>
  );
}

function CreateSpaceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (spaceId: string) => void;
}) {
  const [maps, setMaps] = useState<MapTemplate[]>([]);
  const [name, setName] = useState("");
  const [mapId, setMapId] = useState<string | null>(null);
  const [width, setWidth] = useState(40);
  const [height, setHeight] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.maps().then((res) => setMaps(res.maps)).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const dimensions = mapId
        ? (maps.find((m) => m.id === mapId)?.dimensions ?? `${width}x${height}`)
        : `${width}x${height}`;
      const res = await api.createSpace(name, dimensions, mapId ?? undefined);
      onCreated(res.spaceId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the space");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 style={{ fontSize: "0.95rem" }}>new space</h2>

        <label className="field">
          <span className="label">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team hangout"
            required
            autoFocus
          />
        </label>

        <p className="muted" style={{ margin: "0.75rem 0 0.25rem" }}>
          Start from a template
        </p>
        <div className="template-grid">
          <button
            type="button"
            className={`template-card${mapId === null ? " selected" : ""}`}
            onClick={() => setMapId(null)}
          >
            <span style={{ fontSize: "1.6rem" }}>▦</span>
            <span className="t-name">Blank</span>
            <span className="t-dims">custom size</span>
          </button>
          {maps.map((map) => (
            <button
              key={map.id}
              type="button"
              className={`template-card${mapId === map.id ? " selected" : ""}`}
              onClick={() => setMapId(map.id)}
            >
              <img src={map.thumbnail} alt="" className="pixel" />
              <span className="t-name">{map.name}</span>
              <span className="t-dims">{map.dimensions}</span>
            </button>
          ))}
        </div>

        {mapId === null && (
          <div className="form-row">
            <label className="field">
              <span className="label">Width (tiles)</span>
              <input
                type="number"
                min={5}
                max={500}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span className="label">Height (tiles)</span>
              <input
                type="number"
                min={5}
                max={500}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </label>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Creating..." : "Create space"}
          </button>
        </div>
      </form>
    </div>
  );
}
