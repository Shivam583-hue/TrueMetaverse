import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import {
  button,
  errorClass,
  inputClass,
  labelClass,
  labelTextClass,
} from "../lib/ui";

const SPRITES = ["/avatars/wick.png", "/avatars/dai.png", "/avatars/mimi.png"];
const SPRITE_STYLES = [
  "h-28 motion-safe:animate-[auth-bob_2.4s_ease-in-out_infinite]",
  "h-[124px] motion-safe:animate-[auth-bob_2.4s_ease-in-out_0.4s_infinite]",
  "h-[108px] motion-safe:animate-[auth-bob_2.4s_ease-in-out_0.8s_infinite]",
] as const;

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
    <main className="grid min-h-dvh place-items-center overflow-x-hidden bg-[#111326] p-7 max-[540px]:block max-[540px]:p-0">
      <section className="grid min-h-[min(700px,calc(100dvh-56px))] w-full max-w-[1120px] grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] overflow-hidden rounded-lg border border-[#494e7d] bg-[#1d2142] shadow-[0_20px_0_#0d0f20] max-[820px]:grid-cols-1 max-[820px]:shadow-[0_12px_0_#0d0f20] max-[540px]:min-h-dvh max-[540px]:rounded-none max-[540px]:border-0 max-[540px]:shadow-none">
        <div
          className="relative flex min-h-[620px] min-w-0 flex-col overflow-hidden border-r border-[#5fbea7] bg-[#24565d] px-7 py-6 before:pointer-events-none before:absolute before:inset-x-0 before:top-[108px] before:z-0 before:h-[104px] before:border-y-4 before:border-t-[#5cb47f] before:border-b-[#23524f] before:bg-[#397664] before:content-[''] after:pointer-events-none after:absolute after:inset-x-0 after:top-[212px] after:z-0 after:h-12 after:border-b-4 after:border-[#204b49] after:bg-[#2e665b] after:content-[''] max-[820px]:min-h-[315px] max-[820px]:border-r-0 max-[820px]:border-b max-[820px]:px-5 max-[820px]:py-5 max-[540px]:min-h-[410px]"
          aria-hidden="true"
        >
          <div className="relative z-[1] flex justify-between gap-4 font-mono text-[0.64rem] tracking-[0.08em] text-[#b8e9dc] max-[540px]:text-[0.56rem]">
            <span>TRUEMETAVERSE</span>
            <span>LOBBY ACCESS</span>
          </div>
          <div className="relative z-[1] mt-[76px] w-full max-w-[420px] max-[820px]:mt-10 max-[540px]:mt-8">
            <span className="inline-block font-pixel text-[0.62rem] tracking-[0.06em] text-[#ffd35d]">
              STUDY TOGETHER
            </span>
            <h1 className="my-3 max-w-[390px] font-pixel text-[clamp(1.3rem,2.5vw,1.82rem)] leading-[1.58] text-[#fff5d4] max-[540px]:text-[1.12rem]">
              Find your focus in a world with people around.
            </h1>
            <p className="m-0 max-w-[380px] text-[0.95rem] text-[#d6efe5] max-[540px]:text-sm">
              Drop into shared spaces, make a quiet corner your own, and stay on
              task together.
            </p>
          </div>
          <div className="relative z-[1] mt-auto min-h-[230px] overflow-hidden border-4 border-[#142e35] bg-[#183e43] shadow-[inset_0_0_0_4px_#3c826c] max-[820px]:hidden max-[540px]:block max-[540px]:min-h-[98px] max-[540px]:border-[3px] max-[540px]:shadow-[inset_0_0_0_3px_#3c826c]">
            <div className="auth-scene-floor-art absolute inset-x-0 bottom-0 h-[76px] border-t-[5px] border-[#93be58] bg-[#235d4b] max-[540px]:h-[38px] max-[540px]:border-t-[3px]" />
            <div className="absolute top-[22px] left-1/2 -translate-x-1/2 whitespace-nowrap border-[3px] border-[#f6bc35] bg-[#354774] px-3 py-2 font-pixel text-[0.58rem] text-[#fff2c6] shadow-[4px_4px_0_#142e35] max-[540px]:top-[7px] max-[540px]:border-2 max-[540px]:px-1.5 max-[540px]:py-1 max-[540px]:text-[0.45rem] max-[540px]:shadow-[2px_2px_0_#142e35]">
              STUDY LOUNGE
            </div>
            <div className="absolute right-[10%] bottom-9 left-[10%] flex items-end justify-around max-[540px]:right-[14%] max-[540px]:bottom-1 max-[540px]:left-[14%]">
              {SPRITES.map((src, index) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className={`w-auto max-w-[30%] bg-transparent p-0 pixelated drop-shadow-[4px_5px_0_#163e3e] max-[540px]:h-[73px] max-[540px]:drop-shadow-[2px_3px_0_#163e3e] ${SPRITE_STYLES[index]}`}
                />
              ))}
            </div>
          </div>
          <p className="relative z-[1] mt-[18px] mb-0 flex items-center gap-2 font-mono text-[0.7rem] text-[#c8e7da] max-[820px]:mt-auto max-[540px]:mt-3">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#69e6bd] shadow-[0_0_0_3px_#3b7e6b]" />
            Shared rooms are open around the clock
          </p>
        </div>

        <div className="flex min-w-0 flex-col justify-center bg-[#1c1f3c] px-[clamp(28px,5vw,72px)] py-12 max-[820px]:px-[clamp(24px,8vw,80px)] max-[820px]:py-10 max-[540px]:px-[22px] max-[540px]:pt-7 max-[540px]:pb-10">
          <Link
            className="mb-[50px] self-start font-pixel text-[1.06rem] font-bold tracking-[0.02em] text-coin no-underline max-[820px]:mb-9 max-[540px]:mb-8"
            to="/"
          >
            true<span className="text-moonlight">metaverse</span>
          </Link>

          <form className="w-full max-w-[390px]" onSubmit={handleSubmit}>
            <div className="mb-7">
              <span className="inline-block font-pixel text-[0.62rem] tracking-[0.06em] text-[#ffd35d]">
                {isSignup ? "NEW EXPLORER" : "WELCOME BACK"}
              </span>
              <h2 className="mt-2.5 mb-2 font-pixel text-[1.16rem] leading-[1.55] text-[#fff4d2]">
                {isSignup ? "Create your account" : "Enter the lobby"}
              </h2>
              <p className="m-0 text-sm text-[#9da4c6]">
                {isSignup
                  ? "Set up your player profile to join shared study spaces."
                  : "Sign in to pick up where your study session left off."}
              </p>
            </div>

            <label className={`${labelClass} mb-[17px]`}>
              <span
                className={`${labelTextClass} mb-1.5 font-mono text-[0.73rem] text-[#c4c9e1]`}
              >
                Username
              </span>
              <input
                className={`${inputClass} min-h-[46px] rounded-[5px] border-[#444a76] bg-[#14162d]`}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Your player name"
                required
              />
            </label>

            <label className={`${labelClass} mb-[17px]`}>
              <span
                className={`${labelTextClass} mb-1.5 font-mono text-[0.73rem] text-[#c4c9e1]`}
              >
                Password
              </span>
              <input
                className={`${inputClass} min-h-[46px] rounded-[5px] border-[#444a76] bg-[#14162d]`}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder={isSignup ? "Choose a password" : "Your password"}
                required
              />
            </label>

            {isSignup && (
              <label className="mt-0.5 mb-[22px] flex items-start gap-2 text-sm leading-[1.35] text-[#9da4c6]">
                <input
                  className="mt-px h-4 w-4 shrink-0 accent-coin"
                  type="checkbox"
                  checked={asAdmin}
                  onChange={(e) => setAsAdmin(e.target.checked)}
                />
                <span>Give this account admin controls</span>
              </label>
            )}

            {error && (
              <p className={errorClass} role="alert">
                {error}
              </p>
            )}

            <button
              className={`${button.primary} min-h-[45px] w-full`}
              disabled={busy}
            >
              {busy
                ? "Opening lobby..."
                : isSignup
                  ? "Create account"
                  : "Sign in"}
            </button>

            <p className="mt-[22px] text-center text-sm text-[#969dbc] [&_a]:font-semibold [&_a]:text-portal">
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
