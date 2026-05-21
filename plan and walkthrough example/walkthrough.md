# Studio Al-Qalam — বিস্তারিত Walkthrough
### (প্রতিটি পরিবর্তনের সম্পূর্ণ ব্যাখ্যা — যেকোনো AI বুঝতে পারবে)

> **TypeScript:** ✅ 0 errors | **Dev Server:** `http://localhost:5174/` | **HMR:** ✅ Active

---

## 🔧 পরিবর্তন ৬: verify.tsx — Dynamic Surah Verify Page (Phase 4)

**ফাইল:** `c:\Xammp\QuranMakerV3\src\routes\verify.tsx`

### কেন পরিবর্তন করা হয়েছে?
আগে `/verify` শুধু Al-Baqarah 1-18 দেখাত (hardcoded)। নতুন সূরা দেখতে হলে নতুন route ফাইল লাগত। এখন একটিই unified page থেকে যেকোনো সূরার যেকোনো আয়াত range verify করা যাবে।

### URL Search Params Pattern (TanStack Router)

```typescript
// TanStack Router-এ URL search params handle করার pattern:
// URL: /verify?surah=48&from=1&to=10

export const Route = createFileRoute("/verify")({
  // validateSearch: URL query string → typed object
  // search parameter: Record<string, unknown> (raw URL values)
  validateSearch: (search: Record<string, unknown>) => ({
    // Number() → string কে number এ convert করে
    // ?? operator → undefined হলে default value ব্যবহার করে
    // Math.min/max → valid range enforce করে
    surah: Math.min(114, Math.max(1, Number(search.surah ?? 2))),
    from: Math.max(1, Number(search.from ?? 1)),
    to: Math.max(1, Number(search.to ?? 7)),
  }),

  // Dynamic page title from search params:
  head: ({ match }) => {
    const s = match.search.surah;
    const name = SURAH_LIST.find(([n]) => n === s)?.[1] ?? `সূরা ${s}`;
    return {
      meta: [{ title: `তাজবীদ ভেরিফাই — ${name} (${match.search.from}–${match.search.to})` }],
    };
  },
  component: VerifyPage,
});
```

### Component-এ search params ব্যবহার:

```typescript
function VerifyPage() {
  // Route.useSearch() → returns { surah: number, from: number, to: number }
  const { surah, from, to } = Route.useSearch();

  // useNavigate: URL update করে (page reload ছাড়া)
  const navigate = useNavigate({ from: "/verify" });

  // Local form state (user type করছে কিন্তু এখনো submit করেনি):
  const [formSurah, setFormSurah] = useState(surah);
  const [formFrom, setFormFrom] = useState(from);
  const [formTo, setFormTo] = useState(to);

  // Surah change → auto-reset from/to:
  const handleSurahChange = (newSurah: number) => {
    const info = SURAH_LIST.find(([n]) => n === newSurah);
    const max = info?.[2] ?? 286;
    setFormSurah(newSurah);
    setFormFrom(1);
    setFormTo(Math.min(10, max)); // প্রথম ১০ আয়াত default
  };

  // Navigate → URL change → component re-renders with new search params:
  const handleSearch = () => {
    navigate({
      search: { surah: formSurah, from: formFrom, to: formTo },
    });
  };

  // verses filter: useMemo দিয়ে cache করা (surah/from/to পরিবর্তনে re-compute):
  const verses = useMemo(
    () => (versesData as Verse[]).filter(
      (v) => v.s === surah && v.v >= from && v.v <= to
    ),
    [surah, from, to], // ← dependency array: এগুলো বদলালে মাত্র re-compute হয়
  );
  // ...
}
```

### ১১৪ সূরার ডেটা Structure:

```typescript
// [সূরা নং, বাংলা নাম, আয়াত সংখ্যা]
const SURAH_LIST: [number, string, number][] = [
  [1, "আল-ফাতিহা", 7],
  [2, "আল-বাকারা", 286],
  // ... ১১২ টি আরো entry ...
  [114, "আন-নাস", 6],
];

// Dropdown render:
<select onChange={(e) => handleSurahChange(Number(e.target.value))}>
  {SURAH_LIST.map(([num, name, ayahCount]) => (
    <option key={num} value={num}>
      {num}. {name} ({ayahCount} আয়াত)
    </option>
  ))}
</select>
```

### Quick Links Pattern:

```typescript
// Static quick-link chips — navigate() দিয়ে সরাসরি URL update করে
{[
  { label: "ফাতিহা", s: 1, f: 1, t: 7 },
  { label: "বাকারা ১–১৮", s: 2, f: 1, t: 18 },
  // ...
].map((q) => (
  <button
    onClick={() => navigate({ search: { surah: q.s, from: q.f, to: q.t } })}
    // Active state: বর্তমান URL params এর সাথে match হলে highlight
    className={surah === q.s && from === q.f && to === q.t
      ? "border-amber-500/50 bg-amber-500/15 text-amber-300" // active
      : "border-neutral-700 bg-neutral-800 text-neutral-400"  // inactive
    }
  >
    {q.label}
  </button>
))}
```

### verify-fath.tsx → Redirect:

```typescript
// আগে: Al-Fath-এর জন্য আলাদা hardcoded page ছিল
// এখন: unified /verify page-এ redirect করা হয়েছে

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/verify-fath")({
  beforeLoad: () => {
    // beforeLoad: component render-এর আগে চলে
    // throw redirect() → client-side redirect করে
    throw redirect({
      to: "/verify",
      search: { surah: 48, from: 1, to: 10 },
    });
  },
  component: () => null, // redirect হবে, component কখনো render হবে না
});
```

---

## 🔧 পরিবর্তন ১: reflowStore.ts — BuildProgress System

**ফাইল:** `c:\Xammp\QuranMakerV3\src\state\reflowStore.ts`

### কেন পরিবর্তন করা হয়েছে?
আগে `init()` function call হলে user কিছুই দেখতে পেত না — শুধু একটি spinning dot। কিন্তু verses.json (5.6MB) load হতে ও 600+ পেজ build হতে সময় লাগে। User কতটুকু complete হয়েছে সেটা জানতে পারত না।

### কী যোগ করা হয়েছে?

**Step 1 — নতুন type:**
```typescript
// এই type export করা হয়েছে যাতে Workspace.tsx ব্যবহার করতে পারে:
export type BuildProgress = {
  label: string;  // বাংলায় message, যেমন: "আয়াত ডেটা লোড হচ্ছে…"
  pct: number;    // 0 থেকে 100 — percentage
};
```

**Step 2 — State-এ field যুক্ত:**
```typescript
type ReflowState = {
  pages: PageData[];
  distribution: PageDistribution[];
  status: "idle" | "loading" | "ready";
  buildProgress: BuildProgress | null;  // ← নতুন
  signature: string;
  versesReady: boolean;
  rebuilding: boolean;
  // ... functions
};

// Initial state:
export const useReflowStore = create<ReflowState>((set, get) => ({
  // ...
  buildProgress: null,  // ← শুরুতে null (কোনো build চলছে না)
  // ...
}));
```

**Step 3 — init() এ ৪-stage progress:**
```typescript
init: async () => {
  if (get().status !== "idle") return;

  // Stage 1: শুরু
  set({ status: "loading", buildProgress: { label: "শুরু হচ্ছে…", pct: 5 } });

  // Stage 2: Font load
  if (typeof document !== "undefined" && (document as any).fonts?.load) {
    set({ buildProgress: { label: "আরবি ফন্ট লোড হচ্ছে…", pct: 20 } });
    try {
      // Excellent Arabic font (50px) এবং Kalpurush font (18px) load করা হচ্ছে
      // ARABIC_FONT_PX = 50, BANGLA_FONT_PX = 18 (pages.ts থেকে import)
      await (document as any).fonts.load(`${ARABIC_FONT_PX}px 'Excellent Arabic'`);
      await (document as any).fonts.load(`${BANGLA_FONT_PX}px 'Kalpurush'`);
    } catch { /* ignore — font load fail হলেও চলবে */ }
  }

  // Stage 3: Verses fetch (~5.6MB JSON)
  set({ buildProgress: { label: "আয়াত ডেটা লোড হচ্ছে…", pct: 40 } });
  await loadAllVerses(); // ← src/data/pages.ts এ defined
  set({ versesReady: true, buildProgress: { label: "পেজ তৈরি হচ্ছে…", pct: 70 } });

  // Stage 4: Page build (idle-scheduled internally)
  get().rebuild();
  set({ status: "ready", buildProgress: { label: "প্রস্তুত!", pct: 100 } });

  // 800ms পরে progress bar hide করা — "প্রস্তুত!" দেখানোর সময় দেওয়া হয়
  setTimeout(() => set({ buildProgress: null }), 800);
},
```

**Step 4 — rebuildPage() idle scheduling:**
```typescript
// আগের কোড (সমস্যা ছিল):
rebuildPage: (pageId: string) => {
  // ...
  const allPages = buildAllPages(opts); // ← SYNCHRONOUS! 600+ পেজ main thread block করত
  // ...
}

// নতুন কোড (ঠিক করা হয়েছে):
rebuildPage: (pageId: string) => {
  const currentPages = get().pages;
  if (!currentPages.find((p) => p.id === pageId)) return; // early exit

  // requestIdleCallback দিয়ে browser-এর idle time এ কাজ করা:
  const scheduleIdle =
    typeof requestIdleCallback !== "undefined"
      ? (cb: IdleRequestCallback) => requestIdleCallback(cb, { timeout: 200 })
      : (cb: IdleRequestCallback) =>
          setTimeout(() => cb({ timeRemaining: () => 50, didTimeout: false } as IdleDeadline), 0);

  scheduleIdle(() => {
    // Idle callback-এর ভেতরে build হয় — slider drag করার সময়ও smooth থাকে
    const pages = get().pages; // re-read (stale closure এড়াতে)
    const allPages = buildAllPages(opts);
    const updatedPage = allPages.find((p) => p.id === pageId);
    if (!updatedPage) return;
    const newPages = pages.map((p) => (p.id === pageId ? updatedPage : p));
    set({ pages: newPages, distribution: computeDistribution(newPages) });
  });
},
```

---

## 🔧 পরিবর্তন ২: Workspace.tsx — Real Progress Bar

**ফাইল:** `c:\Xammp\QuranMakerV3\src\components\studio\Workspace.tsx`

### কেন পরিবর্তন করা হয়েছে?
আগে BootOverlay শুধু "ইউআই লোড হচ্ছে…" বা "আরবি ফন্ট লোড হচ্ছে…" দেখাত। এটা একটা static 2-stage থেকে RAF (requestAnimationFrame) এর পরে hide হয়ে যেত। User জানতে পারত না কখন পেজ ready হবে।

### Import যুক্ত:
```typescript
import { useReflowStore } from "@/state/reflowStore";
import type { BuildProgress } from "@/state/reflowStore"; // ← type import
```

### State subscription:
```typescript
export function Workspace() {
  // ...
  const buildProgress = useReflowStore((s) => s.buildProgress); // ← নতুন
  const [stage, setStage] = useState<"ui" | "ready">("ui"); // ← "fonts" stage বাদ দেওয়া হয়েছে
  // ...
}
```

### BootOverlay condition পরিবর্তন:
```typescript
// আগে: শুধু stage-এর উপর নির্ভর করত (1 RAF পরে বন্ধ হত)
{stage !== "ready" ? <BootOverlay stage={stage} /> : <Artboard />}

// এখন: stage অথবা buildProgress থাকলে BootOverlay দেখায়
{stage !== "ready" || buildProgress !== null ? (
  <BootOverlay buildProgress={buildProgress} />
) : (
  <Artboard .../>
)}
// অর্থাৎ: stage "ready" হওয়ার পরেও যতক্ষণ buildProgress null না হয়,
// progress bar দেখাবে (800ms পরে null হয় → Artboard দেখাবে)
```

### নতুন BootOverlay Component:
```typescript
// আগের BootOverlay: stage prop নিত, static 2-state
function BootOverlay({ stage }: { stage: Stage }) {
  // stage === "ui" ? "33%" : "66%" — static percentage
}

// নতুন BootOverlay: buildProgress prop নেয়, dynamic percentage
function BootOverlay({ buildProgress }: { buildProgress: BuildProgress | null }) {
  const pct = buildProgress?.pct ?? 0;       // Optional chaining: null হলে 0
  const label = buildProgress?.label ?? "লোড হচ্ছে…"; // null হলে default label

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-[300px] rounded-xl border border-neutral-800
                      bg-neutral-900/90 p-5 shadow-2xl backdrop-blur-sm">

        {/* Pulsing dot + brand name */}
        <div className="mb-3 flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            {/* Outer pulse ring — animate-ping class */}
            <span className="absolute inline-flex h-full w-full animate-ping
                            rounded-full bg-amber-400 opacity-60" />
            {/* Inner solid dot */}
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
            Studio Al-Qalam
          </span>
        </div>

        {/* Dynamic Bengali label */}
        <p className="text-sm text-neutral-300">{label}</p>

        {/* Progress bar track */}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-800">
          {/* Progress fill — width CSS property animate হয় transition দিয়ে */}
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300
                       transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}  // ← JS দিয়ে dynamic width
          />
        </div>

        {/* Percentage number (শুধু pct > 0 হলে দেখায়) */}
        {pct > 0 && (
          <p className="mt-1.5 text-right text-[10px] text-neutral-600">{pct}%</p>
        )}
      </div>
    </div>
  );
}
```

---

## 🔧 পরিবর্তন ৩: CanvasToolbar.tsx — Editable Zoom Input

**ফাইল:** `c:\Xammp\QuranMakerV3\src\components\studio\CanvasToolbar.tsx`

### কেন পরিবর্তন করা হয়েছে?
আগে zoom শুধু `[−]` এবং `[+]` বাটন দিয়ে 10% করে বাড়ানো/কমানো যেত। যদি user 150% করতে চায়, তাহলে অনেকবার click করতে হত। Direct input না থাকলে precise control করা কঠিন।

### নতুন State variables:
```typescript
const [zoomEditing, setZoomEditing] = useState(false);   // editing mode on/off
const [zoomInput, setZoomInput] = useState("");           // typed value (string)
const zoomInputRef = useRef<HTMLInputElement>(null);      // input focus করার জন্য
```

### Helper functions:
```typescript
const startZoomEdit = () => {
  setZoomInput(String(zoom));  // current zoom value string এ convert
  setZoomEditing(true);        // editing mode on
  // 10ms delay দিয়ে input select করা — কারণ React state update synchronous না
  setTimeout(() => zoomInputRef.current?.select(), 10);
  // .select() → input এর সব text select হয় → user সরাসরি type করতে পারে
};

const commitZoomEdit = () => {
  const v = parseInt(zoomInput, 10);  // string → integer (10 = decimal base)
  if (!isNaN(v)) setZoom(clamp(v));   // valid number হলে apply
  // clamp(v) = Math.max(25, Math.min(300, Math.round(v)))
  // অর্থাৎ: minimum 25%, maximum 300%, round করা হয়
  setZoomEditing(false);  // editing mode off
};
```

### JSX (conditional render):
```typescript
{zoomEditing ? (
  // Editing mode: number input দেখায়
  <input
    ref={zoomInputRef}           // focus control
    type="number"                // number keyboard on mobile
    min={25} max={300}           // browser validation (চাইলে user override করতে পারে)
    value={zoomInput}
    onChange={(e) => setZoomInput(e.target.value)}
    onBlur={commitZoomEdit}      // mouse click বাইরে → commit
    onKeyDown={(e) => {
      if (e.key === "Enter") commitZoomEdit();    // Enter → commit
      if (e.key === "Escape") setZoomEditing(false); // Esc → cancel
    }}
    className="w-[52px] rounded-md border border-amber-500/60 bg-neutral-800
              px-1 py-1 text-center text-xs font-bold tabular-nums
              text-amber-200 outline-none focus:border-amber-400"
    // amber color → editing indicator
  />
) : (
  // Normal mode: button দেখায় (click করলে editing mode)
  <button
    onClick={startZoomEdit}
    title="ক্লিক করে zoom সরাসরি টাইপ করুন"
    className="min-w-[52px] rounded-md border border-neutral-700
              bg-neutral-800 px-2 py-1 text-center text-xs font-bold
              tabular-nums text-neutral-200
              hover:border-amber-500/40 hover:text-amber-200 transition-colors"
    // tabular-nums → সংখ্যা alignment ঠিক থাকে
  >
    {zoom}%
  </button>
)}
```

### buildProgress Status in Toolbar:
```typescript
// buildProgress subscribe:
const buildProgress = useReflowStore((s) => s.buildProgress); // ← নতুন

// Toolbar-এ দেখানো:
{buildProgress && (
  <span className="flex items-center gap-1.5 rounded bg-amber-500/10
                   px-2 py-0.5 text-[10px] text-amber-300">
    <span className="h-1.5 w-1.5 animate-spin rounded-full
                     border border-amber-400 border-t-transparent" />
    {/* animate-spin + border-t-transparent → spinner effect */}
    {buildProgress.label}
    <span className="tabular-nums text-amber-500 font-bold">
      {buildProgress.pct}%
    </span>
  </span>
)}
```

---

## 🔧 পরিবর্তন ৪: Inspector.tsx — Functional Export Panel

**ফাইল:** `c:\Xammp\QuranMakerV3\src\components\studio\Inspector.tsx`

### কেন পরিবর্তন করা হয়েছে?
Inspector-এর "Export" ট্যাবে `<Placeholder title="Export — PDF/PNG রপ্তানি" />` ছিল — শুধু "শীঘ্রই আসছে" দেখাত। এটা unfunctional ছিল।

### নতুন Imports:
```typescript
import { FileText, Printer } from "lucide-react"; // ← নতুন icons
import { useReflowStore } from "@/state/reflowStore"; // ← total pages-এর জন্য
```

### ExportPanel Component:
```typescript
function ExportPanel({ page }: { page?: PageData }) {
  // Zustand থেকে total page count:
  const totalPages = useReflowStore((s) => s.pages.length);

  // Loading state (button disabled করার জন্য):
  const [exporting, setExporting] = useState(false);

  const handlePrint = () => {
    setExporting(true);
    setTimeout(() => {
      window.print(); // ← browser print dialog খোলে
      // user "Save as PDF" select করলে PDF হয়
      // "Print" select করলে physical print হয়
      setExporting(false);
    }, 100);
    // 100ms delay: React state update এবং button re-render এর সুযোগ দেয়
    // তারপরে window.print() synchronously block করে (dialog বন্ধ পর্যন্ত)
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Current page section */}
      <Section title="বর্তমান পেজ" icon={FileText}>
        {/* Page info card */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-2.5 text-[10px] text-neutral-400 mb-2">
          <div className="flex items-center justify-between mb-1">
            <span>পেজ নম্বর</span>
            {/* page?.footer.pageNo → Optional chaining: page null হলে "—" দেখায় */}
            <span className="font-bold text-amber-300">{page?.footer.pageNo ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>সূরা</span>
            <span className="text-neutral-300 truncate max-w-[160px]">
              {page?.footer.surah ?? "—"}
            </span>
          </div>
        </div>

        {/* Print button */}
        <button
          id="btn-export-pdf"  // ← unique ID for browser testing
          onClick={handlePrint}
          disabled={exporting}
          className="flex w-full items-center justify-center gap-2 rounded-lg
                    bg-amber-500 py-2 text-[11px] font-bold text-neutral-950
                    hover:bg-amber-400 disabled:opacity-60 transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          {/* Conditional text: loading vs default */}
          {exporting ? "প্রিন্ট হচ্ছে…" : "বর্তমান পেজ প্রিন্ট/PDF"}
        </button>
      </Section>

      {/* All pages section */}
      <Section title="সব পেজ" icon={FileText}>
        <div className="...">
          <span>মোট পেজ</span>
          <span className="font-bold text-amber-300">{totalPages}</span>
        </div>
        <button onClick={handlePrint} disabled={exporting || totalPages === 0} ...>
          {exporting ? "প্রিন্ট হচ্ছে…" : `সব ${totalPages}টি পেজ প্রিন্ট/PDF`}
          {/* Template literal: বাকটিক দিয়ে variable embed করা */}
        </button>
      </Section>

      {/* Tips section */}
      <Section title="প্রিন্ট টিপস" icon={Printer}>
        <ul className="space-y-1.5 text-[10px] text-neutral-500">
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/60" />
            ব্রাউজারে PDF হিসেবে সেভ করতে "Save as PDF" সিলেক্ট করুন
          </li>
          {/* আরো tips... */}
        </ul>
      </Section>
    </div>
  );
}
```

---

## 🔧 পরিবর্তন ৫: TopBar.tsx — PDF Export + Shortcuts Modal

**ফাইল:** `c:\Xammp\QuranMakerV3\src\components\studio\TopBar.tsx`

### পরিবর্তন ৫.১: PDF Export Fix
```typescript
// আগে (কাজ করত না):
const handleExportPDF = () => {
  toast.info("PDF রপ্তানি — শীঘ্রই আসছে!", { ... });
};

// এখন (কাজ করে):
const handleExportPDF = () => {
  // setTimeout দিয়ে browser-কে render করার সুযোগ দেওয়া হয়
  setTimeout(() => window.print(), 100);
};
```

### পরিবর্তন ৫.২: Keyboard Shortcuts Modal

**Data structure — shortcut groups:**
```typescript
// ফাইলের উপরে (component-এর বাইরে) define করা হয়েছে
// কারণ: static data, re-render-এ recreate করার দরকার নেই
const SHORTCUT_GROUPS = [
  {
    group: "নেভিগেশন",        // group name (বাংলায়)
    color: "#f59e0b",           // amber color — CSS হেক্স
    items: [
      { key: "← →", desc: "আগের / পরের পেজ" },
      { key: "Space + Drag", desc: "Canvas প্যান করুন" },
      { key: "Ctrl + Scroll", desc: "Zoom in / out" },
      { key: "[ / ]", desc: "Zoom -10% / +10%" },
      { key: "F", desc: "Fit to window (85%)" },
    ],
  },
  // ... আরো groups
];
```

**Modal state + ESC handler:**
```typescript
const [shortcutsOpen, setShortcutsOpen] = useState(false);

// ESC key দিয়ে বন্ধ করার জন্য:
useEffect(() => {
  if (!shortcutsOpen) return; // modal বন্ধ থাকলে listener যুক্ত করা লাগবে না

  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape") setShortcutsOpen(false);
  };
  window.addEventListener("keydown", handler);

  // Cleanup function: modal বন্ধ হলে listener remove করা
  return () => window.removeEventListener("keydown", handler);
}, [shortcutsOpen]); // shortcutsOpen বদলালে effect re-run হয়
```

**Modal JSX — Fixed overlay pattern:**
```typescript
// TopBar component-এর JSX:
return (
  <>  {/* Fragment: একাধিক root element */}
    <header ...>
      {/* Header content */}
      <button onClick={() => setShortcutsOpen(true)}>
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
    </header>

    {/* Modal — shortcutsOpen true হলে render হয় */}
    {shortcutsOpen && (
      {/*
        fixed inset-0 → viewport পূরণ করে (top:0, right:0, bottom:0, left:0)
        z-[9999] → সবকিছুর উপরে
        flex items-center justify-center → center-align
        bg-black/60 → 60% opacity black overlay
        backdrop-blur-sm → blur effect
      */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center
                   bg-black/60 backdrop-blur-sm"
        onClick={(e) => {
          // Backdrop click detect: শুধু backdrop-এ click হলে বন্ধ করো
          // e.target === e.currentTarget → click exactly এই div-এ হয়েছে
          // (child element-এ click হলে target ভিন্ন হবে)
          if (e.target === e.currentTarget) setShortcutsOpen(false);
        }}
      >
        <div className="w-[620px] max-h-[80vh] overflow-y-auto
                        rounded-2xl border border-neutral-700
                        bg-neutral-950 shadow-2xl">
          {/* Modal header */}
          <div className="flex items-center justify-between border-b
                          border-neutral-800 px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm font-bold text-neutral-100">
              <Keyboard className="h-4 w-4 text-amber-400" />
              কীবোর্ড শর্টকাট
            </div>
            {/* X button */}
            <button onClick={() => setShortcutsOpen(false)} className="...">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Shortcut groups — 2-column grid */}
          <div className="grid grid-cols-2 gap-4 p-5">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.group} className="flex flex-col gap-2">
                {/* Group title */}
                <h3 className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: group.color }}>
                  {group.group}
                </h3>
                {/* Shortcut items */}
                <div className="flex flex-col gap-1.5 rounded-xl border
                                border-neutral-800 bg-neutral-900/50 p-3">
                  {group.items.map((item) => (
                    <div key={item.key}
                         className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-neutral-400">
                        {item.desc}
                      </span>
                      {/* kbd element: keyboard key style */}
                      <kbd className="shrink-0 rounded-md border border-neutral-700
                                      bg-neutral-800 px-2 py-0.5 text-[10px]
                                      font-mono font-bold text-neutral-200 shadow-sm">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="border-t border-neutral-800 px-5 py-3 text-[10px]
                          text-neutral-600 text-center">
            যেকোনো জায়গায় ক্লিক করুন বা
            <kbd className="...">Esc</kbd> চাপুন বন্ধ করতে
          </div>
        </div>
      </div>
    )}
  </>
);
```

---

## 📊 সম্পূর্ণ পরিবর্তনের সারসংক্ষেপ

| ফাইল | কী বদলেছে | কেন |
|------|-----------|-----|
| [reflowStore.ts](file:///c:/Xammp/QuranMakerV3/src/state/reflowStore.ts) | BuildProgress type + 4-stage init + idle rebuildPage | User progress দেখতে পায়, main thread block হয় না |
| [Workspace.tsx](file:///c:/Xammp/QuranMakerV3/src/components/studio/Workspace.tsx) | Real progress bar, Stage simplified | Dynamic % দেখায় |
| [CanvasToolbar.tsx](file:///c:/Xammp/QuranMakerV3/src/components/studio/CanvasToolbar.tsx) | Editable zoom input + buildProgress status | Direct zoom control |
| [Inspector.tsx](file:///c:/Xammp/QuranMakerV3/src/components/studio/Inspector.tsx) | ExportPanel (placeholder বাদ) | Print/PDF কাজ করে |
| [TopBar.tsx](file:///c:/Xammp/QuranMakerV3/src/components/studio/TopBar.tsx) | Working PDF + Shortcuts modal | PDF export কাজ করে, shortcuts discover করা যায় |

---

## 🛠️ আগের Session-এর কাজ (Base fixes)

এগুলো আগের session-এ করা হয়েছিল:

### canvasMeasure.ts — SSR Guard
```typescript
// src/lib/canvasMeasure.ts
// সমস্যা: SSR-এ OffscreenCanvas নেই → crash
const _isSSR = typeof document === "undefined";

export function measureArabicWidth(text: string, fontPx: number, family: string): number {
  if (_isSSR) {
    // Heuristic estimate: প্রতি character গড়ে fontPx * 0.6 wide
    return text.length * fontPx * 0.6;
  }
  // Browser-এ: real OffscreenCanvas দিয়ে measure
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${fontPx}px ${family}`;
  return ctx.measureText(text).width;
}
```

### PageList.tsx — react-window v2 Migration
```typescript
// src/components/studio/PageList.tsx
// সমস্যা: react-window v1 API ব্যবহার করছিল → v2 installed
import { List, useListRef } from "react-window"; // v2 import

const listRef = useListRef(null); // ← React 19: null দিতে হবে

// RowComponent type: v2 style
function PageRow({ index, style, pageList }: RowComponentProps<{ pageList: PageData[] }>) {
  const page = pageList[index];
  return <div style={style}>...</div>;
}

<List
  listRef={listRef}
  rowCount={pages.length}
  rowHeight={52}
  defaultHeight={500}
  rowComponent={PageRow}
  rowProps={{ pageList: pages }} // ← v1 এ ছিল itemData, v2 তে rowProps
/>
```

### vite.config.ts — SSR noExternal
```typescript
// c:\Xammp\QuranMakerV3\vite.config.ts
export default defineConfig({
  // ...
  ssr: {
    noExternal: ["react-window"], // ← SSR-এ react-window bundle করা হবে (CJS issue fix)
  },
});
```
