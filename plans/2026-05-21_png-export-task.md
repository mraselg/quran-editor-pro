# Lovable Task — PNG Export Implementation
**তারিখ:** ২১ মে ২০২৬  
**অগ্রাধিকার:** 🟠 Important  
**ফাইল:** `src/components/studio/TopBar.tsx`

---

## বর্তমান সমস্যা

`TopBar.tsx`-এ PNG export বোতামটি শুধু একটি toast দেখায়, কোনো actual export হয় না:

```typescript
// বর্তমান অকার্যকর কোড:
// PNG button → only shows toast "শীঘ্রই আসছে"
```

---

## কী করতে হবে

### ধাপ ১ — `html2canvas` ইনস্টল করুন

```bash
bun add html2canvas
# অথবা:
npm install html2canvas
```

### ধাপ ২ — TopBar.tsx-এ PNG export function তৈরি করুন

`TopBar.tsx`-এ নিচের import যোগ করুন:

```typescript
import html2canvas from "html2canvas";
```

### ধাপ ৩ — exportAsPng function লিখুন

```typescript
async function exportAsPng(pageNo: string | number) {
  // 1. Artboard element খুঁজুন
  const artboard = document.querySelector("[data-artboard]") as HTMLElement | null;
  if (!artboard) {
    toast.error("আর্টবোর্ড পাওয়া যায়নি");
    return;
  }

  toast.info("PNG তৈরি হচ্ছে…");

  try {
    // 2. html2canvas দিয়ে capture করুন
    const canvas = await html2canvas(artboard, {
      scale: 2,           // 2x resolution for quality
      useCORS: true,      // cross-origin images allow
      backgroundColor: "#ffffff",
      logging: false,
      // artboard এর exact size নিন
      width: artboard.offsetWidth,
      height: artboard.offsetHeight,
    });

    // 3. PNG blob তৈরি করুন
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("PNG তৈরি করা যায়নি");
        return;
      }
      
      // 4. Download করুন
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quran-page-${pageNo}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`পেজ ${pageNo} PNG হিসেবে সেভ হয়েছে`);
    }, "image/png");
    
  } catch (err) {
    console.error("PNG export error:", err);
    toast.error("PNG export ব্যর্থ হয়েছে");
  }
}
```

### ধাপ ৪ — Artboard.tsx-এ data attribute যোগ করুন

`Artboard.tsx`-এর মূল artboard div-এ `data-artboard` attribute যোগ করুন:

```typescript
// Artboard.tsx-এ মূল wrapper div খুঁজুন এবং attribute যোগ করুন:
<div
  data-artboard  // ← এটি যোগ করুন
  style={{
    width: DISPLAY_W,
    height: DISPLAY_H,
    position: "relative",
    // ... বাকি সব styles একই থাকবে
  }}
>
```

### ধাপ ৫ — TopBar.tsx-এ PNG button-এর onClick update করুন

```typescript
// আগে (কাজ করছিল না):
<button id="btn-export-png" title="Export as PNG" onClick={() => toast.info("শীঘ্রই আসছে")}>
  <FileImage className="h-3 w-3" />PNG
</button>

// পরে (কাজ করবে):
<button 
  id="btn-export-png" 
  title="Export as PNG"
  onClick={() => exportAsPng(currentPageNo ?? "unknown")}
  className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200"
>
  <FileImage className="h-3 w-3" />PNG
</button>
```

**`currentPageNo` কোথা থেকে আসবে:** TopBar props থেকে বা `useReflowStore`/`useEditorStore` থেকে active page number নিন।

---

## TopBar.tsx-এ currentPageNo পাওয়ার উপায়

```typescript
// TopBar.tsx-এর component props বা store থেকে:
import { useReflowStore } from "@/state/reflowStore";
import { useEditorStore } from "@/state/editorStore";

// Component ভেতরে:
const pages = useReflowStore((s) => s.pages);
// active page ID থেকে page number বের করুন
// (TopBar-এ activePageId prop থাকলে সেটা ব্যবহার করুন)
```

---

## যাচাইকরণ

কাজ শেষে পরীক্ষা করুন:
- [ ] PNG বোতামে ক্লিক করলে "PNG তৈরি হচ্ছে…" toast দেখায়
- [ ] কিছুক্ষণ পরে browser download dialog খোলে বা file save হয়
- [ ] Download হওয়া PNG ফাইলে সম্পূর্ণ artboard দেখা যায়
- [ ] `npx tsc --noEmit` কোনো error দেয় না

---

## গুরুত্বপূর্ণ নোট

- `html2canvas` আরবি RTL text সঠিকভাবে capture করতে পারে
- `scale: 2` দিলে high-DPI/retina quality পাবেন
- যদি `html2canvas` import-এ TypeScript error হয়, তাহলে `tsconfig.json`-এ `"skipLibCheck": true` আছে কিনা নিশ্চিত করুন
- `data-artboard` attribute-টি সঠিক element-এ দিতে হবে — যে div-এ সব 9টি row আছে সেটাতে
