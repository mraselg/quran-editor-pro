## সমস্যার মূল কারণ ও সমাধান পরিকল্পনা

কোড পড়ে দুটি বাগের রুট-কজ চিহ্নিত হয়েছে। তৃতীয় অংশে PC (Electron) অ্যাপ বানানোর রোডম্যাপ।

---

### ১) হিস্টোরি আইকনে ক্লিক করলে লিস্ট দেখা যাচ্ছে না

**মূল কারণ — Overflow Clipping (CSS)**

`src/components/studio/Workspace.tsx` (line 307):
```tsx
<main className="flex flex-1 flex-col overflow-hidden">
  <CanvasToolbar ... />          {/* toolbar */}
  <div className="... overflow-hidden">  {/* canvas area */}
```

`CanvasToolbar`-এর ভিতরে History dropdown `position: absolute; top: full` দিয়ে toolbar-এর **নিচে** খোলে — কিন্তু parent `<main>`-এ `overflow-hidden` থাকায় ড্রপডাউনটি ক্লিপ হয়ে অদৃশ্য থাকে। বাটন কাজ করছে, state ঠিকই `histOpen=true` হচ্ছে, কিন্তু DOM-এ থাকলেও ভিউয়ে আসছে না।

পাশাপাশি: history entries `localStorage` (`studio-history-v2`)-এ persist হয়; পুরোনো session-এ যদি clear হয়ে থাকে তবে badge count = 0 দেখাবে।

**সমাধান:**
- ড্রপডাউনকে **React Portal** (`createPortal` to `document.body`) দিয়ে রেন্ডার করা; বাটনের `getBoundingClientRect()` দিয়ে fixed positioning। এতে কোনো parent overflow আর প্রভাব ফেলবে না।
- বিকল্প (lightweight): shadcn `Popover` / `DropdownMenu` component ব্যবহার — এগুলো Radix Portal-ভিত্তিক, একই সমস্যা স্বয়ংক্রিয়ভাবে এড়ায়।
- "কোনো ইতিহাস নেই" empty-state ঠিকই আছে; কিন্তু history capture যেন স্কিপ না হয় সেটি §২ ঠিক হলে স্বয়ংক্রিয়ভাবে fix হবে।

---

### ২) আরবি/বাংলা টেক্সট এডিট করার পর পরিবর্তন এপ্লাই হচ্ছে না

`src/components/studio/FabricLines.tsx`-এর `InlineTextEditor`-এ একাধিক race condition:

**ক) Blur না হয়েই unmount হলে stale text save হয়**

User যখন অন্য রো-তে ক্লিক করেন, mousedown → selection change → editor unmount, কিন্তু `onBlur` কখনো ফায়ার করে না (DOM node ততক্ষণে gone)। তখন `useEffect` cleanup এ:
```ts
if (!committedRef.current) {
  const text = el.textContent ?? "";
  if (!(text === "" && initialText !== "")) onSave(text);
}
```
এখানে `onSave` হলো প্রথম রেন্ডারে capture-হওয়া closure — পরে যদি parent re-render-এ `aLk` বদলায় (যদিও সাধারণত বদলায় না), তবু `patchLocal` ঠিক key-তেই যায়। কিন্তু সমস্যা হলো **rAF queue cancel-এর timing**: `cancelAnimationFrame` করা হলেও আগে scheduled `checkOverflow` ইতিমধ্যে chase-করে `splitToFit` দিয়ে `el.textContent`-কে পুরোনো "fits" version-এ রিসেট করে দিতে পারে। ফলে cleanup-এর সময় DOM-এ user-এর শেষ টাইপ-করা টেক্সট নেই — পুরোনো (truncated/original) টেক্সটই save হয়।

**খ) `splitToFit` overflow path-এ DOM mutation কিন্তু commit হয় না**

`checkOverflow` যখন overflow ডিটেক্ট করে, `patchLocal(lk, { text: fits })` করে আর `el.textContent = fits` সেট করে — কিন্তু `committedRef`-কে true করে না। তাই পরবর্তী blur-এ আবার অন্য টেক্সট save হতে পারে, বা onSave-এর last-write-wins-এ user-এর intent হারিয়ে যায়।

**গ) `useEffect([])` initialText capture-stale**

Editor mount-এর সময় `el.textContent = initialText` সেট হয়। কিন্তু এর পরে যদি একই layerKey-তে অন্য কোথাও থেকে `text` override আসে (যেমন অন্য row-এর reflow পাশের row-এ overflow ঠেলে দেয়), editor-এর DOM সেটা reflect করে না — user টাইপ চালিয়ে গেলে stale value-এর উপর টাইপ হয়, blur-এ stale value save হয়।

**ঘ) History capture skip**

`patchLocal`-এ `text` field-এর জন্য `before` সব সময় `undefined` (initially)। `captureHistory("text", undefined, t, ...)`-এ `FIELD_DEFAULTS["text"]` নেই, তাই entry তৈরি **হওয়ার কথা**। কিন্তু যদি §২(ক) বা (খ)-র কারণে `patchLocal` কখনো নাও কল হয়, তখন history-তেও কিছু আসবে না — যা §১-এর "list খালি" উপসর্গের সাথে মিলে যায়।

**সমাধান:**

1. **Single source of truth**: editor mount-এ একবারই `el.textContent` সেট করে, এরপর প্রতিটি keystroke-এ `patchLocal(lk, { text: el.textContent })` সরাসরি (rAF-throttled) — অর্থাৎ DOM-ই source, store-কে সিঙ্ক্রোনাসভাবে আপডেট রাখা।
2. **Overflow path**-এ `splitToFit` চালানোর পর `committedRef = true` সেট করা, এবং user যদি আরও টাইপ করে তাহলে নতুন pass-এ আবার false করে cycle শুরু।
3. **Cleanup-এর আগে pending rAF-কে synchronously flush** করা — cancel না করে `checkOverflow()` ডেকে ফেলা, যাতে শেষ টাইপ-করা টেক্সট store-এ যায়।
4. **Selection-change-এ explicit commit**: `editorStore`-এর `setSelection` middleware থেকে আগের editing-layer-এর `commit()` কে আগে চালানো (custom event বা ref-registry দিয়ে)।
5. **InlineTextEditor-এ `initialText` change detect**: যদি props-এর `initialText` editor-এর বর্তমান `textContent`-এর সাথে না মেলে এবং editor focused নয়, তবে DOM সিঙ্ক করা।
6. **History**: `text` field-এর জন্য captureHistory-এ `before` value পেতে `useOverridesStore.getState().local[lk]?.text ?? slot.arabic` ব্যবহার (currently `beforeOverride[mainField]` থেকে আসে, যা প্রথম এডিটে undefined — labelBn-এ "—" → text" দেখায়, কিন্তু entry তৈরি হয়)।

---

### ৩) টপ-সিম্বল (আয়াত নম্বর / sajda / ruku) সব সময় ফিক্সড রাখা

পূর্বের loop-এ `TopSymbolLayer.tsx` ও `FabricLines.tsx`-এ symbol positioning rules ছিল। text-edit এর পর reflow হলে নতুন `aText`-এর সাথে symbol position পুনরায় re-measure হওয়া উচিত। বর্তমানে `arabicSpanRef`-এর `MutationObserver` rAF-throttled — কিন্তু contenteditable editing-এ span unmount হয়ে যায় (editor div span-কে replace করে)। ফলে editor mode-এ symbol layer এর position-base hint missing।

**সমাধান:** editor mode-এ symbol position freeze করে রাখা (last measured offsets cache); blur/commit-এর পর re-measure trigger।

---

### ৪) PC Desktop App হিসেবে প্যাকেজ করা

**Stack:** Electron + `@electron/packager` (electron-builder নয় — sandbox-এ 7zip issue)।

**Steps:**
1. `vite.config.ts`-এ `base: './'` (file:// loading-এর জন্য)।
2. `electron/main.cjs` তৈরি — `BrowserWindow` যা `dist/index.html` লোড করে; `contextIsolation: true`, `nodeIntegration: false`।
3. `package.json`-এ `"main": "electron/main.cjs"`।
4. Build: `vite build` → `@electron/packager . "QuranStudio" --platform=<linux|darwin|win32> --arch=x64`।
5. Persistence: বর্তমানে `localStorage` ব্যবহৃত — Electron-এ পুরোপুরি কাজ করে; offline-ready।
6. Cross-build: একই Linux box থেকে macOS/Windows zip বানানো যায় (installer চাইলে user-এর local-এ electron-builder)।

---

### Verification Plan

1. **History dropdown**: Portal-এ মুভ করার পর toolbar-এর নিচে স্ক্রিনে visible হবে; একটি slider drag করে ও একটি text edit করে — দুটোই dropdown-এ আসবে।
2. **Text edit**: একটি আরবি লাইনে টাইপ → অন্য রো-তে click → প্রথম রোতে নতুন টেক্সট থাকবে (page refresh-এর পরও, localStorage থেকে restore)।
3. **Top symbol**: edit-এর আগে ও পরে আয়াত-নম্বর symbol-এর position একই থাকবে (visual diff)।
4. **Console**: hydration mismatch ছাড়া নতুন error থাকবে না।

### Files to change (build phase)
- `src/components/studio/CanvasToolbar.tsx` — Portal for history dropdown
- `src/components/studio/FabricLines.tsx` — InlineTextEditor commit logic
- `src/state/historyStore.ts` — small label fix for text entries
- `src/components/studio/TopSymbolLayer.tsx` — freeze during editor mode
- (পরে) `electron/main.cjs`, `vite.config.ts`, `package.json` — desktop packaging
