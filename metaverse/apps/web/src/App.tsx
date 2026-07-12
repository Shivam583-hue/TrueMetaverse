import { Navigate, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";

const Arena = lazy(() => import("./pages/Arena"));
const StudyDemo = lazy(() => import("./pages/StudyDemo"));

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
      <Route
        path="/study-demo"
        element={
          <Suspense fallback={<div className="arena-wrap" />}>
            <StudyDemo />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
