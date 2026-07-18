import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

function tokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { exp?: number };
    if (!payload.exp) return false;
    return payload.exp * 1000 < Date.now() - 5_000;
  } catch {
    return true;
  }
}

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  if (!token || tokenExpired(token)) {
    if (token) logout();
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
