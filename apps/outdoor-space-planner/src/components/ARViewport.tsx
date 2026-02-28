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
import type { StabilizedLocation } from "@/hooks/use-stabilized-location";
import type { CompassResult } from "@/hooks/use-sensor-fusion";
import { useARSessionStore } from "@/stores/use-ar-session-store";

interface ARViewportProps {
  buildings: ARBuilding[];
  location: StabilizedLocation;
  compass: CompassResult;
  selectedId: string | null;
  onHeadingChange?: (heading: number | null) => void;
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
  compass,
  selectedId,
  onHeadingChange,
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

  const { phase, calibrationOffset, setCalibrationOffset, setPhase } =
    useARSessionStore();

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

  // Global background pan (calibration)
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const lastAngle = useRef<number | null>(null);

  const getMetersPerPixel = useCallback(() => {
    const viewportHeight = window.innerHeight;
    return (2 * 1.5 * Math.tan((75 * Math.PI) / 180 / 2)) / viewportHeight;
  }, []);

  const angleBetweenTouches = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.atan2(dy, dx);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // If we're interacting with a 3D model, ignore background pan touches
    if (isDraggingBuildingRef.current) return;

    if (e.touches.length === 1) {
      lastTouch.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      lastAngle.current = null;
    } else if (e.touches.length === 2) {
      lastTouch.current = null;
      lastAngle.current = angleBetweenTouches(e.touches);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      // If we're dragging a 3D model, disable global map pan
      if (isDraggingBuildingRef.current) return;

      if (e.touches.length === 1 && lastTouch.current) {
        // One-finger drag: translate on X/Z
        const mpp = getMetersPerPixel();
        const dx = (e.touches[0].clientX - lastTouch.current.x) * mpp;
        const dy = (e.touches[0].clientY - lastTouch.current.y) * mpp;

        const headingDeg = compass.hasInitialized.current ? compass.heading : 0;
        const headingRad = ((headingDeg % 360) * Math.PI) / 180;

        const worldDx = dx * Math.cos(headingRad) - dy * Math.sin(headingRad);
        const worldDz = dx * Math.sin(headingRad) + dy * Math.cos(headingRad);

        setCalibrationOffset({
          ...calibrationOffset,
          x: calibrationOffset.x + worldDx,
          z: calibrationOffset.z + worldDz,
        });

        lastTouch.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      } else if (e.touches.length === 2 && lastAngle.current !== null) {
        // Two-finger twist: rotate on Y
        const currentAngle = angleBetweenTouches(e.touches);
        const delta = currentAngle - lastAngle.current;

        setCalibrationOffset({
          ...calibrationOffset,
          rotationY: calibrationOffset.rotationY + delta,
        });

        lastAngle.current = currentAngle;
      }
    },
    [calibrationOffset, setCalibrationOffset, getMetersPerPixel, compass],
  );

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isDraggingBuildingRef.current) return;

    if (e.touches.length === 0) {
      lastTouch.current = null;
      lastAngle.current = null;
    } else if (e.touches.length === 1) {
      lastTouch.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      lastAngle.current = null;
    }
  }, []);

  return (
    <div
      className="relative w-full h-full bg-black overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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
    </div>
  );
}
