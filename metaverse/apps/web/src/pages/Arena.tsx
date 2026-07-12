import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type Phaser from "phaser";
import { api } from "../lib/api";
import type { LeaderboardEntry, LeaderboardPeriod } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ArenaSocket } from "../lib/ws";
import { createArenaGame } from "../game/main";
import { MultiplayerSpaceScene } from "../game/scenes/MultiplayerSpaceScene";
import SpaceControls from "../components/SpaceControls";
import WokaPreview from "../components/WokaPreview";
import {
  normalizeAppearance,
  type WokaAppearance,
} from "../game/woka/wokaConfig";

type UserMeta = { username: string | null; appearance: WokaAppearance };

type ChatEntry = {
  key: number;
  kind: "user" | "system";
  userId: string;
  text: string;
  at: number;
};

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function Arena() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { session } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MultiplayerSpaceScene | null>(null);
  const socketRef = useRef<ArenaSocket | null>(null);
  const metaRef = useRef(new Map<string, UserMeta>());

  const [spaceName, setSpaceName] = useState<string | null>(null);
  const [online, setOnline] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<Record<string, UserMeta>>({});
  const [status, setStatus] = useState<
    "connecting" | "live" | "closed" | "error"
  >("connecting");
  const [errorText, setErrorText] = useState<string | null>(null);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  startedAtRef.current = startedAt;

  const [boardOpen, setBoardOpen] = useState(false);

  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const chatKeyRef = useRef(0);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!spaceId || !session || !canvasRef.current) return;

    let disposed = false;
    let game: Phaser.Game | null = null;

    let sceneReady = false;
    let pendingSceneWork: (() => void)[] = [];
    const withScene = (fn: (scene: MultiplayerSpaceScene) => void) => {
      if (sceneReady && sceneRef.current) {
        fn(sceneRef.current);
      } else {
        pendingSceneWork.push(() => sceneRef.current && fn(sceneRef.current));
      }
    };

    async function ensureMeta(userIds: string[]) {
      const missing = [...new Set(userIds)].filter(
        (id) => !metaRef.current.has(id),
      );
      if (missing.length === 0) return;
      for (const id of missing)
        metaRef.current.set(id, {
          username: null,
          appearance: normalizeAppearance(null),
        });
      try {
        const res = await api.metadataBulk(missing);
        if (disposed) return;
        for (const m of res.avatars) {
          const entry = {
            username: m.username,
            appearance: normalizeAppearance(m.wokaAppearance),
          };
          metaRef.current.set(m.userId, entry);
          withScene((scene) =>
            scene.setUserMeta(m.userId, entry.username, entry.appearance),
          );
        }
        setMeta(Object.fromEntries(metaRef.current));
      } catch {}
    }

    const pushMessage = (entry: Omit<ChatEntry, "key">) => {
      setMessages((prev) => {
        const next = [...prev, { ...entry, key: chatKeyRef.current++ }];
        return next.length > 200 ? next.slice(-200) : next;
      });
    };

    const nameOf = (userId: string) =>
      metaRef.current.get(userId)?.username ?? userId.slice(0, 8);

    const socket = new ArenaSocket(
      {
        "space-joined": (payload) => {
          setStatus("live");
          setOnline(
            Object.fromEntries(payload.users.map((u) => [u.id, u.userId])),
          );
          ensureMeta([session!.userId, ...payload.users.map((u) => u.userId)]);
          withScene((scene) => {
            scene.spawnLocal(payload.spawn.x, payload.spawn.y, session!.userId);
            for (const u of payload.users)
              scene.addRemote(u.id, u.userId, u.x, u.y);
            for (const [userId, m] of metaRef.current) {
              scene.setUserMeta(userId, m.username, m.appearance);
            }
          });
        },
        "user-joined": (payload) => {
          setOnline((prev) => ({ ...prev, [payload.id]: payload.userId }));
          withScene((scene) =>
            scene.addRemote(payload.id, payload.userId, payload.x, payload.y),
          );
          ensureMeta([payload.userId]).then(() => {
            const m = metaRef.current.get(payload.userId);
            if (m)
              withScene((scene) =>
                scene.setUserMeta(payload.userId, m.username, m.appearance),
              );
            pushMessage({
              kind: "system",
              userId: payload.userId,
              text: `${nameOf(payload.userId)} joined`,
              at: Date.now(),
            });
          });
        },
        movement: (payload) =>
          withScene((scene) =>
            scene.moveRemote(payload.id, payload.x, payload.y),
          ),
        "movement-rejected": (payload) =>
          withScene((scene) => scene.rollbackLocal(payload.x, payload.y)),
        "user-left": (payload) => {
          withScene((scene) => scene.removeRemote(payload.id));
          pushMessage({
            kind: "system",
            userId: payload.userId,
            text: `${nameOf(payload.userId)} left`,
            at: Date.now(),
          });
          setOnline((prev) => {
            const next = { ...prev };
            delete next[payload.id];
            return next;
          });
        },
        chat: (payload) => {
          pushMessage({
            kind: "user",
            userId: payload.userId,
            text: payload.text,
            at: payload.at,
          });
        },
      },
      () => setStatus("closed"),
    );
    socketRef.current = socket;
    socket.join(spaceId, session.token);

    async function boot() {
      let detail;
      try {
        detail = await api.space(spaceId!);
      } catch {
        setStatus("error");
        setErrorText("This room doesn't exist (or was deleted).");
        return;
      }
      if (disposed) return;
      setSpaceName(detail.name);

      const scene = new MultiplayerSpaceScene({
        onSceneReady: () => {
          sceneReady = true;
          for (const work of pendingSceneWork) work();
          pendingSceneWork = [];
        },
        onMoveAttempt: (x, y) => socketRef.current?.move(x, y),
      });
      sceneRef.current = scene;

      game = createArenaGame(canvasRef.current!, detail.mapImage, scene);
    }

    boot();

    api.study
      .me()
      .then((res) => {
        if (!disposed && res.activeSession) {
          setStartedAt(new Date(res.activeSession.startedAt).getTime());
        }
      })
      .catch(() => {});

    const stopOnLeave = () => {
      if (startedAtRef.current !== null) {
        const token = localStorage.getItem("tm.token");
        fetch("/api/v1/study/stop", {
          method: "POST",
          keepalive: true,
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    };
    window.addEventListener("pagehide", stopOnLeave);

    return () => {
      disposed = true;
      window.removeEventListener("pagehide", stopOnLeave);
      stopOnLeave();
      socketRef.current?.close();
      socketRef.current = null;
      sceneRef.current = null;
      game?.destroy(true);
    };
  }, [spaceId, session]);

  useEffect(() => {
    if (startedAt === null) {
      setElapsed(0);
      sceneRef.current?.setLocalTimer(null);
      return;
    }
    const tick = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setElapsed(seconds);
      sceneRef.current?.setLocalTimer(formatDuration(seconds));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const toggleTimer = useCallback(async () => {
    if (startedAt === null) {
      const res = await api.study.start(spaceId);
      setStartedAt(new Date(res.startedAt).getTime());
    } else {
      setStartedAt(null);
      await api.study.stop().catch(() => {});
    }
  }, [startedAt, spaceId]);

  useEffect(() => {
    if (!chatOpen) return;
    const log = chatLogRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, chatOpen]);

  // While the chat is open the game keyboard is disabled, so the avatar stays
  // put and every key (including space and WASD) types into the message box.
  useEffect(() => {
    sceneRef.current?.setKeyboardEnabled(!chatOpen);
    if (chatOpen) chatInputRef.current?.focus();
  }, [chatOpen]);

  const sendChat = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const text = chatInput.trim();
      if (!text) return;
      socketRef.current?.chat(text);
      setChatInput("");
    },
    [chatInput],
  );

  const onlineEntries = Object.entries(online);

  return (
    <div className="arena-wrap">
      <div className="arena-canvas" ref={canvasRef} />

      <div className="hud top-left">
        <Link to="/" className="btn ghost" style={{ textDecoration: "none" }}>
          ← Leave
        </Link>
        <span className="hud-chip">{spaceName ?? "..."}</span>
        {status !== "live" && (
          <span className="hud-chip mono">
            {status === "connecting"
              ? "connecting..."
              : status === "closed"
                ? "disconnected"
                : "error"}
          </span>
        )}
      </div>

      <div className="hud top-right">
        <div className="online-list">
          <div className="title">
            online · {onlineEntries.length + (status === "live" ? 1 : 0)}
          </div>
          <ul>
            {status === "live" && (
              <li>
                <span className="online-dot" />
                {meta[session!.userId] && (
                  <WokaPreview
                    appearance={meta[session!.userId]!.appearance}
                    scale={1}
                    className="online-woka"
                  />
                )}
                {session?.username} (you)
              </li>
            )}
            {onlineEntries.map(([sid, userId]) => (
              <li key={sid}>
                <span className="online-dot" />
                {meta[userId] && (
                  <WokaPreview
                    appearance={meta[userId]!.appearance}
                    scale={1}
                    className="online-woka"
                  />
                )}
                {meta[userId]?.username ?? userId.slice(0, 8)}
              </li>
            ))}
          </ul>
        </div>
        <button className="btn ghost" onClick={() => setBoardOpen(true)}>
          Ranking board
        </button>
        <SpaceControls />
      </div>

      <div className="hud bottom-center">
        <button
          className={`btn timer-btn${startedAt !== null ? " running" : ""}`}
          onClick={toggleTimer}
        >
          {startedAt === null
            ? "▶ Start studying"
            : `■ Stop · ${formatDuration(elapsed)}`}
        </button>
        {errorText ? (
          <span className="hud-chip" style={{ color: "var(--alert)" }}>
            {errorText} <Link to="/">Back to rooms</Link>
          </span>
        ) : (
          <span className="hud-chip mono">arrow keys / wasd to move</span>
        )}
      </div>

      <div className={`hud bottom-left chat${chatOpen ? " open" : ""}`}>
        <button
          className="chat-toggle"
          onClick={() => setChatOpen((v) => !v)}
          title={chatOpen ? "Hide chat" : "Show chat"}
        >
          <span className="chat-toggle-label">chat</span>
          <span className="chat-toggle-caret">{chatOpen ? "▾" : "▴"}</span>
        </button>
        {chatOpen && (
          <>
            <div className="chat-log" ref={chatLogRef}>
              {messages.length === 0 ? (
                <div className="chat-empty">
                  Say hi to the room. Messages are visible to everyone here.
                </div>
              ) : (
                messages.map((m) =>
                  m.kind === "system" ? (
                    <div key={m.key} className="chat-msg system">
                      {m.text}
                    </div>
                  ) : (
                    <div key={m.key} className="chat-msg">
                      <span
                        className={`chat-author${m.userId === session!.userId ? " me" : ""}`}
                      >
                        {m.userId === session!.userId
                          ? "you"
                          : (meta[m.userId]?.username ?? m.userId.slice(0, 8))}
                      </span>
                      <span className="chat-text">{m.text}</span>
                    </div>
                  ),
                )
              )}
            </div>
            <form className="chat-input-row" onSubmit={sendChat}>
              <input
                ref={chatInputRef}
                className="chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={500}
                placeholder="Message the room..."
                disabled={status !== "live"}
              />
              <button
                type="submit"
                className="btn primary chat-send"
                disabled={status !== "live" || chatInput.trim().length === 0}
              >
                Send
              </button>
            </form>
          </>
        )}
      </div>

      {boardOpen && <LeaderboardDialog onClose={() => setBoardOpen(false)} />}
    </div>
  );
}

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "all", label: "all time" },
  { key: "daily", label: "today" },
  { key: "weekly", label: "week" },
  { key: "monthly", label: "month" },
];

function LeaderboardDialog({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    let stale = false;
    setEntries(null);
    api.study
      .leaderboard(period)
      .then((res) => !stale && setEntries(res.entries))
      .catch(() => !stale && setEntries([]));
    return () => {
      stale = true;
    };
  }, [period]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal board" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: "0.95rem", color: "var(--coin)" }}>
          ranking board
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Total study time across every room.
        </p>

        <div className="board-tabs">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={period === p.key ? "active" : ""}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {entries === null ? (
          <p className="muted">Loading...</p>
        ) : entries.length === 0 ? (
          <div className="empty">
            No study sessions yet. Start the timer and claim the top spot.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th></th>
                <th>scholar</th>
                <th style={{ textAlign: "right" }}>time</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.userId}>
                  <td style={{ fontFamily: "var(--font-mono)" }}>
                    {entry.rank}
                  </td>
                  <td>
                    {entry.avatarUrl && (
                      <img src={entry.avatarUrl} alt="" className="pixel" />
                    )}
                  </td>
                  <td>{entry.username}</td>
                  <td
                    style={{
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {formatDuration(entry.totalSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
