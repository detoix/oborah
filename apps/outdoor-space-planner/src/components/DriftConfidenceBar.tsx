"use client";

import React from "react";

interface DriftConfidenceBarProps {
  confidence: number;
  onRecalibrate: () => void;
}

export function DriftConfidenceBar({
  confidence,
  onRecalibrate,
}: DriftConfidenceBarProps) {
  const clampedConfidence = Math.max(0, Math.min(1, confidence));
  const percentage = clampedConfidence * 100;

  const color =
    clampedConfidence > 0.7
      ? "bg-green-500"
      : clampedConfidence > 0.4
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="absolute bottom-36 left-4 right-4 z-30">
      {clampedConfidence < 0.3 && (
        <div className="flex justify-center mb-2">
          <button
            onClick={onRecalibrate}
            className="px-4 py-2 bg-red-600 text-white rounded-full text-xs font-bold shadow-lg animate-pulse active:scale-95 transition-transform"
          >
            Stop to Recalibrate
          </button>
        </div>
      )}
      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
