### লক্ষ্য
এডিটরের ইতিহাস (history) ব্যবস্থা, ওভাররাইড সংরক্ষণ, প্রপার্টিজ প্যানেল এবং আরবি টেক্সট/সিম্বল reflow — সব মিলিয়ে একটি সম্পূর্ণ "non-destructive, page-scoped, change-only" এডিটিং মডেল বানানো।

কোডবেস ক্লোন করে পর্যালোচনা করা হয়েছে: `state/overridesStore.ts`, `state/historyStore.ts`, `state/editorStore.ts`, `state/reflowStore.ts`, `components/studio/{TopBar,PropertiesPanel,Workspace,Inspector,FabricLines,TopSymbolLayer}.tsx`, এবং `lib/textReflow.ts`। বেশিরভাগ অবকাঠামো ইতিমধ্যেই আছে — পরিবর্তনগুলো মূলত আচরণ ঠিক করা ও UI পুনঃসংগঠিত করা।

---

### ১. নন-ডেস্ট্রাক্টিভ পেজ-স্কোপড ওভাররাইড (master data সর্বদা অপরিবর্তিত)
ইতিমধ্যে আংশিক সঠিক: master verses `data/verses.json` থেকে আসে এবং প্রতি-row এডিটগুলো `overridesStore.local[layer:pageId:rowIndex:arabic|bangla]` এ `text` ফিল্ডে যায় (master কখনোই mutate হয় না)। কাজ যা বাকি:
- নিশ্চিত করা যে কোনো রিসেট/clearLocal পথ master কে পরিবর্তন করছে না — কেবল override ডিলিট করছে।
- `getEffectiveText()` কে FabricLines render path-এ একক উৎস বানানো (currently দুই জায়গায় বিচ্ছিন্নভাবে পড়া হয়)।
- Per-page override এর "আমার এই পেজের ১ম লাইনের আরবি ডিলিট করলাম" পরিস্থিতিতে: override-এ `text: ""` সেট হবে; original `arabic` অপরিবর্তিত থাকবে; "Reset row" বাটন override delete করে original-এ ফিরবে।

### ২. History — শুধুমাত্র প্রকৃত পরিবর্তনে, "commit on blur" নীতি
সমস্যা: `patchLocal()` কে শুধু সিলেক্ট করলেই কখনো কখনো default field push হয় (যেমন `align: "justify"`) — এতে noise history তৈরি হয়।
- `historyStore.captureHistory()`-এ `before === after` চেক ইতিমধ্যেই আছে; কিন্তু `undefined → defaultValue` কেও "change" ধরছে। নতুন নিয়ম: যদি `before === undefined` এবং `after` সেই field-এর default-এর সমান হয় → skip।
- `PropertiesPanel`-এ `CharacterPanel`/scope-selector mount হলে কোনো `patchLocal` কল হবে না (currently `align ?? "justify"` শুধু display fallback — পরীক্ষা করে নিশ্চিত করতে হবে আসলে কোনো setter trigger হচ্ছে না; যদি হয়, gate দিতে হবে)।
- টেক্সট এডিটে: এখন প্রতিটি `onInput` overflow-time `patchLocal({ text })` ডাকে → প্রতি কী-স্ট্রোকে history। পরিবর্তন: টেক্সটের জন্য history-capture কে blur/Enter commit-এর মুহূর্তে move করা; intermediate overflow-save গুলো `_restoringHistory`-জাতীয় flag (`_silentTextEdit`) দিয়ে gate করা যাতে শুধু চূড়ান্ত commit একটি single history entry তৈরি করে।

### ৩. উপরের টুলবারে Reset আইকনের জায়গায় History strip
- বর্তমান `PropertiesPanel > ResetGroup`-এর "সব রিসেট করুন" বাটন **সরানো হবে** (অথবা Inspector-এ কম-গুরুত্বপূর্ণ জায়গায়)।
- Undo/Redo-এর পাশে একটি horizontal scrollable "Recent changes" strip যোগ হবে যেটা `useHistoryStore.entries`-এর শেষ ৫-৭ entry দেখাবে (label + scope chip)। ক্লিকে → ৪ নম্বর ফিচার।

### ৪. প্রতিটি history item-এ "পুনরুদ্ধার" + নতুন "আগেরটা দেখাও" (Preview-previous) বাটন
- নতুন বাটন: 5-সেকেন্ড preview mode। ক্লিকে:
  1. বর্তমান override snapshot stash করা হয়।
  2. ঐ entry-র `before`-state restore (snapshot prior to that entry — `entries[idx-1].snapshot` ব্যবহার, প্রথম entry হলে empty default)।
  3. বাটন disabled হয়ে `5 → 0` count-down দেখাবে।
  4. 5s পর stash থেকে আগের state restore হবে। মাঝপথে user অন্য preview চাইলে cancel + restart।
- সম্পূর্ণটা `_restoringHistory` flag দ্বারা রক্ষিত — preview/revert কোনো নতুন history entry তৈরি করবে না।

### ৫. History item → page/row-এ jump + 1s flash
ইতিমধ্যে `editorStore.navigateTo(pageId, rowKey)` ও `focusedRowKey` (1.2s auto-clear) আছে এবং `Workspace`-এ `navigateToPageId` consume হয়।
- `HistoryTab` ও নতুন top-bar history strip উভয়ের প্রতিটি item-এ onClick → `navigateTo(entry.pageId, rowKey(entry.pageId, entry.rowIndex))` কল।
- FabricLines-এর row container-এ `focusedRowKey === thisRowKey` হলে 1s amber outline / glow animation যোগ করা।

### ৬. Properties window — collapsed by default, আইকনে expand
`Inspector`-এ `propsPanelOpen` state ইতিমধ্যে আছে এবং default `false`। কাজ:
- নিশ্চিত করা যে কোনো row সিলেক্ট করলে auto-expand না হয় (currently `setSelection` → `layerPanelOpen: true` করে — সেটাকে সিলেক্ট-এর জন্য রেখে দিয়ে Properties panel-কে শুধু header chevron click দ্বারা toggle করা)।
- Header-এ একটি দৃশ্যমান chevron/expand আইকন এবং tooltip "প্রপার্টিজ খুলুন/বন্ধ করুন"।

### ৭. টপ-সিম্বল (Tajweed) সর্বদা rule-অনুসারে আরবি অক্ষরের সরাসরি উপরে
- `TopSymbolLayer` ইতিমধ্যে `displayArabic`-এর উপর `detectTajweed` চালায় ও `measureCharCenter` দিয়ে x position মাপে — তাই আরবি text edit হলে symbol re-position হয়।
- বাগ যেটা ঠিক করতে হবে: edit চলাকালীন (`isEditing`) span unmount → measurement fail → symbol হারিয়ে যায়। সমাধান: edit-mode-এ একটি hidden mirror span রাখা (`visibility:hidden`) যাতে symbol layer measurement চালিয়ে যেতে পারে এবং blur-এর সাথে সাথে snap into place করে।
- নিশ্চিত করা যে symbol Y-band-এর মধ্যে fixed (already enforced by `BASE_SYMBOL_Y` + global `symbolYOffset`)।

### ৮. ডাইনামিক reflow — Enter line-break + last-line page-overflow
ইতিমধ্যে `reflowFrom()`, `splitToFit()`, এবং `handleKeyDown` (Enter) সম্পূর্ণ surah জুড়ে cascade করে। কাজ:
- বর্তমান কোডে Enter চাপলে `committedRef.current = true` সেট হয় কিন্তু editor `setActiveTool("select")` ছাড়ে না → user উল্টে আবার type করতে পারে যা পরবর্তী row-এ chaos আনে। Enter-এর পর automatically পরের row-এর editor-এ focus move করা।
- শেষ row overflow → `allPages` সম্পূর্ণ surah-জুড়ে cascade ইতিমধ্যে আছে; কিন্তু new page যদি অন্য surah হয় সেটা skip করা (overflow নিজের surah-এ সীমাবদ্ধ)।
- backspace-এ row খালি হলে পরের row থেকে text "টেনে আনা" (reverse cascade) — optional polish, তবে full-dynamic অভিজ্ঞতার জন্য দরকার।

---

### টেকনিক্যাল ডিটেইল
- `state/historyStore.ts`: `HistoryEntry`-এ `beforeSnapshot` যোগ (currently শুধু `snapshot = after-state`)। Preview-previous এটা ব্যবহার করবে।
- `captureHistory()`-এ default-equality skip এবং একটি `silent` mode।
- নতুন store: `previewStore` (zustand) — `{ activeEntryId, secondsLeft, stashedSnapshot, start(id), cancel() }`। `setInterval` দিয়ে countdown, 0-তে auto-restore।
- নতুন component: `components/studio/TopHistoryStrip.tsx` — Workspace top বা CanvasToolbar-এ mount।
- `PropertiesPanel`-এ `ResetGroup` থেকে "সব রিসেট" বাটন সরিয়ে Inspector-এর Export/Settings টাবে move।
- `FabricLines`-এর row wrapper-এ `focusedRowKey`-চালিত flash class (`animate-pulse` + 1s ring-amber)।

### ফাইল পরিবর্তনের তালিকা
1. `src/state/historyStore.ts` — beforeSnapshot, default-skip, silent mode।
2. `src/state/previewStore.ts` *(নতুন)* — 5s preview-previous logic।
3. `src/state/overridesStore.ts` — text-edit-এর জন্য silent capture flag; default-equality guard।
4. `src/components/studio/TopHistoryStrip.tsx` *(নতুন)*।
5. `src/components/studio/CanvasToolbar.tsx` — Reset আইকন সরিয়ে TopHistoryStrip mount।
6. `src/components/studio/PropertiesPanel.tsx` — HistoryTab-এ "আগেরটা দেখাও" বাটন, item click → navigate, ResetGroup ছাঁটাই।
7. `src/components/studio/Inspector.tsx` — Properties collapsed-by-default নিশ্চিত, expand আইকন আরও স্পষ্ট।
8. `src/components/studio/FabricLines.tsx` — Enter-এর পর next row focus, focused-row flash, edit-mode mirror span।
9. `src/components/studio/TopSymbolLayer.tsx` — isEditing চলাকালীনও measurement চালু রাখা।
10. `src/state/editorStore.ts` — `setSelection`-এ auto-open layerPanel আচরণ বজায়, কিন্তু Inspector Properties panel খোলা/বন্ধ আলাদা রাখা।

### টেস্টিং / যাচাই
- Manual: পেজ ১-এর row 1 আরবি ডিলিট → master `verses.json` অপরিবর্তিত; reset row → original ফিরে আসে।
- শুধু row সিলেক্ট করলে history-তে নতুন entry তৈরি হয় না।
- Enter মাঝখানে → পরের row-এ split; শেষ row-এ overflow → পরের পেজে cascade।
- History item click → ঠিক পেজে jump + 1s amber flash।
- "আগেরটা দেখাও" → 5s countdown, পরে auto-restore; অন্য preview ক্লিকে cancel।
- Tajweed symbol edit চলাকালীনও আরবি অক্ষরের center-এর উপর থাকে।