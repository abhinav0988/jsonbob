import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { editor } from "monaco-editor";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  Braces,
  ChevronsDownUp,
  ChevronsUpDown,
  Columns2,
  Copy,
  FileJson,
  Redo2,
  Sparkles,
  Table2,
  TreePine,
  Undo2,
  Wrench,
  AlertCircle,
  Minimize2,
  ArrowUpDown,
  MousePointerClick,
} from "lucide-react";
import { JsonEditor } from "./JsonEditor";
import { JsonTreeView } from "./JsonTreeView";
import { JsonTableView } from "./JsonTableView";
import { minifyJson, prettyPrint, sortJsonKeys } from "./jsonTools";
import { analyzeProblems, type JsonProblem } from "../../lib/jsonToolsExtended";
import { parseJsonAsync } from "../../lib/parseJsonWorker";
import { ToolsDrawer } from "../../features/tools/ToolsDrawer";
import { AiAssistPanel } from "../../features/ai/AiAssistPanel";
import { CollabPresenceBar } from "../../features/collab/CollabPresenceBar";
import { getAtPath, setAtPath, tokenizePath } from "../../lib/jsonPath";
import { cn } from "../../lib/cn";
import { yamlToJson } from "../../lib/yamlLite";
import { useEditorActionsStore } from "../../store/editorActionsStore";
import { useThemeStore } from "../../store/themeStore";
import { collectJsonPaths } from "../../lib/collectJsonPaths";
import { flattenPathsAsync } from "../../lib/flattenPathsWorker";
import { toast } from "../../features/toast/toastStore";
import { getDocumentSchema, putDocumentSchema } from "../../api/platform";
import { useAuthStore } from "../../store/authStore";
import { useIsMobile } from "../../hooks/useIsMobile";
import { MobileEditorLayout } from "./MobileEditorLayout";

function looksLikeJson(text: string) {
  const t = text.trim();
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
}

function crumbSegments(path: string) {
  if (!path || path === "$") return [{ label: "$", path: "$" }];
  const parts = tokenizePath(path);
  const segs: Array<{ label: string; path: string }> = [{ label: "$", path: "$" }];
  let cur = "$";
  for (const part of parts) {
    cur = /^\d+$/.test(part)
      ? `${cur}[${part}]`
      : /^[A-Za-z_][A-Za-z0-9_]*$/.test(part)
        ? `${cur}.${part}`
        : `${cur}[${JSON.stringify(part)}]`;
    segs.push({ label: part, path: cur });
  }
  return segs;
}

const SCHEMA_STORAGE_KEY = "jsonbob.workspace.schema";

function schemaKeyFor(documentId?: string) {
  return documentId ? `jsonbob.schema.${documentId}` : SCHEMA_STORAGE_KEY;
}

const SAMPLE_SCHEMA = `{
  "type": "object",
  "required": ["name"],
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "active": { "type": "boolean" }
  },
  "additionalProperties": true
}`;

export type WorkspaceMode = "json" | "path";
export type ViewMode = "text" | "tree" | "table";

export interface JsonWorkspaceProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  initialSnapshot?: string;
  actions?: ReactNode;
  onSave?: () => void;
  saving?: boolean;
  savedLabel?: string;
  /** Document id used as collab room id when live sync is on */
  documentId?: string;
}

export function analyzeJson(text: string) {
  const lines = text.length === 0 ? 0 : text.split("\n").length;
  const bytes = new TextEncoder().encode(text).length;
  try {
    return { ok: true as const, data: JSON.parse(text) as unknown, lines, bytes, error: null };
  } catch (err) {
    return {
      ok: false as const,
      data: null,
      lines,
      bytes,
      error: err instanceof Error ? err.message : "Invalid JSON",
    };
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
    cur.splice(idx + 1, 0, structuredClone(cur[idx]));
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

function ToolIconButton({
  title,
  onClick,
  disabled,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded border disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-[var(--jb-accent)]/60 bg-[var(--jb-accent)]/15 text-[var(--jb-accent)]"
          : "border-transparent text-[var(--jb-muted)] hover:border-[var(--jb-border)] hover:bg-[var(--jb-elevated)] hover:text-[var(--jb-text)]",
      )}
    >
      {children}
    </button>
  );
}

export function JsonWorkspace({
  value,
  onChange,
  readOnly = false,
  initialSnapshot,
  actions,
  onSave,
  saving,
  savedLabel = "Save",
  documentId,
}: JsonWorkspaceProps) {
  const analysis = useMemo(() => analyzeJson(value), [value]);
  const [schemaText, setSchemaText] = useState(() => {
    try {
      return localStorage.getItem(schemaKeyFor(documentId)) ?? "";
    } catch {
      return "";
    }
  });
  const accessToken = useAuthStore((s) => s.accessToken);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [workerProblems, setWorkerProblems] = useState<JsonProblem[]>([]);
  const baseProblems = useMemo(() => analyzeProblems(value, schemaText), [value, schemaText]);
  const problems = useMemo(
    () => [...baseProblems, ...workerProblems],
    [baseProblems, workerProblems],
  );
  const [sideView, setSideView] = useState<ViewMode>("tree");
  const [showSide, setShowSide] = useState(true);
  const [showProblems, setShowProblems] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [mobileSheet, setMobileSheet] = useState<ViewMode | "problems" | "more" | null>(null);
  const isMobile = useIsMobile();
  const [liveCollab, setLiveCollab] = useState(false);
  const [splitEditor, setSplitEditor] = useState(false);
  const collabRoomId = documentId || "workspace";
  const onRemoteContent = useCallback(
    (text: string) => {
      onChange(text);
    },
    [onChange],
  );
  const [treeQuery, setTreeQuery] = useState("");
  const [expandAll, setExpandAll] = useState(0);
  const [collapseAll, setCollapseAll] = useState(0);
  const [tableFocus, setTableFocus] = useState("$");
  const [crumbPath, setCrumbPath] = useState("$");
  const [dragOver, setDragOver] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [notice, setNotice] = useState<string | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const snapshot = initialSnapshot ?? value;
  const minimap = useThemeStore((s) => s.minimap);
  const setMinimap = useThemeStore((s) => s.setMinimap);
  const formatOnPaste = useThemeStore((s) => s.formatOnPaste);
  const layoutPreset = useThemeStore((s) => s.layoutPreset);
  const setLayoutPreset = useThemeStore((s) => s.setLayoutPreset);
  const monacoRef = useRef<Parameters<NonNullable<import("@monaco-editor/react").OnMount>>[1] | null>(
    null,
  );

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    toast(msg, "success");
    window.setTimeout(() => setNotice(null), 1600);
  }, []);

  const persistSchema = useCallback(
    (next: string) => {
      setSchemaText(next);
      try {
        const key = schemaKeyFor(documentId);
        if (next.trim()) localStorage.setItem(key, next);
        else localStorage.removeItem(key);
      } catch {
        /* ignore quota */
      }
      if (documentId && accessToken) {
        void putDocumentSchema(documentId, next.trim() || null).catch(() => {
          /* offline ok — local cached */
        });
      }
    },
    [accessToken, documentId],
  );

  useEffect(() => {
    if (!documentId || !accessToken) return;
    let cancelled = false;
    void getDocumentSchema(documentId)
      .then((res) => {
        if (cancelled || res.schema == null) return;
        setSchemaText(res.schema);
        try {
          localStorage.setItem(schemaKeyFor(documentId), res.schema);
        } catch {
          /* ignore */
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [accessToken, documentId]);

  const runSafe = useCallback(
    (fn: () => string, success: string) => {
      try {
        onChange(fn());
        flash(success);
      } catch {
        setNotice("Invalid JSON");
      }
    },
    [flash, onChange],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        runSafe(() => prettyPrint(value), "Formatted");
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && onSave) {
        e.preventDefault();
        onSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave, runSafe, value]);

  useEffect(() => {
    if (value.length <= 200_000) {
      setWorkerProblems([]);
      return;
    }
    let cancelled = false;
    setWorkerProblems([
      {
        severity: "info",
        message: "Large document — parsing off main thread…",
      },
    ]);
    void parseJsonAsync(value, 200_000).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setWorkerProblems([
          {
            severity: "info",
            message: `Worker parse OK (${value.length.toLocaleString()} chars)`,
          },
        ]);
      } else {
        setWorkerProblems([
          {
            severity: "error",
            message: `Worker parse: ${result.error}`,
          },
        ]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  useEffect(() => {
    const setActions = useEditorActionsStore.getState().setActions;
    const setPathSearch = useEditorActionsStore.getState().setPathSearch;
    const clear = useEditorActionsStore.getState().clear;
    setActions([
      {
        id: "editor-format",
        label: "Format JSON",
        group: "Editor",
        shortcut: "⌘⇧F",
        keywords: "pretty print",
        run: () => runSafe(() => prettyPrint(value), "Formatted"),
      },
      ...(onSave
        ? [
            {
              id: "editor-save",
              label: "Save document",
              group: "Editor",
              shortcut: "⌘S",
              run: () => onSave(),
            },
          ]
        : []),
      {
        id: "editor-minimap",
        label: minimap ? "Hide minimap" : "Show minimap",
        group: "Editor",
        keywords: "minimap scroll",
        run: () => setMinimap(!minimap),
      },
      {
        id: "editor-ai",
        label: aiOpen ? "Close AI assistant" : "Open AI assistant",
        group: "Editor",
        keywords: "ai assist sparkles",
        run: () => setAiOpen((v) => !v),
      },
      {
        id: "editor-split",
        label: splitEditor ? "Close split editor" : "Split editor",
        group: "Editor",
        run: () => setSplitEditor((v) => !v),
      },
    ]);
    try {
      const parsed = JSON.parse(value) as unknown;
      void flattenPathsAsync(parsed).then((paths) => {
        setPathSearch(paths.length ? paths : collectJsonPaths(parsed), (path) => {
          setShowSide(true);
          setSideView("tree");
          setTreeQuery(path);
          setCrumbPath(path);
          setTableFocus(path);
          flash(`Focused ${path}`);
        });
      });
    } catch {
      setPathSearch([], () => undefined);
    }
    return () => clear();
  }, [aiOpen, flash, minimap, onSave, runSafe, setMinimap, splitEditor, value]);

  useEffect(() => {
    if (layoutPreset === "focus") {
      setShowSide(false);
      setShowProblems(false);
      setSplitEditor(false);
    } else if (layoutPreset === "split") {
      setShowSide(true);
      setSideView("tree");
      setShowProblems(false);
      setSplitEditor(true);
    } else if (layoutPreset === "review") {
      setShowSide(true);
      setSideView("tree");
      setShowProblems(true);
      setSplitEditor(false);
    } else if (layoutPreset === "table") {
      setShowSide(true);
      setSideView("table");
      setShowProblems(false);
      setSplitEditor(false);
    }
  }, [layoutPreset]);

  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const model = ed.getModel();
    if (!model) return;
    const markers = problems.map((p) => ({
      severity:
        p.severity === "error"
          ? monaco.MarkerSeverity.Error
          : p.severity === "warning"
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Info,
      message: p.message,
      startLineNumber: p.line ?? 1,
      startColumn: p.column ?? 1,
      endLineNumber: p.line ?? 1,
      endColumn: (p.column ?? 1) + 1,
    }));
    monaco.editor.setModelMarkers(model, "jsonbob", markers);
  }, [problems]);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(".monaco-editor")) return;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (!formatOnPaste) return;
      const text = e.clipboardData?.getData("text") ?? "";
      if (!looksLikeJson(text)) return;
      e.preventDefault();
      try {
        onChange(prettyPrint(text));
        flash("Pasted JSON · formatted");
      } catch {
        onChange(text);
        flash("Pasted text");
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [flash, formatOnPaste, onChange]);

  async function ingestFile(file: File) {
    const text = await file.text();
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".yaml") || name.endsWith(".yml")) {
        onChange(JSON.stringify(yamlToJson(text), null, 2));
        flash(`Loaded ${file.name} as JSON`);
        return;
      }
      if (looksLikeJson(text)) {
        onChange(prettyPrint(text));
        flash(`Loaded ${file.name}`);
        return;
      }
      onChange(text);
      flash(`Loaded ${file.name}`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Failed to load file");
    }
  }

  const tableData = useMemo(() => {
    if (!analysis.ok) return null;
    return getAtPath(analysis.data, tableFocus);
  }, [analysis, tableFocus]);

  const errorCount = problems.filter((p) => p.severity === "error").length;
  const warnCount = problems.filter((p) => p.severity === "warning").length;
  const schemaAttached = Boolean(schemaText.trim());

  if (isMobile) {
    return (
      <MobileEditorLayout
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        onSave={onSave}
        saving={saving}
        savedLabel={savedLabel}
        actions={actions}
        analysisOk={analysis.ok}
        analysisData={analysis.data}
        problems={problems}
        errorCount={errorCount}
        warnCount={warnCount}
        schemaText={schemaText}
        persistSchema={persistSchema}
        schemaOpen={schemaOpen}
        setSchemaOpen={setSchemaOpen}
        toolsOpen={toolsOpen}
        setToolsOpen={setToolsOpen}
        aiOpen={aiOpen}
        setAiOpen={setAiOpen}
        mobileSheet={mobileSheet}
        setMobileSheet={setMobileSheet}
        treeQuery={treeQuery}
        setTreeQuery={setTreeQuery}
        expandAll={expandAll}
        setExpandAll={setExpandAll}
        collapseAll={collapseAll}
        setCollapseAll={setCollapseAll}
        crumbPath={crumbPath}
        setCrumbPath={setCrumbPath}
        tableFocus={tableFocus}
        setTableFocus={setTableFocus}
        tableData={tableData}
        onFormat={() => runSafe(() => prettyPrint(value), "Formatted")}
        onUndo={() => editorRef.current?.trigger("jsonbob", "undo", null)}
        onRedo={() => editorRef.current?.trigger("jsonbob", "redo", null)}
        flash={flash}
        onDeletePath={
          readOnly
            ? undefined
            : (path) => {
                if (!analysis.ok || path === "$") return;
                onChange(JSON.stringify(deleteAtPath(analysis.data, path), null, 2));
                flash(`Deleted ${path}`);
              }
        }
        onDuplicatePath={
          readOnly
            ? undefined
            : (path) => {
                if (!analysis.ok || path === "$") return;
                onChange(JSON.stringify(duplicateAtPath(analysis.data, path), null, 2));
                flash(`Duplicated ${path}`);
              }
        }
        onCellChange={
          readOnly
            ? undefined
            : (row, key, raw) => {
                if (!analysis.ok) return;
                const view = getAtPath(analysis.data, tableFocus);
                if (!Array.isArray(view)) return;
                let parsedCell: unknown = raw;
                try {
                  parsedCell = JSON.parse(raw);
                } catch {
                  parsedCell = raw;
                }
                const nextRows = structuredClone(view) as Record<string, unknown>[];
                nextRows[row] = { ...nextRows[row], [key]: parsedCell };
                onChange(JSON.stringify(setAtPath(analysis.data, tableFocus, nextRows), null, 2));
              }
        }
        onDeleteRows={
          readOnly
            ? undefined
            : (indices) => {
                if (!analysis.ok) return;
                const view = getAtPath(analysis.data, tableFocus);
                if (!Array.isArray(view)) return;
                const drop = new Set(indices);
                const next = view.filter((_, i) => !drop.has(i));
                onChange(JSON.stringify(setAtPath(analysis.data, tableFocus, next), null, 2));
                flash(`Deleted ${indices.length} row(s)`);
              }
        }
        editorRef={editorRef}
        monacoRef={monacoRef}
        toolsDrawer={
          <ToolsDrawer
            open={toolsOpen}
            onClose={() => setToolsOpen(false)}
            value={value}
            mobile
            onApply={(next, msg) => {
              onChange(next);
              flash(msg);
            }}
          />
        }
        aiPanel={
          <AiAssistPanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            jsonText={value}
            mobile
            onApply={(next) => {
              onChange(next);
              flash("AI suggestion applied");
              setAiOpen(false);
            }}
          />
        }
      />
    );
  }

  return (
    <div
      ref={dropRef}
      className={cn(
        "jb-workspace relative flex h-full min-h-0 flex-col overflow-hidden border bg-[var(--jb-canvas)] text-[var(--jb-text)] sm:rounded-lg",
        dragOver ? "border-[var(--jb-accent)] ring-2 ring-[var(--jb-accent)]/40" : "border-[var(--jb-border)]",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void ingestFile(file);
      }}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--jb-border)] bg-[var(--jb-panel)] px-3 py-2">
        <button type="button" className="jb-action" onClick={() => onChange(snapshot)}>
          New
        </button>
        <button type="button" className="jb-action" onClick={() => onChange("{\n  \n}")}>
          Clear
        </button>
        <button type="button" className="jb-action" onClick={() => onChange(snapshot)}>
          Reset
        </button>
        <label className="ml-auto flex items-center gap-1 text-[11px] text-[var(--jb-muted)]">
          Layout
          <select
            className="toolbar-input"
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
        {onSave && (
          <button
            type="button"
            className="jb-action jb-action-primary"
            disabled={saving || readOnly}
            onClick={onSave}
          >
            {saving ? "Saving…" : savedLabel}
          </button>
        )}
        {actions}

        <div className="ml-auto flex items-center gap-1">
          <div className="mr-1 flex rounded-md border border-[var(--jb-border)] p-0.5">
            {(
              [
                ["text", "Text", Braces],
                ["tree", "Tree", TreePine],
                ["table", "Table", Table2],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-1 text-xs",
                  sideView === id && showSide
                    ? "bg-[var(--jb-accent)] text-white"
                    : "text-[var(--jb-muted)] hover:text-[var(--jb-text)]",
                )}
                onClick={() => {
                  setSideView(id);
                  setShowSide(true);
                }}
                title={label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <ToolIconButton title="JSON Tools" active={toolsOpen} onClick={() => setToolsOpen(true)}>
            <Wrench className="h-4 w-4" />
          </ToolIconButton>
          <ToolIconButton
            title="Attach JSON Schema"
            active={schemaAttached || schemaOpen}
            onClick={() => {
              setSchemaOpen((v) => !v);
              setShowProblems(true);
            }}
          >
            <FileJson className="h-4 w-4" />
          </ToolIconButton>
          <ToolIconButton
            title="Problems"
            active={showProblems}
            onClick={() => setShowProblems((v) => !v)}
          >
            <AlertCircle className="h-4 w-4" />
          </ToolIconButton>
          <ToolIconButton
            title="Split editor"
            active={splitEditor}
            onClick={() => setSplitEditor((v) => !v)}
          >
            <Columns2 className="h-4 w-4" />
          </ToolIconButton>
          <ToolIconButton title="AI assistant" active={aiOpen} onClick={() => setAiOpen(true)}>
            <Sparkles className="h-4 w-4" />
          </ToolIconButton>
          <label
            className="ml-1 flex cursor-pointer items-center gap-1.5 rounded border border-[var(--jb-border)] px-2 py-1 text-[11px] text-[var(--jb-muted)] hover:text-[var(--jb-text)]"
            title="Sync content with other peers in this room"
          >
            <input
              type="checkbox"
              checked={liveCollab}
              onChange={(e) => setLiveCollab(e.target.checked)}
              className="accent-[var(--jb-accent)]"
            />
            Live collab
          </label>
        </div>
      </div>

      {notice && (
        <div className="shrink-0 border-b border-[var(--jb-border)] bg-[var(--jb-panel)] px-3 py-1.5 text-xs text-[var(--jb-accent-soft)]">
          {notice}
        </div>
      )}

      <nav
        className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--jb-border)] bg-[var(--jb-panel)] px-3 py-1 font-mono text-[11px] text-[var(--jb-muted)]"
        aria-label="JSON path breadcrumbs"
      >
        {crumbSegments(sideView === "table" ? tableFocus : crumbPath).map((seg, i, all) => (
          <span key={seg.path} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-[var(--jb-border)]">/</span>}
            <button
              type="button"
              className={cn(
                "rounded px-1 hover:bg-[var(--jb-elevated)] hover:text-[var(--jb-accent-soft)]",
                i === all.length - 1 && "text-[var(--jb-accent-soft)]",
              )}
              onClick={() => {
                setCrumbPath(seg.path);
                if (sideView === "table") setTableFocus(seg.path === "$" ? "$" : seg.path);
                flash(seg.path);
              }}
            >
              {seg.label}
            </button>
          </span>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-hidden">
        <Group orientation="vertical" className="h-full">
          <Panel defaultSize={showProblems ? "78" : "100"} minSize="40">
            <Group orientation="horizontal" className="h-full">
              <Panel defaultSize={showSide ? "55" : "100"} minSize="30">
                <section className="flex h-full min-h-0 flex-col overflow-hidden">
                  <div className="flex shrink-0 items-center justify-between border-b border-[var(--jb-border)] bg-[var(--jb-panel)] px-2 py-1.5">
                    <span className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--jb-muted)]">
                      Editor
                    </span>
                    <div className="flex items-center gap-0.5">
                      <ToolIconButton
                        title="Format (Ctrl+Shift+F)"
                        onClick={() => runSafe(() => prettyPrint(value), "Formatted")}
                      >
                        <Braces className="h-3.5 w-3.5" />
                      </ToolIconButton>
                      <ToolIconButton
                        title="Minify"
                        onClick={() => runSafe(() => minifyJson(value), "Minified")}
                      >
                        <Minimize2 className="h-3.5 w-3.5" />
                      </ToolIconButton>
                      <ToolIconButton
                        title="Sort keys"
                        onClick={() => runSafe(() => sortJsonKeys(value), "Keys sorted")}
                      >
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </ToolIconButton>
                      <ToolIconButton
                        title="Copy"
                        onClick={() => {
                          void navigator.clipboard.writeText(value);
                          flash("Copied");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </ToolIconButton>
                      <ToolIconButton
                        title="Undo"
                        onClick={() => editorRef.current?.trigger("jsonbob", "undo", null)}
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </ToolIconButton>
                      <ToolIconButton
                        title="Redo"
                        onClick={() => editorRef.current?.trigger("jsonbob", "redo", null)}
                      >
                        <Redo2 className="h-3.5 w-3.5" />
                      </ToolIconButton>
                    </div>
                  </div>
                  <div className="relative min-h-0 flex-1 overflow-hidden">
                    {splitEditor ? (
                      <Group orientation="vertical" className="h-full">
                        <Panel defaultSize="50" minSize="20">
                          <JsonEditor
                            value={value}
                            onChange={onChange}
                            readOnly={readOnly}
                            bordered={false}
                        onMount={(ed, monaco) => {
                              editorRef.current = ed;
                              monacoRef.current = monaco;
                              ed.onDidChangeCursorPosition((e) => {
                                setCursor({ line: e.position.lineNumber, col: e.position.column });
                              });
                            }}
                          />
                        </Panel>
                        <Separator className="h-1 bg-[var(--jb-border)] hover:bg-[var(--jb-accent)]" />
                        <Panel defaultSize="50" minSize="20">
                          <JsonEditor
                            value={value}
                            onChange={onChange}
                            readOnly={readOnly}
                            bordered={false}
                          />
                        </Panel>
                      </Group>
                    ) : (
                      <JsonEditor
                        value={value}
                        onChange={onChange}
                        readOnly={readOnly}
                        bordered={false}
                        onMount={(ed, monaco) => {
                          editorRef.current = ed;
                          monacoRef.current = monaco;
                          ed.onDidChangeCursorPosition((e) => {
                            setCursor({ line: e.position.lineNumber, col: e.position.column });
                          });
                        }}
                      />
                    )}
                  </div>
                </section>
              </Panel>

              {showSide && (
                <>
                  <Separator className="w-1 bg-[var(--jb-border)] transition-colors hover:bg-[var(--jb-accent)]" />
                  <Panel defaultSize="45" minSize="20">
                    <section className="flex h-full min-h-0 flex-col overflow-hidden">
                      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--jb-border)] bg-[var(--jb-panel)] px-2 py-1.5">
                        <span className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--jb-muted)]">
                          {sideView}
                        </span>
                        {sideView === "tree" && (
                          <>
                            <ToolIconButton
                              title="Expand all"
                              onClick={() => setExpandAll((n) => n + 1)}
                            >
                              <ChevronsUpDown className="h-3.5 w-3.5" />
                            </ToolIconButton>
                            <ToolIconButton
                              title="Collapse all"
                              onClick={() => setCollapseAll((n) => n + 1)}
                            >
                              <ChevronsDownUp className="h-3.5 w-3.5" />
                            </ToolIconButton>
                            <input
                              value={treeQuery}
                              onChange={(e) => setTreeQuery(e.target.value)}
                              placeholder="Search nodes…"
                              className="toolbar-input ml-auto max-w-[12rem]"
                            />
                          </>
                        )}
                        {sideView === "table" && tableFocus !== "$" && (
                          <button
                            type="button"
                            className="jb-action ml-auto"
                            onClick={() => setTableFocus("$")}
                          >
                            Root
                          </button>
                        )}
                        <button
                          type="button"
                          className="jb-action"
                          onClick={() => setShowSide(false)}
                          title="Hide panel"
                        >
                          Hide
                        </button>
                      </div>
                      <div className="min-h-0 flex-1 overflow-hidden">
                        {!analysis.ok ? (
                          <div className="p-4 text-sm text-red-400">
                            Fix JSON to preview {sideView}.
                            <span className="mt-1 block text-xs text-[var(--jb-muted)]">
                              {analysis.error}
                            </span>
                          </div>
                        ) : sideView === "tree" ? (
                          <JsonTreeView
                            data={analysis.data}
                            expandAll={expandAll}
                            collapseAll={collapseAll}
                            query={treeQuery}
                            focusPath={crumbPath === "$" ? null : crumbPath}
                            onCopyPath={(path) => {
                              void navigator.clipboard.writeText(path);
                              flash(`Copied ${path}`);
                            }}
                            onSelectPath={(path) => {
                              setCrumbPath(path);
                              flash(path);
                            }}
                            onDeletePath={
                              readOnly
                                ? undefined
                                : (path) => {
                                    if (!analysis.ok || path === "$") return;
                                    onChange(JSON.stringify(deleteAtPath(analysis.data, path), null, 2));
                                    flash(`Deleted ${path}`);
                                  }
                            }
                            onDuplicatePath={
                              readOnly
                                ? undefined
                                : (path) => {
                                    if (!analysis.ok || path === "$") return;
                                    onChange(
                                      JSON.stringify(duplicateAtPath(analysis.data, path), null, 2),
                                    );
                                    flash(`Duplicated ${path}`);
                                  }
                            }
                            onReorder={
                              readOnly
                                ? undefined
                                : (parentPath, fromIndex, toIndex) => {
                                    if (!analysis.ok) return;
                                    const arr = getAtPath(analysis.data, parentPath);
                                    if (!Array.isArray(arr)) return;
                                    const next = [...arr];
                                    const [item] = next.splice(fromIndex, 1);
                                    next.splice(toIndex, 0, item);
                                    onChange(
                                      JSON.stringify(setAtPath(analysis.data, parentPath, next), null, 2),
                                    );
                                  }
                            }
                          />
                        ) : sideView === "table" ? (
                          <div className="jb-scroll h-full overflow-auto">
                            <JsonTableView
                              data={tableData}
                              focusPath={tableFocus}
                              onEditPath={(p) => {
                                setTableFocus(p);
                                setCrumbPath(p);
                              }}
                              onExtractPath={(p) => {
                                const v = getAtPath(analysis.data, p);
                                onChange(JSON.stringify(v, null, 2));
                                setTableFocus("$");
                                setCrumbPath("$");
                                flash(`Extracted ${p}`);
                              }}
                              onSwitchToTree={() => setSideView("tree")}
                              onCellChange={
                                readOnly
                                  ? undefined
                                  : (row, key, raw) => {
                                      if (!analysis.ok) return;
                                      const view = getAtPath(analysis.data, tableFocus);
                                      if (!Array.isArray(view)) return;
                                      let parsedCell: unknown = raw;
                                      try {
                                        parsedCell = JSON.parse(raw);
                                      } catch {
                                        parsedCell = raw;
                                      }
                                      const nextRows = structuredClone(view) as Record<
                                        string,
                                        unknown
                                      >[];
                                      nextRows[row] = { ...nextRows[row], [key]: parsedCell };
                                      onChange(
                                        JSON.stringify(
                                          setAtPath(analysis.data, tableFocus, nextRows),
                                          null,
                                          2,
                                        ),
                                      );
                                    }
                              }
                              onDeleteRows={
                                readOnly
                                  ? undefined
                                  : (indices) => {
                                      if (!analysis.ok) return;
                                      const view = getAtPath(analysis.data, tableFocus);
                                      if (!Array.isArray(view)) return;
                                      const drop = new Set(indices);
                                      const next = view.filter((_, i) => !drop.has(i));
                                      onChange(
                                        JSON.stringify(
                                          setAtPath(analysis.data, tableFocus, next),
                                          null,
                                          2,
                                        ),
                                      );
                                      flash(`Deleted ${indices.length} row(s)`);
                                    }
                              }
                            />
                          </div>
                        ) : (
                          <pre className="p-3 font-mono text-xs text-[var(--jb-muted)]">
                            Text lives in the main editor. Use Tree or Table here.
                          </pre>
                        )}
                      </div>
                    </section>
                  </Panel>
                </>
              )}
            </Group>
          </Panel>

          {showProblems && (
            <>
              <Separator className="h-1 bg-[var(--jb-border)] hover:bg-[var(--jb-accent)]" />
              <Panel defaultSize="22" minSize="12" maxSize="45">
                <div className="flex h-full min-h-0 flex-col border-t border-[var(--jb-border)] bg-[var(--jb-panel)]">
                  <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--jb-muted)]">
                    Problems
                    <span className="rounded bg-red-500/20 px-1.5 text-red-300">{errorCount}</span>
                    <span className="rounded bg-amber-500/20 px-1.5 text-amber-300">{warnCount}</span>
                    {schemaAttached && (
                      <span className="rounded bg-emerald-500/20 px-1.5 normal-case tracking-normal text-emerald-300">
                        schema
                      </span>
                    )}
                    <button
                      type="button"
                      className="jb-action ml-auto normal-case tracking-normal"
                      onClick={() => setSchemaOpen((v) => !v)}
                    >
                      {schemaOpen ? "Hide schema" : "Attach schema"}
                    </button>
                  </div>

                  {schemaOpen && (
                    <div className="shrink-0 border-b border-[var(--jb-border)] px-3 pb-2">
                      <textarea
                        value={schemaText}
                        onChange={(e) => persistSchema(e.target.value)}
                        placeholder='Paste JSON Schema (draft-07 subset)… e.g. { "type": "object", "required": ["id"] }'
                        spellCheck={false}
                        className="h-24 w-full resize-y rounded border border-[var(--jb-border)] bg-[var(--jb-canvas)] p-2 font-mono text-[11px] text-[var(--jb-text)] outline-none focus:border-[var(--jb-accent)]"
                      />
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="jb-action"
                          onClick={() => {
                            persistSchema(SAMPLE_SCHEMA);
                            flash("Sample schema attached");
                          }}
                        >
                          Sample schema
                        </button>
                        <button
                          type="button"
                          className="jb-action"
                          onClick={() => {
                            persistSchema("");
                            flash("Schema cleared");
                          }}
                        >
                          Clear schema
                        </button>
                      </div>
                    </div>
                  )}

                  <ul className="jb-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2 text-xs">
                    {problems.length === 0 && (
                      <li className="px-2 py-3 text-[var(--jb-muted)]">No problems</li>
                    )}
                    {problems.map((p, i) => (
                      <li key={`${p.message}-${p.path ?? ""}-${i}`}>
                        <button
                          type="button"
                          className="flex w-full gap-2 rounded px-2 py-1.5 text-left hover:bg-[var(--jb-elevated)]"
                          onClick={() => {
                            if (p.line && editorRef.current) {
                              editorRef.current.revealLineInCenter(p.line);
                              editorRef.current.setPosition({
                                lineNumber: p.line,
                                column: p.column ?? 1,
                              });
                              editorRef.current.focus();
                            }
                          }}
                        >
                          <span
                            className={
                              p.severity === "error"
                                ? "text-red-400"
                                : p.severity === "warning"
                                  ? "text-amber-400"
                                  : "text-sky-400"
                            }
                          >
                            {p.severity}
                          </span>
                          <span className="text-[var(--jb-text)]">{p.message}</span>
                          {p.path && (
                            <span className="ml-auto font-mono text-[var(--jb-muted)]">{p.path}</span>
                          )}
                          {p.line != null && (
                            <span className="font-mono text-[var(--jb-muted)]">
                              :{p.line}:{p.column ?? 1}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </Panel>
            </>
          )}
        </Group>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--jb-border)] bg-[var(--jb-panel)] px-3 py-1.5 text-[11px] text-[var(--jb-muted)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className={analysis.ok ? "text-emerald-400" : "text-red-400"}>
            {analysis.ok ? "Valid JSON" : "Invalid JSON"}
          </span>
          <span className="font-mono">
            Ln {cursor.line}, Col {cursor.col}
          </span>
          <span>UTF-8</span>
          <CollabPresenceBar
            roomId={collabRoomId}
            content={value}
            onRemoteContent={liveCollab ? onRemoteContent : undefined}
            enabled={liveCollab}
          />
          {!liveCollab && (
            <span className="text-[var(--jb-muted)]/60">collab off</span>
          )}
          <span className="hidden sm:inline">⌘K commands · ⌘⇧F format · ⌘S save</span>
        </div>
        <div className="flex gap-4 font-mono">
          <span>{analysis.lines} lines</span>
          <span>{analysis.bytes} bytes</span>
        </div>
      </div>

      <ToolsDrawer
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        value={value}
        onApply={(next, msg) => {
          onChange(next);
          flash(msg);
        }}
      />

      <AiAssistPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        jsonText={value}
        onApply={(next) => {
          onChange(next);
          flash("AI suggestion applied");
          setAiOpen(false);
        }}
      />

      {/* Floating quick actions */}
      <div className="pointer-events-none absolute bottom-14 right-3 z-10 flex flex-col gap-1.5">
        <div className="pointer-events-auto flex flex-col gap-1 rounded-lg border border-[var(--jb-border)] bg-[var(--jb-panel)]/95 p-1 shadow-lg backdrop-blur">
          <ToolIconButton
            title="Format"
            onClick={() => runSafe(() => prettyPrint(value), "Formatted")}
          >
            <Braces className="h-3.5 w-3.5" />
          </ToolIconButton>
          <ToolIconButton
            title="Copy"
            onClick={() => {
              void navigator.clipboard.writeText(value);
              flash("Copied");
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </ToolIconButton>
          <ToolIconButton title="Tools" active={toolsOpen} onClick={() => setToolsOpen(true)}>
            <Wrench className="h-3.5 w-3.5" />
          </ToolIconButton>
          <ToolIconButton
            title="Focus path"
            onClick={() => flash(crumbPath === "$" ? "At document root" : crumbPath)}
          >
            <MousePointerClick className="h-3.5 w-3.5" />
          </ToolIconButton>
        </div>
      </div>

      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[var(--jb-accent)]/10 text-sm font-medium text-[var(--jb-accent-soft)]">
          Drop JSON or YAML file
        </div>
      )}
    </div>
  );
}
