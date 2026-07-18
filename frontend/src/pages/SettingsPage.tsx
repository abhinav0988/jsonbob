import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { getProfile, updateProfile } from "../api/analytics";
import {
  createApiKey,
  createOrg,
  githubStatus,
  googleStatus,
  listApiKeys,
  listAuditLog,
  listOrgs,
  revokeApiKey,
} from "../api/platform";
import { useAuthStore } from "../store/authStore";
import { ACCENT_OPTIONS, useThemeStore, type ThemeMode } from "../store/themeStore";
import { getApiBaseUrl } from "../lib/apiBase";
import { cn } from "../lib/cn";
import { useIsMobile } from "../hooks/useIsMobile";

const API_BASE = getApiBaseUrl();

type SettingsSection =
  | "profile"
  | "appearance"
  | "api-keys"
  | "oauth"
  | "organization"
  | "audit";

export function SettingsPage() {
  const [section, setSection] = useState<SettingsSection>("profile");
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="jb-scroll min-h-0 flex-1 overflow-y-auto pb-28 md:hidden">
        <header className="px-4 pb-2 pt-2">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-[var(--jb-muted)]">Account, appearance, integrations</p>
        </header>
        <div className="mt-4 space-y-2 px-4">
          {(
            [
              ["profile", "Profile"],
              ["appearance", "Appearance"],
              ["api-keys", "API Keys"],
              ["oauth", "OAuth"],
              ["organization", "Organization"],
              ["audit", "Audit log"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                "jb-mobile-card flex min-h-14 w-full items-center justify-between px-4 py-4 text-left text-base font-medium",
                section === id && "border-[var(--jb-accent)]/50 bg-[var(--jb-accent)]/8",
              )}
              onClick={() => setSection(id)}
            >
              {label}
              <span className="text-[var(--jb-muted)]">›</span>
            </button>
          ))}
        </div>
        <div className="mt-6 px-4 pb-8">
          {section === "profile" && <ProfileSection />}
          {section === "appearance" && <AppearanceSection />}
          {section === "api-keys" && <ApiKeysSection />}
          {section === "oauth" && <OAuthSection />}
          {section === "organization" && <OrganizationSection />}
          {section === "audit" && <AuditSection />}
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl">Settings</h1>
      <p className="mt-1 text-sm text-[var(--jb-muted)]">Account, appearance, and integrations</p>

      <div className="mt-8 flex flex-col gap-8 sm:flex-row">
        <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto sm:w-44 sm:flex-col sm:overflow-visible">
          {(
            [
              ["profile", "Profile"],
              ["appearance", "Appearance"],
              ["api-keys", "API Keys"],
              ["oauth", "OAuth"],
              ["organization", "Organization"],
              ["audit", "Audit log"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={cn(
                "rounded-md px-3 py-2 text-left text-sm whitespace-nowrap",
                section === id
                  ? "bg-[var(--jb-accent)]/15 text-[var(--jb-accent-soft)]"
                  : "text-[var(--jb-muted)] hover:bg-[var(--jb-elevated)] hover:text-[var(--jb-text)]",
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {section === "profile" && <ProfileSection />}
          {section === "appearance" && <AppearanceSection />}
          {section === "api-keys" && <ApiKeysSection />}
          {section === "oauth" && <OAuthSection />}
          {section === "organization" && <OrganizationSection />}
          {section === "audit" && <AuditSection />}
        </div>
      </div>
    </main>
  );
}

function ProfileSection() {
  const setUser = useAuthStore((s) => s.setUser);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (user) => {
      setUser(user);
      setMessage("Profile updated");
      setError(null);
      setCurrentPassword("");
      setPassword("");
      void refetch();
    },
    onError: () => setError("Update failed"),
  });

  if (isLoading || !data) {
    return <p className="text-sm opacity-70">Loading…</p>;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      name: name || data!.user.name,
      ...(password ? { password, currentPassword } : {}),
    });
  }

  return (
    <div>
      <h2 className="text-lg font-medium">Profile</h2>
      <p className="mt-1 text-sm text-[var(--jb-muted)]">
        Plan: {data.plan.role} · {data.plan.documentQuota} docs ·{" "}
        {Math.round(data.plan.storageQuotaBytes / 1024 / 1024)} MB storage
      </p>

      <form onSubmit={onSubmit} className="mt-6 max-w-md space-y-4">
        <label className="block text-sm">
          Name
          <input
            defaultValue={data.user.name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--jb-border)] bg-[var(--jb-canvas)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Email
          <input
            value={data.user.email}
            disabled
            className="mt-1 w-full rounded-md border border-[var(--jb-border)] bg-[var(--jb-canvas)] px-3 py-2 opacity-60"
          />
        </label>
        <label className="block text-sm">
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--jb-border)] bg-[var(--jb-canvas)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          New password
          <input
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--jb-border)] bg-[var(--jb-canvas)] px-3 py-2"
          />
        </label>
        {message && <p className="text-sm text-[var(--jb-accent-soft)]">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" className="jb-action jb-action-primary">
          Save changes
        </button>
      </form>
    </div>
  );
}

function AppearanceSection() {
  const mode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);
  const minimap = useThemeStore((s) => s.minimap);
  const formatOnPaste = useThemeStore((s) => s.formatOnPaste);
  const layoutPreset = useThemeStore((s) => s.layoutPreset);
  const setMode = useThemeStore((s) => s.setMode);
  const setAccent = useThemeStore((s) => s.setAccent);
  const setMinimap = useThemeStore((s) => s.setMinimap);
  const setFormatOnPaste = useThemeStore((s) => s.setFormatOnPaste);
  const setLayoutPreset = useThemeStore((s) => s.setLayoutPreset);

  const modes: Array<{ id: ThemeMode; label: string }> = [
    { id: "system", label: "System" },
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium">Appearance</h2>
        <p className="mt-1 text-sm text-[var(--jb-muted)]">Theme mode, accent color, and editor chrome</p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-[var(--jb-muted)]">Theme mode</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                mode === m.id
                  ? "border-[var(--jb-accent)] bg-[var(--jb-accent)]/15 text-[var(--jb-accent-soft)]"
                  : "border-[var(--jb-border)] text-[var(--jb-muted)] hover:border-[var(--jb-accent)]/40",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-[var(--jb-muted)]">Accent</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAccent(opt.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                accent === opt.id
                  ? "border-[var(--jb-accent)] bg-[var(--jb-accent)]/15"
                  : "border-[var(--jb-border)]",
              )}
            >
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: opt.swatch }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-[var(--jb-muted)]">Editor</h3>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={minimap}
            onChange={(e) => setMinimap(e.target.checked)}
          />
          Show minimap
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formatOnPaste}
            onChange={(e) => setFormatOnPaste(e.target.checked)}
          />
          Format JSON on paste
        </label>
        <label className="mt-3 block text-sm">
          Default layout preset
          <select
            className="toolbar-input mt-1 block w-full max-w-xs"
            value={layoutPreset}
            onChange={(e) =>
              setLayoutPreset(e.target.value as "focus" | "split" | "review" | "table")
            }
          >
            <option value="focus">Focus</option>
            <option value="split">Split</option>
            <option value="review">Review</option>
            <option value="table">Table</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function ApiKeysSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: listApiKeys,
  });

  const createMut = useMutation({
    mutationFn: () => createApiKey(name.trim() || "Default"),
    onSuccess: (res) => {
      setCreatedSecret(res.key);
      setName("");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: () => setError("Failed to create API key"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: () => setError("Failed to revoke key"),
  });

  return (
    <div>
      <h2 className="text-lg font-medium">API Keys</h2>
      <p className="mt-1 text-sm text-[var(--jb-muted)]">
        Authenticate programmatic access to the jsonbob API
      </p>

      <form
        className="mt-6 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          createMut.mutate();
        }}
      >
        <label className="block text-sm">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="CI / SDK"
            className="mt-1 block w-48 rounded-md border border-[var(--jb-border)] bg-[var(--jb-canvas)] px-3 py-2"
          />
        </label>
        <button type="submit" className="jb-action jb-action-primary" disabled={createMut.isPending}>
          {createMut.isPending ? "Creating…" : "Create key"}
        </button>
      </form>

      {createdSecret && (
        <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-200">Copy your secret now — it won’t be shown again.</p>
          <code className="mt-2 block break-all font-mono text-xs text-[var(--jb-text)]">
            {createdSecret}
          </code>
          <button
            type="button"
            className="jb-action mt-2"
            onClick={() => void navigator.clipboard.writeText(createdSecret)}
          >
            Copy secret
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {isLoading ? (
        <p className="mt-6 text-sm opacity-70">Loading keys…</p>
      ) : (
        <ul className="mt-6 divide-y divide-[var(--jb-border)] border-t border-[var(--jb-border)]">
          {(data?.items ?? []).length === 0 && (
            <li className="py-4 text-sm text-[var(--jb-muted)]">No API keys yet.</li>
          )}
          {(data?.items ?? []).map((key) => (
            <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <div className="font-medium">{key.name}</div>
                <div className="font-mono text-xs text-[var(--jb-muted)]">
                  {key.prefix}… · created {new Date(key.createdAt).toLocaleDateString()}
                  {key.lastUsedAt
                    ? ` · last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                    : ""}
                </div>
              </div>
              <button
                type="button"
                className="jb-action text-red-300"
                disabled={revokeMut.isPending}
                onClick={() => {
                  if (window.confirm(`Revoke key “${key.name}”?`)) revokeMut.mutate(key.id);
                }}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OAuthSection() {
  const google = useQuery({
    queryKey: ["google-oauth-status"],
    queryFn: googleStatus,
  });
  const github = useQuery({
    queryKey: ["github-oauth-status"],
    queryFn: githubStatus,
  });
  const googleConfigured = google.data?.configured === true;
  const githubConfigured = github.data?.configured === true;
  const isLoading = google.isLoading || github.isLoading;

  return (
    <div>
      <h2 className="text-lg font-medium">OAuth</h2>
      <p className="mt-1 text-sm text-[var(--jb-muted)]">Connect social providers for sign-in</p>

      {isLoading ? (
        <p className="mt-6 text-sm opacity-70">Checking OAuth configuration…</p>
      ) : (
        <div className="mt-6 space-y-4">
          {googleConfigured ? (
            <a href={`${API_BASE}/auth/google`} className="jb-action jb-action-primary inline-flex">
              Connect Google
            </a>
          ) : (
            <div className="rounded-md border border-[var(--jb-border)] bg-[var(--jb-elevated)] p-4 text-sm">
              <p className="font-medium text-[var(--jb-text)]">Google OAuth is not configured</p>
              <p className="mt-2 text-[var(--jb-muted)]">
                Set Workers secrets <code className="font-mono text-xs">GOOGLE_CLIENT_ID</code> and{" "}
                <code className="font-mono text-xs">GOOGLE_CLIENT_SECRET</code>, then redeploy the
                API.
              </p>
              {google.isError && (
                <p className="mt-2 text-xs text-amber-400">Could not reach /auth/google/status.</p>
              )}
            </div>
          )}

          {githubConfigured ? (
            <a href={`${API_BASE}/auth/github`} className="jb-action jb-action-primary inline-flex">
              Connect GitHub
            </a>
          ) : (
            <div className="rounded-md border border-[var(--jb-border)] bg-[var(--jb-elevated)] p-4 text-sm">
              <p className="font-medium text-[var(--jb-text)]">GitHub OAuth is not configured</p>
              <p className="mt-2 text-[var(--jb-muted)]">
                Set Workers secrets <code className="font-mono text-xs">GITHUB_CLIENT_ID</code> and{" "}
                <code className="font-mono text-xs">GITHUB_CLIENT_SECRET</code>, then redeploy the
                API.
              </p>
              {github.isError && (
                <p className="mt-2 text-xs text-amber-400">Could not reach /auth/github/status.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OrganizationSection() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["orgs"],
    queryFn: listOrgs,
    enabled: Boolean(user),
  });

  const createMut = useMutation({
    mutationFn: () => createOrg({ name: name.trim(), ...(slug.trim() ? { slug: slug.trim() } : {}) }),
    onSuccess: () => {
      setName("");
      setSlug("");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["orgs"] });
    },
    onError: () => setError("Failed to create organization"),
  });

  if (!user) {
    return (
      <div>
        <h2 className="text-lg font-medium">Organization</h2>
        <p className="mt-2 text-sm text-[var(--jb-muted)]">Sign in to manage organizations.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-medium">Organization</h2>
      <p className="mt-1 text-sm text-[var(--jb-muted)]">Create and view orgs you belong to</p>

      <form
        className="mt-6 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          createMut.mutate();
        }}
      >
        <label className="block text-sm">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Acme Inc"
            className="mt-1 block w-48 rounded-md border border-[var(--jb-border)] bg-[var(--jb-canvas)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Slug (optional)
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="acme"
            className="mt-1 block w-40 rounded-md border border-[var(--jb-border)] bg-[var(--jb-canvas)] px-3 py-2"
          />
        </label>
        <button type="submit" className="jb-action jb-action-primary" disabled={createMut.isPending}>
          {createMut.isPending ? "Creating…" : "Create org"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {isLoading ? (
        <p className="mt-6 text-sm opacity-70">Loading organizations…</p>
      ) : (
        <ul className="mt-6 divide-y divide-[var(--jb-border)] border-t border-[var(--jb-border)]">
          {(data?.items ?? []).length === 0 && (
            <li className="py-4 text-sm text-[var(--jb-muted)]">No organizations yet.</li>
          )}
          {(data?.items ?? []).map((org) => (
            <li key={org.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <div className="font-medium">{org.name}</div>
                <div className="font-mono text-xs text-[var(--jb-muted)]">
                  {org.slug}
                  {org.role ? ` · ${org.role}` : ""}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AuditSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => listAuditLog(50),
  });

  return (
    <div>
      <h2 className="text-lg font-medium">Audit log</h2>
      <p className="mt-1 text-sm text-[var(--jb-muted)]">
        Recent owner actions (folders, tags, favorites, share, delete, schema)
      </p>
      {isLoading && <p className="mt-6 text-sm opacity-70">Loading…</p>}
      {error && <p className="mt-6 text-sm text-red-400">Failed to load audit log</p>}
      <ul className="mt-6 divide-y divide-[var(--jb-border)] border-t border-[var(--jb-border)]">
        {(data?.items ?? []).length === 0 && !isLoading && (
          <li className="py-4 text-sm text-[var(--jb-muted)]">No audit events yet.</li>
        )}
        {(data?.items ?? []).map((row) => (
          <li key={row.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-[var(--jb-text)]">{row.action}</span>
              <span className="text-xs text-[var(--jb-muted)]">
                {new Date(row.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="mt-0.5 font-mono text-xs text-[var(--jb-muted)]">
              {row.resourceType}:{row.resourceId}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
