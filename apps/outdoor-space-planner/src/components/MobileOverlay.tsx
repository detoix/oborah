"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CATALOG_ITEMS, CatalogItem } from "@oborah/catalog";
import { ChevronLeft, RotateCw, X, Check, Camera } from "lucide-react";
import { SheetSnap, MobileMode, DraftPlacement } from "../hooks/use-planner-ui";

interface MobileOverlayProps {
  sheetSnap: SheetSnap;
  setSheetSnap: (snap: SheetSnap | ((prev: SheetSnap) => SheetSnap)) => void;
  mobileMode: MobileMode;
  setMobileMode: (mode: MobileMode) => void;
  draftPlacement: DraftPlacement | null;
  enterEditModeForItem: (item: CatalogItem) => void;
  exitDraftMode: () => void;
  acceptDraft: () => void;
  rotateDraft: () => void;
  isArMode: boolean;
  onToggleArMode: () => void;
}

type SnapOffsets = Record<SheetSnap, number>;

const DRAG_THRESHOLD_PX = 8;
const FLICK_VELOCITY_PX_PER_MS = 0.55;

function getViewportHeight() {
  if (typeof window === "undefined") return 0;
  return Math.round(window.visualViewport?.height ?? window.innerHeight);
}

function getSnapOffsets(
  viewportHeight: number,
  mobileMode: MobileMode,
): SnapOffsets {
  const safeHeight = Math.max(viewportHeight, 480);
  const full = Math.round(Math.max(0, safeHeight * 0.08));

  // Adapt drawer's physical exposed height to the content
  let collapsedHeight = 132;
  // Edit mode inherits Browse mode's height (132px) for seamless transition!
  if (mobileMode === "material") {
    collapsedHeight = 310; // Only Material mode gets expanded because it has a grid of items
  }

  const collapsed = Math.round(Math.max(0, safeHeight - collapsedHeight));
  const halfTarget = Math.round(safeHeight * 0.48);
  const half = Math.min(collapsed - 48, Math.max(full + 48, halfTarget));

  return { full, half, collapsed };
}

function getNearestSnap(offset: number, snapOffsets: SnapOffsets): SheetSnap {
  const snaps: SheetSnap[] = ["full", "half", "collapsed"];
  return snaps.reduce((closest, candidate) =>
    Math.abs(snapOffsets[candidate] - offset) <
    Math.abs(snapOffsets[closest] - offset)
      ? candidate
      : closest,
  );
}

function getAdjacentSnap(
  snap: SheetSnap,
  direction: "up" | "down",
  snapOffsets: SnapOffsets,
): SheetSnap {
  const ordered = (["full", "half", "collapsed"] as SheetSnap[]).sort(
    (a, b) => snapOffsets[a] - snapOffsets[b],
  );
  const index = ordered.indexOf(snap);
  if (direction === "up") return ordered[Math.max(index - 1, 0)];
  return ordered[Math.min(index + 1, ordered.length - 1)];
}

export function MobileOverlay({
  sheetSnap,
  setSheetSnap,
  mobileMode,
  setMobileMode,
  draftPlacement,
  enterEditModeForItem,
  exitDraftMode,
  acceptDraft,
  rotateDraft,
  isArMode,
  onToggleArMode,
}: MobileOverlayProps) {
  const [viewportHeight, setViewportHeight] = useState(0);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef({
    pointerId: -1,
    startY: 0,
    startOffset: 0,
    currentOffset: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0,
    moved: false,
    active: false,
  });
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const updateViewportMetrics = () => {
      setViewportHeight(getViewportHeight());
    };

    updateViewportMetrics();
    window.addEventListener("resize", updateViewportMetrics);
    window.visualViewport?.addEventListener("resize", updateViewportMetrics);
    window.visualViewport?.addEventListener("scroll", updateViewportMetrics);
    return () => {
      window.removeEventListener("resize", updateViewportMetrics);
      window.visualViewport?.removeEventListener(
        "resize",
        updateViewportMetrics,
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        updateViewportMetrics,
      );
    };
  }, []);

  const snapOffsets = useMemo(
    () => getSnapOffsets(viewportHeight, mobileMode),
    [viewportHeight, mobileMode],
  );
  const snappedOffset = snapOffsets[sheetSnap];
  const currentOffset = dragOffset ?? snappedOffset;
  const isSheetExpanded = sheetSnap !== "collapsed";

  const settleFromOffset = useCallback(
    (offset: number, velocity: number) => {
      const nearest = getNearestSnap(offset, snapOffsets);
      let nextSnap = nearest;

      if (velocity <= -FLICK_VELOCITY_PX_PER_MS) {
        nextSnap = getAdjacentSnap(nearest, "up", snapOffsets);
      } else if (velocity >= FLICK_VELOCITY_PX_PER_MS) {
        nextSnap = getAdjacentSnap(nearest, "down", snapOffsets);
      }

      setSheetSnap(nextSnap);
    },
    [setSheetSnap, snapOffsets],
  );

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      const now = performance.now();

      dragStateRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startOffset: currentOffset,
        currentOffset,
        lastY: event.clientY,
        lastTime: now,
        velocity: 0,
        moved: false,
        active: true,
      };
      suppressClickRef.current = false;
      setIsDragging(true);
      setDragOffset(currentOffset);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [currentOffset],
  );

  const handleDragMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragStateRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;

      const deltaY = event.clientY - drag.startY;
      if (Math.abs(deltaY) >= DRAG_THRESHOLD_PX) {
        drag.moved = true;
        suppressClickRef.current = true;
      }

      const nextOffset = Math.max(
        snapOffsets.full,
        Math.min(snapOffsets.collapsed, drag.startOffset + deltaY),
      );

      const now = performance.now();
      const dt = now - drag.lastTime;
      if (dt > 0) {
        drag.velocity = (event.clientY - drag.lastY) / dt;
      }
      drag.lastY = event.clientY;
      drag.lastTime = now;
      drag.currentOffset = nextOffset;

      setDragOffset(nextOffset);
    },
    [snapOffsets.collapsed, snapOffsets.full],
  );

  const handleDragEnd = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragStateRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;

      drag.active = false;
      setIsDragging(false);
      setDragOffset(null);
      event.currentTarget.releasePointerCapture(event.pointerId);

      if (drag.moved) {
        settleFromOffset(drag.currentOffset, drag.velocity);
      }
    },
    [settleFromOffset],
  );

  const handleHandleClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    setSheetSnap((prev) =>
      prev === "collapsed" ? "half" : prev === "half" ? "full" : "collapsed",
    );
  }, [setSheetSnap]);

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {/* Edit-mode placement hint */}
      {mobileMode === "edit" && draftPlacement && (
        <div className="pointer-events-none absolute inset-x-4 top-24 z-10 flex justify-center">
          <div className="inline-flex rounded-full bg-black/65 px-3.5 py-1.5 text-xs font-medium text-white/90 shadow-lg">
            Tap map to place · drag to adjust
          </div>
        </div>
      )}

      {/* Floating AR View Toggle Button (Moves with sheet) */}
      <div
        className={`pointer-events-none fixed inset-x-0 top-0 z-10 flex flex-col items-end px-4 ${
          isDragging
            ? ""
            : "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        }`}
        style={{ transform: `translateY(calc(${currentOffset}px - 4.5rem))` }}
      >
        <button
          type="button"
          onClick={onToggleArMode}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] text-slate-700 active:scale-95 transition-all outline-none border border-black/5"
          aria-label={isArMode ? "Exit AR" : "View in AR"}
        >
          {isArMode ? (
            <X className="h-6 w-6 text-red-500" />
          ) : (
            <Camera className="h-6 w-6 text-emerald-600" />
          )}
        </button>
      </div>

      {/* Bottom sheet */}
      <div
        className={`pointer-events-auto fixed inset-x-0 bottom-0 h-[100dvh] max-h-[100dvh] rounded-t-[2rem] border-t border-white/30 bg-white/65 shadow-[0_-8px_40px_rgb(0,0,0,0.10)] backdrop-blur-2xl will-change-transform ${
          isDragging
            ? ""
            : "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        }`}
        style={{ transform: `translateY(${currentOffset}px)` }}
      >
        <div className="flex h-full min-h-0 flex-col pt-[max(env(safe-area-inset-top),0.375rem)]">
          {/* Drag handle */}
          <button
            type="button"
            aria-label="Change sheet size"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            onClick={handleHandleClick}
            className="flex w-full touch-none justify-center pt-2 pb-3"
          >
            <span className="h-1 w-10 rounded-full bg-black/15" />
          </button>

          {/* Browse mode */}
          {mobileMode === "browse" && (
            <div className="flex min-h-0 flex-1 flex-col pb-3 relative">
              {isSheetExpanded ? (
                <div className="flex min-h-0 flex-1 flex-col px-4">
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-black/35">
                    Catalog
                  </p>
                  <input
                    type="search"
                    placeholder="Search catalog..."
                    className="mb-3 h-10 w-full rounded-xl border border-black/8 bg-white/50 px-3.5 text-sm outline-none transition-all focus:bg-white/90 focus:ring-2 focus:ring-emerald-500/25"
                  />
                  <div
                    className="grid min-h-0 flex-1 grid-cols-4 gap-2 overflow-y-auto overscroll-y-contain pb-4 pr-1"
                    style={{
                      paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
                    }}
                  >
                    {CATALOG_ITEMS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => enterEditModeForItem(item)}
                        className="rounded-[1.1rem] border border-white/70 bg-white/80 p-2.5 text-center shadow-sm active:scale-95 transition-transform"
                      >
                        <div className="mb-1.5 flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 text-emerald-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
                          <div className="scale-90">{item.icon}</div>
                        </div>
                        <div className="text-[9px] font-semibold leading-tight text-black/70">
                          {item.name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Collapsed: horizontal scroll strip */
                <div
                  className="relative px-3"
                  style={{
                    paddingBottom:
                      "calc(0.25rem + env(safe-area-inset-bottom))",
                  }}
                >
                  <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-2">
                    {CATALOG_ITEMS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => enterEditModeForItem(item)}
                        className="shrink-0 w-[4.6rem] rounded-[1.1rem] border border-white/70 bg-white/80 p-2 text-center shadow-sm active:scale-95 transition-transform"
                      >
                        <div className="mb-1 flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 text-emerald-700">
                          <div className="scale-90">{item.icon}</div>
                        </div>
                        <div className="text-[9px] font-semibold leading-tight text-black/70">
                          {item.name}
                        </div>
                      </button>
                    ))}
                  </div>
                  {/* Fade-out hint at right edge */}
                  <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-white/60 to-transparent" />
                </div>
              )}
            </div>
          )}

          {/* Edit mode */}
          {mobileMode === "edit" && draftPlacement && (
            <div
              className="flex flex-col justify-start px-4 pt-1"
              style={{
                paddingBottom: "calc(0.25rem + env(safe-area-inset-bottom))",
              }}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold tracking-tight text-black/90 leading-tight">
                    {draftPlacement.sourceItem.name}
                  </p>
                  <p className="text-[11px] text-black/50 leading-tight mt-0.5">
                    Tap map to place
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={rotateDraft}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.9rem] border border-white/70 bg-white/80 shadow-sm active:scale-95 transition-transform"
                  aria-label="Rotate"
                >
                  <RotateCw className="h-[16px] w-[16px] text-slate-700" />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileMode("material")}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.9rem] border border-white/70 bg-white/80 shadow-sm text-[16px] active:scale-95 transition-transform"
                  aria-label="Material"
                >
                  🎨
                </button>
                <button
                  type="button"
                  onClick={exitDraftMode}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.9rem] border border-white/70 bg-white/80 shadow-sm active:scale-95 transition-transform"
                  aria-label="Cancel"
                >
                  <X className="h-[16px] w-[16px] text-slate-700" />
                </button>
                <button
                  type="button"
                  onClick={acceptDraft}
                  className="ml-auto flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[0.9rem] bg-emerald-600 px-4 text-[13px] font-semibold text-white shadow-md active:scale-95 transition-transform"
                >
                  <Check className="h-[16px] w-[16px]" />
                  Place
                </button>
              </div>
            </div>
          )}

          {/* Material mode */}
          {mobileMode === "material" && draftPlacement && (
            <div
              className="flex flex-col justify-start px-4 pt-4"
              style={{
                paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
              }}
            >
              <div className="mb-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileMode("edit")}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-white/70 bg-white/80 shadow-sm active:scale-95 transition-transform"
                  aria-label="Back"
                >
                  <ChevronLeft className="h-5 w-5 text-slate-700 -ml-0.5" />
                </button>
                <p className="text-[15px] font-semibold text-black/90">
                  Select Material
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {["Cedar", "Pine", "Oak", "Composite", "Metal", "White"].map(
                  (name) => (
                    <button
                      key={name}
                      type="button"
                      className="rounded-[1.1rem] border border-white/70 bg-white/80 p-3.5 text-left text-[14px] font-medium text-slate-700 shadow-sm active:scale-95 transition-transform"
                    >
                      {name}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
