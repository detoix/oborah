"use client";

import { CATALOG_ITEMS, CatalogItem } from "@oborah/catalog";
import { ChevronLeft, RotateCw, X, Check, Undo2, Redo2 } from "lucide-react";
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
  isArMode: boolean;
  onToggleArMode: () => void;
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
  isArMode,
  onToggleArMode,
}: MobileOverlayProps) {
  const isSheetExpanded = sheetSnap !== "collapsed";

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Undo / Redo — only visible when browsing with sheet collapsed */}
      {mobileMode === "browse" && !isSheetExpanded && (
        <div className="absolute inset-x-4 bottom-36 flex justify-end gap-2.5">
          <button className="pointer-events-auto h-11 w-11 rounded-2xl bg-white/75 backdrop-blur-md shadow-md border border-white/50 grid place-items-center active:scale-90 transition-transform">
            <Undo2 className="h-4.5 w-4.5 text-black/60" />
          </button>
          <button className="pointer-events-auto h-11 w-11 rounded-2xl bg-white/75 backdrop-blur-md shadow-md border border-white/50 grid place-items-center active:scale-90 transition-transform">
            <Redo2 className="h-4.5 w-4.5 text-black/60" />
          </button>
        </div>
      )}

      {/* Edit-mode placement hint */}
      {mobileMode === "edit" && draftPlacement && (
        <div className="pointer-events-none absolute inset-x-4 top-16 z-10 flex justify-center">
          <div className="inline-flex rounded-full bg-black/65 px-3.5 py-1.5 text-xs font-medium text-white/90 shadow-lg">
            Tap map to place · drag to adjust
          </div>
        </div>
      )}

      {/* Bottom sheet */}
      <div
        className={`pointer-events-auto absolute inset-x-0 bottom-0 z-20 rounded-t-[2rem] border-t border-white/30 bg-white/65 shadow-[0_-8px_40px_rgb(0,0,0,0.10)] backdrop-blur-2xl transition-[height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${sheetHeightClass}`}
      >
        <div className="flex h-full flex-col">
          {/* Drag handle */}
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
            className="flex justify-center pt-3 pb-2 w-full"
          >
            <span className="h-1 w-10 rounded-full bg-black/15" />
          </button>

          {/* Browse mode */}
          {mobileMode === "browse" && (
            <div className="flex min-h-0 flex-1 flex-col pb-3 relative">
              
              {/* Toggle to AR View */}
              <button
                type="button"
                onClick={onToggleArMode}
                className="absolute right-4 -top-14 h-11 px-4 rounded-full bg-indigo-600 shadow-md border border-indigo-500 font-semibold text-white/90 active:scale-95 transition-transform flex items-center justify-center pointer-events-auto"
                aria-label="Toggle AR"
              >
                <div className="mr-2">📷</div>
                {isArMode ? "Exit AR" : "View in AR"}
              </button>

              {isSheetExpanded ? (
                <div className="px-4">
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-black/35">
                    Catalog
                  </p>
                  <input
                    type="search"
                    placeholder="Search catalog..."
                    className="mb-3 h-10 w-full rounded-xl border border-black/8 bg-white/50 px-3.5 text-sm outline-none transition-all focus:bg-white/90 focus:ring-2 focus:ring-emerald-500/25"
                  />
                  <div className="grid grid-cols-4 gap-2 overflow-y-auto pb-4">
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
                <div className="relative px-3">
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
              className="flex flex-1 flex-col justify-end px-4"
              style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
            >
              <div className="mb-3">
                <p className="text-sm font-semibold text-black/85">
                  {draftPlacement.sourceItem.name}
                </p>
                <p className="text-xs text-black/45 mt-0.5">
                  Tap the map to place, then accept
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={rotateDraft}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white shadow-sm active:scale-95 transition-transform"
                  aria-label="Rotate"
                >
                  <RotateCw className="h-4 w-4 text-black/60" />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileMode("material")}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white shadow-sm text-base active:scale-95 transition-transform"
                  aria-label="Material"
                >
                  🎨
                </button>
                <button
                  type="button"
                  onClick={exitDraftMode}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white shadow-sm active:scale-95 transition-transform"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4 text-black/60" />
                </button>
                <button
                  type="button"
                  onClick={acceptDraft}
                  className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-md active:scale-95 transition-transform"
                >
                  <Check className="h-4 w-4" />
                  Place
                </button>
              </div>
            </div>
          )}

          {/* Material mode */}
          {mobileMode === "material" && draftPlacement && (
            <div
              className="flex flex-1 flex-col px-4"
              style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
            >
              <div className="mb-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMobileMode("edit")}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 bg-white/90"
                  aria-label="Back"
                >
                  <ChevronLeft className="h-4 w-4 text-black/60" />
                </button>
                <p className="text-sm font-semibold text-black/85">Material</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {["Cedar", "Pine", "Oak", "Composite", "Metal", "White"].map(
                  (name) => (
                    <button
                      key={name}
                      type="button"
                      className="rounded-xl border border-black/8 bg-white/90 px-3 py-3 text-left text-sm font-medium text-black/75 shadow-sm active:scale-95 transition-transform"
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
