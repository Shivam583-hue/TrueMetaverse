import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export function useSpaceMusic(url: string | null): {
  audioRef: RefObject<HTMLAudioElement | null>;
  muted: boolean;
  toggleMute: () => void;
  hasMusic: boolean;
} {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!url || !audio) return;

    audio.muted = false;
    audio.volume = 0.5;
    setMuted(false);

    const play = () => audio.play().catch(() => { });
    play();

    const onInteract = () => {
      play();
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
    window.addEventListener("pointerdown", onInteract);
    window.addEventListener("keydown", onInteract);

    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
      audio.pause();
      audio.currentTime = 0;
    };
  }, [url]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !audio.muted;
    audio.muted = next;
    setMuted(next);
    if (!next) audio.play().catch(() => { });
  }, []);

  return { audioRef, muted, toggleMute, hasMusic: !!url };
}
