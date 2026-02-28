"use client";

import { useState, useCallback } from "react";
import type { CatalogItem } from "@oborah/catalog";
import type { MapApi } from "@oborah/map";
import type { NewPlacedBuilding } from "@/stores/use-planner-store";

export function useMapDrop(
  desktopMapApiRef: React.MutableRefObject<MapApi | null>,
  addBuilding: (building: NewPlacedBuilding) => void,
) {
  const [isCatalogDragging, setIsCatalogDragging] = useState(false);

  const hasCatalogPayload = useCallback((dataTransfer: DataTransfer) => {
    const types = Array.from(dataTransfer.types ?? []);
    return (
      types.includes("application/oborah-item") ||
      types.includes("text/plain") ||
      (
        dataTransfer.types as unknown as { contains?: (t: string) => boolean }
      )?.contains?.("application/oborah-item") === true
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
      setIsCatalogDragging(false);
      const data =
        e.dataTransfer.getData("application/oborah-item") ||
        e.dataTransfer.getData("text/plain");
      const mapApi = desktopMapApiRef.current;
      if (!data || !mapApi) return;

      try {
        const item: CatalogItem = JSON.parse(data);
        const lngLat = mapApi.screenToLngLat({
          clientX: e.clientX,
          clientY: e.clientY,
        });
        if (!lngLat) return;
        addBuilding({
          kind: item.type,
          catalogItemId: item.id,
          position: { lng: lngLat.lng, lat: lngLat.lat },
          rotationY: 0,
        });
      } catch (err) {
        console.error("Failed to drop item", err);
      }
    },
    [addBuilding, desktopMapApiRef],
  );

  return {
    isCatalogDragging,
    setIsCatalogDragging,
    handleDragOver,
    handleDrop,
  };
}
