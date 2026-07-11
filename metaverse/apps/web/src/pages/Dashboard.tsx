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
  const [official, setOfficial] = useState<SpaceSummary[]>([]);
  const [spaces, setSpaces] = useState<SpaceSummary[] | null>(null);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const refreshSpaces = useCallback(() => {
    api
      .mySpaces()
      .then((res) => setSpaces(res.spaces))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load rooms"));
  }, []);

  useEffect(() => {
    refreshSpaces();
    api.officialSpaces().then((res) => setOfficial(res.spaces)).catch(() => {});
    api.avatars().then((res) => setAvatars(res.avatars)).catch(() => {});
    if (session) {
      api
        .metadataBulk([session.userId])
        .then((res) => setCurrentAvatarUrl(res.avatars[0]?.avatarId ?? null))
        .catch(() => {});
    }
  }, [refreshSpaces, session]);

  async function joinByCode(e: FormEvent) {
    e.preventDefault();
    setJoinError(null);
    try {
      const res = await api.spaceByCode(joinCode);
      navigate(`/space/${res.spaceId}`);
    } catch (err) {
      setJoinError(err instanceof ApiError ? err.message : "Could not find that room");
    }
  }

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
          <p className="eyebrow">official rooms</p>
          <div className="space-grid">
            {official.map((space) => (
              <div
                key={space.id}
                className="space-card official"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/space/${space.id}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/space/${space.id}`)}
              >
                <div className="thumb">
                  {space.thumbnail && <img src={space.thumbnail} alt="" />}
                </div>
                <div className="meta">
                  <span className="name">{space.name}</span>
                  <span className="dims">always open</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <p className="eyebrow">join with a code</p>
          <form className="join-row" onSubmit={joinByCode}>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. QK7M2X"
              maxLength={8}
              aria-label="Room code"
            />
            <button className="btn primary" disabled={joinCode.trim().length < 4}>
              Join room
            </button>
          </form>
          {joinError && <p className="error">{joinError}</p>}
        </section>

        <section className="section">
          <p className="eyebrow">your rooms</p>
          {error && <p className="error">{error}</p>}
          {spaces && spaces.length === 0 && (
            <div className="empty">
              No rooms yet. Create one and share its code with your study group.
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
                  {space.thumbnail && <img src={space.thumbnail} alt="" />}
                </div>
                <div className="meta">
                  <span className="name">{space.name}</span>
                  <button
                    className="code-chip"
                    title="Copy room code"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard?.writeText(space.code);
                    }}
                  >
                    {space.code}
                  </button>
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
              + New room
            </button>
          </div>
        </section>

        <section className="section">
          <p className="eyebrow">your avatar</p>
          {avatars.length === 0 ? (
            <p className="muted">No avatars available yet.</p>
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
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={(spaceId) => navigate(`/space/${spaceId}`)}
        />
      )}
    </>
  );
}

function CreateRoomModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (spaceId: string) => void;
}) {
  const [maps, setMaps] = useState<MapTemplate[]>([]);
  const [name, setName] = useState("");
  const [mapId, setMapId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .maps()
      .then((res) => {
        setMaps(res.maps);
        setMapId(res.maps[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mapId) return;
    setError(null);
    setBusy(true);
    try {
      const res = await api.createSpace(name, mapId);
      onCreated(res.spaceId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the room");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 style={{ fontSize: "0.95rem" }}>new room</h2>

        <label className="field">
          <span className="label">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Exam prep crew"
            required
            autoFocus
          />
        </label>

        <p className="muted" style={{ margin: "0.75rem 0 0.25rem" }}>
          Pick a template
        </p>
        <div className="template-grid">
          {maps.map((map) => (
            <button
              key={map.id}
              type="button"
              className={`template-card${mapId === map.id ? " selected" : ""}`}
              onClick={() => setMapId(map.id)}
            >
              <img src={map.thumbnail} alt="" />
              <span className="t-name">{map.name}</span>
              <span className="t-dims">{map.dimensions}</span>
            </button>
          ))}
        </div>

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy || !mapId}>
            {busy ? "Creating..." : "Create room"}
          </button>
        </div>
      </form>
    </div>
  );
}
