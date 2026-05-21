# Lovable Task — Critical Bug Fix: Scope Fan-out + Font Size Display
**তারিখ:** ২১ মে ২০২৬  
**অগ্রাধিকার:** 🔴 Critical — এটি সবচেয়ে গুরুত্বপূর্ণ সমস্যা  
**ক্রম:** Plan #4

---

## পটভূমি (ব্রাউজার চেক থেকে পাওয়া তথ্য)

ব্রাউজার পরীক্ষায় নিম্নলিখিত ২টি গুরুতর বাগ পাওয়া গেছে:

### বাগ ১ — "পেজ" স্কোপ সব পেজে প্রভাব ফেলছে (Global হয়ে যাচ্ছে)
- পেজ স্কোপ সিলেক্ট করে আরবি ফন্ট সাইজ ৭০ করায় **সমগ্র কোরআনের সব পেজ** পরিবর্তন হয়ে গেছে
- পেজ সংখ্যা ১,১৬৪ থেকে বেড়ে ১,৮৫৪ হয়ে গেছে (কারণ বড় ফন্টে overflow)
- **কারণ:** `DSlider`-এর `applyValue()` সঠিকভাবে `patchScoped()` কল করছে না — `setGlobal()` কল হচ্ছে

### বাগ ২ — ফন্ট সাইজ ভুল মান দেখাচ্ছে (845 দেখাচ্ছে 45 এর বদলে)
- Right panel-এ "আরবি ফন্ট" সাইজ দেখাচ্ছে **845** — কিন্তু প্রকৃত মান **45**
- **কারণ:** display value calculation-এ `localValue ?? stored ?? fallback` logic-এ কোনো unit conversion সমস্যা

---

## বাগ ১ ঠিক করুন — `PropertiesPanel.tsx`-এর `DSlider`

### সমস্যার মূল কারণ

`DSlider`-এ `isLocalScope` check সম্ভবত সঠিকভাবে কাজ করছে না। নিচের পুরো DSlider function-টি replace করুন:

```typescript
function DSlider({ 
  k, 
  localField,
  label, min, max, fallback, color 
}: {
  k: keyof GlobalOverrides;
  localField?: keyof LocalOverride;
  label: string;
  min: number; max: number; fallback: number; color: string;
}) {
  const stored = useOverridesStore((s) => s.global[k]);
  const setGlobal = useOverridesStore((s) => s.setGlobal);
  const scope = useEditorStore((s) => s.scope);
  const selection = useEditorStore((s) => s.selection);
  const [dragging, setDragging] = useState<number | null>(null);

  // Local override: শুধু তখনই পড়ব যখন localField আছে এবং selection আছে
  const selKey = selection?.key ?? null;
  const localOverride = useOverridesStore((s) => selKey ? s.local[selKey] : undefined);
  const localValue = (localField && localOverride) 
    ? (localOverride[localField] as number | undefined) 
    : undefined;

  // isLocalScope: true মানে global store নয়, local store-এ লিখব
  const isLocalScope = scope !== "global" && selKey !== null && localField !== undefined;

  // Display value:
  // - Local scope + local override আছে → local value দেখাও
  // - অন্যথায় → global stored value বা fallback দেখাও
  const effectiveValue = isLocalScope 
    ? (localValue ?? stored ?? fallback) 
    : (stored ?? fallback);
  const display = dragging ?? effectiveValue;

  // isOverridden: reset button দেখানোর জন্য
  const isOverridden = isLocalScope ? localValue !== undefined : stored !== undefined;

  const applyValue = (v: number) => {
    setDragging(null);
    if (!isLocalScope) {
      // Global scope বা selection নেই → সবসময় setGlobal
      setGlobal(k, v);
    } else {
      // Local scope → patchScoped দিয়ে শুধু নির্বাচিত scope-এ apply করো
      // IMPORTANT: selKey এবং localField অবশ্যই defined এখানে
      void patchScoped(selKey!, { [localField!]: v } as never, scope);
    }
  };

  const resetValue = () => {
    setDragging(null);
    if (!isLocalScope) {
      setGlobal(k, undefined);
    } else {
      void patchScoped(selKey!, { [localField!]: undefined } as never, scope);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium text-neutral-400">{label}</span>
        <div className="flex items-center gap-1">
          <input 
            type="number" 
            value={display}
            onChange={(e) => applyValue(Number(e.target.value))}
            className="w-12 rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-right text-[11px] font-mono outline-none focus:border-amber-400"
            style={{ color: isOverridden ? color : "#737373" }} 
            step={1} min={min} max={max} 
          />
          {isOverridden && (
            <button 
              onClick={resetValue} 
              className="ml-1 text-neutral-600 hover:text-amber-400" 
              title="Reset"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <input 
        type="range" min={min} max={max} value={display}
        onInput={(e) => setDragging(Number((e.target as HTMLInputElement).value))}
        onChange={(e) => applyValue(Number((e.target as HTMLInputElement).value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ 
          accentColor: color, 
          background: `linear-gradient(to right, ${color} ${((display - min) / (max - min)) * 100}%, #262626 0%)` 
        }}
      />
    </div>
  );
}
```

---

## বাগ ২ ঠিক করুন — Font size display value 845 সমস্যা

### সমস্যার কারণ অনুসন্ধান

Right panel-এ 845 দেখানোর কারণ হল `CharacterPanel` component (Type Tool active থাকলে দেখায়)।  
`CharacterPanel`-এ:
```typescript
const fontPx = ov.fontPx ?? 0;
```
এই `fontPx` value সরাসরি `LocalOverride.fontPx` থেকে আসে।

কিন্তু `ControlsTab`-এর আরবি ফন্ট slider (`DSlider k="arabicFontPx"`) গ্লোবাল `arabicFontPx` দেখায় — এটা আলাদা।

**সমস্যা:** দুটো আলাদা store থেকে value পড়া হচ্ছে:
- `CharacterPanel.fontPx` → `LocalOverride.fontPx` (0 যদি set না থাকে)
- `DSlider arabicFontPx` → `GlobalOverrides.arabicFontPx` (45)

`CharacterPanel`-এ যদি `localField.fontPx` না থাকে, global fallback দেখানো উচিত:

```typescript
// CharacterPanel function-এ:
function CharacterPanel({ selKey }: { selKey: string }) {
  const localMap = useOverridesStore((s) => s.local);
  const globalArabicFontPx = useOverridesStore((s) => s.global.arabicFontPx);
  const globalBanglaFontPx = useOverridesStore((s) => s.global.banglaFontPx);
  const scope = useEditorStore((s) => s.scope);
  const ov = localMap[selKey] ?? {};

  // fontPx: local override থাকলে সেটা, না থাকলে global value, না থাকলে default
  // selKey থেকে layer type বের করুন (arabic/bangla)
  const isArabicLayer = selKey.includes(":arabic");
  const globalFallback = isArabicLayer 
    ? (globalArabicFontPx ?? ARABIC_FONT_PX)  // 50
    : (globalBanglaFontPx ?? BANGLA_FONT_PX);  // 18
  
  const fontPx = ov.fontPx ?? globalFallback;  // ← এটি ঠিক করুন (আগে ?? 0 ছিল)
  
  // ... বাকি সব একই ...
}
```

**`ARABIC_FONT_PX` এবং `BANGLA_FONT_PX` import করুন:**
```typescript
import { ARABIC_FONT_PX, BANGLA_FONT_PX } from "./FabricLines";
```

---

## patchScoped সঠিকভাবে কাজ করছে কিনা যাচাই করুন

`overridesStore.ts`-এর `getScopedLayerKeys` function-টি চেক করুন:

```typescript
// scope = "page" এর ক্ষেত্রে:
// representativeKey = "layer:vpage-2:2:arabic"
// এটি parse করে pageId = "vpage-2", layer = "arabic" বের করবে
// তারপর সেই পেজের সব rows-এ "layer:vpage-2:0:arabic" থেকে "layer:vpage-2:8:arabic" পর্যন্ত return করবে

// যদি এই function সঠিকভাবে কাজ না করে, তাহলে নিচের debug code যোগ করুন:
export async function getScopedLayerKeys(
  representativeKey: LocalKey,
  scope: SelectionScope,
): Promise<LocalKey[]> {
  if (scope === "general") return [representativeKey];
  
  const parsed = parseLayerKey(representativeKey);
  console.log("[getScopedLayerKeys] parsed:", parsed, "scope:", scope); // ← debug
  
  if (!parsed) return [representativeKey];
  // ... বাকি code
```

console.log output দেখে বুঝবেন parsing সঠিক কিনা।

---

## TypeScript যাচাই

```bash
npx tsc --noEmit
```

---

## যাচাইকরণ চেকলিস্ট

- [ ] "সাধারণ" স্কোপে font slider → শুধু সেই ১টি layer পরিবর্তন হয়
- [ ] "পেজ" স্কোপে font slider → শুধু সেই পেজের Arabic rows পরিবর্তন হয় (অন্য পেজ অপরিবর্তিত)
- [ ] "সূরা" স্কোপে → শুধু সেই সূরার পেজগুলো প্রভাবিত হয়
- [ ] "সকল" স্কোপে → পুরো কোরআনে প্রভাব পড়ে
- [ ] CharacterPanel-এ Font Size সঠিক মান দেখায় (45, 50 ইত্যাদি — 845 নয়)
- [ ] পেজ সংখ্যা পেজ স্কোপে পরিবর্তন হওয়ার পর অস্বাভাবিকভাবে বাড়ে না
- [ ] `npx tsc --noEmit` clean
