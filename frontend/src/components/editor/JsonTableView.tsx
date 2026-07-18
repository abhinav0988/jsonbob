import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Pin, PinOff } from "lucide-react";
import {
  cellPreview,
  findTableCandidates,
  isFlatObjectArray,
  pathToLabel,
  tableColumns,
} from "../../lib/jsonPath";

type SortDir = "asc" | "desc" | null;

const DEFAULT_COL_WIDTH = 140;
const MIN_COL_WIDTH = 64;
const ROW_H = 32;

export function JsonTableView({
  data,
  focusPath,
  onEditPath,
  onExtractPath,
  onSwitchToTree,
  onOpenNested,
  onCellChange,
  onDeleteRows,
  mobileCards = false,
}: {
  data: unknown;
  focusPath?: string;
  onEditPath?: (path: string) => void;
  onExtractPath?: (path: string) => void;
  onSwitchToTree?: () => void;
  onOpenNested?: (path: string) => void;
  onCellChange?: (row: number, key: string, raw: string) => void;
  onDeleteRows?: (indices: number[]) => void;
  mobileCards?: boolean;
}) {
  const [editCell, setEditCell] = useState<{ row: number; key: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [colWidths, setColWidths] = useState<Map<string, number>>(() => new Map());
  const [pinned, setPinned] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const resizeRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const candidates = useMemo(() => findTableCandidates(data), [data]);
  const canTabulate = isFlatObjectArray(data);
  const rows = useMemo(
    () => (canTabulate ? data : []) as Record<string, unknown>[],
    [canTabulate, data],
  );
  const columns = useMemo(() => tableColumns(rows), [rows]);

  const display = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let indexed = rows.map((row, index) => ({ row, index }));
    if (q) {
      indexed = indexed.filter(({ row }) =>
        columns.some((col) => {
          const v = row[col];
          if (v == null) return false;
          return String(typeof v === "object" ? JSON.stringify(v) : v)
            .toLowerCase()
            .includes(q);
        }),
      );
    }
    if (sortKey && sortDir) {
      indexed = [...indexed].sort((a, b) => {
        const av = a.row[sortKey];
        const bv = b.row[sortKey];
        const as = av == null ? "" : typeof av === "object" ? JSON.stringify(av) : String(av);
        const bs = bv == null ? "" : typeof bv === "object" ? JSON.stringify(bv) : String(bv);
        const an = typeof av === "number" ? av : Number(as);
        const bn = typeof bv === "number" ? bv : Number(bs);
        let cmp = 0;
        if (!Number.isNaN(an) && !Number.isNaN(bn) && as !== "" && bs !== "") cmp = an - bn;
        else cmp = as.localeCompare(bs, undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return indexed;
  }, [rows, columns, filter, sortKey, sortDir]);

  const rowVirtualizer = useVirtualizer({
    count: display.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  const orderedColumns = useMemo(() => {
    const pinSet = new Set(pinned);
    return [...pinned.filter((c) => columns.includes(c)), ...columns.filter((c) => !pinSet.has(c))];
  }, [columns, pinned]);

  const selectColLeft = 0;
  const indexColLeft = 36;
  const pinnedOffsets = useMemo(() => {
    const map = new Map<string, number>();
    let left = indexColLeft + 48;
    for (const col of pinned) {
      if (!columns.includes(col)) continue;
      map.set(col, left);
      left += colWidths.get(col) ?? DEFAULT_COL_WIDTH;
    }
    return map;
  }, [pinned, columns, colWidths]);

  useEffect(() => {
    setSelected(new Set());
  }, [data, filter, sortKey, sortDir]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const next = Math.max(MIN_COL_WIDTH, r.startW + (e.clientX - r.startX));
      setColWidths((prev) => {
        const m = new Map(prev);
        m.set(r.key, next);
        return m;
      });
    };
    const onUp = () => {
      resizeRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function colWidth(col: string) {
    return colWidths.get(col) ?? DEFAULT_COL_WIDTH;
  }

  function startResize(col: string, e: ReactMouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { key: col, startX: e.clientX, startW: colWidth(col) };
  }

  function togglePin(col: string, e: ReactMouseEvent) {
    e.stopPropagation();
    setPinned((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  }

  function toggleSort(col: string) {
    if (sortKey !== col) {
      setSortKey(col);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") setSortDir("desc");
    else if (sortDir === "desc") {
      setSortKey(null);
      setSortDir(null);
    } else setSortDir("asc");
  }

  function toggleRow(ri: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ri)) next.delete(ri);
      else next.add(ri);
      return next;
    });
  }

  const stickyBase = "sticky z-10 bg-[var(--jb-panel)]";

  if (!canTabulate) {
    return (
      <div className="p-3 text-sm text-[var(--jb-muted)]">
        <p>Table view needs a flat array of objects.</p>
        {candidates[0] && onOpenNested && (
          <button type="button" className="jb-action mt-2" onClick={() => onOpenNested(candidates[0]!.path)}>
            Open {pathToLabel(candidates[0].path)}
          </button>
        )}
        {onSwitchToTree && (
          <button type="button" className="jb-action mt-2 ml-2" onClick={onSwitchToTree}>
            Switch to Tree
          </button>
        )}
      </div>
    );
  }

  if (mobileCards) {
    return (
      <div className="space-y-3">
        {display.slice(0, 80).map(({ row, index }) => (
          <article key={index} className="jb-mobile-card p-4">
            <p className="mb-2 text-xs font-medium text-[var(--jb-muted)]">Row {index + 1}</p>
            <dl className="space-y-2">
              {columns.map((col) => (
                <div key={col} className="flex flex-col gap-0.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--jb-muted)]">{col}</dt>
                  <dd className="font-mono text-sm break-all">{cellPreview(row[col])}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    );
  }

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--jb-border)] px-2 py-1.5">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter rows…"
          className="toolbar-input min-w-[10rem] flex-1"
        />
        <span className="text-[11px] text-[var(--jb-muted)]">
          {display.length.toLocaleString()} rows · virtualized
        </span>
        {selected.size > 0 && onDeleteRows && (
          <button
            type="button"
            className="jb-action"
            onClick={() => {
              onDeleteRows([...selected]);
              setSelected(new Set());
            }}
          >
            Delete {selected.size}
          </button>
        )}
        {onExtractPath && (
          <button type="button" className="jb-action" onClick={() => onExtractPath(focusPath || "$")}>
            Extract
          </button>
        )}
        {onEditPath && (
          <button type="button" className="jb-action" onClick={() => onEditPath(focusPath || "$")}>
            Focus
          </button>
        )}
      </div>

      <div ref={parentRef} className="jb-scroll min-h-0 flex-1 overflow-auto">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", minWidth: "100%" }}>
          <table className="w-max min-w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-20 bg-[var(--jb-panel)]">
              <tr>
                <th className={`${stickyBase} border border-[var(--jb-border)] px-1 py-1`} style={{ left: selectColLeft, width: 36 }} />
                <th className={`${stickyBase} border border-[var(--jb-border)] px-2 py-1 font-mono text-[var(--jb-muted)]`} style={{ left: indexColLeft, width: 48 }}>#</th>
                {orderedColumns.map((col) => {
                  const isPinned = pinned.includes(col);
                  const left = pinnedOffsets.get(col);
                  return (
                    <th
                      key={col}
                      className={`relative border border-[var(--jb-border)] px-2 py-1 font-mono ${isPinned ? stickyBase : ""}`}
                      style={{ width: colWidth(col), maxWidth: colWidth(col), ...(isPinned && left !== undefined ? { left } : {}) }}
                    >
                      <div className="flex items-center gap-1">
                        <button type="button" className="truncate hover:text-[var(--jb-accent)]" onClick={() => toggleSort(col)}>
                          {col}
                          {sortKey === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                        </button>
                        <button type="button" className={`shrink-0 rounded p-0.5 ${isPinned ? "text-[var(--jb-accent-soft)]" : "text-[var(--jb-muted)]"}`} title={isPinned ? "Unpin" : "Pin"} onClick={(e) => togglePin(col, e)}>
                          {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                        </button>
                      </div>
                      <span role="separator" aria-orientation="vertical" className="absolute inset-y-0 right-0 z-20 w-1 cursor-col-resize hover:bg-[var(--jb-accent)]/50" onMouseDown={(e) => startResize(col, e)} />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {virtualRows.map((vRow) => {
                const item = display[vRow.index];
                if (!item) return null;
                const { row, index: ri } = item;
                return (
                  <tr key={ri} data-index={vRow.index} ref={rowVirtualizer.measureElement} className={`odd:bg-[var(--jb-panel)]/60 ${selected.has(ri) ? "bg-[var(--jb-accent)]/10" : ""}`} style={{ height: ROW_H }}>
                    <td className={`${stickyBase} border border-[var(--jb-border)] px-1 py-1`} style={{ left: selectColLeft, width: 36 }}>
                      <input type="checkbox" aria-label={`Select row ${ri}`} checked={selected.has(ri)} onChange={() => toggleRow(ri)} className="accent-[var(--jb-accent)]" />
                    </td>
                    <td className={`${stickyBase} border border-[var(--jb-border)] px-2 py-1 font-mono text-[var(--jb-muted)]`} style={{ left: indexColLeft, width: 48 }}>{ri}</td>
                    {orderedColumns.map((col: string) => {
                      const val = row[col];
                      const nested = val !== null && typeof val === "object";
                      const editing = Boolean(editCell && editCell.row === ri && editCell.key === col);
                      const isPinned = pinned.includes(col);
                      const left = pinnedOffsets.get(col);
                      return (
                        <td
                          key={col}
                          className={`border border-[var(--jb-border)] px-2 py-1 font-mono text-[var(--jb-text)] ${isPinned ? stickyBase : ""}`}
                          style={{ width: colWidth(col), maxWidth: colWidth(col), ...(isPinned && left !== undefined ? { left } : {}) }}
                          onDoubleClick={() => {
                            if (!onCellChange || nested) return;
                            setEditCell({ row: ri, key: col });
                            setDraft(val === undefined ? "" : JSON.stringify(val));
                          }}
                        >
                          {editing ? (
                            <input
                              autoFocus
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onBlur={() => { onCellChange?.(ri, col, draft); setEditCell(null); }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { onCellChange?.(ri, col, draft); setEditCell(null); }
                                if (e.key === "Escape") setEditCell(null);
                              }}
                              className="w-full bg-transparent outline-none"
                            />
                          ) : nested && onOpenNested ? (
                            <button type="button" className="text-[var(--jb-accent)] hover:underline" onClick={() => onOpenNested(`${focusPath || "$"}[${ri}].${col}`)}>
                              {cellPreview(val)}
                            </button>
                          ) : (
                            cellPreview(val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
