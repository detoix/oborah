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
      {/* Undo/Redo Buttons */}
      <div className="absolute inset-x-3 bottom-28 flex justify-end gap-2">
        <button className="pointer-events-auto h-10 w-10 rounded-full bg-white/90 shadow border border-black/10 grid place-items-center">
          <Undo2 className="h-4 w-4" />
        </button>
        <button className="pointer-events-auto h-10 w-10 rounded-full bg-white/90 shadow border border-black/10 grid place-items-center">
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      <div
        className={`pointer-events-auto absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-black/10 bg-white/96 shadow-2xl backdrop-blur transition-[height] duration-200 ${sheetHeightClass}`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-center pt-2 pb-1">
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
              className="flex flex-col items-center gap-1"
            >
              <span className="h-1.5 w-12 rounded-full bg-black/15" />
              <ChevronUp
                className={`h-4 w-4 text-black/45 transition-transform ${
                  sheetSnap === "full" ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          {mobileMode === "browse" && (
            <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
              {sheetSnap !== "collapsed" && (
                <input
                  type="search"
                  placeholder="Search catalog..."
                  className="mb-3 h-10 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none"
                />
              )}

              <div
                className={
                  sheetSnap === "collapsed"
                    ? "flex gap-2 overflow-x-auto pb-1"
                    : "grid grid-cols-3 gap-2 overflow-y-auto"
                }
              >
                {CATALOG_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => enterEditModeForItem(item)}
                    className={
                      sheetSnap === "collapsed"
                        ? "shrink-0 min-w-20 rounded-2xl border border-black/10 bg-white px-3 py-2 text-left shadow-sm"
                        : "rounded-2xl border border-black/10 bg-white p-3 text-left shadow-sm"
                    }
                  >
                    <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-black/5">
                      {item.icon}
                    </div>
                    <div className="text-xs font-medium leading-tight">
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
