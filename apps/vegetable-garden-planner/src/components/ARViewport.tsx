"use client";

import React, { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { DeviceOrientationControls } from "@react-three/drei";
import type { GeoCenter, GeoPoint } from "@oborah/geo";
import { ARLayer, type ARBuilding } from "./ARLayer";

interface ARViewportProps {
  buildings: ARBuilding[];
  selectedId: string | null;
  onSelectBuilding: (id: string | null) => void;
  onMoveBuilding: (id: string, position: GeoPoint) => void;
  onRotateBuilding: (id: string, rot: number) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

export function ARViewport({
  buildings,
  selectedId,
  onSelectBuilding,
  onMoveBuilding,
  onRotateBuilding,
  onInteractionStart,
  onInteractionEnd,
}: ARViewportProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [userOrigin, setUserOrigin] = useState<GeoCenter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);

  // Check if we need orientation permissions (iOS 13+)
  useEffect(() => {
    const OrientationEvent = (window as any)
      .DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof OrientationEvent?.requestPermission === "function") {
      // Use a microtask to avoid synchronous setState warning in useEffect
      Promise.resolve().then(() => setNeedsPermission(true));
    }
  }, []);

  // 1. Initialize Camera Stream
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

  // Moving Average State for GPS Smoothing
  const recentPositions = useRef<{ lat: number; lng: number }[]>([]);
  const SMOOTHING_SAMPLES = 5;

  // 2. Initialize Geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      Promise.resolve().then(() =>
        setError("Geolocation is not supported by your browser."),
      );
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        // Drop readings with terrible accuracy to prevent massive jumps
        if (
          position.coords.accuracy > 10 &&
          recentPositions.current.length > 0
        ) {
          console.log(
            `[ARViewport] Ignored bad GPS reading. Accuracy: ${position.coords.accuracy}m`,
          );
          return;
        }

        const newPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        recentPositions.current.push(newPos);
        if (recentPositions.current.length > SMOOTHING_SAMPLES) {
          recentPositions.current.shift();
        }

        const avgLat =
          recentPositions.current.reduce((sum, p) => sum + p.lat, 0) /
          recentPositions.current.length;
        const avgLng =
          recentPositions.current.reduce((sum, p) => sum + p.lng, 0) /
          recentPositions.current.length;

        console.log(
          `[ARViewport] Live User GPS updated (Smoothed): [Lng: ${avgLng.toFixed(7)}, Lat: ${avgLat.toFixed(7)}] (Raw Accuracy: ${position.coords.accuracy}m)`,
        );

        setUserOrigin({
          lat: avgLat,
          lng: avgLng,
        });
      },
      (err) => {
        console.error("Error watching position", err);
        // Fallback for debugging if GPS fails
        if (!userOrigin && buildings.length > 0) {
          setUserOrigin(buildings[0].position);
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [userOrigin, buildings]);

  // 3. Absolute Orientation / Compass Heading
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      let heading: number | null = null;

      // iOS specific
      const webkitEvent = e as unknown as { webkitCompassHeading?: number };
      if (webkitEvent.webkitCompassHeading !== undefined) {
        heading = webkitEvent.webkitCompassHeading;
      }
      // Android / Standard absolute orientation
      else if (e.absolute && e.alpha !== null) {
        // Standard alpha is 0 at North, increases counter-clockwise (0..360)
        // We want compass heading (0 at North, increases clockwise)
        heading = (360 - e.alpha) % 360;
      }

      if (heading !== null && !isCalibrated) {
        // We only want to capture the "Lock" once to align the scene
        // Or we can continuously update it if the sensor drifts
        setCompassHeading(heading);
        setIsCalibrated(true);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener(
        "deviceorientationabsolute",
        handleOrientation as EventListener,
      );
      window.addEventListener("deviceorientation", handleOrientation);
    }

    return () => {
      window.removeEventListener(
        "deviceorientationabsolute",
        handleOrientation as EventListener,
      );
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [isCalibrated]);

  const requestPermissions = async () => {
    const OrientationEvent = (window as any)
      .DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof OrientationEvent?.requestPermission === "function") {
      try {
        const response = await OrientationEvent.requestPermission();
        if (response === "granted") {
          setNeedsPermission(false);
        } else {
          setError("Permission to access orientation was denied.");
        }
      } catch (err) {
        console.error("Permission request failed", err);
        setError("Failed to request orientation permissions.");
      }
    }
  };

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
      {error && (
        <div className="absolute top-4 left-4 right-4 z-50 p-4 bg-red-500/80 text-white rounded-lg backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Loading Overlay */}
      {!userOrigin && !error && (
        <div className="absolute inset-0 z-40 bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <div className="text-white text-lg font-medium animate-pulse">
            Acquiring GPS Signal...
          </div>
        </div>
      )}

      {/* Permission / Calibration Overlay */}
      {needsPermission && (
        <div className="absolute inset-0 z-50 bg-black/70 flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-white text-xl font-bold mb-4">
            Compass Calibration
          </h2>
          <p className="text-gray-300 mb-6">
            To align AR objects with reality, we need access to your
            device&apos;s compass.
          </p>
          <button
            onClick={requestPermissions}
            className="px-6 py-3 bg-blue-600 text-white rounded-full font-bold shadow-lg active:scale-95 transition-transform"
          >
            Allow Compass Access
          </button>
        </div>
      )}

      {!isCalibrated && !needsPermission && userOrigin && (
        <div className="absolute bottom-24 left-0 right-0 z-30 flex justify-center">
          <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm">
            Point phone North to calibrate...
          </div>
        </div>
      )}

      {/* 3D Canvas rendering on top with transparent background */}
      {userOrigin && (
        <div className="absolute inset-0 z-10">
          <Canvas
            onPointerMissed={() => onSelectBuilding(null)}
            camera={{ position: [0, 0, 0], fov: 75 }}
          >
            {/* The magic Drei component that binds mobile gyroscope to the ThreeJS camera 
                By default, DeviceOrientationControls assumes looking down the -Z axis.
                We align the scene by rotating the container group based on the absolute compass heading.
                 Compass Heading: 0 = North, 90 = East, 180 = South, 270 = West
                 In Three.js, we want -Z to be North.
            */}
            <group
              rotation={[
                0,
                compassHeading ? (compassHeading * Math.PI) / 180 : 0,
                0,
              ]}
            >
              <DeviceOrientationControls />
            </group>

            <ARLayer
              buildings={buildings}
              origin={userOrigin}
              selectedId={selectedId}
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
