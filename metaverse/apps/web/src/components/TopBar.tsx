import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import WokaPreview from "./WokaPreview";
import {
  normalizeAppearance,
  type WokaAppearance,
} from "../game/woka/wokaConfig";
import { button } from "../lib/ui";

export default function TopBar() {
  const { session, signout } = useAuth();
  const [appearance, setAppearance] = useState<WokaAppearance | null>(null);

  useEffect(() => {
    if (!session) return;
    api
      .metadataBulk([session.userId])
      .then((res) =>
        setAppearance(normalizeAppearance(res.avatars[0]?.wokaAppearance)),
      )
      .catch(() => {});
  }, [session]);

  if (!session) return null;

  return (
    <header className="sticky top-0 z-10 flex min-h-[66px] min-w-0 items-center justify-between gap-3 border-b border-line bg-midnight/90 px-4 py-3 backdrop-blur-md sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/"
          className="shrink-0 font-pixel text-[0.9rem] font-bold tracking-[0.08em] text-coin no-underline sm:text-[1.05rem]"
        >
          true<span className="text-moonlight">metaverse</span>
        </Link>
        <span className="hidden border-l border-line-strong pl-3 font-mono text-[0.65rem] text-fog sm:inline">
          lobby
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {appearance && (
          <WokaPreview
            appearance={appearance}
            scale={1}
            className="hidden h-9 w-6 shrink-0 pixelated sm:block"
          />
        )}
        <div className="hidden min-w-0 max-w-64 flex-col sm:flex">
          <span className="truncate text-sm font-medium text-[#d7daec]">
            {session.username}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[0.62rem] text-[#86d7ba]">
            <i className="h-[5px] w-[5px] rounded-full bg-portal" /> online
          </span>
        </div>
        <button
          className={`${button.ghost} min-h-9 shrink-0 px-3 py-2 text-xs sm:text-sm`}
          onClick={signout}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
