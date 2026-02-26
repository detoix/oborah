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
      setError("Geolocation is not supported by your browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        // Drop readings with terrible accuracy to prevent massive jumps
        if (position.coords.accuracy > 10 && recentPositions.current.length > 0) {
          console.log(`[ARViewport] Ignored bad GPS reading. Accuracy: ${position.coords.accuracy}m`);
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

        console.log(`[ARViewport] Live User GPS updated (Smoothed): [Lng: ${avgLng.toFixed(7)}, Lat: ${avgLat.toFixed(7)}] (Raw Accuracy: ${position.coords.accuracy}m)`);
        
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
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [userOrigin, buildings]);

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

      {/* 3D Canvas rendering on top with transparent background */}
      {userOrigin && (
        <div className="absolute inset-0 z-10">
          <Canvas
            onPointerMissed={() => onSelectBuilding(null)}
            camera={{ position: [0, 0, 0], fov: 75 }}
          >
            {/* The magic Drei component that binds mobile gyroscope to the ThreeJS camera 
                By default, DeviceOrientationControls assumes looking down the -Z axis.
                Depending on the mobile browser implementation, we sometimes need to offset the Y rotation
                to align screen "forward" with true North. Testing has shown that a 180 degrees (Math.PI) 
                or 90 degrees offset is often needed so that the camera faces the correct mathematical direction.
            */}
            <group rotation={[0, -Math.PI / 2, 0]}>
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
