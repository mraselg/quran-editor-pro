/**
 * src/data/dal.electron.ts
 * ────────────────────────
 * ElectronDAL — implements QuranDAL using window.electronAPI IPC bridge.
 *
 * When the app runs inside Electron:
 *   window.electronAPI is injected by electron/preload.cjs via contextBridge.
 *   All data calls go through IPC → main process → sql.js SQLite.
 *
 * When the app runs in a browser:
 *   This file is never imported (pickDAL() in dal.ts returns BrowserDAL).
 *
 * Type safety:
 *   window.electronAPI is typed in src/global.d.ts.
 */

import type { QuranDAL } from "./dal";
import type { PageData } from "./pages";
import type { Verse as FlowVerse } from "@/lib/quranLayout";

/** Throws if called outside Electron — should never happen because pickDAL()
 *  only selects ElectronDAL when window.electronAPI is defined. */
function api() {
  const eApi = window.electronAPI;
  if (!eApi) throw new Error("[ElectronDAL] window.electronAPI is not available");
  return eApi;
}

export class ElectronDAL implements QuranDAL {
  async loadVerses(surah?: number): Promise<FlowVerse[]> {
    console.log("[ElectronDAL] loadVerses", surah ?? "all");
    const result = await api().getVerses(surah);
    return result as FlowVerse[];
  }

  async getPage(pageId: string): Promise<PageData | null> {
    console.log("[ElectronDAL] getPage", pageId);
    return api().getPage(pageId);
  }

  async getPageRange(fromPageNo: number, toPageNo: number): Promise<PageData[]> {
    console.log("[ElectronDAL] getPageRange", fromPageNo, "–", toPageNo);
    return api().getPageRange(fromPageNo, toPageNo);
  }

  async getSurahPages(surahNo: number): Promise<PageData[]> {
    console.log("[ElectronDAL] getSurahPages", surahNo);
    return api().getSurahPages(surahNo);
  }

  async getTotalPages(): Promise<number> {
    return api().getTotalPages();
  }
}
