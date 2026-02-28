"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { GeoPoint } from "@oborah/geo";
import { calculateLocalCartesianOffset, offsetGeoPoint } from "@oborah/geo";
import type { CalibrationOffset } from "@/stores/use-ar-session-store";

export interface SensorFusionResult {
  /** The filtered cartesian offset (X, Z) relative to the stabilized origin */
  estimatedOffset: { x: number; z: number };
  /** The filtered global geographical coordinate (LatLng) */
  globalPosition: GeoPoint | null;
  /** Low-passed compass heading */
  heading: number;
  /** Drift confidence logic (1.0 = good, 0 = drifted too far) */
  confidence: number;
  headingRef: React.MutableRefObject<number>;
  hasInitialized: React.MutableRefObject<boolean>;
}

interface SensorFusionOptions {
  enabled: boolean;
  stabilizedOrigin: GeoPoint | null;
  calibrationOffset: CalibrationOffset;
  onDriftExceeded: () => void;
}

// EXTENDED KALMAN FILTER (EKF) TUNING CONSTANTS
// Tweak these if the AR models slide too much or jitter
// ----------------------------------------------------
/** Measurement Noise ($R$) Multiplier: How much we trust the GPS `accuracy` param.
 * By setting this extremely high (25.0) for a pure GPS tracker, we force the Kalman Filter
 * to act as a sluggish low-pass filter. Random GPS jumps of 2-5 meters are almost entirely ignored,
 * which fixes "couch drifting". The tradeoff is a 1-2 second lag when you actually start walking. */
const GPS_NOISE_MULTIPLIER = 25.0;

// Drift Confidence
const DIVERGENCE_MAX = 15; // meters at which confidence = 0
const CONFIDENCE_THRESHOLD = 0.3;

/**
 * 2D Kalman Filter for pure GPS observation smoothing.
 */
class EKF2D {
  // State Vector: [PosX, PosZ]
  public x: number = 0;
  public z: number = 0;

  // Covariance Matrix (Uncertainty) - Simplified as independent variances for speed
  public p_x: number = 1;
  public p_z: number = 1;

  updateGPS(measX: number, measZ: number, measAccuracy: number) {
    // Measurement noise based on GPS API
    const r = measAccuracy * measAccuracy * GPS_NOISE_MULTIPLIER;

    // Kalman Gains
    const k_x = this.p_x / (this.p_x + r);
    const k_z = this.p_z / (this.p_z + r);

    // Update State (Blend inner IMU track with true GPS)
    this.x = this.x + k_x * (measX - this.x);
    this.z = this.z + k_z * (measZ - this.z);

    // Note: We don't directly update velocity from GPS jumps, we let the IMU control velocity.

    // Update Covariance (Uncertainty shrinks as we saw real GPS)
    // We floor p_x/p_z to a small minimum (e.g. 0.5) so the filter doesn't become totally
    // rigid and stop tracking real walking movements over time.
    this.p_x = Math.max(0.5, (1 - k_x) * this.p_x);
    this.p_z = Math.max(0.5, (1 - k_z) * this.p_z);
  }
}

export function useSensorFusion({
  enabled,
  stabilizedOrigin,
  calibrationOffset,
  onDriftExceeded,
}: SensorFusionOptions): SensorFusionResult {
  const [result, setResult] = useState<SensorFusionResult>({
    estimatedOffset: { x: 0, z: 0 },
    globalPosition: null,
    heading: 0,
    confidence: 1,
    headingRef: { current: 0 },
    hasInitialized: { current: false },
  });

  // EKF state
  const ekfRef = useRef<EKF2D>(new EKF2D());
  const confidenceRef = useRef(1);

  // Time tracking
  const lastAccelTime = useRef<number>(0);

  // Compass low-pass filter (sin/cos to handle wraparound)
  const headingRef = useRef(0);
  const compassSin = useRef(0);
  const compassCos = useRef(1);
  const compassInitialized = useRef(false);

  // Ensure refs are in initial result
  useEffect(() => {
    setResult((prev) => ({
      ...prev,
      headingRef,
      hasInitialized: compassInitialized,
    }));
  }, []);

  // Drift callback ref to avoid stale closures
  const onDriftExceededRef = useRef(onDriftExceeded);
  useEffect(() => {
    onDriftExceededRef.current = onDriftExceeded;
  }, [onDriftExceeded]);

  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Compass handler (Independent low-pass filter)
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    let heading: number | null = null;
    const webkitEvent = e as unknown as { webkitCompassHeading?: number };

    if (webkitEvent.webkitCompassHeading !== undefined) {
      heading = webkitEvent.webkitCompassHeading;
    } else if (e.absolute && e.alpha !== null) {
      heading = (360 - e.alpha) % 360;
    }

    if (heading === null) return;

    const headingRad = (heading * Math.PI) / 180;
    if (!compassInitialized.current) {
      compassInitialized.current = true;
      compassSin.current = Math.sin(headingRad);
      compassCos.current = Math.cos(headingRad);
    } else {
      const alpha = 0.15; // Mild low pass
      compassSin.current =
        compassSin.current * (1 - alpha) + Math.sin(headingRad) * alpha;
      compassCos.current =
        compassCos.current * (1 - alpha) + Math.cos(headingRad) * alpha;
    }

    headingRef.current =
      ((Math.atan2(compassSin.current, compassCos.current) * 180) / Math.PI +
        360) %
      360;
  }, []);

  // 2. GPS (EKF Update Phase)
  const applyGpsCorrection = useCallback(
    (gpsPoint: GeoPoint, accuracy: number) => {
      if (!stabilizedOrigin) return;

      const gpsLocal = calculateLocalCartesianOffset(
        stabilizedOrigin,
        gpsPoint,
      );
      const gpsCalibrated = {
        x: gpsLocal.x + calibrationOffset.x,
        z: gpsLocal.z + calibrationOffset.z,
      };

      const ekf = ekfRef.current;
      ekf.updateGPS(gpsCalibrated.x, gpsCalibrated.z, accuracy);

      // Drift computation (if IMU drifts > 15m from the GPS)
      const divergence = Math.sqrt(
        (gpsCalibrated.x - ekf.x) ** 2 + (gpsCalibrated.z - ekf.z) ** 2,
      );
      confidenceRef.current = Math.max(0, 1 - divergence / DIVERGENCE_MAX);

      // If we don't have IMU (which is ALWAYS true now, since it is pure GPS),
      // the confidence decays instantly when divergence is high, relying entirely on GPS pings
      confidenceRef.current *= 0.9;
      // Snap EKF to GPS instantly
      ekf.x = gpsCalibrated.x;
      ekf.z = gpsCalibrated.z;

      if (confidenceRef.current < CONFIDENCE_THRESHOLD) {
        onDriftExceededRef.current();
      }
    },
    [stabilizedOrigin, calibrationOffset],
  );

  // Event hookups
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener(
      "deviceorientationabsolute",
      handleOrientation as EventListener,
    );
    window.addEventListener("deviceorientation", handleOrientation);

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

    // Push EKF state to React tree at 30fps for smooth AR feeling
    updateIntervalRef.current = setInterval(() => {
      const ekf = ekfRef.current;

      let globalPos: GeoPoint | null = null;
      if (stabilizedOrigin) {
        // Reverse the EKF's X/Z tracking back into LatLng using the origin and the AR calibration
        const calibratedX = ekf.x - calibrationOffset.x;
        const calibratedZ = ekf.z - calibrationOffset.z;
        globalPos = offsetGeoPoint(stabilizedOrigin, calibratedX, calibratedZ);
      }

      setResult((prev) => ({
        ...prev,
        estimatedOffset: { x: ekf.x, z: ekf.z },
        globalPosition: globalPos,
        heading: headingRef.current,
        confidence: confidenceRef.current,
      }));
    }, 1000 / 30);

    return () => {
      window.removeEventListener(
        "deviceorientationabsolute",
        handleOrientation as EventListener,
      );
      window.removeEventListener("deviceorientation", handleOrientation);
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
    };
  }, [
    enabled,
    handleOrientation,
    applyGpsCorrection,
    stabilizedOrigin,
    calibrationOffset,
  ]);

  // Reset EKF on re-enable
  useEffect(() => {
    if (enabled) {
      ekfRef.current = new EKF2D();
      confidenceRef.current = 1;
      compassInitialized.current = false;
      lastAccelTime.current = 0;
    }
  }, [enabled]);

  return result;
}
