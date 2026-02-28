"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { GeoPoint } from "@oborah/geo";
import { distanceBetween } from "@oborah/geo";

export type StabilizationStatus = "acquiring" | "tracking" | "error";

export interface StabilizedLocation {
  position: GeoPoint | null;
  /** The uncertainty of our Kalman filter estimate in meters. */
  accuracy: number | null;
  status: StabilizationStatus;
  error: string | null;
}

// Optimization Constants
const MIN_ACCURACY = 20; // meters - absolutely discard raw readings worse than this
const OUTLIER_SPEED_THRESHOLD = 7; // m/s - discard points implying physically impossible speed

// Kalman Filter Constants
const PROCESS_NOISE_Q = 0.5; // Estimated meters/sec the user might actually move

class KalmanFilter2D {
  public lat: number;
  public lng: number;
  public uncertainty: number; // P (covariance / variance)

  constructor(initialLat: number, initialLng: number, initialAccuracy: number) {
    this.lat = initialLat;
    this.lng = initialLng;
    this.uncertainty = initialAccuracy * initialAccuracy;
  }

  predict(dtInSeconds: number) {
    this.uncertainty += PROCESS_NOISE_Q * PROCESS_NOISE_Q * dtInSeconds;
  }

  update(measLat: number, measLng: number, measAccuracy: number) {
    const measurementNoiseR = measAccuracy * measAccuracy;
    const kalmanGain =
      this.uncertainty / (this.uncertainty + measurementNoiseR);

    this.lat = this.lat + kalmanGain * (measLat - this.lat);
    this.lng = this.lng + kalmanGain * (measLng - this.lng);

    this.uncertainty = (1 - kalmanGain) * this.uncertainty;
  }
}

export function useStabilizedLocation(): StabilizedLocation {
  const isSupported =
    typeof navigator !== "undefined" && "geolocation" in navigator;

  const [result, setResult] = useState<StabilizedLocation>({
    position: null,
    accuracy: null,
    status: isSupported ? "acquiring" : "error",
    error: isSupported ? null : "Geolocation is not supported by your browser.",
  });

  const updateResult = useCallback((patch: Partial<StabilizedLocation>) => {
    setResult((prev) => {
      const needsUpdate = Object.keys(patch).some(
        (k) =>
          patch[k as keyof StabilizedLocation] !==
          prev[k as keyof StabilizedLocation],
      );
      return needsUpdate ? { ...prev, ...patch } : prev;
    });
  }, []);

  const kalmanRef = useRef<KalmanFilter2D | null>(null);
  const lastUpdateMs = useRef<number>(0);
  const lastRawPoint = useRef<GeoPoint | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const now = pos.timestamp || Date.now();

        // 1. Discard readings with terrible accuracy
        if (accuracy > MIN_ACCURACY) {
          console.log(
            `[GPS] Dropping: accuracy ${accuracy.toFixed(1)}m > ${MIN_ACCURACY}m`,
          );
          return;
        }

        const newPoint = { lat: latitude, lng: longitude };

        // 2. Initialize Kalman on first valid reading
        if (!kalmanRef.current || !lastRawPoint.current) {
          kalmanRef.current = new KalmanFilter2D(latitude, longitude, accuracy);
          lastUpdateMs.current = now;
          lastRawPoint.current = newPoint;

          updateResult({
            position: newPoint,
            accuracy: accuracy,
            status: "tracking",
          });
          return;
        }

        const dtSec = (now - lastUpdateMs.current) / 1000;
        if (dtSec <= 0) return;

        // 3. Outlier rejection — impossible speed between consecutive raw pings
        const distFromLastRaw = distanceBetween(lastRawPoint.current, newPoint);
        const impliedSpeed = distFromLastRaw / dtSec;

        if (impliedSpeed > OUTLIER_SPEED_THRESHOLD) {
          console.log(
            `[GPS] Outlier rejected: ${impliedSpeed.toFixed(1)} m/s (${distFromLastRaw.toFixed(1)}m)`,
          );
          return;
        }

        // 4. Kalman Predict & Update
        const kf = kalmanRef.current;
        kf.predict(dtSec);
        kf.update(latitude, longitude, accuracy);

        lastUpdateMs.current = now;
        lastRawPoint.current = newPoint;

        const filteredPoint = { lat: kf.lat, lng: kf.lng };
        const filteredAccuracy = Math.sqrt(kf.uncertainty);

        // 5. Always push the live Kalman output — never freeze
        updateResult({
          position: filteredPoint,
          accuracy: filteredAccuracy,
          status: "tracking",
        });
      },
      (err) => {
        console.error("[GPS] Geolocation error", err);
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
