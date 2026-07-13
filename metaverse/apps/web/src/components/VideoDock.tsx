import { useEffect, useRef } from "react";
import type { UserMeta } from "../hooks/useArenaConnection";
import type { PeerView, useVideoChat } from "../hooks/useVideoChat";
import WokaPreview from "./WokaPreview";

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
    <div className="video-placeholder">
      {meta ? (
        <span className="video-woka">
          <WokaPreview appearance={meta.appearance} scale={2} />
        </span>
      ) : (
        <span className="video-initial">{name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

// Every peer is audible, whether or not they hold one of the four cards, so
// their audio plays here rather than off the card's <video> (which stays muted).
//
// The track has to be re-attached whenever it changes: a media element only
// renders the tracks its stream held at the moment it was attached, and a peer's
// audio track appears later, when they first switch their mic on.
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

    // Autoplay stays blocked until the tab has seen a gesture.
    window.addEventListener("pointerdown", play);
    window.addEventListener("keydown", play);
    return () => {
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("keydown", play);
    };
  }, [track]);

  return <audio ref={ref} autoPlay playsInline className="video-peer-audio" />;
}

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
    <div className={`video-card${peer.speaking ? " speaking" : ""}`}>
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
      <div className="video-footer">
        <span className="video-name">{name}</span>
        {!peer.mic && (
          <span className="video-muted" title="Mic off">
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
      <div className="hud top-center video-dock">
        <div className="video-card self">
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
          <div className="video-footer">
            <span className="video-name">you</span>
            <div className="video-toggles">
              <button
                className={`video-toggle${video.micOn ? "" : " off"}`}
                onClick={video.toggleMic}
                title={video.micOn ? "Turn mic off" : "Turn mic on"}
              >
                <MicIcon off={!video.micOn} />
              </button>
              <button
                className={`video-toggle${video.camOn ? "" : " off"}`}
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
