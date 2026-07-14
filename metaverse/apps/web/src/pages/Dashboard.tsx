import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import ConfirmDialog from "../components/ConfirmDialog";
import WokaCustomizer from "../components/WokaCustomizer";
import WokaPreview from "../components/WokaPreview";
import { api, ApiError } from "../lib/api";
import type { MapTemplate, SpaceSummary } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  type WokaAppearance,
} from "../game/woka/wokaConfig";
import {
  button,
  cx,
  errorClass,
  eyebrowClass,
  inputClass,
  labelClass,
  labelTextClass,
  modalActionsClass,
  modalBackdropClass,
  modalPanelClass,
  mutedClass,
} from "../lib/ui";

const sectionHeadingClass =
  "mb-4 flex min-w-0 flex-wrap items-end justify-between gap-3";
const spaceCardClass =
  "group min-w-0 cursor-pointer overflow-hidden rounded-xl border border-line bg-dusk shadow-sm transition-[transform,border-color,box-shadow] duration-200 ease-out-snappy hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_12px_30px_#05061166] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-portal";
const emptyClass =
  "rounded-xl border border-dashed border-line-strong bg-dusk/60 px-5 py-7 text-center text-sm text-fog";

export default function Dashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [official, setOfficial] = useState<SpaceSummary[]>([]);
  const [spaces, setSpaces] = useState<SpaceSummary[] | null>(null);
  const [appearance, setAppearance] =
    useState<WokaAppearance>(DEFAULT_APPEARANCE);
  const [showWoka, setShowWoka] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<SpaceSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    if (session) {
      api
        .metadataBulk([session.userId])
        .then((res) =>
          setAppearance(normalizeAppearance(res.avatars[0]?.wokaAppearance)),
        )
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

  async function saveAppearance(next: WokaAppearance) {
    setAppearance(next);
    await api.updateWoka(next).catch(() => {});
  }

  function askToDelete(space: SpaceSummary) {
    setDeleteError(null);
    setPendingDelete(space);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteSpace(pendingDelete.id);
      setPendingDelete(null);
      refreshSpaces();
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : "Could not delete the room",
      );
    } finally {
      setDeleting(false);
    }
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
      <main className="mx-auto w-full max-w-[1240px] min-w-0 overflow-x-clip px-4 py-8 sm:px-8 sm:py-10">
        <section className="mb-10 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(300px,380px)] items-center gap-8 max-[820px]:grid-cols-1">
          <div className="min-w-0">
            <p className={eyebrowClass}>YOUR LOBBY</p>
            <h1 className="max-w-3xl break-words font-pixel text-[clamp(1.25rem,3.3vw,2.15rem)] leading-[1.45] text-moonlight [overflow-wrap:anywhere]">
              Welcome back, {session?.username ?? "explorer"}.
            </h1>
            <p className="mt-3 max-w-2xl text-[clamp(0.95rem,2vw,1.08rem)] leading-relaxed text-fog">
              Choose a shared space, meet your crew, and make this session
              count.
            </p>
          </div>

          <form
            className="min-w-0 rounded-xl border border-line-strong bg-dusk p-5 shadow-[0_14px_34px_#05061166] sm:p-6"
            onSubmit={joinByCode}
          >
            <div className="mb-4 flex min-w-0 items-center gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#665623] bg-coin/10 font-pixel text-sm text-coin"
                aria-hidden="true"
              >
                #
              </span>
              <div>
                <p className={`${eyebrowClass} mb-1`}>QUICK JOIN</p>
                <h2 className="font-pixel text-[0.78rem] leading-relaxed text-moonlight">
                  Enter a room code
                </h2>
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 max-[390px]:grid-cols-1">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="QK7M2X"
                maxLength={8}
                aria-label="Room code"
                className={`${inputClass} font-mono uppercase tracking-[0.14em]`}
              />
              <button
                className={button.primary}
                disabled={joinCode.trim().length < 4}
              >
                Join
              </button>
            </div>
            {joinError && (
              <p className={errorClass} role="alert">
                {joinError}
              </p>
            )}
          </form>
        </section>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_310px] items-start gap-8 max-[940px]:grid-cols-1">
          <div className="min-w-0 space-y-10">
            <section className="min-w-0">
              <div className={sectionHeadingClass}>
                <div className="min-w-0">
                  <p className={eyebrowClass}>OPEN SPACES</p>
                  <h2 className="font-pixel text-[0.9rem] leading-relaxed text-moonlight">
                    Start somewhere lively
                  </h2>
                </div>
                <span className="shrink-0 rounded-full border border-line bg-midnight/70 px-3 py-1 font-mono text-[0.67rem] text-fog">
                  {official.length} available
                </span>
              </div>
              {official.length === 0 ? (
                <div className={emptyClass}>
                  No official rooms are open right now.
                </div>
              ) : (
                <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
                  {official.map((space) => (
                    <div
                      key={space.id}
                      className={spaceCardClass}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/space/${space.id}`)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && navigate(`/space/${space.id}`)
                      }
                    >
                      <div className="aspect-[16/8] overflow-hidden border-b border-line bg-[#111326]">
                        {space.thumbnail && (
                          <img
                            className="h-full w-full object-cover transition-transform duration-300 ease-out-snappy group-hover:scale-[1.03]"
                            src={space.thumbnail}
                            alt=""
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 items-center justify-between gap-3 p-4">
                        <span className="truncate font-semibold text-moonlight">
                          {space.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-[#8bdabb]">
                          <i className="h-1.5 w-1.5 rounded-full bg-portal shadow-[0_0_8px_var(--color-portal)]" />{" "}
                          open now
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="min-w-0">
              <div className={sectionHeadingClass}>
                <div className="min-w-0">
                  <p className={eyebrowClass}>YOUR SPACES</p>
                  <h2 className="font-pixel text-[0.9rem] leading-relaxed text-moonlight">
                    Rooms you host
                  </h2>
                </div>
                <button
                  className={button.primary}
                  onClick={() => setShowCreate(true)}
                >
                  New room
                </button>
              </div>
              {error && (
                <p className={errorClass} role="alert">
                  {error}
                </p>
              )}
              {spaces === null && (
                <div className={emptyClass}>Loading your rooms...</div>
              )}
              {spaces && spaces.length === 0 && (
                <div className={emptyClass}>
                  No rooms yet. Create one for your next study crew.
                </div>
              )}
              {spaces && spaces.length > 0 && (
                <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
                  {(spaces ?? []).map((space) => (
                    <div
                      key={space.id}
                      className={spaceCardClass}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/space/${space.id}`)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && navigate(`/space/${space.id}`)
                      }
                    >
                      <div className="aspect-[16/8] overflow-hidden border-b border-line bg-[#111326]">
                        {space.thumbnail && (
                          <img
                            className="h-full w-full object-cover transition-transform duration-300 ease-out-snappy group-hover:scale-[1.03]"
                            src={space.thumbnail}
                            alt=""
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 items-center justify-between gap-3 p-4 pb-3">
                        <span className="truncate font-semibold text-moonlight">
                          {space.name}
                        </span>
                        <button
                          className="shrink-0 rounded-md border border-line-strong bg-midnight px-2 py-1 font-mono text-[0.65rem] tracking-[0.08em] text-coin transition-colors hover:border-coin/60"
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
                      <div className="flex justify-end border-t border-line px-3 py-2.5">
                        <button
                          className={`${button.danger} min-h-8 px-3 py-1.5 text-xs`}
                          onClick={(e) => {
                            e.stopPropagation();
                            askToDelete(space);
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

          <aside className="sticky top-[90px] min-w-0 rounded-xl border border-line bg-dusk p-5 shadow-[0_14px_34px_#05061155] max-[940px]:static">
            <div>
              <p className={eyebrowClass}>PLAYER PROFILE</p>
              <h2 className="font-pixel text-[0.85rem] leading-relaxed text-moonlight">
                Your avatar
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-fog">
                Everyone in a room sees this character.
              </p>
            </div>
            <div className="mt-5 flex min-w-0 items-center gap-5 rounded-xl border border-line bg-midnight/55 p-4 max-[340px]:flex-col">
              <div className="grid min-h-36 min-w-28 shrink-0 place-items-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_50%_30%,#30386e,#111326_70%)]">
                <WokaPreview appearance={appearance} scale={3} animated />
              </div>
              <div className="min-w-0">
                <p className={mutedClass}>Layered, fully customizable.</p>
                <button
                  className={`${button.primary} mt-3 w-full`}
                  onClick={() => setShowWoka(true)}
                >
                  Customize
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {showWoka && (
        <WokaCustomizer
          initial={appearance}
          onClose={() => setShowWoka(false)}
          onSave={saveAppearance}
        />
      )}

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={(spaceId) => navigate(`/space/${spaceId}`)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this room?"
          danger
          busy={deleting}
          error={deleteError}
          confirmLabel="Delete room"
          busyLabel="Deleting..."
          cancelLabel="Keep it"
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        >
          <div className="mb-4 flex min-w-0 items-center gap-3 rounded-lg border border-line bg-midnight/60 p-3">
            <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md bg-[#111326]">
              {pendingDelete.thumbnail && (
                <img
                  className="h-full w-full object-cover"
                  src={pendingDelete.thumbnail}
                  alt=""
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-moonlight">
                {pendingDelete.name}
              </p>
              <p className="mt-1 font-mono text-xs tracking-wider text-coin">
                {pendingDelete.code}
              </p>
            </div>
          </div>
          <p>
            Everyone loses access, and the room code stops working. This cannot
            be undone.
          </p>
        </ConfirmDialog>
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
    <div className={modalBackdropClass} onClick={onClose}>
      <form
        className={modalPanelClass}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="font-pixel text-[0.95rem] leading-relaxed text-moonlight">
          New room
        </h2>

        <label className={`${labelClass} mt-5`}>
          <span className={labelTextClass}>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My space"
            required
            autoFocus
            className={inputClass}
          />
        </label>

        <p className={`${mutedClass} mb-2 mt-4`}>Pick a template</p>
        <div className="grid min-w-0 grid-cols-2 gap-3 max-[420px]:grid-cols-1">
          {maps.map((map) => (
            <button
              key={map.id}
              type="button"
              className={cx(
                "min-w-0 overflow-hidden rounded-lg border bg-midnight text-left transition-[border-color,transform,box-shadow] duration-150 ease-out-snappy hover:-translate-y-px",
                mapId === map.id
                  ? "border-coin shadow-[0_0_0_2px_#f4c94d33]"
                  : "border-line-strong hover:border-[#5b6197]",
              )}
              onClick={() => setMapId(map.id)}
            >
              <img
                className="aspect-[16/8] w-full object-cover"
                src={map.thumbnail}
                alt=""
              />
              <span className="block truncate px-3 pt-2 text-sm font-semibold text-moonlight">
                {map.name}
              </span>
              <span className="block px-3 pb-2 pt-1 font-mono text-[0.65rem] text-fog">
                {map.dimensions}
              </span>
            </button>
          ))}
        </div>

        {error && <p className={errorClass}>{error}</p>}

        <div className={modalActionsClass}>
          <button type="button" className={button.ghost} onClick={onClose}>
            Cancel
          </button>
          <button className={button.primary} disabled={busy || !mapId}>
            {busy ? "Creating..." : "Create room"}
          </button>
        </div>
      </form>
    </div>
  );
}
