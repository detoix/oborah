"use client";

import React, { useCallback, useMemo, useRef } from "react";
import { ThreeEvent, useThree } from "@react-three/fiber";
import { coordsToVector3, vector3ToCoords } from "react-three-map/maplibre";
import * as THREE from "three";

export interface VisualConfig {
  args: [number, number, number];
  color: string;
  soilColor?: string;
  opacity?: number;
  transparent?: boolean;
}

interface InteractiveModelProps {
  id: string;
  position: { lng: number; lat: number };
  rotationY: number;
  isSelected: boolean;
  visualConfig?: VisualConfig;
  origin: { longitude: number; latitude: number };
  onMove: (lng: number, lat: number) => void;
  onRotate: (rotation: number) => void;
  onClick: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

const ROTATION_RING_WIDTH = 1.0;
const DEFAULT_ORIGIN = { longitude: 19.945, latitude: 50.0647 } as const;
type PointerCaptureTarget = EventTarget & {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
};

export function InteractiveModel({
  id,
  position: lngLat,
  rotationY,
  isSelected,
  visualConfig,
  origin,
  onMove,
  onRotate,
  onClick,
  onInteractionStart,
  onInteractionEnd,
}: InteractiveModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const isDragging = useRef(false);
  const isRotating = useRef(false);
  const dragOffset = useRef(new THREE.Vector3());
  const rotateStartAngle = useRef(0);
  const rotateStartRotation = useRef(0);

  const defaultVisualConfig = useMemo(
    (): VisualConfig => ({
      args: [4, 8, 4],
      color: "#00ff88",
    }),
    [],
  );

  const activeConfig = visualConfig ?? defaultVisualConfig;

  const safeOrigin = useMemo(() => {
    if (
      origin &&
      Number.isFinite(origin.longitude) &&
      Number.isFinite(origin.latitude)
    ) {
      return origin;
    }
    console.warn(
      `InteractiveModel(${id}): invalid origin, defaulting to Kraków`,
      origin,
    );
    return DEFAULT_ORIGIN;
  }, [id, origin]);

  const safeLngLat = useMemo(() => {
    if (Number.isFinite(lngLat?.lng) && Number.isFinite(lngLat?.lat)) {
      return lngLat;
    }
    console.warn(
      `InteractiveModel(${id}): invalid position, falling back to origin`,
      lngLat,
    );
    return { lng: safeOrigin.longitude, lat: safeOrigin.latitude };
  }, [id, lngLat, safeOrigin.latitude, safeOrigin.longitude]);

  const groundPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    [],
  );

  const position = useMemo(() => {
    const [x, y, z] = coordsToVector3(
      { longitude: safeLngLat.lng, latitude: safeLngLat.lat },
      safeOrigin,
    );
    return [x, y, z] as [number, number, number];
  }, [safeLngLat.lat, safeLngLat.lng, safeOrigin]);

  const raycastToGround = useCallback(
    (ray: THREE.Ray): THREE.Vector3 | null => {
      const target = new THREE.Vector3();
      return ray.intersectPlane(groundPlane, target);
    },
    [groundPlane],
  );

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onClick(); // Snap selection on down

      const hitPoint = raycastToGround(e.ray);
      if (!hitPoint || !groupRef.current) return;

      isDragging.current = true;
      dragOffset.current.copy(hitPoint).sub(groupRef.current.position);
      onInteractionStart?.();

      (
        e.nativeEvent.target as PointerCaptureTarget | null
      )?.setPointerCapture?.(e.nativeEvent.pointerId);
    },
    [onClick, raycastToGround, onInteractionStart],
  );

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isDragging.current || !groupRef.current) return;
      e.stopPropagation();

      const hitPoint = raycastToGround(e.ray);
      if (!hitPoint) return;

      groupRef.current.position.x = hitPoint.x - dragOffset.current.x;
      groupRef.current.position.z = hitPoint.z - dragOffset.current.z;
    },
    [raycastToGround],
  );

  const handlePointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isDragging.current || !groupRef.current) return;
      e.stopPropagation();

      isDragging.current = false;
      onInteractionEnd?.();
      (
        e.nativeEvent.target as PointerCaptureTarget | null
      )?.releasePointerCapture?.(e.nativeEvent.pointerId);

      const pos = groupRef.current.position;
      const coords = vector3ToCoords([pos.x, pos.y, pos.z], safeOrigin);
      onMove(coords.longitude, coords.latitude);
    },
    [onMove, onInteractionEnd, safeOrigin],
  );

  const getAngleFromCenter = useCallback(
    (ray: THREE.Ray): number | null => {
      const hitPoint = raycastToGround(ray);
      if (!hitPoint || !groupRef.current) return null;
      const dx = hitPoint.x - groupRef.current.position.x;
      const dz = hitPoint.z - groupRef.current.position.z;
      return Math.atan2(dx, dz);
    },
    [raycastToGround],
  );

  const handleRingPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const angle = getAngleFromCenter(e.ray);
      if (angle === null || !groupRef.current) return;

      isRotating.current = true;
      rotateStartAngle.current = angle;
      rotateStartRotation.current = groupRef.current.rotation.y;
      onInteractionStart?.();

      (
        e.nativeEvent.target as PointerCaptureTarget | null
      )?.setPointerCapture?.(e.nativeEvent.pointerId);
    },
    [getAngleFromCenter, onInteractionStart],
  );

  const handleRingPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isRotating.current || !groupRef.current) return;
      e.stopPropagation();

      const angle = getAngleFromCenter(e.ray);
      if (angle === null) return;

      const delta = angle - rotateStartAngle.current;
      groupRef.current.rotation.y = rotateStartRotation.current + delta;
    },
    [getAngleFromCenter],
  );

  const handleRingPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isRotating.current || !groupRef.current) return;
      e.stopPropagation();

      isRotating.current = false;
      onInteractionEnd?.();
      (
        e.nativeEvent.target as PointerCaptureTarget | null
      )?.releasePointerCapture?.(e.nativeEvent.pointerId);

      onRotate(groupRef.current.rotation.y);
    },
    [onRotate, onInteractionEnd],
  );

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      <mesh
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        castShadow
        receiveShadow
      >
        <boxGeometry args={activeConfig.args} />
        <meshStandardMaterial
          color={activeConfig.color}
          opacity={activeConfig.opacity ?? 1}
          transparent={activeConfig.transparent ?? false}
          emissive={isSelected ? "#ffffff" : "#000000"}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>

      {/* Soil layer for beds/planters */}
      {activeConfig.soilColor && (
        <mesh position={[0, activeConfig.args[1] / 2 + 0.05, 0]}>
          <boxGeometry
            args={[activeConfig.args[0] - 0.2, 0.1, activeConfig.args[2] - 0.2]}
          />
          <meshStandardMaterial color={activeConfig.soilColor} />
        </mesh>
      )}

      {isSelected && (
        <mesh
          position={[0, 0.1, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={handleRingPointerDown}
          onPointerMove={handleRingPointerMove}
          onPointerUp={handleRingPointerUp}
        >
          <ringGeometry args={[6, 6 + ROTATION_RING_WIDTH, 64]} />
          <meshBasicMaterial
            color="#00ff88"
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
