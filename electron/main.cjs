/**
 * electron/main.cjs
 * ─────────────────
 * Electron main process — BrowserWindow + SQLite IPC handlers.
 *
 * Architecture:
 *   main.cjs (Node.js) ←─ ipcMain.handle ─→ preload.cjs (bridge)
 *                                                   ↓
 *                                         window.electronAPI
 *                                                   ↓
 *                                         React app (renderer)
 *
 * Data flow:
 *   React calls window.electronAPI.getVerses(surah)
 *   → preload sends ipcRenderer.invoke('dal:getVerses', surah)
 *   → main.cjs queries SQLite, returns JSON array
 *   → preload resolves the Promise in renderer
 *
 * Dev mode:
 *   npm run dev         (Terminal 1) — Vite dev server on :5174
 *   npm run electron:dev (Terminal 2) — Electron loads localhost:5174
 *
 * Prod mode:
 *   npm run build       — builds dist/client/
 *   npm run electron:dev — Electron loads dist/client/index.html
 */

"use strict";

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

// ── Database path ──────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, "data.db");
const DEV_URL = "http://localhost:5174";
const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";

// ── Lazy-load sql.js (avoids startup delay) ────────────────────────────────
let _db = null;

function getDb() {
  if (_db) return _db;

  if (!fs.existsSync(DB_PATH)) {
    console.error("[main] ❌ data.db not found at:", DB_PATH);
    console.error("[main]    Run: npm run electron:dump-pages && npm run electron:build-db");
    return null;
  }

  try {
    const initSqlJs = require("sql.js");
    // sql.js is async — but we need sync access in ipcMain handlers.
    // Solution: load synchronously via require, then init synchronously.
    // For the build script, sql.js must already be loaded.
    // We use a synchronous wrapper pattern here:
    const fileBuffer = fs.readFileSync(DB_PATH);

    // Synchronous init using sql.js WASM file bundled in node_modules
    const sqlWasmPath = path.join(
      __dirname,
      "../node_modules/sql.js/dist/sql-wasm.wasm"
    );

    let SQL;
    // We use synchronous approach: pre-load wasm binary
    const wasmBinary = fs.existsSync(sqlWasmPath)
      ? fs.readFileSync(sqlWasmPath)
      : undefined;

    // initSqlJs returns a Promise — we need sync. Use a workaround:
    // Store the DB asynchronously, guard IPC handlers until ready.
    initSqlJs({ wasmBinary }).then((SQLLib) => {
      _db = new SQLLib.Database(fileBuffer);
      console.log("[main] ✅ SQLite database opened:", DB_PATH);
      const count = _db.exec("SELECT COUNT(*) FROM verses");
      console.log("[main]    Verse count:", count[0]?.values[0]?.[0]);
    });

    return null; // Will be available once Promise resolves
  } catch (e) {
    console.error("[main] ❌ Failed to open database:", e.message);
    return null;
  }
}

// ── IPC Handlers ───────────────────────────────────────────────────────────

/**
 * Helper: runs a sql.js query and returns all rows as objects.
 */
function queryAll(sql, params = []) {
  const db = _db;
  if (!db) return [];
  try {
    const stmt = db.prepare(sql);
    const rows = [];
    stmt.bind(params);
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch (e) {
    console.error("[main] Query error:", e.message);
    return [];
  }
}

/**
 * dal:getVerses — returns all verses or filtered by surah
 * Returns: Array<{ id, s, a, ar, bn, t_bn }>
 * In the React app this maps to FlowVerse: { id, s, v (=a), ar, bn, t_bn }
 */
ipcMain.handle("dal:getVerses", (_event, surah) => {
  if (!_db) return [];
  const rows = surah != null
    ? queryAll("SELECT * FROM verses WHERE s = ? ORDER BY id", [surah])
    : queryAll("SELECT * FROM verses ORDER BY id");
  // Map 'a' → 'v' to match FlowVerse type in the app
  return rows.map((r) => ({ ...r, v: r.a }));
});

/**
 * dal:getPage — returns a single PageData by pageId
 * pages_meta table stores full PageData JSON blobs.
 * If not found in pages_meta, returns null (caller falls back to BrowserDAL).
 */
ipcMain.handle("dal:getPage", (_event, pageId) => {
  if (!_db) return null;
  const rows = queryAll("SELECT data FROM pages_meta WHERE id = ?", [pageId]);
  if (rows.length === 0) return null;
  try {
    return JSON.parse(rows[0].data);
  } catch {
    return null;
  }
});

/**
 * dal:getPageRange — returns pages within a page number range.
 */
ipcMain.handle("dal:getPageRange", (_event, fromPageNo, toPageNo) => {
  if (!_db) return [];
  const rows = queryAll(
    "SELECT data FROM pages_meta WHERE CAST(json_extract(data,'$.footer.pageNo') AS INTEGER) BETWEEN ? AND ?",
    [fromPageNo, toPageNo]
  );
  return rows.map((r) => {
    try { return JSON.parse(r.data); } catch { return null; }
  }).filter(Boolean);
});

/**
 * dal:getSurahPages — returns all pages for a given surah.
 */
ipcMain.handle("dal:getSurahPages", (_event, surahNo) => {
  if (!_db) return [];
  const rows = queryAll(
    "SELECT data FROM pages_meta WHERE json_extract(data,'$.surah') = ?",
    [surahNo]
  );
  return rows.map((r) => {
    try { return JSON.parse(r.data); } catch { return null; }
  }).filter(Boolean);
});

/**
 * dal:getTotalPages — returns total page count.
 */
ipcMain.handle("dal:getTotalPages", () => {
  if (!_db) return 0;
  const result = _db.exec("SELECT COUNT(*) FROM pages_meta");
  return result[0]?.values[0]?.[0] ?? 0;
});

// ── Window creation ────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Studio Al-Qalam",
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed for preload to use require()
    },
  });

  if (isDev) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
    console.log("[main] Dev mode — loading", DEV_URL);
  } else {
    const indexPath = path.join(__dirname, "../dist/client/index.html");
    win.loadFile(indexPath);
    console.log("[main] Prod mode — loading", indexPath);
  }

  win.on("ready-to-show", () => {
    win.show();
  });
}

// ── App lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Start loading the DB (async, sets _db when ready)
  getDb();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
