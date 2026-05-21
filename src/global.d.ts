/**
 * src/global.d.ts
 * ───────────────
 * Global TypeScript declarations.
 * Extends the browser Window interface with Electron-injected APIs.
 *
 * This file is automatically picked up by TypeScript (no import needed).
 * It makes window.electronAPI fully typed throughout the codebase.
 */

import type { PageData } from "@/data/pages";
import type { Verse as FlowVerse } from "@/lib/quranLayout";

declare global {
  interface Window {
    /**
     * Injected by electron/preload.cjs via contextBridge.
     * Only available when running inside Electron.
     * Check: typeof window.electronAPI !== 'undefined'
     */
    electronAPI?: {
      /**
       * Fetch all verses or verses for a specific surah.
       * Maps to: SELECT * FROM verses [WHERE s = ?]
       */
      getVerses(surah?: number): Promise<FlowVerse[]>;

      /**
       * Fetch a single page by its string ID (e.g. "vpage-1").
       * Maps to: SELECT data FROM pages_meta WHERE id = ?
       */
      getPage(pageId: string): Promise<PageData | null>;

      /**
       * Fetch pages within a numeric page range (inclusive).
       * Maps to: SELECT data FROM pages_meta WHERE pageNo BETWEEN ? AND ?
       */
      getPageRange(fromPageNo: number, toPageNo: number): Promise<PageData[]>;

      /**
       * Fetch all pages for a given surah.
       * Maps to: SELECT data FROM pages_meta WHERE surah = ?
       */
      getSurahPages(surahNo: number): Promise<PageData[]>;

      /**
       * Get total number of pages in the database.
       * Maps to: SELECT COUNT(*) FROM pages_meta
       */
      getTotalPages(): Promise<number>;
    };
  }
}

export {};
