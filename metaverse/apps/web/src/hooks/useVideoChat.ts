import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SpaceUser } from "@repo/types";
import type { ArenaSocket } from "../lib/ws";
import type { RtcCallbacks } from "./useArenaConnection";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const SPEAKER_POLL_MS = 500;
const SPEAKING_RMS_THRESHOLD = 0.05;
const SPEAKING_HOLD_MS = 1500;

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

type Peer = {
  id: string;
  userId: string;
  pc: RTCPeerConnection;
  stream: MediaStream;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  signalQueue: Promise<void>;
  mic: boolean;
  cam: boolean;
  speaking: boolean;
  lastSpokeAt: number;
  joinedAt: number;
  analyser: AnalyserNode | null;
  analyserSource: MediaStreamAudioSourceNode | null;
};

type SignalData = {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
};

export function useVideoChat({
  enabled,
  socketRef,
}: {
  enabled: boolean;
  socketRef: RefObject<ArenaSocket | null>;
}) {
  const peersRef = useRef(new Map<string, Peer>());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const micOnRef = useRef(false);
  const camOnRef = useRef(false);
  const toggleBusyRef = useRef(false);

  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [peers, setPeers] = useState<PeerView[]>([]);

  const syncPeers = () => {
    setPeers(
      [...peersRef.current.values()].map((p) => ({
        id: p.id,
        userId: p.userId,
        stream: p.stream,
        mic: p.mic,
        cam: p.cam,
        speaking: p.speaking,
        lastSpokeAt: p.lastSpokeAt,
        joinedAt: p.joinedAt,
      })),
    );
  };

  const sendSignal = (to: string, data: SignalData) =>
    socketRef.current?.rtcSignal(to, data);

  const getLocalStream = () => {
    if (!localStreamRef.current) localStreamRef.current = new MediaStream();
    return localStreamRef.current;
  };

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") {
        const resume = () => {
          ctx.resume().catch(() => { });
          window.removeEventListener("pointerdown", resume);
          window.removeEventListener("keydown", resume);
        };
        window.addEventListener("pointerdown", resume);
        window.addEventListener("keydown", resume);
      }
    }
    return audioCtxRef.current;
  };

  const attachAnalyser = (peer: Peer, track: MediaStreamTrack) => {
    try {
      const ctx = getAudioContext();
      peer.analyserSource?.disconnect();
      const source = ctx.createMediaStreamSource(new MediaStream([track]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      peer.analyser = analyser;
      peer.analyserSource = source;
    } catch (error) {
      console.log("Error at attachAnalyser function", error)
    }
  };

  const createPeer = (user: SpaceUser, initiate: boolean) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: Peer = {
      id: user.id,
      userId: user.userId,
      pc,
      stream: new MediaStream(),
      polite: !initiate,
      makingOffer: false,
      ignoreOffer: false,
      signalQueue: Promise.resolve(),
      mic: user.mic === true,
      cam: user.cam === true,
      speaking: false,
      lastSpokeAt: 0,
      joinedAt: Date.now(),
      analyser: null,
      analyserSource: null,
    };
    peersRef.current.set(user.id, peer);

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription)
          sendSignal(peer.id, { description: pc.localDescription });
      } catch (err) {
        console.error("webrtc negotiation failed", err);
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.onicecandidate = (e) => sendSignal(peer.id, { candidate: e.candidate });
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") pc.restartIce();
    };
    pc.ontrack = (e) => {
      peer.stream.addTrack(e.track);
      if (e.track.kind === "audio") attachAnalyser(peer, e.track);
      syncPeers();
    };

    const local = localStreamRef.current;
    if (local) for (const track of local.getTracks()) pc.addTrack(track, local);
    if (initiate) pc.createDataChannel("presence");

    syncPeers();
  };

  const removePeer = (id: string) => {
    const peer = peersRef.current.get(id);
    if (!peer) return;
    peer.analyserSource?.disconnect();
    peer.pc.close();
    peersRef.current.delete(id);
    syncPeers();
  };

  const handleSignal = (from: string, data: unknown) => {
    const peer = peersRef.current.get(from);
    if (!peer || typeof data !== "object" || data === null) return;
    const signal = data as SignalData;
    peer.signalQueue = peer.signalQueue.then(async () => {
      const { pc } = peer;
      if (pc.signalingState === "closed") return;
      try {
        if (signal.description) {
          const description = signal.description;
          const offerCollision =
            description.type === "offer" &&
            (peer.makingOffer || pc.signalingState !== "stable");
          peer.ignoreOffer = !peer.polite && offerCollision;
          if (peer.ignoreOffer) return;
          await pc.setRemoteDescription(description);
          if (description.type === "offer") {
            await pc.setLocalDescription();
            if (pc.localDescription)
              sendSignal(peer.id, { description: pc.localDescription });
          }
        } else if (signal.candidate !== undefined) {
          try {
            await pc.addIceCandidate(signal.candidate ?? undefined);
          } catch (err) {
            if (!peer.ignoreOffer) throw err;
          }
        }
      } catch (err) {
        console.error("webrtc signal failed", err);
      }
    });
  };

  const addLocalTrack = (track: MediaStreamTrack) => {
    const stream = getLocalStream();
    stream.addTrack(track);
    for (const peer of peersRef.current.values()) {
      if (peer.pc.signalingState !== "closed") peer.pc.addTrack(track, stream);
    }
  };

  const stopLocalTracks = (kind: "audio" | "video") => {
    const stream = localStreamRef.current;
    if (!stream) return;
    for (const track of stream.getTracks()) {
      if (track.kind !== kind) continue;
      track.stop();
      stream.removeTrack(track);
      for (const peer of peersRef.current.values()) {
        if (peer.pc.signalingState === "closed") continue;
        const sender = peer.pc.getSenders().find((s) => s.track === track);
        if (sender) peer.pc.removeTrack(sender);
      }
    }
  };

  const toggle = async (kind: "audio" | "video") => {
    if (toggleBusyRef.current) return;
    toggleBusyRef.current = true;
    try {
      const onRef = kind === "audio" ? micOnRef : camOnRef;
      const setOn = kind === "audio" ? setMicOn : setCamOn;
      if (onRef.current) {
        stopLocalTracks(kind);
        onRef.current = false;
        setOn(false);
      } else {
        const media = await navigator.mediaDevices.getUserMedia(
          kind === "audio" ? { audio: true } : { video: true },
        );
        const track = media.getTracks()[0];
        if (!track) return;
        addLocalTrack(track);
        onRef.current = true;
        setOn(true);
      }
      socketRef.current?.mediaState(micOnRef.current, camOnRef.current);
    } catch (err) {
      console.error(
        `${kind === "audio" ? "mic" : "camera"} access failed`,
        err,
      );
    } finally {
      toggleBusyRef.current = false;
    }
  };

  const toggleMic = () => toggle("audio");
  const toggleCam = () => toggle("video");

  const rtc: RtcCallbacks = {
    onPeerJoined: (user, initiate) => {
      if (!enabledRef.current || peersRef.current.has(user.id)) return;
      createPeer(user, initiate);
    },
    onPeerLeft: (id) => removePeer(id),
    onSignal: (from, data) => {
      if (enabledRef.current) handleSignal(from, data);
    },
    onMediaState: (state) => {
      const peer = peersRef.current.get(state.id);
      if (!peer) return;
      peer.mic = state.mic;
      peer.cam = state.cam;
      syncPeers();
    },
  };

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const peer of peersRef.current.values()) {
        let speaking = false;
        if (peer.analyser && peer.mic) {
          const data = new Uint8Array(peer.analyser.fftSize);
          peer.analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) {
            const d = (v - 128) / 128;
            sum += d * d;
          }
          if (Math.sqrt(sum / data.length) > SPEAKING_RMS_THRESHOLD) {
            peer.lastSpokeAt = now;
            speaking = true;
          }
        }
        if (
          !speaking &&
          peer.lastSpokeAt > 0 &&
          now - peer.lastSpokeAt < SPEAKING_HOLD_MS
        ) {
          speaking = true;
        }
        if (speaking !== peer.speaking) {
          peer.speaking = speaking;
          changed = true;
        }
      }
      if (changed) syncPeers();
    }, SPEAKER_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const peerMap = peersRef.current;
    return () => {
      for (const peer of peerMap.values()) {
        peer.analyserSource?.disconnect();
        peer.pc.close();
      }
      peerMap.clear();
      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
          stream.removeTrack(track);
        }
      }
      audioCtxRef.current?.close().catch(() => { });
      audioCtxRef.current = null;
      micOnRef.current = false;
      camOnRef.current = false;
      setMicOn(false);
      setCamOn(false);
      setPeers([]);
    };
  }, [enabled]);

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
    rtc,
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    peers,
    slots,
    localStream: localStreamRef,
  };
}
