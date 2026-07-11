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
      <Link to="/" className="wordmark">
        true<span>metaverse</span>
      </Link>
      <div className="topbar-user">
        {session.role === "Admin" && (
          <Link to="/admin" className="btn ghost" style={{ textDecoration: "none" }}>
            Admin
          </Link>
        )}
        {avatarUrl && <img src={avatarUrl} alt="" className="pixel" />}
        <span className="name">{session.username}</span>
        {session.role === "Admin" && <span className="role">admin</span>}
        <button className="btn ghost" onClick={signout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
