import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteDocument,
  duplicateDocument,
  getDocument,
  listVersions,
  restoreVersion,
  updateDocument,
} from "../api/documents";
import { getDocumentAnalytics } from "../api/analytics";
import { JsonWorkspace } from "../components/editor/JsonWorkspace";
import { useRecentStore } from "../store/recentStore";
import { useWorkspaceStore } from "../store/workspaceStore";
import { ShareSheet } from "../features/share/ShareSheet";

export function DocumentDetailsPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pushRecent = useRecentStore((s) => s.push);
  const { data, isLoading, error } = useQuery({
    queryKey: ["document", id],
    queryFn: () => getDocument(id),
    enabled: Boolean(id),
  });
  const { data: versions } = useQuery({
    queryKey: ["versions", id],
    queryFn: () => listVersions(id),
    enabled: Boolean(id),
  });
  const { data: stats } = useQuery({
    queryKey: ["doc-analytics", id],
    queryFn: () => getDocumentAnalytics(id),
    enabled: Boolean(id),
  });
  const [text, setText] = useState("");
  const [snapshot, setSnapshot] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const openTab = useWorkspaceStore((s) => s.openTab);

  useEffect(() => {
    if (data?.content !== undefined) {
      const pretty = JSON.stringify(data.content, null, 2);
      setText(pretty);
      setSnapshot(pretty);
      pushRecent({
        id: data.id,
        title: data.name || data.id,
        href: `/documents/${data.id}`,
        visibility: data.visibility,
        source: "document",
        preview: pretty.replace(/\s+/g, " ").slice(0, 80),
      });
      openTab({
        id: data.id,
        title: data.name || data.id,
        href: `/documents/${data.id}`,
      });
    }
  }, [data, pushRecent, openTab]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const content = JSON.parse(text);
      return updateDocument(id, content);
    },
    onSuccess: () => {
      setMessage("Saved");
      setErr(null);
      setSnapshot(text);
      void qc.invalidateQueries({ queryKey: ["document", id] });
      void qc.invalidateQueries({ queryKey: ["versions", id] });
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: (e: unknown) => {
      if (e instanceof SyntaxError) setErr("Invalid JSON");
      else setErr("Save failed");
    },
  });

  async function onDelete() {
    if (!confirm("Delete this document?")) return;
    await deleteDocument(id);
    navigate("/dashboard");
  }

  async function onDuplicate() {
    const created = await duplicateDocument(id);
    navigate(`/documents/${created.id}`);
  }

  async function onRestore(version: number) {
    if (!confirm(`Restore version ${version}? This creates a new version.`)) return;
    await restoreVersion(id, version);
    setMessage(`Restored from v${version}`);
    void qc.invalidateQueries({ queryKey: ["document", id] });
    void qc.invalidateQueries({ queryKey: ["versions", id] });
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("Copied");
  }

  if (isLoading) {
    return <main className="flex h-full items-center justify-center text-sm opacity-70">Loading…</main>;
  }
  if (error || !data) {
    return (
      <main className="flex h-full items-center justify-center text-sm text-red-400">
        Document not found
      </main>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--jb-border)] bg-[var(--jb-panel)] px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-[var(--jb-muted)]">
            <Link to="/dashboard" className="hover:text-[var(--jb-accent-soft)]">
              Dashboard
            </Link>{" "}
            / <span className="text-[var(--jb-text)]">{data.name || data.id}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-[var(--jb-muted)]">
          <span>{data.visibility}</span>
          <span>v{data.version}</span>
          <span>{stats?.totalRequests ?? 0} requests</span>
          <span>{data.size} B</span>
        </div>
      </div>

      {(message || err) && (
        <p
          className={`shrink-0 border-b px-4 py-2 text-sm ${
            err
              ? "border-red-900/40 bg-red-950/30 text-red-300"
              : "border-[var(--jb-border)] bg-[var(--jb-elevated)] text-[var(--jb-accent-soft)]"
          }`}
        >
          {err ?? message}
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[1fr_220px]">
        <div className="min-h-0 p-2 sm:p-3 xl:pr-0">
          <JsonWorkspace
            value={text}
            onChange={setText}
            initialSnapshot={snapshot}
            documentId={data.id}
            onSave={() => saveMutation.mutate()}
            saving={saveMutation.isPending}
            actions={
              <>
                <button type="button" className="jb-action jb-action-primary" onClick={() => setShareOpen(true)}>
                  Share
                </button>
                <button type="button" className="jb-action" onClick={() => void copy(data.url)}>
                  Copy URL
                </button>
                <button type="button" className="jb-action" onClick={() => void copy(data.apiUrl)}>
                  API URL
                </button>
                <a
                  href={data.apiUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="jb-action"
                >
                  Raw
                </a>
                <button type="button" className="jb-action" onClick={() => void onDuplicate()}>
                  Duplicate
                </button>
                <button
                  type="button"
                  className="jb-action text-red-300!"
                  onClick={() => void onDelete()}
                >
                  Delete
                </button>
              </>
            }
          />
        </div>

        <aside className="jb-scroll hidden min-h-0 overflow-y-auto border-l border-[var(--jb-border)] bg-[var(--jb-elevated)] p-3 text-sm xl:block">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--jb-muted)]">
            Versions
          </h2>
          <ul className="mt-3 space-y-2">
            {versions?.items.map((v) => (
              <li key={v.version} className="rounded border border-[var(--jb-border)] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span>v{v.version}</span>
                  {v.version !== data.version && (
                    <button
                      type="button"
                      onClick={() => void onRestore(v.version)}
                      className="text-xs text-[var(--jb-accent)]"
                    >
                      Restore
                    </button>
                  )}
                </div>
                <div className="text-xs text-[var(--jb-muted)]">
                  {new Date(v.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={data.url}
        apiUrl={data.apiUrl}
        visibility={data.visibility}
        documentId={data.id}
        expireAt={data.expireAt}
      />
    </div>
  );
}
