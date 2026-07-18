import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { JsonEditor } from "../editor/JsonEditor";
import { BottomSheet } from "./BottomSheet";
import {
  kindColor,
  kindLabel,
  summarizeDiffs,
  type JsonDiffItem,
} from "../../lib/jsonDiff";
import { cn } from "../../lib/cn";

export function MobileCompare({
  left,
  right,
  setLeft,
  setRight,
  compareOn,
  setCompareOn,
  diffIndex,
  setDiffIndex,
  filteredDiffs,
  onAccept,
  onReject,
  onMerge,
}: {
  left: string;
  right: string;
  setLeft: (v: string) => void;
  setRight: (v: string) => void;
  compareOn: boolean;
  setCompareOn: (v: boolean) => void;
  diffIndex: number;
  setDiffIndex: (i: number) => void;
  filteredDiffs: JsonDiffItem[];
  onAccept: () => void;
  onReject: () => void;
  onMerge: () => void;
}) {
  const [activeSide, setActiveSide] = useState<"a" | "b">("a");
  const [editorOpen, setEditorOpen] = useState(false);
  const summary = useMemo(() => summarizeDiffs(filteredDiffs), [filteredDiffs]);
  const current = filteredDiffs[diffIndex];

  return (
    <div className="jb-mobile-compare flex h-full min-h-0 flex-col bg-[var(--jb-canvas)] md:hidden">
      <div className="shrink-0 border-b border-[var(--jb-border)] bg-[var(--jb-panel)] px-4 py-3">
        <div className="jb-mobile-segment">
          <button
            type="button"
            className={cn(activeSide === "a" && "jb-mobile-segment-active")}
            onClick={() => setActiveSide("a")}
          >
            Version A
          </button>
          <button
            type="button"
            className={cn(activeSide === "b" && "jb-mobile-segment-active")}
            onClick={() => setActiveSide("b")}
          >
            Version B
          </button>
        </div>
        <button
          type="button"
          className="jb-touch-chip mt-3 w-full justify-center"
          onClick={() => setEditorOpen(true)}
        >
          Edit {activeSide === "a" ? "A" : "B"}
        </button>
      </div>

      <div className="jb-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4 flex flex-wrap gap-2 text-xs text-[var(--jb-muted)]">
          <span className="jb-mobile-pill">{summary.total} diffs</span>
          <label className="jb-mobile-pill flex items-center gap-2">
            <input type="checkbox" checked={compareOn} onChange={(e) => setCompareOn(e.target.checked)} />
            Compare
          </label>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={diffIndex}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="jb-mobile-card p-4"
          >
            {current ? (
              <>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", kindColor(current.kind))}>
                    {kindLabel(current.kind)}
                  </span>
                  <span className="truncate font-mono text-xs text-[var(--jb-muted)]">{current.path}</span>
                </div>
                <p className="mt-3 text-sm">{current.message}</p>
                <div className="mt-4 grid gap-2 text-xs font-mono">
                  {current.leftValue !== undefined && (
                    <div className="rounded-lg bg-red-500/10 p-2 text-red-200">A: {JSON.stringify(current.leftValue)}</div>
                  )}
                  {current.rightValue !== undefined && (
                    <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-200">B: {JSON.stringify(current.rightValue)}</div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--jb-muted)]">No differences with current filters.</p>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="jb-touch-chip flex-1 justify-center"
            disabled={diffIndex <= 0}
            onClick={() => setDiffIndex(Math.max(0, diffIndex - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <button
            type="button"
            className="jb-touch-chip flex-1 justify-center"
            disabled={diffIndex >= filteredDiffs.length - 1}
            onClick={() => setDiffIndex(Math.min(filteredDiffs.length - 1, diffIndex + 1))}
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button type="button" className="jb-touch-chip justify-center" onClick={onAccept}>
            Accept
          </button>
          <button type="button" className="jb-touch-chip justify-center" onClick={onReject}>
            Reject
          </button>
          <button type="button" className="jb-touch-chip-primary justify-center" onClick={onMerge}>
            Merge
          </button>
        </div>
      </div>

      <BottomSheet
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={activeSide === "a" ? "Version A" : "Version B"}
        tall
      >
        <JsonEditor
          value={activeSide === "a" ? left : right}
          onChange={activeSide === "a" ? setLeft : setRight}
          bordered={false}
        />
      </BottomSheet>
    </div>
  );
}
