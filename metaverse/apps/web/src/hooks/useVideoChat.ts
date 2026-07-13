import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  LocalTrackPublication,
  Participant,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  TrackPublication,
} from "livekit-client";
import { api, ApiError } from "../lib/api";

export type PeerView = {
  id: string;
  userId: string;
  stream: MediaStream;
  mic: boolean;
  cam: boolean;
  speaking: boolean;
  lastSpokeAt: number;
  joinedAt: number;
};

type Peer = PeerView;

// Whoever currently holds the projector, and the screen they are sharing. The
// presenter sees their own share here too, so "watch" shows the same thing to
// everyone.
export type ScreenShare = {
  identity: string;
  userId: string;
  name: string;
  isSelf: boolean;
  stream: MediaStream;
};

// The token identity is `${userId}:${tabSuffix}` so one user can open several
// tabs without LiveKit kicking the older session for a duplicate identity.
const userIdOf = (identity: string) => identity.split(":")[0] ?? identity;

// Owns the call for video-enabled spaces: one LiveKit room per space (room name
// = space id), joined with a token minted by the http server. Mic and cam stay
// off until the user turns them on, so joining never prompts for permissions.
// Inert while `enabled` is false: no token is fetched and the SDK is never even
// downloaded (it is dynamically imported below).
export function useVideoChat({
  enabled,
  spaceId,
}: {
  enabled: boolean;
  spaceId: string | undefined;
}) {
  const roomRef = useRef<Room | null>(null);
  const peersRef = useRef(new Map<string, Peer>());
  const localStreamRef = useRef<MediaStream | null>(null);
  const toggleBusyRef = useRef(false);
  const shareBusyRef = useRef(false);
  const spaceIdRef = useRef(spaceId);
  spaceIdRef.current = spaceId;

  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [peers, setPeers] = useState<PeerView[]>([]);
  const [screenShare, setScreenShare] = useState<ScreenShare | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !spaceId) return;

    let cancelled = false;
    let room: Room | null = null;

    const syncPeers = () => {
      if (cancelled) return;
      setPeers([...peersRef.current.values()].map((p) => ({ ...p })));
    };

    const peerOf = (participant: Participant): Peer => {
      const existing = peersRef.current.get(participant.identity);
      if (existing) return existing;
      const peer: Peer = {
        id: participant.identity,
        userId: userIdOf(participant.identity),
        stream: new MediaStream(),
        mic: false,
        cam: false,
        speaking: false,
        lastSpokeAt: 0,
        joinedAt: Date.now(),
      };
      peersRef.current.set(participant.identity, peer);
      return peer;
    };

    (async () => {
      let token: string;
      let url: string;
      try {
        ({ token, url } = await api.livekitToken(spaceId));
      } catch (err) {
        console.error("livekit token request failed", err);
        return;
      }
      if (cancelled) return;

      const { Room, RoomEvent, Track } = await import("livekit-client");
      if (cancelled) return;

      // Publication state is the source of truth for mic/cam: a track can be
      // published but muted, and only an unmuted publication is live.
      const readMediaFlags = (participant: Participant, peer: Peer) => {
        const mic = participant.getTrackPublication(Track.Source.Microphone);
        const cam = participant.getTrackPublication(Track.Source.Camera);
        peer.mic = !!mic && !mic.isMuted;
        peer.cam = !!cam && !cam.isMuted;
      };

      const refreshPeer = (participant: Participant) => {
        const peer = peersRef.current.get(participant.identity);
        if (!peer) return;
        readMediaFlags(participant, peer);
        syncPeers();
      };

      room = new Room({ adaptiveStream: true, dynacast: true });

      room
        .on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
          readMediaFlags(p, peerOf(p));
          syncPeers();
        })
        .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
          peersRef.current.delete(p.identity);
          // A presenter who walks out (or crashes) frees the projector.
          setScreenShare((prev) =>
            prev?.identity === p.identity ? null : prev,
          );
          syncPeers();
        })
        .on(
          RoomEvent.TrackSubscribed,
          (
            track: RemoteTrack,
            pub: RemoteTrackPublication,
            p: RemoteParticipant,
          ) => {
            // A shared screen goes to the projector, not into the peer's card -
            // otherwise it would replace their face in the dock.
            if (pub.source === Track.Source.ScreenShare) {
              setScreenShare({
                identity: p.identity,
                userId: userIdOf(p.identity),
                name: p.name || userIdOf(p.identity),
                isSelf: false,
                stream: new MediaStream([track.mediaStreamTrack]),
              });
              return;
            }
            const peer = peerOf(p);
            peer.stream.addTrack(track.mediaStreamTrack);
            readMediaFlags(p, peer);
            syncPeers();
          },
        )
        .on(
          RoomEvent.TrackUnsubscribed,
          (
            track: RemoteTrack,
            pub: RemoteTrackPublication,
            p: RemoteParticipant,
          ) => {
            if (pub.source === Track.Source.ScreenShare) {
              setScreenShare((prev) =>
                prev?.identity === p.identity ? null : prev,
              );
              return;
            }
            const peer = peersRef.current.get(p.identity);
            if (!peer) return;
            peer.stream.removeTrack(track.mediaStreamTrack);
            readMediaFlags(p, peer);
            syncPeers();
          },
        )
        .on(RoomEvent.TrackMuted, (_pub: TrackPublication, p: Participant) =>
          refreshPeer(p),
        )
        .on(RoomEvent.TrackUnmuted, (_pub: TrackPublication, p: Participant) =>
          refreshPeer(p),
        )
        // LiveKit computes audio levels server-side (already smoothed), which
        // is what ranks the guest slots by who spoke most recently.
        .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
          const active = new Set(speakers.map((s) => s.identity));
          const now = Date.now();
          for (const peer of peersRef.current.values()) {
            peer.speaking = active.has(peer.id);
            if (peer.speaking) peer.lastSpokeAt = now;
          }
          syncPeers();
        })
        .on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
          const track = pub.track?.mediaStreamTrack;
          if (!track) return;
          if (pub.source === Track.Source.ScreenShare) {
            const me = room!.localParticipant;
            setScreenShare({
              identity: me.identity,
              userId: userIdOf(me.identity),
              name: me.name || "you",
              isSelf: true,
              stream: new MediaStream([track]),
            });
            return;
          }
          if (pub.source !== Track.Source.Camera) return;
          if (!localStreamRef.current)
            localStreamRef.current = new MediaStream();
          localStreamRef.current.addTrack(track);
          syncPeers();
        })
        .on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
          const track = pub.track?.mediaStreamTrack;
          if (!track) return;
          if (pub.source === Track.Source.ScreenShare) {
            setScreenShare((prev) => (prev?.isSelf ? null : prev));
            return;
          }
          if (!localStreamRef.current) return;
          localStreamRef.current.removeTrack(track);
          syncPeers();
        })
        .on(RoomEvent.Disconnected, () => {
          peersRef.current.clear();
          syncPeers();
        });

      try {
        await room.connect(url, token);
      } catch (err) {
        console.error("livekit connect failed", err);
        return;
      }
      // Leaving during connect() would otherwise strand a live room.
      if (cancelled) {
        room.disconnect();
        return;
      }
      roomRef.current = room;

      // Seed whoever was already in the room before we joined, including a talk
      // already in progress.
      for (const p of room.remoteParticipants.values()) {
        const peer = peerOf(p);
        readMediaFlags(p, peer);
        for (const pub of p.trackPublications.values()) {
          if (!pub.track) continue;
          if (pub.source === Track.Source.ScreenShare) {
            setScreenShare({
              identity: p.identity,
              userId: userIdOf(p.identity),
              name: p.name || userIdOf(p.identity),
              isSelf: false,
              stream: new MediaStream([pub.track.mediaStreamTrack]),
            });
            continue;
          }
          peer.stream.addTrack(pub.track.mediaStreamTrack);
        }
      }
      syncPeers();
    })();

    return () => {
      cancelled = true;
      // Hand the lectern back on the way out, so leaving mid-talk does not leave
      // the projector locked for everyone else.
      const identity = room?.localParticipant?.identity;
      if (identity && room?.localParticipant?.isScreenShareEnabled && spaceId) {
        api.releasePresenter(spaceId, identity).catch(() => {});
      }
      // Safe mid-connect: this aborts the join.
      room?.disconnect();
      roomRef.current = null;
      peersRef.current.clear();
      localStreamRef.current = null;
      setPeers([]);
      setScreenShare(null);
      setShareError(null);
      setMicOn(false);
      setCamOn(false);
    };
  }, [enabled, spaceId]);

  // setMicrophoneEnabled/setCameraEnabled do the getUserMedia, the publish, and
  // the device release, so the first toggle is what prompts for permission.
  const toggleDevice = useCallback(async (kind: "mic" | "cam") => {
    const room = roomRef.current;
    if (!room || toggleBusyRef.current) return;
    toggleBusyRef.current = true;
    try {
      const local = room.localParticipant;
      if (kind === "mic") {
        await local.setMicrophoneEnabled(!local.isMicrophoneEnabled);
        setMicOn(local.isMicrophoneEnabled);
      } else {
        await local.setCameraEnabled(!local.isCameraEnabled);
        setCamOn(local.isCameraEnabled);
      }
    } catch (err) {
      console.error(
        `${kind === "mic" ? "microphone" : "camera"} access failed`,
        err,
      );
    } finally {
      toggleBusyRef.current = false;
    }
  }, []);

  const toggleMic = useCallback(() => toggleDevice("mic"), [toggleDevice]);
  const toggleCam = useCallback(() => toggleDevice("cam"), [toggleDevice]);

  // Taking the lectern is a server call: it is what grants this session the
  // screen share source, so the SFU rejects anyone who tries to present without
  // it, and it fails if someone else already has the projector.
  const startScreenShare = useCallback(async () => {
    const room = roomRef.current;
    const space = spaceIdRef.current;
    if (!room || !space || shareBusyRef.current) return;
    shareBusyRef.current = true;
    setShareError(null);
    try {
      const identity = room.localParticipant.identity;
      await api.claimPresenter(space, identity);
      try {
        await room.localParticipant.setScreenShareEnabled(true);
      } catch (err) {
        // The browser picker was dismissed, or capture failed. Give the lectern
        // straight back rather than holding it without presenting.
        await api.releasePresenter(space, identity).catch(() => {});
        throw err;
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error && err.name === "NotAllowedError"
            ? null // the user simply cancelled the picker
            : "Could not start sharing";
      if (message) setShareError(message);
    } finally {
      shareBusyRef.current = false;
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    const space = spaceIdRef.current;
    if (!room || !space || shareBusyRef.current) return;
    shareBusyRef.current = true;
    try {
      await room.localParticipant.setScreenShareEnabled(false);
      await api.releasePresenter(space, room.localParticipant.identity);
    } catch (err) {
      console.error("could not stop screen share", err);
    } finally {
      shareBusyRef.current = false;
    }
  }, []);

  // The three guest slots: most recent speakers first, then join order.
  const slots = useMemo(
    () =>
      [...peers]
        .sort(
          (a, b) => b.lastSpokeAt - a.lastSpokeAt || a.joinedAt - b.joinedAt,
        )
        .slice(0, 3),
    [peers],
  );

  return {
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    peers,
    slots,
    localStream: localStreamRef,
    screenShare,
    shareError,
    startScreenShare,
    stopScreenShare,
  };
}
