"use client";

import React, { useCallback, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { ThreeEvent } from "@react-three/fiber";
import type { GeoCenter, GeoPoint } from "@oborah/geo";
import { coordsToVector3, vector3ToCoords } from "react-three-map/maplibre";
import * as THREE from "three";

export interface VisualConfig {
  args: [number, number, number];
  color: string;
  soilColor?: string;
  opacity?: number;
  transparent?: boolean;
  modelUrl?: string;
}

interface InteractiveModelProps {
  id: string;
  position: GeoPoint;
  rotationY: number;
  isSelected: boolean;
  interactive?: boolean;
  requireSelectionForDrag?: boolean;
  visualConfig?: VisualConfig;
  origin: GeoCenter;
  onMove: (lng: number, lat: number) => void;
  onRotate: (rotation: number) => void;
  onClick: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

const ROTATION_RING_WIDTH = 1.0;
const DEFAULT_ORIGIN = { lng: 19.945, lat: 50.0647 } as const;
type PointerCaptureTarget = EventTarget & {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
};

function GlbModel({
  url,
  targetArgs,
}: {
  url: string;
  targetArgs: [number, number, number];
}) {
  const gltf = useGLTF(url);

  const { scene, scale, offset } = useMemo(() => {
    const clonedScene = gltf.scene.clone(true);
    clonedScene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.raycast = () => {};
      }
    });

    clonedScene.updateWorldMatrix(true, true);
    const bbox = new THREE.Box3().setFromObject(clonedScene);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    const safeSize = new THREE.Vector3(
      Math.max(size.x, 0.001),
      Math.max(size.y, 0.001),
      Math.max(size.z, 0.001),
    );

    const uniformScale = Math.min(
      targetArgs[0] / safeSize.x,
      targetArgs[1] / safeSize.y,
      targetArgs[2] / safeSize.z,
    );

    return {
      scene: clonedScene,
      scale: uniformScale,
      offset: new THREE.Vector3(
        -center.x * uniformScale,
        -center.y * uniformScale,
        -center.z * uniformScale,
      ),
    };
  }, [gltf.scene, targetArgs]);

  return <primitive object={scene} scale={scale} position={offset} />;
}

export function InteractiveModel({
  id,
  position: lngLat,
  rotationY,
  isSelected,
  interactive = true,
  requireSelectionForDrag = false,
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
  const hasGlbModel = Boolean(activeConfig.modelUrl);

  const safeOrigin = useMemo(() => {
    if (
      origin &&
      Number.isFinite(origin.lng) &&
      Number.isFinite(origin.lat)
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
    return { lng: safeOrigin.lng, lat: safeOrigin.lat };
  }, [id, lngLat, safeOrigin.lat, safeOrigin.lng]);

  const groundPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    [],
  );

  const position = useMemo(() => {
    const [x, y, z] = coordsToVector3(
      { longitude: safeLngLat.lng, latitude: safeLngLat.lat },
      { longitude: safeOrigin.lng, latitude: safeOrigin.lat },
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
      if (requireSelectionForDrag && !isSelected) {
        onClick(); // First tap selects on mobile; drag starts on next gesture
        return;
      }
      onClick();

      const hitPoint = raycastToGround(e.ray);
      if (!hitPoint || !groupRef.current) return;

      isDragging.current = true;
      dragOffset.current.copy(hitPoint).sub(groupRef.current.position);
      onInteractionStart?.();

      (
        e.nativeEvent.target as PointerCaptureTarget | null
      )?.setPointerCapture?.(e.nativeEvent.pointerId);
    },
    [requireSelectionForDrag, isSelected, onClick, raycastToGround, onInteractionStart],
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
      const coords = vector3ToCoords([pos.x, pos.y, pos.z], {
        longitude: safeOrigin.lng,
        latitude: safeOrigin.lat,
      });
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
        onPointerDown={interactive ? handlePointerDown : undefined}
        onPointerMove={interactive ? handlePointerMove : undefined}
        onPointerUp={interactive ? handlePointerUp : undefined}
        castShadow
        receiveShadow
      >
        <boxGeometry args={activeConfig.args} />
        <meshStandardMaterial
          color={activeConfig.color}
          opacity={
            hasGlbModel ? (isSelected ? 0.18 : 0.01) : (activeConfig.opacity ?? 1)
          }
          transparent={hasGlbModel || (activeConfig.transparent ?? false)}
          emissive={isSelected ? "#ffffff" : "#000000"}
          emissiveIntensity={isSelected ? 0.3 : 0}
          depthWrite={!hasGlbModel}
        />
      </mesh>

      {activeConfig.modelUrl && (
        <React.Suspense fallback={null}>
          <GlbModel url={activeConfig.modelUrl} targetArgs={activeConfig.args} />
        </React.Suspense>
      )}

      {/* Soil layer for beds/planters */}
      {activeConfig.soilColor && !hasGlbModel && (
        <mesh position={[0, activeConfig.args[1] / 2 + 0.05, 0]}>
          <boxGeometry
            args={[activeConfig.args[0] - 0.2, 0.1, activeConfig.args[2] - 0.2]}
          />
          <meshStandardMaterial color={activeConfig.soilColor} />
        </mesh>
      )}

      {isSelected && interactive && (
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
