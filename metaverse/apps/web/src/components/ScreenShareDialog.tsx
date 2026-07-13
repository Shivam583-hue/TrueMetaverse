import { useEffect, useRef } from "react";
import type { ScreenShare } from "../hooks/useVideoChat";

// The projector view. It is a dialog rather than a texture painted onto the
// screen in the map, because a shared screen is mostly text and the projector is
// four tiles wide - readable is worth more here than diegetic.
export default function ScreenShareDialog({
  share,
  onClose,
}: {
  share: ScreenShare;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    // Re-attach on every new track: an element only renders the tracks its
    // stream held when it was attached.
    el.srcObject = share.stream;
    el.play().catch(() => {});
  }, [share.stream]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="share-backdrop"
      onClick={onClose}
      role="presentation"
      data-testid="share-dialog"
    >
      <div
        className="share-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${share.name} is sharing their screen`}
      >
        <div className="share-head">
          <span className="share-title">
            <span className="share-live" />
            {share.isSelf
              ? "You are presenting"
              : `${share.name} is presenting`}
          </span>
          <button className="share-close" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </div>
        <video
          ref={videoRef}
          className="share-video"
          autoPlay
          playsInline
          muted={share.isSelf}
        />
      </div>
    </div>
  );
}
