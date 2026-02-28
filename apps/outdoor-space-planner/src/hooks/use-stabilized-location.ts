"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { GeoPoint } from "@oborah/geo";
import { distanceBetween } from "@oborah/geo";

export type StabilizationStatus = "acquiring" | "tracking" | "error";

export interface StabilizedLocation {
  position: GeoPoint | null;
  /** Is stationary means our physical speed has dropped below a threshold and the position is visually "frozen" to prevent micro-jitter. */
  isStationary: boolean;
  /** The uncertainty of our Kalman filter estimate in meters. */
  accuracy: number | null;
  status: StabilizationStatus;
  error: string | null;
}

// Optimization Constants
const MIN_ACCURACY = 20; // meters - absolutely discard raw readings worse than this
const OUTLIER_SPEED_THRESHOLD = 7; // m/s (approx 15 mph) - discard points implying physically impossible human sprinting
const STATIONARY_SPEED_THRESHOLD = 0.3; // m/s - speed at which we consider the user physically stopped
const VISUAL_FREEZE_RADIUS = 0.5; // meters - do not update the visual output if the Kalman state moves less than this while stationary

// Kalman Filter Constants
const PROCESS_NOISE_Q = 0.5; // Estimated meters/sec the user actually moves (small because users walk slowly in AR)

class KalmanFilter2D {
  public lat: number;
  public lng: number;
  public uncertainty: number; // P (covariance / var)

  constructor(initialLat: number, initialLng: number, initialAccuracy: number) {
    this.lat = initialLat;
    this.lng = initialLng;
    // Initial uncertainty is the accuracy of the first point squared (variance)
    this.uncertainty = initialAccuracy * initialAccuracy;
  }

  /**
   * Predict the next state (dead reckoning).
   * Since we don't have velocity input here (pure GPS), our prediction is simply that we stay still,
   * but our uncertainty GROWS over time according to the process noise Q.
   */
  predict(dtInSeconds: number) {
    // We assume the user might have walked Q meters per second randomly.
    this.uncertainty += PROCESS_NOISE_Q * PROCESS_NOISE_Q * dtInSeconds;
  }

  /**
   * Update the model with a new GPS measurement
   */
  update(measLat: number, measLng: number, measAccuracy: number) {
    // Measurement noise R is the reported GPS accuracy squared (variance)
    const measurementNoiseR = measAccuracy * measAccuracy;

    // Calculate Kalman Gain (K)
    // K = Uncertainty / (Uncertainty + MeasurementNoise)
    // If measurement is very accurate (R is tiny), K approaches 1 (trust measurement).
    // If measurement is very bad (R is huge), K approaches 0 (trust internal state).
    const kalmanGain =
      this.uncertainty / (this.uncertainty + measurementNoiseR);

    // Update position
    this.lat = this.lat + kalmanGain * (measLat - this.lat);
    this.lng = this.lng + kalmanGain * (measLng - this.lng);

    // Update uncertainty (it shrinks after a measurement)
    this.uncertainty = (1 - kalmanGain) * this.uncertainty;
  }
}

export function useStabilizedLocation(): StabilizedLocation {
  const isSupported =
    typeof navigator !== "undefined" && "geolocation" in navigator;

  const [result, setResult] = useState<StabilizedLocation>({
    position: null,
    isStationary: false,
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

  // Internal high-frequency state (no re-renders)
  const kalmanRef = useRef<KalmanFilter2D | null>(null);
  const lastUpdateMs = useRef<number>(0);
  const lastRawPoint = useRef<GeoPoint | null>(null);

  // Velocity tracking
  const currentSpeed = useRef<number>(0);
  const isPhysicallyStationary = useRef<boolean>(false);

  // Visual output locking (to prevent micro-jitters when stationary)
  const lockedOutputPoint = useRef<GeoPoint | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const now = pos.timestamp || Date.now();

        // 1. Initial Gate - Absolute Garbage Rejection
        if (accuracy > MIN_ACCURACY) {
          console.log(
            `[Kalman] Dropping point: Accuracy ${accuracy.toFixed(1)}m > ${MIN_ACCURACY}m`,
          );
          return;
        }

        const newPoint = { lat: latitude, lng: longitude };

        // 2. Initialize Kalman if needed
        if (!kalmanRef.current || !lastRawPoint.current) {
          kalmanRef.current = new KalmanFilter2D(latitude, longitude, accuracy);
          lastUpdateMs.current = now;
          lastRawPoint.current = newPoint;
          lockedOutputPoint.current = newPoint;

          updateResult({
            position: newPoint,
            isStationary: true,
            accuracy: accuracy,
            status: "tracking", // Skip the complex "waiting->stabilizing->anchored" phase
          });
          return;
        }

        const dtSec = (now - lastUpdateMs.current) / 1000;
        if (dtSec <= 0) return; // Ignore duplicate timestamps

        // 3. Outlier / Velocity Gating
        const distFromLastRaw = distanceBetween(lastRawPoint.current, newPoint);
        const impliedSpeed = distFromLastRaw / dtSec;

        if (impliedSpeed > OUTLIER_SPEED_THRESHOLD) {
          // The raw GPS jumped so far, so fast, it is likely impossible a human walked it.
          // e.g. a multipath reflection. We reject it entirely so it doesn't pollute the Kalman filter.
          console.log(
            `[Kalman] Outlier rejected: Implied speed ${impliedSpeed.toFixed(1)} m/s (Distance: ${distFromLastRaw.toFixed(1)}m)`,
          );

          // Note: If we stay rejected for many seconds, we might actually be on a bike/car.
          // But for an AR walking app, we assume rejecting is correct.
          return;
        }

        // Update basic speed tracking (exponential moving average of speed)
        currentSpeed.current = currentSpeed.current * 0.7 + impliedSpeed * 0.3;
        isPhysicallyStationary.current =
          currentSpeed.current < STATIONARY_SPEED_THRESHOLD;

        // 4. Kalman Predict & Update
        const kf = kalmanRef.current;
        kf.predict(dtSec);
        kf.update(latitude, longitude, accuracy);

        lastUpdateMs.current = now;
        lastRawPoint.current = newPoint;

        const filteredPoint = { lat: kf.lat, lng: kf.lng };
        const filteredAccuracy = Math.sqrt(kf.uncertainty); // Convert variance back to std dev (meters)

        // 5. Visual Output Stabilization (Deadband for locked output ONLY when stationary)
        let finalOutputPoint = filteredPoint;

        if (isPhysicallyStationary.current) {
          // If we are mostly standing still, prevent micro-jitters
          if (lockedOutputPoint.current) {
            const distFromLock = distanceBetween(
              lockedOutputPoint.current,
              filteredPoint,
            );
            if (distFromLock < VISUAL_FREEZE_RADIUS) {
              // We haven't drifted far enough from our locked visual point to warrant an update.
              // Note: The Kalman filter internal state CONTINUES to update/smooth in the background.
              finalOutputPoint = lockedOutputPoint.current;
            } else {
              // The Kalman filter has converged firmly on a new spot, unlock and shift.
              lockedOutputPoint.current = filteredPoint;
            }
          } else {
            lockedOutputPoint.current = filteredPoint;
          }
        } else {
          // We are walking, immediately emit the fluid Kalman output
          lockedOutputPoint.current = filteredPoint; // Continuously slide the lock
        }

        // 6. Push to React State
        updateResult({
          position: finalOutputPoint,
          isStationary: isPhysicallyStationary.current,
          accuracy: filteredAccuracy,
          status: "tracking",
        });
      },
      (err) => {
        console.error("[Kalman] Geolocation error", err);
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
