# Studio Al-Qalam — Complete Codebase Overview
## For New Developer / AI Agent Handoff

> **App:** Professional Quranic Desktop Publishing Editor (DTP)
> **Live URL:** `http://localhost:8080/`
> **GitHub:** `https://github.com/ohidgazi00003-gif/QuranMakerV3`
> **Stack:** TanStack Start + React 19 + Zustand + Tailwind CSS v4 + TypeScript

---

## 1. What This App Does

**Studio Al-Qalam** renders all 604 pages of the full Quran in a high-precision DTP layout. Users can:
- View all pages in a scrollable thumbnail sidebar
- Switch between **Preview Mode** (read-only) and **Editor Mode** (interactive)
- In Editor Mode: click any row/layer to select it, then adjust typography in the right panel
- Change Arabic font size, Bangla translation size, Y-offsets, text alignment, row position (dx/dy)
- Apply changes at 4 scopes: **General** (single element), **Page** (all rows on page), **Surah** (all pages in that surah), **Global** (entire Quran)
- Undo/Redo via Ctrl+Z / Ctrl+Shift+Z (powered by zundo temporal middleware)
- View history of all changes with Bengali labels; click "পুনরুদ্ধার" to time-travel to any state
- Export PDF via browser print dialog (Ctrl+P)
- PNG export button (currently only shows toast — needs real implementation)

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Meta-framework | TanStack Start v1 (file-based routing, SSR capable) |
| UI Framework | React 19 |
| State Management | Zustand v5 + zundo (temporal undo/redo middleware) |
| CSS | Tailwind CSS v4 (@tailwindcss/vite) |
| Icons | lucide-react v0.575 |
| Data | JSON files (verses.json 5.6 MB, pages.json) |
| Text Measurement | OffscreenCanvas API (canvasMeasure.ts) |
| Virtualization | react-window v2 (PageList sidebar) |
| Persistence | Zustand persist middleware → localStorage |
| Testing | Playwright v1.60 |
| Build | Vite v7 (port 8080, strictPort) |
| Package Manager | npm (node at C:\Xammp\nodejs) |

---

## 3. Directory Structure

```
quran-maker-V4/
├── src/
│   ├── assets/                     # Static assets
│   ├── components/
│   │   ├── studio/                 # ← ALL MAIN APP COMPONENTS
│   │   │   ├── Workspace.tsx       # Root layout: left panel + canvas + right panel
│   │   │   ├── TopBar.tsx          # Header bar: branding, mode toggle, export buttons
│   │   │   ├── CanvasToolbar.tsx   # Toolbar: zoom, tools, undo/redo, history popup
│   │   │   ├── Artboard.tsx        # One Quran page renderer (SVG-mapped HTML)
│   │   │   ├── FabricLines.tsx     # 9 row renderer with selection, editing, overrides
│   │   │   ├── Inspector.tsx       # Right panel: tabs (Preview/Editor)
│   │   │   ├── PropertiesPanel.tsx # Editor: font controls + history tab
│   │   │   ├── LayerPanel.tsx      # Editor: layer tree for selected row
│   │   │   ├── PageList.tsx        # Left sidebar: virtualized page list (react-window)
│   │   │   ├── TransformPanel.tsx  # Transform (dx, dy, scale) controls
│   │   │   ├── TopSymbolLayer.tsx  # Tajweed symbol rendering above Arabic text
│   │   │   ├── ArchedHeader.tsx    # Surah opening page arched header
│   │   │   ├── BismillahBox.tsx    # Bismillah block renderer
│   │   │   ├── SurahOpenBlock.tsx  # Full surah opening block
│   │   │   ├── SlimHeader.tsx      # Page header (para/surah info)
│   │   │   ├── SlimFooter.tsx      # Page footer (page no, ayah range)
│   │   │   ├── ResizeDivider.tsx   # Draggable panel resize handle
│   │   │   ├── CanvasToolbar.tsx   # Tool buttons + zoom control
│   │   │   ├── GridLine.tsx        # Individual SVG band guidelines
│   │   │   ├── RulesPanel.tsx      # Tajweed rules reference panel
│   │   │   ├── FontToolbar.tsx     # Font family selector
│   │   │   ├── SelectionPanel.tsx  # Legacy selection info (mostly hidden)
│   │   │   └── WordBlock.tsx       # Single Arabic word+translation unit
│   │   └── ui/                     # shadcn/ui components (radix-ui based)
│   ├── context/
│   │   ├── FontContext.tsx         # Arabic/Bangla font family provider
│   │   ├── BackgroundContext.tsx   # Page background image provider
│   │   └── TajweedRulesContext.tsx # Tajweed rules configuration provider
│   ├── data/
│   │   ├── verses.json             # 5.6 MB — ALL Quran verses (Arabic + Bangla)
│   │   ├── pages.json              # Page layout seeds (surah starts, headers)
│   │   ├── fatiha.json             # Al-Fatiha special data
│   │   ├── pages.ts                # Data types + buildAllPages() + loadAllVerses()
│   │   └── dal.ts                  # Data Access Layer (QuranDAL interface)
│   ├── hooks/                      # Custom React hooks
│   ├── lib/
│   │   ├── canvasMeasure.ts        # OffscreenCanvas text width measurement
│   │   ├── quranLayout.ts          # Arabic/Bangla line-packing algorithm
│   │   ├── textReflow.ts           # Cascading text reflow across rows/pages
│   │   ├── utils.ts                # clsx/tailwind-merge utility
│   │   ├── error-capture.ts        # Error boundary helpers
│   │   └── error-page.ts           # Error page HTML generator
│   ├── routes/
│   │   ├── __root.tsx              # Root route: HTML shell, SEO meta, QueryClient
│   │   ├── index.tsx               # "/" route → renders <Workspace />
│   │   ├── verify.tsx              # "/verify" — Tajweed verification tool
│   │   └── verify-fath.tsx         # "/verify-fath" — Al-Fatiha specific verify
│   ├── state/
│   │   ├── editorStore.ts          # UI state: editMode, selection, tool, guides
│   │   ├── overridesStore.ts       # Typography overrides (global + per-row/layer)
│   │   ├── reflowStore.ts          # Page data + reflow trigger + loading state
│   │   └── historyStore.ts         # Change history (diff/patch based, 200 entries)
│   ├── tajweed/                    # Tajweed symbol measurement and rendering
│   ├── verify/                     # Tajweed verification components
│   ├── styles.css                  # Global CSS (Tailwind v4 + custom vars)
│   ├── router.tsx                  # TanStack Router setup
│   ├── routeTree.gen.ts            # Auto-generated route tree
│   ├── server.ts                   # SSR server entry
│   └── start.ts                    # App entry point
├── public/
│   └── templates/                  # SVG page templates
├── tests/
│   ├── live-ui.spec.ts             # Playwright: panel toggle, history, reset
│   └── editor-flow.spec.ts         # Playwright: edit mode, text edit, font size
├── package.json                    # Scripts + dependencies
├── vite.config.ts                  # Vite: port 8080, TanStack Start
├── playwright.config.ts            # Playwright: chromium, 60s timeout
├── tsconfig.json                   # TypeScript config
└── CODEBASE_OVERVIEW.md            # ← THIS FILE
```

---

## 4. State Architecture

### 4.1 editorStore (`src/state/editorStore.ts`)
Controls **UI interaction state**. Does NOT persist to localStorage.

```typescript
{
  editMode: boolean           // false = Preview, true = Editor
  activeTool: "select" | "type"
  scope: "general" | "page" | "surah" | "global"
  selection: Selection | null // {kind, key, pageId, rowIndex, layerKind?}
  hover: Selection | null
  showGuides: boolean
  snapToGrid: boolean
  layerPanelOpen: boolean
  navigateToPageId: string | null  // for history time-travel navigation
  focusedRowKey: string | null     // flashes the row for 1.2s after nav
}
```

### 4.2 overridesStore (`src/state/overridesStore.ts`)
Controls **typography overrides**. Persists to `localStorage["studio-overrides-v4"]`.

Has **two layers** of overrides:
- `global: GlobalOverrides` — Affects all pages unless overridden locally
  - `arabicFontPx` (default: 50)
  - `banglaFontPx` (default: 18)
  - `arabicYOffset`, `banglaYOffset`, `symbolYOffset` (deltas, default: 0)
  - `rowSpacing`, `symbolScale`
- `local: Record<LocalKey, LocalOverride>` — Per-element overrides

**Key naming convention:**
```
row:{pageId}:{rowIndex}        → e.g. "row:vpage-3:5"
layer:{pageId}:{rowIndex}:{kind}  → e.g. "layer:vpage-3:5:arabic"
word:{surah}:{ayah}:{wordIndex}   → e.g. "word:2:1:3"
symbol:{surah}:{ayah}:{wordIndex}:{charOffset}:{symbolId}
```

**Temporal undo:** Wrapped with `zundo` temporal middleware — supports `undo()`/`redo()` on the `overridesStore.temporal` interface.

**Scope fan-out:** `patchScoped(key, patch, scope)` async function applies a patch to one or many keys depending on scope.

### 4.3 reflowStore (`src/state/reflowStore.ts`)
Controls **page data and layout computation**. Does NOT persist.

```typescript
{
  pages: PageData[]           // all built pages
  distribution: PageDistribution[]  // page → surah/verse mapping
  status: "idle" | "loading" | "ready"
  buildProgress: { label: string, pct: number } | null
  versesReady: boolean
  rebuilding: boolean
}
```

**Boot sequence:**
1. `init()` called once on mount
2. Stage 1: Load Arabic + Bangla fonts (20%)
3. Stage 2: Fetch `verses.json` 5.6 MB (40%)
4. Stage 3: `buildAllPages()` → all 600+ pages (70% → 100%)
5. Progress bar hidden after 800ms

**Rebuild debounce:** `overridesStore.subscribe()` → 400ms debounce → `rebuild()` — prevents rebuild during slider dragging.

### 4.4 historyStore (`src/state/historyStore.ts`)
Stores **change history** for the history panel. Persists last 50 entries to `localStorage["studio-history-v3"]`.

**Diff/patch format (v3)** — NOT full snapshots:
```typescript
{
  id: string
  ts: number
  label: string        // English: "arabicFontPx: 50 → 60"
  labelBn: string      // Bengali: "আরবি ফন্ট সাইজ: ৫০ → ৬০"
  scope: SelectionScope
  field: string
  before: unknown
  after: unknown
  patch: { field, layerKey?, before, after }
}
```

**Time-travel:** `restoreTo(id)` replays all patches from start up to target entry.

---

## 5. Page Rendering Pipeline

```
verses.json (5.6 MB raw)
    ↓ loadAllVerses()
Verse[] array (id, s, v, ar, bn, t_bn)
    ↓ buildAllPages() in pages.ts
PageData[] (all 600+ pages)
    ↓ Passed to Workspace → active page selected
Artboard.tsx renders one PageData
    ↓ Maps to 9 row slots using SVG coordinate system
FabricLines.tsx renders 9 FabricRow components
    ↓ Each row: Symbol strip (TopSymbolLayer) + Arabic text + Bangla text
    ↓ Overrides from overridesStore applied as CSS transforms/font-size
Browser renders Arabic text with native RTL shaping + Excellent Arabic font
```

### SVG Coordinate System (Artboard.tsx)
The template SVG has viewBox `420.17 × 630.28`. Scaled to `780px × 1170px` display.
Scale factor: `780 / 420.17 ≈ 1.857`

9 row bands defined in SVG units:
```
Row 0: y=[36.86, 89.81]    Row 1: y=[101.43, 154.38]
Row 2: y=[165.82, 218.77]  Row 3: y=[230.22, 283.16]
Row 4: y=[294.63, 347.58]  Row 5: y=[359.01, 411.96]
Row 6: y=[423.54, 476.49]  Row 7: y=[487.83, 540.77]
Row 8: y=[552.30, 622.95]
```

Each band is split: **Symbol strip (28%)** top + **Arabic area (48%)** middle + **Bangla area (24%)** bottom.

---

## 6. Text Measurement (Performance Critical)

**Old approach (replaced):** `HTMLSpanElement.offsetWidth` → causes layout thrashing.

**Current approach:** `OffscreenCanvas.measureText()` via `src/lib/canvasMeasure.ts`
- ~1000x faster (no DOM reads)
- Works in both browser and web workers
- Falls back to rough estimate in SSR
- Used by: `quranLayout.ts`, `textReflow.ts`

---

## 7. Line Packing Algorithm (`quranLayout.ts`)

Arabic and Bangla are packed as **independent streams** then zipped:

```
Arabic packing (RTL):
  Tokenize each verse word-by-word
  Measure cumulative width with OffscreenCanvas
  When width > maxWidth → flush line, start new

Bangla packing (LTR):
  Same algorithm, different font/size

Zip: line[i] = { arabicLine: ar[i], banglaLine: bn[i] }
```

Special handling: Arabic digit runs are **reversed** (`reverseArabicDigits()`) so ayah numbers render correctly in RTL context.

---

## 8. Key Components — Behavior Details

### Workspace.tsx
- **3-page virtualization:** Only prev/active/next pages are in DOM. Hidden pages use `visibility: hidden; pointer-events: none`.
- **Panel resize:** Left (160–420px) and Right (240–500px) panels have draggable `ResizeDivider`.
- **Keyboard shortcuts:** `E` = edit mode, `V` = select tool, `T` = type tool, `G` = guides, `L` = layer panel, `[`/`]` = zoom, `F` = fit, Space+drag = pan.

### FabricLines.tsx / FabricRow
- Every row has `data-sel-key`, `data-page-id`, `data-row-index` attributes
- Arabic layer: `data-layer-kind="arabic"`, `contenteditable="true"` when selected with Type tool
- Bangla layer: `data-layer-kind="bangla"`, similarly editable
- Symbol layer: `data-layer-kind="symbol"`, shows tajweed symbols above Arabic

### PropertiesPanel.tsx
- **DSlider:** Global font size slider — while dragging, shows local state; on release, calls `setGlobal(k, v)` which triggers debounced rebuild
- **HistoryTab:** Lists all history entries in reverse, "পুনরুদ্ধার" button calls `restoreTo(id)`
- **CharacterPanel:** Shows when Type Tool + layer selected — per-layer leading, tracking, alignment controls

### CanvasToolbar.tsx
- **History popup:** Portal-rendered dropdown showing recent 5 history entries with undo button
- **Scope selector:** Pill buttons for general/page/surah/global scopes
- **Rebuilding indicator:** Shows animated spinner when reflow is in progress

---

## 9. Data Flow — User Edits a Font Size

```
User drags "আরবি ফন্ট সাইজ" slider in PropertiesPanel
    ↓ DSlider: setDragging(value)  [local UI state — no store update during drag]
    ↓ On change: setGlobal("arabicFontPx", value)
overridesStore.setGlobal() called
    → Zustand updates global.arabicFontPx
    → zundo records snapshot for undo
    → captureHistory() called via queueMicrotask
historyStore.push(entry)  [labelBn: "আরবি ফন্ট সাইজ: ৫০ → ৫৫"]
overridesStore.subscribe() fires
    → 400ms debounce timer reset
[400ms later, if user stopped dragging]
reflowStore.rebuild() called
    → buildAllPages({arabicFontPx: 55, ...})
    → new PageData[] computed
    → Zustand state updated → React re-renders
Artboard re-renders with new font size
```

---

## 10. Known Bugs & Incomplete Features

### 🔴 Critical
1. **PNG Export broken** — `TopBar.tsx` PNG button only shows a toast, no actual export
2. **Quick Publish (⚡) button** — No handler at all

### 🟠 Important
3. **TypeScript error in PageList.tsx** — `RowComponentProps` / `ListImperativeAPI` / `useListRef` — these names from react-window v2 may not match. Check `node_modules/react-window/types/index.d.ts`.
4. **Playwright tests fail on `div[data-page-id="p1"]`** — The first page's ID is NOT `"p1"`, it's `"vpage-1"` (generated in pages.ts). Fix: use `div[data-page-id="vpage-1"]` or `div[data-page-id^="vpage-"]`

### 🟡 Minor
5. **Mobile edit mode missing** — Mobile layout (`isMobile` branch in Workspace) only shows preview
6. **`patchScoped()` is async** — Some callers use `void patchScoped(...)` which is fine, but make sure no callers accidentally block on it without await
7. **History restore is O(N)** — `restoreToImpl()` resets all and replays from beginning each time

---

## 11. Page ID System

Pages are identified by IDs like `"vpage-1"`, `"vpage-2"`, ..., `"vpage-604"`.
The first 4 pages of Al-Fatiha use the fatiha.json seed.
Surah opening pages have `type: "surah-open"`.
Continuous pages have `type: "continuous"`.

The `distribution` array in reflowStore maps `pageId → { surah, firstVerse, lastVerse, rowCount }`.

---

## 12. Next Planned Features (Not Yet Built)

From `CONTINUE_PROMPT.txt`:

1. **SQLite Migration (Electron)** — Move verses.json + pages.json to SQLite `better-sqlite3`
2. **Custom Tajweed Icon Font (.woff2)** — Replace SVG tajweed symbols with font glyphs
3. **Chunked Page Building** — If buildAllPages() is still slow, process in 50-page chunks
4. **Lazy Loading** — Load only current surah verses on boot, rest in idle time
5. **Real PNG Export** — Use `html2canvas` to capture the artboard DOM as PNG
6. **Quick Publish Modal** — Page range selector + bulk PDF export

---

## 13. Running Locally

```bash
# Node MUST be from C:\Xammp\nodejs (PowerShell scripts are blocked)
$env:PATH = "C:\Xammp\nodejs;" + $env:PATH

# Install dependencies
& "C:\Xammp\nodejs\npm.cmd" install

# Start dev server (port 8080)
& "C:\Xammp\nodejs\npm.cmd" run dev

# Run Playwright tests
& "C:\Xammp\nodejs\npx.cmd" playwright test

# TypeScript check
& "C:\Xammp\nodejs\npx.cmd" tsc --noEmit
```

**App URL:** `http://localhost:8080/`

---

## 14. Important Constants

```typescript
// FabricLines.tsx
ARABIC_FONT_PX = 40     // default Arabic font size (base)
BANGLA_FONT_PX = 18     // default Bangla font size
SYMBOL_FONT_PX = 28     // default symbol/tajweed font size
BASE_ARABIC_Y = -15     // baked baseline Y offset for Arabic
BASE_BANGLA_Y = 2       // baked baseline Y offset for Bangla
BASE_SYMBOL_Y = -2      // baked baseline Y offset for symbols

// overridesStore.ts
MASTER_DEFAULTS.arabicFontPx = 50   // master template Arabic size
MASTER_DEFAULTS.banglaFontPx = 18   // master template Bangla size

// Artboard.tsx
VB_W = 420.17           // SVG viewBox width (units)
VB_H = 630.28           // SVG viewBox height (units)
DISPLAY_W = 780         // Rendered page width (px)
SCALE = 1.857           // VB → display scale factor
```

---

## 15. Font System

- **Arabic font:** `Excellent Arabic` — loaded at boot via `document.fonts.load()`
- **Bangla font:** `Kalpurush` — loaded at boot via `document.fonts.load()`
- **UI font:** `Hind Siliguri` — loaded from Google Fonts (in `__root.tsx`)
- Fonts are provided via `FontContext.tsx` → `activeFamily` string passed down

---

## 16. LocalStorage Keys

| Key | Contents |
|-----|---------|
| `studio-overrides-v4` | `{ global: GlobalOverrides, local: Record<LocalKey, LocalOverride> }` |
| `studio-history-v3` | `{ entries: HistoryEntry[] }` (last 50) |

---

## 17. Playwright Test Selectors (Correct Values)

```typescript
// ✅ CORRECT — page IDs are "vpage-N" not "p1"
page.locator('div[data-page-id="vpage-1"]')

// ✅ CORRECT — visible page only (3-page virtualization)  
page.locator('div[data-page-id][data-page-visible="true"]')

// ✅ CORRECT — row selector
page.locator('[data-page-id="vpage-1"][data-row-index="3"]')

// ✅ CORRECT — Arabic layer within row
page.locator('[data-page-id="vpage-1"][data-row-index="3"] [data-layer-kind="arabic"]')

// ✅ CORRECT — wait for load (up to 90 seconds for cold start)
await page.locator('div[data-page-id^="vpage-"]').waitFor({ state: 'visible', timeout: 90000 });

// ✅ CORRECT — editor mode button
page.locator('button:has-text("এডিটর")')

// ✅ CORRECT — preview mode button  
page.locator('button:has-text("প্রিভিউ")')

// ✅ CORRECT — history button in CanvasToolbar
page.locator('button[title="পরিবর্তনের ইতিহাস"]')
```
