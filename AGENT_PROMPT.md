╔══════════════════════════════════════════════════════════════════════════════╗
║        Studio Al-Qalam — AI Agent Handoff Prompt (v2.0)                    ║
║        For: Lovable / Cursor / Windsurf / Any Vibe Coding Agent            ║
╚══════════════════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT TO TELL THE NEW AGENT (paste this in full):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are working on "Studio Al-Qalam" — a professional Quranic Desktop 
Publishing (DTP) editor. The full codebase is in this repository. 
Read CODEBASE_OVERVIEW.md first — it has the complete architecture, 
state system, data flow, and known bugs.

GITHUB: https://github.com/ohidgazi00003-gif/QuranMakerV3
APP: http://localhost:8080/ (run `npm run dev` to start)
STACK: TanStack Start + React 19 + Zustand + Tailwind CSS v4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIORITY TASKS (do in this exact order):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

═══════════════════════════════════════
TASK 1 — Fix TypeScript Error (PageList.tsx)
═══════════════════════════════════════
FILE: src/components/studio/PageList.tsx
PROBLEM: Line 3-4 imports `List`, `useListRef`, `ListImperativeAPI`, 
         `RowComponentProps` from "react-window" but these names may not 
         exist in the installed react-window@2.2.7.
FIX:
  1. Check: node_modules/react-window/types/index.d.ts
  2. Replace imports with what's actually exported
  3. If `RowComponentProps` doesn't exist, define inline:
     type RowComponentProps<T> = { index: number; style: React.CSSProperties; data: T }
  4. Run: npx tsc --noEmit → must show zero errors
ALSO: Add "skipLibCheck": true to tsconfig.json as a quick safety net.

═══════════════════════════════════════  
TASK 2 — Fix PNG Export (Real Implementation)
═══════════════════════════════════════
FILE: src/components/studio/TopBar.tsx
PROBLEM: handleExportPNG() only shows a toast. Users expect a real PNG download.
FIX:
  1. Install: npm install html2canvas
  2. In handleExportPNG():
     a. Find the active artboard: document.querySelector('[data-page-visible="true"]')
     b. Call: const canvas = await html2canvas(artboardEl, { scale: 2, useCORS: true })
     c. Trigger download: canvas.toBlob(blob => { saveAs(blob, `quran-page-${pageNo}.png`) })
     d. Show progress toast while capturing
  3. If html2canvas doesn't work with the SVG background, use dom-to-image-more instead

═══════════════════════════════════════
TASK 3 — Add data-page-visible Attribute
═══════════════════════════════════════
FILE: src/components/studio/Workspace.tsx
PROBLEM: 3-page virtualization keeps prev/active/next in DOM. Tests/code 
         can't tell which is the visible one.
FIX: In the 3-page map (around line 465), add to each wrapper div:
     data-page-visible={String(visible)}   // "true" or "false"
     Also add data-page-id={p.id}

FILE: src/components/studio/Artboard.tsx  
PROBLEM: The outermost artboard div doesn't have data-page-id
FIX: Add data-page-id={page.id} to the root div of the Artboard component

═══════════════════════════════════════
TASK 4 — Fix Playwright Tests
═══════════════════════════════════════
FILES: tests/editor-flow.spec.ts, tests/live-ui.spec.ts

CRITICAL: Page IDs are "vpage-1", "vpage-2" ... NOT "p1", "p2".
          Fix ALL selectors that use data-page-id="p1" → data-page-id="vpage-1"

FIX tests/editor-flow.spec.ts:
  1. Change timeout to 90000 (cold start takes 45+ seconds)
  2. Wait selector: page.locator('div[data-page-id^="vpage-"]')
                    .waitFor({ state: 'visible', timeout: 90000 })
  3. Arabic layer selector: '[data-page-id="vpage-1"][data-row-index="3"] [data-layer-kind="arabic"]'
  4. After "এডিটর" tab click, wait 2000ms for mode transition

FIX tests/live-ui.spec.ts:
  1. In beforeEach: change timeout to 90000
  2. Wait for 'div[data-page-id^="vpage-"]' instead of 'text=লোড হচ্ছে…'

═══════════════════════════════════════
TASK 5 — Wire Quick Publish Button
═══════════════════════════════════════
FILE: src/components/studio/TopBar.tsx
PROBLEM: The ⚡ Zap button (id="btn-quick-publish") has no click handler.
FIX: Add onClick that opens a simple publish modal:
  - Modal title: "কুরআন প্রকাশ করুন"
  - Options: "বর্তমান পেজ", "এই সূরা", "সম্পূর্ণ কুরআন"
  - Action: Calls window.print() after user selects range
  - Style: Match the existing dark theme

═══════════════════════════════════════
TASK 6 — Performance: verses.json Lazy Load
═══════════════════════════════════════
FILE: src/state/reflowStore.ts
PROBLEM: On boot, all 5.6 MB of verses.json loads before any pages show.
FIX:
  1. In init(), first load ONLY surah 1 (Al-Fatiha) using dal.loadVerses(1)
  2. Build only the first ~10 pages immediately → show to user fast
  3. Then load remaining surahs 2–9 in requestIdleCallback chunks
  4. Show progress: "সূরা ১ লোড হয়েছে... ২/৯..."
  This reduces first-visible-content from ~45s to ~3s

═══════════════════════════════════════
TASK 7 — Improve History Restore Performance
═══════════════════════════════════════
FILE: src/state/historyStore.ts
PROBLEM: restoreToImpl() does O(N) replay — resets all state and replays 
         from entry 0 to target. With 200 entries this is slow.
FIX: Add checkpoint snapshots every 20 entries:
  1. After push(), if entries.length % 20 === 0, save a full overrides snapshot
  2. In restoreToImpl(), find the nearest checkpoint before target
  3. Restore from checkpoint instead of from scratch
  4. Then replay only from checkpoint → target (max 20 patches)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUTURE FEATURES (Phase 3 — implement after all tasks above are done)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ ] SQLite Migration (for Electron desktop version)
    - Install better-sqlite3 as optional dependency
    - Create ElectronDAL class in src/data/dal.ts implementing QuranDAL
    - Move verses.json (5.6 MB) → SQLite 'verses' table
    - Move pages.json → SQLite 'pages' table
    - Use LIMIT/OFFSET for lazy page loading

[ ] Custom Tajweed Icon Font
    - Replace SVG tajweed symbols with a .woff2 font file
    - Use Glyphr Studio or IcoMoon to create tajweed-symbols.woff2
    - Update src/tajweed/ rendering to use font characters

[ ] Mobile Edit Mode
    - The mobile layout (isMobile branch in Workspace.tsx) only shows preview
    - Add a simplified edit mode for mobile: bottom sheet with basic controls
    - Font size sliders + row selection via tap

[ ] Surah Navigation Sidebar Improvement
    - Current: scrollable list of all 600+ page thumbnails (virtualized)
    - Improvement: Group by surah with collapsible sections
    - Add search by surah name in Arabic/Bengali

[ ] Per-Word Typography
    - Current: overrides apply to entire row (Arabic layer)
    - Future: click individual word → adjust its font size/position independently
    - Key: word:{surah}:{ayah}:{wordIndex} already exists in LocalKey types

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY FILES QUICK REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  src/components/studio/Workspace.tsx     ← Root layout, 3-page virtualization
  src/components/studio/TopBar.tsx        ← Header: mode toggle, PNG, PDF, Quick Publish
  src/components/studio/CanvasToolbar.tsx ← Zoom, tools, undo/redo, history popup
  src/components/studio/Artboard.tsx      ← One page renderer (SVG coordinate system)
  src/components/studio/FabricLines.tsx   ← 9 row renderer (selection, contenteditable)
  src/components/studio/Inspector.tsx     ← Right panel (tabs: template/font/export/editor)
  src/components/studio/PropertiesPanel.tsx ← Font sliders + history timeline
  src/components/studio/PageList.tsx      ← Left sidebar: virtualized list (react-window)
  src/state/editorStore.ts               ← UI state (editMode, selection, tool)
  src/state/overridesStore.ts            ← Typography overrides (persisted)
  src/state/reflowStore.ts               ← Page data + rebuild engine
  src/state/historyStore.ts              ← Change log (diff/patch, persisted)
  src/data/pages.ts                      ← buildAllPages() + loadAllVerses()
  src/data/dal.ts                        ← Data Access Layer (QuranDAL interface)
  src/lib/canvasMeasure.ts               ← OffscreenCanvas text measurement
  src/lib/quranLayout.ts                 ← Arabic/Bangla line-packing algorithm
  src/lib/textReflow.ts                  ← Cascading text reflow engine

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STATE KEY NAMING CONVENTIONS (critical for overrides to work correctly)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  row:{pageId}:{rowIndex}                    "row:vpage-3:5"
  layer:{pageId}:{rowIndex}:{kind}           "layer:vpage-3:5:arabic"
  word:{surah}:{ayah}:{wordIndex}            "word:2:1:3"
  symbol:{surah}:{ayah}:{wordIndex}:{char}:{id}

  Page IDs are: "vpage-1" through "vpage-604" (NOT "p1", "p2")
  
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICATION AFTER EACH TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After Task 1 (TypeScript):
  npx tsc --noEmit  →  must show 0 errors

After Tasks 2-5 (features + Playwright):
  npm run dev        →  app loads at localhost:8080
  npx playwright test  →  all tests pass

Full checklist:
  [ ] App loads in < 5 seconds (after lazy loading fix)
  [ ] 600+ pages render in left sidebar with smooth scrolling
  [ ] Click "এডিটর" tab → edit mode activates
  [ ] Click any row → Properties panel shows controls
  [ ] Drag Arabic font size slider → page reflows instantly
  [ ] Ctrl+Z undoes the change
  [ ] History panel shows "আরবি ফন্ট সাইজ: ৫০ → ৫৫" in Bengali
  [ ] "পুনরুদ্ধার" button restores to old value
  [ ] PDF export button opens browser print dialog
  [ ] PNG export downloads a PNG file of the current page
  [ ] ⚡ Quick Publish button opens a publish modal
  [ ] All Playwright tests pass (0 failures)
