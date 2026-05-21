# বাকি প্ল্যান-আইটেম (৬টি)

`historyStore.ts` রিফ্যাক্টর সম্পন্ন। এখন বাকি কাজগুলো ধাপে ধাপে প্রয়োগ করা হবে।

## ১. previewStore (নতুন ফাইল)
`src/state/previewStore.ts` — ৫-সেকেন্ডের "আগেরটা দেখাও" ফিচার।
- `start(entryId)` — বর্তমান state snapshot stash করে, entry-এর `beforeSnapshot` apply করে, ৫সে টাইমার চালু করে
- `cancel()` — টাইমার বন্ধ করে stashed snapshot ফিরিয়ে আনে
- state: `activeEntryId`, `secondsLeft`, `stashedSnapshot`
- `setInterval` দিয়ে প্রতি সেকেন্ডে `secondsLeft` কমে, 0 হলে auto-restore

## ২. overridesStore — silent mode wrapping
টেক্সট-এডিট flow-এ `historyStore.beginSilent()` / `endSilent()` যোগ করা হবে যাতে প্রতি keystroke-এ history entry তৈরি না হয়। শুধু `commit` (blur/Enter)-এ একটি entry capture হবে।

পরিবর্তন:
- `setLocalArabic`, `setLocalBangla` → silent mode-এ patch
- নতুন `commitLocalText(layer, pageId, rowIndex, field)` → silent বন্ধ করে before/after সহ একটি history entry capture করে
- `resetRow`, `resetPage` → সাধারণ (non-silent) capture যাতে undo যায়

## ৩. TopHistoryStrip + CanvasToolbar
- `src/components/studio/TopHistoryStrip.tsx` (নতুন) — শেষ ৫-৭টি entry chip আকারে দেখাবে; প্রতিটি chip-এ label + scope (page/row) + click handler
- click → `navigateTo(pageId, rowKey)` + `flashRow(rowKey)` + Properties panel-এ "আগেরটা দেখাও" বাটন সক্রিয় করে
- `CanvasToolbar.tsx` থেকে "Reset all" আইকন সরানো হবে; TopHistoryStrip বসানো হবে toolbar-এর ডান পাশে

## ৪. PropertiesPanel — "আগেরটা দেখাও" বাটন
নির্বাচিত history entry-র জন্য কাউন্টডাউন বাটন:
- `previewStore.activeEntryId === selectedEntryId` হলে "↺ {secondsLeft}সে" দেখাবে
- click → `previewStore.start(entryId)` বা `cancel()`
- পাশে "এই অবস্থা রাখুন" বাটন → preview-state কে নতুন history entry হিসেবে commit করে

## ৫. Inspector — Properties default collapsed
- `editorStore.propsPanelOpen` ডিফল্ট `false`
- `setSelection()` থেকে auto-open লজিক সরানো হবে
- শুধু header chevron click-এ toggle হবে
- layer-tab change-ও panel auto-open করবে না

## ৬. FabricLines + TopSymbolLayer + reflow
**FabricLines.tsx:**
- row container-এ `data-row-key` attribute
- `editorStore.focusedRowKey === rowKey` হলে amber outline + box-shadow glow (1সে পর auto-clear via setTimeout)
- contentEditable-এ `onKeyDown`:
  - **Enter** (without shift) → preventDefault, next row-এ focus সরায়; শেষ row হলে next page-এর প্রথম row
  - **Backspace at offset 0** → পূর্ববর্তী row-এর শেষে merge
- `onInput` → `reflowStore.reflowRow(pageId, rowIndex)` কল করে overflow detect; বেশি হলে অতিরিক্ত শব্দ পরবর্তী row/page-এ cascade

**TopSymbolLayer.tsx:**
- `isEditing` অবস্থায় symbol উধাও হয় — fix: hidden mirror `<span ref={mirrorRef} aria-hidden>` সবসময় mount রাখা হবে measurement-এর জন্য; visible span আলাদাভাবে editable হবে
- ResizeObserver mirror span-এ attach করা হবে যাতে edit চলাকালেও symbol position সঠিক থাকে

**textReflow.ts:**
- নতুন helper `cascadeOverflow(pageId, rowIndex, extraText)` — row-এর max-width অনুযায়ী words split করে বাকি অংশ next row-এ overrides-এ push করে; recursive

## ফাইল-তালিকা
1. `src/state/previewStore.ts` (নতুন)
2. `src/state/overridesStore.ts` (silent wrapping + commit)
3. `src/state/editorStore.ts` (propsPanelOpen=false, focusedRowKey, navigateTo, flashRow)
4. `src/components/studio/TopHistoryStrip.tsx` (নতুন)
5. `src/components/studio/CanvasToolbar.tsx` (Reset সরানো, strip বসানো)
6. `src/components/studio/PropertiesPanel.tsx` ("আগেরটা দেখাও" বাটন)
7. `src/components/studio/Inspector.tsx` (auto-open সরানো)
8. `src/components/studio/FabricLines.tsx` (flash, Enter/Backspace nav, reflow trigger)
9. `src/components/studio/TopSymbolLayer.tsx` (mirror span fix)
10. `src/lib/textReflow.ts` (cascadeOverflow helper)

## যাচাইকরণ
প্রতিটি ধাপের পর preview-এ:
- arabic টাইপ → top-symbol fixed থাকে ✓
- Enter চাপ → next row-এ focus ✓
- শেষ row overflow → পরবর্তী page-এ cascade ✓
- history strip-এ click → row flash ✓
- "আগেরটা দেখাও" → ৫সে preview তারপর auto-restore ✓
- reset → master verses.json থেকে restore ✓

Approve করলে ধারাবাহিকভাবে সব ফাইল প্রয়োগ করা হবে।
