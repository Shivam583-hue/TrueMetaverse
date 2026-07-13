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
import { api } from "../lib/api";

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

  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [peers, setPeers] = useState<PeerView[]>([]);

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
          syncPeers();
        })
        .on(
          RoomEvent.TrackSubscribed,
          (
            track: RemoteTrack,
            _pub: RemoteTrackPublication,
            p: RemoteParticipant,
          ) => {
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
            _pub: RemoteTrackPublication,
            p: RemoteParticipant,
          ) => {
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
          if (!track || pub.source !== Track.Source.Camera) return;
          if (!localStreamRef.current)
            localStreamRef.current = new MediaStream();
          localStreamRef.current.addTrack(track);
          syncPeers();
        })
        .on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
          const track = pub.track?.mediaStreamTrack;
          if (!track || !localStreamRef.current) return;
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

      // Seed whoever was already in the room before we joined.
      for (const p of room.remoteParticipants.values()) {
        const peer = peerOf(p);
        readMediaFlags(p, peer);
        for (const pub of p.trackPublications.values()) {
          if (pub.track) peer.stream.addTrack(pub.track.mediaStreamTrack);
        }
      }
      syncPeers();
    })();

    return () => {
      cancelled = true;
      // Safe mid-connect: this aborts the join.
      room?.disconnect();
      roomRef.current = null;
      peersRef.current.clear();
      localStreamRef.current = null;
      setPeers([]);
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
  };
}
