import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Braces, Hash, List, ToggleLeft, Type } from "lucide-react";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type FlatRow = {
  path: string;
  name?: string;
  value: JsonValue;
  depth: number;
  expandable: boolean;
  /** Parent path when this row is an array element (for reorder). */
  parentPath?: string;
  arrayIndex?: number;
};

type ContextMenuState = {
  x: number;
  y: number;
  path: string;
  value: JsonValue;
  deletable: boolean;
};

const ROW_HEIGHT = 24;

function countEntries(value: JsonValue): number | null {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return null;
}

function matchesQuery(name: string | undefined, value: JsonValue, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (name?.toLowerCase().includes(q)) return true;
  if (value === null) return "null".includes(q);
  if (typeof value !== "object") return String(value).toLowerCase().includes(q);
  return false;
}

function nodeContainsMatch(name: string | undefined, value: JsonValue, query: string): boolean {
  if (!query) return true;
  if (matchesQuery(name, value, query)) return true;
  if (Array.isArray(value)) {
    return value.some((item, i) => nodeContainsMatch(String(i), item, query));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).some(([k, v]) => nodeContainsMatch(k, v, query));
  }
  return false;
}

function pathJoin(parent: string, name?: string) {
  if (name === undefined) return parent;
  if (/^\d+$/.test(name)) return `${parent}[${name}]`;
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return parent === "$" ? `$.${name}` : `${parent}.${name}`;
  }
  return `${parent}[${JSON.stringify(name)}]`;
}

function collectExpandablePaths(value: JsonValue, path: string, out: string[]) {
  if (value === null || typeof value !== "object") return;
  out.push(path);
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectExpandablePaths(item, pathJoin(path, String(i)), out));
  } else {
    for (const [k, v] of Object.entries(value)) {
      collectExpandablePaths(v, pathJoin(path, k), out);
    }
  }
}

function pathsToFocus(focusPath: string): string[] {
  const out: string[] = ["$"];
  if (!focusPath || focusPath === "$") return out;
  let i = 1;
  while (i < focusPath.length) {
    if (focusPath[i] === ".") {
      i += 1;
      let end = i;
      while (end < focusPath.length && focusPath[end] !== "." && focusPath[end] !== "[") end += 1;
      out.push(focusPath.slice(0, end));
      i = end;
    } else if (focusPath[i] === "[") {
      let end = i + 1;
      while (end < focusPath.length && focusPath[end] !== "]") end += 1;
      out.push(focusPath.slice(0, end + 1));
      i = end + 1;
    } else {
      i += 1;
    }
  }
  return out;
}

function flattenTree(
  value: JsonValue,
  path: string,
  name: string | undefined,
  depth: number,
  open: Set<string>,
  query: string,
  out: FlatRow[],
  parentPath?: string,
  arrayIndex?: number,
) {
  if (query && !nodeContainsMatch(name, value, query)) return;

  const expandable = value !== null && typeof value === "object";
  out.push({ path, name, value, depth, expandable, parentPath, arrayIndex });

  if (!expandable || !open.has(path)) return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flattenTree(
        item,
        pathJoin(path, String(index)),
        String(index),
        depth + 1,
        open,
        query,
        out,
        path,
        index,
      );
    });
  } else {
    for (const [key, child] of Object.entries(value as Record<string, JsonValue>)) {
      flattenTree(child, pathJoin(path, key), key, depth + 1, open, query, out);
    }
  }
}

function ValuePreview({ value }: { value: JsonValue }) {
  if (value === null) return <span className="text-[#fb923c]">null</span>;
  if (typeof value === "boolean") return <span className="text-[#fb923c]">{String(value)}</span>;
  if (typeof value === "number") return <span className="text-[#c084fc]">{value}</span>;
  if (typeof value === "string") return <span className="text-[var(--jb-text)]">"{value}"</span>;
  return null;
}

function TypeIcon({ value }: { value: JsonValue }) {
  const cls = "mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--jb-muted)]";
  if (Array.isArray(value)) return <List className={cls} aria-hidden />;
  if (value && typeof value === "object") return <Braces className={cls} aria-hidden />;
  if (typeof value === "number") return <Hash className={cls} aria-hidden />;
  if (typeof value === "boolean") return <ToggleLeft className={cls} aria-hidden />;
  if (value === null) return <span className="inline-block w-3.5 shrink-0" />;
  return <Type className={cls} aria-hidden />;
}

function copyValueText(value: JsonValue): string {
  try {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function JsonTreeView({
  data,
  expandAll,
  collapseAll,
  query,
  highlightPaths,
  highlightClasses,
  focusPath,
  onCopyPath,
  onSelectPath,
  onDeletePath,
  onDuplicatePath,
  onReorder,
  toolbar,
  scrollRef,
  onScroll,
}: {
  data: unknown;
  expandAll: number;
  collapseAll: number;
  query: string;
  highlightPaths?: Set<string>;
  highlightClasses?: Map<string, string>;
  focusPath?: string | null;
  onCopyPath?: (path: string) => void;
  onSelectPath?: (path: string) => void;
  onDeletePath?: (path: string) => void;
  onDuplicatePath?: (path: string) => void;
  onReorder?: (parentPath: string, fromIndex: number, toIndex: number) => void;
  toolbar?: ReactNode;
  /** Optional external ref to the scroll container (for Compare sync-scroll). */
  scrollRef?: (el: HTMLDivElement | null) => void;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
}) {
  const parsed = data as JsonValue;
  const parentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set(["$"]));
  const [enterParents, setEnterParents] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [dragFrom, setDragFrom] = useState<{ parentPath: string; index: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ parentPath: string; index: number } | null>(null);

  const summary = useMemo(() => {
    if (Array.isArray(parsed)) return `array [${parsed.length}]`;
    if (parsed && typeof parsed === "object") return `object {${Object.keys(parsed).length}}`;
    return typeof parsed;
  }, [parsed]);

  useEffect(() => {
    if (expandAll <= 0) return;
    const paths: string[] = [];
    collectExpandablePaths(parsed, "$", paths);
    setOpen(new Set(paths));
  }, [expandAll, parsed]);

  useEffect(() => {
    if (collapseAll <= 0) return;
    setOpen(new Set());
  }, [collapseAll]);

  useEffect(() => {
    if (!query) return;
    setOpen((prev) => {
      const next = new Set(prev);
      const walk = (value: JsonValue, path: string, name?: string) => {
        if (!nodeContainsMatch(name, value, query)) return;
        if (value !== null && typeof value === "object") {
          next.add(path);
          if (Array.isArray(value)) {
            value.forEach((item, i) => walk(item, pathJoin(path, String(i)), String(i)));
          } else {
            for (const [k, v] of Object.entries(value)) walk(v, pathJoin(path, k), k);
          }
        }
      };
      walk(parsed, "$");
      return next;
    });
  }, [query, parsed]);

  useEffect(() => {
    if (!focusPath) return;
    setOpen((prev) => {
      const next = new Set(prev);
      for (const p of pathsToFocus(focusPath)) next.add(p);
      return next;
    });
  }, [focusPath]);

  useEffect(() => {
    if (enterParents.size === 0) return;
    const t = window.setTimeout(() => setEnterParents(new Set()), 180);
    return () => window.clearTimeout(t);
  }, [enterParents]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const rows = useMemo(() => {
    const out: FlatRow[] = [];
    flattenTree(parsed, "$", undefined, 0, open, query, out);
    return out;
  }, [parsed, open, query]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 16,
  });

  useLayoutEffect(() => {
    if (!focusPath) return;
    const index = rows.findIndex((r) => r.path === focusPath);
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: "auto" });
    }
  }, [focusPath, rows, virtualizer]);

  useEffect(() => {
    scrollRef?.(parentRef.current);
    return () => scrollRef?.(null);
  }, [scrollRef]);

  function toggle(path: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else {
        next.add(path);
        setEnterParents(new Set([path]));
      }
      return next;
    });
  }

  function openContextMenu(e: MouseEvent, row: FlatRow) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      path: row.path,
      value: row.value,
      deletable: row.path !== "$",
    });
  }

  const canReorder = Boolean(onReorder);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--jb-elevated)] text-[var(--jb-text)]">
      <div className="shrink-0 px-3 pt-3">
        {toolbar}
        <div className="mb-2 flex items-center justify-between gap-2 text-sm text-[var(--jb-muted)]">
          <span>{summary}</span>
          <span className="text-[10px] uppercase tracking-wide text-[var(--jb-muted)]">
            {rows.length.toLocaleString()} rows · virtual
          </span>
        </div>
      </div>

      <div
        ref={parentRef}
        className="jb-scroll min-h-0 flex-1 overflow-auto px-3 pb-3"
        onScroll={onScroll}
        onContextMenu={(e) => {
          // ignore empty-area context menu
          if ((e.target as HTMLElement).closest("[data-json-path]")) return;
        }}
      >
        <div
          className="relative w-full font-mono text-[13px] leading-6"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((vRow) => {
            const row = rows[vRow.index]!;
            const highlighted = highlightPaths?.has(row.path);
            const toneClass = highlightClasses?.get(row.path);
            const focused = focusPath === row.path;
            const entries = countEntries(row.value);
            const isOpen = open.has(row.path);
            const isArrayChild = row.arrayIndex !== undefined && row.parentPath !== undefined;
            const entering =
              row.parentPath !== undefined && enterParents.has(row.parentPath);
            const isDragTarget =
              dragOver &&
              row.parentPath === dragOver.parentPath &&
              row.arrayIndex === dragOver.index;
            const isDragging =
              dragFrom &&
              row.parentPath === dragFrom.parentPath &&
              row.arrayIndex === dragFrom.index;

            const rowStyle: CSSProperties = {
              height: `${vRow.size}px`,
              transform: `translateY(${vRow.start}px)`,
            };

            return (
              <div
                key={row.path}
                data-json-path={row.path}
                className="absolute left-0 top-0 w-full select-none"
                style={rowStyle}
              >
                <div
                  className={`group flex h-full items-center gap-1 rounded px-1 hover:bg-white/5 ${
                    toneClass
                      ? toneClass
                      : highlighted
                        ? "bg-[var(--jb-accent)]/15 ring-1 ring-[var(--jb-accent)]/40"
                        : ""
                  } ${focused ? "ring-2 ring-[var(--jb-accent-soft)]" : ""} ${
                    entering ? "jb-tree-row-enter" : ""
                  } ${isDragTarget ? "ring-1 ring-[#60a5fa]/60 bg-[#60a5fa]/10" : ""} ${
                    isDragging ? "opacity-50" : ""
                  }`}
                  style={{ paddingLeft: `${row.depth * 14 + 4}px` }}
                  draggable={canReorder && isArrayChild}
                  onContextMenu={(e) => openContextMenu(e, row)}
                  onDragStart={(e) => {
                    if (!canReorder || !isArrayChild) return;
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", row.path);
                    setDragFrom({ parentPath: row.parentPath!, index: row.arrayIndex! });
                  }}
                  onDragEnd={() => {
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  onDragOver={(e) => {
                    if (!canReorder || !isArrayChild || !dragFrom) return;
                    if (row.parentPath !== dragFrom.parentPath) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOver({ parentPath: row.parentPath!, index: row.arrayIndex! });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!onReorder || !dragFrom || !isArrayChild) return;
                    if (row.parentPath !== dragFrom.parentPath) return;
                    const to = row.arrayIndex!;
                    if (dragFrom.index !== to) {
                      onReorder(dragFrom.parentPath, dragFrom.index, to);
                    }
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                >
                  {row.expandable ? (
                    <button
                      type="button"
                      aria-label={isOpen ? "Collapse" : "Expand"}
                      onClick={() => toggle(row.path)}
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[var(--jb-muted)]"
                    >
                      {isOpen ? "▾" : "▸"}
                    </button>
                  ) : (
                    <span className="inline-block w-4 shrink-0" />
                  )}

                  {canReorder && isArrayChild ? (
                    <span
                      className="cursor-grab text-[10px] text-[#475569] active:cursor-grabbing"
                      title="Drag to reorder"
                      aria-hidden
                    >
                      ⠿
                    </span>
                  ) : null}

                  <TypeIcon value={row.value} />

                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left"
                    onClick={() => onSelectPath?.(row.path)}
                    title={row.path}
                  >
                    {row.name !== undefined && (
                      <span className="text-[var(--jb-text)]">
                        {row.name}
                        <span className="text-[var(--jb-muted)]">: </span>
                      </span>
                    )}
                    {row.expandable ? (
                      <span className="text-[var(--jb-muted)]">
                        {Array.isArray(row.value) ? "array" : "object"}{" "}
                        <span className="text-[var(--jb-muted)]">
                          {Array.isArray(row.value) ? `[${entries}]` : `{${entries}}`}
                        </span>
                      </span>
                    ) : (
                      <ValuePreview value={row.value} />
                    )}
                  </button>

                  <button
                    type="button"
                    className="invisible shrink-0 rounded px-1 text-[10px] text-[var(--jb-muted)] group-hover:visible hover:text-[var(--jb-accent-soft)]"
                    title="Copy path"
                    onClick={() => onCopyPath?.(row.path)}
                  >
                    path
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {menu && (
        <div
          className="fixed z-50 min-w-[10.5rem] rounded border border-[var(--jb-border)] bg-[var(--jb-panel)] py-1 text-xs shadow-xl"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <MenuItem
            label="Copy path"
            onClick={() => {
              onCopyPath?.(menu.path);
              void navigator.clipboard.writeText(menu.path);
              setMenu(null);
            }}
          />
          <MenuItem
            label="Copy value"
            onClick={() => {
              void navigator.clipboard.writeText(copyValueText(menu.value));
              setMenu(null);
            }}
          />
          <div className="my-1 border-t border-[var(--jb-border)]" />
          <MenuItem
            label="Duplicate"
            disabled={!onDuplicatePath || menu.path === "$"}
            onClick={() => {
              onDuplicatePath?.(menu.path);
              setMenu(null);
            }}
          />
          <MenuItem
            label="Delete key / index"
            disabled={!onDeletePath || !menu.deletable}
            danger
            onClick={() => {
              onDeletePath?.(menu.path);
              setMenu(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={`block w-full px-3 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? "text-rose-300 hover:bg-rose-950/40" : "text-[var(--jb-text)] hover:bg-[var(--jb-border)]"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
