import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { api } from "./api";

export type Session = {
  token: string;
  userId: string;
  role: "Admin" | "User";
  username: string;
};

type AuthContextValue = {
  session: Session | null;
  signin: (username: string, password: string) => Promise<void>;
  signup: (
    username: string,
    password: string,
    type: "user" | "admin",
  ) => Promise<void>;
  signout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeSession(token: string, username: string): Session {
  const payload = JSON.parse(atob(token.split(".")[1]!));
  return { token, userId: payload.userId, role: payload.role, username };
}

function loadSession(): Session | null {
  const token = localStorage.getItem("tm.token");
  const username = localStorage.getItem("tm.username");
  if (!token || !username) return null;
  try {
    return decodeSession(token, username);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession);

  const signin = useCallback(async (username: string, password: string) => {
    const { token } = await api.signin(username, password);
    localStorage.setItem("tm.token", token);
    localStorage.setItem("tm.username", username);
    setSession(decodeSession(token, username));
  }, []);

  const signup = useCallback(
    async (username: string, password: string, type: "user" | "admin") => {
      await api.signup(username, password, type);
      await signin(username, password);
    },
    [signin],
  );

  const signout = useCallback(() => {
    localStorage.removeItem("tm.token");
    localStorage.removeItem("tm.username");
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, signin, signup, signout }),
    [session, signin, signup, signout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
