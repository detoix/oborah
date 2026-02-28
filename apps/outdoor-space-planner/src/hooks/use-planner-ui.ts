"use client";

import { useState, useCallback } from "react";
import type {
  CatalogItem,
  CatalogItemId,
  CatalogItemKind,
} from "@oborah/catalog";
import type { GeoPoint } from "@oborah/geo";
import type { MapApi } from "@oborah/map";

export type SheetSnap = "collapsed" | "full";
export type MobileMode = "browse" | "edit" | "material";

export type DraftPlacement = {
  id: "draft-placement";
  kind: CatalogItemKind;
  catalogItemId: CatalogItemId;
  position: GeoPoint;
  rotationY: number;
  sourceItem: CatalogItem;
};

export function usePlannerUI(
  mapApiRef: React.MutableRefObject<MapApi | null>,
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
      const center = mapApiRef.current?.getCenter();
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
      // Keep placement controls contained in the collapsed view
      setSheetSnap("collapsed");
      selectBuilding(null);
    },
    [mapApiRef, selectBuilding, sheetSnap],
  );

  const exitDraftMode = useCallback(() => {
    setDraftPlacement(null);
    setMobileMode("browse");
    setSheetSnap(browseSnapBeforeEdit);
  }, [browseSnapBeforeEdit]);

  const updateDraftPosition = useCallback((position: GeoPoint) => {
    setDraftPlacement((draft) => (draft ? { ...draft, position } : draft));
  }, []);

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
