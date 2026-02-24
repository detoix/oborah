"use client";

import { useState, useCallback } from "react";
import type { CatalogItem } from "@oborah/catalog";
import maplibregl from "maplibre-gl";
import type { NewPlacedBuilding } from "@/stores/use-planner-store";

export function useMapDrop(
  desktopMapInstanceRef: React.MutableRefObject<maplibregl.Map | null>,
  desktopMapPanelRef: React.MutableRefObject<HTMLDivElement | null>,
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
    [addBuilding, desktopMapInstanceRef, desktopMapPanelRef],
  );

  return {
    isCatalogDragging,
    setIsCatalogDragging,
    handleDragOver,
    handleDrop,
  };
}
