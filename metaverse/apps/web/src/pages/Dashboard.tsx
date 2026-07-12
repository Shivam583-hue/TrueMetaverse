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
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const refreshSpaces = useCallback(() => {
    api
      .mySpaces()
      .then((res) => setSpaces(res.spaces))
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Could not load rooms"),
      );
  }, []);

  useEffect(() => {
    refreshSpaces();
    api
      .officialSpaces()
      .then((res) => setOfficial(res.spaces))
      .catch(() => {});
    api
      .avatars()
      .then((res) => setAvatars(res.avatars))
      .catch(() => {});
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
      setJoinError(
        err instanceof ApiError ? err.message : "Could not find that room",
      );
    }
  }

  async function pickAvatar(avatar: Avatar) {
    await api.updateMetadata(avatar.id);
    setCurrentAvatarUrl(avatar.imageUrl);
  }

  async function removeSpace(space: SpaceSummary) {
    if (!confirm(`Delete "${space.name}"? Everyone loses access to it.`))
      return;
    await api.deleteSpace(space.id);
    refreshSpaces();
  }

  async function copyRoomCode(code: string) {
    try {
      await navigator.clipboard?.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 1600);
    } catch {
      setCopiedCode(null);
    }
  }

  return (
    <>
      <TopBar />
      <main className="lobby">
        <section className="lobby-intro">
          <div>
            <p className="eyebrow">YOUR STUDY LOBBY</p>
            <h1>Welcome back, {session?.username ?? "explorer"}.</h1>
            <p className="lobby-lede">
              Choose a shared space, meet your crew, and make this session
              count.
            </p>
          </div>

          <form className="join-panel" onSubmit={joinByCode}>
            <div className="join-panel-heading">
              <span className="join-panel-icon" aria-hidden="true">
                #
              </span>
              <div>
                <p className="eyebrow">QUICK JOIN</p>
                <h2>Enter a room code</h2>
              </div>
            </div>
            <div className="join-row">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="QK7M2X"
                maxLength={8}
                aria-label="Room code"
              />
              <button
                className="btn primary"
                disabled={joinCode.trim().length < 4}
              >
                Join
              </button>
            </div>
            {joinError && (
              <p className="error" role="alert">
                {joinError}
              </p>
            )}
          </form>
        </section>

        <div className="lobby-layout">
          <div className="lobby-spaces">
            <section className="lobby-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">OPEN SPACES</p>
                  <h2>Start somewhere lively</h2>
                </div>
                <span className="section-count">
                  {official.length} available
                </span>
              </div>
              {official.length === 0 ? (
                <div className="empty compact">
                  No official rooms are open right now.
                </div>
              ) : (
                <div className="space-grid official-grid">
                  {official.map((space) => (
                    <div
                      key={space.id}
                      className="space-card official"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/space/${space.id}`)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && navigate(`/space/${space.id}`)
                      }
                    >
                      <div className="thumb">
                        {space.thumbnail && (
                          <img src={space.thumbnail} alt="" />
                        )}
                      </div>
                      <div className="meta">
                        <span className="name">{space.name}</span>
                        <span className="room-status">
                          <i /> open now
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="lobby-section your-rooms-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">YOUR SPACES</p>
                  <h2>Rooms you host</h2>
                </div>
                <button
                  className="btn primary create-room-btn"
                  onClick={() => setShowCreate(true)}
                >
                  New room
                </button>
              </div>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {spaces === null && (
                <div className="empty compact">Loading your rooms...</div>
              )}
              {spaces && spaces.length === 0 && (
                <div className="empty compact">
                  No rooms yet. Create one for your next study crew.
                </div>
              )}
              {spaces && spaces.length > 0 && (
                <div className="space-grid">
                  {(spaces ?? []).map((space) => (
                    <div
                      key={space.id}
                      className="space-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/space/${space.id}`)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && navigate(`/space/${space.id}`)
                      }
                    >
                      <div className="thumb">
                        {space.thumbnail && (
                          <img src={space.thumbnail} alt="" />
                        )}
                      </div>
                      <div className="meta">
                        <span className="name">{space.name}</span>
                        <button
                          className="code-chip"
                          title={
                            copiedCode === space.code
                              ? "Copied"
                              : "Copy room code"
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            copyRoomCode(space.code);
                          }}
                        >
                          {copiedCode === space.code ? "COPIED" : space.code}
                        </button>
                      </div>
                      <div className="space-card-actions">
                        <button
                          className="btn danger"
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
                </div>
              )}
            </section>
          </div>

          <aside className="avatar-dock">
            <div className="avatar-dock-heading">
              <p className="eyebrow">PLAYER PROFILE</p>
              <h2>Choose your avatar</h2>
              <p>Everyone in a room sees this character.</p>
            </div>
            {avatars.length === 0 ? (
              <p className="muted">No avatars available yet.</p>
            ) : (
              <div className="avatar-row">
                {avatars.map((avatar) => (
                  <button
                    key={avatar.id}
                    className={`avatar-choice${avatar.imageUrl === currentAvatarUrl ? " selected" : ""}`}
                    onClick={() => pickAvatar(avatar)}
                    aria-pressed={avatar.imageUrl === currentAvatarUrl}
                  >
                    {avatar.imageUrl && (
                      <img src={avatar.imageUrl} alt="" className="pixel" />
                    )}
                    <span className="label">{avatar.name ?? "unnamed"}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
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
      setError(
        err instanceof ApiError ? err.message : "Could not create the room",
      );
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="card modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
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
