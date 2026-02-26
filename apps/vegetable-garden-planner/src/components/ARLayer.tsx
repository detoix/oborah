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

export interface ARLayerProps {
  buildings: ARBuilding[];
  origin: GeoCenter; // The user's current physical location
  selectedId: string | null;
  onSelectBuilding: (id: string | null) => void;
  onMoveBuilding: (id: string, position: GeoPoint) => void;
  onRotateBuilding: (id: string, rotation: number) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export function ARLayer({
  buildings = [],
  origin,
  selectedId = null,
  onSelectBuilding = () => {},
  onMoveBuilding = () => {},
  onRotateBuilding = () => {},
  onInteractionStart,
  onInteractionEnd,
}: ARLayerProps) {
  // Convert GPS positions to local Cartesian coordinates relative to user
  const buildingsWithOffsets = useMemo(() => {
    const calculated = buildings.map((b) => {
      const offset = calculateLocalCartesianOffset(origin, b.position);
      return { ...b, offset };
    });

    console.log("[ARLayer] Target objects relative to user:");
    calculated.forEach((b) => {
      console.log(`- Model: ${b.kind}, Target GPS: [Lng: ${b.position.lng}, Lat: ${b.position.lat}]`);
      console.log(`  -> Offset from you (meters): [X (East): ${b.offset.x.toFixed(2)}m, Z (North): ${(-b.offset.z).toFixed(2)}m]`);
    });

    return calculated;
  }, [buildings, origin]);

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[50, 100, 50]} intensity={1.5} castShadow />
      
      {/* We represent ground level as Y = -1.5m to simulate eye level at origin [0,0,0] */}
      {buildingsWithOffsets.map((b) => (
        <group key={b.id} position={[b.offset.x, -1.5, b.offset.z]}>
           {/* Wrap InteractiveModel so its internal (lng/lat -> xyz) doesn't conflict.
               InteractiveModel usually uses its own origin prop to calculate offsets natively.
               Since we are in AR, we do the calculation *here* and place the group.
               In this setup, we pass the building's own position as the origin so its internal
               offset is [0,0,0]. */}
          <InteractiveModel
            id={b.id}
            position={b.position}
            origin={b.position} 
            // We rotated the AR Viewport camera by -Math.PI / 2.
            // Based on on-device testing, we need to offset the local rotation by Math.PI / 2 + Math.PI (180 deg) 
            // so they face the correct physical heading relative to their 2D placement.
            rotationY={b.rotationY }
            isSelected={b.id === selectedId}
            visualConfig={b.visualConfig}
            onMove={(lng: number, lat: number) => onMoveBuilding(b.id, { lng, lat })}
            onRotate={(rot: number) => onRotateBuilding(b.id, rot)}
            onClick={() => onSelectBuilding(b.id)}
            onInteractionStart={onInteractionStart}
            onInteractionEnd={onInteractionEnd}
          />
        </group>
      ))}
    </>
  );
}
