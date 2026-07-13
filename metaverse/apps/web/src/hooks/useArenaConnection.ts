import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { RefObject } from "react";
import type Phaser from "phaser";
import { api } from "../lib/api";
import type { Session } from "../lib/auth";
import { ArenaSocket } from "../lib/ws";
import { createArenaGame } from "../game/main";
import { resolveSpaceConfig } from "../game/config/spaces";
import { MultiplayerSpaceScene } from "../game/scenes/MultiplayerSpaceScene";
import {
  normalizeAppearance,
  type WokaAppearance,
} from "../game/woka/wokaConfig";
import type { ChatEntry } from "./useArenaChat";

export type UserMeta = { username: string | null; appearance: WokaAppearance };

export type ConnectionStatus = "connecting" | "live" | "closed" | "error";

// Owns the live arena session: the websocket, the Phaser game/scene lifecycle,
// per-user metadata, and the derived UI state (who's online, room info, status).
// Chat rendering lives elsewhere; this hook just forwards chat/system events to
// the supplied `pushMessage`.
export function useArenaConnection({
  spaceId,
  session,
  canvasRef,
  sceneRef,
  socketRef,
  pushMessage,
}: {
  spaceId: string | undefined;
  session: Session | null;
  canvasRef: RefObject<HTMLDivElement | null>;
  sceneRef: RefObject<MultiplayerSpaceScene | null>;
  socketRef: RefObject<ArenaSocket | null>;
  pushMessage: (entry: Omit<ChatEntry, "key">) => void;
}) {
  const metaRef = useRef(new Map<string, UserMeta>());

  const [spaceName, setSpaceName] = useState<string | null>(null);
  const [spaceCode, setSpaceCode] = useState<string | null>(null);
  const [isOfficial, setIsOfficial] = useState(true);
  const [studyEnabled, setStudyEnabled] = useState(false);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [online, setOnline] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<Record<string, UserMeta>>({});
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [errorText, setErrorText] = useState<string | null>(null);

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
      setSpaceCode(detail.code);
      setIsOfficial(detail.official);

      const config = resolveSpaceConfig(detail.mapImage);
      flushSync(() => {
        setStudyEnabled(config.study === true);
        setMusicUrl(config.music ?? null);
        setVideoEnabled(config.video === true);
      });
      socket.join(spaceId!, session!.token);

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

    return () => {
      disposed = true;
      socketRef.current?.close();
      socketRef.current = null;
      sceneRef.current = null;
      game?.destroy(true);
    };
  }, [spaceId, session, canvasRef, sceneRef, socketRef, pushMessage]);

  return {
    spaceName,
    spaceCode,
    isOfficial,
    studyEnabled,
    musicUrl,
    videoEnabled,
    online,
    meta,
    status,
    errorText,
  };
}
