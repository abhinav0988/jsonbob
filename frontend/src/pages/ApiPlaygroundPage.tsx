import { useMemo, useState } from "react";
import { getApiBaseUrl } from "../lib/apiBase";
import { useAuthStore } from "../store/authStore";

const EXAMPLES = [
  { method: "GET", path: "/health", body: "" },
  { method: "GET", path: "/auth/me", body: "" },
  { method: "GET", path: "/documents?limit=10", body: "" },
  {
    method: "POST",
    path: "/documents",
    body: JSON.stringify({ content: { hello: "world" }, visibility: "private", name: "playground" }, null, 2),
  },
  { method: "GET", path: "/api-keys", body: "" },
  { method: "GET", path: "/api-docs", body: "" },
] as const;

export function ApiPlaygroundPage() {
  const token = useAuthStore((s) => s.accessToken);
  const base = getApiBaseUrl();
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/health");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string>("");
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);

  const url = useMemo(() => `${base}${path.startsWith("/") ? path : `/${path}`}`, [base, path]);

  async function run() {
    setBusy(true);
    setStatus("");
    setResponse("");
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body.trim() && method !== "GET" && method !== "HEAD") {
        headers["Content-Type"] = "application/json";
      }
      const res = await fetch(url, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" || !body.trim() ? undefined : body,
      });
      setStatus(`${res.status} ${res.statusText}`);
      const text = await res.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text);
      }
    } catch (err) {
      setStatus("Network error");
      setResponse(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-[var(--jb-text)]">
      <h1 className="text-2xl font-semibold tracking-tight">API Playground</h1>
      <p className="mt-2 text-sm text-[var(--jb-muted)]">
        Hit live Worker endpoints. Auth uses your current session token when present.
      </p>
      {!base && (
        <p className="mt-2 text-sm text-amber-400">Set VITE_API_BASE_URL for absolute API calls.</p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={`${ex.method}-${ex.path}`}
            type="button"
            className="jb-action"
            onClick={() => {
              setMethod(ex.method);
              setPath(ex.path);
              setBody(ex.body);
            }}
          >
            {ex.method} {ex.path}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[7rem_1fr_auto]">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="toolbar-input"
        >
          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          className="toolbar-input font-mono"
          placeholder="/path"
        />
        <button type="button" className="jb-action jb-action-primary" disabled={busy} onClick={() => void run()}>
          {busy ? "Running…" : "Send"}
        </button>
      </div>

      <label className="mt-4 block text-xs uppercase tracking-wide text-[var(--jb-muted)]">
        Body
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          spellCheck={false}
          className="mt-1 w-full rounded border border-[var(--jb-border)] bg-[var(--jb-canvas)] p-3 font-mono text-xs"
        />
      </label>

      <div className="mt-4 rounded border border-[var(--jb-border)] bg-[var(--jb-panel)] p-3">
        <p className="font-mono text-xs text-[var(--jb-muted)]">{url}</p>
        {status && <p className="mt-2 text-sm text-[var(--jb-accent-soft)]">{status}</p>}
        <pre className="jb-scroll mt-3 max-h-96 overflow-auto font-mono text-xs text-[var(--jb-text)]">
          {response || "Response will appear here"}
        </pre>
      </div>

      <div className="mt-8 rounded border border-[var(--jb-border)] bg-[var(--jb-panel)] p-4 text-sm text-[var(--jb-muted)]">
        <p className="font-medium text-[var(--jb-text)]">SDK snippets</p>
        <div className="mt-3 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide">JavaScript / fetch</p>
            <pre className="mt-1 overflow-x-auto font-mono text-[11px] text-[var(--jb-text)]">{`const res = await fetch("${base || "https://api.example"}/documents", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer <token-or-jb_api_key>",
  },
  body: JSON.stringify({ content: { ok: true } }),
});
const data = await res.json();`}</pre>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide">cURL</p>
            <pre className="mt-1 overflow-x-auto font-mono text-[11px] text-[var(--jb-text)]">{`curl -X POST "${base || "https://api.example"}/documents" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <token>" \\
  -d '{"content":{"ok":true}}'`}</pre>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide">Python</p>
            <pre className="mt-1 overflow-x-auto font-mono text-[11px] text-[var(--jb-text)]">{`import requests
r = requests.post(
  "${base || "https://api.example"}/documents",
  headers={"Authorization": "Bearer <token>"},
  json={"content": {"ok": True}},
)
print(r.json())`}</pre>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide">Go</p>
            <pre className="mt-1 overflow-x-auto font-mono text-[11px] text-[var(--jb-text)]">{`req, _ := http.NewRequest("POST", "${base || "https://api.example"}/documents",
  strings.NewReader(\`{"content":{"ok":true}}\`))
req.Header.Set("Authorization", "Bearer <token>")
req.Header.Set("Content-Type", "application/json")
resp, _ := http.DefaultClient.Do(req)`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
