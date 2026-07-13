import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import type { ArenaSocket } from "../lib/ws";
import { MultiplayerSpaceScene } from "../game/scenes/MultiplayerSpaceScene";
import { formatDuration } from "../lib/format";
import { useArenaChat } from "../hooks/useArenaChat";
import { useArenaConnection } from "../hooks/useArenaConnection";
import { useStudyTimer } from "../hooks/useStudyTimer";
import { useSpaceMusic } from "../hooks/useSpaceMusic";
import { useVideoChat } from "../hooks/useVideoChat";
import { usePresentation, resolveZone } from "../hooks/usePresentation";
import SpaceControls from "../components/SpaceControls";
import WokaPreview from "../components/WokaPreview";
import LeaderboardDialog from "../components/LeaderboardDialog";
import VideoDock from "../components/VideoDock";
import ScreenShareDialog from "../components/ScreenShareDialog";

export default function Arena() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { session } = useAuth();

  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MultiplayerSpaceScene | null>(null);
  const socketRef = useRef<ArenaSocket | null>(null);

  const chat = useArenaChat({ sceneRef, socketRef });
  const conn = useArenaConnection({
    spaceId,
    session,
    canvasRef,
    sceneRef,
    socketRef,
    pushMessage: chat.pushMessage,
  });
  // The room you are standing in is the call you are in.
  const zone = useMemo(
    () => resolveZone(conn.spaceConfig, conn.localTile),
    [conn.spaceConfig, conn.localTile],
  );
  const video = useVideoChat({ enabled: conn.videoEnabled, spaceId, zone });
  const presentation = usePresentation({
    config: conn.spaceConfig,
    tile: conn.localTile,
    zone,
    screenShare: video.screenShare,
  });

  const timer = useStudyTimer(spaceId, sceneRef, conn.studyEnabled);
  const music = useSpaceMusic(conn.musicUrl);

  const [boardOpen, setBoardOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    sceneRef.current?.setKeyboardEnabled(!watching);
  }, [watching]);
  useEffect(() => {
    if (!video.screenShare) setWatching(false);
  }, [video.screenShare]);

  const copyCode = useCallback(async () => {
    if (!conn.spaceCode) return;
    try {
      await navigator.clipboard.writeText(conn.spaceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [conn.spaceCode]);

  const onlineEntries = Object.entries(conn.online);

  return (
    <div className="arena-wrap">
      <div className="arena-canvas" ref={canvasRef} />

      {conn.musicUrl && (
        <audio ref={music.audioRef} src={conn.musicUrl} loop preload="auto" />
      )}

      {conn.videoEnabled && session && (
        <VideoDock
          video={video}
          selfUserId={session.userId}
          selfUsername={session.username}
          meta={conn.meta}
        />
      )}

      <div className="hud top-left">
        <Link to="/" className="btn ghost" style={{ textDecoration: "none" }}>
          ← Leave
        </Link>
        <span className="hud-chip">{conn.spaceName ?? "..."}</span>
        {!conn.isOfficial && conn.spaceCode && (
          <div className="invite">
            <button
              className="btn ghost"
              onClick={() => {
                setCopied(false);
                setInviteOpen((v) => !v);
              }}
            >
              Invite
            </button>
            {inviteOpen && (
              <div className="invite-pop">
                <div className="invite-label">Room code</div>
                <div className="invite-code">{conn.spaceCode}</div>
                <p className="invite-hint">
                  Share this code so others can join your room.
                </p>
                <button className="btn primary invite-copy" onClick={copyCode}>
                  {copied ? "Copied ✓" : "Copy code"}
                </button>
              </div>
            )}
          </div>
        )}
        {conn.status !== "live" && (
          <span className="hud-chip mono">
            {conn.status === "connecting"
              ? "connecting..."
              : conn.status === "closed"
                ? "disconnected"
                : "error"}
          </span>
        )}
      </div>

      <div className="hud top-right">
        <div className="online-list">
          <div className="title">
            online · {onlineEntries.length + (conn.status === "live" ? 1 : 0)}
          </div>
          <ul>
            {conn.status === "live" && (
              <li>
                <span className="online-dot" />
                {conn.meta[session!.userId] && (
                  <WokaPreview
                    appearance={conn.meta[session!.userId]!.appearance}
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
                {conn.meta[userId] && (
                  <WokaPreview
                    appearance={conn.meta[userId]!.appearance}
                    scale={1}
                    className="online-woka"
                  />
                )}
                {conn.meta[userId]?.username ?? userId.slice(0, 8)}
              </li>
            ))}
          </ul>
        </div>
        {conn.studyEnabled && (
          <button className="btn ghost" onClick={() => setBoardOpen(true)}>
            Ranking board
          </button>
        )}
        {music.hasMusic && (
          <button
            className="btn ghost"
            onClick={music.toggleMute}
            title={music.muted ? "Unmute music" : "Mute music"}
          >
            {music.muted ? "🔇 Muted" : "🔊 Music"}
          </button>
        )}
        <SpaceControls />
      </div>

      <div className="hud bottom-center">
        {conn.studyEnabled && (
          <button
            className={`btn timer-btn${timer.startedAt !== null ? " running" : ""}`}
            onClick={timer.toggle}
          >
            {timer.startedAt === null
              ? "▶ Start studying"
              : `■ Stop · ${formatDuration(timer.elapsed)}`}
          </button>
        )}

        {presentation.inRoom && (
          <span className="hud-chip zone-chip">
            🔈 Presentation room · only people in here can hear you
          </span>
        )}

        {presentation.canShare && (
          <button
            className="btn primary present-btn"
            onClick={video.startScreenShare}
          >
            ⧉ Share your screen
          </button>
        )}
        {presentation.canStopSharing && (
          <button
            className="btn present-btn sharing"
            onClick={video.stopScreenShare}
          >
            ■ Stop sharing
          </button>
        )}
        {presentation.canWatch && !watching && (
          <button
            className="btn ghost present-btn"
            onClick={() => setWatching(true)}
          >
            ▶ Watch{" "}
            {video.screenShare!.isSelf
              ? "your screen"
              : `${video.screenShare!.name}'s screen`}
          </button>
        )}
        {presentation.blockedBy && (
          <span className="hud-chip">
            {presentation.blockedBy} is using the projector
          </span>
        )}
        {video.shareError && (
          <span className="hud-chip" style={{ color: "var(--alert)" }}>
            {video.shareError}
          </span>
        )}
        {conn.errorText ? (
          <span className="hud-chip" style={{ color: "var(--alert)" }}>
            {conn.errorText} <Link to="/">Back to rooms</Link>
          </span>
        ) : (
          <span className="hud-chip mono">arrow keys / wasd to move</span>
        )}
      </div>

      <div className={`hud bottom-left chat${chat.chatOpen ? " open" : ""}`}>
        <button
          className="chat-toggle"
          onClick={() => chat.setChatOpen((v) => !v)}
          title={chat.chatOpen ? "Hide chat" : "Show chat"}
        >
          <span className="chat-toggle-label">chat</span>
          <span className="chat-toggle-caret">{chat.chatOpen ? "▾" : "▴"}</span>
        </button>
        {chat.chatOpen && (
          <>
            <div className="chat-log" ref={chat.chatLogRef}>
              {chat.messages.length === 0 ? (
                <div className="chat-empty">
                  Say hi to the room. Messages are visible to everyone here.
                </div>
              ) : (
                chat.messages.map((m) =>
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
                          : (conn.meta[m.userId]?.username ??
                            m.userId.slice(0, 8))}
                      </span>
                      <span className="chat-text">{m.text}</span>
                    </div>
                  ),
                )
              )}
            </div>
            <form className="chat-input-row" onSubmit={chat.sendChat}>
              <input
                ref={chat.chatInputRef}
                className="chat-input"
                value={chat.chatInput}
                onChange={(e) => chat.setChatInput(e.target.value)}
                maxLength={500}
                placeholder="Message the room..."
                disabled={conn.status !== "live"}
              />
              <button
                type="submit"
                className="btn primary chat-send"
                disabled={
                  conn.status !== "live" || chat.chatInput.trim().length === 0
                }
              >
                Send
              </button>
            </form>
          </>
        )}
      </div>

      {watching && video.screenShare && (
        <ScreenShareDialog
          share={video.screenShare}
          onClose={() => setWatching(false)}
        />
      )}

      {boardOpen && <LeaderboardDialog onClose={() => setBoardOpen(false)} />}
    </div>
  );
}
