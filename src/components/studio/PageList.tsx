import { ChevronDown, FileText, Search } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { List, useListRef } from "react-window";
import type { ListImperativeAPI, RowComponentProps } from "react-window";
import { useReflowStore } from "@/state/reflowStore";
import type { PageDistribution } from "@/state/reflowStore";

type Props = {
  pages?: unknown;
  activeId: string;
  onSelect: (id: string) => void;
};

const SURAH_NAMES: Record<number, string> = {
  1: "আল-ফাতিহা",
  2: "আল-বাকারা",
  3: "আলে ইমরান",
  4: "আন-নিসা",
  5: "আল-মায়িদাহ",
  6: "আল-আনআম",
  7: "আল-আরাফ",
  8: "আল-আনফাল",
  9: "আত-তাওবা",
};

function bnNum(n: number | string): string {
  const map = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n).replace(/\d/g, (d) => map[Number(d)]);
}

/** Height of each page list item — fixed for react-window v2 List */
const ITEM_HEIGHT = 52;

/** Data passed to each row via rowProps */
type ItemData = {
  filtered: PageDistribution[];
  distribution: PageDistribution[];
  activeId: string;
  onSelect: (id: string) => void;
};

/** Virtualized page list row — adapted for react-window v2 rowComponent API */
function PageListItem({
  index,
  style,
  filtered,
  distribution,
  activeId,
  onSelect,
}: RowComponentProps<ItemData>) {
  const d = filtered[index];
  if (!d) return null;

  const idx = distribution.indexOf(d);
  const active = d.pageId === activeId;
  const surahName = SURAH_NAMES[d.surah] ?? `সূরা ${bnNum(d.surah)}`;
  const ayahLabel =
    d.firstVerse != null && d.lastVerse != null
      ? `আয়াত ${bnNum(d.firstVerse)}–${bnNum(d.lastVerse)}`
      : `পেজ ${bnNum(d.pageNo)}`;

  return (
    <div style={style}>
      <button
        onClick={() => onSelect(d.pageId)}
        className={`group flex w-full items-center gap-2.5 border-l-2 px-3 py-2 text-left text-xs transition-all ${
          active
            ? "border-amber-400 bg-gradient-to-r from-amber-500/10 to-transparent text-amber-100"
            : "border-transparent text-neutral-400 hover:border-neutral-700 hover:bg-neutral-900/60 hover:text-neutral-200"
        }`}
        style={{ height: ITEM_HEIGHT }}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold transition-colors ${
            active ? "bg-amber-500 text-neutral-950" : "bg-neutral-800 text-neutral-500 group-hover:bg-neutral-700"
          }`}
        >
          {idx + 1}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium leading-tight">{surahName}</span>
          <span className="truncate text-[10px] text-neutral-600 group-hover:text-neutral-500">
            {ayahLabel}
          </span>
        </div>
        {active && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
        )}
      </button>
    </div>
  );
}

export function PageList({ activeId, onSelect }: Props) {
  const [q, setQ] = useState("");
  const distribution = useReflowStore((s) => s.distribution);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const surahOptions = useMemo(() => {
    const seen = new Map<number, string>();
    distribution.forEach((d) => {
      if (d.surah && !seen.has(d.surah)) seen.set(d.surah, d.pageId);
    });
    return Array.from(seen, ([s, id]) => ({
      name: SURAH_NAMES[s] ?? `সূরা ${bnNum(s)}`,
      id,
    }));
  }, [distribution]);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return distribution.filter((d) => {
      const name = SURAH_NAMES[d.surah] ?? "";
      const label = `${name} ${d.pageNo}`;
      return label.toLowerCase().includes(needle);
    });
  }, [distribution, q]);

  const activeIdx = distribution.findIndex((d) => d.pageId === activeId);
  const activeData = distribution[activeIdx];

  // Scroll the virtualized list to active item when activeId changes.
  // react-window v2: use useListRef() + scrollToRow()
  const listRef = useListRef(null);
  const prevActiveRef = useRef<string>("");
  if (activeId !== prevActiveRef.current) {
    prevActiveRef.current = activeId;
    const activeFilteredIdx = filtered.findIndex((d) => d.pageId === activeId);
    if (activeFilteredIdx >= 0) {
      listRef.current?.scrollToRow({ index: activeFilteredIdx, align: "smart" });
    }
  }

  const itemData = useMemo<ItemData>(
    () => ({ filtered, distribution, activeId, onSelect }),
    [filtered, distribution, activeId, onSelect],
  );

  // Compute list height from container — approximate using known header heights.
  // Header: 40px + active indicator: ~66px + selectors: ~90px + search: ~40px = ~236px
  // Use the remaining height. react-window needs a fixed pixel height.
  const FIXED_HEADER_HEIGHT = 240;
  const listHeight = typeof window !== "undefined"
    ? Math.max(100, (window.innerHeight - 52 - FIXED_HEADER_HEIGHT)) // 52 = TopBar height
    : 400;

  const handleSelect = useCallback((id: string) => onSelect(id), [onSelect]);

  return (
    <aside className="flex h-full w-full flex-col border-r border-neutral-800/80 bg-neutral-950 text-neutral-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-neutral-800">
            <FileText className="h-3.5 w-3.5 text-amber-400" />
          </div>
          পেজ তালিকা
        </div>
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
          {distribution.length}
        </span>
      </div>

      {/* Active page indicator */}
      {activeData && (
        <div className="border-b border-neutral-800 bg-neutral-900/50 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">বর্তমান পেজ</span>
            <span className="text-[10px] font-bold text-amber-400">{activeIdx + 1} / {distribution.length}</span>
          </div>
          <div className="mt-1 text-xs font-medium text-neutral-200 truncate">
            {SURAH_NAMES[activeData.surah] ?? `সূরা ${bnNum(activeData.surah)}`}
            {activeData.firstVerse != null && (
              <span className="ml-1 text-neutral-500">
                {bnNum(activeData.firstVerse)}–{bnNum(activeData.lastVerse ?? activeData.firstVerse)}
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
              style={{ width: `${((activeIdx + 1) / distribution.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Selectors */}
      <div className="space-y-2 border-b border-neutral-800 p-2.5">
        <div>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            পেজ নম্বর
          </span>
          <div className="relative">
            <select
              value={activeId}
              onChange={(e) => handleSelect(e.target.value)}
              className="w-full appearance-none rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 pr-7 text-xs text-neutral-100 outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-colors"
            >
              {distribution.map((d, i) => (
                <option key={d.pageId} value={d.pageId}>
                  {bnNum(d.pageNo)} — {SURAH_NAMES[d.surah] ?? `সূরা ${bnNum(d.surah)}`}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-500" />
          </div>
        </div>

        <div>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            সূরা
          </span>
          <div className="relative">
            <select
              value=""
              onChange={(e) => e.target.value && handleSelect(e.target.value)}
              className="w-full appearance-none rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 pr-7 text-xs text-neutral-100 outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-colors"
            >
              <option value="">— সূরা বাছুন —</option>
              {surahOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-500" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-neutral-800 px-2.5 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="পেজ খুঁজুন…"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-1.5 pl-8 pr-3 text-xs text-neutral-100 placeholder-neutral-600 outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Virtualized Page List — react-window v2 List */}
      <div ref={listContainerRef} className="flex-1 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center text-[11px] text-neutral-600">
            কোনো পেজ পাওয়া যায়নি
          </div>
        ) : (
          <List
            listRef={listRef}
            defaultHeight={listHeight}
            rowCount={filtered.length}
            rowHeight={ITEM_HEIGHT}
            rowComponent={PageListItem}
            rowProps={itemData}
            overscanCount={3}
            className="scrollbar-thin"
          />
        )}
      </div>
    </aside>
  );
}
