import { create } from "zustand";
import { temporal } from "zundo";
import { persist } from "zustand/middleware";

export type GlobalOverrides = {
  arabicFontPx?: number;
  banglaFontPx?: number;
  symbolScale?: number;
  rowSpacing?: number;
  arabicYOffset?: number;
  banglaYOffset?: number;
  symbolYOffset?: number;
};

export type LocalOverride = {
  dx?: number;
  dy?: number;
  scale?: number;
  fontPx?: number;
  /** InDesign-style character properties */
  leading?: number;
  tracking?: number;
  vScale?: number;
  hScale?: number;
  baseline?: number;
  align?: "left" | "center" | "right" | "justify";
  /** User-edited text content override */
  text?: string;
};

/** Stable keys — logical (verse-based) for words/symbols, page-bound for rows.
 *  word:{surah}:{ayah}:{wordIndex}
 *  symbol:{surah}:{ayah}:{wordIndex}:{charOffset}:{symbolId}
 *  row:{pageId}:{rowIndex}
 *  layer:{pageId}:{rowIndex}:{layerName}   ← sub-layer overrides
 */
export type LocalKey = string;

/** Helper to build a sub-layer key (arabic | bangla | symbol) */
export const layerKey = (pageId: string, rowIndex: number, layer: "arabic" | "bangla" | "symbol") =>
  `layer:${pageId}:${rowIndex}:${layer}`;



type OverridesState = {
  global: GlobalOverrides;
  local: Record<LocalKey, LocalOverride>;
  setGlobal: <K extends keyof GlobalOverrides>(k: K, v: GlobalOverrides[K] | undefined) => void;
  patchLocal: (key: LocalKey, patch: Partial<Record<keyof LocalOverride, LocalOverride[keyof LocalOverride] | undefined>>) => void;
  clearLocal: (key: LocalKey) => void;
  resetAll: () => void;
};

type Persisted = Pick<OverridesState, "global" | "local">;

/**
 * Master Template defaults — font sizes only.
 * Y-offsets are intentionally 0 here because the visual baseline positions
 * (-15, 2, -2) are baked into FabricLines as BASE_ARABIC_Y / BASE_BANGLA_Y /
 * BASE_SYMBOL_Y constants. The store Y values are DELTAS on top of those,
 * so slider = 0 means "at the correct master position".
 */
export const MASTER_DEFAULTS: GlobalOverrides = {
  arabicFontPx: 50,
  banglaFontPx: 18,
  arabicYOffset: 0,
  banglaYOffset: 0,
  symbolYOffset: 0,
};

/* Guard: true while historyStore.restoreTo is applying a snapshot.
 * During restoration we must NOT capture history entries.
 */
export let _restoringHistory = false;
export function setRestoringHistory(v: boolean) { _restoringHistory = v; }

/* Batch-merge consecutive same-field global changes within 400ms for clean undo steps */
let _lastGlobalField: string | null = null;
let _lastGlobalTs = 0;
const BATCH_MS = 400;

export const useOverridesStore = create<OverridesState>()(
  persist(
    temporal(
      (set, get) => ({
        global: { ...MASTER_DEFAULTS },
        local: {},

        setGlobal: (k, v) => {
          const before = get().global[k];
          set((s) => ({ global: { ...s.global, [k]: v } }));
          if (_restoringHistory) return; // skip history during restore
          // History capture (non-blocking, after state is set)
          const now = Date.now();
          const isSameField = _lastGlobalField === k && now - _lastGlobalTs < BATCH_MS;
          _lastGlobalField = String(k);
          _lastGlobalTs = now;
          if (!isSameField && before !== v) {
            queueMicrotask(() => {
              import("./historyStore").then(({ captureHistory }) => {
                captureHistory(String(k), before, v, "global");
              });
            });
          }
        },

        patchLocal: (key, patch) => {
          const beforeOverride = get().local[key];
          set((s) => {
            const merged = { ...(s.local[key] ?? {}), ...patch } as Record<string, unknown>;
            for (const k of Object.keys(patch)) {
              if ((patch as Record<string, unknown>)[k] === undefined) delete merged[k];
            }
            // _restoringHistory guard checked after set() below
            const next = { ...s.local };
            if (Object.keys(merged).length === 0) delete next[key];
            else next[key] = merged as LocalOverride;
            return { local: next };
          });
          if (_restoringHistory) return; // skip history during restore
          queueMicrotask(() => {
            const patchKeys = Object.keys(patch);
            const mainField = patchKeys[0];
            if (!mainField) return;
            const before = (beforeOverride as Record<string, unknown>)?.[mainField];
            const after = (patch as Record<string, unknown>)[mainField];
            if (before === after) return;
            const parts = key.split(":");
            const scope = "general" as const;
            import("./historyStore").then(({ captureHistory }) => {
              captureHistory(
                mainField,
                before,
                after,
                scope,
                parts[1],                          // pageId
                parts[2] ? Number(parts[2]) : undefined,  // rowIndex
                key,                               // full layerKey
              );
            });
          });
        },

        clearLocal: (key) =>
          set((s) => {
            const next = { ...s.local };
            delete next[key];
            return { local: next };
          }),

        // Reset returns to MASTER_DEFAULTS, not empty {}
        resetAll: () => set({ global: { ...MASTER_DEFAULTS }, local: {} }),
      }),
      {
        limit: 100,
        // Reference equality: patchLocal/setGlobal always create new object references,
        // so this creates a snapshot on every real change while skipping no-op updates.
        equality: (a, b) => a.global === b.global && a.local === b.local,
      },
    ),
    {
      name: "studio-overrides-v4",
      partialize: (s): Persisted => ({ global: s.global, local: s.local }),
      // On first load, merge stored state on top of MASTER_DEFAULTS
      // so any stored user changes are preserved but defaults fill gaps.
      merge: (persisted, current) => ({
        ...current,
        global: { ...MASTER_DEFAULTS, ...(persisted as Persisted).global },
        local: (persisted as Persisted).local ?? {},
      }),
    },
  ),
);

/** Selector helpers */
export const useGlobalOverride = <K extends keyof GlobalOverrides>(k: K) =>
  useOverridesStore((s) => s.global[k]);

export const useLocalOverride = (key: LocalKey | null | undefined) =>
  useOverridesStore((s) => (key ? s.local[key] : undefined));

/** Key builders */
export const rowKey = (pageId: string, rowIndex: number): LocalKey =>
  `row:${pageId}:${rowIndex}`;

export const wordKey = (
  surah: number | string,
  ayah: number | string,
  wordIndex: number,
): LocalKey => `word:${surah}:${ayah}:${wordIndex}`;

export const symbolKey = (
  surah: number | string,
  ayah: number | string,
  wordIndex: number,
  charOffset: number,
  symbolId: string,
): LocalKey =>
  `symbol:${surah}:${ayah}:${wordIndex}:${charOffset}:${symbolId}`;

/* ─── Scope-aware fan-out ────────────────────────────────────────────
 * Given a representative layerKey (e.g. "layer:vpage-3:5:bangla" or
 * "row:vpage-3:5") and a SelectionScope, return ALL layerKeys the patch
 * should apply to. The "kind" (arabic/bangla/symbol) is preserved.
 */
import type { SelectionScope } from "./editorStore";

function parseLayerKey(key: string): { kind: "layer" | "row"; pageId: string; rowIndex: number; layer?: string } | null {
  const parts = key.split(":");
  if (parts[0] === "layer" && parts.length >= 4) {
    return { kind: "layer", pageId: parts[1]!, rowIndex: Number(parts[2]), layer: parts[3] };
  }
  if (parts[0] === "row" && parts.length >= 3) {
    return { kind: "row", pageId: parts[1]!, rowIndex: Number(parts[2]) };
  }
  return null;
}

/** Build all matching layerKeys for the given scope. */
export async function getScopedLayerKeys(
  representativeKey: LocalKey,
  scope: SelectionScope,
): Promise<LocalKey[]> {
  if (scope === "general") return [representativeKey];
  const parsed = parseLayerKey(representativeKey);
  if (!parsed) return [representativeKey];

  const { useReflowStore } = await import("./reflowStore");
  const { pages, distribution } = useReflowStore.getState();

  // Find which surah the source page belongs to
  const srcInfo = distribution.find((d) => d.pageId === parsed.pageId);
  const srcSurah = srcInfo?.surah ?? 0;

  let targetPages: string[];
  if (scope === "page") targetPages = [parsed.pageId];
  else if (scope === "surah")
    targetPages = distribution.filter((d) => d.surah === srcSurah).map((d) => d.pageId);
  else /* global */ targetPages = pages.map((p) => p.id);

  // For each target page, enumerate row indices and build matching keys.
  const out: LocalKey[] = [];
  for (const pid of targetPages) {
    const page = pages.find((p) => p.id === pid);
    if (!page) continue;
    const rowCount = page.lines?.length ?? 0;
    for (let i = 0; i < rowCount; i++) {
      if (parsed.kind === "layer") out.push(`layer:${pid}:${i}:${parsed.layer}`);
      else out.push(`row:${pid}:${i}`);
    }
  }
  return out.length > 0 ? out : [representativeKey];
}

/** Apply a patch to one or many layerKeys based on scope. Text patches are
 *  always single-key (text is unique per row). */
export async function patchScoped(
  representativeKey: LocalKey,
  patch: Partial<Record<keyof LocalOverride, LocalOverride[keyof LocalOverride] | undefined>>,
  scope: SelectionScope,
) {
  const store = useOverridesStore.getState();
  // Never fan out text edits.
  if ("text" in patch) {
    store.patchLocal(representativeKey, patch);
    return;
  }
  const keys = await getScopedLayerKeys(representativeKey, scope);
  for (const k of keys) store.patchLocal(k, patch);
}
