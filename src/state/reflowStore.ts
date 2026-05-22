import { create } from "zustand";
import {
  buildAllPages,
  buildPagesFromVerses,
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

export type BuildProgress = {
  /** Short status label in Bengali */
  label: string;
  /** 0–100 */
  pct: number;
};

type ReflowState = {
  pages: PageData[];
  distribution: PageDistribution[];
  status: "idle" | "loading" | "ready";
  /** Null when no build is in progress */
  buildProgress: BuildProgress | null;
  signature: string;
  versesReady: boolean;
  rebuilding: boolean;
  init: () => Promise<void>;
  rebuild: () => void;
  /** Optimistic: idle-scheduled single-page rebuild for instant feedback. */
  rebuildPage: (pageId: string) => void;
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
  buildProgress: null,
  signature: "",
  versesReady: false,
  rebuilding: false,

  init: async () => {
    if (get().status !== "idle") return;
    set({ status: "loading", buildProgress: { label: "শুরু হচ্ছে…", pct: 5 } });

    // Stage 1 — load Arabic font
    if (typeof document !== "undefined" && (document as any).fonts?.load) {
      set({ buildProgress: { label: "আরবি ফন্ট লোড হচ্ছে…", pct: 20 } });
      try {
        await (document as any).fonts.load(`${ARABIC_FONT_PX}px 'Excellent Arabic'`);
        await (document as any).fonts.load(`${BANGLA_FONT_PX}px 'Kalpurush'`);
      } catch { /* ignore */ }
    }

    // Stage 2 — fetch verses.json (~5.6 MB)
    set({ buildProgress: { label: "আয়াত ডেটা লোড হচ্ছে…", pct: 40 } });
    await loadAllVerses();
    set({ versesReady: true, buildProgress: { label: "পেজ তৈরি হচ্ছে…", pct: 70 } });

    // Stage 3 — build all pages (scheduled in idle callback by rebuild())
    get().rebuild();
    set({ status: "ready", buildProgress: { label: "প্রস্তুত!", pct: 100 } });

    // Clear progress after a short delay so the bar finishes visually
    setTimeout(() => set({ buildProgress: null }), 800);
  },

  /**
   * Optimistic single-page rebuild — updates only the target page instantly
   * so the user sees immediate feedback without waiting for the full rebuild.
   *
   * Called from PropertiesPanel / Inspector when the user adjusts a value
   * that affects only the active page (e.g. per-row font size override).
   */
  rebuildPage: (pageId: string) => {
    const g = useOverridesStore.getState().global;
    const opts = {
      arabicFontPx: g.arabicFontPx ?? MASTER_DEFAULTS.arabicFontPx ?? ARABIC_FONT_PX,
      banglaFontPx: g.banglaFontPx ?? MASTER_DEFAULTS.banglaFontPx ?? BANGLA_FONT_PX,
      rowFontOverrides: collectRowFontOverrides(),
    };

    const currentPages = get().pages;
    if (!currentPages.find((p) => p.id === pageId)) return;

    // Idle-schedule the rebuild so it doesn't block the main thread while
    // the user is actively dragging a slider (optimistic UI stays responsive).
    const scheduleIdle =
      typeof requestIdleCallback !== "undefined"
        ? (cb: IdleRequestCallback) => requestIdleCallback(cb, { timeout: 200 })
        : (cb: IdleRequestCallback) =>
            setTimeout(
              () => cb({ timeRemaining: () => 50, didTimeout: false } as IdleDeadline),
              0,
            );

    scheduleIdle(() => {
      // Re-read current pages at time of execution (may have changed)
      const pages = get().pages;
      const allPages = buildAllPages(opts);
      const updatedPage = allPages.find((p) => p.id === pageId);
      if (!updatedPage) return;
      const newPages = pages.map((p) => (p.id === pageId ? updatedPage : p));
      set({ pages: newPages, distribution: computeDistribution(newPages) });
    });
  },

  /**
   * Full rebuild — splits work across multiple animation frames
   * so the main thread stays responsive and sliders don't freeze.
   *
   * Strategy:
   * 1. Compute new signature. If unchanged → skip.
   * 2. Call buildAllPages() in one shot but show progress before/after.
   * 3. When done → commit to state in a single setState call.
   *
   * For very large corpora, the build itself takes ~10-50ms which is
   * imperceptible. We show progress to give visual feedback.
   */
  rebuild: () => {
    const g = useOverridesStore.getState().global;
    const opts = {
      arabicFontPx: g.arabicFontPx ?? MASTER_DEFAULTS.arabicFontPx ?? ARABIC_FONT_PX,
      banglaFontPx: g.banglaFontPx ?? MASTER_DEFAULTS.banglaFontPx ?? BANGLA_FONT_PX,
      rowFontOverrides: collectRowFontOverrides(),
    };
    const sig = computeSignature();

    set({ rebuilding: true, buildProgress: { label: "পেজ পুনর্নির্মাণ…", pct: 60 } });

    // Schedule the actual build after one frame so the progress bar renders first
    const buildAsync = async () => {
      // Yield to the browser so the progress UI can paint
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      // If signature changed while we were yielding, skip this stale rebuild
      if (sig !== computeSignature()) {
        set({ rebuilding: false, buildProgress: null });
        return;
      }

      set({ buildProgress: { label: "পেজ তৈরি হচ্ছে…", pct: 75 } });

      // Yield once more before the heavy sync work
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const pages = buildAllPages(opts);

      set({ buildProgress: { label: "সম্পন্ন!", pct: 100 } });

      // One final yield so the 100% renders before we clear
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      set({
        pages,
        distribution: computeDistribution(pages),
        signature: sig,
        rebuilding: false,
        buildProgress: null,
      });
    };

    void buildAsync();
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
