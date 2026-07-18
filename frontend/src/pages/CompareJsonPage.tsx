import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import { Link } from "react-router-dom";
import type { editor } from "monaco-editor";
import { JsonEditor } from "../components/editor/JsonEditor";
import { JsonTableView } from "../components/editor/JsonTableView";
import { JsonTreeView } from "../components/editor/JsonTreeView";
import {
  compareJson,
  kindColor,
  kindLabel,
  summarizeDiffs,
  type DiffKind,
  type JsonDiffItem,
} from "../lib/jsonDiff";
import { getAtPath, pathToLabel, setAtPath, tokenizePath } from "../lib/jsonPath";
import { useRecentStore } from "../store/recentStore";
import { useWorkspaceStore } from "../store/workspaceStore";
import { minifyJson, prettyPrint, sortJsonKeys } from "../components/editor/jsonTools";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { toast } from "../features/toast/toastStore";
import { MobileCompare } from "../components/mobile/MobileCompare";
import { useIsMobile } from "../hooks/useIsMobile";

const SAMPLE_A = `{
  "name": "Abhinav",
  "role": "Backend Developer",
  "skills": ["node", "typescript"],
  "paymentGateways": {
    "payCards": [
      { "id": 1, "brand": "visa", "last4": "4242" },
      { "id": 2, "brand": "mastercard", "last4": "4444" }
    ]
  },
  "active": true
}`;

const SAMPLE_B = `{
  "name": "Abhinav",
  "role": "Full Stack Developer",
  "skills": ["node", "typescript", "react"],
  "paymentGateways": {
    "payCards": [
      { "id": 1, "brand": "visa", "last4": "4242" },
      { "id": 2, "brand": "amex", "last4": "0005" },
      { "id": 3, "brand": "mada", "last4": "1234" }
    ]
  },
  "team": "Platform",
  "active": true
}`;

type PaneMode = "text" | "tree" | "table";
type Side = "left" | "right";

export function CompareJsonPage() {
  const pushRecent = useRecentStore((s) => s.push);
  const isMobile = useIsMobile();
  const openTab = useWorkspaceStore((s) => s.openTab);
  const [left, setLeft] = useState(SAMPLE_A);
  const [right, setRight] = useState(SAMPLE_B);
  const [leftMode, setLeftMode] = useState<PaneMode>("tree");
  const [rightMode, setRightMode] = useState<PaneMode>("tree");
  const [leftFocus, setLeftFocus] = useState("$");
  const [rightFocus, setRightFocus] = useState("$");
  const [compareOn, setCompareOn] = useState(true);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreKeyOrder, setIgnoreKeyOrder] = useState(false);
  const [filter, setFilter] = useState<"all" | DiffKind>("all");
  const [diffIndex, setDiffIndex] = useState(0);
  const [expandAll, setExpandAll] = useState(0);
  const [collapseAll, setCollapseAll] = useState(0);
  const [treeQuery, setTreeQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [transformOpen, setTransformOpen] = useState<"left" | "right" | null>(null);
  const [syncScroll, setSyncScroll] = useState(true);
  const leftScrollEl = useRef<HTMLDivElement | null>(null);
  const rightScrollEl = useRef<HTMLDivElement | null>(null);
  const leftEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const rightEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const syncingScroll = useRef(false);

  useEffect(() => {
    openTab({ id: "compare", title: "Compare", href: "/compare" });
  }, [openTab]);

  const leftParsed = useMemo(() => tryParse(left), [left]);
  const rightParsed = useMemo(() => tryParse(right), [right]);
  const debouncedLeft = useDebouncedValue(leftParsed, 150);
  const debouncedRight = useDebouncedValue(rightParsed, 150);

  const applyPeerScroll = useCallback((source: HTMLDivElement, target: HTMLDivElement | null) => {
    if (!target || syncingScroll.current) return;
    const maxSrc = source.scrollHeight - source.clientHeight;
    const maxTgt = target.scrollHeight - target.clientHeight;
    if (maxSrc <= 0 || maxTgt <= 0) return;
    syncingScroll.current = true;
    target.scrollTop = (source.scrollTop / maxSrc) * maxTgt;
    requestAnimationFrame(() => {
      syncingScroll.current = false;
    });
  }, []);

  const onPaneScroll = useCallback(
    (side: Side) => (e: UIEvent<HTMLDivElement>) => {
      if (!syncScroll) return;
      const source = e.currentTarget;
      const peer = side === "left" ? rightScrollEl.current : leftScrollEl.current;
      applyPeerScroll(source, peer);
    },
    [applyPeerScroll, syncScroll],
  );

  useEffect(() => {
    if (!syncScroll) return;
    if (leftMode !== "text" || rightMode !== "text") return;
    const leftEd = leftEditorRef.current;
    const rightEd = rightEditorRef.current;
    if (!leftEd || !rightEd) return;

    const syncFrom = (from: editor.IStandaloneCodeEditor, to: editor.IStandaloneCodeEditor) => {
      if (syncingScroll.current) return;
      const maxFrom = from.getScrollHeight() - from.getLayoutInfo().height;
      const maxTo = to.getScrollHeight() - to.getLayoutInfo().height;
      if (maxFrom <= 0 || maxTo <= 0) return;
      syncingScroll.current = true;
      to.setScrollTop((from.getScrollTop() / maxFrom) * maxTo);
      requestAnimationFrame(() => {
        syncingScroll.current = false;
      });
    };

    const d1 = leftEd.onDidScrollChange(() => syncFrom(leftEd, rightEd));
    const d2 = rightEd.onDidScrollChange(() => syncFrom(rightEd, leftEd));
    return () => {
      d1.dispose();
      d2.dispose();
    };
  }, [syncScroll, leftMode, rightMode, left, right]);

  const leftView = useMemo(() => {
    if (!leftParsed.ok) return { ok: false as const, error: leftParsed.error };
    return { ok: true as const, data: getAtPath(leftParsed.data, leftFocus) };
  }, [leftParsed, leftFocus]);

  const rightView = useMemo(() => {
    if (!rightParsed.ok) return { ok: false as const, error: rightParsed.error };
    return { ok: true as const, data: getAtPath(rightParsed.data, rightFocus) };
  }, [rightParsed, rightFocus]);

  const diffs = useMemo(() => {
    if (!compareOn || !debouncedLeft.ok || !debouncedRight.ok) return [] as JsonDiffItem[];
    return compareJson(debouncedLeft.data, debouncedRight.data, "$", {
      ignoreWhitespace,
      ignoreCase,
      ignoreKeyOrder,
    });
  }, [compareOn, debouncedLeft, debouncedRight, ignoreWhitespace, ignoreCase, ignoreKeyOrder]);

  const summary = useMemo(() => summarizeDiffs(diffs), [diffs]);
  const filtered = useMemo(
    () => (filter === "all" ? diffs : diffs.filter((d) => d.kind === filter)),
    [diffs, filter],
  );

  useEffect(() => {
    setDiffIndex(0);
  }, [left, right, filter, compareOn, ignoreWhitespace, ignoreCase, ignoreKeyOrder]);

  const selected = filtered[diffIndex] ?? null;
  const selectedPath = selected?.path ?? null;

  const leftHighlights = useMemo(() => buildHighlights(diffs, "left", compareOn), [diffs, compareOn]);
  const rightHighlights = useMemo(
    () => buildHighlights(diffs, "right", compareOn),
    [diffs, compareOn],
  );

  function flash(msg: string) {
    setNotice(msg);
    toast(msg, "info");
    window.setTimeout(() => setNotice(null), 2000);
  }

  function setSideText(side: Side, text: string) {
    if (side === "left") setLeft(text);
    else setRight(text);
  }

  function focusSide(side: Side, path: string) {
    if (side === "left") {
      setLeftFocus(path);
      setLeftMode("table");
    } else {
      setRightFocus(path);
      setRightMode("table");
    }
  }

  function extractSide(side: Side, path: string) {
    const parsed = side === "left" ? leftParsed : rightParsed;
    if (!parsed.ok) return;
    const value = getAtPath(parsed.data, path);
    if (value === undefined) {
      flash("Path not found");
      return;
    }
    const pretty = JSON.stringify(value, null, 2);
    setSideText(side, pretty);
    if (side === "left") setLeftFocus("$");
    else setRightFocus("$");
    flash(`Extracted ${pathToLabel(path)}`);
  }

  function editPathInTree(side: Side, path: string) {
    if (side === "left") {
      setLeftFocus("$");
      setLeftMode("tree");
    } else {
      setRightFocus("$");
      setRightMode("tree");
    }
    const i = filtered.findIndex((d) => d.path === path);
    if (i >= 0) setDiffIndex(i);
    else {
      // force scroll via temporary selection through onSelectPath highlight
      // use expand + query for path segment
      const label = pathToLabel(path).split(".").pop() ?? "";
      if (label) setTreeQuery(label);
    }
    flash(`Opened ${pathToLabel(path)} in tree`);
  }

  function transform(side: Side, kind: "pretty" | "minify" | "sort" | "upperKeys") {
    const text = side === "left" ? left : right;
    try {
      let next = text;
      if (kind === "pretty") next = prettyPrint(text);
      else if (kind === "minify") next = minifyJson(text);
      else if (kind === "sort") next = sortJsonKeys(text);
      else if (kind === "upperKeys") {
        next = JSON.stringify(mapKeys(JSON.parse(text), (k) => k.toUpperCase()), null, 2);
      }
      setSideText(side, next);
      setTransformOpen(null);
      flash(kind === "pretty" ? "Formatted" : kind === "minify" ? "Minified" : kind === "sort" ? "Keys sorted" : "Keys uppercased");
    } catch {
      flash("Invalid JSON");
    }
  }

  function copyValue(from: Side, to: Side) {
    const src = from === "left" ? left : right;
    setSideText(to, src);
    if (to === "left") setLeftFocus("$");
    else setRightFocus("$");
    flash(from === "left" ? "Copied A → B" : "Copied B → A");
  }

  function mergeSelected(direction: "toLeft" | "toRight") {
    if (!selectedPath) {
      flash("Select a diff first");
      return;
    }
    try {
      const leftDoc = JSON.parse(left);
      const rightDoc = JSON.parse(right);
      if (direction === "toLeft") {
        const v = getAtPath(rightDoc, selectedPath);
        setLeft(JSON.stringify(setAtPath(leftDoc, selectedPath, v), null, 2));
        flash(`Merged ${pathToLabel(selectedPath)} → A`);
      } else {
        const v = getAtPath(leftDoc, selectedPath);
        setRight(JSON.stringify(setAtPath(rightDoc, selectedPath, v), null, 2));
        flash(`Merged ${pathToLabel(selectedPath)} → B`);
      }
    } catch {
      flash("Merge failed — fix JSON");
    }
  }

  function acceptAllFrom(side: "left" | "right") {
    if (side === "left") {
      setRight(left);
      flash("Accepted all from A");
    } else {
      setLeft(right);
      flash("Accepted all from B");
    }
  }

  function transformCopy(from: Side, to: Side) {
    const src = from === "left" ? left : right;
    try {
      const pretty = prettyPrint(src);
      setSideText(to, pretty);
      flash(from === "left" ? "Transformed A → B" : "Transformed B → A");
    } catch {
      flash("Fix invalid JSON first");
    }
  }

  function patchTableCell(side: Side, row: number, key: string, raw: string) {
    const focus = side === "left" ? leftFocus : rightFocus;
    const parsed = side === "left" ? leftParsed : rightParsed;
    if (!parsed.ok) return;
    const view = getAtPath(parsed.data, focus);
    if (!Array.isArray(view)) return;
    let parsedCell: unknown = raw;
    try {
      parsedCell = JSON.parse(raw);
    } catch {
      parsedCell = raw;
    }
    const nextRows = structuredClone(view) as Record<string, unknown>[];
    nextRows[row] = { ...nextRows[row], [key]: parsedCell };
    const nextRoot = setAtPath(parsed.data, focus, nextRows);
    setSideText(side, JSON.stringify(nextRoot, null, 2));
  }

  function mutateSideRoot(side: Side, focus: string, mutator: (view: unknown) => unknown) {
    const parsed = side === "left" ? leftParsed : rightParsed;
    if (!parsed.ok) return;
    const view = getAtPath(parsed.data, focus);
    const nextView = mutator(view);
    const nextRoot = setAtPath(parsed.data, focus, nextView);
    setSideText(side, JSON.stringify(nextRoot, null, 2));
  }

  function absoluteInFocus(focus: string, relative: string) {
    if (relative === "$") return focus;
    if (focus === "$") return relative;
    return focus + relative.slice(1);
  }

  function deletePath(side: Side, relativePath: string) {
    const focus = side === "left" ? leftFocus : rightFocus;
    const abs = absoluteInFocus(focus, relativePath);
    const parsed = side === "left" ? leftParsed : rightParsed;
    if (!parsed.ok || abs === "$") return;
    const next = deleteAtPath(parsed.data, abs);
    setSideText(side, JSON.stringify(next, null, 2));
    flash(`Deleted ${pathToLabel(abs)}`);
  }

  function duplicatePath(side: Side, relativePath: string) {
    const focus = side === "left" ? leftFocus : rightFocus;
    const abs = absoluteInFocus(focus, relativePath);
    const parsed = side === "left" ? leftParsed : rightParsed;
    if (!parsed.ok || abs === "$") return;
    const next = duplicateAtPath(parsed.data, abs);
    setSideText(side, JSON.stringify(next, null, 2));
    flash(`Duplicated ${pathToLabel(abs)}`);
  }

  function reorderPath(side: Side, relativeParent: string, fromIndex: number, toIndex: number) {
    const focus = side === "left" ? leftFocus : rightFocus;
    const absParent = absoluteInFocus(focus, relativeParent);
    mutateSideRoot(side, absParent, (view) => {
      if (!Array.isArray(view)) return view;
      const next = [...view];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  }

  function deleteTableRows(side: Side, indices: number[]) {
    const focus = side === "left" ? leftFocus : rightFocus;
    mutateSideRoot(side, focus, (view) => {
      if (!Array.isArray(view)) return view;
      const drop = new Set(indices);
      return view.filter((_, i) => !drop.has(i));
    });
    flash(`Deleted ${indices.length} row(s)`);
  }

  return (
    <>
      {isMobile && (
        <MobileCompare
          left={left}
          right={right}
          setLeft={setLeft}
          setRight={setRight}
          compareOn={compareOn}
          setCompareOn={setCompareOn}
          diffIndex={diffIndex}
          setDiffIndex={setDiffIndex}
          filteredDiffs={filtered}
          onAccept={() => mergeSelected("toLeft")}
          onReject={() => setDiffIndex(Math.min(filtered.length - 1, diffIndex + 1))}
          onMerge={() => mergeSelected("toRight")}
        />
      )}
    <div className={isMobile ? "hidden" : "flex h-full min-h-0 flex-col"} onClick={() => setTransformOpen(null)}>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--jb-border)] bg-[var(--jb-elevated)] px-3 py-2">
        <h1 className="mr-2 text-sm font-semibold text-[var(--jb-text)]">Compare JSON</h1>
        <button
          type="button"
          className="jb-action"
          onClick={() => {
            setLeft(right);
            setRight(left);
            setLeftFocus(rightFocus);
            setRightFocus(leftFocus);
          }}
        >
          Swap A/B
        </button>
        <button
          type="button"
          className="jb-action"
          onClick={() => {
            try {
              setLeft(prettyPrint(left));
              setRight(prettyPrint(right));
              flash("Formatted both");
            } catch {
              flash("Fix invalid JSON first");
            }
          }}
        >
          Format both
        </button>
        <button
          type="button"
          className="jb-action"
          onClick={() => {
            pushRecent({
              id: `compare-${Date.now()}`,
              title: "JSON Compare session",
              href: "/compare",
              source: "compare",
              preview: `${summary.total} diffs`,
            });
            flash("Saved to recent");
          }}
        >
          Save to recent
        </button>
        <Link to="/documents/new" className="jb-action">
          Open Editor
        </Link>
        <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--jb-muted)]">
          <input
            type="checkbox"
            checked={syncScroll}
            onChange={(e) => setSyncScroll(e.target.checked)}
            className="accent-[var(--jb-accent)]"
          />
          Sync scroll
        </label>
        <span className="mx-1 hidden h-4 w-px bg-[var(--jb-border)] sm:inline" />
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--jb-muted)]">
          <input
            type="checkbox"
            checked={ignoreWhitespace}
            onChange={(e) => setIgnoreWhitespace(e.target.checked)}
            className="accent-[var(--jb-accent)]"
          />
          Ignore whitespace
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--jb-muted)]">
          <input
            type="checkbox"
            checked={ignoreCase}
            onChange={(e) => setIgnoreCase(e.target.checked)}
            className="accent-[var(--jb-accent)]"
          />
          Ignore case
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[var(--jb-muted)]">
          <input
            type="checkbox"
            checked={ignoreKeyOrder}
            onChange={(e) => setIgnoreKeyOrder(e.target.checked)}
            className="accent-[var(--jb-accent)]"
          />
          Ignore key order
        </label>
        {notice && <span className="ml-auto text-xs text-[var(--jb-accent-soft)]">{notice}</span>}
      </div>

      <div className="grid shrink-0 gap-2 border-b border-[var(--jb-border)] bg-[var(--jb-panel)] px-3 py-3 sm:grid-cols-5">
        <DiffStat label="Total" value={summary.total} />
        <DiffStat label="Missing in A" value={summary.missingInA} tone="sky" />
        <DiffStat label="Missing in B" value={summary.missingInB} tone="amber" />
        <DiffStat label="Value changed" value={summary.valueChanged} tone="rose" />
        <DiffStat label="Type changed" value={summary.typeChanged} tone="violet" />
      </div>

      {!leftParsed.ok || !rightParsed.ok ? (
        <p className="shrink-0 bg-red-950/30 px-4 py-2 text-sm text-red-300">
          {!leftParsed.ok ? `A: ${leftParsed.error}` : null}
          {!leftParsed.ok && !rightParsed.ok ? " · " : null}
          {!rightParsed.ok ? `B: ${rightParsed.error}` : null}
        </p>
      ) : compareOn && summary.total === 0 ? (
        <p className="shrink-0 bg-emerald-950/20 px-4 py-2 text-sm text-emerald-300">
          JSON A and B are identical.
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[1fr_14px_88px_1fr]">
        <Pane
          title="Document A"
          side="left"
          mode={leftMode}
          onMode={(m) => {
            setLeftMode(m);
            if (m !== "table" && m !== "tree") setLeftFocus("$");
          }}
          text={left}
          onChange={setLeft}
          view={leftView}
          focusPath={leftFocus}
          expandAll={expandAll}
          collapseAll={collapseAll}
          query={treeQuery}
          highlightClasses={leftHighlights}
          focusDiffPath={selectedPath}
          transformOpen={transformOpen === "left"}
          onToggleTransform={(e) => {
            e.stopPropagation();
            setTransformOpen((v) => (v === "left" ? null : "left"));
          }}
          onTransform={(kind) => transform("left", kind)}
          onExpand={() => setExpandAll((n) => n + 1)}
          onCollapse={() => setCollapseAll((n) => n + 1)}
          onQuery={setTreeQuery}
          onResetFocus={() => setLeftFocus("$")}
          onEditPath={(p) => focusSide("left", p)}
          onExtractPath={(p) => extractSide("left", p)}
          onSwitchToTree={() => {
            setLeftMode("tree");
          }}
          onOpenNested={(p) => editPathInTree("left", p)}
          onCellChange={(row, key, raw) => patchTableCell("left", row, key, raw)}
          onDeleteRows={(indices) => deleteTableRows("left", indices)}
          onSelectPath={(p) => {
            const i = filtered.findIndex((d) => d.path === p);
            if (i >= 0) setDiffIndex(i);
          }}
          onCopyPath={(p) => {
            void navigator.clipboard.writeText(p);
            flash(`Copied ${p}`);
          }}
          onDeletePath={(p) => deletePath("left", p)}
          onDuplicatePath={(p) => duplicatePath("left", p)}
          onReorder={(parent, from, to) => reorderPath("left", parent, from, to)}
          scrollRef={(el) => {
            leftScrollEl.current = el;
          }}
          onScroll={onPaneScroll("left")}
          onEditorMount={(ed) => {
            leftEditorRef.current = ed;
          }}
        />

        <DiffMinimap
          items={compareOn ? filtered : []}
          activeIndex={diffIndex}
          onJump={setDiffIndex}
        />

        <div
          className="flex shrink-0 flex-row flex-wrap items-center justify-center gap-2 border-y border-[var(--jb-border)] bg-[var(--jb-panel)] px-2 py-3 lg:flex-col lg:border-x lg:border-y-0"
          onClick={(e) => e.stopPropagation()}
        >
          <CenterLabel>Copy</CenterLabel>
          <button type="button" title="Copy A → B" className="jb-action h-9 w-9 px-0" onClick={() => copyValue("left", "right")}>
            →
          </button>
          <button type="button" title="Copy B → A" className="jb-action h-9 w-9 px-0" onClick={() => copyValue("right", "left")}>
            ←
          </button>

          <CenterLabel>Transform</CenterLabel>
          <button
            type="button"
            title="Pretty-copy A → B"
            className="jb-action h-9 w-9 px-0"
            onClick={() => transformCopy("left", "right")}
          >
            ⇉
          </button>
          <button
            type="button"
            title="Pretty-copy B → A"
            className="jb-action h-9 w-9 px-0"
            onClick={() => transformCopy("right", "left")}
          >
            ⇇
          </button>

          <CenterLabel>Merge</CenterLabel>
          <button
            type="button"
            title="Merge selected path into A"
            className="jb-action h-9 w-9 px-0 text-[10px]"
            disabled={!selectedPath}
            onClick={() => mergeSelected("toLeft")}
          >
            ‹M
          </button>
          <button
            type="button"
            title="Merge selected path into B"
            className="jb-action h-9 w-9 px-0 text-[10px]"
            disabled={!selectedPath}
            onClick={() => mergeSelected("toRight")}
          >
            M›
          </button>
          <button
            type="button"
            title="Accept all from A"
            className="jb-action px-2 text-[10px]"
            onClick={() => acceptAllFrom("left")}
          >
            Acc A
          </button>
          <button
            type="button"
            title="Accept all from B"
            className="jb-action px-2 text-[10px]"
            onClick={() => acceptAllFrom("right")}
          >
            Acc B
          </button>

          <CenterLabel>Diffs</CenterLabel>
          <label className="flex cursor-pointer flex-col items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--jb-muted)]">
            <input
              type="checkbox"
              checked={compareOn}
              onChange={(e) => setCompareOn(e.target.checked)}
              className="accent-[var(--jb-accent)]"
            />
            Compare
          </label>
          <span className="text-[10px] text-[var(--jb-muted)]">
            {compareOn ? `${filtered.length} diffs` : "off"}
          </span>
          <div className="flex gap-1 lg:flex-col">
            <button
              type="button"
              className="jb-action h-8 w-8 px-0 disabled:opacity-40"
              disabled={!compareOn || filtered.length === 0}
              onClick={() =>
                setDiffIndex((i) => (i - 1 + filtered.length) % filtered.length)
              }
              title="Previous difference"
            >
              ↑
            </button>
            <button
              type="button"
              className="jb-action h-8 w-8 px-0 disabled:opacity-40"
              disabled={!compareOn || filtered.length === 0}
              onClick={() => setDiffIndex((i) => (i + 1) % filtered.length)}
              title="Next difference"
            >
              ↓
            </button>
          </div>
          {compareOn && filtered.length > 0 && (
            <span className="font-mono text-[10px] text-[var(--jb-accent-soft)]">
              {diffIndex + 1}/{filtered.length}
            </span>
          )}
        </div>

        <Pane
          title="Document B"
          side="right"
          mode={rightMode}
          onMode={(m) => {
            setRightMode(m);
            if (m !== "table" && m !== "tree") setRightFocus("$");
          }}
          text={right}
          onChange={setRight}
          view={rightView}
          focusPath={rightFocus}
          expandAll={expandAll}
          collapseAll={collapseAll}
          query={treeQuery}
          highlightClasses={rightHighlights}
          focusDiffPath={selectedPath}
          transformOpen={transformOpen === "right"}
          onToggleTransform={(e) => {
            e.stopPropagation();
            setTransformOpen((v) => (v === "right" ? null : "right"));
          }}
          onTransform={(kind) => transform("right", kind)}
          onExpand={() => setExpandAll((n) => n + 1)}
          onCollapse={() => setCollapseAll((n) => n + 1)}
          onQuery={setTreeQuery}
          onResetFocus={() => setRightFocus("$")}
          onEditPath={(p) => focusSide("right", p)}
          onExtractPath={(p) => extractSide("right", p)}
          onSwitchToTree={() => {
            setRightMode("tree");
          }}
          onOpenNested={(p) => editPathInTree("right", p)}
          onCellChange={(row, key, raw) => patchTableCell("right", row, key, raw)}
          onDeleteRows={(indices) => deleteTableRows("right", indices)}
          onSelectPath={(p) => {
            const i = filtered.findIndex((d) => d.path === p);
            if (i >= 0) setDiffIndex(i);
          }}
          onCopyPath={(p) => {
            void navigator.clipboard.writeText(p);
            flash(`Copied ${p}`);
          }}
          onDeletePath={(p) => deletePath("right", p)}
          onDuplicatePath={(p) => duplicatePath("right", p)}
          onReorder={(parent, from, to) => reorderPath("right", parent, from, to)}
          scrollRef={(el) => {
            rightScrollEl.current = el;
          }}
          onScroll={onPaneScroll("right")}
          onEditorMount={(ed) => {
            rightEditorRef.current = ed;
          }}
        />
      </div>

      {compareOn && (
        <div className="jb-scroll max-h-[26vh] shrink-0 overflow-y-auto border-t border-[var(--jb-border)]">
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-[var(--jb-border)] bg-[var(--jb-elevated)] px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--jb-muted)]">
              Diff list
            </span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | DiffKind)}
              className="toolbar-input"
            >
              <option value="all">All ({diffs.length})</option>
              <option value="missing_in_a">Missing in A</option>
              <option value="missing_in_b">Missing in B</option>
              <option value="value_changed">Value changed</option>
              <option value="type_changed">Type changed</option>
              <option value="array_length">Array length</option>
            </select>
            {selected && (
              <span className="font-mono text-xs text-[var(--jb-accent-soft)]">{selected.path}</span>
            )}
          </div>
          <ul className="space-y-1 p-2 text-sm">
            {filtered.map((d, i) => (
              <li key={`${d.kind}-${d.path}-${d.message}`}>
                <button
                  type="button"
                  onClick={() => setDiffIndex(i)}
                  className={`w-full rounded border px-3 py-2 text-left hover:bg-[var(--jb-border)] ${
                    diffIndex === i ? "border-[var(--jb-accent)]/50 bg-[var(--jb-accent)]/10" : "border-[var(--jb-border)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-medium ${kindColor(d.kind)}`}>
                      {kindLabel(d.kind)}
                    </span>
                    <span className="font-mono text-xs text-[var(--jb-muted)]">{d.path}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--jb-muted)]">{d.message}</p>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-[var(--jb-muted)]">No diffs</li>
            )}
          </ul>
        </div>
      )}
    </div>
    </>
  );
}

function Pane({
  title,
  mode,
  onMode,
  text,
  onChange,
  view,
  focusPath,
  expandAll,
  collapseAll,
  query,
  highlightClasses,
  focusDiffPath,
  transformOpen,
  onToggleTransform,
  onTransform,
  onExpand,
  onCollapse,
  onQuery,
  onResetFocus,
  onEditPath,
  onExtractPath,
  onSwitchToTree,
  onOpenNested,
  onCellChange,
  onDeleteRows,
  onSelectPath,
  onCopyPath,
  onDeletePath,
  onDuplicatePath,
  onReorder,
  scrollRef,
  onScroll,
  onEditorMount,
}: {
  title: string;
  side: Side;
  mode: PaneMode;
  onMode: (m: PaneMode) => void;
  text: string;
  onChange: (v: string) => void;
  view: { ok: true; data: unknown } | { ok: false; error: string };
  focusPath: string;
  expandAll: number;
  collapseAll: number;
  query: string;
  highlightClasses: Map<string, string>;
  focusDiffPath: string | null;
  transformOpen: boolean;
  onToggleTransform: (e: MouseEvent) => void;
  onTransform: (kind: "pretty" | "minify" | "sort" | "upperKeys") => void;
  onExpand: () => void;
  onCollapse: () => void;
  onQuery: (q: string) => void;
  onResetFocus: () => void;
  onEditPath: (p: string) => void;
  onExtractPath: (p: string) => void;
  onSwitchToTree: () => void;
  onOpenNested: (p: string) => void;
  onCellChange: (row: number, key: string, raw: string) => void;
  onDeleteRows: (indices: number[]) => void;
  onSelectPath: (p: string) => void;
  onCopyPath: (p: string) => void;
  onDeletePath: (p: string) => void;
  onDuplicatePath: (p: string) => void;
  onReorder: (parentPath: string, fromIndex: number, toIndex: number) => void;
  scrollRef?: (el: HTMLDivElement | null) => void;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
  onEditorMount?: (ed: editor.IStandaloneCodeEditor) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden border-b border-[var(--jb-border)] lg:border-b-0">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--jb-border)] bg-[var(--jb-elevated)] px-2 py-1.5">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--jb-muted)]">
          {title}
        </span>
        <div className="flex rounded border border-[var(--jb-border)] p-0.5">
          {(["text", "tree", "table"] as PaneMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`rounded px-2 py-1 text-xs capitalize ${
                mode === m ? "bg-[var(--jb-accent)] text-white" : "text-[var(--jb-muted)] hover:text-white"
              }`}
              onClick={() => onMode(m)}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="relative">
          <button type="button" className="jb-action" onClick={onToggleTransform}>
            Transform ▾
          </button>
          {transformOpen && (
            <div
              className="absolute left-0 top-full z-20 mt-1 min-w-[10rem] rounded border border-[var(--jb-border)] bg-[var(--jb-panel)] py-1 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {(
                [
                  ["pretty", "Pretty print"],
                  ["minify", "Minify"],
                  ["sort", "Sort keys"],
                  ["upperKeys", "UPPERCASE keys"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-xs text-[var(--jb-text)] hover:bg-[var(--jb-border)]"
                  onClick={() => onTransform(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="jb-action"
          onClick={() => {
            void navigator.clipboard.writeText(text);
          }}
          title="Copy JSON text"
        >
          Copy
        </button>

        {focusPath !== "$" && (
          <button type="button" className="jb-action" onClick={onResetFocus} title="Back to root">
            Root
          </button>
        )}

        {(mode === "tree" || mode === "table") && (
          <>
            {mode === "tree" && (
              <>
                <button type="button" className="jb-action" onClick={onExpand}>
                  Expand
                </button>
                <button type="button" className="jb-action" onClick={onCollapse}>
                  Collapse
                </button>
              </>
            )}
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search…"
              className="toolbar-input ml-auto"
            />
          </>
        )}
      </div>

      {focusPath !== "$" && (
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--jb-border)] bg-[var(--jb-panel)] px-3 py-1 text-xs text-[var(--jb-muted)]">
          <span>Focus:</span>
          <code className="font-mono text-[var(--jb-accent-soft)]">{pathToLabel(focusPath)}</code>
          <button type="button" className="text-[#60a5fa] hover:underline" onClick={onResetFocus}>
            clear
          </button>
          <button
            type="button"
            className="jb-action ml-auto"
            onClick={() => onExtractPath(focusPath)}
          >
            Extract
          </button>
        </div>
      )}

      <div
        ref={mode !== "tree" ? scrollRef : undefined}
        className={`min-h-0 flex-1 ${mode === "tree" ? "overflow-hidden" : "jb-scroll overflow-auto"}`}
        onScroll={mode !== "tree" ? onScroll : undefined}
      >
        {mode === "text" ? (
          <div className="relative h-full min-h-[280px]">
            <JsonEditor
              value={text}
              onChange={onChange}
              bordered={false}
              onMount={(ed) => onEditorMount?.(ed)}
            />
          </div>
        ) : !view.ok ? (
          <p className="p-4 text-sm text-red-300">{view.error}</p>
        ) : mode === "tree" ? (
          <JsonTreeView
            data={view.data}
            expandAll={expandAll}
            collapseAll={collapseAll}
            query={query}
            highlightClasses={highlightClasses}
            focusPath={focusDiffPath}
            onCopyPath={onCopyPath}
            onSelectPath={onSelectPath}
            onDeletePath={onDeletePath}
            onDuplicatePath={onDuplicatePath}
            onReorder={onReorder}
            scrollRef={scrollRef}
            onScroll={onScroll}
          />
        ) : (
          <JsonTableView
            data={view.data}
            focusPath={focusPath}
            onEditPath={onEditPath}
            onExtractPath={onExtractPath}
            onSwitchToTree={onSwitchToTree}
            onOpenNested={onOpenNested}
            onCellChange={onCellChange}
            onDeleteRows={onDeleteRows}
          />
        )}
      </div>
    </section>
  );
}

function DiffMinimap({
  items,
  activeIndex,
  onJump,
}: {
  items: JsonDiffItem[];
  activeIndex: number;
  onJump: (index: number) => void;
}) {
  if (items.length === 0) {
    return <div className="hidden bg-[var(--jb-panel)] lg:block" aria-hidden />;
  }
  return (
    <div
      className="jb-scroll hidden h-full min-h-0 flex-col gap-px overflow-y-auto border-x border-[var(--jb-border)] bg-[var(--jb-panel)] py-1 lg:flex"
      title="Diff minimap"
      aria-label="Diff minimap"
    >
      {items.map((d, i) => (
        <button
          key={`${d.kind}-${d.path}-${i}`}
          type="button"
          title={`${kindLabel(d.kind)} · ${d.path}`}
          aria-label={`Jump to diff ${i + 1}`}
          aria-current={i === activeIndex ? "true" : undefined}
          onClick={() => onJump(i)}
          className={`mx-auto w-2 min-h-[3px] flex-1 rounded-sm transition-opacity hover:opacity-100 ${
            i === activeIndex ? "ring-1 ring-white/80 opacity-100" : "opacity-70"
          } ${minimapTickClass(d.kind)}`}
        />
      ))}
    </div>
  );
}

function minimapTickClass(kind: DiffKind): string {
  switch (kind) {
    case "missing_in_a":
      return "bg-sky-400";
    case "missing_in_b":
      return "bg-amber-400";
    case "value_changed":
      return "bg-rose-400";
    case "type_changed":
      return "bg-violet-400";
    case "array_length":
      return "bg-orange-400";
    case "moved":
      return "bg-emerald-400";
  }
}

function deleteAtPath(root: unknown, path: string): unknown {
  if (!path || path === "$") return root;
  const parts = tokenizePath(path);
  const clone = structuredClone(root) as unknown;
  let cur: unknown = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (cur == null || typeof cur !== "object") return root;
    if (Array.isArray(cur)) cur = cur[Number(part)];
    else cur = (cur as Record<string, unknown>)[part];
  }
  const last = parts[parts.length - 1]!;
  if (cur == null || typeof cur !== "object") return root;
  if (Array.isArray(cur)) {
    const idx = Number(last);
    if (Number.isInteger(idx) && idx >= 0 && idx < cur.length) cur.splice(idx, 1);
  } else {
    delete (cur as Record<string, unknown>)[last];
  }
  return clone;
}

function duplicateAtPath(root: unknown, path: string): unknown {
  if (!path || path === "$") return root;
  const parts = tokenizePath(path);
  const clone = structuredClone(root) as unknown;
  let cur: unknown = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (cur == null || typeof cur !== "object") return root;
    if (Array.isArray(cur)) cur = cur[Number(part)];
    else cur = (cur as Record<string, unknown>)[part];
  }
  const last = parts[parts.length - 1]!;
  if (cur == null || typeof cur !== "object") return root;
  if (Array.isArray(cur)) {
    const idx = Number(last);
    if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return root;
    const copy = structuredClone(cur[idx]);
    cur.splice(idx + 1, 0, copy);
  } else {
    const obj = cur as Record<string, unknown>;
    if (!(last in obj)) return root;
    let name = `${last}_copy`;
    let n = 2;
    while (name in obj) {
      name = `${last}_copy${n}`;
      n += 1;
    }
    obj[name] = structuredClone(obj[last]);
  }
  return clone;
}

function CenterLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--jb-muted)]">
      {children}
    </span>
  );
}

function buildHighlights(diffs: JsonDiffItem[], side: "left" | "right", on: boolean) {
  const map = new Map<string, string>();
  if (!on) return map;
  for (const d of diffs) {
    if (side === "left" && d.kind === "missing_in_a") continue;
    if (side === "right" && d.kind === "missing_in_b") continue;
    if (d.kind === "missing_in_b") map.set(d.path, "bg-amber-500/20 ring-1 ring-amber-400/50");
    else if (d.kind === "missing_in_a") map.set(d.path, "bg-emerald-500/20 ring-1 ring-emerald-400/50");
    else if (d.kind === "value_changed") map.set(d.path, "bg-orange-500/20 ring-1 ring-orange-400/50");
    else if (d.kind === "type_changed") map.set(d.path, "bg-violet-500/20 ring-1 ring-violet-400/50");
    else if (d.kind === "array_length") map.set(d.path, "bg-sky-500/20 ring-1 ring-sky-400/50");
  }
  return map;
}

function mapKeys(value: unknown, fn: (k: string) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => mapKeys(v, fn));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[fn(k)] = mapKeys(v, fn);
    }
    return out;
  }
  return value;
}

function tryParse(text: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}

function DiffStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "sky" | "amber" | "rose" | "violet";
}) {
  const color =
    tone === "sky"
      ? "text-sky-300"
      : tone === "amber"
        ? "text-amber-300"
        : tone === "rose"
          ? "text-rose-300"
          : tone === "violet"
            ? "text-violet-300"
            : "text-[var(--jb-text)]";
  return (
    <div className="rounded-lg border border-[var(--jb-border)] bg-[var(--jb-elevated)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--jb-muted)]">{label}</div>
      <div className={`text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
