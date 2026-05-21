# Studio Al-Qalam — Plans Index
## সব পরিকল্পনা ও কাজের রেকর্ড

---

## পরিকল্পনার তালিকা

| তারিখ | ফাইল | বিষয় | স্ট্যাটাস |
|-------|------|-------|----------|
| ২১ মে ২০২৬ | [2026-05-21_praoyog-refactor.md](./2026-05-21_praoyog-refactor.md) | প্রয়োগ সিস্টেম পুনর্গঠন | ⏳ পাঠানো হয়েছে |
| ২১ মে ২০২৬ | [2026-05-21_png-export-task.md](./2026-05-21_png-export-task.md) | PNG Export (html2canvas) | 📋 পরবর্তী |
| ২১ মে ২০২৬ | [2026-05-21_history-quickpublish-task.md](./2026-05-21_history-quickpublish-task.md) | History Panel + Quick Publish | 📋 পরবর্তী |
| ২১ মে ২০২৬ | [2026-05-21_scope-fanout-bugfix.md](./2026-05-21_scope-fanout-bugfix.md) | 🔴 Scope বাগ + Font 845 বাগ | 🚨 এখনই দরকার |

---

## ব্রাউজার চেক রিপোর্ট — ২১ মে ২০২৬

### ✅ কাজ করছে
- Editor mode toggle ✅
- Scope buttons: সাধারণ / পেজ / সূরা / সকল ✅
- Type Tool (T) দিয়ে layer select হচ্ছে ✅
- History tab entries দেখায় ✅
- Undo/Redo কাজ করছে ✅

### ❌ বাগ পাওয়া গেছে
1. **🔴 Critical:** "পেজ" স্কোপে font size → পুরো কোরআন পরিবর্তন (DSlider setGlobal করছে)
2. **🟠 Important:** CharacterPanel Font Size 845 দেখাচ্ছে (সঠিক 45) — `fontPx ?? 0` বদলাতে হবে
3. **🟡 Minor:** Toolbar "প্রভাব" → "প্রয়োগ" এখনো বাকি
4. **🟡 Minor:** "সারি বিস্তারিত" section এখনো দেখাচ্ছে

---

## গিটহাব: `ohidgazi00003-gif/QuranMakerV3` (branch: master)
