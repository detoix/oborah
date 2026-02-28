import { create } from "zustand";

export type ARPhase = "gps_acquiring" | "tracking";

export interface CalibrationOffset {
  x: number;
  z: number;
  rotationY: number;
}

interface ARSessionState {
  phase: ARPhase;
  calibrationOffset: CalibrationOffset;
}

interface ARSessionActions {
  setPhase: (phase: ARPhase) => void;
  setCalibrationOffset: (offset: CalibrationOffset) => void;
  resetSession: () => void;
}

const initialState: ARSessionState = {
  phase: "gps_acquiring",
  calibrationOffset: { x: 0, z: 0, rotationY: 0 },
};

export const useARSessionStore = create<ARSessionState & ARSessionActions>(
  (set) => ({
    ...initialState,

    setPhase: (phase) => set({ phase }),

    setCalibrationOffset: (offset) => set({ calibrationOffset: offset }),

    resetSession: () => set(initialState),
  }),
);
