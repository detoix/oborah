import React from "react";

export function DesignLayer() {
  return (
    <mesh position={[0, 0, 18]}>
      <boxGeometry args={[20, 20, 20]} />
      <meshStandardMaterial color="#ff4da6" />
    </mesh>
  );
}
