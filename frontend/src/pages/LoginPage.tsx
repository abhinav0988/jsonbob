import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { login } from "../api/auth";
import { githubStatus, googleStatus } from "../api/platform";
import { getApiBaseUrl } from "../lib/apiBase";
import { useAuthStore } from "../store/authStore";

const API_BASE = getApiBaseUrl();

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [githubConfigured, setGithubConfigured] = useState(false);

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) setError(decodeURIComponent(oauthError));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    void googleStatus()
      .then((res) => {
        if (!cancelled) setGoogleConfigured(res.configured);
      })
      .catch(() => {
        if (!cancelled) setGoogleConfigured(false);
      });
    void githubStatus()
      .then((res) => {
        if (!cancelled) setGithubConfigured(res.configured);
      })
      .catch(() => {
        if (!cancelled) setGithubConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await login({ email, password });
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate("/dashboard");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl">Login</h1>
      <p className="mt-2 text-sm text-[var(--color-slate)]">
        No account? <Link to="/register" className="text-[var(--color-accent)]">Register</Link>
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--color-mist)] bg-transparent px-3 py-2 dark:border-[var(--color-line)]"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--color-mist)] bg-transparent px-3 py-2 dark:border-[var(--color-line)]"
          />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[var(--color-accent)] px-4 py-2 text-white hover:bg-[var(--color-accent-deep)] disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {(googleConfigured || githubConfigured) && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-[var(--color-slate)]">
            <span className="h-px flex-1 bg-[var(--color-mist)] dark:bg-[var(--color-line)]" />
            or
            <span className="h-px flex-1 bg-[var(--color-mist)] dark:bg-[var(--color-line)]" />
          </div>
          <div className="space-y-2">
            {googleConfigured && (
              <button
                type="button"
                className="w-full rounded-md border border-[var(--color-mist)] px-4 py-2 text-sm hover:bg-[var(--jb-elevated)] dark:border-[var(--color-line)]"
                onClick={() => {
                  window.location.href = `${API_BASE}/auth/google`;
                }}
              >
                Continue with Google
              </button>
            )}
            {githubConfigured && (
              <button
                type="button"
                className="w-full rounded-md border border-[var(--color-mist)] px-4 py-2 text-sm hover:bg-[var(--jb-elevated)] dark:border-[var(--color-line)]"
                onClick={() => {
                  window.location.href = `${API_BASE}/auth/github`;
                }}
              >
                Continue with GitHub
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
