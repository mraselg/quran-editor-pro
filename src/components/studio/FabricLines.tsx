// HTML/CSS renderer for the 9 Quran rows.
// Each row is an absolutely positioned box mapped to a physical SVG band so
// Arabic shaping is handled by the browser's text engine (correct ligatures,
// RTL bidi) and the text is strictly confined inside its template band.

import { memo, useEffect, useRef } from "react";

import { TopSymbolLayer } from "./TopSymbolLayer";
import { useOverridesStore, rowKey, layerKey } from "@/state/overridesStore";
import { useEditorStore } from "@/state/editorStore";
import { MASTER_DEFAULTS } from "@/state/overridesStore";
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

export const ARABIC_FONT_PX = 50;
export const BANGLA_FONT_PX = 18;
export const SYMBOL_FONT_PX = 28;

/**
 * Baked-in baseline Y-offsets for the master Kariana template.
 * These are permanently applied to the layout — the user-facing sliders
 * show DELTA from these values, so the slider reads 0 when at the
 * correct master position. Changing the slider to +5 means +5 from here.
 */
export const BASE_ARABIC_Y = -15; // px: Arabic text sits 15px above band centre
export const BASE_BANGLA_Y = 2;   // px: Bangla translation 2px below centre
export const BASE_SYMBOL_Y = -2;  // px: Tajweed symbol strip 2px up

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
  const arabicRefs = useRef(new Map<number, React.RefObject<HTMLSpanElement | null>>());
  const getRef = (i: number) => {
    let r = arabicRefs.current.get(i);
    if (!r) {
      r = { current: null } as React.RefObject<HTMLSpanElement | null>;
      arabicRefs.current.set(i, r);
    }
    return r;
  };

  const localMap = useOverridesStore((s) => s.local);
  const patchLocal = useOverridesStore((s) => s.patchLocal);
  const gArabic = useOverridesStore((s) => s.global.arabicFontPx) ?? MASTER_DEFAULTS.arabicFontPx ?? ARABIC_FONT_PX;
  const gBangla = useOverridesStore((s) => s.global.banglaFontPx) ?? MASTER_DEFAULTS.banglaFontPx ?? BANGLA_FONT_PX;
  const gArabicY = BASE_ARABIC_Y + (useOverridesStore((s) => s.global.arabicYOffset) ?? 0);
  const gBanglaY = BASE_BANGLA_Y + (useOverridesStore((s) => s.global.banglaYOffset) ?? 0);
  const gSymbolY = BASE_SYMBOL_Y + (useOverridesStore((s) => s.global.symbolYOffset) ?? 0);
  const editMode = useEditorStore((s) => s.editMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const selection = useEditorStore((s) => s.selection);
  const focusedRowKey = useEditorStore((s) => s.focusedRowKey);
  const isTypeTool = editMode && activeTool === "type";
  // All pages for cross-page reflow
  const allPages = useReflowStore((s) => s.pages);

  return (
    <div style={{ position: "relative", width, height, pointerEvents: editMode ? "auto" : "none" }}>

      {layout.map((L, i) => {
        if (skipSet.has(i)) return null;
        const slot = lines[i];
        if (!slot) return null;

        const arabicSpanRef = getRef(i);
        const rk = rowKey(pageId, i);
        const rOv = localMap[rk];
        const rowFontPx = rOv?.fontPx ?? gArabic;
        const rowScale = rOv?.scale ?? 1;
        const rowTx = rOv?.dx ?? 0;
        const rowTy = rOv?.dy ?? 0;
        const rowSymbolPx = Math.round((rowFontPx / ARABIC_FONT_PX) * SYMBOL_FONT_PX);
        // Check if this row is the focused (navigated-to) row
        const lkAr = layerKey(pageId, i, "arabic");
        const lkBn = layerKey(pageId, i, "bangla");
        const lkSy = layerKey(pageId, i, "symbol");
        const isFlashing = focusedRowKey === rk ||
          focusedRowKey === lkAr || focusedRowKey === lkBn || focusedRowKey === lkSy;

        // Arabic layer properties
        const aLk = layerKey(pageId, i, "arabic");
        const aOv = localMap[aLk];
        const aDx = aOv?.dx ?? 0;
        const aDy = aOv?.dy ?? 0;
        const aFontPx = aOv?.fontPx ?? rowFontPx;
        const aLeading = aOv?.leading ?? 1;
        const aTracking = aOv?.tracking ?? 0;
        const aVScale = (aOv?.vScale ?? 100) / 100;
        const aHScale = (aOv?.hScale ?? 100) / 100;
        const aBaseline = aOv?.baseline ?? 0;
        const aAlign = aOv?.align ?? "justify";
        const aText = aOv?.text ?? slot.arabic ?? "";
        const isArabicEditing = isTypeTool && selection?.key === aLk && selection?.pageId === pageId;

        return (
          <div
            key={`row-${i}`}
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
              // 1-second amber flash ring when navigated to via history
              outline: isFlashing ? "2px solid rgba(251,191,36,0.85)" : undefined,
              outlineOffset: isFlashing ? "2px" : undefined,
              borderRadius: isFlashing ? "3px" : undefined,
              animation: isFlashing ? "rowFlash 1.1s ease-out" : undefined,
            }}
          >
            {/* ── Symbol strip ─────────────────────────────────────────────
                Position: absolute top=0, height=symH.
                ALWAYS rendered even if slot.arabic is empty,
                so sibling bands below never shift up.               */}
            <div
              data-sel-kind={isTypeTool ? "layer" : undefined}
              data-sel-key={isTypeTool ? layerKey(pageId, i, "symbol") : undefined}
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
              {slot.arabic && (
                <TopSymbolLayer
                  arabic={slot.arabic}
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

              {/* ── Arabic band ─────────────────────────────────────────────── */}
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
                  textAlign: aAlign as React.CSSProperties["textAlign"],
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
                    allPages={allPages}
                    fontFamily={arabicFamily}
                    fontSize={aFontPx}
                    availableWidth={width - 16}
                    externalRef={arabicSpanRef as unknown as React.MutableRefObject<HTMLElement | null>}
                    onSave={(t) => patchLocal(aLk, { text: t })}
                  />
                ) : (
                  slot.arabic && (
                    <span
                      ref={arabicSpanRef}
                      style={{ display: "inline-block", width: "100%", textAlign: aAlign as React.CSSProperties["textAlign"], textAlignLast: "justify" }}
                    >
                      {aText}
                    </span>
                  )
                )}
              </div>

            {/* ── Bangla band ─────────────────────────────────────────────── */}
            {(() => {
              const lk = layerKey(pageId, i, "bangla");
              const lOv = localMap[lk];
              const bFontPx = lOv?.fontPx ?? gBangla;
              const bLeading = lOv?.leading ?? 1.1;
              const bTracking = lOv?.tracking ?? 0;
              const bVScale = (lOv?.vScale ?? 100) / 100;
              const bHScale = (lOv?.hScale ?? 100) / 100;
              const bBaseline = lOv?.baseline ?? 0;
              const bAlign = lOv?.align ?? "justify";
              const bText = lOv?.text ?? slot.bangla ?? "";
              const isEditing = isTypeTool && selection?.key === lk && selection?.pageId === pageId;
              return (
                <div
                  lang="bn"
                  data-sel-kind={isTypeTool ? "layer" : undefined}
                  data-sel-key={isTypeTool ? lk : undefined}
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
                    textAlign: bAlign as React.CSSProperties["textAlign"],
                    textAlignLast: bAlign === "justify" ? "justify" : undefined,
                    whiteSpace: "normal",
                    transform: `translateY(${gBanglaY + bBaseline}px) scaleX(${bHScale}) scaleY(${bVScale})`,
                    transformOrigin: "top left",
                    zIndex: 10,
                    pointerEvents: isTypeTool ? "auto" : "none",
                    cursor: isEditing ? "text" : isTypeTool ? "pointer" : "default",
                  }}
                >
                  {isEditing ? (
                    <InlineTextEditor
                      key={lk}
                      layerKey={lk}
                      initialText={bText}
                      dir="ltr"
                      lang="bn"
                      rowIndex={i}
                      pageId={pageId}
                      layer="bangla"
                      lines={lines}
                      allPages={allPages}
                      fontFamily={banglaFamily}
                      fontSize={bFontPx}
                      availableWidth={width - 16}
                      onSave={(t) => patchLocal(lk, { text: t })}
                    />
                  ) : (
                    slot.bangla && (
                      <span style={{ display: "inline-block", width: "100%", textAlign: bAlign as React.CSSProperties["textAlign"], textAlignLast: "justify" }}>
                        {bText}
                      </span>
                    )
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// InlineTextEditor — contenteditable with reflow support
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
  allPages,
  fontFamily,
  fontSize,
  availableWidth,
  externalRef,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allPages: Array<{ id: string; lines: any[] }>;
  fontFamily: string;
  fontSize: number;
  availableWidth: number;
  externalRef?: React.MutableRefObject<HTMLElement | null>;
  onSave: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Track whether we've committed so unmount doesn't double-save
  const committedRef = useRef(false);

  // ── Mount: initialise text, focus, cursor at end ─────────────────────────
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Set initial text
    el.textContent = initialText;
    el.focus();

    // Expose this element to the parent so TopSymbolLayer's measurer
    // can track character positions while editing.
    if (externalRef) externalRef.current = el;

    // Place cursor at end
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

    // On unmount: save if not already saved + clear externalRef
    return () => {
      if (externalRef && externalRef.current === el) externalRef.current = null;
      if (!committedRef.current) {
        const text = ref.current?.textContent ?? "";
        onSave(text);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ── Reflow helper ─────────────────────────────────────────────────────────
  const getReflowBase = () => ({
    layer,
    allPages,
    localMap: useOverridesStore.getState().local,
    patchLocal: useOverridesStore.getState().patchLocal,
    layerKeyFn: layerKey,
    fontFamily,
    fontSize,
    availableWidth,
  });

  // ── Save current text and mark committed ──────────────────────────────────
  const commit = (text?: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    const finalText = text ?? ref.current?.textContent ?? "";
    onSave(finalText);
  };

  // ── Overflow detection ────────────────────────────────────────────────────
  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    const currentText = el.textContent ?? "";

    // clientWidth is the inner width (excluding borders) — correct for overflow check
    if (el.scrollWidth <= el.clientWidth + 2) return;

    const { fits, overflow } = splitToFit(currentText, availableWidth, fontFamily, fontSize);
    if (!overflow) return;

    // Silent: avoid spamming history with per-keystroke overflow patches
    void import("@/state/historyStore").then(({ beginSilent, endSilent }) => {
      beginSilent();
      try {
        useOverridesStore.getState().patchLocal(lk, { text: fits });
      } finally {
        endSilent();
      }
    });

    // Reset editor content to the fitting portion
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

    // Cascade overflow to the next row(s) — also silent
    const nextRowIdx = rowIndex + 1;
    const nextOnPage = nextRowIdx < lines.length;
    const targetPageId = nextOnPage
      ? pageId
      : (() => {
          const pi = allPages.findIndex((p) => p.id === pageId);
          return pi >= 0 && pi + 1 < allPages.length ? allPages[pi + 1].id : pageId;
        })();
    const targetRowIdx = nextOnPage ? nextRowIdx : 0;

    void import("@/state/historyStore").then(({ beginSilent, endSilent }) => {
      beginSilent();
      try {
        reflowFrom({
          ...getReflowBase(),
          startPageId: targetPageId,
          startRowIndex: targetRowIdx,
          startOverflow: overflow,
        });
      } finally {
        endSilent();
      }
    });
  };

  // ── Keyboard ──────────────────────────────────────────────────────────────
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

      // Commit the before-text to this row
      commit(beforeText);
      el.textContent = beforeText;

      // Push after-text to the next row / next page
      const nextRowIdx = rowIndex + 1;
      const nextOnPage = nextRowIdx < lines.length;

      const base = getReflowBase();
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

    // Shift+Enter: prevent default line-break (we manage single-line content)
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
        // Save on blur only if not already committed (e.g. via Escape or Enter).
        // Do NOT reset committedRef here — overflow may have already saved the
        // fitting text and we must not re-save the full (overflowing) content.
        if (!committedRef.current) {
          commit();
        }
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
