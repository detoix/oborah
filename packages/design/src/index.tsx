"use client";

import React from "react";
import type { GeoCenter, GeoPoint } from "@oborah/geo";
import { InteractiveModel, type VisualConfig } from "./InteractiveModel";

export { InteractiveModel, type VisualConfig };

export interface DesignBuilding {
  id: string;
  kind: string;
  position: GeoPoint;
  rotationY: number;
  visualConfig?: VisualConfig;
}

export interface DesignLayerProps {
  buildings: DesignBuilding[];
  selectedId: string | null;
  origin: GeoCenter;
  interactive?: boolean;
  requireSelectionForDrag?: boolean;
  onMoveBuilding: (id: string, position: GeoPoint) => void;
  onRotateBuilding: (id: string, rotation: number) => void;
  onSelectBuilding: (id: string | null) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export function DesignLayer({
  buildings = [],
  selectedId = null,
  origin,
  interactive = true,
  requireSelectionForDrag = false,
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
          position={b.position}
          rotationY={b.rotationY}
          isSelected={b.id === selectedId}
          interactive={interactive}
          requireSelectionForDrag={requireSelectionForDrag}
          visualConfig={b.visualConfig}
          origin={origin}
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
