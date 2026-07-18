import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Lock, Globe } from "lucide-react";
import { cn } from "../../lib/cn";
import { createServerOneTimeLink } from "../../api/platform";
import { patchDocument } from "../../api/documents";
import { getDocumentAnalytics } from "../../api/analytics";
import { useAuthStore } from "../../store/authStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { toast } from "../toast/toastStore";
import type { Visibility } from "../../types";

export function ShareSheet({
  open,
  onClose,
  shareUrl,
  apiUrl,
  visibility: initialVisibility = "public",
  documentId,
  expireAt: initialExpireAt = null,
}: {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  apiUrl: string;
  visibility?: string;
  documentId?: string;
  expireAt?: string | null;
}) {
  const [copied, setCopied] = useState<"share" | "api" | "ot" | null>(null);
  const [oneTimeUrl, setOneTimeUrl] = useState<string | null>(null);
  const [otNote, setOtNote] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>(
    (initialVisibility as Visibility) || "public",
  );
  const [expireAt, setExpireAt] = useState(initialExpireAt?.slice(0, 16) ?? "");
  const [password, setPassword] = useState("");
  const createOneTimeToken = useWorkspaceStore((s) => s.createOneTimeToken);
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const trapRef = useFocusTrap(open);

  const { data: analytics } = useQuery({
    queryKey: ["doc-analytics", documentId],
    queryFn: () => getDocumentAnalytics(documentId!),
    enabled: open && Boolean(documentId) && Boolean(accessToken),
  });

  const patchMut = useMutation({
    mutationFn: () =>
      patchDocument(documentId!, {
        visibility,
        expireAt: expireAt ? new Date(expireAt).toISOString() : null,
        password: visibility === "password" ? password || null : null,
      }),
    onSuccess: () => {
      toast("Share settings saved", "success");
      void qc.invalidateQueries({ queryKey: ["document", documentId] });
    },
    onError: () => toast("Failed to save share settings", "error"),
  });

  useEffect(() => {
    if (!open) return;
    setVisibility((initialVisibility as Visibility) || "public");
    setExpireAt(initialExpireAt?.slice(0, 16) ?? "");
    setPassword("");
    setOneTimeUrl(null);
    setOtNote(null);
  }, [open, initialVisibility, initialExpireAt]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function copy(which: "share" | "api" | "ot", value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(which);
    toast("Copied", "success");
    window.setTimeout(() => setCopied(null), 1500);
  }

  async function createOneTimeLink() {
    if (!documentId) return;
    setCreating(true);
    setOtNote(null);
    try {
      if (accessToken) {
        try {
          const res = await createServerOneTimeLink(documentId);
          setOneTimeUrl(res.url);
          setOtNote("Server one-time link — burns after first open.");
          return;
        } catch {
          /* fall through to client token */
        }
      }
      const token = createOneTimeToken(documentId);
      const url = `${window.location.origin}/view/${documentId}?ot=${token}`;
      setOneTimeUrl(url);
      setOtNote("Client one-time token — burns after first open in this browser.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="relative z-10 w-full max-w-md rounded-xl border border-[var(--jb-border)] bg-[var(--jb-panel)] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="share-title" className="text-base font-semibold text-[var(--jb-text)]">
            Share document
          </h2>
          <button type="button" className="jb-action" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2 text-xs text-[var(--jb-muted)]">
          {visibility === "private" ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            <Globe className="h-3.5 w-3.5" />
          )}
          <span className="capitalize">{visibility}</span>
          {documentId && <code className="ml-auto font-mono text-[10px]">{documentId}</code>}
        </div>

        {accessToken && analytics && (
          <div className="mb-3 rounded-md border border-[var(--jb-border)] bg-[var(--jb-canvas)] px-3 py-2 text-xs text-[var(--jb-muted)]">
            <span className="font-medium text-[var(--jb-text)]">{analytics.totalRequests}</span> requests
            {analytics.lastAccessedAt && (
              <span className="ml-2">
                · last {new Date(analytics.lastAccessedAt).toLocaleString()}
              </span>
            )}
          </div>
        )}

        <Field
          label="Share link"
          value={shareUrl}
          icon={<Link2 className="h-3.5 w-3.5" />}
          copied={copied === "share"}
          onCopy={() => void copy("share", shareUrl)}
        />
        <Field
          label="Raw API JSON"
          value={apiUrl}
          icon={<Copy className="h-3.5 w-3.5" />}
          copied={copied === "api"}
          onCopy={() => void copy("api", apiUrl)}
        />

        {documentId && accessToken && (
          <div className="mb-3 space-y-2 rounded-md border border-[var(--jb-border)] p-3">
            <p className="text-xs font-medium text-[var(--jb-muted)]">Access settings</p>
            <label className="block text-[11px] text-[var(--jb-muted)]">
              Visibility
              <select
                className="mt-1 w-full rounded border border-[var(--jb-border)] bg-[var(--jb-canvas)] px-2 py-1.5 text-sm text-[var(--jb-text)]"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as Visibility)}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="password">Password</option>
              </select>
            </label>
            {visibility === "password" && (
              <label className="block text-[11px] text-[var(--jb-muted)]">
                Password
                <input
                  type="password"
                  className="mt-1 w-full rounded border border-[var(--jb-border)] bg-[var(--jb-canvas)] px-2 py-1.5 text-sm text-[var(--jb-text)]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Set or change password"
                />
              </label>
            )}
            <label className="block text-[11px] text-[var(--jb-muted)]">
              Expiry
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border border-[var(--jb-border)] bg-[var(--jb-canvas)] px-2 py-1.5 text-sm text-[var(--jb-text)]"
                value={expireAt}
                onChange={(e) => setExpireAt(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="jb-action jb-action-primary w-full"
              disabled={patchMut.isPending}
              onClick={() => patchMut.mutate()}
            >
              {patchMut.isPending ? "Saving…" : "Save settings"}
            </button>
          </div>
        )}

        {documentId && (
          <div className="mb-3">
            <button
              type="button"
              className="jb-action jb-action-primary"
              disabled={creating}
              onClick={() => void createOneTimeLink()}
            >
              {creating ? "Creating…" : "Create one-time link"}
            </button>
            {oneTimeUrl && (
              <Field
                label="One-time view link"
                value={oneTimeUrl}
                icon={<Link2 className="h-3.5 w-3.5" />}
                copied={copied === "ot"}
                onCopy={() => void copy("ot", oneTimeUrl)}
              />
            )}
            <p className="mt-1.5 text-[11px] text-[var(--jb-muted)]">
              {otNote ?? "Burns after first open."}
            </p>
          </div>
        )}

        <p className="mt-3 text-xs text-[var(--jb-muted)]">
          Raw URL returns application/json. Share link opens the jsonbob viewer.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  icon,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <label className="mb-3 block text-xs font-medium text-[var(--jb-muted)]">
      {label}
      <div className="mt-1 flex gap-2">
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md border border-[var(--jb-border)]",
            "bg-[var(--jb-canvas)] px-2 py-2 font-mono text-[11px] text-[var(--jb-text)]",
          )}
        >
          {icon}
          <span className="truncate">{value}</span>
        </div>
        <button type="button" className="jb-action jb-action-primary shrink-0" onClick={onCopy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : "Copy"}
        </button>
      </div>
    </label>
  );
}
