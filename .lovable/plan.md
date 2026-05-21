# পরিকল্পনা: "প্রয়োগ" অপশনে "সাধারণ" যুক্ত করা

## লক্ষ্য
বর্তমান scope তালিকা `row | page | surah | para | global` কে পরিবর্তন করে নতুন তালিকা করা:

**নতুন তালিকা:** `সাধারণ (general)` → `পেজ (page)` → `সূরা (surah)` → `সকল (global)`

- "পারা (para)" এবং পুরনো "সারি (row)" বাদ যাবে।
- **সাধারণ** হবে ডিফল্ট — শুধুমাত্র নির্দিষ্ট সিলেক্টেড একক উপাদানে (যে আরবি লাইন/বাংলা লাইন/সাংকেতিক চিহ্ন ক্লিক করা হয়েছে) পরিবর্তন প্রয়োগ হবে।
- **পেজ / সূরা / সকল** — সিলেক্টেড উপাদানের *ধরন* (kind: arabic-row / bangla-row / symbol / header / footer ইত্যাদি) অনুযায়ী সংশ্লিষ্ট scope-এর সব সমধর্মী উপাদানে একসাথে পরিবর্তন প্রয়োগ হবে।

## আচরণ উদাহরণ
- সাধারণ + বাংলা লাইন ক্লিক → শুধু ঐ একটি বাংলা লাইন পরিবর্তন।
- সূরা + বাংলা লাইন ক্লিক → ঐ সূরার সব পেজের সব বাংলা লাইন একসাথে পরিবর্তন।
- পেজ + আরবি লাইন ক্লিক → ঐ পেজের সব আরবি লাইন।
- সকল + সাংকেতিক চিহ্ন → সব পেজের সব সাংকেতিক চিহ্ন।

## পরিবর্তনযোগ্য ফাইল

1. **`src/state/editorStore.ts`**
   - `SelectionScope` টাইপ: `"general" | "page" | "surah" | "global"`
   - ডিফল্ট `scope: "general"`
   - `legacyScope` ম্যাপিং আপডেট (general → local)

2. **`src/state/overridesStore.ts`**
   - `applyChange` লজিকে নতুন scope-ভিত্তিক ফিল্টার:
     - `general` → শুধু target layerKey
     - `page` → একই pageId + একই kind এর সব layerKey
     - `surah` → একই surahId-এর সব পেজের একই kind
     - `global` → সব পেজের একই kind
   - `kind` resolver যোগ (layerKey থেকে kind বের করার হেল্পার)।

3. **`src/components/studio/CanvasToolbar.tsx`**
   - `SCOPES` array আপডেট: `["general", "page", "surah", "global"]`
   - `SCOPE_META`-তে "সাধারণ" এন্ট্রি যোগ, "row"/"para" বাদ।

4. **`src/components/studio/PropertiesPanel.tsx`**
   - একই scope তালিকা + meta আপডেট।
   - `(scope === "page" || scope === "row")` শর্তগুলো `scope !== "global"`–জাতীয় নতুন শর্তে রিফ্যাক্টর।

5. **`src/state/historyStore.ts`**
   - হিস্টোরি এন্ট্রির `scope` ফিল্ডে নতুন ভ্যালু সাপোর্ট; পুরনো `"row"`/`"para"` এন্ট্রি পড়ার সময় `"general"`/`"global"`-এ ম্যাপ করার ব্যাকওয়ার্ড-কম্প্যাট শিম।

6. **`src/components/studio/Artboard.tsx` / `FabricLines.tsx`**
   - সিলেকশন হ্যান্ডলিংয়ে scope=general হলে আগের মতো single layer; অন্যথায় kind-গ্রুপ হাইলাইট/প্রিভিউ।

## টেস্ট চেকলিস্ট (বাস্তবায়নের পর)
- [ ] সাধারণ ডিফল্ট হিসেবে লোড হয়।
- [ ] সাধারণ + আরবি লাইনে অতিরিক্ত লেখা → শুধু ঐ লাইন reflow, অন্য লাইন/পেজে প্রভাব নেই।
- [ ] পেজ + বাংলা ফন্ট সাইজ → ঐ পেজের সব বাংলা লাইন বদলায়।
- [ ] সূরা + সাংকেতিক চিহ্ন রঙ → পুরো সূরার সব পেজে প্রয়োগ।
- [ ] সকল + আরবি ফন্ট ফ্যামিলি → সব পেজে প্রয়োগ।
- [ ] হিস্টোরি ড্রপডাউন নতুন scope লেবেল দেখায় ও restore কাজ করে।
- [ ] পুরনো সেভ ডেটা (row/para) লোড হলে ক্র্যাশ হয় না।

## নোট
- বর্তমান বাগ ফিক্স (history portal, text edit persistence) ইতিমধ্যে প্রয়োগ করা আছে — পূর্ববর্তী টেস্টে history dropdown ও inline text editor কাজ করছে confirmed। এই নতুন scope পরিবর্তন তার উপরে যোগ হবে।
- Electron প্যাকেজিং পৃথক loop-এ হবে।
