import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { listDocuments } from "../api/documents";
import { getAnalytics } from "../api/analytics";
import { listTrash, purgeTrash, restoreTrash, setServerFolder, setDocumentTags, setDocumentFavorite, fetchDocumentMeta } from "../api/platform";
import { useAuthStore } from "../store/authStore";
import { useRecentStore } from "../store/recentStore";
import { BUILTIN_TEMPLATES, useWorkspaceStore } from "../store/workspaceStore";
import { useEffect, useState } from "react";
import { toast } from "../features/toast/toastStore";
import { MobileHome } from "../components/mobile/MobileHome";
import { useIsMobile } from "../hooks/useIsMobile";

type DashTab = "documents" | "trash";

export function DashboardPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const recent = useRecentStore((s) => s.items);
  const clearRecent = useRecentStore((s) => s.clear);
  const removeRecent = useRecentStore((s) => s.remove);
  const favorites = useWorkspaceStore((s) => s.favorites);
  const tags = useWorkspaceStore((s) => s.tags);
  const folders = useWorkspaceStore((s) => s.folders);
  const folderList = useWorkspaceStore((s) => s.folderList);
  const setFavorite = useWorkspaceStore((s) => s.setFavorite);
  const setTags = useWorkspaceStore((s) => s.setTags);
  const setFolder = useWorkspaceStore((s) => s.setFolder);
  const addFolder = useWorkspaceStore((s) => s.addFolder);
  const hydrateLibrary = useWorkspaceStore((s) => s.hydrateLibrary);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [tab, setTab] = useState<DashTab>("documents");
  const [newFolder, setNewFolder] = useState("");

  const { data: serverMeta } = useQuery({
    queryKey: ["document-meta"],
    queryFn: fetchDocumentMeta,
  });

  useEffect(() => {
    if (!serverMeta) return;
    hydrateLibrary({
      folders: serverMeta.folderMap,
      folderList: serverMeta.folders.map((f) => f.folder),
      tags: serverMeta.tags,
      favorites: serverMeta.favorites,
    });
  }, [serverMeta, hydrateLibrary]);

  const { data: analytics } = useQuery({
    queryKey: ["analytics"],
    queryFn: getAnalytics,
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ["documents", search, visibility, folderFilter, tagFilter, favOnly],
    queryFn: () =>
      listDocuments({
        search: search || undefined,
        visibility: visibility || undefined,
        folder: folderFilter || undefined,
        tag: tagFilter.trim() || undefined,
        favorite: favOnly || undefined,
      }),
  });
  const {
    data: trash,
    isLoading: trashLoading,
    error: trashError,
  } = useQuery({
    queryKey: ["trash"],
    queryFn: listTrash,
    enabled: tab === "trash",
  });

  const restoreMut = useMutation({
    mutationFn: restoreTrash,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["trash"] });
      void qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
  const purgeMut = useMutation({
    mutationFn: purgeTrash,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["trash"] });
    },
  });

  const storagePct = analytics
    ? Math.min(100, Math.round((analytics.storageUsedBytes / analytics.storageQuotaBytes) * 100))
    : 0;

  function applyTemplate(content: string) {
    sessionStorage.setItem("jb-template", content);
    navigate("/documents/new");
  }

  return (
    <>
      {isMobile && (
        <MobileHome
          userName={user?.name}
          plan={user?.role}
          analytics={analytics}
          recent={recent}
          favorites={favorites}
          documents={data?.items ?? []}
          onTemplate={applyTemplate}
          onClearRecent={clearRecent}
        />
      )}
    <main className={isMobile ? "hidden" : "mx-auto max-w-6xl px-4 py-10"}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--jb-muted)]">
            Welcome{user ? `, ${user.name}` : ""} · {user?.role ?? "free"} plan
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/compare" className="jb-action">
            Compare JSON
          </Link>
          <Link to="/documents/new" className="jb-action jb-action-primary">
            New JSON
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Documents" value={String(analytics?.totalDocuments ?? "—")} />
        <Stat
          label="Storage"
          value={`${formatBytes(analytics?.storageUsedBytes ?? 0)} / ${formatBytes(analytics?.storageQuotaBytes ?? 0)} (${storagePct}%)`}
        />
        <Stat label="API requests" value={String(analytics?.apiRequestCount ?? "—")} />
        <Stat label="Quota docs" value={String(analytics?.documentQuota ?? "—")} />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Templates</h2>
        <p className="mt-1 text-sm text-[var(--jb-muted)]">
          Start from a built-in shape — opens the editor with the template applied.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {BUILTIN_TEMPLATES.map((tpl) => (
            <li key={tpl.id}>
              <button
                type="button"
                onClick={() => applyTemplate(tpl.content)}
                className="w-full rounded-lg border border-[var(--jb-border)] bg-[var(--jb-elevated)] px-3 py-3 text-left hover:border-[var(--jb-accent)]/40"
              >
                <div className="font-medium text-[var(--jb-text)]">{tpl.name}</div>
                <p className="mt-1 text-xs text-[var(--jb-muted)]">{tpl.description}</p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Recently used</h2>
          {recent.length > 0 && (
            <button type="button" className="text-xs text-[var(--jb-muted)] hover:text-[var(--jb-accent-soft)]" onClick={clearRecent}>
              Clear history
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--jb-muted)]">
            Open or save documents in the editor — they appear here for quick access.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {recent.slice(0, 8).map((item) => (
              <li
                key={`${item.id}-${item.openedAt}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-[var(--jb-border)] bg-[var(--jb-elevated)] px-3 py-3"
              >
                <div className="min-w-0">
                  <Link to={item.href} className="font-medium text-[var(--jb-text)] hover:text-[var(--jb-accent-soft)]">
                    {item.title}
                  </Link>
                  <p className="mt-1 font-mono text-[11px] text-[var(--jb-muted)]">
                    {item.source} · {new Date(item.openedAt).toLocaleString()}
                  </p>
                  {item.preview && (
                    <p className="mt-1 truncate text-xs text-[var(--jb-muted)]">{item.preview}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="text-xs text-[var(--jb-muted)] hover:text-red-300"
                  onClick={() => removeRecent(item.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-2 border-b border-[var(--jb-border)] pb-3">
        <button
          type="button"
          className={tab === "documents" ? "jb-action jb-action-primary" : "jb-action"}
          onClick={() => setTab("documents")}
        >
          Documents
        </button>
        <button
          type="button"
          className={tab === "trash" ? "jb-action jb-action-primary" : "jb-action"}
          onClick={() => setTab("trash")}
        >
          Trash
        </button>
      </div>

      {tab === "documents" && (
        <>
          <div className="mt-6 flex flex-wrap gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or id…"
              className="w-full max-w-md rounded-md border border-[var(--jb-border)] bg-[var(--jb-panel)] px-3 py-2 text-sm"
            />
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="rounded-md border border-[var(--jb-border)] bg-[var(--jb-panel)] px-3 py-2 text-sm"
            >
              <option value="">All visibility</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="password">Password</option>
            </select>
            <select
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              className="rounded-md border border-[var(--jb-border)] bg-[var(--jb-panel)] px-3 py-2 text-sm"
            >
              <option value="">All folders</option>
              {folderList.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
              <option value="__none__">Unfiled</option>
            </select>
            <input
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              placeholder="Filter tag…"
              className="rounded-md border border-[var(--jb-border)] bg-[var(--jb-panel)] px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-[var(--jb-muted)]">
              <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} />
              Favorites only
            </label>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addFolder(newFolder);
                setNewFolder("");
              }}
            >
              <input
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                placeholder="New folder…"
                className="rounded-md border border-[var(--jb-border)] bg-[var(--jb-panel)] px-3 py-2 text-sm"
              />
              <button type="submit" className="jb-action">
                Add
              </button>
            </form>
          </div>

          <div className="mt-6 overflow-x-auto">
            {isLoading && <p className="text-sm opacity-70">Loading…</p>}
            {error && <p className="text-sm text-red-400">Failed to load documents</p>}
            <table className="mt-2 w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-[var(--jb-border)] text-[var(--jb-muted)]">
                <tr>
                  <th className="py-2 pr-4 font-medium">Name / ID</th>
                  <th className="py-2 pr-4 font-medium">Visibility</th>
                  <th className="py-2 pr-4 font-medium">Folder</th>
                  <th className="py-2 pr-4 font-medium">Tags</th>
                  <th className="py-2 pr-4 font-medium">Size</th>
                  <th className="py-2 pr-4 font-medium">Updated</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {data?.items.map((doc) => (
                    <tr key={doc.id} className="border-b border-[var(--jb-border)]/80">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2 font-medium">
                          <button
                            type="button"
                            title="Favorite"
                            onClick={() => {
                              const next = !favorites.includes(doc.id);
                              setFavorite(doc.id, next);
                              void setDocumentFavorite(doc.id, next)
                                .then(() => {
                                  toast(next ? "Favorited" : "Removed favorite", "success");
                                  void qc.invalidateQueries({ queryKey: ["document-meta"] });
                                  void qc.invalidateQueries({ queryKey: ["documents"] });
                                })
                                .catch(() => {
                                  setFavorite(doc.id, !next);
                                  toast("Could not sync favorite", "error");
                                });
                            }}
                            className={
                              favorites.includes(doc.id) || doc.favorite
                                ? "text-amber-400"
                                : "text-[var(--jb-muted)]"
                            }
                          >
                            ★
                          </button>
                          {doc.name || doc.id}
                        </div>
                        <div className="font-mono text-xs opacity-60">{doc.id}</div>
                      </td>
                      <td className="py-3 pr-4">{doc.visibility}</td>
                      <td className="py-3 pr-4">
                        <select
                          value={folders[doc.id] ?? doc.folder ?? ""}
                          onChange={(e) => {
                            const folder = e.target.value || null;
                            setFolder(doc.id, folder);
                            void setServerFolder(doc.id, folder)
                              .then(() => {
                                toast(folder ? `Moved to ${folder}` : "Removed from folder", "success");
                                void qc.invalidateQueries({ queryKey: ["document-meta"] });
                                void qc.invalidateQueries({ queryKey: ["documents"] });
                              })
                              .catch(() => toast("Could not sync folder to server", "error"));
                          }}
                          className="rounded border border-[var(--jb-border)] bg-transparent px-2 py-1 text-xs"
                        >
                          <option value="">—</option>
                          {folderList.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          className="w-36 rounded border border-[var(--jb-border)] bg-transparent px-2 py-1 text-xs"
                          placeholder="tag1, tag2"
                          defaultValue={(doc.tags ?? tags[doc.id] ?? []).join(", ")}
                          onBlur={(e) => {
                            const next = e.target.value
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean);
                            setTags(doc.id, next);
                            void setDocumentTags(doc.id, next)
                              .then(() => {
                                toast("Tags saved", "success");
                                void qc.invalidateQueries({ queryKey: ["document-meta"] });
                                void qc.invalidateQueries({ queryKey: ["documents"] });
                              })
                              .catch(() => toast("Could not sync tags", "error"));
                          }}
                        />
                      </td>
                      <td className="py-3 pr-4">{formatBytes(doc.size)}</td>
                      <td className="py-3 pr-4">{new Date(doc.updatedAt).toLocaleString()}</td>
                      <td className="py-3 text-right">
                        <Link to={`/documents/${doc.id}`} className="text-[var(--jb-accent)]">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                {data && data.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[var(--jb-muted)]">
                      No documents yet. Create your first JSON blob.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "trash" && (
        <div className="mt-6">
          {trashLoading && <p className="text-sm opacity-70">Loading trash…</p>}
          {trashError && <p className="text-sm text-red-400">Failed to load trash</p>}
          <table className="mt-2 w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--jb-border)] text-[var(--jb-muted)]">
              <tr>
                <th className="py-2 pr-4 font-medium">Name / ID</th>
                <th className="py-2 pr-4 font-medium">Size</th>
                <th className="py-2 pr-4 font-medium">Updated</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {(trash?.items ?? []).map((doc) => (
                <tr key={doc.id} className="border-b border-[var(--jb-border)]/80">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{doc.name || doc.id}</div>
                    <div className="font-mono text-xs opacity-60">{doc.id}</div>
                  </td>
                  <td className="py-3 pr-4">{formatBytes(doc.size)}</td>
                  <td className="py-3 pr-4">{new Date(doc.updatedAt).toLocaleString()}</td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="jb-action"
                        disabled={restoreMut.isPending}
                        onClick={() => restoreMut.mutate(doc.id)}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        className="jb-action text-red-300"
                        disabled={purgeMut.isPending}
                        onClick={() => {
                          if (window.confirm("Permanently delete this document?")) {
                            purgeMut.mutate(doc.id);
                          }
                        }}
                      >
                        Purge
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {trash && trash.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[var(--jb-muted)]">
                    Trash is empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--jb-border)] bg-[var(--jb-elevated)] px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-[var(--jb-muted)]">{label}</div>
      <div className="mt-1 text-lg font-medium">{value}</div>
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
