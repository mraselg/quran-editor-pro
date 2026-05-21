// HTML/CSS renderer for the 9 Quran rows.
// Each row is an absolutely positioned box mapped to a physical SVG band so
// Arabic shaping is handled by the browser's text engine (correct ligatures,
// RTL bidi) and the text is strictly confined inside its template band.

import { memo, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { TopSymbolLayer } from "./TopSymbolLayer";
import {
  useOverridesStore,
  rowKey,
  layerKey,
  MASTER_DEFAULTS,
  type LocalOverride,
} from "@/state/overridesStore";
import { useEditorStore } from "@/state/editorStore";
import { useReflowStore } from "@/state/reflowStore";
import {
  splitToFit,
  reflowFrom,
  getTextAroundCursor,
  type LayerKind,
} from "@/lib/textReflow";

export type FabricLine = {
  arabic?: string;
  bangla?: string;
  symbol?: string;
};

export type RowBox = {
  sy: number;
  ay: number;
  by: number;
  symH: number;
  arH: number;
  bnH: number;
};

type Props = {
  width: number;
  height: number;
  layout: RowBox[];
  lines: FabricLine[];
  arabicFamily: string;
  banglaFamily?: string;
  skip?: number;
  skipSlots?: number[];
};

export const ARABIC_FONT_PX = 40;
export const BANGLA_FONT_PX = 18;
export const SYMBOL_FONT_PX = 28;

/**
 * Baked-in baseline Y-offsets for the master Kariana template.
 */
export const BASE_ARABIC_Y = -15;
export const BASE_BANGLA_Y = 2;
export const BASE_SYMBOL_Y = -2;

type GlobalLayoutValues = {
  gArabic: number;
  gBangla: number;
  gArabicY: number;
  gBanglaY: number;
  gSymbolY: number;
};

const useGlobalLayoutValues = (): GlobalLayoutValues =>
  useOverridesStore(
    useShallow((s) => ({
      gArabic: s.global.arabicFontPx ?? MASTER_DEFAULTS.arabicFontPx ?? ARABIC_FONT_PX,
      gBangla: s.global.banglaFontPx ?? MASTER_DEFAULTS.banglaFontPx ?? BANGLA_FONT_PX,
      gArabicY: BASE_ARABIC_Y + (s.global.arabicYOffset ?? 0),
      gBanglaY: BASE_BANGLA_Y + (s.global.banglaYOffset ?? 0),
      gSymbolY: BASE_SYMBOL_Y + (s.global.symbolYOffset ?? 0),
    })),
  );

export const FabricLines = memo(function FabricLines({
  width,
  height,
  layout,
  lines,
  arabicFamily,
  banglaFamily = "'Kalpurush', 'Noto Serif Bengali', serif",
  skipSlots,
  pageId = "page",
}: Props & { pageId?: string }) {
  const skipSet = new Set(skipSlots ?? []);
  const editMode = useEditorStore((s) => s.editMode);

  return (
    <div style={{ position: "relative", width, height, pointerEvents: editMode ? "auto" : "none" }}>
      {layout.map((L, i) => {
        if (skipSet.has(i)) return null;
        const slot = lines[i];
        if (!slot) return null;
        return (
          <FabricRow
            key={`row-${i}`}
            pageId={pageId}
            rowIndex={i}
            box={L}
            slot={slot}
            width={width}
            arabicFamily={arabicFamily}
            banglaFamily={banglaFamily}
            lines={lines}
          />
        );
      })}
    </div>
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// FabricRow — one row, isolated via fine-grained selectors
// ──────────────────────────────────────────────────────────────────────────────
type FabricRowProps = {
  pageId: string;
  rowIndex: number;
  box: RowBox;
  slot: FabricLine;
  width: number;
  arabicFamily: string;
  banglaFamily: string;
  lines: FabricLine[];
};

const FabricRow = memo(function FabricRow({
  pageId,
  rowIndex: i,
  box: L,
  slot,
  width,
  arabicFamily,
  banglaFamily,
  lines,
}: FabricRowProps) {
  const rk = rowKey(pageId, i);
  const aLk = layerKey(pageId, i, "arabic");
  const bLk = layerKey(pageId, i, "bangla");

  const { gArabic, gBangla, gArabicY, gBanglaY, gSymbolY } = useGlobalLayoutValues();

  // Fine-grained: only re-render when this row's three keys change
  const { rOv, aOv, bOv } = useOverridesStore(
    useShallow((s) => ({
      rOv: s.local[rk],
      aOv: s.local[aLk],
      bOv: s.local[bLk],
    })),
  );

  const patchLocal = useOverridesStore((s) => s.patchLocal);
  const editMode = useEditorStore((s) => s.editMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const selectionKey = useEditorStore((s) => s.selection?.key);
  const selectionPageId = useEditorStore((s) => s.selection?.pageId);
  const focusedRowKey = useEditorStore((s) => s.focusedRowKey);
  const isTypeTool = editMode && activeTool === "type";

  const arabicSpanRef = useRef<HTMLSpanElement | null>(null);

  const rowFontPx = rOv?.fontPx ?? gArabic;
  const rowScale = rOv?.scale ?? 1;
  const rowTx = rOv?.dx ?? 0;
  const rowTy = rOv?.dy ?? 0;
  const rowSymbolPx = Math.round((rowFontPx / ARABIC_FONT_PX) * SYMBOL_FONT_PX);

  const lkSy = layerKey(pageId, i, "symbol");
  const isFlashing =
    focusedRowKey === rk ||
    focusedRowKey === aLk ||
    focusedRowKey === bLk ||
    focusedRowKey === lkSy;

  // Arabic layer
  const aDx = aOv?.dx ?? 0;
  const aDy = aOv?.dy ?? 0;
  const aFontPx = aOv?.fontPx ?? rowFontPx;
  const aLeading = aOv?.leading ?? 1;
  const aTracking = aOv?.tracking ?? 0;
  const aVScale = (aOv?.vScale ?? 100) / 100;
  const aHScale = (aOv?.hScale ?? 100) / 100;
  const aBaseline = aOv?.baseline ?? 0;
  const aAlign = (aOv?.align ?? "justify") as React.CSSProperties["textAlign"];
  const aText = aOv?.text ?? slot.arabic ?? "";
  const isArabicEditing = isTypeTool && selectionKey === aLk && selectionPageId === pageId;

  // Bangla layer
  const bFontPx = bOv?.fontPx ?? gBangla;
  const bLeading = bOv?.leading ?? 1.1;
  const bTracking = bOv?.tracking ?? 0;
  const bVScale = (bOv?.vScale ?? 100) / 100;
  const bHScale = (bOv?.hScale ?? 100) / 100;
  const bBaseline = bOv?.baseline ?? 0;
  const bAlign = (bOv?.align ?? "justify") as React.CSSProperties["textAlign"];
  const bText = bOv?.text ?? slot.bangla ?? "";
  const isBanglaEditing = isTypeTool && selectionKey === bLk && selectionPageId === pageId;

  return (
    <div
      data-sel-kind="row"
      data-sel-key={rk}
      data-page-id={pageId}
      data-row-index={i}
      style={{
        position: "absolute",
        left: 0,
        top: L.sy,
        width,
        height: L.symH + L.arH + L.bnH,
        overflow: "visible",
        transform: `translate(${rowTx}px, ${rowTy}px) scale(${rowScale})`,
        transformOrigin: "top left",
        outline: isFlashing ? "2px solid rgba(251,191,36,0.85)" : undefined,
        outlineOffset: isFlashing ? "2px" : undefined,
        borderRadius: isFlashing ? "3px" : undefined,
        animation: isFlashing ? "rowFlash 1.1s ease-out" : undefined,
      }}
    >
      {/* Symbol strip */}
      <div
        data-sel-kind={isTypeTool ? "layer" : undefined}
        data-sel-key={isTypeTool ? lkSy : undefined}
        data-layer-kind="symbol"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height: L.symH,
          transform: `translateY(${gSymbolY}px)`,
          overflow: "visible",
          zIndex: 20,
          pointerEvents: isTypeTool ? "auto" : "none",
          cursor: isTypeTool ? "pointer" : "default",
        }}
      >
        {(aText || slot.arabic) && (
          <TopSymbolLayer
            arabic={slot.arabic ?? aText}
            arabicSpanRef={arabicSpanRef}
            width={width}
            height={L.symH}
            fontFamily={arabicFamily}
            fontSize={rowSymbolPx}
            pageId={pageId}
            rowIndex={i}
            displayArabic={aText}
            isEditing={isArabicEditing}
          />
        )}
      </div>

      {/* Arabic band */}
      <div
        dir="rtl"
        lang="ar"
        data-sel-kind={isTypeTool ? "layer" : undefined}
        data-sel-key={isTypeTool ? aLk : undefined}
        data-layer-kind="arabic"
        style={{
          position: "absolute",
          left: 0,
          top: L.symH,
          width,
          height: L.arH,
          paddingLeft: 8,
          paddingRight: 8,
          boxSizing: "border-box",
          fontFamily: arabicFamily,
          fontSize: aFontPx,
          color: "#111827",
          lineHeight: aLeading === 1 ? 1 : `${aLeading}px`,
          letterSpacing: aTracking,
          display: "block",
          paddingTop: Math.max(0, L.arH * 0.05),
          textAlign: aAlign,
          textAlignLast: aAlign === "justify" ? "justify" : undefined,
          whiteSpace: "nowrap",
          overflow: "visible",
          transform: `translate(${aDx}px, ${gArabicY + aBaseline + aDy}px) scaleX(${aHScale}) scaleY(${aVScale})`,
          transformOrigin: "top left",
          zIndex: 30,
          pointerEvents: isTypeTool ? "auto" : "none",
          cursor: isArabicEditing ? "text" : isTypeTool ? "pointer" : "default",
        }}
      >
        {isArabicEditing ? (
          <InlineTextEditor
            key={aLk}
            layerKey={aLk}
            initialText={aText}
            dir="rtl"
            lang="ar"
            rowIndex={i}
            pageId={pageId}
            layer="arabic"
            lines={lines}
            fontFamily={arabicFamily}
            fontSize={aFontPx}
            availableWidth={width - 16}
            onSave={(t) => patchLocal(aLk, { text: t })}
          />
        ) : (
          slot.arabic && (
            <span
              ref={arabicSpanRef}
              style={{ display: "inline-block", width: "100%", textAlign: aAlign, textAlignLast: "justify" }}
            >
              {aText}
            </span>
          )
        )}
      </div>

      {/* Bangla band */}
      <div
        lang="bn"
        data-sel-kind={isTypeTool ? "layer" : undefined}
        data-sel-key={isTypeTool ? bLk : undefined}
        data-layer-kind="bangla"
        style={{
          position: "absolute",
          left: 0,
          top: L.symH + L.arH,
          width,
          height: L.bnH,
          paddingLeft: 8,
          paddingRight: 8,
          boxSizing: "border-box",
          fontFamily: banglaFamily,
          fontSize: bFontPx,
          color: "#064e3b",
          lineHeight: bLeading,
          letterSpacing: bTracking,
          overflow: "visible",
          display: "block",
          paddingTop: 1,
          textAlign: bAlign,
          textAlignLast: bAlign === "justify" ? "justify" : undefined,
          whiteSpace: "normal",
          transform: `translateY(${gBanglaY + bBaseline}px) scaleX(${bHScale}) scaleY(${bVScale})`,
          transformOrigin: "top left",
          zIndex: 10,
          pointerEvents: isTypeTool ? "auto" : "none",
          cursor: isBanglaEditing ? "text" : isTypeTool ? "pointer" : "default",
        }}
      >
        {isBanglaEditing ? (
          <InlineTextEditor
            key={bLk}
            layerKey={bLk}
            initialText={bText}
            dir="ltr"
            lang="bn"
            rowIndex={i}
            pageId={pageId}
            layer="bangla"
            lines={lines}
            fontFamily={banglaFamily}
            fontSize={bFontPx}
            availableWidth={width - 16}
            onSave={(t) => patchLocal(bLk, { text: t })}
          />
        ) : (
          slot.bangla && (
            <span style={{ display: "inline-block", width: "100%", textAlign: bAlign, textAlignLast: "justify" }}>
              {bText}
            </span>
          )
        )}
      </div>
    </div>
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// InlineTextEditor — contenteditable with rAF-throttled overflow detection
// ──────────────────────────────────────────────────────────────────────────────
function InlineTextEditor({
  layerKey: lk,
  initialText,
  dir,
  lang,
  rowIndex,
  pageId,
  layer,
  lines,
  fontFamily,
  fontSize,
  availableWidth,
  onSave,
}: {
  layerKey: string;
  initialText: string;
  dir?: string;
  lang?: string;
  rowIndex: number;
  pageId: string;
  layer: LayerKind;
  lines: FabricLine[];
  fontFamily: string;
  fontSize: number;
  availableWidth: number;
  onSave: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const committedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastSavedRef = useRef<string>(initialText);

  // Sync DOM ↔ store: on each keystroke, write text to store immediately
  // (no debounce — Zustand patches are cheap, and this guarantees the edit
  // never gets lost on selection-change/unmount races).
  const syncToStore = () => {
    const el = ref.current;
    if (!el) return;
    const text = el.textContent ?? "";
    if (text === lastSavedRef.current) return;
    lastSavedRef.current = text;
    useOverridesStore.getState().patchLocal(lk, { text });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.textContent = initialText;
    lastSavedRef.current = initialText;
    el.focus();

    try {
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        if (el.lastChild) range.setStartAfter(el.lastChild);
        else range.setStart(el, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch { /* ignore */ }

    return () => {
      // Flush any pending overflow-check synchronously before tearing down
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Always commit the current DOM text — covers unmount-without-blur
      const text = el.textContent ?? "";
      if (text !== lastSavedRef.current) {
        useOverridesStore.getState().patchLocal(lk, { text });
        lastSavedRef.current = text;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getReflowBase = () => ({
    layer,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allPages: useReflowStore.getState().pages as unknown as Array<{ id: string; lines: any[] }>,
    localMap: useOverridesStore.getState().local,
    patchLocal: useOverridesStore.getState().patchLocal,
    layerKeyFn: layerKey,
    fontFamily,
    fontSize,
    availableWidth,
  });

  const commit = (text?: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    const finalText = text ?? ref.current?.textContent ?? "";
    if (finalText !== lastSavedRef.current) {
      lastSavedRef.current = finalText;
      onSave(finalText);
    }
  };

  // rAF-throttled overflow check — coalesces fast keystrokes into one frame
  const checkOverflow = () => {
    rafRef.current = null;
    const el = ref.current;
    if (!el) return;

    // Always sync current text first (covers normal typing)
    syncToStore();

    if (el.scrollWidth <= el.clientWidth + 2) return;

    const currentText = el.textContent ?? "";
    const { fits, overflow } = splitToFit(currentText, availableWidth, fontFamily, fontSize);
    if (!overflow) return;

    lastSavedRef.current = fits;
    useOverridesStore.getState().patchLocal(lk, { text: fits });
    el.textContent = fits;
    try {
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        if (el.lastChild) range.setStartAfter(el.lastChild);
        else range.setStart(el, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch { /* ignore */ }

    const base = getReflowBase();
    const nextRowIdx = rowIndex + 1;
    const nextOnPage = nextRowIdx < lines.length;
    const targetPageId = nextOnPage
      ? pageId
      : (() => {
          const allPages = base.allPages;
          const pi = allPages.findIndex((p) => p.id === pageId);
          return pi >= 0 && pi + 1 < allPages.length ? allPages[pi + 1].id : pageId;
        })();
    const targetRowIdx = nextOnPage ? nextRowIdx : 0;

    reflowFrom({
      ...base,
      startPageId: targetPageId,
      startRowIndex: targetRowIdx,
      startOverflow: overflow,
    });
  };

  const handleInput = () => {
    if (rafRef.current != null) return; // already scheduled
    rafRef.current = requestAnimationFrame(checkOverflow);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (e.key === "Escape") {
      e.preventDefault();
      commit();
      useEditorStore.getState().setActiveTool("select");
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const el = ref.current;
      if (!el) return;

      const { before, after } = getTextAroundCursor(el);
      const beforeText = before.trim();
      const afterText = after.trim();

      commit(beforeText);
      el.textContent = beforeText;

      const base = getReflowBase();
      const allPages = base.allPages;
      const nextRowIdx = rowIndex + 1;
      const nextOnPage = nextRowIdx < lines.length;

      if (nextOnPage) {
        const nextLk = layerKey(pageId, nextRowIdx, layer);
        const nextExisting =
          base.localMap[nextLk]?.text ??
          (layer === "arabic" ? lines[nextRowIdx]?.arabic : lines[nextRowIdx]?.bangla) ??
          "";
        const combined = afterText
          ? afterText + (nextExisting ? " " + nextExisting : "")
          : nextExisting;
        reflowFrom({ ...base, startPageId: pageId, startRowIndex: nextRowIdx, startOverflow: combined });
      } else {
        const pi = allPages.findIndex((p) => p.id === pageId);
        if (pi >= 0 && pi + 1 < allPages.length) {
          const nextPage = allPages[pi + 1];
          const nextLk = layerKey(nextPage.id, 0, layer);
          const nextExisting =
            base.localMap[nextLk]?.text ??
            (layer === "arabic"
              ? (nextPage.lines[0]?.arabicLine ?? nextPage.lines[0]?.arabic)
              : (nextPage.lines[0]?.banglaLine ?? nextPage.lines[0]?.bangla)) ??
            "";
          const combined = afterText
            ? afterText + (nextExisting ? " " + nextExisting : "")
            : nextExisting;
          reflowFrom({ ...base, startPageId: nextPage.id, startRowIndex: 0, startOverflow: combined });
        }
      }
      return;
    }

    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
    }
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      dir={dir}
      lang={lang}
      spellCheck={false}
      onBlur={() => {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (!committedRef.current) commit();
      }}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      style={{
        display: "block",
        width: "100%",
        minHeight: "1em",
        outline: "2px solid rgba(56,189,248,0.7)",
        outlineOffset: "2px",
        borderRadius: "2px",
        background: "rgba(56,189,248,0.06)",
        caretColor: lang === "ar" ? "#f59e0b" : "#34d399",
        whiteSpace: "nowrap",
        overflow: "hidden",
        cursor: "text",
        userSelect: "text",
        WebkitUserSelect: "text",
      }}
    />
  );
}

// Re-export to satisfy legacy types if any
export type { LocalOverride };
