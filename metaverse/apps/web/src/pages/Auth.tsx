import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

const SPRITE_SEEDS = ["Ember", "Nova", "Scout", "Robo", "Juniper"];

export default function Auth({ mode }: { mode: "signin" | "signup" }) {
  const { signin, signup } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [asAdmin, setAsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isSignup) {
        await signup(username, password, asAdmin ? "admin" : "user");
      } else {
        await signin(username, password);
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div>
        <div className="auth-hero">
          <span className="wordmark">
            true<span>metaverse</span>
          </span>
          <p>a tiny world for your team to walk around in</p>
          <div className="auth-sprites">
            {SPRITE_SEEDS.map((seed) => (
              <img
                key={seed}
                src={`https://api.dicebear.com/9.x/pixel-art/png?size=64&seed=${seed}`}
                alt=""
                className="pixel"
              />
            ))}
          </div>
        </div>

        <form className="card auth-card" onSubmit={handleSubmit}>
          <h2 style={{ fontSize: "0.95rem" }}>{isSignup ? "create account" : "sign in"}</h2>

          <label className="field">
            <span className="label">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="field">
            <span className="label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
            />
          </label>

          {isSignup && (
            <label className="check">
              <input
                type="checkbox"
                checked={asAdmin}
                onChange={(e) => setAsAdmin(e.target.checked)}
              />
              Admin account (can manage elements, avatars, and maps)
            </label>
          )}

          {error && <p className="error">{error}</p>}

          <div style={{ marginTop: "1.1rem" }}>
            <button className="btn primary" style={{ width: "100%" }} disabled={busy}>
              {busy ? "..." : isSignup ? "Create account" : "Sign in"}
            </button>
          </div>

          <p className="swap">
            {isSignup ? (
              <>
                Already have an account? <Link to="/signin">Sign in</Link>
              </>
            ) : (
              <>
                New here? <Link to="/signup">Create an account</Link>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
