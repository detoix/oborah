"use client";

import React, { useRef, useCallback } from "react";
import type { CalibrationOffset } from "@/stores/use-ar-session-store";

interface CalibrationOverlayProps {
  offset: CalibrationOffset;
  headingDeg: number;
  onChange: (offset: CalibrationOffset) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * DOM overlay above the Three.js canvas for touch-based scene calibration.
 * - One-finger drag: translate scene on X/Z plane
 * - Two-finger twist: rotate scene on Y axis
 */
export function CalibrationOverlay({
  offset,
  headingDeg,
  onChange,
  onConfirm,
  onCancel,
}: CalibrationOverlayProps) {
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const lastAngle = useRef<number | null>(null);
  const touchCount = useRef(0);

  // Screen pixels -> meters conversion
  // Assumes camera at ~1.5m height, FOV 75deg
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
    e.preventDefault();
    touchCount.current = e.touches.length;

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
      e.preventDefault();

      if (e.touches.length === 1 && lastTouch.current) {
        // One-finger drag: translate on X/Z
        const mpp = getMetersPerPixel();
        const dx = (e.touches[0].clientX - lastTouch.current.x) * mpp;
        const dy = (e.touches[0].clientY - lastTouch.current.y) * mpp;
        const headingRad = ((headingDeg % 360) * Math.PI) / 180;

        // Convert screen-local drag to world X/Z using live heading.
        // right vector = [cos(h), sin(h)]
        // forward vector = [sin(h), -cos(h)], and screen Y+ means backward.
        const worldDx = dx * Math.cos(headingRad) - dy * Math.sin(headingRad);
        const worldDz = dx * Math.sin(headingRad) + dy * Math.cos(headingRad);

        onChange({
          ...offset,
          x: offset.x + worldDx,
          z: offset.z + worldDz,
        });

        lastTouch.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      } else if (e.touches.length === 2 && lastAngle.current !== null) {
        // Two-finger twist: rotate on Y
        const currentAngle = angleBetweenTouches(e.touches);
        const delta = currentAngle - lastAngle.current;

        onChange({
          ...offset,
          rotationY: offset.rotationY + delta,
        });

        lastAngle.current = currentAngle;
      }
    },
    [offset, onChange, getMetersPerPixel, headingDeg],
  );

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    touchCount.current = e.touches.length;

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
      className="absolute inset-0 z-20"
      style={{ touchAction: "none" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Instruction banner */}
      <div className="absolute top-4 left-4 right-4 flex justify-center">
        <div className="bg-black/60 backdrop-blur-md px-5 py-3 rounded-xl text-white text-center">
          <p className="text-sm font-semibold">Align Your Garden</p>
          <p className="text-xs text-gray-300 mt-1">
            Drag to position &middot; Two fingers to rotate
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="absolute bottom-40 left-0 right-0 flex justify-center gap-4 px-6">
        <button
          onClick={onCancel}
          className="px-5 py-3 bg-white/20 backdrop-blur-md text-white rounded-full text-sm font-medium active:scale-95 transition-transform"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-6 py-3 bg-blue-600 text-white rounded-full text-sm font-bold shadow-lg active:scale-95 transition-transform"
        >
          Confirm Alignment
        </button>
      </div>
    </div>
  );
}
