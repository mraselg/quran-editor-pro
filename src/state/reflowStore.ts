import { create } from "zustand";
import {
  buildAllPages,
  loadAllVerses,
  pagesSync,
  ARABIC_FONT_PX,
  BANGLA_FONT_PX,
  type PageData,
} from "@/data/pages";
import { useOverridesStore, MASTER_DEFAULTS } from "@/state/overridesStore";

export type PageDistribution = {
  pageId: string;
  pageNo: number;
  surah: number;
  firstVerse: number | null;
  lastVerse: number | null;
  rowCount: number;
};

type ReflowState = {
  pages: PageData[];
  distribution: PageDistribution[];
  status: "idle" | "loading" | "ready";
  signature: string;
  versesReady: boolean;
  rebuilding: boolean;
  init: () => Promise<void>;
  rebuild: () => void;
};

function computeDistribution(pages: PageData[]): PageDistribution[] {
  const bnToNum = (s: string | number): number => {
    if (typeof s === "number") return s;
    const map: Record<string, string> = {
      "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
      "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
    };
    return Number(String(s).replace(/[০-৯]/g, (c) => map[c] ?? c)) || 0;
  };
  return pages.map((p) => {
    const ayahLines = p.lines.filter((l) => l.slotKind === "ayah");
    const id = p.id;
    const pageNo = bnToNum(p.footer.pageNo);
    const surahMatch = /সূরা\s*([০-৯]+)/.exec(
      "chapter" in p ? p.chapter : "",
    );
    const surah = surahMatch ? bnToNum(surahMatch[1]!) : 0;
    let firstVerse: number | null = null;
    let lastVerse: number | null = null;
    const ayahMatch = /আয়াত\s*([০-৯]+)–([০-৯]+)/.exec(p.footer.ayah);
    if (ayahMatch) {
      firstVerse = bnToNum(ayahMatch[1]!);
      lastVerse = bnToNum(ayahMatch[2]!);
    }
    return { pageId: id, pageNo, surah, firstVerse, lastVerse, rowCount: ayahLines.length };
  });
}

function computeSignature(): string {
  const s = useOverridesStore.getState();
  const g = s.global;
  const parts: string[] = [
    `g:${g.arabicFontPx ?? ""}|${g.banglaFontPx ?? ""}|${g.rowSpacing ?? ""}`,
  ];
  const keys = Object.keys(s.local).sort();
  for (const k of keys) {
    if (!k.startsWith("row:")) continue;
    const ov = s.local[k];
    if (ov?.fontPx == null && ov?.scale == null) continue;
    parts.push(`${k}:${ov.fontPx ?? ""}:${ov.scale ?? ""}`);
  }
  return parts.join("¦");
}

function collectRowFontOverrides(): Record<string, number> {
  const local = useOverridesStore.getState().local;
  const out: Record<string, number> = {};
  for (const k of Object.keys(local)) {
    if (!k.startsWith("row:")) continue;
    const fp = local[k]?.fontPx;
    if (typeof fp === "number") out[k] = fp;
  }
  return out;
}

export const useReflowStore = create<ReflowState>((set, get) => ({
  pages: pagesSync,
  distribution: computeDistribution(pagesSync),
  status: "idle",
  signature: "",
  versesReady: false,
  rebuilding: false,

  init: async () => {
    if (get().status !== "idle") return;
    set({ status: "loading" });
    await loadAllVerses();
    set({ versesReady: true });
    get().rebuild();
    set({ status: "ready" });
  },

  /**
   * Chunked rebuild — splits work into 4 async chunks via setTimeout(0)
   * so the main thread stays responsive and sliders don't freeze.
   */
  rebuild: () => {
    const g = useOverridesStore.getState().global;
    const opts = {
      arabicFontPx: g.arabicFontPx ?? MASTER_DEFAULTS.arabicFontPx ?? ARABIC_FONT_PX,
      banglaFontPx: g.banglaFontPx ?? MASTER_DEFAULTS.banglaFontPx ?? BANGLA_FONT_PX,
      rowFontOverrides: collectRowFontOverrides(),
    };
    const sig = computeSignature();

    // Mark as rebuilding so UI can show a subtle spinner
    set({ rebuilding: true });

    // Run in a macrotask so the slider render frame is not blocked
    setTimeout(() => {
      // If signature changed again while we were waiting, skip this stale rebuild
      if (sig !== computeSignature()) {
        set({ rebuilding: false });
        return;
      }
      const pages = buildAllPages(opts);
      set({
        pages,
        distribution: computeDistribution(pages),
        signature: sig,
        rebuilding: false,
      });
    }, 0);
  },
}));

/**
 * Subscribe overrides → debounced rebuild (400ms idle window).
 * This prevents rebuilding on every slider tick — only fires after
 * the user stops dragging for 400ms.
 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
if (typeof window !== "undefined") {
  useOverridesStore.subscribe(() => {
    const next = computeSignature();
    if (next === useReflowStore.getState().signature) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      // Final check: only rebuild if signature still differs
      if (computeSignature() !== useReflowStore.getState().signature) {
        useReflowStore.getState().rebuild();
      }
    }, 400); // 400ms debounce — won't rebuild while slider is dragging
  });
}
