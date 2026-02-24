"use client";

import Map from "@engine/map";
import { DesignLayer, type DesignBuilding } from "@oborah/design";
import maplibregl from "maplibre-gl";

interface MapViewportProps {
  buildings: DesignBuilding[];
  selectedId: string | null;
  origin: { longitude: number; latitude: number };
  isInteractingWithModel: boolean;
  onMapInstance: (map: maplibregl.Map) => void;
  onCanvasPointerMissed: () => void;
  onMapClick?: (coords: { lng: number; lat: number }) => void;
  onMoveBuilding: (id: string, pos: { lng: number; lat: number }) => void;
  onRotateBuilding: (id: string, rot: number) => void;
  onSelectBuilding: (id: string | null) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

export function MapViewport({
  buildings,
  selectedId,
  origin,
  isInteractingWithModel,
  onMapInstance,
  onCanvasPointerMissed,
  onMapClick,
  onMoveBuilding,
  onRotateBuilding,
  onSelectBuilding,
  onInteractionStart,
  onInteractionEnd,
}: MapViewportProps) {
  return (
    <Map
      interactive={!isInteractingWithModel}
      onMapInstance={onMapInstance}
      onCanvasPointerMissed={onCanvasPointerMissed}
      onMapClick={onMapClick}
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
