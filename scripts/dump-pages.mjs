/**
 * scripts/dump-pages.mjs
 * ─────────────────────
 * ESM script: reads verses.json (ESM-only import) and writes each verse
 * as a JSON line to scripts/verses-dump.jsonl
 *
 * Why a separate script?
 *   build-sqlite.cjs is CommonJS (better-sqlite3 is CJS).
 *   verses.json is a large ESM-only import in the Vite project.
 *   This bridge script converts it to a plain JSONL file that CJS can read.
 *
 * Run:
 *   npm run electron:dump-pages
 *   → creates scripts/verses-dump.jsonl  (6236 lines)
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const versesPath = join(__dirname, "../src/data/verses.json");
const outPath = join(__dirname, "verses-dump.jsonl");

console.log("[dump-pages] Reading verses.json …");
const raw = readFileSync(versesPath, "utf-8");
const verses = JSON.parse(raw);

console.log(`[dump-pages] ${verses.length} verses loaded.`);

const lines = verses.map((v) => JSON.stringify(v)).join("\n");
writeFileSync(outPath, lines, "utf-8");

console.log(`[dump-pages] ✅ Written → ${outPath}`);
console.log(`[dump-pages]    File size: ${(lines.length / 1024).toFixed(1)} KB`);
