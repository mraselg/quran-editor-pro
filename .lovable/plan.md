# পারফরম্যান্স অপটিমাইজেশন প্ল্যান

বর্তমান অবস্থা: শুধু `active` পেজ DOM-এ render হয় (`<Artboard page={active} />`), কিন্তু প্রতিটি keystroke / slider tick এ পুরো `Artboard` + ৯টি `FabricLines` row রি-রেন্ডার হচ্ছে কারণ store subscription গুলো coarse। তাই পারফরম্যান্স ইস্যুর আসল উৎস ভার্চুয়ালাইজেশন না — স্টেট সিলেক্টর এবং memoization।

প্ল্যানটি ৩টি অংশে বিভক্ত। প্রতিটি ধাপ আলাদা commit হিসেবে যাবে যাতে regression সহজে ধরা যায়।

---

## ১. রেন্ডারিং মডেল সিদ্ধান্ত (Canvas vs DOM)

বর্তমান DOM/HTML রেন্ডারার রাখা হবে — Canvas/Fabric.js-এ migrate করা **এই plan-এর scope বহির্ভূত** কারণ:

- আরবি shaping, RTL bidi, contentEditable inline edit, Tajweed SVG overlay, selection ring — সবই browser text engine-এর উপর নির্ভর। Canvas-এ এগুলো নতুন করে লিখতে হবে (~১-২ সপ্তাহ কাজ)।
- বর্তমান bottleneck পরিমাপ না করে rewrite করলে একই slow code শুধু canvas-এ চলে যাবে।

পরিবর্তে DOM-কে দ্রুততর করব selector + memoization দিয়ে। যদি এর পরেও ৬০ fps না পাওয়া যায়, তখন আলাদা প্ল্যানে Canvas migration প্রস্তাব করা হবে।

---

## ২. ৩-পেজ ভার্চুয়ালাইজেশন (prev / active / next)

বর্তমানে শুধু active পেজ render হয়, prev/next pre-render হয় না — পেজ switch করার সময় ~১৫০ms জ্যাঙ্ক দেখা যায়।

পরিবর্তন:

- `Workspace.tsx`-এ `<Artboard page={active} />` এর জায়গায় ৩টি Artboard render হবে:
  - `prev` (visibility: hidden, pointer-events: none, absolute)
  - `active` (visible)
  - `next` (visibility: hidden)
- React.memo + stable `page` reference থাকার কারণে hidden পেজগুলো শুধু একবার mount/render হবে।
- পেজ switch → CSS class swap, কোনো নতুন mount নেই → instant navigation।
- বাকি (n-3) পেজ unmounted, memory free।

```text
┌─ scroll container ──────────────────┐
│  [prev hidden]  [active]  [next hidden] │
└─────────────────────────────────────┘
```

---

## ৩. State Selector + Memoization (আসল গতি বৃদ্ধি)

এটাই সবচেয়ে বড় win দেবে। সমস্যাগুলো:

**ক) `FabricLines` এ coarse subscription:**
```ts
const localMap = useOverridesStore((s) => s.local);  // পুরো object
```
যেকোনো row override পরিবর্তনে সব ৯ row রি-রেন্ডার হয়। সমাধান: প্রতিটি row-কে আলাদা `<FabricRow>` কম্পোনেন্টে বের করে আনব, এবং সেই কম্পোনেন্ট shallow-equal selector দিয়ে শুধু নিজের row + layer override subscribe করবে।

**খ) Global slider subscriptions:**
`gArabic`, `gBangla`, `gArabicY` ইত্যাদি প্রতিটি render-এ পৃথক selector — Zustand-এ এটাই idiom, কিন্তু `useShallow` দিয়ে এক object selector-এ একত্রিত করলে allocation কমবে।

**গ) `Artboard` re-measure effect:**
`useEffect([selection, hover, page, localMap, zoom])` — `localMap` change এ প্রতিবার re-measure চলে। `localMap`-এর জায়গায় শুধু `selection?.key` এবং `hover?.key`-এর override পরিবর্তন track করব।

**ঘ) Inline edit এ typing performance:**
বর্তমানে `handleInput` overflow check + `splitToFit` করে প্রতিটি keystroke এ। এটা rAF-throttle করব — দ্রুত typing-এ শুধু শেষ frame পরিমাপ হবে।

**ঙ) `React.memo` audit:**
`Artboard` ইতিমধ্যে memo, কিন্তু `page` prop প্রতি keystroke এ নতুন reference পেতে পারে যদি `useReflowStore` rebuild ট্রিগার হয়। নিশ্চিত করব `text` override শুধু DOM render path-এ যায়, `reflowStore.rebuild` এ ঢোকে না (এটা ইতিমধ্যে আছে — confirm করব)।

`Artboard` ভিতরের child কম্পোনেন্ট (`SlimHeader`, `SlimFooter`, `ArchedHeader`, `BismillahBox`, `SurahOpenBlock`) — `React.memo` দিয়ে wrap করব যাতে শুধু `FabricLines` portion update হয়।

---

## পরিবর্তনের তালিকা

| ফাইল | কাজ |
|------|-----|
| `Workspace.tsx` | ৩-পেজ window render (prev/active/next), visibility-toggle |
| `FabricLines.tsx` | প্রতিটি row আলাদা `<FabricRow memo>`; row + 3 layer override fine-grained selector; `useShallow` দিয়ে global slider grouping |
| `FabricLines.tsx` (InlineTextEditor) | `handleInput` rAF-throttle; overflow check একবারই/frame |
| `Artboard.tsx` | Re-measure effect dependency সংকুচিত; child কম্পোনেন্টে `memo` |
| `SlimHeader/SlimFooter/ArchedHeader/BismillahBox/SurahOpenBlock` | `React.memo` wrap |
| `TopSymbolLayer.tsx` | `MutationObserver` throttle (rAF) |

কোনো বিজনেস লজিক, store shape, undo/redo, বা UI পরিবর্তন হবে না — শুধু render path।

---

## ভেরিফিকেশন

১. Browser performance profiler (`browser--start_profiling`) দিয়ে আগে/পরে measure:
   - একটি আরবি অক্ষর টাইপ → expected: <16ms commit time (এক frame)।
   - Slider drag → 60 fps সারা time।
   - পেজ next/prev → instant (কোনো mount cost নেই)।
২. Live preview এ ৩ পেজে edit করে দেখব history, top symbol, reflow সব আগের মতই কাজ করছে।
৩. React DevTools Profiler দিয়ে confirm করব শুধু active row রি-রেন্ডার হচ্ছে, পুরো `FabricLines` না।

---

## ঝুঁকি ও সীমাবদ্ধতা

- ৩-পেজ render → memory ব্যবহার ~৩x (acceptable, একেকটা পেজ ~৩MB DOM)।
- Fine-grained selector ভুল হলে stale render হতে পারে — তাই প্রতিটি change-এর পর live verify আবশ্যক।
- Canvas migration ভবিষ্যতে দরকার হলে আলাদা proposal দেব profile data সহ।
