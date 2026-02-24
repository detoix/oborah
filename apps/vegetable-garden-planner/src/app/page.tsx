"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CATALOG_ITEMS } from "@oborah/catalog";
import { MapViewport } from "@/components/MapViewport";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { MobileOverlay } from "@/components/MobileOverlay";
import { usePlannerStore } from "@/stores/use-planner-store";
import maplibregl from "maplibre-gl";
import { usePlannerUI } from "@/hooks/use-planner-ui";
import { useMapDrop } from "@/hooks/use-map-drop";

const MAP_ORIGIN = {
  longitude: 19.945,
  latitude: 50.0647,
};

export default function Home() {
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const desktopMapInstanceRef = useRef<maplibregl.Map | null>(null);
  const desktopMapPanelRef = useRef<HTMLDivElement | null>(null);
  const suppressMapPlacementUntilRef = useRef(0);
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
  } = usePlannerUI(mapInstanceRef, selectBuilding);

  const {
    isCatalogDragging,
    setIsCatalogDragging,
    handleDragOver,
    handleDrop,
  } = useMapDrop(desktopMapInstanceRef, desktopMapPanelRef, addBuilding);

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
          <DesktopSidebar setIsCatalogDragging={setIsCatalogDragging} />
          <div ref={desktopMapPanelRef} className="flex-1 relative">
            <MapViewport
              buildings={buildingsWithConfig}
              selectedId={selectedBuildingId}
              origin={MAP_ORIGIN}
              isInteractingWithModel={isInteractingWithModel}
              onMapInstance={(map) => {
                desktopMapInstanceRef.current = map;
                mapInstanceRef.current = map;
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
            origin={MAP_ORIGIN}
            isInteractingWithModel={isInteractingWithModel}
            onMapInstance={(map) => {
              mapInstanceRef.current = map;
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
          />
        </div>
      )}
    </main>
  );
}
