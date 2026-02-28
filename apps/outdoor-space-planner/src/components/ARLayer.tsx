"use client";

import React, { useMemo } from "react";
import type { GeoCenter, GeoPoint } from "@oborah/geo";
import { calculateLocalCartesianOffset } from "@oborah/geo";
import { InteractiveModel, type VisualConfig } from "@oborah/design";
export interface ARBuilding {
  id: string;
  kind: string;
  position: GeoPoint;
  rotationY: number;
  visualConfig?: VisualConfig;
}

export interface ARCalibrationOffset {
  x: number;
  z: number;
  rotationY: number;
}

export interface ARSensorFusionOffset {
  x: number;
  z: number;
}

export interface ARLayerProps {
  buildings: ARBuilding[];
  livePosition: GeoCenter; // The user's live Kalman position
  selectedId: string | null;
  calibrationOffset?: ARCalibrationOffset;
  onSelectBuilding: (id: string | null) => void;
  onMoveBuilding: (id: string, position: GeoPoint) => void;
  onRotateBuilding: (id: string, rotation: number) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export function ARLayer({
  buildings = [],
  livePosition,
  selectedId = null,
  calibrationOffset,
  onSelectBuilding = () => {},
  onMoveBuilding = () => {},
  onRotateBuilding = () => {},
  onInteractionStart,
  onInteractionEnd,
}: ARLayerProps) {
  const totalX = calibrationOffset?.x ?? 0;
  const totalZ = calibrationOffset?.z ?? 0;
  const calibRotY = calibrationOffset?.rotationY ?? 0;
  // Convert GPS positions to local Cartesian coordinates relative to user
  const buildingsWithOffsets = useMemo(() => {
    const calculated = buildings.map((b) => {
      const offset = calculateLocalCartesianOffset(livePosition, b.position);
      return { ...b, offset };
    });

    console.log("[ARLayer] Target objects relative to user:");
    calculated.forEach((b) => {
      console.log(
        `- Model: ${b.kind}, Target GPS: [Lng: ${b.position.lng}, Lat: ${b.position.lat}]`,
      );
      console.log(
        `  -> Offset from you (meters): [X (East): ${b.offset.x.toFixed(2)}m, Z (North): ${(-b.offset.z).toFixed(2)}m]`,
      );
    });

    return calculated;
  }, [buildings, livePosition]);

  return (
    <>
      {/* World-space lights (outside calibration group) */}
      <ambientLight intensity={0.9} />
      <directionalLight position={[50, 100, 50]} intensity={1.5} castShadow />

      {/* Root calibration group — shifts ALL buildings together */}
      <group position={[totalX, 0, totalZ]} rotation={[0, calibRotY, 0]}>
        {/* We represent ground level as Y = -1.5m to simulate eye level at origin [0,0,0] */}
        {buildingsWithOffsets.map((b) => (
          <group key={b.id} position={[b.offset.x, -1.5, b.offset.z]}>
            <InteractiveModel
              id={b.id}
              position={b.position}
              origin={b.position}
              rotationY={b.rotationY}
              isSelected={b.id === selectedId}
              visualConfig={b.visualConfig}
              onMove={(lng: number, lat: number) =>
                onMoveBuilding(b.id, { lng, lat })
              }
              onRotate={(rot: number) => onRotateBuilding(b.id, rot)}
              onClick={() => onSelectBuilding(b.id)}
              onInteractionStart={onInteractionStart}
              onInteractionEnd={onInteractionEnd}
            />
          </group>
        ))}
      </group>
    </>
  );
}
