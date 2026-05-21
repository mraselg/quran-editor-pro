# Studio Al-Qalam — সম্পূর্ণ ইমপ্লিমেন্টেশন গাইড
### (যেকোনো AI বা Developer-এর জন্য — সম্পূর্ণ Context সহ)

> **প্রজেক্ট পাথ:** `C:\Xammp\QuranMakerV3\`  
> **Dev Server:** `http://localhost:5174/`  
> **টেক স্ট্যাক:** TanStack Start + React 19 + Tailwind CSS v4 + Zustand + react-window v2  
> **শেষ TypeScript চেক:** ✅ 0 errors

---

## 📁 প্রজেক্ট আর্কিটেকচার (সম্পূর্ণ মানচিত্র)

```
src/
├── routes/                    ← TanStack Start file-based routing
│   ├── __root.tsx             ← Root layout (SSR entry point)
│   ├── index.tsx              ← "/" → <Workspace /> render করে
│   ├── verify.tsx             ← "/verify" → Al-Baqarah tajweed verify
│   └── verify-fath.tsx        ← "/verify-fath" → Al-Fath tajweed verify
│
├── components/studio/         ← Main editor components
│   ├── Workspace.tsx          ← ROOT component: সব layout একসাথে জোড়া দেয়
│   ├── TopBar.tsx             ← Header: brand, mode toggle, export, shortcuts
│   ├── PageList.tsx           ← Left sidebar: virtualized page list (react-window v2)
│   ├── CanvasToolbar.tsx      ← Toolbar: zoom, undo/redo, history dropdown
│   ├── Artboard.tsx           ← Center: Quran page renderer (HTML/CSS based)
│   ├── Inspector.tsx          ← Right panel: tabs (template/background/font/export)
│   ├── PropertiesPanel.tsx    ← Edit mode: per-row/per-layer property sliders
│   ├── LayerPanel.tsx         ← Edit mode: layer visibility control
│   ├── FabricLines.tsx        ← Each row renderer (Arabic + Bangla + Symbols)
│   ├── TopSymbolLayer.tsx     ← Tajweed symbols overlay (SVG-based)
│   ├── GridLine.tsx           ← Slot guide overlay
│   ├── BismillahBox.tsx       ← Bismillah header component
│   ├── SlimHeader.tsx         ← Page header (surah name, para info)
│   ├── SlimFooter.tsx         ← Page footer (page no, surah, ayah)
│   └── SurahOpenBlock.tsx     ← Surah opening block component
│
├── state/                     ← Zustand stores
│   ├── reflowStore.ts         ← Page building + progress tracking
│   ├── overridesStore.ts      ← Font/position overrides (global + local)
│   ├── historyStore.ts        ← Diff/patch-based undo history
│   └── editorStore.ts         ← UI state (editMode, selection, zoom, etc.)
│
├── data/                      ← Data layer
│   ├── pages.ts               ← Page builder functions + exports
│   ├── pages.json             ← Pre-built static pages data
│   ├── verses.json            ← Full Quran verses (~5.6MB, lazy loaded)
│   ├── fatiha.json            ← Fatiha verses only (fast first paint)
│   └── dal.ts                 ← Data Access Layer interface (BrowserDAL)
│
├── lib/                       ← Core algorithms
│   ├── quranLayout.ts         ← packVerses(): Arabic text line-breaking
│   ├── textReflow.ts          ← Text width measurement coordinator
│   └── canvasMeasure.ts       ← OffscreenCanvas text measurement (SSR-safe)
│
├── tajweed/                   ← Tajweed rule system
│   ├── svgMap.ts              ← 12 SVG tajweed symbol imports + names
│   ├── rules.ts               ← Rule application logic
│   ├── measure.ts             ← Character position measurement
│   └── canvasMeasure.ts       ← Canvas-based char center measurement
│
├── context/                   ← React contexts
│   ├── FontContext.tsx         ← Arabic font loading + switching
│   ├── BackgroundContext.tsx   ← Page background images
│   └── TajweedRulesContext.tsx ← Active tajweed rules state
│
└── assets/tajweed/            ← 12 SVG tajweed symbol files
    ├── 1.svg … 12.svg
```

---

## 🔑 গুরুত্বপূর্ণ Pattern এবং Convention

### Pattern 1: Zustand Store Structure
```typescript
// সব store এই pattern অনুসরণ করে:
import { create } from "zustand";

type MyState = {
  value: string;
  setValue: (v: string) => void;
};

export const useMyStore = create<MyState>((set, get) => ({
  value: "",
  setValue: (v) => set({ value: v }),
}));

// Component-এ ব্যবহার:
const value = useMyStore((s) => s.value); // ← শুধু needed slice subscribe করো
```

### Pattern 2: SSR-Safe Code
```typescript
// SSR (server-side rendering) এ browser globals নেই!
// সবসময় guard দাও:
const _isSSR = typeof document === "undefined";
if (!_isSSR) {
  // browser-only code here
}

// অথবা useEffect এ:
useEffect(() => {
  // এখানে সব browser code — client-only
}, []);
```

### Pattern 3: react-window v2 List (PageList.tsx এ ব্যবহৃত)
```typescript
// react-window v2 API (v1 থেকে সম্পূর্ণ আলাদা!)
import { List, useListRef } from "react-window";
import type { RowComponentProps } from "react-window";

// RowComponent-এ RowProps সরাসরি spread হয়:
function MyRow({ index, style, myData }: RowComponentProps<{ myData: string }>) {
  return <div style={style}>{myData} — row {index}</div>;
}

// List render:
const listRef = useListRef(null); // ← null দিতে হবে (React 19)
<List
  listRef={listRef}
  defaultHeight={500}
  rowCount={items.length}
  rowHeight={52}
  rowComponent={MyRow}
  rowProps={{ myData: "hello" }} // ← itemData-এর বদলে rowProps
/>

// Scroll to item:
listRef.current?.scrollToRow({ index: 5, align: "smart" });
```

### Pattern 4: Idle Callback (Performance)
```typescript
// Main thread block না করে background-এ কাজ করার pattern:
const scheduleIdle = typeof requestIdleCallback !== "undefined"
  ? (cb: IdleRequestCallback) => requestIdleCallback(cb, { timeout: 500 })
  : (cb: IdleRequestCallback) => setTimeout(
      () => cb({ timeRemaining: () => 50, didTimeout: false } as IdleDeadline), 0
    );

scheduleIdle(() => {
  // ভারী কাজ এখানে — main thread block হবে না
  const result = heavyComputation();
  set({ result });
});
```

---

## ✅ সম্পন্ন কাজের বিস্তারিত (Phase 1-3)

### ✅ Phase 1.1: reflowStore.ts — BuildProgress

**ফাইল:** `src/state/reflowStore.ts`

**কী যোগ করা হয়েছে:**
```typescript
// নতুন type:
export type BuildProgress = {
  label: string;  // বাংলায় status message
  pct: number;    // 0 থেকে 100
};

// Store state-এ:
type ReflowState = {
  // ... বাকি fields
  buildProgress: BuildProgress | null;  // null = build চলছে না
  // ...
};

// init() function এ progress update করা হয়:
init: async () => {
  if (get().status !== "idle") return;
  set({ status: "loading", buildProgress: { label: "শুরু হচ্ছে…", pct: 5 } });

  // Font load
  set({ buildProgress: { label: "আরবি ফন্ট লোড হচ্ছে…", pct: 20 } });
  await fonts.load(...);

  // Verses fetch
  set({ buildProgress: { label: "আয়াত ডেটা লোড হচ্ছে…", pct: 40 } });
  await loadAllVerses();

  set({ buildProgress: { label: "পেজ তৈরি হচ্ছে…", pct: 70 } });
  get().rebuild(); // idle-scheduled, async

  set({ status: "ready", buildProgress: { label: "প্রস্তুত!", pct: 100 } });
  setTimeout(() => set({ buildProgress: null }), 800); // ← সামান্য দেরিতে clear
},
```

**rebuildPage() fix:**
```typescript
// আগে: buildAllPages() synchronously সব 600+ পেজ build করতো একটির জন্য
// এখন: idle-scheduled — slider drag করার সময় block হবে না
rebuildPage: (pageId: string) => {
  // ...opts calculation...
  const currentPages = get().pages;
  if (!currentPages.find((p) => p.id === pageId)) return;

  scheduleIdle(() => {
    const pages = get().pages; // re-read (হয়তো changed হয়েছে)
    const allPages = buildAllPages(opts);
    const updatedPage = allPages.find((p) => p.id === pageId);
    if (!updatedPage) return;
    const newPages = pages.map((p) => (p.id === pageId ? updatedPage : p));
    set({ pages: newPages, distribution: computeDistribution(newPages) });
  });
},
```

### ✅ Phase 1.2: Workspace.tsx — Real Progress Bar

**ফাইল:** `src/components/studio/Workspace.tsx`

```typescript
// reflowStore থেকে buildProgress subscribe:
const buildProgress = useReflowStore((s) => s.buildProgress);

// BootOverlay-তে দেখানো:
{stage !== "ready" || buildProgress !== null ? (
  <BootOverlay buildProgress={buildProgress} />
) : (
  {/* full artboard */}
)}

// BootOverlay component:
function BootOverlay({ buildProgress }: { buildProgress: BuildProgress | null }) {
  const pct = buildProgress?.pct ?? 0;
  const label = buildProgress?.label ?? "লোড হচ্ছে…";
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-[300px] rounded-xl ...">
        <p className="text-sm text-neutral-300">{label}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300
                       transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}  // ← CSS width দিয়ে animate হয়
          />
        </div>
        {pct > 0 && <p className="text-right text-[10px]">{pct}%</p>}
      </div>
    </div>
  );
}
```

### ✅ Phase 2.1: CanvasToolbar.tsx — Editable Zoom

**ফাইল:** `src/components/studio/CanvasToolbar.tsx`

**Logic:**
1. `zoomEditing = false` → `<button>` দেখায় zoom%
2. Click → `zoomEditing = true`, `zoomInput = "85"`, focus + select input
3. `<input>` দেখায়, user type করে
4. Enter/Blur → `parseInt` করে `setZoom(clamp(v, 25, 300))`
5. Escape → `zoomEditing = false` without saving

```typescript
const [zoomEditing, setZoomEditing] = useState(false);
const [zoomInput, setZoomInput] = useState("");
const zoomInputRef = useRef<HTMLInputElement>(null);

const startZoomEdit = () => {
  setZoomInput(String(zoom));
  setZoomEditing(true);
  setTimeout(() => zoomInputRef.current?.select(), 10); // ← 10ms delay, তারপর select
};

const commitZoomEdit = () => {
  const v = parseInt(zoomInput, 10);
  if (!isNaN(v)) setZoom(clamp(v));  // clamp(v) = Math.max(25, Math.min(300, Math.round(v)))
  setZoomEditing(false);
};

// JSX:
{zoomEditing ? (
  <input
    ref={zoomInputRef}
    type="number" min={25} max={300}
    value={zoomInput}
    onChange={(e) => setZoomInput(e.target.value)}
    onBlur={commitZoomEdit}
    onKeyDown={(e) => {
      if (e.key === "Enter") commitZoomEdit();
      if (e.key === "Escape") setZoomEditing(false);
    }}
    className="w-[52px] ..."
  />
) : (
  <button onClick={startZoomEdit} className="min-w-[52px] ...">{zoom}%</button>
)}
```

### ✅ Phase 2.2: Inspector.tsx — Export Panel

**ফাইল:** `src/components/studio/Inspector.tsx`

**Logic:** window.print() → browser print dialog → user saves as PDF

```typescript
function ExportPanel({ page }: { page?: PageData }) {
  const totalPages = useReflowStore((s) => s.pages.length);
  const [exporting, setExporting] = useState(false);

  const handlePrint = () => {
    setExporting(true);
    setTimeout(() => {
      window.print();      // ← browser print dialog
      setExporting(false); // ← এই line print dialog বন্ধ হওয়ার পরে চলে
    }, 100);  // 100ms delay: button state update হওয়ার সুযোগ দেয়
  };
  // ...
}
```

### ✅ Phase 3: TopBar.tsx — Shortcuts Modal

**ফাইল:** `src/components/studio/TopBar.tsx`

**Modal Pattern (fixed overlay):**
```typescript
// State:
const [shortcutsOpen, setShortcutsOpen] = useState(false);

// ESC key handler:
useEffect(() => {
  if (!shortcutsOpen) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape") setShortcutsOpen(false);
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [shortcutsOpen]);

// JSX (Modal):
{shortcutsOpen && (
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center
               bg-black/60 backdrop-blur-sm"
    onClick={(e) => {
      if (e.target === e.currentTarget) setShortcutsOpen(false); // backdrop click
    }}
  >
    <div className="w-[620px] ...">
      {/* Modal content */}
      <X onClick={() => setShortcutsOpen(false)} /> {/* X button */}
    </div>
  </div>
)}
```

---

## 🔄 পরবর্তী কাজ — Phase 4: Verify Tool উন্নতি

### Phase 4.1: যেকোনো সূরা Select করে Verify

**বর্তমান অবস্থা:**
- `/verify` → শুধু Al-Baqarah 1-18 hardcoded
- `/verify-fath` → শুধু Al-Fath 1-10 hardcoded
- **সমস্যা:** নতুন সূরা verify করতে হলে নতুন route লাগে

**লক্ষ্য:** একটি unified verify page যেখানে যেকোনো সূরা/আয়াত range select করা যাবে।

**ধাপ ১: `verify.tsx` route পরিবর্তন**

ফাইল: `src/routes/verify.tsx`

```typescript
// বর্তমান:
export const Route = createFileRoute("/verify")({
  component: VerifyPage,
});
// VerifyPage hardcoded surah/ayah range দিয়ে render করে

// নতুন — URL search params ব্যবহার:
// /verify?surah=2&from=1&to=18
export const Route = createFileRoute("/verify")({
  validateSearch: (search) => ({
    surah: Number(search.surah ?? 2),  // default: surah 2
    from: Number(search.from ?? 1),    // default: ayah 1
    to: Number(search.to ?? 18),       // default: ayah 18
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { surah, from, to } = Route.useSearch();
  const navigate = useNavigate();
  // ...
}
```

**ধাপ ২: VerifyPage UI**

```typescript
function VerifyPage() {
  const { surah, from, to } = Route.useSearch();
  const navigate = useNavigate();

  // Form state:
  const [surahInput, setSurahInput] = useState(surah);
  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);

  const handleSearch = () => {
    navigate({
      to: "/verify",
      search: { surah: surahInput, from: fromInput, to: toInput }
    });
  };

  // ভার্সেস filter করা:
  // verses.json থেকে s === surah && id >= from && id <= to ফিল্টার করো
  const verses = useVerses(surah, from, to); // custom hook

  return (
    <div>
      {/* Control bar */}
      <div className="flex gap-2 p-4">
        <select value={surahInput} onChange={e => setSurahInput(Number(e.target.value))}>
          {/* সব 114 সূরার option */}
          {SURAH_NAMES.map((name, i) => (
            <option key={i+1} value={i+1}>{i+1}. {name}</option>
          ))}
        </select>
        <input type="number" value={fromInput} onChange={e => setFromInput(Number(e.target.value))} placeholder="শুরু আয়াত" />
        <input type="number" value={toInput} onChange={e => setToInput(Number(e.target.value))} placeholder: "শেষ আয়াত" />
        <button onClick={handleSearch}>দেখুন</button>
      </div>
      {/* Side-by-side view */}
      <VerifyGrid verses={verses} />
    </div>
  );
}
```

---

## 🔮 Future Phase 5: High-DPI PNG Export

### কেন দরকার?
- বর্তমানে: `window.print()` → browser PDF (জোড়াতালি)
- লক্ষ্য: প্রতিটি পেজের সত্যিকার PNG ফাইল download হবে (300 DPI equivalent)

### প্রয়োজনীয় Package
```bash
npm install html2canvas
# OR
npm install @html-to-image/dom-to-png
```

### Implementation Pattern

**ফাইল পরিবর্তন:** `src/components/studio/TopBar.tsx` বা নতুন `src/lib/exportUtils.ts`

```typescript
// exportUtils.ts
import html2canvas from "html2canvas";

export async function exportPageToPNG(
  artboardEl: HTMLElement,
  pageNo: string | number,
  scale: number = 3  // 3x = ~300 DPI equivalent
): Promise<void> {
  const canvas = await html2canvas(artboardEl, {
    scale,               // high resolution
    useCORS: true,       // cross-origin images
    logging: false,
    backgroundColor: "#ffffff",  // white background
    windowWidth: 780,    // artboard width
    windowHeight: 1170,  // artboard height
  });

  // Canvas → PNG blob → download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quran-page-${pageNo}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
```

**Workspace.tsx এ Artboard ref expose করা:**
```typescript
// Workspace.tsx:
const artboardRef = useRef<HTMLDivElement>(null);

// JSX-এ:
<div ref={artboardRef} style={{ width: 780, height: 1170 }}>
  <Artboard page={active} zoom={1} />  {/* zoom=1 for export */}
</div>

// TopBar-এ prop দিয়ে পাঠানো:
<TopBar
  artboardRef={artboardRef}
  currentPageNo={active?.footer.pageNo}
  // ...
/>

// TopBar-এ:
const handleExportPNG = async () => {
  if (!artboardRef.current) return;
  await exportPageToPNG(artboardRef.current, currentPageNo);
};
```

---

## 🔮 Future Phase 6: Custom Tajweed Font (.woff2)

### বর্তমান সমস্যা
```typescript
// src/tajweed/svgMap.ts:
import s1 from "@/assets/tajweed/1.svg";
// ... 12টি SVG import

// প্রতিটি symbol → <img src={svgUrl} /> বা <div dangerouslySetInnerHTML> দিয়ে render
// সমস্যা: SVG file load, DOM manipulation, performance overhead
```

### লক্ষ্য
```typescript
// src/tajweed/fontCharMap.ts (নতুন ফাইল):
export const TAJWEED_CHAR: Record<TopSymbolId, string> = {
  1: "\uE001",  // Custom Private Use Area character
  2: "\uE002",
  // ...
  12: "\uE00C",
};

// CSS:
@font-face {
  font-family: "TajweedSymbols";
  src: url("/fonts/tajweed-symbols.woff2") format("woff2");
}

// Component:
<span style={{ fontFamily: "TajweedSymbols", fontSize: "24px" }}>
  {TAJWEED_CHAR[symbolId]}
</span>
```

### .woff2 Font তৈরির পদ্ধতি
1. **IcoMoon** (https://icomoon.io) → SVG upload → Generate Font
2. Download করা `.woff2` ফাইলটি `public/fonts/tajweed-symbols.woff2` এ রাখুন
3. `src/styles.css` এ `@font-face` যুক্ত করুন
4. `svgMap.ts` delete করে `fontCharMap.ts` দিয়ে replace করুন
5. `TopSymbolLayer.tsx` update করুন

**ফাইল পরিবর্তনের তালিকা:**
```
[DELETE]  src/tajweed/svgMap.ts
[NEW]     src/tajweed/fontCharMap.ts
[NEW]     public/fonts/tajweed-symbols.woff2
[MODIFY]  src/styles.css      → @font-face যুক্ত
[MODIFY]  src/components/studio/TopSymbolLayer.tsx → img বাদ, span + font char
[MODIFY]  src/tajweed/rules.ts → svgMap import বাদ, fontCharMap import
```

---

## 🔮 Future Phase 7: SQLite Data Layer

### বর্তমান Architecture
```
verses.json (5.6MB) → import → parse → cache → buildAllPages()
❌ সমস্যা: 5.6MB JSON একসাথে load
```

### নতুন Architecture
```
SQLite DB → DAL → lazy query → build only needed pages
✅ সুবিধা: শুধু দরকারী verses load, fast
```

**ফাইল:** `src/data/dal.ts`

```typescript
// বর্তমান BrowserDAL interface:
export interface DAL {
  getVerses(surah: number): Promise<Verse[]>;
  getVersesRange(surahFrom: number, surahTo: number): Promise<Verse[]>;
  getAllVerses(): Promise<Verse[]>;
}

// BrowserDAL (এখন আছে) — JSON থেকে load করে:
export class BrowserDAL implements DAL {
  async getAllVerses() {
    const mod = await import("./verses.json");
    return mod.default as Verse[];
  }
}

// নতুন ElectronDAL (তৈরি করতে হবে) — SQLite থেকে:
// এটা শুধু Electron desktop app-এ কাজ করবে
export class ElectronDAL implements DAL {
  private db: Database; // better-sqlite3

  async getVerses(surah: number) {
    return this.db.prepare(
      "SELECT * FROM verses WHERE surah = ? ORDER BY ayah"
    ).all(surah) as Verse[];
  }
}
```

**migration script তৈরির পদ্ধতি:**
```typescript
// src/data/db/migrate.ts:
import Database from "better-sqlite3";
import versesData from "../verses.json";

const db = new Database("quran.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS verses (
    id INTEGER PRIMARY KEY,
    surah INTEGER,
    ayah INTEGER,
    arabic TEXT,
    bangla TEXT
  )
`);

const insert = db.prepare(
  "INSERT INTO verses VALUES (@id, @surah, @ayah, @arabic, @bangla)"
);

const insertMany = db.transaction((verses) => {
  for (const v of verses) insert.run(v);
});

insertMany(versesData);
```

---

## 🚀 নতুন কাজ শুরু করার আগে — Checklist

```
1. Dev server চালু আছে কিনা দেখুন:
   → GET http://localhost:5174/ → 200 OK হলে চালু

2. যদি বন্ধ থাকে, চালু করুন:
   → C:\Xammp\QuranMakerV3\start_dev.bat ডবল ক্লিক করুন

3. TypeScript check করুন:
   → cmd: SET PATH=C:\Xammp\nodejs;%PATH% && npx tsc --noEmit
   → Output খালি = ✅ 0 errors

4. কোনো ফাইল edit করার পর HMR check:
   → dev_server.log এ [vite] (client) hmr update দেখলে ✅
```

---

## ⚠️ বিশেষ সতর্কতা (Critical Rules)

1. **react-window v2** installed — v1 API ব্যবহার করলে TypeScript error হবে
   - ❌ `FixedSizeList`, `ListChildComponentProps` → এগুলো v1
   - ✅ `List`, `RowComponentProps`, `useListRef` → এগুলো v2

2. **SSR Guard** — server-side এ `document`, `window`, `OffscreenCanvas` নেই
   - সবসময় `typeof document !== "undefined"` check করো

3. **React 19** — `useRef()` এ initial value দিতে হবে:
   - ❌ `useListRef()` → TypeScript error
   - ✅ `useListRef(null)` → correct

4. **Tailwind CSS v4** — `@apply` এবং `theme()` syntax ভিন্ন হতে পারে

5. **TanStack Start** — SSR mode, তাই `useEffect` ছাড়া browser API call করো না

6. **Zustand persist + temporal** — `overridesStore` এ দুটো middleware একসাথে আছে:
   ```typescript
   create<State>()(persist(temporal((set, get) => ({ ... })), { ... }))
   // undo/redo: useOverridesStore.temporal.getState().undo()
   // state: useOverridesStore.getState().global
   ```

7. **Path alias** — `@/` মানে `src/`:
   - `@/state/reflowStore` → `src/state/reflowStore.ts`
   - `@/components/studio/Artboard` → `src/components/studio/Artboard.tsx`
