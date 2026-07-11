import { Navigate, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";

// Arena pulls in Phaser (~1.4MB); keep it out of the main chunk
const Arena = lazy(() => import("./pages/Arena"));

function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/signin" replace />;
  return children;
}

export default function App() {
  const { session } = useAuth();

  return (
    <Routes>
      <Route
        path="/signin"
        element={session ? <Navigate to="/" replace /> : <Auth mode="signin" />}
      />
      <Route
        path="/signup"
        element={session ? <Navigate to="/" replace /> : <Auth mode="signup" />}
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/space/:spaceId"
        element={
          <RequireAuth>
            <Suspense fallback={<div className="arena-wrap" />}>
              <Arena />
            </Suspense>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
