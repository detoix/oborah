"use client";

import React from "react";
import { InteractiveModel } from "./InteractiveModel";

export interface DesignBuilding {
  id: string;
  type: string;
  position: { lng: number; lat: number };
  rotationY: number;
}

export interface DesignLayerProps {
  buildings: DesignBuilding[];
  selectedId: string | null;
  onMoveBuilding: (id: string, position: { lng: number; lat: number }) => void;
  onRotateBuilding: (id: string, rotation: number) => void;
  onSelectBuilding: (id: string | null) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export function DesignLayer({
  buildings = [],
  selectedId = null,
  onMoveBuilding = () => {},
  onRotateBuilding = () => {},
  onSelectBuilding = () => {},
  onInteractionStart,
  onInteractionEnd,
}: DesignLayerProps) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[100, 200, 100]} intensity={1.2} castShadow />

      {buildings.map((b) => (
        <InteractiveModel
          key={b.id}
          id={b.id}
          type={b.type}
          position={b.position}
          rotationY={b.rotationY}
          isSelected={b.id === selectedId}
          onMove={(lng, lat) => onMoveBuilding(b.id, { lng, lat })}
          onRotate={(rot) => onRotateBuilding(b.id, rot)}
          onClick={() => onSelectBuilding(b.id)}
          onInteractionStart={onInteractionStart}
          onInteractionEnd={onInteractionEnd}
        />
      ))}
    </>
  );
}
