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
import { useARSessionStore } from "@/stores/use-ar-session-store";
import { usePlannerUI } from "@/hooks/use-planner-ui";
import { useMapDrop } from "@/hooks/use-map-drop";
import {
  useStabilizedLocation,
  type StabilizedLocation,
} from "@/hooks/use-stabilized-location";
import { useCompass } from "@/hooks/use-sensor-fusion";
import { useUrlState } from "@/hooks/use-url-state";

const MAP_ORIGIN: GeoCenter = {
  lng: 19.945,
  lat: 50.0647,
};
const AR_SPLIT_MIN_RATIO = 0.25;
const AR_SPLIT_MAX_RATIO = 0.75;

export default function Home() {
  const mapApiRef = useRef<MapApi | null>(null);
  const desktopMapApiRef = useRef<MapApi | null>(null);
  const suppressMapPlacementUntilRef = useRef(0);
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(
    null,
  );
  const [isArMode, setIsArMode] = useState<boolean>(false);
  const [arSplitRatio, setArSplitRatio] = useState<number>(0.5);
  const [isArSplitDragging, setIsArSplitDragging] = useState<boolean>(false);
  const arSplitDragRef = useRef<{ pointerId: number; active: boolean }>({
    pointerId: -1,
    active: false,
  });
  const [mapOrigin, setMapOrigin] = useState<GeoCenter>(MAP_ORIGIN);
  const [arCompassHeading, setArCompassHeading] = useState<number | null>(null);
  const [arAnchorLocation, setArAnchorLocation] = useState<GeoPoint | null>(
    null,
  );
  const [hasArEverBeenEnabled, setHasArEverBeenEnabled] =
    useState<boolean>(false);
  const stabilized = useStabilizedLocation();
  const { phase, setPhase } = useARSessionStore();

  // Pure compass — no GPS, no Kalman filter
  const compass = useCompass(true);

  // Transition to tracking as soon as we have a GPS fix
  useEffect(() => {
    if (stabilized.position && phase === "gps_acquiring") {
      setPhase("tracking");
    }
  }, [stabilized.position, phase, setPhase]);

  // The blue dot on the map = single GPS source of truth
  const stabilizedUserLocation = useMemo(
    () =>
      stabilized.position
        ? {
            lng: stabilized.position.lng,
            lat: stabilized.position.lat,
            accuracy: stabilized.accuracy ?? 0,
          }
        : null,
    [stabilized.position, stabilized.accuracy],
  );

  const arEffectiveLocation = useMemo<StabilizedLocation>(
    () =>
      isArMode && arAnchorLocation
        ? {
            ...stabilized,
            position: arAnchorLocation,
          }
        : stabilized,
    [isArMode, arAnchorLocation, stabilized],
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

  useUrlState();

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

  const clampArSplitRatio = useCallback((ratio: number) => {
    return Math.min(
      AR_SPLIT_MAX_RATIO,
      Math.max(AR_SPLIT_MIN_RATIO, ratio),
    );
  }, []);

  const updateArSplitFromClientY = useCallback(
    (clientY: number) => {
      if (typeof window === "undefined") return;
      const viewportHeight = Math.max(window.innerHeight, 1);
      setArSplitRatio(clampArSplitRatio(clientY / viewportHeight));
    },
    [clampArSplitRatio],
  );

  const handleArSplitDragStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      arSplitDragRef.current = {
        pointerId: event.pointerId,
        active: true,
      };
      setIsArSplitDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      updateArSplitFromClientY(event.clientY);
    },
    [updateArSplitFromClientY],
  );

  const handleArSplitDragMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (
        !arSplitDragRef.current.active ||
        arSplitDragRef.current.pointerId !== event.pointerId
      ) {
        return;
      }
      updateArSplitFromClientY(event.clientY);
    },
    [updateArSplitFromClientY],
  );

  const handleArSplitDragEnd = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (arSplitDragRef.current.pointerId !== event.pointerId) return;
      arSplitDragRef.current.active = false;
      setIsArSplitDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      window.requestAnimationFrame(() => {
        mapApiRef.current?.resize?.();
      });
    },
    [],
  );

  useEffect(() => {
    if (isDesktopViewport || !mapApiRef.current?.resize) return;
    const raf = window.requestAnimationFrame(() => {
      mapApiRef.current?.resize();
    });
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [isDesktopViewport, isArMode]);

  const arSplitPercent = `${(arSplitRatio * 100).toFixed(2)}%`;
  const mobileMapTop = isArMode ? arSplitPercent : "0%";

  const mobileMapViewport = (
    <MapViewport
      buildings={allVisibleBuildings}
      selectedId={activeSelectedId}
      origin={mapOrigin}
      showGeocoder={!isArMode}
      enableUserLocationAnchor={isArMode}
      userLocationAnchor={isArMode ? arAnchorLocation : null}
      onUserLocationAnchorCreate={setArAnchorLocation}
      onUserLocationAnchorChange={setArAnchorLocation}
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
      userLocation={stabilizedUserLocation}
    />
  );

  if (isDesktopViewport === null) {
    return (
      <main className="w-screen h-[100svh] overflow-hidden bg-white md:h-screen" />
    );
  }

  return (
    <main className="w-screen h-[100svh] overflow-hidden md:h-screen">
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
              userLocation={stabilizedUserLocation}
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
          <div
            className={`absolute inset-x-0 bottom-0 min-h-0 ${
              isArSplitDragging ? "" : "transition-[top] duration-300 ease-out"
            }`}
            style={{ top: mobileMapTop }}
          >
            {mobileMapViewport}
          </div>

          {(isArMode || hasArEverBeenEnabled) && (
            <div
              className={`absolute inset-x-0 top-0 z-10 min-h-0 overflow-hidden bg-black ${
                isArSplitDragging
                  ? ""
                  : "transition-[height,opacity] duration-300 ease-out"
              }`}
              style={{
                height: isArMode ? arSplitPercent : "0%",
                opacity: isArMode ? 1 : 0,
                pointerEvents: isArMode ? "auto" : "none",
              }}
            >
              <ARViewport
                buildings={allVisibleBuildings}
                selectedId={activeSelectedId}
                location={arEffectiveLocation}
                compass={compass}
                onHeadingChange={setArCompassHeading}
                onSelectBuilding={handleSelectBuilding}
                onMoveBuilding={handleMoveBuilding}
                onRotateBuilding={handleRotateBuilding}
                onInteractionStart={() => setInteractingWithModel(true)}
                onInteractionEnd={() => setInteractingWithModel(false)}
              />
            </div>
          )}

          {isArMode && (
            <button
              type="button"
              className="absolute inset-x-0 z-[15] flex h-7 touch-none cursor-row-resize items-center justify-center"
              style={{
                top: arSplitPercent,
                transform: "translateY(-50%)",
              }}
              onPointerDown={handleArSplitDragStart}
              onPointerMove={handleArSplitDragMove}
              onPointerUp={handleArSplitDragEnd}
              onPointerCancel={handleArSplitDragEnd}
              aria-label="Resize AR split view"
            >
              <span
                className={`h-1.5 w-12 rounded-full shadow ${
                  isArSplitDragging ? "bg-emerald-600" : "bg-white/95"
                }`}
              />
            </button>
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
            isArMode={isArMode}
            compassHeading={arCompassHeading}
            onLocateMe={() => {
              navigator.geolocation.getCurrentPosition((pos) => {
                mapApiRef.current?.flyTo({
                  center: [pos.coords.longitude, pos.coords.latitude],
                  zoom: 17,
                });
              });
            }}
            onToggleArMode={() => {
              const next = !isArMode;
              if (!next) {
                arSplitDragRef.current.active = false;
                setIsArSplitDragging(false);
              }
              setIsArMode(next);
              if (next) {
                setHasArEverBeenEnabled(true);
              }
              window.requestAnimationFrame(() => {
                mapApiRef.current?.resize?.();
              });
              window.setTimeout(() => {
                mapApiRef.current?.resize?.();
              }, 320);
              if (!next) {
                setArCompassHeading(null);
              } else {
                setSheetSnap("collapsed");
              }
            }}
          />
        </div>
      )}
    </main>
  );
}
