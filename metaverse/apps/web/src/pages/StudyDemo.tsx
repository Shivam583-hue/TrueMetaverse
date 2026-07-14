import GameCanvas from "../components/GameCanvas";
import SpaceControls from "../components/SpaceControls";
import { useAuth } from "../lib/auth";
import { hudBaseClass } from "../lib/ui";

export default function StudyDemo() {
  const { session } = useAuth();
  return (
    <div className="fixed inset-0 overflow-hidden bg-midnight">
      <GameCanvas
        playerName={session?.username ?? "Ryuga"}
        spaceId="classroom"
      />
      <div className={`${hudBaseClass} right-4 top-4`}>
        <SpaceControls />
      </div>
    </div>
  );
}
