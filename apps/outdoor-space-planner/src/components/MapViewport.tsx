"use client";

import Map, { type MapApi, type MapViewState } from "@oborah/map";
import type { GeoCenter, GeoPoint } from "@oborah/geo";
import { DesignLayer, type DesignBuilding } from "@oborah/design";

interface MapViewportProps {
  buildings: DesignBuilding[];
  selectedId: string | null;
  origin: GeoCenter;
  isInteractingWithModel: boolean;
  onMapReady: (api: MapApi) => void;
  onViewChange?: (view: MapViewState) => void;
  onCanvasPointerMissed: () => void;
  onMapClick?: (coords: GeoPoint) => void;
  onMoveBuilding: (id: string, pos: GeoPoint) => void;
  onRotateBuilding: (id: string, rot: number) => void;
  onSelectBuilding: (id: string | null) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  userLocation?: { lng: number; lat: number; accuracy: number } | null;
}

export function MapViewport({
  buildings,
  selectedId,
  origin,
  isInteractingWithModel,
  onMapReady,
  onViewChange,
  onCanvasPointerMissed,
  onMapClick,
  onMoveBuilding,
  onRotateBuilding,
  onSelectBuilding,
  onInteractionStart,
  onInteractionEnd,
  userLocation,
}: MapViewportProps) {
  return (
    <Map
      interactive={!isInteractingWithModel}
      onMapReady={onMapReady}
      onViewChange={onViewChange}
      onCanvasPointerMissed={onCanvasPointerMissed}
      onMapClick={onMapClick}
      userLocation={userLocation}
      geocoder={{
        provider: "photon",
        position: "top-left",
        placeholder: "Search with Photon",
        language: "en",
        limit: 8,
      }}
    >
      <DesignLayer
        buildings={buildings}
        selectedId={selectedId}
        origin={origin}
        onMoveBuilding={onMoveBuilding}
        onRotateBuilding={onRotateBuilding}
        onSelectBuilding={onSelectBuilding}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
      />
    </Map>
  );
}
