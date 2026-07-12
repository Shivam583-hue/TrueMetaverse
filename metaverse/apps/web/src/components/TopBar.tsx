import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

export default function TopBar() {
  const { session, signout } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    api
      .metadataBulk([session.userId])
      .then((res) => setAvatarUrl(res.avatars[0]?.avatarId ?? null))
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
        {avatarUrl && <img src={avatarUrl} alt="" className="pixel" />}
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
