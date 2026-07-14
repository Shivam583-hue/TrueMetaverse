import { useEffect, useRef } from "react";
import type { ScreenShare } from "../hooks/useVideoChat";

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
      className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-[#0a0b16cc] p-3 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      role="presentation"
      data-testid="share-dialog"
    >
      <div
        className="flex max-h-full w-full max-w-[1100px] flex-col overflow-hidden rounded-xl border border-line-strong bg-[#14162bf5] shadow-[0_24px_60px_#0009]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${share.name} is sharing their screen`}
      >
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-line px-3 py-2 sm:px-4">
          <span className="flex min-w-0 items-center gap-2 truncate font-pixel text-[0.65rem] text-moonlight sm:text-xs">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-alert shadow-[0_0_0_3px_#ff6b8126]" />
            {share.isSelf
              ? "You are presenting"
              : `${share.name} is presenting`}
          </span>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line-strong bg-transparent text-fog transition-colors hover:bg-dusk-raised hover:text-moonlight focus-visible:outline-2 focus-visible:outline-portal"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close screen share"
          >
            ✕
          </button>
        </div>
        <video
          ref={videoRef}
          className="block min-h-0 w-full max-h-[calc(100dvh-7rem)] bg-black object-contain"
          autoPlay
          playsInline
          muted={share.isSelf}
        />
      </div>
    </div>
  );
}
