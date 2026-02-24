"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Map from "@engine/map";
import { CATALOG_ITEMS, CatalogItem, CatalogView } from "@obora/catalog";
import { DesignLayer } from "@obora/design";
import { usePlannerStore } from "@/stores/use-planner-store";
import maplibregl from "maplibre-gl";
import { Check, ChevronUp, Redo2, RotateCw, Undo2, X } from "lucide-react";

type SheetSnap = "collapsed" | "half" | "full";
type MobileMode = "browse" | "edit" | "material";

type DraftPlacement = {
  id: "draft-placement";
  type: string;
  position: { lng: number; lat: number };
  rotationY: number;
  sourceItem: CatalogItem;
};

export default function Home() {
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const desktopMapInstanceRef = useRef<maplibregl.Map | null>(null);
  const desktopMapPanelRef = useRef<HTMLDivElement | null>(null);
  const suppressMapPlacementUntilRef = useRef(0);
  const [isDesktopCatalogDragging, setIsDesktopCatalogDragging] =
    useState(false);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("collapsed");
  const [browseSnapBeforeEdit, setBrowseSnapBeforeEdit] =
    useState<SheetSnap>("collapsed");
  const [mobileMode, setMobileMode] = useState<MobileMode>("browse");
  const [draftPlacement, setDraftPlacement] = useState<DraftPlacement | null>(
    null,
  );
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(
    null,
  );

  const {
    placedBuildings,
    selectedBuildingId,
    addBuilding,
    moveBuilding,
    rotateBuilding,
    selectBuilding,
    isInteractingWithModel,
    setInteractingWithModel,
  } = usePlannerStore();

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => {
      setIsDesktopViewport(media.matches);
    };

    update();
    media.addEventListener("change", update);
    return () => {
      media.removeEventListener("change", update);
    };
  }, []);

  const allVisibleBuildings = useMemo(() => {
    if (!draftPlacement) return placedBuildings;
    return [...placedBuildings, draftPlacement];
  }, [placedBuildings, draftPlacement]);

  const activeSelectedId = draftPlacement
    ? draftPlacement.id
    : selectedBuildingId;

  const enterEditModeForItem = useCallback(
    (item: CatalogItem) => {
      const center = mapInstanceRef.current?.getCenter();
      if (!center) return;

      setBrowseSnapBeforeEdit(sheetSnap);
      setDraftPlacement({
        id: "draft-placement",
        type: item.type,
        sourceItem: item,
        position: { lng: center.lng, lat: center.lat },
        rotationY: 0,
      });
      setMobileMode("edit");
      setSheetSnap("collapsed");
      selectBuilding(null);
    },
    [selectBuilding, sheetSnap],
  );

  const updateDraftPosition = useCallback(
    (position: { lng: number; lat: number }) => {
      setDraftPlacement((draft) => (draft ? { ...draft, position } : draft));
    },
    [],
  );

  const updateDraftRotation = useCallback((rotationY: number) => {
    setDraftPlacement((draft) => (draft ? { ...draft, rotationY } : draft));
  }, []);

  const exitDraftMode = useCallback(() => {
    setDraftPlacement(null);
    setMobileMode("browse");
    setSheetSnap(browseSnapBeforeEdit);
  }, [browseSnapBeforeEdit]);

  const acceptDraft = useCallback(() => {
    if (!draftPlacement) return;
    addBuilding(
      draftPlacement.type,
      draftPlacement.position,
      draftPlacement.rotationY,
    );
    exitDraftMode();
  }, [addBuilding, draftPlacement, exitDraftMode]);

  const hasCatalogPayload = useCallback((dataTransfer: DataTransfer) => {
    const types = Array.from(dataTransfer.types ?? []);
    return (
      types.includes("application/obora-item") ||
      types.includes("text/plain") ||
      (
        dataTransfer.types as unknown as { contains?: (t: string) => boolean }
      )?.contains?.("application/obora-item") === true
    );
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (hasCatalogPayload(e.dataTransfer)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    },
    [hasCatalogPayload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDesktopCatalogDragging(false);
      const data =
        e.dataTransfer.getData("application/obora-item") ||
        e.dataTransfer.getData("text/plain");
      const mapInstance = desktopMapInstanceRef.current;
      if (!data || !mapInstance) return;

      try {
        const item: CatalogItem = JSON.parse(data);
        const mapCanvas = desktopMapPanelRef.current?.querySelector(
          ".maplibregl-canvas",
        ) as HTMLCanvasElement | null;
        if (!mapCanvas) {
          console.warn("Desktop map canvas not found for drop");
          return;
        }
        const rect = mapCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const lngLat = mapInstance.unproject([x, y]);
        addBuilding(item.type, { lng: lngLat.lng, lat: lngLat.lat });
      } catch (err) {
        console.error("Failed to drop item", err);
      }
    },
    [addBuilding],
  );

  const handleMapClickForPlacement = useCallback(
    (coords: { lng: number; lat: number }) => {
      if (!draftPlacement) return;
      if (
        isInteractingWithModel ||
        performance.now() <= suppressMapPlacementUntilRef.current
      ) {
        return;
      }
      updateDraftPosition(coords);
    },
    [draftPlacement, isInteractingWithModel, updateDraftPosition],
  );

  const suppressNextPlacementTap = useCallback(() => {
    suppressMapPlacementUntilRef.current = performance.now() + 250;
  }, []);

  const handleMoveBuilding = useCallback(
    (id: string, position: { lng: number; lat: number }) => {
      if (id === "draft-placement") {
        updateDraftPosition(position);
        return;
      }
      moveBuilding(id, position);
    },
    [moveBuilding, updateDraftPosition],
  );

  const handleRotateBuilding = useCallback(
    (id: string, rotationY: number) => {
      if (id === "draft-placement") {
        updateDraftRotation(rotationY);
        return;
      }
      rotateBuilding(id, rotationY);
    },
    [rotateBuilding, updateDraftRotation],
  );

  const handleSelectBuilding = useCallback(
    (id: string | null) => {
      if (draftPlacement) return;
      selectBuilding(id);
    },
    [draftPlacement, selectBuilding],
  );

  const sheetHeightClass =
    mobileMode === "edit" || mobileMode === "material"
      ? sheetSnap === "full"
        ? "h-[92dvh]"
        : "h-44"
      : sheetSnap === "collapsed"
        ? "h-24"
        : sheetSnap === "half"
          ? "h-[52dvh]"
          : "h-[92dvh]";

  if (isDesktopViewport === null) {
    return <main className="w-screen h-screen overflow-hidden bg-white" />;
  }

  return (
    <main className="w-screen h-screen overflow-hidden">
      {isDesktopViewport ? (
        <div className="w-full h-full flex">
          <CatalogView
            onItemDragStart={() => setIsDesktopCatalogDragging(true)}
            onItemDragEnd={() => setIsDesktopCatalogDragging(false)}
          />
          <div ref={desktopMapPanelRef} className="flex-1 relative">
            <Map
              interactive={!isInteractingWithModel}
              onMapInstance={(map) => {
                desktopMapInstanceRef.current = map;
                mapInstanceRef.current = map;
              }}
              onCanvasPointerMissed={() => {
                selectBuilding(null);
              }}
              geocoder={{
                provider: "photon",
                position: "top-left",
                placeholder: "Search with Photon",
                language: "en",
                limit: 8,
              }}
            >
              <DesignLayer
                buildings={placedBuildings}
                selectedId={selectedBuildingId}
                onMoveBuilding={moveBuilding}
                onRotateBuilding={rotateBuilding}
                onSelectBuilding={selectBuilding}
                onInteractionStart={() => {
                  suppressNextPlacementTap();
                  setInteractingWithModel(true);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.dragPan.disable();
                    mapInstanceRef.current.dragRotate.disable();
                    mapInstanceRef.current.scrollZoom.disable();
                    mapInstanceRef.current.touchZoomRotate.disable();
                  }
                }}
                onInteractionEnd={() => {
                  suppressNextPlacementTap();
                  setInteractingWithModel(false);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.dragPan.enable();
                    mapInstanceRef.current.dragRotate.enable();
                    mapInstanceRef.current.scrollZoom.enable();
                    mapInstanceRef.current.touchZoomRotate.enable();
                  }
                }}
              />
            </Map>
            {isDesktopCatalogDragging && (
              <div
                className="absolute inset-0 z-30 border-2 border-dashed border-emerald-500/70 bg-emerald-500/10"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragLeave={(e) => {
                  if (
                    e.currentTarget.contains(e.relatedTarget as Node | null)
                  ) {
                    return;
                  }
                }}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full">
          <Map
            interactive={!isInteractingWithModel}
            onMapInstance={(map) => {
              mapInstanceRef.current = map;
            }}
            onCanvasPointerMissed={() => {
              handleSelectBuilding(null);
            }}
            onMapClick={handleMapClickForPlacement}
            geocoder={{
              provider: "photon",
              position: "top-left",
              placeholder: "Search with Photon",
              language: "en",
              limit: 8,
            }}
          >
            <DesignLayer
              buildings={allVisibleBuildings}
              selectedId={activeSelectedId}
              onMoveBuilding={handleMoveBuilding}
              onRotateBuilding={handleRotateBuilding}
              onSelectBuilding={handleSelectBuilding}
              onInteractionStart={() => {
                suppressNextPlacementTap();
                setInteractingWithModel(true);
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.dragPan.disable();
                  mapInstanceRef.current.dragRotate.disable();
                  mapInstanceRef.current.scrollZoom.disable();
                  mapInstanceRef.current.touchZoomRotate.disable();
                }
              }}
              onInteractionEnd={() => {
                suppressNextPlacementTap();
                setInteractingWithModel(false);
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.dragPan.enable();
                  mapInstanceRef.current.dragRotate.enable();
                  mapInstanceRef.current.scrollZoom.enable();
                  mapInstanceRef.current.touchZoomRotate.enable();
                }
              }}
            />
          </Map>

          <div className="pointer-events-none absolute inset-x-3 bottom-28 flex justify-end gap-2">
            <button className="pointer-events-auto h-10 w-10 rounded-full bg-white/90 shadow border border-black/10 grid place-items-center">
              <Undo2 className="h-4 w-4" />
            </button>
            <button className="pointer-events-auto h-10 w-10 rounded-full bg-white/90 shadow border border-black/10 grid place-items-center">
              <Redo2 className="h-4 w-4" />
            </button>
          </div>

          <div
            className={`absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-black/10 bg-white/96 shadow-2xl backdrop-blur transition-[height] duration-200 ${sheetHeightClass}`}
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
                      onClick={() =>
                        setDraftPlacement((draft) =>
                          draft
                            ? {
                                ...draft,
                                rotationY: draft.rotationY + Math.PI / 4,
                              }
                            : draft,
                        )
                      }
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
      )}
    </main>
  );
}
