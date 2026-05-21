# Lovable Task — History Panel + Quick Publish Modal
**তারিখ:** ২১ মে ২০২৬  
**অগ্রাধিকার:** 🟠 Important  
**ক্রম:** Plan #3 (PNG Export Plan #2 এর পরে)

---

## অংশ A — History Panel উন্নতি

### বর্তমান সমস্যা
`PropertiesPanel.tsx`-এর `HistoryTab`-এ entries দেখা যায় কিন্তু:
1. Scope badge সঠিক রঙে দেখায় না সবসময়
2. `restoreTo()` function O(N) — সব entries replay করে
3. History entry-তে কোন পেজ/সারি পরিবর্তন হয়েছে সেটা স্পষ্ট নয়

### কী করতে হবে

#### A1 — `src/state/historyStore.ts` — Entry format উন্নত করুন

`HistoryEntry` type-এ `scopeLabel` field যোগ করুন:

```typescript
// historyStore.ts-এ HistoryEntry type-এ যোগ করুন:
export type HistoryEntry = {
  id: string;
  ts: number;
  label: string;
  labelBn: string;
  scope: SelectionScope;
  scopeLabel?: string;   // ← নতুন: "পেজ ৩ · সারি ৫" ধরনের তথ্য
  field: string;
  before: unknown;
  after: unknown;
  patch: HistoryPatch;
  pageId?: string;
  rowIndex?: number;
  layerKey?: string;
};
```

`captureHistory()` function-এ `scopeLabel` populate করুন:

```typescript
// captureHistory() function-এ:
export function captureHistory(
  field: string,
  before: unknown,
  after: unknown,
  scope: SelectionScope,
  pageId?: string,
  rowIndex?: number,
  layerKey?: string,
) {
  // ... existing code ...
  
  // নতুন: scopeLabel তৈরি করুন
  let scopeLabel = "";
  if (pageId) {
    // "vpage-5" → "পেজ ৫"
    const pageNum = pageId.replace("vpage-", "");
    scopeLabel = `পেজ ${pageNum}`;
    if (rowIndex !== undefined) scopeLabel += ` · সারি ${rowIndex + 1}`;
  }
  
  const entry: HistoryEntry = {
    // ... existing fields ...
    scopeLabel, // ← যোগ করুন
  };
  
  // ... rest of function ...
}
```

#### A2 — `PropertiesPanel.tsx` → HistoryTab-এ scopeLabel দেখান

```typescript
// HistoryTab function-এ entry render করার সময়:
<div key={entry.id} className="flex flex-col gap-1 rounded bg-neutral-900/50 p-2 group hover:bg-neutral-800 transition-colors">
  <div className="flex items-center justify-between">
    <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold" 
          style={{ background: `${m.color}20`, color: m.color }}>
      {m.labelBn}
    </span>
    <div className="flex items-center gap-1">
      {/* নতুন: scopeLabel দেখান */}
      {entry.scopeLabel && (
        <span className="text-[9px] text-neutral-600 font-mono">
          {entry.scopeLabel}
        </span>
      )}
      <span className="text-[9px] text-neutral-500">{relativeTime(entry.ts)}</span>
    </div>
  </div>
  {/* ... বাকি সব একই ... */}
</div>
```

---

## অংশ B — Quick Publish Modal

### বর্তমান সমস্যা
`TopBar.tsx`-এ ⚡ (Quick Publish) বোতামটি কোনো handler নেই।

### কী করতে হবে

#### B1 — নতুন component: `QuickPublishModal.tsx`

`src/components/studio/QuickPublishModal.tsx` নামে নতুন ফাইল তৈরি করুন:

```typescript
import { useState } from "react";
import { Download, Printer, X } from "lucide-react";
import { useReflowStore } from "@/state/reflowStore";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function QuickPublishModal({ open, onClose }: Props) {
  const totalPages = useReflowStore((s) => s.pages.length);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(totalPages);
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const handlePrint = () => {
    setExporting(true);
    // CSS @media print-এ শুধু artboard দেখানোর জন্য
    // page range localStorage-এ রাখুন, print event-এ পড়ুন
    localStorage.setItem("print-range", JSON.stringify({ from: fromPage, to: toPage }));
    setTimeout(() => {
      window.print();
      setExporting(false);
      onClose();
    }, 200);
  };

  return (
    // Portal দিয়ে body-তে render করুন
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-80 rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            ⚡ Quick Publish
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-4">
          
          {/* Page range */}
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
                  onChange={(e) => setFromPage(Number(e.target.value))}
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
                  onChange={(e) => setToPage(Number(e.target.value))}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-center text-sm text-neutral-200 outline-none focus:border-amber-400"
                />
              </div>
            </div>
            <div className="text-[10px] text-neutral-600 text-center">
              মোট: {Math.max(0, toPage - fromPage + 1)} পেজ (সর্বোচ্চ {totalPages})
            </div>
          </div>

          {/* Quick select buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => { setFromPage(1); setToPage(totalPages); }}
              className="flex-1 rounded border border-neutral-700 bg-neutral-800 py-1.5 text-[10px] text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors"
            >
              সব পেজ
            </button>
            <button
              onClick={() => { setFromPage(1); setToPage(30); }}
              className="flex-1 rounded border border-neutral-700 bg-neutral-800 py-1.5 text-[10px] text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors"
            >
              প্রথম ৩০
            </button>
          </div>

          {/* Export button */}
          <button
            onClick={handlePrint}
            disabled={exporting || fromPage > toPage}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-neutral-950 hover:bg-amber-400 disabled:opacity-60 transition-colors"
          >
            <Printer className="h-4 w-4" />
            {exporting ? "প্রিন্ট হচ্ছে…" : "PDF/প্রিন্ট করুন"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### B2 — TopBar.tsx-এ modal সংযুক্ত করুন

```typescript
// TopBar.tsx-এ:
import { QuickPublishModal } from "./QuickPublishModal";
import { useState } from "react";

// Component ভেতরে:
const [publishOpen, setPublishOpen] = useState(false);

// ⚡ বোতামে onClick যোগ করুন:
<button
  onClick={() => setPublishOpen(true)}
  title="Quick Publish"
  className="..."
>
  ⚡
</button>

// Component return-এ modal যোগ করুন:
<QuickPublishModal open={publishOpen} onClose={() => setPublishOpen(false)} />
```

---

## TypeScript যাচাই

```bash
npx tsc --noEmit
```

কোনো error থাকলে fix করুন।

## যাচাইকরণ checklist

- [ ] History entry-তে "পেজ ৩ · সারি ৫" ধরনের তথ্য দেখায়
- [ ] ⚡ বোতামে ক্লিক করলে modal খোলে
- [ ] Page range input করে Print করা যায়
- [ ] Modal বন্ধ করা যায় (X বোতাম বা backdrop click)
- [ ] `npx tsc --noEmit` clean
