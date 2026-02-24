"use client";

import { CATALOG_ITEMS, CatalogItem } from "@oborah/catalog";
import { ChevronUp, RotateCw, X, Check, Undo2, Redo2 } from "lucide-react";
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
  sheetHeightClass: string;
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
  sheetHeightClass,
}: MobileOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-4 bottom-32 flex justify-end gap-3">
        <button className="pointer-events-auto h-12 w-12 rounded-2xl bg-white/70 backdrop-blur-md shadow-lg border border-white/40 grid place-items-center active:scale-90 transition-transform">
          <Undo2 className="h-5 w-5 text-black/70" />
        </button>
        <button className="pointer-events-auto h-12 w-12 rounded-2xl bg-white/70 backdrop-blur-md shadow-lg border border-white/40 grid place-items-center active:scale-90 transition-transform">
          <Redo2 className="h-5 w-5 text-black/70" />
        </button>
      </div>

      <div
        className={`pointer-events-auto absolute inset-x-0 bottom-0 z-20 rounded-t-[2.5rem] border-t border-white/40 bg-white/60 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] backdrop-blur-2xl transition-[height] duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${sheetHeightClass}`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-center pt-3 pb-2">
            <button
              type="button"
              aria-label="Change sheet size"
              onClick={() =>
                setSheetSnap((prev) =>
                  prev === "collapsed"
                    ? "half"
                    : prev === "half"
                      ? "full"
                      : "collapsed",
                )
              }
              className="flex flex-col items-center gap-1.5 px-8 pt-1 pb-2"
            >
              <span className="h-1.5 w-14 rounded-full bg-black/10 shadow-[inner_0_1px_2px_rgba(0,0,0,0.1)]" />
              <ChevronUp
                className={`h-4 w-4 text-black/30 transition-all duration-300 ${
                  sheetSnap === "full" ? "rotate-180" : ""
                } ${sheetSnap === "collapsed" ? "opacity-100" : "opacity-0"}`}
              />
            </button>
          </div>

          {mobileMode === "browse" && (
            <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
              {sheetSnap !== "collapsed" && (
                <input
                  type="search"
                  placeholder="Search catalog..."
                  className="mb-4 h-11 rounded-2xl border border-white/80 bg-white/40 px-4 text-sm outline-none backdrop-blur-sm transition-all focus:bg-white/80 focus:ring-2 focus:ring-emerald-500/20"
                />
              )}

              <div
                className={
                  sheetSnap === "collapsed"
                    ? "flex gap-2.5 overflow-x-auto pb-3 no-scrollbar -mx-1 px-1"
                    : "grid grid-cols-4 gap-2 overflow-y-auto pb-4"
                }
              >
                {CATALOG_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => enterEditModeForItem(item)}
                    className={
                      sheetSnap === "collapsed"
                        ? "shrink-0 min-w-[4.8rem] rounded-[1.25rem] border border-white/60 bg-white/70 p-2 text-center shadow-sm backdrop-blur-sm active:scale-95 transition-all"
                        : "rounded-[1.25rem] border border-white/60 bg-white/70 p-2 text-center shadow-sm backdrop-blur-sm active:scale-95 transition-all"
                    }
                  >
                    <div className="mb-1.5 flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-700 shadow-inner">
                      <div className="scale-90">{item.icon}</div>
                    </div>
                    <div className="text-[9px] font-semibold leading-tight text-black/80">
                      {item.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mobileMode === "edit" && draftPlacement && (
            <div
              className="flex flex-1 flex-col px-4 pb-4"
              style={{
                paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
              }}
            >
              <div className="mb-3">
                <div className="text-sm font-semibold">
                  {draftPlacement.sourceItem.name}
                </div>
                <div className="text-xs text-black/60">
                  Tap map to place, drag or rotate, then accept
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={rotateDraft}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white"
                  aria-label="Rotate"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileMode("material")}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white"
                  aria-label="Material"
                >
                  🎨
                </button>
                <button
                  type="button"
                  onClick={exitDraftMode}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={acceptDraft}
                  className="ml-auto inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white"
                >
                  <Check className="h-4 w-4" />
                  Accept
                </button>
              </div>
            </div>
          )}

          {mobileMode === "material" && draftPlacement && (
            <div
              className="flex flex-1 flex-col px-4 pb-4"
              style={{
                paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileMode("edit")}
                  className="rounded-lg border border-black/10 bg-white px-2 py-1 text-sm"
                >
                  ←
                </button>
                <div className="text-sm font-semibold">Material</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {["Cedar", "Pine", "Oak", "Composite", "Metal", "White"].map(
                  (name) => (
                    <button
                      key={name}
                      type="button"
                      className="rounded-xl border border-black/10 bg-white px-3 py-3 text-left text-sm"
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

      {mobileMode === "edit" && draftPlacement && (
        <div className="pointer-events-none absolute inset-x-4 top-16 z-10">
          <div className="inline-flex rounded-full bg-black/70 px-3 py-1 text-xs text-white">
            Preview mode: tap map to place object
          </div>
        </div>
      )}
    </div>
  );
}
