import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import type { PublicUser } from "../types";

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    const userRaw = params.get("user");
    if (!accessToken || !refreshToken || !userRaw) {
      setError("Missing OAuth tokens. Try signing in again.");
      return;
    }
    try {
      const user = JSON.parse(userRaw) as PublicUser;
      setAuth(user, accessToken, refreshToken);
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Invalid OAuth response. Try signing in again.");
    }
  }, [navigate, params, setAuth]);

  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="font-display text-2xl">Sign-in failed</h1>
        <p className="mt-2 text-sm text-red-500">{error}</p>
        <button
          type="button"
          className="mt-6 rounded-md bg-[var(--color-accent)] px-4 py-2 text-white"
          onClick={() => navigate("/login", { replace: true })}
        >
          Back to login
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-sm text-[var(--jb-muted)]">Completing Google sign-in…</p>
    </main>
  );
}
