import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileImage,
  Grid3x3,
  History,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  Type,
  Undo2,
  ZoomIn,
} from "lucide-react";
import { useStore } from "zustand";
import { useEditorStore } from "@/state/editorStore";
import type { SelectionScope } from "@/state/editorStore";
import { useOverridesStore } from "@/state/overridesStore";
import { useReflowStore } from "@/state/reflowStore";
import { useHistoryStore, relativeTime, type HistoryEntry } from "@/state/historyStore";

type Props = {
  zoom: number;
  setZoom: (z: number) => void;
  pageLabel: string;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
};

export function CanvasToolbar({
  zoom,
  setZoom,
  pageLabel,
  onPrevPage,
  onNextPage,
  canGoPrev,
  canGoNext,
}: Props) {
  const clamp = (z: number) => Math.max(25, Math.min(300, Math.round(z)));
  const editMode = useEditorStore((s) => s.editMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const scope = useEditorStore((s) => s.scope);
  const setScope = useEditorStore((s) => s.setScope);
  const showGuides = useEditorStore((s) => s.showGuides);
  const setShowGuides = useEditorStore((s) => s.setShowGuides);
  const pastCount = useStore(useOverridesStore.temporal, (s) => s.pastStates.length);
  const futureCount = useStore(useOverridesStore.temporal, (s) => s.futureStates.length);
  const undo = () => useOverridesStore.temporal.getState().undo();
  const redo = () => useOverridesStore.temporal.getState().redo();
  const versesReady = useReflowStore((s) => s.versesReady);
  const rebuilding = useReflowStore((s) => s.rebuilding);
  const entries = useHistoryStore((s) => s.entries);
  const [histOpen, setHistOpen] = useState(false);
  const histRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!histOpen) return;
    const handler = (e: MouseEvent) => {
      if (histRef.current && !histRef.current.contains(e.target as Node)) {
        setHistOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [histOpen]);

  const SCOPE_META: Record<SelectionScope, { labelBn: string; color: string }> = {
    row:    { labelBn: "সারি",  color: "#f59e0b" },
    page:   { labelBn: "পেজ",  color: "#06b6d4" },
    surah:  { labelBn: "সূরা", color: "#8b5cf6" },
    para:   { labelBn: "পারা", color: "#ec4899" },
    global: { labelBn: "সকল", color: "#10b981" },
  };
  const SCOPES: SelectionScope[] = ["row", "page", "surah", "para", "global"];

  // Recent 10 entries newest-first
  const recent = [...entries].reverse().slice(0, 10);

  return (
    <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/80 px-3 py-1.5 text-neutral-300 backdrop-blur-sm">

      {/* ── Left ── */}
      {editMode ? (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTool("select")}
            title="Selection Tool (V)"
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              activeTool === "select"
                ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
            }`}
          >
            <MousePointer2 className="h-3 w-3" />V
          </button>
          <button
            onClick={() => setActiveTool("type")}
            title="Type Tool (T)"
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              activeTool === "type"
                ? "border-sky-500/50 bg-sky-500/15 text-sky-300"
                : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
            }`}
          >
            <Type className="h-3 w-3" />T
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <ToolBtn onClick={onPrevPage} disabled={!canGoPrev} title="আগের পেজ (←)">
            <ChevronLeft className="h-3.5 w-3.5" />
          </ToolBtn>
          <span className="min-w-[80px] rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-center text-[11px] text-neutral-300">
            {pageLabel}
          </span>
          <ToolBtn onClick={onNextPage} disabled={!canGoNext} title="পরের পেজ (→)">
            <ChevronRight className="h-3.5 w-3.5" />
          </ToolBtn>
          {!versesReady && (
            <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />লোড হচ্ছে…
            </span>
          )}
          {versesReady && rebuilding && (
            <span className="flex items-center gap-1 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-400">
              <span className="h-1.5 w-1.5 animate-spin rounded-full border border-sky-400 border-t-transparent" />রিবিল্ড…
            </span>
          )}
        </div>
      )}

      {/* ── Center ── */}
      {editMode ? (
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] uppercase tracking-wider text-neutral-600">প্রভাব</span>
          {SCOPES.map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              title={SCOPE_META[s].labelBn}
              className="rounded px-2 py-1 text-[11px] font-semibold transition-all"
              style={scope === s
                ? { background: `${SCOPE_META[s].color}22`, border: `1px solid ${SCOPE_META[s].color}55`, color: SCOPE_META[s].color }
                : { background: "#1a1a1a", border: "1px solid #262626", color: "#525252" }
              }
            >
              {SCOPE_META[s].labelBn}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <ToolBtn onClick={() => setZoom(clamp(zoom - 10))} title="Zoom out ([)"><Minus className="h-3.5 w-3.5" /></ToolBtn>
          <div className="min-w-[52px] rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-center text-xs font-bold tabular-nums text-neutral-200">{zoom}%</div>
          <ToolBtn onClick={() => setZoom(clamp(zoom + 10))} title="Zoom in (])"><Plus className="h-3.5 w-3.5" /></ToolBtn>
          <button onClick={() => setZoom(85)} className="ml-1 flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100" title="ফিট করুন (F)">
            <Maximize2 className="h-3 w-3" />ফিট
          </button>
          <button onClick={() => setZoom(100)} className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100" title="100%">
            <ZoomIn className="h-3 w-3" />1:1
          </button>
        </div>
      )}

      {/* ── Right ── */}
      <div className="flex items-center gap-1">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 rounded-md border border-neutral-800 bg-neutral-800/50 p-0.5">
          <button onClick={undo} disabled={pastCount === 0} title={`Undo (Ctrl+Z) · ${pastCount}`} className="relative grid h-6 w-6 place-items-center rounded text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-30">
            <Undo2 className="h-3.5 w-3.5" />
            {pastCount > 0 && (<span className="absolute -right-0.5 -top-0.5 grid h-3 min-w-[12px] place-items-center rounded-full bg-amber-500 px-0.5 text-[7px] font-black text-neutral-950">{pastCount > 9 ? "9+" : pastCount}</span>)}
          </button>
          <button onClick={redo} disabled={futureCount === 0} title={`Redo (Ctrl+Shift+Z) · ${futureCount}`} className="grid h-6 w-6 place-items-center rounded text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-30">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mx-1 h-4 w-px bg-neutral-800" />

        {/* History dropdown */}
        <div className="relative" ref={histRef}>
          <button
            onClick={() => setHistOpen((v) => !v)}
            title="পরিবর্তনের ইতিহাস"
            className={`relative grid h-7 w-7 place-items-center rounded-md border transition-colors ${
              histOpen
                ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            {entries.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-3 min-w-[12px] place-items-center rounded-full bg-amber-500 px-0.5 text-[7px] font-black text-neutral-950">
                {entries.length > 9 ? "9+" : entries.length}
              </span>
            )}
          </button>

          {histOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-[320px] overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
              <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                  <Clock className="h-3 w-3" />পরিবর্তনের ইতিহাস
                </div>
                <button
                  onClick={() => { if (confirm("সব ইতিহাস মুছবেন?")) useHistoryStore.getState().clear(); }}
                  className="text-[10px] text-neutral-600 hover:text-red-400 transition-colors"
                >মুছুন</button>
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {recent.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[11px] text-neutral-600">কোনো ইতিহাস নেই</div>
                ) : (
                  recent.map((entry) => (
                    <HistoryItem key={entry.id} entry={entry} onClose={() => setHistOpen(false)} />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button onClick={() => setShowGuides(!showGuides)} title="Toggle grid guides (G)"
          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
            showGuides ? "border-sky-400/40 bg-sky-500/10 text-sky-300" : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
          }`}
        >
          <Grid3x3 className="h-3 w-3" />গাইড
        </button>

        <button id="btn-export-png" title="Export as PNG"
          className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200"
        >
          <FileImage className="h-3 w-3" />PNG
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HistoryItem
// ─────────────────────────────────────────────────────────────────────────────
function HistoryItem({ entry, onClose }: { entry: HistoryEntry; onClose: () => void }) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const navigate = () => {
    if (entry.pageId) {
      const rk = entry.layerKey ?? (entry.rowIndex !== undefined
        ? `row:${entry.pageId}:${entry.rowIndex}` : undefined);
      useEditorStore.getState().navigateTo(entry.pageId, rk);
    }
    onClose();
  };

  const restore = (e: React.MouseEvent) => {
    e.stopPropagation();
    useHistoryStore.getState().restoreTo(entry.id);
    onClose();
  };

  const previewBefore = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (countdown !== null) return;

    // Capture current full state so we can restore after 5s
    const currentSnapshot = {
      local: JSON.parse(JSON.stringify(useOverridesStore.getState().local)),
      global: JSON.parse(JSON.stringify(useOverridesStore.getState().global)),
    };

    // Apply the BEFORE snapshot from this history entry (whole-state replay).
    // This handles text edits, transforms, and global changes consistently.
    if (entry.beforeSnapshot) {
      useHistoryStore.getState().applySnapshot(entry.beforeSnapshot);
    }

    // 5-second countdown
    let c = 5;
    setCountdown(c);
    timerRef.current = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setCountdown(null);
        // Restore the user's pre-preview state via the same snapshot mechanism
        useHistoryStore.getState().applySnapshot(currentSnapshot);
      }
    }, 1000);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return (
    <div
      className="group flex flex-col gap-1 border-b border-neutral-800/60 px-3 py-2 transition-colors hover:bg-neutral-800/40 cursor-pointer"
      onClick={navigate}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex-1 text-[11px] leading-tight text-neutral-300 line-clamp-2">
          {entry.labelBn}
        </span>
        <span className="mt-0.5 shrink-0 text-[9px] text-neutral-600">
          {relativeTime(entry.ts)}
        </span>
      </div>

      {entry.pageId && (
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] font-mono text-neutral-500 w-fit">
          {entry.pageId}{entry.rowIndex !== undefined ? `:${entry.rowIndex}` : ""}
        </span>
      )}

      <div className="flex items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={restore}
          className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors"
        >
          পুনরুদ্ধার
        </button>
        <button
          onClick={previewBefore}
          disabled={countdown !== null}
          className="flex items-center gap-1 rounded border border-amber-900/40 bg-amber-900/10 px-2 py-0.5 text-[10px] text-amber-500 hover:bg-amber-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {countdown !== null ? (
            <><span className="tabular-nums font-bold">{countdown}s</span> আগের দেখাচ্ছে…</>
          ) : "আগের"}
        </button>
      </div>
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="grid h-7 w-7 place-items-center rounded-md border border-neutral-700 bg-neutral-800 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
