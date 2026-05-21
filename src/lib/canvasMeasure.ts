/**
 * Canvas-based Text Measurement Utilities
 * ----------------------------------------
 * Replaces DOM-span-based measurement (Layout Thrashing) with
 * OffscreenCanvas.measureText() which is hundreds of times faster
 * and does not require DOM access or force browser layout.
 *
 * Font must be loaded (via document.fonts.load or FontFace API) before
 * calling these functions for accurate results.
 */

/** One OffscreenCanvas + 2D context per font key, reused across calls. */
const _ctxCache = new Map<string, OffscreenCanvasRenderingContext2D>();

function getCtx(fontFamily: string, fontSize: number): OffscreenCanvasRenderingContext2D {
  const key = `${fontSize}|${fontFamily}`;
  let ctx = _ctxCache.get(key);
  if (!ctx) {
    const oc = new OffscreenCanvas(1, 1);
    const c2d = oc.getContext("2d");
    if (!c2d) throw new Error("OffscreenCanvas 2d context unavailable");
    c2d.font = `${fontSize}px ${fontFamily}`;
    ctx = c2d;
    _ctxCache.set(key, ctx);
  }
  return ctx;
}

/**
 * Measures the rendered pixel width of `text` using Canvas API.
 * This is the drop-in replacement for DOM-span-based measureTextWidth().
 *
 * Performance: ~0.001ms per call vs ~0.5–2ms for DOM offsetWidth.
 */
export function measureTextWidthCanvas(
  text: string,
  fontFamily: string,
  fontSize: number,
): number {
  if (!text) return 0;
  // Fallback to DOM measurement if OffscreenCanvas is not available
  // (SSR / old browsers). Should not happen in modern Chrome/Firefox.
  if (typeof OffscreenCanvas === "undefined") {
    return measureTextWidthDOM(text, fontFamily, fontSize);
  }
  const ctx = getCtx(fontFamily, fontSize);
  return ctx.measureText(text).width;
}

/**
 * Splits `text` into { fits, overflow } based on available `maxWidth`.
 * Uses Canvas measurement — no DOM reads.
 */
export function splitToFitCanvas(
  text: string,
  maxWidth: number,
  fontFamily: string,
  fontSize: number,
): { fits: string; overflow: string } {
  if (!text.trim()) return { fits: text, overflow: "" };

  if (measureTextWidthCanvas(text, fontFamily, fontSize) <= maxWidth) {
    return { fits: text, overflow: "" };
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    // Single word that doesn't fit — keep it anyway (no split possible)
    return { fits: text, overflow: "" };
  }

  let fits = "";
  for (let i = 0; i < words.length; i++) {
    const candidate = fits ? fits + " " + words[i] : words[i];
    if (measureTextWidthCanvas(candidate, fontFamily, fontSize) <= maxWidth) {
      fits = candidate;
    } else {
      return {
        fits,
        overflow: words.slice(i).join(" "),
      };
    }
  }

  return { fits: text, overflow: "" };
}

/**
 * Invalidate all cached contexts (call after font size or family changes
 * that are not captured in the key, e.g. font-variant-numeric).
 */
export function invalidateCanvasMeasureCache(): void {
  _ctxCache.clear();
}

// ─── DOM fallback (used only when OffscreenCanvas is unavailable) ─────────────
let _measureSpan: HTMLSpanElement | null = null;

function getMeasureSpan(): HTMLSpanElement {
  if (!_measureSpan || !document.body.contains(_measureSpan)) {
    _measureSpan = document.createElement("span");
    _measureSpan.style.cssText = [
      "position:absolute",
      "visibility:hidden",
      "white-space:nowrap",
      "pointer-events:none",
      "top:-9999px",
      "left:-9999px",
    ].join(";");
    document.body.appendChild(_measureSpan);
  }
  return _measureSpan;
}

function measureTextWidthDOM(text: string, fontFamily: string, fontSize: number): number {
  const span = getMeasureSpan();
  span.style.fontFamily = fontFamily;
  span.style.fontSize = `${fontSize}px`;
  span.textContent = text;
  return span.offsetWidth;
}
