import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

const SPRITES = ["/avatars/wick.png", "/avatars/dai.png", "/avatars/mimi.png"];

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
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-frame">
        <div className="auth-world" aria-hidden="true">
          <div className="auth-world-topline">
            <span>TRUEMETAVERSE</span>
            <span>LOBBY ACCESS</span>
          </div>
          <div className="auth-world-copy">
            <span className="auth-kicker">STUDY TOGETHER</span>
            <h1>Find your focus in a world with people around.</h1>
            <p>
              Drop into shared spaces, make a quiet corner your own, and stay on
              task together.
            </p>
          </div>
          <div className="auth-scene">
            <div className="auth-scene-floor" />
            <div className="auth-scene-sign">STUDY LOUNGE</div>
            <div className="auth-sprites">
              {SPRITES.map((src, index) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className={`pixel sprite sprite-${index + 1}`}
                />
              ))}
            </div>
          </div>
          <p className="auth-world-status">
            <span /> Shared rooms are open around the clock
          </p>
        </div>

        <div className="auth-form-side">
          <Link className="auth-wordmark wordmark" to="/">
            true<span>metaverse</span>
          </Link>

          <form className="auth-card" onSubmit={handleSubmit}>
            <div className="auth-form-heading">
              <span className="auth-kicker">
                {isSignup ? "NEW EXPLORER" : "WELCOME BACK"}
              </span>
              <h2>{isSignup ? "Create your account" : "Enter the lobby"}</h2>
              <p>
                {isSignup
                  ? "Set up your player profile to join shared study spaces."
                  : "Sign in to pick up where your study session left off."}
              </p>
            </div>

            <label className="field">
              <span className="label">Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Your player name"
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
                placeholder={isSignup ? "Choose a password" : "Your password"}
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
                <span>Give this account admin controls</span>
              </label>
            )}

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <button className="btn primary auth-submit" disabled={busy}>
              {busy
                ? "Opening lobby..."
                : isSignup
                  ? "Create account"
                  : "Sign in"}
            </button>

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
      </section>
    </main>
  );
}
