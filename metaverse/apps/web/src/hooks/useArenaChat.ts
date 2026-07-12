import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
import type { ArenaSocket } from "../lib/ws";
import type { MultiplayerSpaceScene } from "../game/scenes/MultiplayerSpaceScene";

export type ChatEntry = {
  key: number;
  kind: "user" | "system";
  userId: string;
  text: string;
  at: number;
};

const MAX_MESSAGES = 200;

// Owns the room chat: the message log, the input box, open/closed state, and the
// side effects that keep them behaving (auto-scroll, and disabling the game
// keyboard while the box is open so typing doesn't move the avatar).
export function useArenaChat({
  sceneRef,
  socketRef,
}: {
  sceneRef: RefObject<MultiplayerSpaceScene | null>;
  socketRef: RefObject<ArenaSocket | null>;
}) {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const chatKeyRef = useRef(0);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const pushMessage = useCallback((entry: Omit<ChatEntry, "key">) => {
    setMessages((prev) => {
      const next = [...prev, { ...entry, key: chatKeyRef.current++ }];
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
    });
  }, []);

  useEffect(() => {
    if (!chatOpen) return;
    const log = chatLogRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, chatOpen]);

  useEffect(() => {
    sceneRef.current?.setKeyboardEnabled(!chatOpen);
    if (chatOpen) chatInputRef.current?.focus();
  }, [chatOpen, sceneRef]);

  const sendChat = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const text = chatInput.trim();
      if (!text) return;
      socketRef.current?.chat(text);
      setChatInput("");
    },
    [chatInput, socketRef],
  );

  return {
    messages,
    chatInput,
    setChatInput,
    chatOpen,
    setChatOpen,
    chatLogRef,
    chatInputRef,
    pushMessage,
    sendChat,
  };
}
