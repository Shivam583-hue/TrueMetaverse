import { useEffect, useRef } from "react";
import type { UserMeta } from "../hooks/useArenaConnection";
import type { PeerView, useVideoChat } from "../hooks/useVideoChat";
import WokaPreview from "./WokaPreview";
import { cx, hudBaseClass } from "../lib/ui";

type VideoChat = ReturnType<typeof useVideoChat>;

function attachStream(el: HTMLVideoElement | null, stream: MediaStream | null) {
  if (el && stream && el.srcObject !== stream) el.srcObject = stream;
}

function MicIcon({ off = false }: { off?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {off ? (
        <>
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
          <line x1="12" y1="19" x2="12" y2="23" />
        </>
      ) : (
        <>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
        </>
      )}
    </svg>
  );
}

function CamIcon({ off = false }: { off?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {off ? (
        <>
          <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
        </>
      )}
    </svg>
  );
}

function Placeholder({ meta, name }: { meta?: UserMeta; name: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_120%_90%_at_50%_30%,var(--color-dusk-raised),var(--color-midnight)_82%)] pb-3.5">
      {meta ? (
        <span className="video-woka-art relative flex">
          <WokaPreview appearance={meta.appearance} scale={2} />
        </span>
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-dusk-raised font-pixel text-sm text-portal">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function PeerAudio({ peer }: { peer: PeerView }) {
  const ref = useRef<HTMLAudioElement>(null);
  const track = peer.stream.getAudioTracks()[0] ?? null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!track) {
      el.srcObject = null;
      return;
    }

    el.srcObject = new MediaStream([track]);
    const play = () => el.play().catch(() => {});
    play();

    window.addEventListener("pointerdown", play);
    window.addEventListener("keydown", play);
    return () => {
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("keydown", play);
    };
  }, [track]);

  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

const videoCardClass =
  "relative aspect-video w-[clamp(112px,14vw,176px)] shrink-0 overflow-hidden rounded-[10px] border border-line bg-midnight shadow-[0_6px_18px_#00000059] transition-[border-color,box-shadow] duration-150 [&>video]:block [&>video]:h-full [&>video]:w-full [&>video]:bg-black [&>video]:object-cover";

const videoToggleClass =
  "grid h-6 w-6 place-items-center rounded-full border border-line-strong bg-[#262a52cc] p-0 text-moonlight transition-colors hover:border-[#4a4f8a] hover:bg-dusk-raised focus-visible:outline-2 focus-visible:outline-portal [&>svg]:h-3 [&>svg]:w-3";

function PeerCard({
  peer,
  name,
  meta,
}: {
  peer: PeerView;
  name: string;
  meta?: UserMeta;
}) {
  return (
    <div
      className={cx(
        videoCardClass,
        peer.speaking &&
          "border-portal shadow-[0_0_0_1px_var(--color-portal),0_0_14px_#3ee6c14d]",
      )}
    >
      {peer.cam ? (
        <video
          autoPlay
          playsInline
          muted
          ref={(el) => attachStream(el, peer.stream)}
        />
      ) : (
        <Placeholder meta={meta} name={name} />
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-b from-transparent to-[#14162bcc] px-1.5 pt-3 pb-1">
        <span className="max-w-[70%] truncate font-mono text-[0.6rem] leading-5 text-moonlight drop-shadow">
          {name}
        </span>
        {!peer.mic && (
          <span
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-alert/35 bg-[#14162bcc] text-alert [&>svg]:h-2.5 [&>svg]:w-2.5"
            title="Mic off"
          >
            <MicIcon off />
          </span>
        )}
      </div>
    </div>
  );
}

export default function VideoDock({
  video,
  selfUserId,
  selfUsername,
  meta,
}: {
  video: VideoChat;
  selfUserId: string;
  selfUsername: string;
  meta: Record<string, UserMeta>;
}) {
  const nameOf = (userId: string) =>
    meta[userId]?.username ?? userId.slice(0, 8);

  return (
    <>
      <div
        className={`${hudBaseClass} top-20 left-1/2 max-w-[calc(100vw-1rem)] -translate-x-1/2 gap-2 overflow-x-auto rounded-xl sm:top-4`}
      >
        <div className={videoCardClass}>
          {video.camOn ? (
            <video
              autoPlay
              playsInline
              muted
              ref={(el) => attachStream(el, video.localStream.current)}
            />
          ) : (
            <Placeholder meta={meta[selfUserId]} name={selfUsername} />
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-b from-transparent to-[#14162bcc] px-1.5 pt-3 pb-1">
            <span className="max-w-[60%] truncate font-mono text-[0.6rem] leading-5 text-portal drop-shadow">
              you
            </span>
            <div className="flex gap-1">
              <button
                className={cx(
                  videoToggleClass,
                  !video.micOn && "border-alert/35 bg-[#3b1b2ecc] text-alert",
                )}
                onClick={video.toggleMic}
                title={video.micOn ? "Turn mic off" : "Turn mic on"}
              >
                <MicIcon off={!video.micOn} />
              </button>
              <button
                className={cx(
                  videoToggleClass,
                  !video.camOn && "border-alert/35 bg-[#3b1b2ecc] text-alert",
                )}
                onClick={video.toggleCam}
                title={video.camOn ? "Turn camera off" : "Turn camera on"}
              >
                <CamIcon off={!video.camOn} />
              </button>
            </div>
          </div>
        </div>

        {video.slots.map((peer) => (
          <PeerCard
            key={peer.id}
            peer={peer}
            name={nameOf(peer.userId)}
            meta={meta[peer.userId]}
          />
        ))}
      </div>

      {video.peers.map((peer) => (
        <PeerAudio key={peer.id} peer={peer} />
      ))}
    </>
  );
}
