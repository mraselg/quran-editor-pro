/**
 * scripts/build-sqlite.cjs
 * ────────────────────────
 * CommonJS script: reads scripts/verses-dump.jsonl and builds electron/data.db
 * using sql.js (pure JavaScript SQLite — no native compilation needed).
 *
 * Tables created:
 *   verses     — id, s (surah), a (ayah), ar (Arabic), bn (romanised),
 *                t_bn (Bangla translation)
 *   pages_meta — reserved for future page layout caching
 *
 * Run AFTER electron:dump-pages:
 *   npm run electron:build-db
 *   → creates electron/data.db
 *
 * Verify:
 *   node scripts/verify-db.cjs
 */

"use strict";

const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

// ── Resolve paths ──────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, "..");
const JSONL_PATH = path.join(__dirname, "verses-dump.jsonl");
const DB_DIR = path.join(ROOT, "electron");
const DB_PATH = path.join(DB_DIR, "data.db");

// ── Guard: JSONL must exist ────────────────────────────────────────────────
if (!fs.existsSync(JSONL_PATH)) {
  console.error(
    "[build-sqlite] ❌ verses-dump.jsonl not found.\n" +
      "               Run: npm run electron:dump-pages  first."
  );
  process.exit(1);
}

// ── Ensure electron/ directory exists ─────────────────────────────────────
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log("[build-sqlite] Created electron/ directory.");
}

// ── Read JSONL ────────────────────────────────────────────────────────────
const lines = fs
  .readFileSync(JSONL_PATH, "utf-8")
  .split("\n")
  .filter((l) => l.trim().length > 0);

console.log(`[build-sqlite] ${lines.length} verses to insert…`);

const parsed = lines.map((line) => {
  const v = JSON.parse(line);
  return {
    id: v.id,
    s: v.s,
    a: v.v ?? v.a ?? 0, // field is 'v' in source (verse number)
    ar: v.ar ?? "",
    bn: v.bn ?? "",
    t_bn: v.t_bn ?? "",
  };
});

// ── Build with sql.js ─────────────────────────────────────────────────────
initSqlJs().then((SQL) => {
  const db = new SQL.Database();

  // Schema
  db.run(`
    CREATE TABLE IF NOT EXISTS verses (
      id    INTEGER PRIMARY KEY,
      s     INTEGER NOT NULL,
      a     INTEGER NOT NULL,
      ar    TEXT    NOT NULL,
      bn    TEXT    NOT NULL DEFAULT '',
      t_bn  TEXT    NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_verses_surah ON verses(s);
    CREATE INDEX IF NOT EXISTS idx_verses_surah_ayah ON verses(s, a);
    CREATE TABLE IF NOT EXISTS pages_meta (
      id   TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `);

  console.log("[build-sqlite] Schema created.");

  // Bulk INSERT using prepared statement
  const stmt = db.prepare(
    "INSERT INTO verses (id, s, a, ar, bn, t_bn) VALUES (?, ?, ?, ?, ?, ?)"
  );

  db.run("BEGIN");
  for (const v of parsed) {
    stmt.run([v.id, v.s, v.a, v.ar, v.bn, v.t_bn]);
  }
  db.run("COMMIT");
  stmt.free();

  // Verify count
  const result = db.exec("SELECT COUNT(*) AS c FROM verses");
  const count = result[0]?.values[0]?.[0] ?? 0;

  // Sample
  const sample = db.exec("SELECT s, a, ar FROM verses WHERE s=1 LIMIT 3");

  // Write binary file
  const binaryArray = db.export();
  const buffer = Buffer.from(binaryArray);
  fs.writeFileSync(DB_PATH, buffer);
  db.close();

  console.log(`[build-sqlite] ✅ Done!`);
  console.log(`[build-sqlite]    Total verses in DB: ${count}`);
  console.log(`[build-sqlite]    DB location: ${DB_PATH}`);
  if (sample[0]) {
    console.log(`[build-sqlite]    Sample (Surah 1, first 3 verses):`);
    sample[0].values.forEach(([s, a, ar]) => {
      console.log(`                   [${s}:${a}] ${String(ar).slice(0, 35)}…`);
    });
  }

  const stats = fs.statSync(DB_PATH);
  console.log(`[build-sqlite]    DB size: ${(stats.size / 1024).toFixed(0)} KB`);
});
