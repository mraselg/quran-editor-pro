# Lovable Task — Plan #5: Fix History Chip + Quick Publish Modal
**তারিখ:** ২১ মে ২০২৬  
**অগ্রাধিকার:** 🔴 Critical — Plan #2 implement হয়েছিল কিন্তু browser-এ কাজ করছে না  
**সমস্যার উৎস:** Browser audit-এ ধরা পড়েছে

---

## সমস্যা ১ — History entries-এ "পেজ N · সারি M" chip নেই

### লক্ষণ
History tab-এ entries দেখায়, কিন্তু "পেজ ২ · সারি ৩" ধরনের কোনো chip/badge নেই।

### কারণ
`historyStore.ts`-এ `captureHistory()` function-এ `scopeLabel` populate হচ্ছে না কারণ:
- `pageId` parameter আসছে না, অথবা
- `scopeLabel` তৈরি হলেও `HistoryEntry`-তে save হচ্ছে না, অথবা
- `PropertiesPanel.tsx`-এর `HistoryTab`-এ `scopeLabel` render করার code নেই

### সমাধান

#### ধাপ ১ — `src/state/historyStore.ts` চেক করুন

`captureHistory()` function-টি খুঁজুন। নিশ্চিত করুন `scopeLabel` তৈরি হচ্ছে এবং entry-তে include হচ্ছে:

```typescript
export function captureHistory(
  field: string,
  before: unknown,
  after: unknown,
  scope: SelectionScope,
  pageId?: string,
  rowIndex?: number,
  layerKey?: string,
) {
  if (_restoringHistory) return;

  // scopeLabel তৈরি করুন
  let scopeLabel = "";
  if (pageId) {
    // "vpage-5" → "পেজ ৫"
    const pageNum = pageId.replace("vpage-", "");
    scopeLabel = `পেজ ${pageNum}`;
    if (rowIndex !== undefined) {
      scopeLabel += ` · সারি ${rowIndex + 1}`;
    }
  }

  // Bengali labels for fields
  const FIELD_LABELS: Record<string, string> = {
    arabicFontPx: "আরবি ফন্ট সাইজ",
    banglaFontPx: "বাংলা ফন্ট সাইজ",
    arabicYOffset: "আরবি Y অফসেট",
    banglaYOffset: "বাংলা Y অফসেট",
    symbolYOffset: "প্রতীক Y অফসেট",
    fontPx: "ফন্ট সাইজ",
    dx: "X অফসেট",
    dy: "Y অফসেট",
    align: "অ্যালাইনমেন্ট",
    leading: "লিডিং",
    tracking: "ট্র্যাকিং",
  };
  const fieldLabel = FIELD_LABELS[field] ?? field;
  const labelBn = `${fieldLabel}: ${before ?? "—"} → ${after ?? "—"}`;

  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    label: `${field}: ${before} → ${after}`,
    labelBn,
    scope,
    scopeLabel,  // ← এটি অবশ্যই include করুন
    field,
    before,
    after,
    patch: { field, layerKey, before, after },
    pageId,
    rowIndex,
    layerKey,
  };

  useHistoryStore.getState().push(entry);
}
```

#### ধাপ ২ — `HistoryEntry` type-এ `scopeLabel` আছে কিনা নিশ্চিত করুন

```typescript
export type HistoryEntry = {
  id: string;
  ts: number;
  label: string;
  labelBn: string;
  scope: SelectionScope;
  scopeLabel?: string;  // ← এই field থাকতে হবে
  field: string;
  before: unknown;
  after: unknown;
  patch: HistoryPatch;
  pageId?: string;
  rowIndex?: number;
  layerKey?: string;
};
```

#### ধাপ ৩ — `PropertiesPanel.tsx`-এর `HistoryTab`-এ chip render করুন

HistoryTab-এর entry render section-এ `scopeLabel` দেখানো যোগ করুন:

```typescript
// entry render-এর ভেতরে, labelBn এর নিচে:
{entry.scopeLabel && (
  <span className="inline-flex items-center rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] font-mono text-neutral-500 w-fit mt-0.5">
    📍 {entry.scopeLabel}
  </span>
)}
```

#### ধাপ ৪ — `CanvasToolbar.tsx`-এর `HistoryItem`-এ chip render করুন

```typescript
// HistoryItem function-এ (entry.pageId block এর পাশে বা নিচে):
{entry.scopeLabel && (
  <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] font-mono text-neutral-500 w-fit">
    📍 {entry.scopeLabel}
  </span>
)}
```

---

## সমস্যা ২ — ⚡ Quick Publish বোতাম কাজ করছে না

### লক্ষণ
⚡ বোতামে বারবার click করলেও কোনো modal খোলে না।

### কারণ অনুসন্ধান

`TopBar.tsx`-এ ⚡ বোতামটি খুঁজুন। সমস্যা হতে পারে:

1. **`onClick` handler নেই বা ভুল function call** — বোতামে `onClick` আছে কিনা চেক করুন
2. **`publishOpen` state আছে কিনা** — `useState(false)` দিয়ে state declare আছে কিনা
3. **`QuickPublishModal` import আছে কিনা** — component import করা হয়েছে কিনা
4. **Modal render হচ্ছে কিনা** — `<QuickPublishModal open={publishOpen} ... />` JSX-এ আছে কিনা

### সমাধান — TopBar.tsx সম্পূর্ণ Quick Publish implementation

`TopBar.tsx`-এ নিচের changes করুন:

```typescript
// ১. Import যোগ করুন (file-এর শুরুতে):
import { useState } from "react";
// QuickPublishModal আলাদা file-এ থাকলে:
// import { QuickPublishModal } from "./QuickPublishModal";
// অথবা inline modal (নিচে দেখুন)

// ২. Component ভেতরে state declare করুন:
const [publishOpen, setPublishOpen] = useState(false);

// ৩. ⚡ বোতামে onClick যোগ করুন:
// বোতামটি খুঁজে onClick যোগ করুন:
<button
  onClick={() => setPublishOpen(true)}  // ← এটি যোগ করুন
  id="btn-quick-publish"
  title="Quick Publish (⚡)"
  className="..."  // existing classes রাখুন
>
  ⚡
</button>

// ৪. Component return-এর একদম শেষে (</> এর আগে) modal যোগ করুন:
{publishOpen && <QuickPublishModal onClose={() => setPublishOpen(false)} />}
```

### QuickPublishModal — যদি আলাদা file না থাকে

`src/components/studio/QuickPublishModal.tsx` নতুন file তৈরি করুন:

```typescript
import { useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { useReflowStore } from "@/state/reflowStore";

export function QuickPublishModal({ onClose }: { onClose: () => void }) {
  const totalPages = useReflowStore((s) => s.pages.length);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(Math.min(30, totalPages));
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
      onClose();
    }, 200);
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-80 rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <span className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            ⚡ Quick Publish
          </span>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              পেজ রেঞ্জ
            </span>
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] text-neutral-500">শুরু</label>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={fromPage}
                  onChange={(e) => setFromPage(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-center text-sm text-neutral-200 outline-none focus:border-amber-400"
                />
              </div>
              <span className="text-neutral-600 mt-4">—</span>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] text-neutral-500">শেষ</label>
                <input
                  type="number"
                  min={fromPage}
                  max={totalPages}
                  value={toPage}
                  onChange={(e) => setToPage(Math.min(totalPages, Number(e.target.value)))}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-center text-sm text-neutral-200 outline-none focus:border-amber-400"
                />
              </div>
            </div>
            <p className="text-[10px] text-neutral-600 text-center">
              মোট {Math.max(0, toPage - fromPage + 1)} পেজ (সর্বোচ্চ {totalPages})
            </p>
          </div>

          {/* Quick select */}
          <div className="flex gap-2">
            <button
              onClick={() => { setFromPage(1); setToPage(totalPages); }}
              className="flex-1 rounded border border-neutral-700 bg-neutral-800 py-1.5 text-[10px] text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors"
            >
              সব ({totalPages})
            </button>
            <button
              onClick={() => { setFromPage(1); setToPage(Math.min(30, totalPages)); }}
              className="flex-1 rounded border border-neutral-700 bg-neutral-800 py-1.5 text-[10px] text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors"
            >
              প্রথম ৩০
            </button>
          </div>

          <button
            onClick={handlePrint}
            disabled={printing || fromPage > toPage}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-neutral-950 hover:bg-amber-400 disabled:opacity-60 transition-colors"
          >
            <Printer className="h-4 w-4" />
            {printing ? "প্রিন্ট হচ্ছে…" : "PDF / প্রিন্ট করুন"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modal, document.body)
    : null;
}
```

---

## TypeScript যাচাই

```bash
npx tsc --noEmit
```

---

## যাচাইকরণ চেকলিস্ট

- [ ] History tab-এ entry-র নিচে "📍 পেজ ২ · সারি ৩" chip দেখায়
- [ ] Toolbar history dropdown-এও chip দেখায়  
- [ ] ⚡ বোতামে click করলে modal খোলে
- [ ] Modal-এ page range input করা যায়
- [ ] Modal backdrop click বা X দিয়ে বন্ধ হয়
- [ ] Print বোতাম কাজ করে
- [ ] `npx tsc --noEmit` clean
