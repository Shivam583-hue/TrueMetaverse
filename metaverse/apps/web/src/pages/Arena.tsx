import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Phaser from "phaser";
import { api } from "../lib/api";
import type { Element } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ArenaSocket } from "../lib/ws";
import { ArenaScene } from "../game/ArenaScene";
import type { EditMode } from "../game/ArenaScene";

type UserMeta = { username: string | null; avatarUrl: string | null };

export default function Arena() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { session } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ArenaScene | null>(null);
  const socketRef = useRef<ArenaSocket | null>(null);
  const metaRef = useRef(new Map<string, UserMeta>());

  const [spaceName, setSpaceName] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [online, setOnline] = useState<Record<string, string>>({}); // sessionId -> userId
  const [meta, setMeta] = useState<Record<string, UserMeta>>({});
  const [status, setStatus] = useState<"connecting" | "live" | "closed" | "error">("connecting");
  const [errorText, setErrorText] = useState<string | null>(null);

  const [palette, setPalette] = useState<Element[]>([]);
  const [editMode, setEditMode] = useState<EditMode>("off");
  const [placeElementId, setPlaceElementId] = useState<string | null>(null);

  const editRef = useRef({ mode: editMode as EditMode, placeElementId });
  editRef.current = { mode: editMode, placeElementId };

  useEffect(() => {
    if (!spaceId || !session || !canvasRef.current) return;

    let disposed = false;
    let game: Phaser.Game | null = null;

    async function ensureMeta(userIds: string[]) {
      const missing = [...new Set(userIds)].filter((id) => !metaRef.current.has(id));
      if (missing.length === 0) return;
      // reserve before await so concurrent joins don't double-fetch
      for (const id of missing) metaRef.current.set(id, { username: null, avatarUrl: null });
      try {
        const res = await api.metadataBulk(missing);
        if (disposed) return;
        for (const m of res.avatars) {
          const entry = { username: m.username, avatarUrl: m.avatarId ?? null };
          metaRef.current.set(m.userId, entry);
          sceneRef.current?.setUserMeta(m.userId, entry.username, entry.avatarUrl);
        }
        setMeta(Object.fromEntries(metaRef.current));
      } catch {
        // labels just stay blank; not fatal
      }
    }

    async function boot() {
      let detail;
      try {
        detail = await api.space(spaceId!);
      } catch {
        setStatus("error");
        setErrorText("This space doesn't exist (or was deleted).");
        return;
      }
      const mine = await api
        .mySpaces()
        .then((r) => r.spaces.find((s) => s.id === spaceId))
        .catch(() => undefined);
      if (disposed) return;
      setIsCreator(!!mine);
      setSpaceName(mine?.name ?? null);
      if (mine) {
        api.elements().then((r) => setPalette(r.elements)).catch(() => {});
      }

      const scene = new ArenaScene(detail, {
        onSceneReady: () => {
          const socket = new ArenaSocket(
            {
              "space-joined": (payload) => {
                setStatus("live");
                scene.spawnLocal(payload.spawn.x, payload.spawn.y, session!.userId);
                setOnline(Object.fromEntries(payload.users.map((u) => [u.id, u.userId])));
                for (const u of payload.users) scene.addRemote(u.id, u.userId, u.x, u.y);
                ensureMeta([session!.userId, ...payload.users.map((u) => u.userId)]);
              },
              "user-joined": (payload) => {
                scene.addRemote(payload.id, payload.userId, payload.x, payload.y);
                setOnline((prev) => ({ ...prev, [payload.id]: payload.userId }));
                ensureMeta([payload.userId]).then(() => {
                  const m = metaRef.current.get(payload.userId);
                  if (m) scene.setUserMeta(payload.userId, m.username, m.avatarUrl);
                });
              },
              movement: (payload) => scene.moveRemote(payload.id, payload.x, payload.y),
              "movement-rejected": (payload) => scene.rollbackLocal(payload.x, payload.y),
              "user-left": (payload) => {
                scene.removeRemote(payload.id);
                setOnline((prev) => {
                  const next = { ...prev };
                  delete next[payload.id];
                  return next;
                });
              },
            },
            () => setStatus("closed"),
          );
          socketRef.current = socket;
          socket.join(spaceId!, session!.token);
        },
        onMoveAttempt: (x, y) => socketRef.current?.move(x, y),
        onTileClick: async (x, y) => {
          const { mode, placeElementId } = editRef.current;
          try {
            if (mode === "place" && placeElementId) {
              await api.addSpaceElement(spaceId!, placeElementId, x, y);
            } else if (mode === "erase") {
              const id = sceneRef.current?.elementAt(x, y);
              if (!id) return;
              await api.deleteSpaceElement(id);
            } else {
              return;
            }
            const fresh = await api.space(spaceId!);
            sceneRef.current?.setElements(fresh.elements);
          } catch {
            // e.g. placing out of bounds; leave the board as-is
          }
        },
      });
      sceneRef.current = scene;

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: canvasRef.current!,
        scene,
        pixelArt: true,
        backgroundColor: "#14162b",
        scale: {
          mode: Phaser.Scale.RESIZE,
          width: "100%",
          height: "100%",
        },
      });
    }

    boot();

    return () => {
      disposed = true;
      socketRef.current?.close();
      socketRef.current = null;
      sceneRef.current = null;
      game?.destroy(true);
    };
  }, [spaceId, session]);

  useEffect(() => {
    sceneRef.current?.setEditMode(editMode);
  }, [editMode]);

  const onlineEntries = Object.entries(online);

  return (
    <div className="arena-wrap">
      <div className="arena-canvas" ref={canvasRef} />

      <div className="hud top-left">
        <Link to="/" className="btn ghost" style={{ textDecoration: "none" }}>
          ← Leave
        </Link>
        <span className="hud-chip">{spaceName ?? `space ${spaceId?.slice(0, 6)}`}</span>
        {status !== "live" && (
          <span className="hud-chip mono">
            {status === "connecting" ? "connecting..." : status === "closed" ? "disconnected" : "error"}
          </span>
        )}
      </div>

      <div className="hud top-right">
        <div className="online-list">
          <div className="title">online · {onlineEntries.length + (status === "live" ? 1 : 0)}</div>
          <ul>
            {status === "live" && (
              <li>
                <span className="online-dot" />
                {meta[session!.userId]?.avatarUrl && (
                  <img src={meta[session!.userId]!.avatarUrl!} alt="" className="pixel" />
                )}
                {session?.username} (you)
              </li>
            )}
            {onlineEntries.map(([sid, userId]) => (
              <li key={sid}>
                <span className="online-dot" />
                {meta[userId]?.avatarUrl && (
                  <img src={meta[userId]!.avatarUrl!} alt="" className="pixel" />
                )}
                {meta[userId]?.username ?? userId.slice(0, 8)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {errorText ? (
        <div className="hud bottom-center">
          <span className="hud-chip" style={{ color: "var(--alert)" }}>
            {errorText} <Link to="/">Back to your spaces</Link>
          </span>
        </div>
      ) : (
        <div className="hud bottom-center">
          <span className="hud-chip mono">
            {editMode === "off"
              ? "arrow keys / wasd to move"
              : editMode === "place"
                ? "click a tile to place - press Done to walk again"
                : "click an element to remove it"}
          </span>
        </div>
      )}

      {isCreator && (
        <div className="palette">
          <div className="title">build</div>
          {editMode === "off" ? (
            <button className="btn" style={{ width: "100%" }} onClick={() => setEditMode("erase")}>
              Edit space
            </button>
          ) : (
            <>
              <div className="palette-grid">
                {palette.map((el) => (
                  <button
                    key={el.id}
                    className={`palette-item${editMode === "place" && placeElementId === el.id ? " selected" : ""}`}
                    onClick={() => {
                      setPlaceElementId(el.id);
                      setEditMode("place");
                    }}
                    title={el.static ? "blocks walking" : "walkable"}
                  >
                    <img src={el.imageUrl} alt="" className="pixel" />
                  </button>
                ))}
              </div>
              <button
                className={`btn${editMode === "erase" ? " danger" : " ghost"}`}
                style={{ width: "100%", marginTop: "0.4rem" }}
                onClick={() => setEditMode("erase")}
              >
                Eraser
              </button>
              <button
                className="btn primary"
                style={{ width: "100%", marginTop: "0.4rem" }}
                onClick={() => {
                  setEditMode("off");
                  setPlaceElementId(null);
                }}
              >
                Done
              </button>
              <p className="hint">Changes save instantly for everyone who joins later.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
