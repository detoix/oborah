"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export interface CompassResult {
  /** Low-passed compass heading (degrees, clockwise from North) */
  heading: number;
  headingRef: React.MutableRefObject<number>;
  hasInitialized: React.MutableRefObject<boolean>;
}

/**
 * Pure compass hook. No GPS, no Kalman filter.
 * Returns a smoothed heading via a sin/cos low-pass filter to handle wraparound.
 */
export function useCompass(enabled: boolean): CompassResult {
  const headingRef = useRef(0);
  const compassSin = useRef(0);
  const compassCos = useRef(1);
  const compassInitialized = useRef(false);

  const [result, setResult] = useState<CompassResult>({
    heading: 0,
    headingRef: { current: 0 },
    hasInitialized: { current: false },
  });

  // Ensure refs are in the result object
  useEffect(() => {
    setResult((prev) => ({
      ...prev,
      headingRef,
      hasInitialized: compassInitialized,
    }));
  }, []);

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

  // Push heading to React state at 30fps
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener(
      "deviceorientationabsolute",
      handleOrientation as EventListener,
    );
    window.addEventListener("deviceorientation", handleOrientation);

    updateIntervalRef.current = setInterval(() => {
      setResult((prev) => ({
        ...prev,
        heading: headingRef.current,
      }));
    }, 1000 / 30);

    return () => {
      window.removeEventListener(
        "deviceorientationabsolute",
        handleOrientation as EventListener,
      );
      window.removeEventListener("deviceorientation", handleOrientation);
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
    };
  }, [enabled, handleOrientation]);

  // Reset on re-enable
  useEffect(() => {
    if (enabled) {
      compassInitialized.current = false;
    }
  }, [enabled]);

  return result;
}
