import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SelectionScope } from "./editorStore";
import type { GlobalOverrides, LocalOverride } from "./overridesStore";

/* ─── Types ──────────────────────────────────────────────────────── */
export type HistoryEntry = {
  id: string;
  ts: number;
  label: string;
  labelBn: string;
  scope: SelectionScope;
  pageId?: string;
  rowIndex?: number;
  /** Which layer key was changed (e.g. layer:pageId:rowIndex:arabic) */
  layerKey?: string;
  field: string;
  before: unknown;
  after: unknown;
  /** Full snapshot of override state at time of change */
  snapshot: {
    global: GlobalOverrides;
    local: Record<string, LocalOverride>;
  };
};

const MAX_ENTRIES = 200;

/* ─── Field human labels ─────────────────────────────────────────── */
export const FIELD_LABELS_BN: Record<string, string> = {
  arabicFontPx:  "আরবি ফন্ট সাইজ",
  banglaFontPx:  "বাংলা ফন্ট সাইজ",
  symbolScale:   "প্রতীক স্কেল",
  arabicYOffset: "আরবি Y অফসেট",
  banglaYOffset: "বাংলা Y অফসেট",
  symbolYOffset: "প্রতীক Y অফসেট",
  rowSpacing:    "সারি ব্যবধান",
  dx:            "X অফসেট",
  dy:            "Y অফসেট",
  fontPx:        "ফন্ট সাইজ",
  scale:         "স্কেল",
  text:          "টেক্সট পরিবর্তন",
  leading:       "লাইন স্পেসিং",
  tracking:      "অক্ষর ব্যবধান",
  align:         "সারিবদ্ধতা",
};

export function formatVal(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "number") return String(Math.round(v * 100) / 100);
  return String(v);
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff} সেকেন্ড আগে`;
  if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ঘণ্টা আগে`;
  return `${Math.floor(diff / 86400)} দিন আগে`;
}
export { relativeTime };

/* ─── Store ──────────────────────────────────────────────────────── */
type HistoryState = {
  entries: HistoryEntry[];
  /** Push a new entry — auto-evicts oldest when over MAX_ENTRIES */
  push: (entry: Omit<HistoryEntry, "id" | "ts">) => void;
  /** Restore overridesStore to a specific snapshot */
  restoreTo: (id: string) => void;
  /** Clear all history */
  clear: () => void;
};

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],

      push: (entry) => {
        const newEntry: HistoryEntry = {
          ...entry,
          id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          ts: Date.now(),
        };
        set((s) => ({
          entries:
            s.entries.length >= MAX_ENTRIES
              ? [...s.entries.slice(1), newEntry]
              : [...s.entries, newEntry],
        }));
      },

      restoreTo: (id) => {
        const entry = get().entries.find((e) => e.id === id);
        if (!entry) return;
        import("./overridesStore").then(({ useOverridesStore, setRestoringHistory }) => {
          const store = useOverridesStore.getState();
          // Guard: disable history capture during this restoration
          setRestoringHistory(true);
          try {
            // Step 1: clear all current overrides
            store.resetAll();
            // Step 2: re-apply local overrides from snapshot
            const localEntries = Object.entries(entry.snapshot.local);
            for (const [k, v] of localEntries) {
              store.patchLocal(k, v);
            }
            // Step 3: re-apply global overrides from snapshot
            const g = entry.snapshot.global;
            if (g.arabicFontPx  !== undefined) store.setGlobal("arabicFontPx",  g.arabicFontPx);
            if (g.banglaFontPx  !== undefined) store.setGlobal("banglaFontPx",  g.banglaFontPx);
            if (g.arabicYOffset !== undefined) store.setGlobal("arabicYOffset", g.arabicYOffset);
            if (g.banglaYOffset !== undefined) store.setGlobal("banglaYOffset", g.banglaYOffset);
            if (g.symbolYOffset !== undefined) store.setGlobal("symbolYOffset", g.symbolYOffset);
            if (g.symbolScale   !== undefined) store.setGlobal("symbolScale",   g.symbolScale);
            if (g.rowSpacing    !== undefined) store.setGlobal("rowSpacing",    g.rowSpacing);
          } finally {
            setRestoringHistory(false);
          }
        });
      },

      clear: () => set({ entries: [] }),
    }),
    {
      name: "studio-history-v1",
      partialize: (s) => ({ entries: s.entries.slice(-50) }), // persist only last 50
    },
  ),
);

/* ─── Auto-capture hook (call from overridesStore after mutations) ─ */
export function captureHistory(
  field: string,
  before: unknown,
  after: unknown,
  scope: SelectionScope,
  pageId?: string,
  rowIndex?: number,
  layerKey?: string,
) {
  // Lazy import to avoid circular deps
  import("./overridesStore").then(({ useOverridesStore }) => {
    const s = useOverridesStore.getState();
    // Skip if no actual change
    if (before === after) return;
    const fieldLabelBn = FIELD_LABELS_BN[field] ?? field;
    // For text changes, show a truncated preview instead of full old→new
    let labelBn: string;
    let label: string;
    if (field === "text") {
      const preview = String(after ?? "").slice(0, 20) + (String(after ?? "").length > 20 ? "…" : "");
      labelBn = `টেক্সট পরিবর্তন: "${preview}"`;
      label = `text: "${preview}"`;
    } else {
      const beforeStr = formatVal(before);
      const afterStr = formatVal(after);
      labelBn = `${fieldLabelBn}: ${beforeStr} → ${afterStr}`;
      label = `${field}: ${beforeStr} → ${afterStr}`;
    }
    useHistoryStore.getState().push({
      label,
      labelBn,
      scope,
      pageId,
      rowIndex,
      layerKey,
      field,
      before,
      after,
      snapshot: {
        global: { ...s.global },
        local: { ...s.local },
      },
    });
  });
}
