import { useEffect, useLayoutEffect, useRef } from "react";
import type Phaser from "phaser";
import { createSpaceGame } from "../game/main";
import { EventBus, SpaceEvent } from "../game/EventBus";
import type { WokaAppearance } from "../game/woka/wokaConfig";

export default function GameCanvas({
  playerName,
  appearance,
}: {
  playerName: string;
  appearance?: WokaAppearance;
}) {
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
    const announce = () => {
      EventBus.emit(SpaceEvent.PlayerName, playerName);
      if (appearance) EventBus.emit(SpaceEvent.PlayerAppearance, appearance);
    };
    EventBus.on(SpaceEvent.SceneReady, announce);
    announce();
    return () => {
      EventBus.off(SpaceEvent.SceneReady, announce);
    };
  }, [playerName, appearance]);

  return <div ref={parentRef} className="space-canvas" />;
}
