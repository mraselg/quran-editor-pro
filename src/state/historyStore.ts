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
  /** Snapshot of override state BEFORE this change (used for "preview-previous") */
  beforeSnapshot: HistorySnapshot;
  /** Snapshot of override state AFTER this change (used for "restore") */
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

/** Default values for character/paragraph fields — used to skip "no-op" history
 *  entries when a control merely echoes its default on first interaction. */
const FIELD_DEFAULTS: Record<string, unknown> = {
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

/* ─── Silent / suppress mode (used during inline text edits) ───────
 * When _silent > 0, captureHistory becomes a no-op. Call beginSilent()
 * before a burst of edits and endSilent() to re-enable capture. */
let _silent = 0;
export function beginSilent() { _silent += 1; }
export function endSilent() { _silent = Math.max(0, _silent - 1); }
export function isSilent() { return _silent > 0; }

/* ─── Store ──────────────────────────────────────────────────────── */
type HistoryState = {
  entries: HistoryEntry[];
  /** Push a new entry — auto-evicts oldest when over MAX_ENTRIES */
  push: (entry: Omit<HistoryEntry, "id" | "ts">) => void;
  /** Restore overrid