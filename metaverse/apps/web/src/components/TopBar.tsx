import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import WokaPreview from "./WokaPreview";
import {
  normalizeAppearance,
  type WokaAppearance,
} from "../game/woka/wokaConfig";

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
    <header className="topbar">
      <div className="topbar-brand">
        <Link to="/" className="wordmark">
          true<span>metaverse</span>
        </Link>
        <span className="topbar-location">lobby</span>
      </div>
      <div className="topbar-user">
        {appearance && (
          <WokaPreview appearance={appearance} scale={1} className="topbar-woka" />
        )}
        <div className="topbar-identity">
          <span className="name">{session.username}</span>
          <span className="topbar-presence">
            <i /> online
          </span>
        </div>
        <button className="btn ghost" onClick={signout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
