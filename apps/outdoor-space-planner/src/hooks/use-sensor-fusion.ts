"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { GeoPoint } from "@oborah/geo";
import { calculateLocalCartesianOffset } from "@oborah/geo";
import type { CalibrationOffset } from "@/stores/use-ar-session-store";

export interface SensorFusionResult {
  /** The filtered cartesian offset (X, Z) relative to the stabilized origin */
  estimatedOffset: { x: number; z: number };
  /** Low-passed compass heading */
  heading: number;
  /** Drift confidence logic (1.0 = good, 0 = drifted too far) */
  confidence: number;
  usingAccelerometer: boolean;
  headingRef: React.MutableRefObject<number>;
  hasInitialized: React.MutableRefObject<boolean>;
}

interface SensorFusionOptions {
  enabled: boolean;
  stabilizedOrigin: GeoPoint | null;
  calibrationOffset: CalibrationOffset;
  onDriftExceeded: () => void;
}

// ----------------------------------------------------
// EXTENDED KALMAN FILTER (EKF) TUNING CONSTANTS
// Tweak these if the AR models slide too much or jitter
// ----------------------------------------------------
/** Process Noise ($Q$): How much we trust the accelerometer predict step.
 * Higher = we trust the IMU more, Lower = we distrust the IMU and rely on GPS. */
const ACCEL_NOISE_VARIANCE = 0.8;
/** Measurement Noise ($R$) Multiplier: How much we trust the GPS `accuracy` param.
 * Higher = we distrust the GPS and heavily smooth it. */
const GPS_NOISE_MULTIPLIER = 1.5;

// Zero Velocity Update (ZUPT) Constants
/** If accelerometer magnitude is within this range of 9.81m/s^2, we assume the user is physically standing still */
const ZUPT_ACCEL_THRESHOLD = 0.5;
/** How long the user must be "still" before we zero-out the velocity vector */
const ZUPT_TIME_MS = 400;

// Drift Confidence
const DIVERGENCE_MAX = 15; // meters at which confidence = 0
const CONFIDENCE_THRESHOLD = 0.3;

/**
 * 2D Extended Kalman Filter fusing Accelerometer predicting + GPS observing.
 */
class EKF2D {
  // State Vector: [PosX, PosZ, VelX, VelZ]
  public x: number = 0;
  public z: number = 0;
  public vx: number = 0;
  public vz: number = 0;

  // Covariance Matrix (Uncertainty) - Simplified as independent variances for speed
  public p_x: number = 1;
  public p_z: number = 1;
  public p_vx: number = 1;
  public p_vz: number = 1;

  /**
   * Predict Phase (Runs 60Hz from Accelerometer)
   * @param ax Linear acceleration North/East rotated (m/s^2)
   * @param az Linear acceleration North/East rotated (m/s^2)
   * @param dt Delta time in seconds
   */
  predict(ax: number, az: number, dt: number) {
    // 1. State Prediction (Physics Engine)
    // Pos = Pos + Vel*dt + 0.5*Accel*dt^2
    this.x += this.vx * dt + 0.5 * ax * dt * dt;
    this.z += this.vz * dt + 0.5 * az * dt * dt;

    // Vel = Vel + Accel*dt
    this.vx += ax * dt;
    this.vz += az * dt;

    // 2. Covariance Prediction (Uncertainty grows as we dead reckon)
    // Simplified Process Noise Q
    const qPos = 0.5 * dt * dt * ACCEL_NOISE_VARIANCE;
    const qVel = dt * ACCEL_NOISE_VARIANCE;

    this.p_x += qPos;
    this.p_z += qPos;
    this.p_vx += qVel;
    this.p_vz += qVel;
  }

  /**
   * Force velocity to zero (Zero Velocity Update) to prevent IMU drift when standing still.
   */
  applyZUPT() {
    this.vx = 0;
    this.vz = 0;
    // Shrink velocity uncertainty heavily
    this.p_vx *= 0.1;
    this.p_vz *= 0.1;
  }

  /**
   * Update Phase (Runs 1Hz from GPS)
   * @param measX Local Cartesian GPS X offset
   * @param measZ Local Cartesian GPS Z offset
   * @param measAccuracy GPS Reported Accuracy in meters
   * @param isStandingStill Whether ZUPT is currently active (Deep Lock mode)
   */
  updateGPS(
    measX: number,
    measZ: number,
    measAccuracy: number,
    isStandingStill: boolean,
  ) {
    if (isStandingStill) {
      // Outlier rejection during Deep Lock:
      // If the new GPS point is >10m away from our current locked position, ignore it.
      // It is impossible to teleport 10m while standing still.
      const distFromCurrent = Math.sqrt(
        (measX - this.x) ** 2 + (measZ - this.z) ** 2,
      );
      if (distFromCurrent > 10) {
        console.log(
          `[EKF Deep Lock] Rejected outlier GPS bounce: ${distFromCurrent.toFixed(1)}m away`,
        );
        return;
      }
    }

    // Measurement noise based on GPS API
    // If standing still, we inflate the measurement noise by 5x (Deep Lock).
    // This forces the filter to move very, very slowly toward the noisy GPS, mathematically finding the true average center.
    const deepLockMultiplier = isStandingStill ? 5.0 : 1.0;
    const r =
      measAccuracy * measAccuracy * GPS_NOISE_MULTIPLIER * deepLockMultiplier;

    // Kalman Gains
    const k_x = this.p_x / (this.p_x + r);
    const k_z = this.p_z / (this.p_z + r);

    // Update State (Blend inner IMU track with true GPS)
    this.x = this.x + k_x * (measX - this.x);
    this.z = this.z + k_z * (measZ - this.z);

    // Note: We don't directly update velocity from GPS jumps, we let the IMU control velocity.

    // Update Covariance (Uncertainty shrinks as we saw real GPS)
    this.p_x = (1 - k_x) * this.p_x;
    this.p_z = (1 - k_z) * this.p_z;
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
    heading: 0,
    confidence: 1,
    usingAccelerometer: false,
    headingRef: { current: 0 },
    hasInitialized: { current: false },
  });

  // EKF state
  const ekfRef = useRef<EKF2D>(new EKF2D());
  const confidenceRef = useRef(1);
  const hasAccelerometer = useRef(false);

  // Time tracking
  const lastAccelTime = useRef<number>(0);
  const consecutiveQuietFrames = useRef<number>(0);

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

  // 2. Accelerometer (EKF Predict Phase)
  const handleMotion = useCallback(
    (e: DeviceMotionEvent) => {
      if (!enabled) return;

      const accel = e.acceleration; // Phone Linear Acceleration (without gravity!)
      const gravity = e.accelerationIncludingGravity;

      if (
        !accel ||
        accel.x === null ||
        accel.y === null ||
        accel.z === null ||
        !gravity ||
        gravity.x === null ||
        gravity.y === null ||
        gravity.z === null
      ) {
        return;
      }

      hasAccelerometer.current = true;
      const now = performance.now();

      if (lastAccelTime.current === 0) {
        lastAccelTime.current = now;
        return;
      }

      const dt = (now - lastAccelTime.current) / 1000;
      lastAccelTime.current = now;

      // ZUPT Detection (Zero Velocity Update)
      // If the magnitude of the gravity vector is near 9.8 AND linear acceleration is tiny
      const gravMag = Math.sqrt(
        gravity.x ** 2 + gravity.y ** 2 + gravity.z! ** 2,
      );
      const linMag = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);

      if (
        Math.abs(gravMag - 9.81) < ZUPT_ACCEL_THRESHOLD &&
        linMag < ZUPT_ACCEL_THRESHOLD
      ) {
        consecutiveQuietFrames.current += dt * 1000;
      } else {
        consecutiveQuietFrames.current = 0;
      }

      const isStandingStill = consecutiveQuietFrames.current > ZUPT_TIME_MS;

      // Rotate local phone acceleration into World North/East offsets
      // Simplification: We assume the phone is held relatively flat or upright, primarily rotating around Y (heading)
      const headRad = (headingRef.current * Math.PI) / 180;

      // In Three.js AR space:
      // +X is East, -Z is North
      // If phone tilts, we assume Z accel is forward, X is sideways.
      const worldAccelX =
        accel.x * Math.cos(headRad) + accel.z * Math.sin(headRad);
      const worldAccelZ =
        -accel.x * Math.sin(headRad) + accel.z * Math.cos(headRad);

      const ekf = ekfRef.current;
      ekf.predict(worldAccelX, worldAccelZ, dt);

      if (isStandingStill) {
        ekf.applyZUPT();
      }
    },
    [enabled],
  );

  // 3. GPS (EKF Update Phase)
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
      const isStandingStill = consecutiveQuietFrames.current > ZUPT_TIME_MS;
      ekf.updateGPS(
        gpsCalibrated.x,
        gpsCalibrated.z,
        accuracy,
        isStandingStill,
      );

      // Drift computation (if IMU drifts > 15m from the GPS)
      const divergence = Math.sqrt(
        (gpsCalibrated.x - ekf.x) ** 2 + (gpsCalibrated.z - ekf.z) ** 2,
      );
      confidenceRef.current = Math.max(0, 1 - divergence / DIVERGENCE_MAX);

      if (!hasAccelerometer.current) {
        // If we don't have IMU, the confidence decays instantly, relying entirely on GPS
        confidenceRef.current *= 0.9;
        // Without IMU, snap EKF to GPS instantly since predict step is dead
        ekf.x = gpsCalibrated.x;
        ekf.z = gpsCalibrated.z;
        ekf.vx = 0;
        ekf.vz = 0;
      }

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
    window.addEventListener("devicemotion", handleMotion);

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
      setResult((prev) => ({
        ...prev,
        estimatedOffset: { x: ekf.x, z: ekf.z },
        heading: headingRef.current,
        confidence: confidenceRef.current,
        usingAccelerometer: hasAccelerometer.current,
      }));
    }, 1000 / 30);

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
