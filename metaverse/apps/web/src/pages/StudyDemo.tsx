import GameCanvas from "../components/GameCanvas";
import SpaceControls from "../components/SpaceControls";
import { useAuth } from "../lib/auth";

export default function StudyDemo() {
  const { session } = useAuth();
  return (
    <div className="arena-wrap">
      <GameCanvas
        playerName={session?.username ?? "Ryuga"}
        spaceId="classroom"
      />
      <div className="hud top-right">
        <SpaceControls />
      </div>
    </div>
  );
}
