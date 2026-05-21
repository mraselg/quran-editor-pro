import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SelectionScope } from "./editorStore";
import type { GlobalOverrides, LocalOverride } from "./overridesStore";

/* ─── Types ──────────────────────────────────────────────────────── */
export type HistorySnapshot = {
  global: GlobalOverrides;
  local: Record<string, LocalOverride>;
};

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
  /** Snapshot BEFORE the change (used for "preview-previous" 5s peek) */
  beforeSnapshot: HistorySnapshot;
  /** Snapshot AFTER the change (used for "restore") */
  snapshot: HistorySnapshot;
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

/** Default per-field values. If a change is `undefined → default`, we treat it
 *  as a no-op and skip pushing a history entry. */
export const FIELD_DEFAULTS: Record<string, unknown> = {
  dx: 0,
  dy: 0,
  fontPx: 0,
  leading: 0,
  tracking: 0,
  baseline: 0,
  vScale: 100,
  hScale: 100,
  align: "justify",
  scale: 1,
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

/* ─── Silent mode (used during inline text edits / bulk restores) ──
 *  Increment with beginSilent() and decrement with endSilent(). While > 0,
 *  captureHistory() becomes a no-op. */
let _silent = 0;
export function beginSilent() { _silent += 1; }
export function endSilent() { _silent = Math.max(0, _silent - 1); }
export function isSilent() { return _silent > 0; }

/* ─── Store ──────────────────────────────────────────────────────── */
type HistoryState = {
  entries: HistoryEntry[];
  push: (entry: Omit<HistoryEntry, "id" | "ts">) => void;
  /** Replay the snapshot AFTER a given entry. */
  restoreTo: (id: string) => void;
  /** Replay the snapshot BEFORE a given entry (used by preview-previous). */
  applySnapshot: (snap: HistorySnapshot) => void;
  clear: () => void;
};

async function applySnapshotImpl(snap: HistorySnapshot) {
  const { useOverridesStore, setRestoringHistory } = await import("./overridesStore");
  const store = useOverridesStore.getState();
  setRestoringHistory(true);
  try {
    store.resetAll();
    for (const [k, v] of Object.entries(snap.local)) {
      store.patchLocal(k, v);
    }
    const g = snap.global;
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
}

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
        void applySnapshotImpl(entry.snapshot);
      },

      applySnapshot: (snap) => { void applySnapshotImpl(snap); },

      clear: () => set({ entries: [] }),
    }),
    {
      name: "studio-history-v2",
      partialize: (s) => ({ entries: s.entries.slice(-50) }),
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
  if (isSilent()) return;
  // Skip true no-ops
  if (before === after) return;
  // Skip undefined → default-value transitions (these are noise from UI mount)
  if (before === undefined && Object.prototype.hasOwnProperty.call(FIELD_DEFAULTS, field)) {
    if (after === FIELD_DEFAULTS[field]) return;
  }

  void import("./overridesStore").then(({ useOverridesStore }) => {
    const s = useOverridesStore.getState();

    // Build the AFTER snapshot (current state)
    const afterSnap: HistorySnapshot = {
      global: { ...s.global },
      local: { ...s.local },
    };

    // Build the BEFORE snapshot by undoing the single field change.
    // This gives "preview-previous" a precise rollback target without
    // requiring zundo's temporal store.
    const beforeSnap: HistorySnapshot = {
      global: { ...s.global },
      local: { ...s.local },
    };
    if (layerKey) {
      const cur = { ...(beforeSnap.local[layerKey] ?? {}) } as Record<string, unknown>;
      if (before === undefined) delete cur[field];
      else cur[field] = before;
      if (Object.keys(cur).length === 0) {
        const next = { ...beforeSnap.local };
        delete next[layerKey];
        beforeSnap.local = next;
      } else {
        beforeSnap.local = { ...beforeSnap.local, [layerKey]: cur as LocalOverride };
      }
    } else {
      // global field
      const g = { ...beforeSnap.global } as Record<string, unknown>;
      if (before === undefined) delete g[field];
      else g[field] = before;
      beforeSnap.global = g as GlobalOverrides;
    }

    const fieldLabelBn = FIELD_LABELS_BN[field] ?? field;
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
      beforeSnapshot: beforeSnap,
      snapshot: afterSnap,
    });
  });
}
