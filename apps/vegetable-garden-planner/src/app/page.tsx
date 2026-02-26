"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GeoCenter, GeoPoint } from "@oborah/geo";
import { CATALOG_ITEMS } from "@oborah/catalog";
import type { MapApi, MapViewState } from "@oborah/map";
import { MapViewport } from "@/components/MapViewport";
import { ARViewport } from "@/components/ARViewport";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { MobileOverlay } from "@/components/MobileOverlay";
import { usePlannerStore } from "@/stores/use-planner-store";
import { usePlannerUI } from "@/hooks/use-planner-ui";
import { useMapDrop } from "@/hooks/use-map-drop";

const MAP_ORIGIN: GeoCenter = {
  lng: 19.945,
  lat: 50.0647,
};

export default function Home() {
  const mapApiRef = useRef<MapApi | null>(null);
  const desktopMapApiRef = useRef<MapApi | null>(null);
  const suppressMapPlacementUntilRef = useRef(0);
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(
    null,
  );
  const [isArMode, setIsArMode] = useState<boolean>(false);
  const [mapOrigin, setMapOrigin] = useState<GeoCenter>(MAP_ORIGIN);

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

  const {
    sheetSnap,
    setSheetSnap,
    mobileMode,
    setMobileMode,
    draftPlacement,
    enterEditModeForItem,
    exitDraftMode,
    updateDraftPosition,
    updateDraftRotation,
    rotateDraft,
  } = usePlannerUI(mapApiRef, selectBuilding);

  const {
    isCatalogDragging,
    setIsCatalogDragging,
    handleDragOver,
    handleDrop,
  } = useMapDrop(desktopMapApiRef, addBuilding);

  const buildingsWithConfig = useMemo(() => {
    return placedBuildings.map((b) => ({
      ...b,
      visualConfig: CATALOG_ITEMS.find((item) => item.id === b.catalogItemId)
        ?.visualConfig,
    }));
  }, [placedBuildings]);

  const allVisibleBuildings = useMemo(() => {
    const draft = draftPlacement
      ? [
          {
            ...draftPlacement,
            visualConfig: draftPlacement.sourceItem.visualConfig,
          },
        ]
      : [];
    return [...buildingsWithConfig, ...draft];
  }, [buildingsWithConfig, draftPlacement]);

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

  const activeSelectedId = draftPlacement
    ? draftPlacement.id
    : selectedBuildingId;

  const acceptDraft = useCallback(() => {
    if (!draftPlacement) return;
    addBuilding({
      kind: draftPlacement.kind,
      catalogItemId: draftPlacement.catalogItemId,
      position: draftPlacement.position,
      rotationY: draftPlacement.rotationY,
    });
    exitDraftMode();
  }, [addBuilding, draftPlacement, exitDraftMode]);

  const handleMapClickForPlacement = useCallback(
    (coords: GeoPoint) => {
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

  const handleMapViewChange = useCallback((view: MapViewState) => {
    setMapOrigin((prev) =>
      prev.lng === view.center.lng && prev.lat === view.center.lat
        ? prev
        : view.center,
    );
  }, []);

  const handleMoveBuilding = useCallback(
    (id: string, position: GeoPoint) => {
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
        ? "h-[94dvh]"
        : "h-48"
      : sheetSnap === "collapsed"
        ? "h-32"
        : sheetSnap === "half"
          ? "h-[50dvh]"
          : "h-[94dvh]";

  if (isDesktopViewport === null) {
    return <main className="w-screen h-screen overflow-hidden bg-white" />;
  }

  return (
    <main className="w-screen h-screen overflow-hidden">
      {isDesktopViewport ? (
        <div className="w-full h-full flex">
          <DesktopSidebar setIsCatalogDragging={setIsCatalogDragging} />
          <div className="flex-1 relative">
            <MapViewport
              buildings={buildingsWithConfig}
              selectedId={selectedBuildingId}
              origin={mapOrigin}
              isInteractingWithModel={isInteractingWithModel}
              onViewChange={handleMapViewChange}
              onMapReady={(api) => {
                desktopMapApiRef.current = api;
                mapApiRef.current = api;
              }}
              onCanvasPointerMissed={() => selectBuilding(null)}
              onMoveBuilding={moveBuilding}
              onRotateBuilding={rotateBuilding}
              onSelectBuilding={selectBuilding}
              onInteractionStart={() => {
                suppressNextPlacementTap();
                setInteractingWithModel(true);
              }}
              onInteractionEnd={() => {
                suppressNextPlacementTap();
                setInteractingWithModel(false);
              }}
            />
            {isCatalogDragging && (
              <div
                className="absolute inset-0 z-30 border-2 border-dashed border-emerald-500/70 bg-emerald-500/10"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full">
          <MapViewport
            buildings={allVisibleBuildings}
            selectedId={activeSelectedId}
            origin={mapOrigin}
            isInteractingWithModel={isInteractingWithModel}
            onViewChange={handleMapViewChange}
            onMapReady={(api) => {
              mapApiRef.current = api;
            }}
            onCanvasPointerMissed={() => handleSelectBuilding(null)}
            onMapClick={handleMapClickForPlacement}
            onMoveBuilding={handleMoveBuilding}
            onRotateBuilding={handleRotateBuilding}
            onSelectBuilding={handleSelectBuilding}
            onInteractionStart={() => {
              suppressNextPlacementTap();
              setInteractingWithModel(true);
            }}
            onInteractionEnd={() => {
              suppressNextPlacementTap();
              setInteractingWithModel(false);
            }}
          />

          {/* AR Viewport Toggle Support */}
          {isArMode && (
            <div className="absolute inset-0 z-10 bg-black">
              <ARViewport
                buildings={allVisibleBuildings}
                selectedId={activeSelectedId}
                onSelectBuilding={handleSelectBuilding}
                onMoveBuilding={handleMoveBuilding}
                onRotateBuilding={handleRotateBuilding}
                onInteractionStart={() => setInteractingWithModel(true)}
                onInteractionEnd={() => setInteractingWithModel(false)}
              />
            </div>
          )}

          <MobileOverlay
            sheetSnap={sheetSnap}
            setSheetSnap={setSheetSnap}
            mobileMode={mobileMode}
            setMobileMode={setMobileMode}
            draftPlacement={draftPlacement}
            enterEditModeForItem={enterEditModeForItem}
            exitDraftMode={exitDraftMode}
            acceptDraft={acceptDraft}
            rotateDraft={rotateDraft}
            sheetHeightClass={sheetHeightClass}
            isArMode={isArMode}
            onToggleArMode={() => setIsArMode(!isArMode)}
          />
        </div>
      )}
    </main>
  );
}
