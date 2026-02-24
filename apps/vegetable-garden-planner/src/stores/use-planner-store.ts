import { create } from "zustand";
import type { CatalogItemId, CatalogItemKind } from "@oborah/catalog";

export interface PlacedBuildingOnMap {
  id: string;
  kind: CatalogItemKind;
  catalogItemId: CatalogItemId;
  position: { lng: number; lat: number };
  rotationY: number;
}

export interface NewPlacedBuilding {
  catalogItemId: CatalogItemId;
  kind: CatalogItemKind;
  position: { lng: number; lat: number };
  rotationY?: number;
}

interface PlannerStore {
  placedBuildings: PlacedBuildingOnMap[];
  selectedBuildingId: string | null;
  isDraggingFromLibrary: boolean;
  isInteractingWithModel: boolean;

  setDraggingFromLibrary: (v: boolean) => void;
  setInteractingWithModel: (v: boolean) => void;
  addBuilding: (building: NewPlacedBuilding) => void;
  moveBuilding: (id: string, position: { lng: number; lat: number }) => void;
  rotateBuilding: (id: string, rotationY: number) => void;
  removeBuilding: (id: string) => void;
  selectBuilding: (id: string | null) => void;
}

function createBuildingId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `map-building-${crypto.randomUUID()}`;
  }

  return `map-building-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export const usePlannerStore = create<PlannerStore>((set) => ({
  placedBuildings: [],
  selectedBuildingId: null,
  isDraggingFromLibrary: false,
  isInteractingWithModel: false,

  setDraggingFromLibrary: (v) => set({ isDraggingFromLibrary: v }),
  setInteractingWithModel: (v) => set({ isInteractingWithModel: v }),

  addBuilding: ({ kind, catalogItemId, position, rotationY = 0 }) => {
    set((state) => ({
      placedBuildings: [
        ...state.placedBuildings,
        {
          id: createBuildingId(),
          kind,
          catalogItemId,
          position,
          rotationY,
        },
      ],
    }));
  },

  moveBuilding: (id, position) =>
    set((state) => ({
      placedBuildings: state.placedBuildings.map((b) =>
        b.id === id ? { ...b, position } : b,
      ),
    })),

  rotateBuilding: (id, rotationY) =>
    set((state) => ({
      placedBuildings: state.placedBuildings.map((b) =>
        b.id === id ? { ...b, rotationY } : b,
      ),
    })),

  removeBuilding: (id) =>
    set((state) => ({
      placedBuildings: state.placedBuildings.filter((b) => b.id !== id),
      selectedBuildingId:
        state.selectedBuildingId === id ? null : state.selectedBuildingId,
    })),

  selectBuilding: (id) => set({ selectedBuildingId: id }),
}));
