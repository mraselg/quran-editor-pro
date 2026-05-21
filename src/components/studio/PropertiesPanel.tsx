import { useState } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, BookOpen, Clock, Globe,
  RotateCcw, ScanLine, Type, Move
} from "lucide-react";
import { useEditorStore, type SelectionScope } from "@/state/editorStore";
import { useOverridesStore, type GlobalOverrides, patchScoped } from "@/state/overridesStore";
import { useHistoryStore, relativeTime } from "@/state/historyStore";
import { useReflowStore } from "@/state/reflowStore";
import { ARABIC_FONT_PX, BANGLA_FONT_PX } from "./FabricLines";

const SCOPE_META: Record<SelectionScope, { labelBn: string; color: string; icon: React.ElementType; desc: string }> = {
  general: { labelBn: "সাধারণ", color: "#f59e0b", icon: AlignJustify, desc: "শুধু নির্বাচিত উপাদান" },
  page:    { labelBn: "পেজ",   color: "#06b6d4", icon: ScanLine,     desc: "এই পেজের একই ধরনের সব উপাদান" },
  surah:   { labelBn: "সূরা",  color: "#8b5cf6", icon: BookOpen,     desc: "এই সূরার একই ধরনের সব উপাদান" },
  global:  { labelBn: "সকল",   color: "#10b981", icon: Globe,        desc: "সব পেজের একই ধরনের সব উপাদান" },
};
const SCOPES: SelectionScope[] = ["general", "page", "surah", "global"];

type Tab = "controls" | "history";

export function PropertiesPanel() {
  const scope = useEditorStore((s) => s.scope);
  const setScope = useEditorStore((s) => s.setScope);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const activeTool = useEditorStore((s) => s.activeTool);
  const [tab, setTab] = useState<Tab>("controls");
  const isTypeTool = activeTool === "type";
  const isLayerSel = selection?.kind === "layer";

  const meta = SCOPE_META[scope];

  return (
    <div className="flex flex-col gap-4">

      {/* ── Character & Paragraph Panel (Type Tool only) ── */}
      {isTypeTool && isLayerSel && selection && (
        <CharacterPanel selKey={selection.key} />
      )}
      {/* ── Tabs (Controls / History) ── */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
        <TabBtn active={tab === "controls"} onClick={() => setTab("controls")} color={meta.color}>
          ⚙ নিয়ন্ত্রণ
        </TabBtn>
        <TabBtn active={tab === "history"} onClick={() => setTab("history")} color={meta.color}>
          <Clock className="h-2.5 w-2.5 inline mr-1" />ইতিহাস
        </TabBtn>
      </div>

      {/* ── Scope Selector ── */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          প্রভাব স্তর (Scope)
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {SCOPES.map((s) => {
            const m = SCOPE_META[s];
            const SI = m.icon;
            const active = scope === s;
            return (
              <button key={s} onClick={() => setScope(s)}
                className="flex items-center gap-1 rounded px-2 py-1.5 text-[11px] font-semibold transition-all"
                style={active
                  ? { background: `${m.color}22`, border: `1px solid ${m.color}50`, color: m.color }
                  : { background: "#171717", border: "1px solid #262626", color: "#737373" }
                }
              >
                <SI className="h-3 w-3" />
                {m.labelBn}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selection Info Bar ── */}
      {selection && (
        <div className="flex flex-col gap-1 rounded-lg border border-neutral-800 bg-neutral-900/40 p-2 text-[10px]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-neutral-400">বর্তমান নির্বাচন</span>
            <button onClick={() => setSelection(null)} className="text-red-400 hover:text-red-300">Deselect</button>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-neutral-300">{selection.kind}</span>
            <span className="text-amber-400 font-mono truncate">{selection.key}</span>
          </div>
        </div>
      )}

      {/* ── Tab Content ── */}
      <div className="pt-2">
        {tab === "controls" ? (
          <ControlsTab color={meta.color} scope={scope} />
        ) : (
          <HistoryTab />
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all border"
      style={active 
        ? { background: `${color}15`, color, borderColor: `${color}40` } 
        : { background: "transparent", color: "#737373", borderColor: "transparent" }}
    >
      {children}
    </button>
  );
}

function ControlsTab({ color, scope }: { color: string; scope: SelectionScope }) {
  const selection = useEditorStore((s) => s.selection);
  return (
    <div className="flex flex-col gap-4">
      <Group title="আরবি ফন্ট" icon={Type} color={color}>
        <DSlider k="arabicFontPx" label="সাইজ" min={20} max={80} fallback={ARABIC_FONT_PX} color={color} />
        <DSlider k="arabicYOffset" label="Y অফসেট" min={-30} max={30} fallback={0} color={color} />
      </Group>

      <div className="h-px bg-neutral-800/50" />
      
      <Group title="বাংলা ফন্ট" icon={Type} color={color}>
        <DSlider k="banglaFontPx" label="সাইজ" min={8} max={32} fallback={BANGLA_FONT_PX} color={color} />
        <DSlider k="banglaYOffset" label="Y অফসেট" min={-30} max={30} fallback={0} color={color} />
      </Group>

      <div className="h-px bg-neutral-800/50" />

      <Group title="প্রতীক" icon={BookOpen} color={color}>
        <DSlider k="symbolYOffset" label="Y অফসেট" min={-30} max={30} fallback={0} color={color} />
      </Group>

      {/* Per-line section when row is selected */}
      {selection && (scope === "page" || scope === "general") && (
        <>
          <div className="h-px bg-neutral-800/50" />
          <RowDetailSection color={color} selection={selection} />
        </>
      )}

      <div className="h-px bg-neutral-800/50" />

      <Group title="ট্রান্সফর্ম" icon={Move} color={color}>
        <LocalFields color={color} />
      </Group>

      <div className="h-px bg-neutral-800/50" />

      <Group title="ইতিহাস" icon={RotateCcw} color={color}>
        <ResetGroup />
      </Group>
    </div>
  );
}

function RowDetailSection({ color, selection }: { color: string; selection: import("@/state/editorStore").Selection }) {
  const patchLocal = useOverridesStore((s) => s.patchLocal);
  const scope = useEditorStore((s) => s.scope);
  const apply = (patch: Parameters<typeof patchLocal>[1]) => { void patchScoped(selection.key, patch, scope); };
  const local = useOverridesStore((s) => s.local[selection.key]);
  const dx = local?.dx ?? 0;
  const dy = local?.dy ?? 0;
  const fontPx = local?.fontPx ?? ARABIC_FONT_PX;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/30 p-3">
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
        সারি বিস্তারিত — {selection.key.replace("row:", "")}
      </span>
      <div className="grid grid-cols-2 gap-3">
        <InlineField label="আরবি ফন্ট" value={fontPx} min={16} max={80}
          onChange={(v) => apply({ fontPx: v })}
          onReset={local?.fontPx !== undefined ? () => apply({ fontPx: undefined }) : undefined}
          color={color} />
        <InlineField label="X অফসেট" value={dx} min={-100} max={100}
          onChange={(v) => apply({ dx: v })}
          onReset={local?.dx !== undefined ? () => apply({ dx: undefined }) : undefined}
          color={color} />
        <InlineField label="Y অফসেট" value={dy} min={-100} max={100}
          onChange={(v) => apply({ dy: v })}
          onReset={local?.dy !== undefined ? () => apply({ dy: undefined }) : undefined}
          color={color} />
      </div>
      <button onClick={() => apply({ dx: undefined, dy: undefined, fontPx: undefined, scale: undefined })}
        className="mt-1 rounded border border-neutral-700 bg-neutral-800 py-1.5 text-[10px] font-semibold text-neutral-400 hover:bg-red-900/20 hover:text-red-400 transition-colors">
        এই সারি রিসেট করুন
      </button>
    </div>
  );
}

function InlineField({ label, value, min, max, onChange, onReset, color }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; onReset?: () => void; color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-neutral-500">{label}</span>
        {onReset && <button onClick={onReset} className="text-neutral-600 hover:text-amber-400"><RotateCcw className="h-2.5 w-2.5" /></button>}
      </div>
      <div className="flex items-center gap-1">
        <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded border border-neutral-700 bg-neutral-800 px-1.5 py-1 text-right text-[11px] outline-none focus:border-amber-400"
          style={{ color }} step={1} min={min} max={max} />
      </div>
    </div>
  );
}

function HistoryTab() {
  const entries = useHistoryStore((s) => s.entries);
  const restoreTo = useHistoryStore((s) => s.restoreTo);
  const clear = useHistoryStore((s) => s.clear);
  const reversed = [...entries].reverse();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
        <span className="text-[10px] font-semibold text-neutral-400">
          {entries.length} টি পরিবর্তন
        </span>
        {entries.length > 0 && (
          <button onClick={() => { if (confirm("সব ইতিহাস মুছবেন?")) clear(); }}
            className="text-[10px] font-medium text-red-500/60 hover:text-red-400">সব মুছুন</button>
        )}
      </div>
      {reversed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-neutral-600 text-[11px] text-center">
          <Clock className="h-6 w-6 mb-2 opacity-30" />
          কোনো পরিবর্তন নেই।<br/>এডিট মোডে কিছু পরিবর্তন করুন।
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {reversed.map((entry) => {
            const m = SCOPE_META[entry.scope] ?? SCOPE_META.global;
            return (
              <div key={entry.id} className="flex flex-col gap-1 rounded bg-neutral-900/50 p-2 group hover:bg-neutral-800 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold" style={{ background: `${m.color}20`, color: m.color }}>
                    {m.labelBn}
                  </span>
                  <span className="text-[9px] text-neutral-500">{relativeTime(entry.ts)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-neutral-300 truncate">{entry.labelBn}</span>
                  <button
                    onClick={() => restoreTo(entry.id)}
                    className="shrink-0 rounded border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-[9px] text-neutral-400 opacity-0 group-hover:opacity-100 hover:border-amber-500/40 hover:text-amber-300 transition-all"
                  >
                    পুনরুদ্ধার
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Group({ title, icon: Icon, color, children }: { title: string; icon: React.ElementType; color: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
        <Icon className="h-3.5 w-3.5" />{title}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function DSlider({ k, label, min, max, fallback, color }: {
  k: keyof GlobalOverrides; label: string; min: number; max: number; fallback: number; color: string;
}) {
  const stored = useOverridesStore((s) => s.global[k]);
  const setGlobal = useOverridesStore((s) => s.setGlobal);
  const [dragging, setDragging] = useState<number | null>(null);

  // While dragging: show the dragging value; otherwise show stored or fallback
  const display = dragging ?? stored ?? fallback;
  const isOverridden = stored !== undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium text-neutral-400">{label}</span>
        <div className="flex items-center gap-1">
          <input type="number" value={display}
            onChange={(e) => { const v = Number(e.target.value); setDragging(null); setGlobal(k, v); }}
            className="w-12 rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-right text-[11px] font-mono outline-none focus:border-amber-400"
            style={{ color: isOverridden ? color : "#737373" }} step={1} min={min} max={max} />
          {isOverridden && (
            <button onClick={() => { setGlobal(k, undefined); setDragging(null); }} className="ml-1 text-neutral-600 hover:text-amber-400" title="Reset">
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <input type="range" min={min} max={max} value={display}
        onInput={(e) => setDragging(Number((e.target as HTMLInputElement).value))}
        onChange={(e) => { const v = Number((e.target as HTMLInputElement).value); setDragging(null); setGlobal(k, v); }}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color, background: `linear-gradient(to right, ${color} ${((display - min) / (max - min)) * 100}%, #262626 0%)` }}
      />
    </div>
  );
}

function LocalFields({ color }: { color: string }) {
  const selection = useEditorStore((s) => s.selection);
  const scope = useEditorStore((s) => s.scope);
  const local = useOverridesStore((s) => selection ? s.local[selection.key] : undefined);
  if (!selection) return <div className="text-[10px] text-neutral-600 rounded bg-neutral-900/50 p-2 text-center">ট্রান্সফর্ম করার জন্য সারি নির্বাচন করুন</div>;
  const apply = (patch: Record<string, unknown>) => { void patchScoped(selection.key, patch as never, scope); };
  return (
    <div className="grid grid-cols-2 gap-3">
      {(["dx", "dy"] as const).map((f) => (
        <div key={f} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-neutral-500" style={{ color }}>{f === "dx" ? "X অফসেট" : "Y অফসেট"}</span>
            {(local?.[f] ?? 0) !== 0 && (
              <button onClick={() => apply({ [f]: undefined })} className="text-neutral-600 hover:text-amber-400">
                <RotateCcw className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
          <input type="number" value={local?.[f] ?? 0}
            onChange={(e) => apply({ [f]: Number(e.target.value) || undefined })}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] outline-none focus:border-amber-400"
            step={1} />
        </div>
      ))}
    </div>
  );
}

function ResetGroup() {
  const resetAll = useOverridesStore((s) => s.resetAll);
  const rebuild = useReflowStore((s) => s.rebuild);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => useOverridesStore.temporal.getState().undo()}
          className="flex items-center justify-center gap-1 rounded border border-neutral-700 bg-neutral-900 py-1.5 text-[10px] font-medium text-neutral-300 hover:bg-neutral-800">
          <RotateCcw className="h-3 w-3" /> Undo
        </button>
        <button onClick={() => useOverridesStore.temporal.getState().redo()}
          className="flex items-center justify-center gap-1 rounded border border-neutral-700 bg-neutral-900 py-1.5 text-[10px] font-medium text-neutral-300 hover:bg-neutral-800">
          <RotateCcw className="h-3 w-3 scale-x-[-1]" /> Redo
        </button>
      </div>
      <button
        onClick={() => {
          if (!confirm("সব রিসেট করবেন? সব ডিফল্ট অবস্থায় ফিরবে।")) return;
          
          // 1. Show loading state visually
          useReflowStore.setState({ buildProgress: { label: "রিসেট হচ্ছে…", pct: 50 } });
          
          // 2. Yield to browser so loading screen paints, then process
          setTimeout(() => {
            resetAll();
            rebuild();
            
            // 3. Clear history and remove loading state after a tiny delay
            setTimeout(() => {
              useOverridesStore.temporal.getState().clear();
              useHistoryStore.getState().clear();
              useReflowStore.setState({ buildProgress: null });
            }, 50);
          }, 50);
        }}
        className="rounded border border-red-900/40 bg-red-900/10 py-1.5 text-[10px] font-bold text-red-400 hover:bg-red-900/20 mt-2">
        সব রিসেট করুন
      </button>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Character & Paragraph Panel (Type Tool mode)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function NumInput({
  label, value, onChange, unit = "pt", min, max, step = 1,
}: {
  label: string; value: number; onChange: (v: number) => void;
  unit?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-neutral-600 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-0.5 rounded border border-neutral-700 bg-neutral-900">
        <button
          onMouseDown={(e) => { e.preventDefault(); onChange(Math.max(min ?? -999, value - step)); }}
          className="px-1.5 py-1 text-neutral-500 hover:text-neutral-200 transition-colors select-none"
        >−</button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-12 bg-transparent text-center text-[11px] font-mono text-neutral-200 outline-none"
        />
        <button
          onMouseDown={(e) => { e.preventDefault(); onChange(Math.min(max ?? 9999, value + step)); }}
          className="px-1.5 py-1 text-neutral-500 hover:text-neutral-200 transition-colors select-none"
        >+</button>
      </div>
      {unit && <span className="text-[8px] text-neutral-700">{unit}</span>}
    </div>
  );
}

function CharacterPanel({ selKey }: { selKey: string }) {
  const localMap = useOverridesStore((s) => s.local);
  const patchLocal = useOverridesStore((s) => s.patchLocal);
  const scope = useEditorStore((s) => s.scope);
  const ov = localMap[selKey] ?? {};

  const fontPx   = ov.fontPx   ?? 0;
  const leading  = ov.leading  ?? 0;
  const tracking = ov.tracking ?? 0;
  const vScale   = ov.vScale   ?? 100;
  const hScale   = ov.hScale   ?? 100;
  const baseline = ov.baseline ?? 0;
  const align    = ov.align    ?? "justify";

  const set = (k: string, v: number | string) => { void patchScoped(selKey, { [k]: v } as never, scope); };

  const ALIGN_OPTIONS = [
    { value: "left",    icon: AlignLeft,    label: "বাম" },
    { value: "center",  icon: AlignCenter,  label: "মধ্য" },
    { value: "right",   icon: AlignRight,   label: "ডান" },
    { value: "justify", icon: AlignJustify, label: "জাস্ট" },
  ] as const;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-400">
        <Type className="h-3 w-3" />
        ক্যারেক্টার
      </div>

      {/* Row 1: Font size + Leading */}
      <div className="grid grid-cols-2 gap-2">
        <NumInput label="Font Size" value={fontPx} unit="px" min={6} max={200}
          onChange={(v) => set("fontPx", v)} />
        <NumInput label="Leading" value={leading} unit="px" min={0} max={200}
          onChange={(v) => set("leading", v)} />
      </div>

      {/* Row 2: Tracking + Baseline */}
      <div className="grid grid-cols-2 gap-2">
        <NumInput label="Tracking" value={tracking} unit="px" min={-100} max={200} step={0.5}
          onChange={(v) => set("tracking", v)} />
        <NumInput label="Baseline" value={baseline} unit="px" min={-100} max={100} step={0.5}
          onChange={(v) => set("baseline", v)} />
      </div>

      {/* Row 3: Vertical scale + Horizontal scale */}
      <div className="grid grid-cols-2 gap-2">
        <NumInput label="V Scale" value={vScale} unit="%" min={10} max={300}
          onChange={(v) => set("vScale", v)} />
        <NumInput label="H Scale" value={hScale} unit="%" min={10} max={300}
          onChange={(v) => set("hScale", v)} />
      </div>

      {/* Paragraph Alignment */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[9px] text-neutral-600 uppercase tracking-wider">Paragraph Align</span>
        <div className="flex gap-1">
          {ALIGN_OPTIONS.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => set("align", value)}
              title={label}
              className={`flex flex-1 items-center justify-center rounded border py-1.5 transition-all ${
                align === value
                  ? "border-sky-500/60 bg-sky-500/15 text-sky-300"
                  : "border-neutral-700 bg-neutral-900 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Reset layer overrides */}
      <button
        onClick={() => patchLocal(selKey, { fontPx: undefined, leading: undefined, tracking: undefined, vScale: undefined, hScale: undefined, baseline: undefined, align: undefined })}
        className="mt-1 rounded border border-neutral-700 bg-neutral-900 py-1 text-[10px] text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
      >
        রিসেট লেয়ার
      </button>
    </div>
  );
}
