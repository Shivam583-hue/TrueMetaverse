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
import WhiteboardDialog from "../components/WhiteboardDialog";
import { button, cx, hudBaseClass, hudChipClass, inputClass } from "../lib/ui";

const floatingPanelClass =
  "rounded-xl border border-line bg-[#111326e8] shadow-[0_12px_34px_#05061188] backdrop-blur-md";

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

  const [rankingOpen, setRankingOpen] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    sceneRef.current?.setKeyboardEnabled(!watching && !whiteboardOpen);
  }, [watching, whiteboardOpen]);
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
    <div className="fixed inset-0 min-w-0 overflow-hidden bg-midnight">
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

      <div
        className={`${hudBaseClass} left-3 top-3 max-w-[calc(100vw-6rem)] flex-wrap sm:left-4 sm:top-4 sm:max-w-[calc(100vw-18rem)]`}
      >
        <Link to="/" className={`${button.ghost} min-h-9 bg-midnight/75 px-3`}>
          ← Leave
        </Link>
        <span className={`${hudChipClass} max-w-[min(14rem,50vw)] truncate`}>
          {conn.spaceName ?? "..."}
        </span>
        {!conn.isOfficial && conn.spaceCode && (
          <div className="relative">
            <button
              className={`${button.ghost} min-h-9 bg-midnight/75 px-3`}
              onClick={() => {
                setCopied(false);
                setInviteOpen((v) => !v);
              }}
            >
              Invite
            </button>
            {inviteOpen && (
              <div
                className={`${floatingPanelClass} absolute left-0 top-[calc(100%+0.5rem)] w-[min(18rem,calc(100vw-1.5rem))] p-4`}
              >
                <div className="font-pixel text-[0.6rem] uppercase tracking-wider text-fog">
                  Room code
                </div>
                <div className="my-3 break-all rounded-lg border border-line-strong bg-midnight px-3 py-2 text-center font-mono text-lg font-bold tracking-[0.18em] text-coin">
                  {conn.spaceCode}
                </div>
                <p className="text-sm leading-relaxed text-fog">
                  Share this code so others can join your room.
                </p>
                <button
                  className={`${button.primary} mt-3 w-full`}
                  onClick={copyCode}
                >
                  {copied ? "Copied ✓" : "Copy code"}
                </button>
              </div>
            )}
          </div>
        )}
        {conn.status !== "live" && (
          <span className={`${hudChipClass} font-mono text-xs`}>
            {conn.status === "connecting"
              ? "connecting..."
              : conn.status === "closed"
                ? "disconnected"
                : "error"}
          </span>
        )}
      </div>

      <div
        className={`${hudBaseClass} right-3 top-3 max-w-[min(15rem,42vw)] flex-col items-stretch sm:right-4 sm:top-4 sm:max-w-[17rem]`}
      >
        <div className={`${floatingPanelClass} min-w-0 overflow-hidden`}>
          <div className="border-b border-line px-3 py-2 font-pixel text-[0.58rem] uppercase tracking-wide text-fog">
            online · {onlineEntries.length + (conn.status === "live" ? 1 : 0)}
          </div>
          <ul className="max-h-36 overflow-y-auto px-2 py-1.5">
            {conn.status === "live" && (
              <li className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-xs text-[#d9dced]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-portal shadow-[0_0_7px_var(--color-portal)]" />
                {conn.meta[session!.userId] && (
                  <WokaPreview
                    appearance={conn.meta[session!.userId]!.appearance}
                    scale={1}
                    className="h-6 w-4 shrink-0 pixelated"
                  />
                )}
                <span className="min-w-0 flex-1 truncate">
                  {session?.username} (you)
                </span>
                {conn.isTeacher && (
                  <span className="shrink-0 rounded bg-coin/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase text-coin">
                    Teacher
                  </span>
                )}
              </li>
            )}
            {onlineEntries.map(([sid, userId]) => (
              <li
                key={sid}
                className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-xs text-[#d9dced]"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-portal shadow-[0_0_7px_var(--color-portal)]" />
                {conn.meta[userId] && (
                  <WokaPreview
                    appearance={conn.meta[userId]!.appearance}
                    scale={1}
                    className="h-6 w-4 shrink-0 pixelated"
                  />
                )}
                <span className="min-w-0 flex-1 truncate">
                  {conn.meta[userId]?.username ?? userId.slice(0, 8)}
                </span>
                {conn.teacher?.userId === userId && (
                  <span className="shrink-0 rounded bg-coin/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase text-coin">
                    Teacher
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        {conn.whiteboardEnabled && (
          <button
            className={`${button.primary} min-w-0 px-3 text-xs sm:text-sm`}
            onClick={() => setWhiteboardOpen(true)}
          >
            <span className="text-base" aria-hidden="true">
              ✎
            </span>
            Open whiteboard
          </button>
        )}
        {conn.studyEnabled && (
          <button
            className={`${button.ghost} bg-midnight/75 px-3 text-xs sm:text-sm`}
            onClick={() => setRankingOpen(true)}
          >
            Ranking board
          </button>
        )}
        {music.hasMusic && (
          <button
            className={`${button.ghost} bg-midnight/75 px-3 text-xs sm:text-sm`}
            onClick={music.toggleMute}
            title={music.muted ? "Unmute music" : "Mute music"}
          >
            {music.muted ? "🔇 Muted" : "🔊 Music"}
          </button>
        )}
        <SpaceControls />
      </div>

      <div
        className={`${hudBaseClass} bottom-3 left-1/2 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap justify-center sm:bottom-4`}
      >
        {conn.studyEnabled && (
          <button
            className={cx(
              button.ghost,
              "bg-midnight/85 px-3 text-xs sm:text-sm",
              timer.startedAt !== null &&
                "border-alert bg-alert/15 text-[#ff9aaa]",
            )}
            onClick={timer.toggle}
          >
            {timer.startedAt === null
              ? "▶ Start studying"
              : `■ Stop · ${formatDuration(timer.elapsed)}`}
          </button>
        )}

        {presentation.inRoom && (
          <span className={`${hudChipClass} text-center text-xs sm:text-sm`}>
            🔈 Presentation room · only people in here can hear you
          </span>
        )}

        {presentation.canShare && (
          <button
            className={`${button.primary} px-3 text-xs sm:text-sm`}
            onClick={video.startScreenShare}
          >
            ⧉ Share your screen
          </button>
        )}
        {presentation.canStopSharing && (
          <button
            className={`${button.dangerSolid} px-3 text-xs sm:text-sm`}
            onClick={video.stopScreenShare}
          >
            ■ Stop sharing
          </button>
        )}
        {presentation.canWatch && !watching && (
          <button
            className={`${button.ghost} bg-midnight/85 px-3 text-xs sm:text-sm`}
            onClick={() => setWatching(true)}
          >
            ▶ Watch{" "}
            {video.screenShare!.isSelf
              ? "your screen"
              : `${video.screenShare!.name}'s screen`}
          </button>
        )}
        {presentation.blockedBy && (
          <span className={`${hudChipClass} text-xs sm:text-sm`}>
            {presentation.blockedBy} is using the projector
          </span>
        )}
        {video.shareError && (
          <span className={`${hudChipClass} text-alert`}>
            {video.shareError}
          </span>
        )}
        {conn.errorText ? (
          <span className={`${hudChipClass} text-alert`}>
            {conn.errorText} <Link to="/">Back to rooms</Link>
          </span>
        ) : (
          <span className={`${hudChipClass} font-mono text-[0.65rem]`}>
            arrow keys / wasd to move
          </span>
        )}
      </div>

      <div
        className={cx(
          hudBaseClass,
          floatingPanelClass,
          "bottom-3 left-3 w-[min(23rem,calc(100vw-1.5rem))] flex-col items-stretch overflow-hidden sm:bottom-4 sm:left-4",
        )}
      >
        <button
          className="flex min-h-10 w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-moonlight hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-portal"
          onClick={() => chat.setChatOpen((v) => !v)}
          title={chat.chatOpen ? "Hide chat" : "Show chat"}
        >
          <span>chat</span>
          <span className="font-mono text-fog">
            {chat.chatOpen ? "▾" : "▴"}
          </span>
        </button>
        {chat.chatOpen && (
          <>
            <div
              className="max-h-48 min-h-20 space-y-2 overflow-y-auto border-t border-line px-3 py-3 text-sm"
              ref={chat.chatLogRef}
            >
              {chat.messages.length === 0 ? (
                <div className="py-3 text-center text-xs leading-relaxed text-fog">
                  Say hi to the room. Messages are visible to everyone here.
                </div>
              ) : (
                chat.messages.map((m) =>
                  m.kind === "system" ? (
                    <div
                      key={m.key}
                      className="font-mono text-[0.67rem] italic text-fog"
                    >
                      {m.text}
                    </div>
                  ) : (
                    <div key={m.key} className="flex min-w-0 gap-2">
                      <span
                        className={cx(
                          "max-w-24 shrink-0 truncate font-semibold text-[#8fa5ff]",
                          m.userId === session!.userId && "text-portal",
                        )}
                      >
                        {m.userId === session!.userId
                          ? "you"
                          : (conn.meta[m.userId]?.username ??
                            m.userId.slice(0, 8))}
                      </span>
                      <span className="min-w-0 break-words text-[#d9dced] [overflow-wrap:anywhere]">
                        {m.text}
                      </span>
                    </div>
                  ),
                )
              )}
            </div>
            <form
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-line p-2.5"
              onSubmit={chat.sendChat}
            >
              <input
                ref={chat.chatInputRef}
                className={`${inputClass} min-h-10 py-1.5`}
                value={chat.chatInput}
                onChange={(e) => chat.setChatInput(e.target.value)}
                maxLength={500}
                placeholder="Message the room..."
                disabled={conn.status !== "live"}
              />
              <button
                type="submit"
                className={`${button.primary} min-h-10 px-3`}
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

      {whiteboardOpen && conn.whiteboardEnabled && (
        <WhiteboardDialog
          teacherName={conn.teacher?.username ?? "Classroom creator"}
          isTeacher={conn.isTeacher}
          elements={conn.whiteboardScene?.elements ?? []}
          sceneVersion={conn.whiteboardScene?.version ?? 0}
          onElementsChange={conn.publishWhiteboard}
          onClose={() => setWhiteboardOpen(false)}
        />
      )}

      {rankingOpen && (
        <LeaderboardDialog onClose={() => setRankingOpen(false)} />
      )}
    </div>
  );
}
