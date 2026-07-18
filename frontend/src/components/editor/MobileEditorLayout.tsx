import type { ReactNode } from "react";
import type { editor } from "monaco-editor";
import {
  AlertCircle,
  Braces,
  GitCompare,
  MoreHorizontal,
  Redo2,
  Save,
  Share2,
  Sparkles,
  Table2,
  TreePine,
  Undo2,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { JsonEditor } from "./JsonEditor";
import { JsonTreeView } from "./JsonTreeView";
import { JsonTableView } from "./JsonTableView";
import { BottomSheet } from "../mobile/BottomSheet";
import { cn } from "../../lib/cn";
import type { JsonProblem } from "../../lib/jsonToolsExtended";
import type { ViewMode } from "./JsonWorkspace";

type MobileEditorLayoutProps = {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  onSave?: () => void;
  saving?: boolean;
  savedLabel?: string;
  actions?: ReactNode;
  analysisOk: boolean;
  analysisData: unknown;
  problems: JsonProblem[];
  errorCount: number;
  warnCount: number;
  schemaText: string;
  persistSchema: (s: string) => void;
  schemaOpen: boolean;
  setSchemaOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  toolsOpen: boolean;
  setToolsOpen: (v: boolean) => void;
  aiOpen: boolean;
  setAiOpen: (v: boolean) => void;
  mobileSheet: ViewMode | "problems" | "more" | null;
  setMobileSheet: (v: ViewMode | "problems" | "more" | null) => void;
  treeQuery: string;
  setTreeQuery: (v: string) => void;
  expandAll: number;
  setExpandAll: (n: number) => void;
  collapseAll: number;
  setCollapseAll: (n: number) => void;
  crumbPath: string;
  setCrumbPath: (p: string) => void;
  tableFocus: string;
  setTableFocus: (p: string) => void;
  tableData: unknown;
  onFormat: () => void;
  onUndo: () => void;
  onRedo: () => void;
  flash: (msg: string) => void;
  onDeletePath?: (path: string) => void;
  onDuplicatePath?: (path: string) => void;
  onCellChange?: (row: number, key: string, raw: string) => void;
  onDeleteRows?: (indices: number[]) => void;
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
  monacoRef: React.MutableRefObject<Parameters<NonNullable<import("@monaco-editor/react").OnMount>>[1] | null>;
  toolsDrawer: ReactNode;
  aiPanel: ReactNode;
};

export function MobileEditorLayout(props: MobileEditorLayoutProps) {
  const {
    value,
    onChange,
    readOnly,
    onSave,
    saving,
    savedLabel = "Save",
    actions,
    analysisOk,
    analysisData,
    problems,
    errorCount,
    warnCount,
    schemaText,
    persistSchema,
    schemaOpen,
    setSchemaOpen,
    toolsOpen: _toolsOpen,
    setToolsOpen,
    aiOpen: _aiOpen,
    setAiOpen,
    mobileSheet,
    setMobileSheet,
    treeQuery,
    setTreeQuery,
    expandAll,
    setExpandAll,
    collapseAll,
    setCollapseAll,
    crumbPath,
    setCrumbPath,
    tableFocus,
    setTableFocus,
    tableData,
    onFormat,
    onUndo,
    onRedo,
    flash,
    onDeletePath,
    onDuplicatePath,
    onCellChange,
    onDeleteRows,
    editorRef,
    monacoRef,
    toolsDrawer,
    aiPanel,
  } = props;
  void _toolsOpen;
  void _aiOpen;

  const { scrollY } = useScroll();
  const toolbarY = useTransform(scrollY, [0, 48], [0, -56]);

  const toolbar = [
    { id: "format", label: "Format", icon: Braces, onClick: onFormat },
    ...(onSave
      ? [{ id: "save", label: saving ? "Saving…" : savedLabel, icon: Save, onClick: onSave, primary: true }]
      : []),
    { id: "share", label: "Share", icon: Share2, onClick: () => flash("Use document actions to share") },
    { id: "compare", label: "Compare", icon: GitCompare, href: "/compare" },
    { id: "undo", label: "Undo", icon: Undo2, onClick: onUndo },
    { id: "redo", label: "Redo", icon: Redo2, onClick: onRedo },
    { id: "more", label: "More", icon: MoreHorizontal, onClick: () => setMobileSheet("more") },
  ] as const;

  return (
    <div className="jb-mobile-editor relative flex h-full min-h-0 flex-col bg-[var(--jb-canvas)] md:hidden">
      <motion.div
        style={{ y: toolbarY }}
        className="jb-mobile-toolbar sticky top-0 z-20 shrink-0 border-b border-[var(--jb-border)] bg-[var(--jb-panel)]/95 backdrop-blur-xl"
      >
        <div className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {toolbar.map((t) =>
            "href" in t && t.href ? (
              <Link
                key={t.id}
                to={t.href}
                className="jb-touch-chip shrink-0"
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </Link>
            ) : (
              <button
                key={t.id}
                type="button"
                disabled={t.id === "save" && (saving || readOnly)}
                className={cn(
                  "jb-touch-chip shrink-0",
                  "primary" in t && t.primary && "jb-touch-chip-primary",
                )}
                onClick={"onClick" in t ? t.onClick : undefined}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ),
          )}
        </div>
        <div className="flex gap-2 border-t border-[var(--jb-border)] px-3 py-2">
          {(
            [
              ["tree", "Tree", TreePine],
              ["table", "Table", Table2],
              ["problems", `Issues${errorCount ? ` (${errorCount})` : ""}`, AlertCircle],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              className={cn(
                "jb-touch-chip flex-1 justify-center",
                mobileSheet === id && "jb-touch-chip-primary",
              )}
              onClick={() => setMobileSheet(id === mobileSheet ? null : id)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </motion.div>

      {actions && <div className="shrink-0 border-b border-[var(--jb-border)] px-3 py-2">{actions}</div>}

      <div className="min-h-0 flex-1 overflow-hidden">
        <JsonEditor
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          bordered={false}
          onMount={(ed, monaco) => {
            editorRef.current = ed;
            monacoRef.current = monaco;
          }}
        />
      </div>

      <button
        type="button"
        aria-label="AI assistant"
        className="jb-mobile-ai-fab"
        onClick={() => setAiOpen(true)}
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <BottomSheet
        open={mobileSheet === "tree"}
        onClose={() => setMobileSheet(null)}
        title="Tree"
        tall
      >
        <div className="mb-3 flex gap-2">
          <input
            value={treeQuery}
            onChange={(e) => setTreeQuery(e.target.value)}
            placeholder="Search paths…"
            className="jb-mobile-input flex-1"
          />
          <button type="button" className="jb-touch-chip" onClick={() => setExpandAll(expandAll + 1)}>
            Expand
          </button>
          <button type="button" className="jb-touch-chip" onClick={() => setCollapseAll(collapseAll + 1)}>
            Collapse
          </button>
        </div>
        {analysisOk ? (
          <JsonTreeView
            data={analysisData}
            query={treeQuery}
            expandAll={expandAll}
            collapseAll={collapseAll}
            focusPath={crumbPath}
            onSelectPath={(path) => {
              setCrumbPath(path);
              flash(path);
            }}
            onDeletePath={onDeletePath}
            onDuplicatePath={onDuplicatePath}
          />
        ) : (
          <p className="text-sm text-[var(--jb-muted)]">Fix JSON errors to browse the tree.</p>
        )}
      </BottomSheet>

      <BottomSheet
        open={mobileSheet === "table"}
        onClose={() => setMobileSheet(null)}
        title="Table"
        tall
      >
        {analysisOk && tableData != null ? (
          <JsonTableView
            data={tableData}
            focusPath={tableFocus}
            mobileCards
            onEditPath={(p) => {
              setTableFocus(p);
              setCrumbPath(p);
            }}
            onCellChange={onCellChange}
            onDeleteRows={onDeleteRows}
          />
        ) : (
          <p className="text-sm text-[var(--jb-muted)]">Select a valid array or object path for table view.</p>
        )}
      </BottomSheet>

      <BottomSheet
        open={mobileSheet === "problems"}
        onClose={() => setMobileSheet(null)}
        title={`Problems · ${errorCount} errors · ${warnCount} warnings`}
        tall
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" className="jb-touch-chip" onClick={() => setSchemaOpen((v) => !v)}>
            {schemaOpen ? "Hide schema" : "Attach schema"}
          </button>
        </div>
        {schemaOpen && (
          <textarea
            value={schemaText}
            onChange={(e) => persistSchema(e.target.value)}
            className="jb-mobile-input mb-3 min-h-28 font-mono text-xs"
            placeholder="JSON Schema…"
          />
        )}
        <ul className="space-y-2">
          {problems.length === 0 && (
            <li className="jb-mobile-card px-4 py-6 text-center text-sm text-[var(--jb-muted)]">No problems</li>
          )}
          {problems.map((p, i) => (
            <li key={`${p.message}-${i}`} className="jb-mobile-card px-4 py-3 text-sm">
              <span
                className={cn(
                  "font-medium",
                  p.severity === "error" ? "text-red-400" : p.severity === "warning" ? "text-amber-300" : "text-[var(--jb-muted)]",
                )}
              >
                {p.severity}
              </span>
              <p className="mt-1">{p.message}</p>
            </li>
          ))}
        </ul>
      </BottomSheet>

      <BottomSheet open={mobileSheet === "more"} onClose={() => setMobileSheet(null)} title="More">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="jb-mobile-action-card" onClick={() => { setToolsOpen(true); setMobileSheet(null); }}>
            <Wrench className="h-6 w-6 text-[var(--jb-accent)]" />
            <span>Tools</span>
          </button>
          <button type="button" className="jb-mobile-action-card" onClick={() => { setAiOpen(true); setMobileSheet(null); }}>
            <Sparkles className="h-6 w-6 text-[var(--jb-accent)]" />
            <span>AI Assist</span>
          </button>
        </div>
      </BottomSheet>

      {toolsDrawer}
      {aiPanel}
    </div>
  );
}
