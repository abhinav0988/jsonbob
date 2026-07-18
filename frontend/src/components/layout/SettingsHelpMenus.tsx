import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ACCENT_OPTIONS,
  type AccentColor,
  useThemeStore,
} from "../../store/themeStore";
import { useAuthStore } from "../../store/authStore";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { getApiBaseUrl } from "../../lib/apiBase";

export function SettingsHelpMenus() {
  const [open, setOpen] = useState<"settings" | "help" | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const mode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);
  const setMode = useThemeStore((s) => s.setMode);
  const setAccent = useThemeStore((s) => s.setAccent);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(null);
        setAboutOpen(false);
        setFaqOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const docsHref = `${getApiBaseUrl()}/api-docs/ui`;

  return (
    <div ref={rootRef} className="relative flex items-center gap-1">
      <MenuButton
        label="Settings"
        open={open === "settings"}
        onClick={() => setOpen((v) => (v === "settings" ? null : "settings"))}
      />
      <MenuButton
        label="Help"
        open={open === "help"}
        onClick={() => setOpen((v) => (v === "help" ? null : "help"))}
      />

      {open === "settings" && (
        <Dropdown>
          <SectionTitle>Theme</SectionTitle>
          <RadioItem
            active={mode === "system"}
            label="Browser default"
            hint="Follow OS"
            onClick={() => setMode("system")}
          />
          <RadioItem active={mode === "light"} label="Light" onClick={() => setMode("light")} />
          <RadioItem active={mode === "dark"} label="Dark" onClick={() => setMode("dark")} />

          <Divider />
          <SectionTitle>Theme color</SectionTitle>
          <div className="flex gap-2 px-3 py-2">
            {ACCENT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                title={opt.label}
                aria-label={opt.label}
                onClick={() => setAccent(opt.id as AccentColor)}
                className={`h-7 w-7 rounded-full border-2 ${
                  accent === opt.id ? "border-white" : "border-transparent opacity-80"
                }`}
                style={{ background: opt.swatch }}
              />
            ))}
          </div>

          <Divider />
          <SectionTitle>Configuration</SectionTitle>
          {user ? (
            <MenuLink to="/settings" onClick={() => setOpen(null)}>
              Configure account
            </MenuLink>
          ) : (
            <MenuLink to="/login" onClick={() => setOpen(null)}>
              Sign in to configure account
            </MenuLink>
          )}
          <MenuLink to="/compare" onClick={() => setOpen(null)}>
            Open Compare workspace
          </MenuLink>
        </Dropdown>
      )}

      {open === "help" && (
        <Dropdown>
          <MenuLink to="/" onClick={() => setOpen(null)}>
            About jsonbob
          </MenuLink>
          <a
            href={docsHref}
            target="_blank"
            rel="noreferrer"
            className={itemClass}
            onClick={() => setOpen(null)}
          >
            API Docs
          </a>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              setOpen(null);
              setFaqOpen(true);
            }}
          >
            FAQ
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              setOpen(null);
              setAboutOpen(true);
            }}
          >
            Product tour
          </button>
          <a
            href="mailto:hello@jsonbob.app?subject=jsonbob%20feedback"
            className={itemClass}
            onClick={() => setOpen(null)}
          >
            Feedback
          </a>
          <Divider />
          <MenuLink to="/documents/new" onClick={() => setOpen(null)}>
            Open Editor
          </MenuLink>
          <MenuLink to="/compare" onClick={() => setOpen(null)}>
            Compare JSON
          </MenuLink>
        </Dropdown>
      )}

      {aboutOpen && (
        <Modal title="About jsonbob" onClose={() => setAboutOpen(false)}>
          <p className="text-sm text-[var(--jb-muted)]">
            jsonbob stores and shares JSON like JSONBlob — with auth, versions, tree/table views, and
            side-by-side compare.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--jb-muted)]">
            <li>Editor + Tree + Table modes</li>
            <li>Compare with diff navigation</li>
            <li>Public URLs and private documents</li>
          </ul>
        </Modal>
      )}

      {faqOpen && (
        <Modal title="FAQ" onClose={() => setFaqOpen(false)}>
          <FaqItem q="Where is my data stored?">
            On Cloudflare (Workers, D1, R2). Documents you save are tied to your account when logged
            in.
          </FaqItem>
          <FaqItem q="How do I get a public JSON URL?">
            Save a public document, then use API URL / Raw — it points at{" "}
            <code className="text-[var(--jb-accent)]">/json/:id</code> on the API host.
          </FaqItem>
          <FaqItem q="What is Compare?">
            Paste two JSON docs, turn on Compare, and step through differences with ↑/↓. Use Table
            mode for array-of-objects editing.
          </FaqItem>
          <FaqItem q="How do I change theme?">
            Open Settings in the header — pick Light / Dark / Browser default and an accent color.
          </FaqItem>
        </Modal>
      )}
    </div>
  );
}

const itemClass =
  "flex w-full items-center px-3 py-2 text-left text-sm text-[var(--jb-text)] hover:bg-[var(--jb-border)]";

function MenuButton({
  label,
  open,
  onClick,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={`rounded px-2 py-1.5 text-sm hover:text-[var(--jb-accent-soft)] ${
        open ? "bg-[var(--jb-border)] text-[var(--jb-accent-soft)]" : "text-[var(--jb-muted)]"
      }`}
    >
      {label} <span className="text-[10px] opacity-70">▾</span>
    </button>
  );
}

function Dropdown({ children }: { children: ReactNode }) {
  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 min-w-[16rem] rounded-lg border border-[var(--jb-border)] bg-[var(--jb-panel)] py-2 shadow-xl"
      role="menu"
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--jb-muted)]">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="my-2 border-t border-[var(--jb-border)]" />;
}

function RadioItem({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={itemClass}
      onClick={onClick}
      role="menuitemradio"
      aria-checked={active}
    >
      <span
        className={`mr-2 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
          active ? "border-[var(--jb-accent)] bg-[var(--jb-accent)]" : "border-[var(--jb-muted)]"
        }`}
      >
        {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[10px] text-[var(--jb-muted)]">{hint}</span>}
    </button>
  );
}

function MenuLink({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={itemClass} onClick={onClick} role="menuitem">
      {children}
    </Link>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const trapRef = useFocusTrap(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        ref={trapRef}
        className="relative z-10 w-full max-w-md rounded-xl border border-[var(--jb-border)] bg-[var(--jb-panel)] p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--jb-text)]">{title}</h2>
          <button type="button" className="jb-action" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FaqItem({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div className="mb-3 border-b border-[var(--jb-border)] pb-3 last:mb-0 last:border-0 last:pb-0">
      <p className="text-sm font-medium text-[var(--jb-accent-soft)]">{q}</p>
      <div className="mt-1 text-sm text-[var(--jb-muted)]">{children}</div>
    </div>
  );
}
