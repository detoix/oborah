"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { GeoPoint } from "@oborah/geo";
import {
  bearingBetween,
  distanceBetween,
  calculateLocalCartesianOffset,
} from "@oborah/geo";
import type { CalibrationOffset } from "@/stores/use-ar-session-store";

export interface SensorFusionResult {
  estimatedOffset: { x: number; z: number };
  heading: number;
  confidence: number;
  usingAccelerometer: boolean;
}

interface SensorFusionOptions {
  enabled: boolean;
  stabilizedOrigin: GeoPoint | null;
  calibrationOffset: CalibrationOffset;
  onDriftExceeded: () => void;
}

// Step detection
const ACCEL_THRESHOLD = 12; // m/s^2 peak
const STEP_MIN_INTERVAL = 300; // ms between steps
const STEP_LENGTH = 0.7; // meters per step

// Heading fusion
const COMPASS_WEIGHT = 0.85;
const GPS_BEARING_MIN_DIST = 2; // meters between positions for GPS bearing

// GPS rubber band
const MIN_LERP_WEIGHT = 0.05;
const MAX_LERP_WEIGHT = 0.15;

// Drift confidence
const DIVERGENCE_MAX = 15; // meters at which confidence = 0
const CONFIDENCE_THRESHOLD = 0.3;

export function useSensorFusion({
  enabled,
  stabilizedOrigin,
  calibrationOffset,
  onDriftExceeded,
}: SensorFusionOptions): SensorFusionResult {
  const [result, setResult] = useState<SensorFusionResult>({
    estimatedOffset: { x: 0, z: 0 },
    heading: 0,
    confidence: 1,
    usingAccelerometer: false,
  });

  // Dead reckoning state
  const drPosition = useRef({ x: 0, z: 0 });
  const headingRef = useRef(0);
  const confidenceRef = useRef(1);
  const hasAccelerometer = useRef(false);

  // Compass low-pass filter (sin/cos to handle wraparound)
  const compassSin = useRef(0);
  const compassCos = useRef(1);
  const compassInitialized = useRef(false);

  // Step detection
  const lastStepTime = useRef(0);

  // GPS bearing tracking
  const lastGpsPoint = useRef<GeoPoint | null>(null);

  // Drift callback ref to avoid stale closures
  const onDriftExceededRef = useRef(onDriftExceeded);
  onDriftExceededRef.current = onDriftExceeded;

  // Update interval ref
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Compass handler
  const handleOrientation = useCallback(
    (e: DeviceOrientationEvent) => {
      let heading: number | null = null;

      const webkitEvent = e as unknown as { webkitCompassHeading?: number };
      if (webkitEvent.webkitCompassHeading !== undefined) {
        heading = webkitEvent.webkitCompassHeading;
      } else if (e.absolute && e.alpha !== null) {
        heading = (360 - e.alpha) % 360;
      }

      if (heading === null) return;

      const headingRad = (heading * Math.PI) / 180;
      // Seed filter from first real reading to avoid cold-start bias toward north
      if (!compassInitialized.current) {
        compassInitialized.current = true;
        compassSin.current = Math.sin(headingRad);
        compassCos.current = Math.cos(headingRad);
      } else {
        // Low-pass filter via sin/cos
        const alpha = 0.15;
        compassSin.current =
          compassSin.current * (1 - alpha) + Math.sin(headingRad) * alpha;
        compassCos.current =
          compassCos.current * (1 - alpha) + Math.cos(headingRad) * alpha;
      }

      const filteredHeading =
        ((Math.atan2(compassSin.current, compassCos.current) * 180) / Math.PI +
          360) %
        360;

      // Fuse with GPS bearing
      headingRef.current = filteredHeading;
    },
    [],
  );

  // Step detection from accelerometer
  const handleMotion = useCallback(
    (e: DeviceMotionEvent) => {
      if (!enabled) return;

      const accel = e.accelerationIncludingGravity;
      if (!accel || accel.x === null || accel.y === null || accel.z === null)
        return;

      hasAccelerometer.current = true;

      const magnitude = Math.sqrt(
        accel.x ** 2 + accel.y ** 2 + accel.z ** 2,
      );

      const now = performance.now();
      if (
        magnitude > ACCEL_THRESHOLD &&
        now - lastStepTime.current > STEP_MIN_INTERVAL
      ) {
        lastStepTime.current = now;

        // Advance DR position by one step in heading direction
        const headingRad = (headingRef.current * Math.PI) / 180;
        // In Three.js: +X is East, -Z is North
        drPosition.current.x += Math.sin(headingRad) * STEP_LENGTH;
        drPosition.current.z -= Math.cos(headingRad) * STEP_LENGTH;
      }
    },
    [enabled],
  );

  // GPS rubber band
  const applyGpsCorrection = useCallback(
    (gpsPoint: GeoPoint, accuracy: number) => {
      if (!stabilizedOrigin) return;

      // Transform GPS into local coordinates relative to stabilized origin
      const gpsLocal = calculateLocalCartesianOffset(
        stabilizedOrigin,
        gpsPoint,
      );

      // Apply calibration offset
      const gpsCalibrated = {
        x: gpsLocal.x + calibrationOffset.x,
        z: gpsLocal.z + calibrationOffset.z,
      };

      // GPS bearing from consecutive points
      if (lastGpsPoint.current) {
        const dist = distanceBetween(lastGpsPoint.current, gpsPoint);
        if (dist > GPS_BEARING_MIN_DIST) {
          const gpsBearing = bearingBetween(lastGpsPoint.current, gpsPoint);
          // Fuse GPS bearing with compass (complement the compass weight)
          const compassH = headingRef.current;
          const gpsRad = (gpsBearing * Math.PI) / 180;
          const compassRad = (compassH * Math.PI) / 180;
          const fusedSin =
            Math.sin(compassRad) * COMPASS_WEIGHT +
            Math.sin(gpsRad) * (1 - COMPASS_WEIGHT);
          const fusedCos =
            Math.cos(compassRad) * COMPASS_WEIGHT +
            Math.cos(gpsRad) * (1 - COMPASS_WEIGHT);
          headingRef.current =
            ((Math.atan2(fusedSin, fusedCos) * 180) / Math.PI + 360) % 360;
        }
      }
      lastGpsPoint.current = gpsPoint;

      // Lerp DR position toward GPS (weight inversely proportional to accuracy)
      const lerpWeight = Math.max(
        MIN_LERP_WEIGHT,
        Math.min(MAX_LERP_WEIGHT, MAX_LERP_WEIGHT * (10 / Math.max(accuracy, 1))),
      );

      drPosition.current.x +=
        (gpsCalibrated.x - drPosition.current.x) * lerpWeight;
      drPosition.current.z +=
        (gpsCalibrated.z - drPosition.current.z) * lerpWeight;

      // Drift confidence
      const divergence = Math.sqrt(
        (gpsCalibrated.x - drPosition.current.x) ** 2 +
          (gpsCalibrated.z - drPosition.current.z) ** 2,
      );
      confidenceRef.current = Math.max(0, 1 - divergence / DIVERGENCE_MAX);

      // Faster decay when no accelerometer
      if (!hasAccelerometer.current) {
        confidenceRef.current *= 0.9;
      }

      if (confidenceRef.current < CONFIDENCE_THRESHOLD) {
        onDriftExceededRef.current();
      }
    },
    [stabilizedOrigin, calibrationOffset],
  );

  // Set up event listeners
  useEffect(() => {
    if (!enabled) return;

    // Compass
    window.addEventListener(
      "deviceorientationabsolute",
      handleOrientation as EventListener,
    );
    window.addEventListener("deviceorientation", handleOrientation);

    // Accelerometer
    window.addEventListener("devicemotion", handleMotion);

    // GPS watcher for rubber band
    let watchId: number | undefined;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          applyGpsCorrection(
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            pos.coords.accuracy,
          );
        },
        undefined,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
    }

    // Push state to React at ~2Hz
    updateIntervalRef.current = setInterval(() => {
      setResult({
        estimatedOffset: { ...drPosition.current },
        heading: headingRef.current,
        confidence: confidenceRef.current,
        usingAccelerometer: hasAccelerometer.current,
      });
    }, 500);

    return () => {
      window.removeEventListener(
        "deviceorientationabsolute",
        handleOrientation as EventListener,
      );
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("devicemotion", handleMotion);
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
    };
  }, [enabled, handleOrientation, handleMotion, applyGpsCorrection]);

  // Reset state when re-enabled
  useEffect(() => {
    if (enabled) {
      drPosition.current = { x: 0, z: 0 };
      confidenceRef.current = 1;
      compassInitialized.current = false;
    }
  }, [enabled]);

  return result;
}
