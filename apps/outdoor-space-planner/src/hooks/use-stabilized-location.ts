"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { GeoPoint, TimestampedGeoPoint } from "@oborah/geo";
import {
  distanceBetween,
  geoCentroid,
  speedBetween,
} from "@oborah/geo";

export type StabilizationStatus =
  | "waiting"
  | "acquiring"
  | "stabilizing"
  | "anchored"
  | "error";

export interface StabilizedLocation {
  position: GeoPoint | null;
  isStationary: boolean;
  accuracy: number | null;
  status: StabilizationStatus;
  error: string | null;
}

const ACCURACY_GATE = 20; // meters - discard readings above this
const STATIONARY_SPEED = 0.5; // m/s
const STATIONARY_COUNT = 3; // consecutive slow readings needed
const CENTROID_SAMPLES = 10; // readings to compute centroid from
const DEADBAND_RADIUS = 7; // meters - ignore movement within this

export function useStabilizedLocation(): StabilizedLocation {
  // React state - only updated on significant changes
  const [result, setResult] = useState<StabilizedLocation>({
    position: null,
    isStationary: false,
    accuracy: null,
    status: "waiting",
    error: null,
  });

  // High-frequency data in refs (no re-renders)
  const readings = useRef<TimestampedGeoPoint[]>([]);
  const stationaryStreak = useRef(0);
  const isStationary = useRef(false);
  const centroidSamples = useRef<GeoPoint[]>([]);
  const anchor = useRef<GeoPoint | null>(null);

  const updateResult = useCallback(
    (patch: Partial<StabilizedLocation>) => {
      setResult((prev) => {
        // Only update if something actually changed
        const needsUpdate = Object.keys(patch).some(
          (k) =>
            patch[k as keyof StabilizedLocation] !==
            prev[k as keyof StabilizedLocation],
        );
        return needsUpdate ? { ...prev, ...patch } : prev;
      });
    },
    [],
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      setResult({
        position: null,
        isStationary: false,
        accuracy: null,
        status: "error",
        error: "Geolocation is not supported by your browser.",
      });
      return;
    }

    updateResult({ status: "acquiring" });

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        // 1. Accuracy gate
        if (accuracy > ACCURACY_GATE) {
          console.log(
            `[StabilizedLocation] Discarded reading: accuracy ${accuracy.toFixed(1)}m > ${ACCURACY_GATE}m`,
          );
          return;
        }

        const point: TimestampedGeoPoint = {
          lat: latitude,
          lng: longitude,
          timestamp: pos.timestamp,
          accuracy,
        };

        const prevReadings = readings.current;
        prevReadings.push(point);
        // Keep last 20 readings for speed calculation
        if (prevReadings.length > 20) prevReadings.shift();

        // 2. Stationary detection
        if (prevReadings.length >= 2) {
          const prev = prevReadings[prevReadings.length - 2];
          const speed = speedBetween(prev, point);

          if (speed < STATIONARY_SPEED) {
            stationaryStreak.current++;
          } else {
            stationaryStreak.current = 0;
          }

          if (
            stationaryStreak.current >= STATIONARY_COUNT &&
            !isStationary.current
          ) {
            isStationary.current = true;
            updateResult({ isStationary: true, status: "stabilizing" });
            console.log("[StabilizedLocation] Stationary detected");
          } else if (
            stationaryStreak.current < STATIONARY_COUNT &&
            isStationary.current
          ) {
            isStationary.current = false;
            updateResult({ isStationary: false });
          }
        }

        // 3. Centroid accumulator
        if (isStationary.current && !anchor.current) {
          centroidSamples.current.push({ lat: latitude, lng: longitude });

          if (centroidSamples.current.length >= CENTROID_SAMPLES) {
            const centroid = geoCentroid(centroidSamples.current);
            anchor.current = centroid;
            console.log(
              `[StabilizedLocation] Anchor locked: [${centroid.lng.toFixed(7)}, ${centroid.lat.toFixed(7)}]`,
            );
            updateResult({
              position: centroid,
              accuracy,
              status: "anchored",
            });
          }
        }

        // 4. Deadband anchor
        if (anchor.current) {
          const dist = distanceBetween(anchor.current, point);

          if (dist <= DEADBAND_RADIUS) {
            // Within deadband - keep anchor, just update accuracy
            updateResult({ accuracy });
          } else if (!isStationary.current) {
            // Outside deadband AND moving - break anchor
            console.log(
              `[StabilizedLocation] Anchor broken: ${dist.toFixed(1)}m from centroid, moving`,
            );
            anchor.current = null;
            centroidSamples.current = [];
            stationaryStreak.current = 0;
            updateResult({
              position: point,
              accuracy,
              status: "acquiring",
            });
          }
          // If outside deadband but stationary, keep anchor (GPS noise)
        } else if (!anchor.current) {
          // No anchor yet - report raw position
          updateResult({ position: point, accuracy });
        }
      },
      (err) => {
        console.error("[StabilizedLocation] Geolocation error", err);
        updateResult({
          status: "error",
          error:
            err.code === 1
              ? "Location permission denied."
              : "Unable to get location.",
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [updateResult]);

  return result;
}
