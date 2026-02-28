"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CATALOG_ITEMS, CatalogItem } from "@oborah/catalog";
import { ChevronLeft, RotateCw, X, Check, Camera, LocateFixed } from "lucide-react";
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
  compassHeading: number | null;
  onToggleArMode: () => void;
  onLocateMe: () => void;
}

type SnapOffsets = Record<SheetSnap, number>;

const DRAG_THRESHOLD_PX = 8;
const FLICK_VELOCITY_PX_PER_MS = 0.55;

const SHEET_TRANSITION = "transition-transform duration-300 ease-out";
const ICON_BTN =
  "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80 shadow-sm active:scale-95 transition-transform";

function getViewportHeight() {
  if (typeof window === "undefined") return 0;
  return Math.round(window.visualViewport?.height ?? window.innerHeight);
}

function getSnapOffsets(
  viewportHeight: number,
  mobileMode: MobileMode,
): SnapOffsets {
  const safeHeight = Math.max(viewportHeight, 480);
  const full = 72;

  let collapsedHeight = 132;
  if (mobileMode === "material") {
    collapsedHeight = 310;
  }

  const collapsed = Math.round(Math.max(0, safeHeight - collapsedHeight));
  return { full, collapsed };
}

function getNearestSnap(offset: number, snapOffsets: SnapOffsets): SheetSnap {
  const mid = (snapOffsets.full + snapOffsets.collapsed) / 2;
  return offset < mid ? "full" : "collapsed";
}

function CatalogButton({
  item,
  onClick,
  className,
}: {
  item: CatalogItem;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl bg-white/80 text-center shadow-sm active:scale-95 transition-transform ${className ?? ""}`}
    >
      <div className="mb-1 flex h-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
        {item.icon}
      </div>
      <p className="text-[10px] font-semibold leading-tight text-black/70">
        {item.name}
      </p>
    </button>
  );
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
  compassHeading,
  onToggleArMode,
  onLocateMe,
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
    const update = () => setViewportHeight(getViewportHeight());
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);

  const snapOffsets = useMemo(
    () => getSnapOffsets(viewportHeight, mobileMode),
    [viewportHeight, mobileMode],
  );
  const snappedOffset = snapOffsets[sheetSnap];
  const currentOffset = dragOffset ?? snappedOffset;
  const isSheetExpanded = sheetSnap !== "collapsed";
  const sheetTransition = isDragging ? "" : SHEET_TRANSITION;

  const settleFromOffset = useCallback(
    (offset: number, velocity: number) => {
      if (velocity <= -FLICK_VELOCITY_PX_PER_MS) {
        setSheetSnap("full");
      } else if (velocity >= FLICK_VELOCITY_PX_PER_MS) {
        setSheetSnap("collapsed");
      } else {
        setSheetSnap(getNearestSnap(offset, snapOffsets));
      }
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

    setSheetSnap((prev) => (prev === "collapsed" ? "full" : "collapsed"));
  }, [setSheetSnap]);

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {/* North needle (AR only) — centered when facing north, slides sideways otherwise */}
      {isArMode && (() => {
        if (compassHeading === null) return null;

        const heading = ((compassHeading % 360) + 360) % 360;
        // Normalize heading to -180..180 so the needle slides left/right
        let offset = heading;
        if (offset > 180) offset -= 360;
        if (Math.abs(offset) < 0.5) offset = 0;
        const absOffset = Math.abs(offset);

        // Map degrees to viewport percentage (clamp so it doesn't fly off screen)
        // At ±90° the needle reaches the edge; beyond that it stays clamped
        const pct = Math.max(-50, Math.min(50, (offset / 90) * 50));
        // Fade out as user turns away from north; fully hidden at 180° (south)
        const visibility = Math.max(0, Math.min(1, 1 - absOffset / 180));
        if (visibility <= 0.02) return null;
        return (
          <div
            className="pointer-events-none absolute top-0 z-30 transition-all duration-150"
            style={{
              left: `calc(50% + ${-pct}%)`,
              transform: `translateX(-50%) scale(${0.85 + visibility * 0.15})`,
              opacity: visibility,
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "14px solid rgb(5 150 105)",
              }}
            />
            <p className="mt-0.5 text-center text-[8px] font-bold text-emerald-700">N</p>
          </div>
        );
      })()}

      {/* Placement hint */}
      {mobileMode === "edit" && draftPlacement && (
        <p className="pointer-events-none absolute inset-x-4 top-24 z-10 text-center">
          <span className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-medium text-white shadow-lg">
            Tap map to place · drag to adjust
          </span>
        </p>
      )}

      {/* Map controls (move with sheet, hidden when expanded) */}
      {!isSheetExpanded && (
      <div
        className={`pointer-events-none fixed inset-x-0 top-0 z-10 flex justify-end px-4 ${sheetTransition}`}
        style={{ transform: `translateY(calc(${currentOffset}px - 8.5rem))` }}
      >
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onLocateMe}
            className={`pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg active:scale-95 transition-all ${isArMode ? "invisible" : ""}`}
            aria-label="Locate me"
          >
            <LocateFixed className="h-6 w-6 text-slate-700" />
          </button>
          <button
            type="button"
            onClick={onToggleArMode}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg active:scale-95 transition-all"
            aria-label={isArMode ? "Exit AR" : "View in AR"}
          >
            {isArMode ? (
              <X className="h-6 w-6 text-red-500" />
            ) : (
              <Camera className="h-6 w-6 text-emerald-600" />
            )}
          </button>
        </div>
      </div>
      )}

      {/* Bottom sheet */}
      <div
        className={`pointer-events-auto fixed inset-x-0 bottom-0 h-[100dvh] rounded-t-3xl bg-white/60 shadow-2xl backdrop-blur-2xl ${sheetTransition}`}
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
            className="flex w-full touch-none justify-center py-3"
          >
            <span className="h-1 w-10 rounded-full bg-black/15" />
          </button>

          {/* Browse mode */}
          {!isArMode && mobileMode === "browse" && (
            <>
              {isSheetExpanded ? (
                <div className="overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-black/40">
                    Catalog
                  </p>
                  <input
                    type="search"
                    placeholder="Search catalog..."
                    className="mb-3 h-10 w-full rounded-xl border border-black/10 bg-white/50 px-4 text-sm outline-none focus:bg-white/90 focus:ring-2 focus:ring-emerald-500/25"
                  />
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-2">
                    {CATALOG_ITEMS.map((item) => (
                      <CatalogButton
                        key={item.id}
                        item={item}
                        onClick={() => enterEditModeForItem(item)}
                        className="p-2"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-2 overflow-hidden px-4 pb-4">
                  {CATALOG_ITEMS.map((item) => (
                    <CatalogButton
                      key={item.id}
                      item={item}
                      onClick={() => enterEditModeForItem(item)}
                      className="p-2"
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Edit mode */}
          {!isArMode && mobileMode === "edit" && draftPlacement && (
            <div
              className="px-4 pt-1"
              style={{
                paddingBottom: "calc(0.25rem + env(safe-area-inset-bottom))",
              }}
            >
              <div className="mb-1.5">
                <p className="text-sm font-semibold text-black/90">
                  {draftPlacement.sourceItem.name}
                </p>
                <p className="text-xs text-black/50">Tap map to place</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={rotateDraft}
                  className={ICON_BTN}
                  aria-label="Rotate"
                >
                  <RotateCw className="h-4 w-4 text-slate-700" />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileMode("material")}
                  className={`${ICON_BTN} text-base`}
                  aria-label="Material"
                >
                  🎨
                </button>
                <button
                  type="button"
                  onClick={exitDraftMode}
                  className={ICON_BTN}
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4 text-slate-700" />
                </button>
                <button
                  type="button"
                  onClick={acceptDraft}
                  className="ml-auto flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-md active:scale-95 transition-transform"
                >
                  <Check className="h-4 w-4" />
                  Place
                </button>
              </div>
            </div>
          )}

          {/* Material mode */}
          {!isArMode && mobileMode === "material" && draftPlacement && (
            <div
              className="px-4 pt-4"
              style={{
                paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
              }}
            >
              <div className="mb-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileMode("edit")}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/80 shadow-sm active:scale-95 transition-transform"
                  aria-label="Back"
                >
                  <ChevronLeft className="h-5 w-5 text-slate-700" />
                </button>
                <p className="text-sm font-semibold text-black/90">
                  Select Material
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {["Cedar", "Pine", "Oak", "Composite", "Metal", "White"].map(
                  (name) => (
                    <button
                      key={name}
                      type="button"
                      className="rounded-2xl bg-white/80 p-4 text-left text-sm font-medium text-slate-700 shadow-sm active:scale-95 transition-transform"
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
