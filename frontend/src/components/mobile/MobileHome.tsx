import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Clock, FileJson, GitCompare, Plus, Star, Zap } from "lucide-react";
import { BUILTIN_TEMPLATES } from "../../store/workspaceStore";
import type { DocumentSummary } from "../../types";
import { cn } from "../../lib/cn";

type RecentItem = {
  id: string;
  title: string;
  href: string;
  openedAt: number;
  preview?: string;
};

export function MobileHome({
  userName,
  plan,
  analytics,
  recent,
  favorites,
  documents,
  templates = BUILTIN_TEMPLATES,
  onTemplate,
  onClearRecent,
}: {
  userName?: string;
  plan?: string;
  analytics?: {
    totalDocuments?: number;
    storageUsedBytes?: number;
    storageQuotaBytes?: number;
    apiRequestCount?: number;
  };
  recent: RecentItem[];
  favorites: string[];
  documents: DocumentSummary[];
  templates?: typeof BUILTIN_TEMPLATES;
  onTemplate: (content: string) => void;
  onClearRecent?: () => void;
}) {
  const favDocs = documents.filter((d) => favorites.includes(d.id)).slice(0, 6);
  const storagePct = analytics?.storageQuotaBytes
    ? Math.min(100, Math.round(((analytics.storageUsedBytes ?? 0) / analytics.storageQuotaBytes) * 100))
    : 0;

  return (
    <div className="jb-mobile-home jb-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-28 md:hidden">
      <header className="px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="text-sm text-[var(--jb-muted)]">Good to see you</p>
        <h1 className="text-[1.75rem] font-semibold tracking-tight">{userName ?? "Guest"}</h1>
        <p className="mt-1 text-sm text-[var(--jb-muted)]">{plan ?? "free"} plan</p>
      </header>

      <section className="mt-4 px-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Documents" value={String(analytics?.totalDocuments ?? "—")} />
          <StatCard label="Storage" value={`${storagePct}%`} sub="used" />
        </div>
      </section>

      <section className="mt-6 px-4">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-[var(--jb-muted)]">
          Quick actions
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <QuickAction to="/documents/new" icon={Plus} label="New JSON" primary />
          <QuickAction to="/compare" icon={GitCompare} label="Compare" />
          <QuickAction to="/documents/new" icon={Zap} label="Continue" />
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-8 px-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Continue editing</h2>
            {onClearRecent && (
              <button type="button" className="text-xs text-[var(--jb-muted)]" onClick={onClearRecent}>
                Clear
              </button>
            )}
          </div>
          <div className="space-y-3">
            {recent.slice(0, 5).map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link to={item.href} className="jb-mobile-card flex items-center gap-3 px-4 py-3.5 active:scale-[0.99]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--jb-accent)]/12 text-[var(--jb-accent)]">
                    <FileJson className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.title}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-[var(--jb-muted)]">
                      <Clock className="h-3 w-3" />
                      {new Date(item.openedAt).toLocaleDateString()}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[var(--jb-muted)]" />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {favDocs.length > 0 && (
        <section className="mt-8 px-4">
          <h2 className="mb-3 text-lg font-semibold">Favorites</h2>
          <div className="space-y-3">
            {favDocs.map((doc) => (
              <Link key={doc.id} to={`/documents/${doc.id}`} className="jb-mobile-card flex items-center gap-3 px-4 py-3.5">
                <Star className="h-5 w-5 shrink-0 text-amber-400" fill="currentColor" />
                <span className="min-w-0 flex-1 truncate font-medium">{doc.name || doc.id}</span>
                <ChevronRight className="h-5 w-5 text-[var(--jb-muted)]" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 px-4">
        <h2 className="mb-3 text-lg font-semibold">Templates</h2>
        <div className="space-y-3">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className="jb-mobile-card w-full px-4 py-4 text-left active:scale-[0.99]"
              onClick={() => onTemplate(tpl.content)}
            >
              <div className="font-medium">{tpl.name}</div>
              <p className="mt-1 text-sm text-[var(--jb-muted)]">{tpl.description}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="jb-mobile-card px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--jb-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-[var(--jb-muted)]">{sub}</p>}
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  primary,
}: {
  to: string;
  icon: typeof Plus;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "jb-mobile-card flex min-w-[7.5rem] shrink-0 flex-col gap-2 px-4 py-4 active:scale-[0.98]",
        primary && "border-[var(--jb-accent)]/40 bg-[var(--jb-accent)]/8",
      )}
    >
      <Icon className={cn("h-5 w-5", primary ? "text-[var(--jb-accent)]" : "text-[var(--jb-muted)]")} />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
