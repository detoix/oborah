import { create } from "zustand";

export interface PlacedBuildingOnMap {
  id: string;
  type: string;
  position: { lng: number; lat: number };
  rotationY: number;
}

interface PlannerStore {
  placedBuildings: PlacedBuildingOnMap[];
  selectedBuildingId: string | null;
  isDraggingFromLibrary: boolean;
  isInteractingWithModel: boolean;

  setDraggingFromLibrary: (v: boolean) => void;
  setInteractingWithModel: (v: boolean) => void;
  addBuilding: (
    type: string,
    position: { lng: number; lat: number },
    rotationY?: number,
  ) => void;
  moveBuilding: (id: string, position: { lng: number; lat: number }) => void;
  rotateBuilding: (id: string, rotationY: number) => void;
  removeBuilding: (id: string) => void;
  selectBuilding: (id: string | null) => void;
}

let nextId = 1;

export const usePlannerStore = create<PlannerStore>((set) => ({
  placedBuildings: [],
  selectedBuildingId: null,
  isDraggingFromLibrary: false,
  isInteractingWithModel: false,

  setDraggingFromLibrary: (v) => set({ isDraggingFromLibrary: v }),
  setInteractingWithModel: (v) => set({ isInteractingWithModel: v }),

  addBuilding: (type, position, rotationY = 0) => {
    set((state) => ({
      placedBuildings: [
        ...state.placedBuildings,
        {
          id: `map-building-${nextId++}`,
          type,
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
