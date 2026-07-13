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
  zone: string;
  audible: boolean;
};

type Peer = PeerView;

export const OPEN_ZONE = "open";
const ZONE_ATTRIBUTE = "zone";

export type ScreenShare = {
  identity: string;
  userId: string;
  name: string;
  isSelf: boolean;
  stream: MediaStream;
};

const userIdOf = (identity: string) => identity.split(":")[0] ?? identity;

export function useVideoChat({
  enabled,
  spaceId,
  zone = OPEN_ZONE,
}: {
  enabled: boolean;
  spaceId: string | undefined;
  zone?: string;
}) {
  const roomRef = useRef<Room | null>(null);
  const peersRef = useRef(new Map<string, Peer>());
  const localStreamRef = useRef<MediaStream | null>(null);
  const toggleBusyRef = useRef(false);
  const shareBusyRef = useRef(false);
  const spaceIdRef = useRef(spaceId);
  spaceIdRef.current = spaceId;
  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const applyZoneRef = useRef<(() => void) | null>(null);

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

    const zoneOf = (participant: Participant) =>
      participant.attributes?.[ZONE_ATTRIBUTE] || OPEN_ZONE;

    const peerOf = (participant: Participant): Peer => {
      const existing = peersRef.current.get(participant.identity);
      if (existing) return existing;
      const zone = zoneOf(participant);
      const peer: Peer = {
        id: participant.identity,
        userId: userIdOf(participant.identity),
        stream: new MediaStream(),
        mic: false,
        cam: false,
        speaking: false,
        lastSpokeAt: 0,
        joinedAt: Date.now(),
        zone,
        audible: zone === zoneRef.current,
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

      const applyZones = () => {
        const current = room;
        if (!current) return;
        const myZone = zoneRef.current;

        for (const p of current.remoteParticipants.values()) {
          const peer = peerOf(p);
          peer.zone = zoneOf(p);
          peer.audible = peer.zone === myZone;
          if (!peer.audible) peer.speaking = false;

          for (const pub of p.trackPublications.values()) {
            pub.setSubscribed(peer.audible);
          }
        }
        syncPeers();
      };
      applyZoneRef.current = () => {
        const current = room;
        if (!current) return;
        current.localParticipant
          .setAttributes({ [ZONE_ATTRIBUTE]: zoneRef.current })
          .catch((err) => console.error("could not publish zone", err));
        applyZones();
      };

      room = new Room({ adaptiveStream: true, dynacast: true });

      room
        .on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
          readMediaFlags(p, peerOf(p));
          applyZones();
        })
        .on(RoomEvent.ParticipantAttributesChanged, () => applyZones())
        .on(RoomEvent.TrackPublished, () => applyZones())
        .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
          peersRef.current.delete(p.identity);
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
        .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
          const active = new Set(speakers.map((s) => s.identity));
          const now = Date.now();
          for (const peer of peersRef.current.values()) {
            peer.speaking = peer.audible && active.has(peer.id);
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
        await room.connect(url, token, { autoSubscribe: false });
      } catch (err) {
        console.error("livekit connect failed", err);
        return;
      }
      if (cancelled) {
        room.disconnect();
        return;
      }
      roomRef.current = room;

      for (const p of room.remoteParticipants.values()) {
        readMediaFlags(p, peerOf(p));
      }
      applyZoneRef.current?.();
    })();

    return () => {
      cancelled = true;
      const identity = room?.localParticipant?.identity;
      if (identity && room?.localParticipant?.isScreenShareEnabled && spaceId) {
        api.releasePresenter(spaceId, identity).catch(() => {});
      }
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

  useEffect(() => {
    applyZoneRef.current?.();
  }, [zone]);

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
        await api.releasePresenter(space, identity).catch(() => {});
        throw err;
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error && err.name === "NotAllowedError"
            ? null
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

  const audiblePeers = useMemo(() => peers.filter((p) => p.audible), [peers]);

  const slots = useMemo(
    () =>
      [...audiblePeers]
        .sort(
          (a, b) => b.lastSpokeAt - a.lastSpokeAt || a.joinedAt - b.joinedAt,
        )
        .slice(0, 3),
    [audiblePeers],
  );

  return {
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    peers: audiblePeers,
    slots,
    localStream: localStreamRef,
    screenShare,
    shareError,
    startScreenShare,
    stopScreenShare,
    zone,
  };
}
