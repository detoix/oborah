"use client";

import { useState, useCallback } from "react";
import type { CatalogItem, CatalogItemId, CatalogItemKind } from "@oborah/catalog";
import maplibregl from "maplibre-gl";

export type SheetSnap = "collapsed" | "half" | "full";
export type MobileMode = "browse" | "edit" | "material";

export type DraftPlacement = {
  id: "draft-placement";
  kind: CatalogItemKind;
  catalogItemId: CatalogItemId;
  position: { lng: number; lat: number };
  rotationY: number;
  sourceItem: CatalogItem;
};

export function usePlannerUI(
  mapInstanceRef: React.MutableRefObject<maplibregl.Map | null>,
  selectBuilding: (id: string | null) => void,
) {
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("collapsed");
  const [browseSnapBeforeEdit, setBrowseSnapBeforeEdit] =
    useState<SheetSnap>("collapsed");
  const [mobileMode, setMobileMode] = useState<MobileMode>("browse");
  const [draftPlacement, setDraftPlacement] = useState<DraftPlacement | null>(
    null,
  );

  const enterEditModeForItem = useCallback(
    (item: CatalogItem) => {
      const center = mapInstanceRef.current?.getCenter();
      if (!center) return;

      setBrowseSnapBeforeEdit(sheetSnap);
      setDraftPlacement({
        id: "draft-placement",
        kind: item.type,
        catalogItemId: item.id,
        sourceItem: item,
        position: { lng: center.lng, lat: center.lat },
        rotationY: 0,
      });
      setMobileMode("edit");
      setSheetSnap("collapsed");
      selectBuilding(null);
    },
    [mapInstanceRef, selectBuilding, sheetSnap],
  );

  const exitDraftMode = useCallback(() => {
    setDraftPlacement(null);
    setMobileMode("browse");
    setSheetSnap(browseSnapBeforeEdit);
  }, [browseSnapBeforeEdit]);

  const updateDraftPosition = useCallback(
    (position: { lng: number; lat: number }) => {
      setDraftPlacement((draft) => (draft ? { ...draft, position } : draft));
    },
    [],
  );

  const updateDraftRotation = useCallback((rotationY: number) => {
    setDraftPlacement((draft) => (draft ? { ...draft, rotationY } : draft));
  }, []);

  const rotateDraft = useCallback(() => {
    setDraftPlacement((draft) =>
      draft
        ? {
            ...draft,
            rotationY: draft.rotationY + Math.PI / 4,
          }
        : draft,
    );
  }, []);

  return {
    sheetSnap,
    setSheetSnap,
    mobileMode,
    setMobileMode,
    draftPlacement,
    setDraftPlacement,
    enterEditModeForItem,
    exitDraftMode,
    updateDraftPosition,
    updateDraftRotation,
    rotateDraft,
  };
}
