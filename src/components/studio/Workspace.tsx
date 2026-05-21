import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FontProvider } from "@/context/FontContext";
import { BackgroundProvider } from "@/context/BackgroundContext";
import { TajweedRulesProvider } from "@/context/TajweedRulesContext";
import { Artboard } from "./Artboard";
import { CanvasToolbar } from "./CanvasToolbar";
import { Inspector } from "./Inspector";
import { PageList } from "./PageList";
import { TopBar } from "./TopBar";
import { SelectionPanel } from "./SelectionPanel";
import { Toaster } from "@/components/ui/sonner";
import { useOverridesStore } from "@/state/overridesStore";
import { useEditorStore } from "@/state/editorStore";
import { useReflowStore } from "@/state/reflowStore";

type Stage = "ui" | "fonts" | "ready";

export function Workspace() {
  const [mounted, setMounted] = useState(false);
  const pages = useReflowStore((s) => s.pages);
  const initReflow = useReflowStore((s) => s.init);
  const [activeId, setActiveId] = useState(pages[0]?.id ?? "");
  const [zoom, setZoom] = useState(85);
  const [stage, setStage] = useState<Stage>("ui");

  // Pan and Zoom state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, sx: 0, sy: 0 });

  useEffect(() => setMounted(true), []);

  const active = useMemo(
    () => pages.find((p) => p.id === activeId) ?? pages[0],
    [activeId, pages],
  );

  const activeIdx = useMemo(
    () => pages.findIndex((p) => p.id === activeId),
    [activeId, pages],
  );

  const goToPrev = useCallback(() => {
    if (activeIdx > 0) setActiveId(pages[activeIdx - 1].id);
  }, [activeIdx, pages]);

  const goToNext = useCallback(() => {
    if (activeIdx < pages.length - 1) setActiveId(pages[activeIdx + 1].id);
  }, [activeIdx, pages]);

  // Keep activeId valid after reflow shuffles pages.
  useEffect(() => {
    if (!pages.find((p) => p.id === activeId) && pages[0]) {
      setActiveId(pages[0].id);
    }
  }, [pages, activeId]);

  // Wire history-item navigation: when navigateToPageId is set, jump to that page.
  const navigateToPageId = useEditorStore((s) => s.navigateToPageId);
  useEffect(() => {
    if (!navigateToPageId) return;
    const exists = pages.find((p) => p.id === navigateToPageId);
    if (exists) setActiveId(navigateToPageId);
    // Clear after consuming
    useEditorStore.getState().clearFocusedRow();
    useEditorStore.setState({ navigateToPageId: null });
  }, [navigateToPageId, pages]);

  const distribution = useReflowStore((s) => s.distribution);
  const totalAyat = useMemo(
    () => distribution.reduce((acc, d) => {
      if (d.firstVerse != null && d.lastVerse != null) {
        return acc + (d.lastVerse - d.firstVerse + 1);
      }
      return acc;
    }, 0),
    [distribution],
  );

  // Boot the reflow store once.
  useEffect(() => {
    void initReflow();
  }, [initReflow]);

  // Fast boot — mark ready after a single animation frame
  useEffect(() => {
    let cancelled = false;
    setStage("fonts");
    if (typeof document !== "undefined" && (document as any).fonts?.load) {
      (document as any).fonts.load("32px 'Excellent Arabic'").catch(() => {});
    }
    const raf = requestAnimationFrame(() => {
      if (!cancelled) setStage("ready");
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Spacebar panning
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        setIsSpaceDown(true);
        return;
      }

      const tag = (e.target as HTMLElement | null)?.tagName;
      const targetEl = e.target as HTMLElement | null;
      const inContentEditable = targetEl?.closest('[contenteditable="true"]') !== null;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || inContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      // Ctrl+Z / Ctrl+Shift+Z — undo/redo
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useOverridesStore.temporal.getState().redo();
        else useOverridesStore.temporal.getState().undo();
        return;
      }

      // Ctrl+P — open PDF export (prevent browser print)
      if (mod && e.key.toLowerCase() === "p") {
        e.preventDefault();
        document.getElementById("btn-export-pdf")?.click();
        return;
      }

      if (inInput) return;

      const sel = useEditorStore.getState().selection;

      // Arrow nudge when row is selected
      if (sel && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const cur = useOverridesStore.getState().local[sel.key] ?? {};
        const dx = cur.dx ?? 0;
        const dy = cur.dy ?? 0;
        const patch =
          e.key === "ArrowLeft" ? { dx: dx - step }
          : e.key === "ArrowRight" ? { dx: dx + step }
          : e.key === "ArrowUp" ? { dy: dy - step }
          : { dy: dy + step };
        useOverridesStore.getState().patchLocal(sel.key, patch);
        return;
      }

      // ← / → page navigation (when no row is selected)
      if (!sel && e.key === "ArrowLeft") { e.preventDefault(); goToPrev(); return; }
      if (!sel && e.key === "ArrowRight") { e.preventDefault(); goToNext(); return; }

      switch (e.key.toLowerCase()) {
        case "escape":
          e.preventDefault();
          if (useEditorStore.getState().activeTool === "type") {
            useEditorStore.getState().setActiveTool("select");
          } else if (sel) {
            useEditorStore.getState().setSelection(null);
          } else if (useEditorStore.getState().layerPanelOpen) {
            useEditorStore.getState().setLayerPanelOpen(false);
          } else if (useEditorStore.getState().editMode) {
            useEditorStore.getState().toggleEditMode();
          }
          break;
        case "v":
          if (useEditorStore.getState().editMode) {
            e.preventDefault();
            useEditorStore.getState().setActiveTool("select");
          }
          break;
        case "t":
          if (useEditorStore.getState().editMode) {
            e.preventDefault();
            useEditorStore.getState().setActiveTool("type");
          }
          break;
        case "e":
          e.preventDefault();
          useEditorStore.getState().toggleEditMode();
          break;
        case "g":
          e.preventDefault();
          useEditorStore.getState().setShowGuides(!useEditorStore.getState().showGuides);
          break;
        case "l":
          e.preventDefault();
          useEditorStore.getState().toggleLayerPanel();
          break;
        case "f":
          e.preventDefault();
          setZoom(85);
          break;
        case "[":
          e.preventDefault();
          setZoom((z) => Math.max(25, z - 10));
          break;
        case "]":
          e.preventDefault();
          setZoom((z) => Math.min(300, z + 10));
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpaceDown(false);
        isDragging.current = false;
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [goToPrev, goToNext]);

  // Native wheel handler to prevent browser zoom (passive: false is required)
  // Attached to window to catch Ctrl+Scroll globally and reliably block native zoom.
  useEffect(() => {
    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -10 : 10;
        setZoom((z) => Math.max(25, Math.min(300, z + delta)));
      }
    };

    window.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleNativeWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;

    // Don't pan if clicking an interactive element, UNLESS spacebar is held
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [data-sel-key]')) {
      if (!isSpaceDown) return;
    }

    isDragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      sx: scrollRef.current?.scrollLeft || 0,
      sy: scrollRef.current?.scrollTop || 0,
    };
    target.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (isDragging.current && scrollRef.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      scrollRef.current.scrollLeft = dragStart.current.sx - dx;
      scrollRef.current.scrollTop = dragStart.current.sy - dy;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // SSR skeleton
  if (!mounted) {
    return (
      <div className="flex h-screen flex-col bg-neutral-950">
        <div className="flex h-[52px] items-center gap-3 border-b border-neutral-800 bg-neutral-900/80 px-4">
          <div className="h-9 w-9 animate-pulse rounded-md bg-amber-500/20" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-28 animate-pulse rounded bg-neutral-700" />
            <div className="h-2 w-20 animate-pulse rounded bg-neutral-800" />
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r border-neutral-800 bg-neutral-950" />
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-3 text-neutral-500 text-sm">
              <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
              লোড হচ্ছে…
            </div>
          </div>
          <div className="w-[320px] border-l border-neutral-800 bg-neutral-950" />
        </div>
      </div>
    );
  }

  return (
    <>
      <FontProvider>
        <BackgroundProvider>
          <TajweedRulesProvider>
            <div className="flex h-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100">
              <TopBar totalPages={pages.length} totalAyat={Math.max(totalAyat, 7)} />
            <div className="flex flex-1 overflow-hidden">
              <PageList pages={pages} activeId={activeId} onSelect={setActiveId} />
              <main className="flex flex-1 flex-col overflow-hidden">
                <CanvasToolbar
                  zoom={zoom}
                  setZoom={setZoom}
                  pageLabel={`পেজ: ${active?.footer.pageNo ?? ""} (${active?.lines.filter(l => l.slotKind === "ayah").length ?? 9} সারি)`}
                  onPrevPage={goToPrev}
                  onNextPage={goToNext}
                  canGoPrev={activeIdx > 0}
                  canGoNext={activeIdx < pages.length - 1}
                />
                <div className="relative flex-1 bg-[radial-gradient(ellipse_at_top,#1c1917_0%,#0a0a0a_70%)] overflow-hidden">
                  {stage !== "ready" ? (
                    <BootOverlay stage={stage} />
                  ) : (
                    <>
                      {/* Canvas Scroll Area */}
                      <div 
                        ref={scrollRef}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        className={`absolute inset-0 overflow-auto text-center ${isSpaceDown ? 'cursor-grab' : ''} ${isSpaceDown && isDragging.current ? 'cursor-grabbing' : ''}`}
                        style={{ padding: "40px 0" }}
                      >
                        <div
                          style={{
                            display: "inline-block",
                            textAlign: "left",
                            width: 780 * (zoom / 100),
                            height: 1170 * (zoom / 100),
                            position: "relative",
                            transition: "width 100ms ease-out, height 100ms ease-out",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              transform: `scale(${zoom / 100})`,
                              transformOrigin: "top left",
                              transition: "transform 100ms ease-out",
                            }}
                          >
                            <Artboard page={active} zoom={zoom / 100} />
                          </div>
                        </div>
                      </div>

                      {/* Fixed UI Overlays (Arrows & Page Counter) */}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-between p-6">
                        <button
                          onClick={goToPrev}
                          disabled={activeIdx <= 0}
                          title="আগের পেজ (←)"
                          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/80 text-neutral-400 transition-all hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300 disabled:opacity-20 disabled:hover:bg-neutral-900/80 disabled:hover:text-neutral-400"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          onClick={goToNext}
                          disabled={activeIdx >= pages.length - 1}
                          title="পরের পেজ (→)"
                          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/80 text-neutral-400 transition-all hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300 disabled:opacity-20 disabled:hover:bg-neutral-900/80 disabled:hover:text-neutral-400"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2">
                        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/90 px-3 py-1.5 text-xs backdrop-blur shadow-lg shadow-black/20">
                          <span className="text-neutral-500">পেজ</span>
                          <span className="font-bold text-amber-300">{activeIdx + 1}</span>
                          <span className="text-neutral-600">/</span>
                          <span className="text-neutral-400">{pages.length}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </main>
              <Inspector page={active} />
            </div>

            {/* Legacy selection pill — hidden, replaced by LayerWindow */}
            <SelectionPanel />
          </div>
        </TajweedRulesProvider>
      </BackgroundProvider>
    </FontProvider>
    <Toaster position="bottom-right" theme="dark" richColors />
  </>
  );
}

function BootOverlay({ stage }: { stage: Stage }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-[280px] rounded-xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-2xl backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-300">Studio Al-Qalam</span>
        </div>
        <p className="text-sm text-neutral-300">
          {stage === "ui" ? "ইউআই লোড হচ্ছে…" : "আরবি ফন্ট লোড হচ্ছে…"}
        </p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
            style={{ width: stage === "ui" ? "33%" : "66%" }}
          />
        </div>
      </div>
    </div>
  );
}
