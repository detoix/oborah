import { create } from "zustand";
import type { GeoPoint } from "@oborah/geo";

export type ARPhase =
  | "gps_acquiring"
  | "gps_stabilized"
  | "calibrating"
  | "tracking"
  | "recalibrating";

export interface CalibrationOffset {
  x: number;
  z: number;
  rotationY: number;
}

interface ARSessionState {
  phase: ARPhase;
  stabilizedOrigin: GeoPoint | null;
  calibrationOffset: CalibrationOffset;
  driftConfidence: number;
}

interface ARSessionActions {
  setPhase: (phase: ARPhase) => void;
  setStabilizedOrigin: (origin: GeoPoint) => void;
  setCalibrationOffset: (offset: CalibrationOffset) => void;
  setDriftConfidence: (confidence: number) => void;
  confirmCalibration: () => void;
  requestRecalibration: () => void;
  resetSession: () => void;
}

const initialState: ARSessionState = {
  phase: "gps_acquiring",
  stabilizedOrigin: null,
  calibrationOffset: { x: 0, z: 0, rotationY: 0 },
  driftConfidence: 1,
};

export const useARSessionStore = create<ARSessionState & ARSessionActions>(
  (set) => ({
    ...initialState,

    setPhase: (phase) => set({ phase }),

    setStabilizedOrigin: (origin) =>
      set({ stabilizedOrigin: origin, phase: "gps_stabilized" }),

    setCalibrationOffset: (offset) => set({ calibrationOffset: offset }),

    setDriftConfidence: (confidence) => {
      set({ driftConfidence: Math.max(0, Math.min(1, confidence)) });
    },

    confirmCalibration: () => set({ phase: "tracking", driftConfidence: 1 }),

    requestRecalibration: () => set({ phase: "recalibrating" }),

    resetSession: () => set(initialState),
  }),
);
