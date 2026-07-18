import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { JsonEditor } from "../components/editor/JsonEditor";
import { getApiBaseUrl } from "../lib/apiBase";
import { useAuthStore } from "../store/authStore";

const DEMO_JSON = `{
  "product": "jsonbob",
  "edge": true,
  "modes": ["text", "tree", "table"],
  "share": {
    "public": true,
    "url": "/view/demo"
  }
}`;

const FEATURES = [
  { title: "Edit", blurb: "Monaco + tree + table in one workspace." },
  { title: "Diff", blurb: "Sync-scroll compare with merge and accept." },
  { title: "Share", blurb: "Public URL, expiry, and raw API JSON." },
  { title: "API", blurb: "OpenAPI + Workers-native document CRUD." },
] as const;

function useTypedJson(source: string, enabled: boolean) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!enabled) {
      setText(source);
      return;
    }
    setText("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setText(source.slice(0, i));
      if (i >= source.length) window.clearInterval(id);
    }, 12);
    return () => window.clearInterval(id);
  }, [source, enabled]);
  return text;
}

export function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const reduceMotion = useReducedMotion();
  const typed = useTypedJson(DEMO_JSON, !reduceMotion);

  return (
    <main className="relative bg-[var(--jb-canvas)] text-[var(--jb-text)] pb-28 md:pb-0">
      {/* Ambient field */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 80% 55% at 50% -10%, color-mix(in srgb, var(--jb-accent) 28%, transparent), transparent 60%),
            linear-gradient(180deg, var(--jb-canvas) 0%, var(--jb-panel) 100%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(to right, color-mix(in srgb, var(--jb-border) 80%, transparent) 1px, transparent 1px),
            linear-gradient(to bottom, color-mix(in srgb, var(--jb-border) 80%, transparent) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(180deg, black 0%, transparent 70%)",
        }}
      />

      {/* Hero — one composition */}
      <section className="relative mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-6xl flex-col justify-between px-4 pb-10 pt-6 sm:pt-20 md:min-h-[calc(100svh-3.5rem)]">
        <div className="max-w-2xl">
          <motion.p
            className="text-4xl font-semibold tracking-tight sm:text-6xl md:font-display md:text-8xl"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <span>json</span>
            <span className="text-[var(--jb-accent)]">bob</span>
          </motion.p>

          <motion.h1
            className="mt-6 text-2xl font-medium tracking-tight text-[var(--jb-text)] sm:text-3xl"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            The JSON IDE for the edge.
          </motion.h1>

          <motion.p
            className="mt-4 max-w-md text-base text-[var(--jb-muted)] sm:text-lg"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.45 }}
          >
            Edit, diff, and share JSON on Cloudflare — tree, table, schema, and ⌘K included.
          </motion.p>

          <motion.div
            className="mt-9 flex flex-wrap gap-3"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <Link
              to="/documents/new"
              className="rounded-md bg-[var(--jb-accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--jb-accent-deep)]"
            >
              Open editor
            </Link>
            <Link
              to="/compare"
              className="rounded-md border border-[var(--jb-border)] px-5 py-2.5 text-sm text-[var(--jb-text)] hover:bg-[var(--jb-elevated)]"
            >
              View demo
            </Link>
            {!user && (
              <Link
                to="/register"
                className="rounded-md px-3 py-2.5 text-sm text-[var(--jb-muted)] hover:text-[var(--jb-text)]"
              >
                Sign up free
              </Link>
            )}
          </motion.div>
        </div>

        <motion.div
          className="relative mt-12 w-full overflow-hidden rounded-lg border border-[var(--jb-border)] bg-[#0b1220] shadow-[0_24px_80px_-40px_rgba(0,0,0,0.8)]"
          initial={reduceMotion ? false : { opacity: 0, y: 36, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.28, type: "spring", stiffness: 120, damping: 18 }}
        >
          <div className="flex items-center gap-2 border-b border-[var(--jb-border)] px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#eab308]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]/80" />
            <span className="ml-2 font-mono text-[11px] text-[var(--jb-muted)]">demo.json</span>
          </div>
          <div className="h-[min(42vh,320px)] min-h-[220px]">
            <JsonEditor value={typed} onChange={() => {}} readOnly bordered={false} />
          </div>
        </motion.div>
      </section>

      {/* Feature strip — second section, one job */}
      <section className="relative border-t border-[var(--jb-border)] bg-[var(--jb-panel)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            >
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--jb-accent)]">
                {f.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--jb-muted)]">{f.blurb}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="relative border-t border-[var(--jb-border)]">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-xl font-medium tracking-tight text-[var(--jb-text)]">FAQ</h2>
          <p className="mt-2 text-sm text-[var(--jb-muted)]">
            Short answers for first-time visitors.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              {
                q: "Is jsonbob free?",
                a: "Yes for personal use. Sign up for a library, version history, and private docs. Guest editor works without an account.",
              },
              {
                q: "How do I share JSON?",
                a: "Save a document, open Share, copy the view URL or raw API link. Optional password and expiry.",
              },
              {
                q: "Can I compare two documents?",
                a: "Open Compare, paste A and B, enable sync scroll, jump diffs, and merge paths either way.",
              },
              {
                q: "Does the tree handle large JSON?",
                a: "The explorer is virtualized so scrolling stays smooth. Extremely large parses still run on the main thread for now.",
              },
            ].map((item) => (
              <li key={item.q}>
                <details className="group rounded-lg border border-[var(--jb-border)] bg-[var(--jb-panel)] px-4 py-3 open:border-[var(--jb-accent)]/40">
                  <summary className="cursor-pointer list-none text-sm font-medium text-[var(--jb-text)] marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {item.q}
                      <span className="text-[var(--jb-muted)] transition group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--jb-muted)]">{item.a}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-[var(--jb-border)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 text-sm text-[var(--jb-muted)]">
          <p>
            <span className="text-[var(--jb-text)]">json</span>
            <span className="text-[var(--jb-accent)]">bob</span>
            <span className="ml-2">JSON on the edge.</span>
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/documents/new" className="hover:text-[var(--jb-text)]">
              Editor
            </Link>
            <Link to="/compare" className="hover:text-[var(--jb-text)]">
              Compare
            </Link>
            <a
              href={`${getApiBaseUrl()}/api-docs/ui`}
              className="hover:text-[var(--jb-text)]"
              target="_blank"
              rel="noreferrer"
            >
              API Docs
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
