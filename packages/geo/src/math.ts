import { type GeoPoint } from "./index";

// Earth's radius in meters
const EARTH_RADIUS = 6371000;

/**
 * Calculates the local Cartesian coordinates (x, z in meters) of a target 
 * GPS point relative to an origin GPS point.
 * 
 * Uses an equirectangular approximation which is valid for small distances 
 * (like AR gardens/objects) instead of full Haversine to save computations.
 * 
 * - X is East/West (lng)
 * - Z is North/South (lat, negative is North in Three.js) 
 */
export function calculateLocalCartesianOffset(
  origin: GeoPoint,
  target: GeoPoint
): { x: number; z: number } {
  // Convert lat/lng diffs to radians
  const dLat = ((target.lat - origin.lat) * Math.PI) / 180;
  const dLng = ((target.lng - origin.lng) * Math.PI) / 180;
  
  const originLatRad = (origin.lat * Math.PI) / 180;

  // Local flat earth approximation
  const x = EARTH_RADIUS * dLng * Math.cos(originLatRad);
  const z = EARTH_RADIUS * dLat;

  // In Three.js: 
  // +X is East, -X is West
  // -Z is North, +Z is South
  // Since our map uses standard geographic coordinates:
  // dLng > 0 means Target is East of Origin (+X)
  // dLat > 0 means Target is North of Origin (-Z)
  return {
    x: x, 
    z: -z 
  };
}
