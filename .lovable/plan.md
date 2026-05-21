## লক্ষ্য
Arabic/Bangla text edit, history actions, dynamic reflow, এবং top symbol alignment — এই ৪টা flow end-to-end ঠিক করা হবে এবং live preview-এ verify করা হবে।

## বর্তমানে চিহ্নিত সমস্যা
1. **লাইন এডিট করার সময় লেখা হারিয়ে যাচ্ছে / apply হচ্ছে না**
   - `InlineTextEditor` unmount হলে `onSave(text)` চালায়, কিন্তু edit চলাকালে selection/tool change হলে stale text save হতে পারে।
   - `handleInput()` overflow detect হলে row text-কে `patchLocal()` দিয়ে silent update করছে, কিন্তু final commit path (`blur`/`Enter`) আর intermediate reflow path-এর মধ্যে mismatch আছে।
   - `TopSymbolLayer` এখনো `slot.arabic` guard-এর ওপর render হচ্ছে, ফলে override text থাকলেও কিছু ক্ষেত্রে symbol layer stale source থেকে কাজ করে।

2. **Arabic text change করলে full dynamic apply হচ্ছে না**
   - `reflowFrom()` শুধু overflow push করে; underflow/backfill বা current row recompute symmetry নেই।
   - `reflowStore.rebuild()` signature-এ text override ধরা হচ্ছে না; ফলে canonical page rebuild pipeline text edits সম্পর্কে অন্ধ।
   - page data base text বনাম local override text—দুই source আলাদা আচরণ করছে।

3. **History features ঠিকমতো কাজ করছে না**
   - History preview logic `CanvasToolbar`-এর ভিতরে local-only one-field patch করছে; `HistoryEntry.beforeSnapshot` থাকা সত্ত্বেও সেটা ব্যবহার করছে না।
   - Preview restore manual reset/apply করছে, যা full snapshot-consistent নয়।
   - History UX split হয়েছে `CanvasToolbar` আর `PropertiesPanel`-এ; behavior duplicate এবং inconsistent।

4. **Top symbols সবসময় fixed থাকছে না**
   - `TopSymbolLayer`-এ measurement source `displayArabic/liveText`, কিন্তু icon render guard source `slot.arabic`; override/edited text-এর সাথে একীভূত নয়।
   - edit mode-এ contentEditable ref বদলালে symbol measurement transiently miss করতে পারে।

5. **Inspector / selection flow edit stability-তে interfere করতে পারে**
   - selection change হলে editing component remount/unmount হয়; commit timing নিয়ন্ত্রণ দুর্বল।
   - Properties panel collapse ঠিক আছে, কিন্তু active selection churn কমাতে হবে।

## implementation plan
### 1) Text editing pipeline stabilize
- `FabricLines.tsx`
  - Arabic/Bangla displayed text-এর source একটিতে নামানো হবে: `effectiveText` = override text বা source text।
  - `InlineTextEditor`-এ draft text local ref/state রাখা হবে যাতে unmount/blur/save সবসময় latest content commit করে।
  - `onBlur`, `Escape`, `Enter`, overflow reflow — প্রতিটি path আলাদা role পাবে:
    - typing = no history spam
    - commit = single history entry
    - overflow cascade = silent companion updates
- stale save / empty save guard যোগ হবে যাতে accidental blank overwrite না হয়।

### 2) Dynamic reflow fix
- `textReflow.ts`
  - overflow cascade logic refactor করে row-by-row deterministic function বানানো হবে
  - current row split + next rows/pages push unified হবে
  - empty/underflow cases safe করা হবে
- `FabricLines.tsx`
  - `Enter` press, live overflow, এবং final commit — তিনটাতেই একই reflow helper ব্যবহার হবে
  - next row focus navigation preserved থাকবে

### 3) History system correct snapshot behavior
- `CanvasToolbar.tsx`
  - preview button logic manual patch/reset বাদ দিয়ে `beforeSnapshot`/`applySnapshot()` ভিত্তিক করা হবে
  - restore/preview countdown robust করা হবে
- `PropertiesPanel.tsx`
  - history view behavior `CanvasToolbar`-এর সঙ্গে aligned করা হবে
- প্রয়োজনে `previewStore.ts` আলাদা করে preview session state centralize করা হবে, যাতে 5-second preview, cancel, restore conflict-free হয়

### 4) Top symbol locking fix
- `TopSymbolLayer.tsx`
  - render condition `effectiveArabic`-এর ওপর নির্ভর করবে, `slot.arabic`-এর ওপর নয়
  - live editing text + committed override text — দুই ক্ষেত্রেই same source থেকে tajweed detection চলবে
  - measurement observer/mirror path harden করা হবে যাতে edit চলাকালে icons disappear/jump না করে
- `FabricLines.tsx`
  - symbol layer-এ edited Arabic text pass করা হবে canonicalভাবে

### 5) Verification pass in live preview
আমি live preview-এ এগুলো verify করব:
1. Arabic word edit করলে লাইন blank না হয়
2. edit blur/Enter-এর পর change apply থাকে
3. overflow হলে পরের row/page-এ cascade হয়
4. history preview আগের state 5s দেখায়, তারপর restore হয়
5. history restore full state apply করে
6. top symbols edited Arabic-এর ওপর fixed থাকে
7. selection/history click-এর পর target row flash/navigate ঠিক থাকে

## touchpoints
- `src/components/studio/FabricLines.tsx`
- `src/components/studio/TopSymbolLayer.tsx`
- `src/lib/textReflow.ts`
- `src/components/studio/CanvasToolbar.tsx`
- `src/components/studio/PropertiesPanel.tsx`
- optional: `src/state/historyStore.ts` / new `src/state/previewStore.ts`

## technical notes
- History preview-তে single-field revert ব্যবহার না করে snapshot replay ব্যবহার করাই safest, কারণ text reflow multi-row side effects তৈরি করে
- Top symbol positioning edited text-এর exact rendered DOM node থেকেই measure করতে হবে
- text edits canonical page rebuild pipeline-কে avoid করে local override + reflow pipeline-এ deterministic রাখতে হবে, নইলে source-of-truth conflict হবে