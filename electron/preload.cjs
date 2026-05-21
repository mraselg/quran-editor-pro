/**
 * electron/preload.cjs
 * ────────────────────
 * Runs in the renderer's isolated context via contextBridge.
 * Exposes window.electronAPI — a safe, typed IPC bridge between
 * the React app and the main process SQLite queries.
 *
 * Security: contextIsolation: true, nodeIntegration: false (in main.cjs).
 * Only these specific methods are exposed — no raw Node.js access.
 */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  /**
   * Load all verses, optionally filtered by surah number.
   * @param {number|undefined} surah
   * @returns {Promise<object[]>}
   */
  getVerses: (surah) => ipcRenderer.invoke("dal:getVerses", surah),

  /**
   * Get a single page by its string ID (e.g. "vpage-1").
   * @param {string} pageId
   * @returns {Promise<object|null>}
   */
  getPage: (pageId) => ipcRenderer.invoke("dal:getPage", pageId),

  /**
   * Get pages within a numeric page range (inclusive).
   * @param {number} fromPageNo
   * @param {number} toPageNo
   * @returns {Promise<object[]>}
   */
  getPageRange: (fromPageNo, toPageNo) =>
    ipcRenderer.invoke("dal:getPageRange", fromPageNo, toPageNo),

  /**
   * Get all pages belonging to a surah.
   * @param {number} surahNo
   * @returns {Promise<object[]>}
   */
  getSurahPages: (surahNo) => ipcRenderer.invoke("dal:getSurahPages", surahNo),

  /**
   * Get total number of pages in the database.
   * @returns {Promise<number>}
   */
  getTotalPages: () => ipcRenderer.invoke("dal:getTotalPages"),
});

console.log("[preload] electronAPI exposed on window ✓");
