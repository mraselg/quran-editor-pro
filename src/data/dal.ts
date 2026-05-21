/**
 * Data Access Layer (DAL) — Browser / Electron abstraction
 * ---------------------------------------------------------
 * This interface decouples the application from its data source.
 * Currently (browser): implemented with JSON file imports.
 * Future (Electron):   implemented with SQLite via better-sqlite3 / Prisma.
 *
 * Switching data backends requires only implementing this interface —
 * no changes needed in UI components or stores.
 */

import type { PageData } from "@/data/pages";
import type { Verse as FlowVerse } from "@/lib/quranLayout";

export interface QuranDAL {
  /**
   * Load all verses. May return cached data on subsequent calls.
   * Browser: imports verses.json (~5.6 MB).
   * Electron: queries SQLite `verses` table.
   */
  loadVerses(surah?: number): Promise<FlowVerse[]>;

  /**
   * Get a single page by ID.
   * Browser: filter from in-memory pages array.
   * Electron: SELECT * FROM pages WHERE id = ?
   */
  getPage(pageId: string): Promise<PageData | null>;

  /**
   * Get a range of pages by page numbers (1-indexed).
   * Useful for virtualized loading — only fetch what's visible.
   * Browser: slice from pre-built pages array.
   * Electron: SELECT * FROM pages WHERE page_no BETWEEN ? AND ?
   */
  getPageRange(fromPageNo: number, toPageNo: number): Promise<PageData[]>;

  /**
   * Get all pages for a surah.
   * Browser: filter from pre-built pages array.
   * Electron: SELECT * FROM pages WHERE surah = ?
   */
  getSurahPages(surahNo: number): Promise<PageData[]>;

  /**
   * Total page count.
   */
  getTotalPages(): Promise<number>;
}

/**
 * Browser implementation — uses the existing JSON-based data pipeline.
 * This is the current production implementation.
 */
export class BrowserDAL implements QuranDAL {
  private versesCache: FlowVerse[] | null = null;
  private pagesCache: PageData[] | null = null;

  async loadVerses(surah?: number): Promise<FlowVerse[]> {
    if (!this.versesCache) {
      const { loadAllVerses } = await import("@/data/pages");
      this.versesCache = await loadAllVerses() as unknown as FlowVerse[];
    }
    if (surah !== undefined) {
      return this.versesCache.filter((v) => v.s === surah);
    }
    return this.versesCache;
  }

  async getPage(pageId: string): Promise<PageData | null> {
    const pages = await this.getAllPages();
    return pages.find((p) => p.id === pageId) ?? null;
  }

  async getPageRange(fromPageNo: number, toPageNo: number): Promise<PageData[]> {
    const pages = await this.getAllPages();
    return pages.filter((p) => {
      const no = Number(String(p.footer.pageNo).replace(/[০-৯]/g, (c) =>
        String("০১২৩৪৫৬৭৮৯".indexOf(c))
      ));
      return no >= fromPageNo && no <= toPageNo;
    });
  }

  async getSurahPages(surahNo: number): Promise<PageData[]> {
    const { useReflowStore } = await import("@/state/reflowStore");
    const { pages, distribution } = useReflowStore.getState();
    const surahPageIds = new Set(
      distribution.filter((d) => d.surah === surahNo).map((d) => d.pageId)
    );
    return pages.filter((p) => surahPageIds.has(p.id));
  }

  async getTotalPages(): Promise<number> {
    const pages = await this.getAllPages();
    return pages.length;
  }

  private async getAllPages(): Promise<PageData[]> {
    if (this.pagesCache) return this.pagesCache;
    const { buildAllPages, loadAllVerses } = await import("@/data/pages");
    await loadAllVerses();
    this.pagesCache = buildAllPages();
    return this.pagesCache;
  }
}

/**
 * Runtime DAL selection.
 * - Electron: window.electronAPI is injected by preload.cjs → use ElectronDAL
 * - Browser:  window.electronAPI is undefined → use BrowserDAL
 *
 * Returns BrowserDAL synchronously (always safe).
 * ElectronDAL is lazily loaded via async getElectronDAL() below.
 */
export function pickDAL(): QuranDAL {
  // In Electron, window.electronAPI will be available on first render.
  // We detect it and return a lazy ElectronDAL wrapper.
  if (
    typeof window !== "undefined" &&
    (window as Window).electronAPI !== undefined
  ) {
    return new ElectronDALProxy();
  }
  return new BrowserDAL();
}

/**
 * ElectronDALProxy — lightweight synchronous proxy.
 * Delegates to the real ElectronDAL (loaded via dynamic import) on first call.
 * Falls back to BrowserDAL if electronAPI is unavailable.
 *
 * This avoids require() in ESM and avoids top-level await.
 */
class ElectronDALProxy implements QuranDAL {
  private _impl: QuranDAL | null = null;

  private async impl(): Promise<QuranDAL> {
    if (this._impl) return this._impl;
    try {
      const { ElectronDAL } = await import("./dal.electron");
      this._impl = new ElectronDAL();
      console.log("[DAL] ElectronDAL loaded — using SQLite via IPC");
    } catch {
      this._impl = new BrowserDAL();
      console.warn("[DAL] ElectronDAL failed — falling back to BrowserDAL");
    }
    return this._impl;
  }

  async loadVerses(surah?: number) { return (await this.impl()).loadVerses(surah); }
  async getPage(pageId: string) { return (await this.impl()).getPage(pageId); }
  async getPageRange(f: number, t: number) { return (await this.impl()).getPageRange(f, t); }
  async getSurahPages(s: number) { return (await this.impl()).getSurahPages(s); }
  async getTotalPages() { return (await this.impl()).getTotalPages(); }
}

/**
 * Singleton DAL instance — auto-selects backend at runtime.
 *
 * Usage:
 *   import { dal } from "@/data/dal";
 *   const verses = await dal.loadVerses(2);  // works in both browser & Electron
 */
export const dal: QuranDAL = (() => {
  try {
    return pickDAL();
  } catch {
    // Fallback to BrowserDAL if pickDAL fails (e.g. during SSR)
    return new BrowserDAL();
  }
})();
