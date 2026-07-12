import { useEffect, useLayoutEffect, useRef } from "react";
import type Phaser from "phaser";
import { createSpaceGame } from "../game/main";
import { EventBus, SpaceEvent } from "../game/EventBus";

export default function GameCanvas({ playerName }: { playerName: string }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useLayoutEffect(() => {
    if (!parentRef.current || gameRef.current) return;
    const game = createSpaceGame(parentRef.current);
    gameRef.current = game;
    return () => {
      gameRef.current = null;
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    const announce = () => EventBus.emit(SpaceEvent.PlayerName, playerName);
    EventBus.on(SpaceEvent.SceneReady, announce);
    announce();
    return () => {
      EventBus.off(SpaceEvent.SceneReady, announce);
    };
  }, [playerName]);

  return <div ref={parentRef} className="space-canvas" />;
}
