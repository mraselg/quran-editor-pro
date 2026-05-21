# Studio Al-Qalam — Task Tracker

## Phase 1 — Immediate Fixes 🔴 ✅ DONE

### 1.1 SSR Hydration (architecture review)
- [x] `src/data/pages.ts` — SSR skeleton pattern verified (loaded in client, no mismatch)
- [x] SSR pages.ts module-level call uses `!mounted` guard in Workspace → safe

### 1.2 Build Progress Tracking
- [x] `src/state/reflowStore.ts` — `BuildProgress` type added
- [x] `init()` — 4-stage real progress (5%→20%→40%→70%→100%)
- [x] `rebuildPage()` — idle-scheduled (non-blocking)

### 1.3 Boot Progress Indicator
- [x] `src/components/studio/Workspace.tsx` — real `buildProgress` bar shows %
- [x] BootOverlay shows during `buildProgress !== null`

## Phase 2 — UI/UX উন্নতি 🟡 ✅ DONE

### 2.2 CanvasToolbar উন্নতি
- [x] Editable zoom input (click % → type exact value, Enter/Escape)
- [x] `buildProgress` status label in toolbar

### 2.3 Inspector Export Tab
- [x] Replaced placeholder with functional ExportPanel
- [x] "বর্তমান পেজ প্রিন্ট/PDF" button
- [x] "সব পেজ প্রিন্ট/PDF" button
- [x] Print tips section

## Phase 3 — নতুন Features 🟢 ✅ DONE

### 3.1 TopBar উন্নতি
- [x] PDF export → `window.print()` connected
- [x] `?` help button → Keyboard shortcuts modal
- [x] Modal: 18 shortcuts in 5 groups (বাংলায়)
- [x] Backdrop blur, ESC close, click-outside close

## Phase 4 — Verify Tool 🔵 ✅ DONE

### 4.1 Unified Verify Page
- [x] `src/routes/verify.tsx` — validateSearch URL params (?surah=2&from=1&to=7)
- [x] ১১৪ সূরার dropdown (আয়াত সংখ্যা সহ)
- [x] শুরু/শেষ আয়াত input (auto-clamp + auto-reset on surah change)
- [x] Quick links: ফাতিহা, বাকারা, ফাতহ, ইখলাস
- [x] Dynamic page title + empty state UI
- [x] "স্টুডিওতে ফিরুন" back button
- [x] `src/routes/verify-fath.tsx` — /verify?surah=48&from=1&to=10 redirect

## Future (Phase 5)
- [ ] Custom tajweed .woff2 font
- [ ] SQLite DAL (ElectronDAL)
- [ ] High-DPI PNG export (html2canvas)
