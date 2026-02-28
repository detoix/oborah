"use client";

import { useEffect, useRef, useState } from "react";
import {
  usePlannerStore,
  type PlacedBuildingOnMap,
} from "@/stores/use-planner-store";
import { CATALOG_ITEMS } from "@oborah/catalog";

// We generate random IDs on parse since we drop them from the URL
function generateLocalId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `map-building-${crypto.randomUUID()}`;
  }
  return `map-building-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useUrlState() {
  const { placedBuildings, setPlacedBuildings } = usePlannerStore();
  const hasHydrated = useRef(false);
  const isHydrating = useRef(true);

  // 1. Hydrate from URL on initial load
  useEffect(() => {
    if (typeof window === "undefined" || hasHydrated.current) return;

    const params = new URLSearchParams(window.location.search);
    const payload = params.get("p");

    if (payload) {
      try {
        const parsedBuildings: PlacedBuildingOnMap[] = [];
        const blocks = payload.split("_");

        for (const block of blocks) {
          if (!block) continue;

          const parts = block.split(",");
          if (parts.length >= 4) {
            const indexStr = parts[0];
            const lngStr = parts[1];
            const latStr = parts[2];
            const rotStr = parts[3];

            const catIndex = parseInt(indexStr, 10);
            const lng = parseFloat(lngStr);
            const lat = parseFloat(latStr);
            const rot = parseFloat(rotStr);

            // Only accept if math works and index is within bounds
            if (!isNaN(catIndex) && !isNaN(lng) && !isNaN(lat) && !isNaN(rot)) {
              const catalogItem = CATALOG_ITEMS[catIndex];
              if (catalogItem) {
                parsedBuildings.push({
                  id: generateLocalId(),
                  kind: catalogItem.type,
                  catalogItemId: catalogItem.id,
                  position: { lng, lat },
                  rotationY: rot,
                });
              }
            }
          }
        }

        if (parsedBuildings.length > 0) {
          setPlacedBuildings(parsedBuildings);
        }
      } catch (e) {
        console.error("Failed to parse URL state", e);
      }
    }

    hasHydrated.current = true;
    isHydrating.current = false;
  }, [setPlacedBuildings]);

  // 2. Serialize to URL whenever placedBuildings changes
  useEffect(() => {
    if (
      !hasHydrated.current ||
      isHydrating.current ||
      typeof window === "undefined"
    )
      return;

    if (placedBuildings.length === 0) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("p")) {
        url.searchParams.delete("p");
        window.history.replaceState(null, "", url.toString());
      }
      return;
    }

    // Build optimized string array
    const parts = placedBuildings.map((b) => {
      // Find dictionary index
      let catIndex = CATALOG_ITEMS.findIndex(
        (item) => item.id === b.catalogItemId,
      );
      if (catIndex === -1) catIndex = 0; // Fallback

      // tuple: index,lng,lat,rot
      // Round coordinates to 6 decimals (~11cm) to save URL space
      // Round rotation to 2 decimals
      return `${catIndex},${b.position.lng.toFixed(6)},${b.position.lat.toFixed(6)},${b.rotationY.toFixed(2)}`;
    });

    const payload = parts.join("_");

    const url = new URL(window.location.href);
    // Only replace state if it actually changed to prevent browser thrashing
    if (url.searchParams.get("p") !== payload) {
      url.searchParams.set("p", payload);
      window.history.replaceState(null, "", url.toString());
    }
  }, [placedBuildings]);
}
