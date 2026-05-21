# Studio Al-Qalam — প্রয়োগ সিস্টেম পুনর্গঠন
**তারিখ:** ২১ মে ২০২৬  
**স্ট্যাটাস:** ✅ Lovable এজেন্টকে পাঠানো হয়েছে — Implementation pending  
**গিটহাব রেপো:** `ohidgazi00003-gif/QuranMakerV3`

---

## পরিকল্পনার উৎস

এই প্ল্যানটি Antigravity AI দ্বারা তৈরি করা হয়েছে এবং Lovable এজেন্টকে implement করতে পাঠানো হয়েছে।  
Implementation শেষে গিট পুশ হবে, তারপর Antigravity চেক করে পরবর্তী ধাপ নির্ধারণ করবে।

---

## মূল নিয়মাবলী (Business Rules)

### নিয়ম ১: সাধারণ স্কোপ — Overflow-aware single-line edit
- কোনো লাইনে এডিট করলে → শুধু সেই লাইনে `patchLocal` হবে
- Overflow/underflow হলে → পুরো সূরা জুড়ে auto-reflow হবে (অন্য সূরায় যাবে না)

### নিয়ম ২: পেজ/সূরা/সকল স্কোপ — Font size fan-out
- `LocalOverride.fontPx` হিসেবে store হবে (global নয়)
- `patchScoped()` দিয়ে fan-out করবে layer kind অনুযায়ী
- **global** স্কোপ → `setGlobal()` ব্যবহার করবে

### নিয়ম ৩: আলাদা RowDetailSection দরকার নেই → মুছে ফেলা হবে

### নিয়ম ৪: Toolbar label → "প্রভাব" থেকে "প্রয়োগ"

---

## Step 0 — Codebase Import (Lovable-specific)

Copy from `/tmp/qm` → project root:
- `src/` (full), `tests/`, `public/`
- `package.json`, `tsconfig.json`, `vite.config.ts`, `wrangler.jsonc`, `components.json`, `eslint.config.js`, `bunfig.toml`
- `CODEBASE_OVERVIEW.md`, `AGENT_PROMPT.md`

Skip: `.git`, `node_modules`, `playwright-report`, `test-results`, screenshots, `.bat` scripts.

```bash
bun install
npx tsc --noEmit  # sanity gate — fix blocking errors
```

**Known fixes needed:**
- `PageList.tsx` react-window v2 import fix
- `tsconfig.json`-এ `"skipLibCheck": true` যোগ করুন

---

## Step 1 — `src/lib/textReflow.ts` 🔴 Critical

**লক্ষ্য:** surahPageIds parameter যোগ করে reflow সূরার মধ্যে সীমাবদ্ধ রাখা

```typescript
// ReflowOptions type-এ যোগ করুন:
export type ReflowOptions = {
  // ... সব পুরনো fields রাখুন ...
  surahPageIds?: string[]; // ← নতুন
};

// reflowFrom() function-এ:
export function reflowFrom(opts: ReflowOptions): void {
  const { surahPageIds, allPages, ... } = opts;
  
  // surahPageIds দেওয়া থাকলে filter করুন
  const targetPages = surahPageIds
    ? allPages.filter((p) => surahPageIds.includes(p.id))
    : allPages;
    
  const startPageIdx = targetPages.findIndex((p) => p.id === startPageId);
  if (startPageIdx === -1) return;

  // বাকি loop-এ `allPages` → `targetPages` replace করুন
  for (let pi = startPageIdx; pi < targetPages.length && overflow !== ""; pi++) {
    const page = targetPages[pi]; // ← আগে allPages[pi] ছিল
    // ... বাকি সব unchanged ...
  }
}
```

---

## Step 2 — `src/components/studio/FabricLines.tsx` 🔴 Critical

### 2ক — Type Tool click → setSelection fix

**Arabic band `<div>`-এ onClick যোগ করুন:**
```typescript
onClick={isTypeTool ? (e) => {
  e.stopPropagation();
  useEditorStore.getState().setSelection({
    kind: "layer",
    key: aLk,
    pageId,
    rowIndex: i,
    layerKind: "arabic",
  });
} : undefined}
```

**Bangla band `<div>`-এ onClick যোগ করুন:**
```typescript
onClick={isTypeTool ? (e) => {
  e.stopPropagation();
  useEditorStore.getState().setSelection({
    kind: "layer",
    key: bLk,
    pageId,
    rowIndex: i,
    layerKind: "bangla",
  });
} : undefined}
```

### 2খ+2গ — getReflowBase()-এ surahPageIds যোগ করুন

```typescript
const getReflowBase = () => {
  // surah page list বের করুন
  const dist = useReflowStore.getState().distribution;
  const srcSurah = dist.find((d) => d.pageId === pageId)?.surah ?? 0;
  const surahPageIds = srcSurah > 0
    ? dist.filter((d) => d.surah === srcSurah).map((d) => d.pageId)
    : undefined;

  return {
    layer,
    allPages: useReflowStore.getState().pages as unknown as Array<{ id: string; lines: any[] }>,
    localMap: useOverridesStore.getState().local,
    patchLocal: useOverridesStore.getState().patchLocal,
    layerKeyFn: layerKey,
    fontFamily,
    fontSize,
    availableWidth,
    surahPageIds, // ← নতুন field
  };
};
```

`reflowFrom({...base, ...})` সব call site-এ `surahPageIds` automatically যাবে `...base` spread-এর মাধ্যমে।

---

## Step 3 — `src/components/studio/PropertiesPanel.tsx` 🔴 Critical

### 3ক — DSlider নতুন স্বাক্ষর

```typescript
function DSlider({ 
  k, 
  localField,  // ← নতুন optional
  label, min, max, fallback, color 
}: {
  k: keyof GlobalOverrides;
  localField?: keyof LocalOverride; // ← নতুন
  label: string;
  min: number; max: number; fallback: number; color: string;
})
```

### 3খ — DSlider ভেতরের scope-aware logic

```typescript
const scope = useEditorStore((s) => s.scope);
const selection = useEditorStore((s) => s.selection);
const localOverride = useOverridesStore((s) => 
  selection ? s.local[selection.key] : undefined
);

// Display value
const localValue = localField 
  ? (localOverride?.[localField] as number | undefined) 
  : undefined;
const isLocalScope = scope !== "global" && !!selection && !!localField;
const effectiveStored = isLocalScope 
  ? (localValue ?? stored ?? fallback) 
  : (stored ?? fallback);
const display = dragging ?? effectiveStored;

// Apply function
const applyValue = (v: number) => {
  if (!isLocalScope) {
    setGlobal(k, v);
  } else {
    void patchScoped(selection!.key, { [localField!]: v } as never, scope);
  }
};

// Reset function
const resetValue = () => {
  if (!isLocalScope) {
    setGlobal(k, undefined);
    setDragging(null);
  } else {
    void patchScoped(selection!.key, { [localField!]: undefined } as never, scope);
    setDragging(null);
  }
};

// isOverridden
const isOverridden = isLocalScope ? localValue !== undefined : stored !== undefined;
```

### 3গ — ControlsTab-এ DSlider call update

```typescript
// Font size sliders → localField="fontPx" যোগ করুন:
<DSlider k="arabicFontPx" localField="fontPx" label="সাইজ" min={20} max={80} fallback={ARABIC_FONT_PX} color={color} />
<DSlider k="banglaFontPx" localField="fontPx" label="সাইজ" min={8} max={32} fallback={BANGLA_FONT_PX} color={color} />

// Y-offset sliders → localField দেবেন না (global-only):
<DSlider k="arabicYOffset" label="Y অফসেট" min={-30} max={30} fallback={0} color={color} />
<DSlider k="banglaYOffset" label="Y অফসেট" min={-30} max={30} fallback={0} color={color} />
<DSlider k="symbolYOffset" label="Y অফসেট" min={-30} max={30} fallback={0} color={color} />
```

### 3ঘ — RowDetailSection মুছুন

```typescript
// এই পুরো block মুছুন:
{selection && (scope === "page" || scope === "general") && (
  <>
    <div className="h-px bg-neutral-800/50" />
    <RowDetailSection color={color} selection={selection} />
  </>
)}
```

`RowDetailSection` function-টিও সম্পূর্ণ মুছুন।

### 3ঙ — Label পরিবর্তন

```typescript
// "প্রভাব স্তর (Scope)" → "প্রয়োগ স্তর"
```

---

## Step 4 — `src/components/studio/CanvasToolbar.tsx` 🟡 Minor

```typescript
// Line ~205:
// আগে:
<span ...>প্রভাব</span>
// পরে:
<span ...>প্রয়োগ</span>
```

---

## Step 5 — `src/components/studio/Artboard.tsx` 🔴 Critical (Crash Fix)

**সমস্যা:** `useFont()` conditionally বা provider-এর বাইরে call হচ্ছে।

**সমাধান:**
```typescript
// Top-level-এ রাখুন, conditional করবেন না:
import { FontContext } from "@/context/FontContext";
import { useContext } from "react";

// Component-এর একদম উপরে:
const fontCtx = useContext(FontContext);
const arabicFamily = fontCtx?.activeFamily ?? "'Excellent Arabic', serif";
```

**নিয়ম:** React hooks সবসময় component-এর top-level-এ থাকতে হবে, কোনো condition বা loop-এর ভেতরে না।

---

## Step 6 — `src/state/overridesStore.ts`

**কোনো পরিবর্তন নেই।**  
`getScopedLayerKeys` ইতোমধ্যে সঠিক:
```typescript
if (scope === "general") return [representativeKey]; // ✅
```

---

## Verification Checklist

- [ ] `npx tsc --noEmit` → কোনো error নেই
- [ ] Type Tool → Arabic/Bangla band ক্লিক → text editable হয়
- [ ] Edit overflow → শুধু সেই সূরার মধ্যে reflow হয়
- [ ] Scope "সাধারণ" → শুধু সেই লেয়ার পরিবর্তন হয়
- [ ] Scope "পেজ" → সেই পেজের সব matching layer পরিবর্তন হয়
- [ ] Scope "সূরা" → সেই সূরার সব matching layer পরিবর্তন হয়
- [ ] Scope "সকল" → সব পেজে global setGlobal() কাজ করে
- [ ] Toolbar → "প্রয়োগ" দেখাচ্ছে
- [ ] Properties → "প্রয়োগ স্তর" দেখাচ্ছে
- [ ] পেজ navigate করলে app crash হচ্ছে না
