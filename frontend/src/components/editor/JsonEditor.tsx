import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import { useThemeStore } from "../../store/themeStore";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  bordered?: boolean;
  onMount?: OnMount;
  minimap?: boolean;
  formatOnPaste?: boolean;
}

export function JsonEditor({
  value,
  onChange,
  readOnly = false,
  bordered = true,
  onMount,
  minimap,
  formatOnPaste,
}: JsonEditorProps) {
  const locked = Boolean(readOnly);
  const dark = useThemeStore((s) => s.dark);
  const prefMinimap = useThemeStore((s) => s.minimap);
  const prefFormatOnPaste = useThemeStore((s) => s.formatOnPaste);
  const showMinimap = minimap ?? prefMinimap;
  const doFormatOnPaste = formatOnPaste ?? prefFormatOnPaste;
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      editorRef.current?.layout();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    editorRef.current?.updateOptions({
      minimap: { enabled: showMinimap },
      overviewRulerLanes: showMinimap ? 2 : 0,
      formatOnPaste: doFormatOnPaste,
    });
  }, [showMinimap, doFormatOnPaste]);

  return (
    <div
      ref={containerRef}
      className={
        bordered
          ? "relative h-full min-h-0 w-full overflow-hidden rounded-lg border border-[var(--jb-border)]"
          : "relative h-full min-h-0 w-full overflow-hidden"
      }
    >
      <div className="absolute inset-0">
        <Editor
          height="100%"
          width="100%"
          language="json"
          theme={dark ? "vs-dark" : "light"}
          value={value}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            onMount?.(editor, monaco);
            requestAnimationFrame(() => editor.layout());
          }}
          onChange={(v) => {
            if (!locked) onChange(v ?? "");
          }}
          options={{
            readOnly: locked,
            domReadOnly: locked,
            minimap: { enabled: showMinimap },
            formatOnPaste: doFormatOnPaste,
            fontSize: 14,
            fontFamily: "IBM Plex Mono, ui-monospace, monospace",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            padding: { top: 12, bottom: 12 },
            lineNumbers: "on",
            renderLineHighlight: "line",
            cursorBlinking: "smooth",
            scrollbar: {
              vertical: "auto",
              horizontal: "auto",
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
              alwaysConsumeMouseWheel: false,
            },
            mouseWheelScrollSensitivity: 1,
            smoothScrolling: true,
            overviewRulerLanes: showMinimap ? 2 : 0,
            hideCursorInOverviewRuler: !showMinimap,
            overviewRulerBorder: showMinimap,
          }}
        />
      </div>
    </div>
  );
}
