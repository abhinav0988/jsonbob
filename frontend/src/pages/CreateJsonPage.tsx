import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { JsonWorkspace } from "../components/editor/JsonWorkspace";
import { SAMPLE_JSON } from "../components/editor/jsonTools";
import { createDocument, createRawJson } from "../api/documents";
import { useAuthStore } from "../store/authStore";
import { useRecentStore } from "../store/recentStore";
import { useWorkspaceStore } from "../store/workspaceStore";

function readTemplate(): string | null {
  try {
    const t = sessionStorage.getItem("jb-template");
    if (t) sessionStorage.removeItem("jb-template");
    return t;
  } catch {
    return null;
  }
}

export function CreateJsonPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const pushRecent = useRecentStore((s) => s.push);
  const openTab = useWorkspaceStore((s) => s.openTab);
  const [text, setText] = useState(() => readTemplate() ?? SAMPLE_JSON);
  const initial = useRef(text).current;
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private" | "password">("public");
  const [password, setPassword] = useState("");
  const [expireAt, setExpireAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    openTab({ id: "new", title: "Untitled", href: "/documents/new" });
  }, [openTab]);
  async function onSave() {
    setLoading(true);
    setError(null);
    try {
      const content = JSON.parse(text);
      if (user) {
        const created = await createDocument({
          content,
          visibility,
          name: name || null,
          expireAt: expireAt ? new Date(expireAt).toISOString() : null,
          password: visibility === "password" ? password : null,
        });
        pushRecent({
          id: created.id,
          title: name || created.id,
          href: `/documents/${created.id}`,
          visibility,
          source: "document",
          preview: JSON.stringify(content).slice(0, 80),
        });
        navigate(`/documents/${created.id}`);
      } else {
        const created = await createRawJson(content);
        pushRecent({
          id: created.id,
          title: created.id,
          href: `/view/${created.id}`,
          visibility: "public",
          source: "public",
          preview: JSON.stringify(content).slice(0, 80),
        });
        navigate(`/view/${created.id}`);
      }
    } catch (err: unknown) {
      if (err instanceof SyntaxError) setError("Invalid JSON");
      else {
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
            ?.error?.message ?? "Failed to create document";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {error && (
        <p className="shrink-0 border-b border-red-900/40 bg-red-950/30 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="min-h-0 flex-1 p-2 sm:p-3">
        <JsonWorkspace
          value={text}
          onChange={setText}
          initialSnapshot={initial}
          onSave={() => void onSave()}
          saving={loading}
          savedLabel="Save"
          actions={
            user ? (
              <>
                <span className="mx-1 hidden h-5 w-px bg-[#334155] sm:inline-block" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  className="toolbar-input"
                />
                <select
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value as "public" | "private" | "password")
                  }
                  className="toolbar-input"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="password">Password</option>
                </select>
                {visibility === "password" && (
                  <input
                    type="password"
                    minLength={4}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="toolbar-input"
                  />
                )}
                <input
                  type="datetime-local"
                  value={expireAt}
                  onChange={(e) => setExpireAt(e.target.value)}
                  className="toolbar-input"
                />
              </>
            ) : null
          }
        />
      </div>
    </div>
  );
}
