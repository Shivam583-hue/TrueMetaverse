import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { api } from "../lib/api";
import { formatDuration } from "../lib/format";
import type { MultiplayerSpaceScene } from "../game/scenes/MultiplayerSpaceScene";

// Owns the study-session timer: loads any active session on mount, keeps a live
// elapsed count, mirrors it into the scene's on-avatar label, and stops the
// session when the arena is left (unmount or the tab going away).
export function useStudyTimer(
  spaceId: string | undefined,
  sceneRef: RefObject<MultiplayerSpaceScene | null>,
) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  startedAtRef.current = startedAt;

  useEffect(() => {
    let disposed = false;
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
    };
  }, []);

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
  }, [startedAt, sceneRef]);

  const toggle = useCallback(async () => {
    if (startedAt === null) {
      const res = await api.study.start(spaceId);
      setStartedAt(new Date(res.startedAt).getTime());
    } else {
      setStartedAt(null);
      await api.study.stop().catch(() => {});
    }
  }, [startedAt, spaceId]);

  return { startedAt, elapsed, toggle };
}
