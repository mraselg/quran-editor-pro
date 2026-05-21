/**
 * Text Reflow Engine
 * ------------------
 * Handles dynamic text reflow across rows and pages in editor mode.
 * When text is added/modified in a row, overflow cascades to subsequent rows
 * and across page boundaries.
 *
 * PERFORMANCE NOTE: All text measurement uses Canvas API (canvasMeasure.ts)
 * instead of DOM-span offsetWidth to avoid Layout Thrashing.
 */

import type { FabricLine } from "@/components/studio/FabricLines";
import type { LocalOverride } from "@/state/overridesStore";
import { measureTextWidthCanvas, splitToFitCanvas } from "./canvasMeasure";

export type LayerKind = "arabic" | "bangla";

/**
 * Measures the rendered pixel width of `text`.
 * Uses Canvas API — no DOM reads, no Layout Thrashing.
 *
 * @deprecated Use measureTextWidthCanvas() from canvasMeasure.ts directly.
 * This wrapper is kept for backwards-compatibility with any callers.
 */
export function measureTextWidth(
  text: string,
  fontFamily: string,
  fontSize: number,
): number {
  return measureTextWidthCanvas(text, fontFamily, fontSize);
}

/**
 * Splits text to fit within maxWidth pixels using Canvas measurement.
 * Replaces the previous DOM-span based implementation.
 */
export function splitToFit(
  text: string,
  maxWidth: number,
  fontFamily: string,
  fontSize: number,
): { fits: string; overflow: string } {
  return splitToFitCanvas(text, maxWidth, fontFamily, fontSize);
}

/**
 * Gets effective text for a row+layer — uses local override text if set,
 * otherwise falls back to original page data.
 */
export function getEffectiveText(
  pageId: string,
  rowIndex: number,
  layer: LayerKind,
  lines: FabricLine[],
  localMap: Record<string, LocalOverride>,
  layerKeyFn: (pageId: string, rowIndex: number, layer: LayerKind) => string,
): string {
  const lk = layerKeyFn(pageId, rowIndex, layer);
  const ov = localMap[lk];
  if (ov?.text !== undefined) return ov.text;
  return layer === "arabic"
    ? (lines[rowIndex]?.arabic ?? "")
    : (lines[rowIndex]?.bangla ?? "");
}

export type ReflowOptions = {
  startPageId: string;
  startRowIndex: number;
  startOverflow: string;
  layer: LayerKind;
  /** All pages in order — {id, lines}[] */
  allPages: Array<{ id: string; lines: FabricLine[] }>;
  localMap: Record<string, LocalOverride>;
  patchLocal: (key: string, ov: Partial<LocalOverride>) => void;
  layerKeyFn: (pageId: string, rowIndex: number, layer: LayerKind) => string;
  fontFamily: string;
  fontSize: number;
  availableWidth: number;
};

/**
 * Cascading reflow from a given row across the entire surah.
 * Accepts an overflow string and distributes it through subsequent rows/pages.
 * Uses Canvas measurement — no DOM reads.
 */
export function reflowFrom(opts: ReflowOptions): void {
  const {
    startPageId,
    startRowIndex,
    startOverflow,
    layer,
    allPages,
    localMap,
    patchLocal,
    layerKeyFn,
    fontFamily,
    fontSize,
    availableWidth,
  } = opts;

  let overflow = startOverflow.trim();
  const startPageIdx = allPages.findIndex((p) => p.id === startPageId);
  if (startPageIdx === -1) return;

  // Iterate through pages starting from the given position
  for (let pi = startPageIdx; pi < allPages.length && overflow !== ""; pi++) {
    const page = allPages[pi];
    const firstRow = pi === startPageIdx ? startRowIndex : 0;

    for (let ri = firstRow; ri < page.lines.length; ri++) {
      const lk = layerKeyFn(page.id, ri, layer);
      // Get existing text for this row (only for rows after the start)
      const existingText =
        pi === startPageIdx && ri === startRowIndex
          ? "" // start row already has its new text set
          : getEffectiveText(page.id, ri, layer, page.lines, localMap, layerKeyFn);

      // Combine overflow with existing text
      const combined = existingText
        ? overflow + " " + existingText
        : overflow;

      const { fits, overflow: newOverflow } = splitToFitCanvas(
        combined,
        availableWidth,
        fontFamily,
        fontSize,
      );

      patchLocal(lk, { text: fits });
      overflow = newOverflow.trim();

      if (overflow === "") break;
    }
  }
}

/**
 * Gets text before and after the cursor in a contenteditable element.
 */
export function getTextAroundCursor(el: HTMLElement): {
  before: string;
  after: string;
} {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return { before: el.textContent ?? "", after: "" };
  }

  const range = sel.getRangeAt(0);

  // Range from start of element to cursor
  const beforeRange = document.createRange();
  try {
    beforeRange.setStart(el, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);
  } catch {
    return { before: el.textContent ?? "", after: "" };
  }

  const before = beforeRange.toString();
  const full = el.textContent ?? "";
  const after = full.substring(before.length);

  return { before, after };
}
