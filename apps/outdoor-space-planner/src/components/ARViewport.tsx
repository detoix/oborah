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
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import type { GeoPoint } from "@oborah/geo";
import { ARLayer, type ARBuilding } from "./ARLayer";
import type { StabilizedLocation } from "@/hooks/use-stabilized-location";
import type { CompassResult } from "@/hooks/use-sensor-fusion";
import { useARSessionStore } from "@/stores/use-ar-session-store";

interface ARViewportProps {
  buildings: ARBuilding[];
  location: StabilizedLocation;
  compass: CompassResult;
  selectedId: string | null;
  onHeadingChange?: (heading: number | null) => void;
  onNavigateByMeters?: (eastMeters: number, northMeters: number) => void;
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

const AR_NUDGE_STEP_METERS = 0.35;

export function ARViewport({
  buildings,
  location,
  compass,
  selectedId,
  onHeadingChange,
  onNavigateByMeters,
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

  const { phase, calibrationOffset, setPhase } = useARSessionStore();

  // One-time compass alignment for DeviceOrientationControls
  const headingAligned = useRef(false);

  // Reset heading alignment when phase changes
  useEffect(() => {
    if (phase === "tracking") {
      headingAligned.current = false;
    }
  }, [phase]);

  useEffect(() => {
    if (!onHeadingChange) return;

    if (compass.hasInitialized.current) {
      onHeadingChange(compass.heading);
    } else {
      onHeadingChange(null);
    }
  }, [onHeadingChange, compass.heading, compass.hasInitialized]);

  useEffect(() => {
    if (
      phase === "tracking" &&
      !headingAligned.current &&
      compass.hasInitialized.current
    ) {
      const controls = orientationControlsRef.current;
      const rawAlphaDeg = controls?.deviceOrientation?.alpha;
      if (!controls || typeof rawAlphaDeg !== "number") return;

      const liveHeading = compass.headingRef.current;
      const targetAlphaDeg = normalizeZeroTo360(360 - liveHeading);
      const rawAlphaNormalized = normalizeZeroTo360(rawAlphaDeg);
      const offsetDeg = normalizeSignedDegrees(
        targetAlphaDeg - rawAlphaNormalized,
      );

      controls.alphaOffset = (offsetDeg * Math.PI) / 180;
      controls.update();
      headingAligned.current = true;
    }
  }, [phase, compass, onHeadingChange]);

  // Phase transitions — go to tracking as soon as we have a GPS fix
  useEffect(() => {
    if (location.position && phase === "gps_acquiring") {
      Promise.resolve().then(() => setPhase("tracking"));
    }
  }, [location.position, phase, setPhase]);

  // Derived error
  const combinedError = error || location.error;

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
  const statusText = phase === "gps_acquiring" ? "Finding GPS signal..." : null;

  // The origin to use for ARLayer
  const activeOrigin = location.position;

  const debugBuildings = useMemo(() => {
    return buildings;
  }, [buildings]);

  const isDraggingBuildingRef = useRef(false);

  const handleInteractionStartWrapper = useCallback(() => {
    isDraggingBuildingRef.current = true;
    onInteractionStart();
  }, [onInteractionStart]);

  const handleInteractionEndWrapper = useCallback(() => {
    isDraggingBuildingRef.current = false;
    onInteractionEnd();
  }, [onInteractionEnd]);

  function navigateUser(direction: "up" | "down" | "left" | "right") {
    let dx = 0;
    let dy = 0;

    if (direction === "up") dy = -AR_NUDGE_STEP_METERS;
    if (direction === "down") dy = AR_NUDGE_STEP_METERS;
    if (direction === "left") dx = -AR_NUDGE_STEP_METERS;
    if (direction === "right") dx = AR_NUDGE_STEP_METERS;

    const headingDeg = compass.hasInitialized.current ? compass.heading : 0;
    const headingRad = ((headingDeg % 360) * Math.PI) / 180;

    const worldDx = dx * Math.cos(headingRad) - dy * Math.sin(headingRad);
    const worldDz = dx * Math.sin(headingRad) + dy * Math.cos(headingRad);

    onNavigateByMeters?.(worldDx, -worldDz);
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
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
              livePosition={activeOrigin}
              selectedId={selectedId}
              interactive={false}
              calibrationOffset={calibrationOffset}
              onSelectBuilding={onSelectBuilding}
              onMoveBuilding={onMoveBuilding}
              onRotateBuilding={onRotateBuilding}
              onInteractionStart={handleInteractionStartWrapper}
              onInteractionEnd={handleInteractionEndWrapper}
            />
          </Canvas>
        </div>
      )}

      {/* Street View-style directional pad */}
      {activeOrigin &&
        phase !== "gps_acquiring" &&
        !combinedError &&
        !needsPermission && (
          <div className="pointer-events-none absolute inset-0 z-30">
            <button
              type="button"
              onClick={() => navigateUser("up")}
              className="pointer-events-auto absolute left-1/2 top-2 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full bg-white/90 shadow-sm active:scale-95 transition-transform"
              aria-label="Move up"
            >
              <ChevronUp className="h-5 w-5 text-slate-700" />
            </button>
            <button
              type="button"
              onClick={() => navigateUser("left")}
              className="pointer-events-auto absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-sm active:scale-95 transition-transform"
              aria-label="Move left"
            >
              <ChevronLeft className="h-5 w-5 text-slate-700" />
            </button>
            <button
              type="button"
              onClick={() => navigateUser("right")}
              className="pointer-events-auto absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-sm active:scale-95 transition-transform"
              aria-label="Move right"
            >
              <ChevronRight className="h-5 w-5 text-slate-700" />
            </button>
            <button
              type="button"
              onClick={() => navigateUser("down")}
              className="pointer-events-auto absolute bottom-2 left-1/2 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full bg-white/90 shadow-sm active:scale-95 transition-transform"
              aria-label="Move down"
            >
              <ChevronDown className="h-5 w-5 text-slate-700" />
            </button>
          </div>
        )}
    </div>
  );
}
