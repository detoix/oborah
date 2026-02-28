"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Canvas } from "@react-three/fiber";
import { DeviceOrientationControls } from "@react-three/drei";
import type { DeviceOrientationControls as DeviceOrientationControlsImpl } from "three-stdlib";
import type { GeoPoint } from "@oborah/geo";
import { ARLayer, type ARBuilding } from "./ARLayer";
import { CalibrationOverlay } from "./CalibrationOverlay";
import { DriftConfidenceBar } from "./DriftConfidenceBar";
import type { StabilizedLocation } from "@/hooks/use-stabilized-location";
import { useSensorFusion } from "@/hooks/use-sensor-fusion";
import { useARSessionStore } from "@/stores/use-ar-session-store";

interface ARViewportProps {
  buildings: ARBuilding[];
  location: StabilizedLocation;
  selectedId: string | null;
  onSelectBuilding: (id: string | null) => void;
  onMoveBuilding: (id: string, position: GeoPoint) => void;
  onRotateBuilding: (id: string, rot: number) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

function normalizeZeroTo360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function normalizeSignedDegrees(deg: number): number {
  return ((deg + 540) % 360) - 180;
}

export function ARViewport({
  buildings,
  location,
  selectedId,
  onSelectBuilding,
  onMoveBuilding,
  onRotateBuilding,
  onInteractionStart,
  onInteractionEnd,
}: ARViewportProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const orientationControlsRef = useRef<DeviceOrientationControlsImpl | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);

  // AR session state machine
  const {
    phase,
    stabilizedOrigin,
    calibrationOffset,
    driftConfidence,
    setStabilizedOrigin,
    setCalibrationOffset,
    setDriftConfidence,
    confirmCalibration,
    requestRecalibration,
    setPhase,
  } = useARSessionStore();

  // Sensor fusion (active during calibrating/tracking/recalibrating)
  const sensorFusion = useSensorFusion({
    enabled:
      phase === "calibrating" ||
      phase === "tracking" ||
      phase === "recalibrating",
    stabilizedOrigin,
    calibrationOffset,
    onDriftExceeded: requestRecalibration,
  });

  // One-time compass alignment for DeviceOrientationControls
  const headingAligned = useRef(false);

  useEffect(() => {
    if (phase === "calibrating") {
      headingAligned.current = false;
    }
  }, [phase]);

  useEffect(() => {
    if (
      phase === "calibrating" &&
      !headingAligned.current &&
      sensorFusion.hasInitialized.current
    ) {
      const controls = orientationControlsRef.current;
      const rawAlphaDeg = controls?.deviceOrientation?.alpha;
      if (!controls || typeof rawAlphaDeg !== "number") return;

      // Sensor fusion heading is clockwise from North.
      // DeviceOrientationControls expects alpha where heading = (360 - alpha).
      const liveHeading = sensorFusion.headingRef.current;
      const targetAlphaDeg = normalizeZeroTo360(360 - liveHeading);
      const rawAlphaNormalized = normalizeZeroTo360(rawAlphaDeg);
      const offsetDeg = normalizeSignedDegrees(
        targetAlphaDeg - rawAlphaNormalized,
      );

      controls.alphaOffset = (offsetDeg * Math.PI) / 180;
      controls.update();
      headingAligned.current = true;
    }
  }, [phase, sensorFusion]);

  // Phase transitions based on GPS stabilization status
  useEffect(() => {
    if (
      location.isStationary &&
      location.position &&
      phase === "gps_acquiring"
    ) {
      setStabilizedOrigin(location.position);
      // Auto-transition to calibrating after a brief stabilized state
      Promise.resolve().then(() => setPhase("calibrating"));
    }
  }, [
    location.isStationary,
    location.position,
    phase,
    setStabilizedOrigin,
    setPhase,
  ]);

  // Derived error
  const combinedError = error || location.error;

  // Sync drift confidence from sensor fusion
  useEffect(() => {
    if (phase === "tracking" || phase === "recalibrating") {
      setDriftConfidence(sensorFusion.confidence);
    }
  }, [sensorFusion.confidence, phase, setDriftConfidence]);

  // Recalibration: when stationary again after drift exceeded, re-lock
  useEffect(() => {
    if (
      phase === "recalibrating" &&
      location.isStationary &&
      location.position
    ) {
      setStabilizedOrigin(location.position);
      confirmCalibration();
    }
  }, [
    phase,
    location.isStationary,
    location.position,
    setStabilizedOrigin,
    confirmCalibration,
  ]);

  // Check if we need orientation/motion permissions (iOS 13+)
  useEffect(() => {
    const OrientationEvent = (
      window as unknown as {
        DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
      }
    ).DeviceOrientationEvent;
    if (typeof OrientationEvent?.requestPermission === "function") {
      Promise.resolve().then(() => setNeedsPermission(true));
    }
  }, []);

  // Initialize Camera Stream
  useEffect(() => {
    let stream: MediaStream;
    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: unknown) {
        console.error("Camera access denied or unavailable", err);
        setError("Camera not available. Please allow camera permissions.");
      }
    }
    setupCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const requestPermissions = useCallback(async () => {
    const win = window as unknown as {
      DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
      DeviceMotionEvent?: { requestPermission?: () => Promise<string> };
    };
    const OrientationEvent = win.DeviceOrientationEvent;
    const MotionEvent = win.DeviceMotionEvent;

    try {
      // Request orientation permission
      if (typeof OrientationEvent?.requestPermission === "function") {
        const response = await OrientationEvent.requestPermission();
        if (response !== "granted") {
          setError("Permission to access orientation was denied.");
          return;
        }
      }

      // Request motion permission (iOS)
      if (typeof MotionEvent?.requestPermission === "function") {
        const response = await MotionEvent.requestPermission();
        if (response !== "granted") {
          console.warn("DeviceMotion permission denied — GPS-only mode");
        }
      }

      setNeedsPermission(false);
    } catch (err) {
      console.error("Permission request failed", err);
      setError("Failed to request sensor permissions.");
    }
  }, []);

  // Status text for acquiring phase
  const statusText =
    phase === "gps_acquiring"
      ? location.status === "acquiring"
        ? "Acquiring GPS Signal..."
        : location.status === "stabilizing"
          ? `Stabilizing... Stand still (${location.isStationary ? "stationary" : "moving"})`
          : "Acquiring GPS Signal..."
      : null;

  // The origin to use for ARLayer
  const activeOrigin = stabilizedOrigin ?? location.position;

  const debugBuildings = useMemo(() => {
    return buildings;
  }, [buildings]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Background Camera Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Error Overlay */}
      {combinedError && (
        <div className="absolute top-4 left-4 right-4 z-50 p-4 bg-red-500/80 text-white rounded-lg backdrop-blur-sm">
          {combinedError}
        </div>
      )}

      {/* GPS Acquiring Overlay */}
      {phase === "gps_acquiring" && !combinedError && (
        <div className="absolute inset-0 z-40 bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <div className="text-white text-lg font-medium animate-pulse">
              {statusText}
            </div>
            {location.accuracy !== null && (
              <div className="text-gray-400 text-sm mt-2">
                Accuracy: {location.accuracy.toFixed(0)}m
              </div>
            )}
          </div>
        </div>
      )}

      {/* iOS Permission Overlay */}
      {needsPermission && (
        <div className="absolute inset-0 z-50 bg-black/70 flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-white text-xl font-bold mb-4">
            Sensor Access Required
          </h2>
          <p className="text-gray-300 mb-6">
            To align AR objects with reality, we need access to your
            device&apos;s compass and motion sensors.
          </p>
          <button
            onClick={requestPermissions}
            className="px-6 py-3 bg-blue-600 text-white rounded-full font-bold shadow-lg active:scale-95 transition-transform"
          >
            Allow Sensor Access
          </button>
        </div>
      )}

      {/* Calibration Overlay (Phase 2) */}
      {phase === "calibrating" && (
        <CalibrationOverlay
          offset={calibrationOffset}
          onChange={setCalibrationOffset}
          onConfirm={confirmCalibration}
          onCancel={() => setPhase("gps_acquiring")}
        />
      )}

      {/* Drift Confidence Bar (Phase 3: tracking) */}
      {(phase === "tracking" || phase === "recalibrating") && (
        <DriftConfidenceBar
          confidence={driftConfidence}
          onRecalibrate={requestRecalibration}
        />
      )}

      {/* Recalibrating banner */}
      {phase === "recalibrating" && (
        <div className="absolute top-16 left-4 right-4 z-30 flex justify-center">
          <div className="bg-yellow-600/80 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm animate-pulse">
            Stand still to recalibrate...
          </div>
        </div>
      )}

      {/* 3D Canvas — visible once we have an origin (stabilized or calibrating+) */}
      {activeOrigin && phase !== "gps_acquiring" && (
        <div className="absolute inset-0 z-10">
          <Canvas
            onPointerMissed={() => onSelectBuilding(null)}
            camera={{ position: [0, 0, 0], fov: 75 }}
          >
            {/* Gyroscope camera controls — heading managed by sensor fusion, no wrapper group needed */}
            <DeviceOrientationControls ref={orientationControlsRef} />

            <ARLayer
              buildings={debugBuildings}
              origin={activeOrigin}
              selectedId={selectedId}
              calibrationOffset={calibrationOffset}
              sensorFusionOffset={
                phase === "tracking" || phase === "recalibrating"
                  ? { x: 0, z: 0 } // Disabled as per user request (originally sensorFusion.estimatedOffset)
                  : undefined
              }
              onSelectBuilding={onSelectBuilding}
              onMoveBuilding={onMoveBuilding}
              onRotateBuilding={onRotateBuilding}
              onInteractionStart={onInteractionStart}
              onInteractionEnd={onInteractionEnd}
            />
          </Canvas>
        </div>
      )}
    </div>
  );
}
