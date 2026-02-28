import { type GeoPoint, type TimestampedGeoPoint } from "./index";

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

/**
 * Haversine distance between two GeoPoints in meters.
 */
export function distanceBetween(a: GeoPoint, b: GeoPoint): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const aLatRad = (a.lat * Math.PI) / 180;
  const bLatRad = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLatRad) * Math.cos(bLatRad) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

/**
 * Initial bearing from point `a` to point `b` in degrees (0-360, clockwise from North).
 */
export function bearingBetween(a: GeoPoint, b: GeoPoint): number {
  const aLatRad = (a.lat * Math.PI) / 180;
  const bLatRad = (b.lat * Math.PI) / 180;
  const dLngRad = ((b.lng - a.lng) * Math.PI) / 180;

  const y = Math.sin(dLngRad) * Math.cos(bLatRad);
  const x =
    Math.cos(aLatRad) * Math.sin(bLatRad) -
    Math.sin(aLatRad) * Math.cos(bLatRad) * Math.cos(dLngRad);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Arithmetic mean centroid of a cluster of GeoPoints.
 * Only suitable for small-area clusters (same locality).
 */
export function geoCentroid(points: GeoPoint[]): GeoPoint {
  if (points.length === 0) {
    throw new Error("geoCentroid requires at least one point");
  }
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/**
 * Inverse of calculateLocalCartesianOffset: given an origin and east/north meter
 * displacements, compute the resulting GeoPoint.
 */
export function offsetGeoPoint(
  origin: GeoPoint,
  eastMeters: number,
  northMeters: number,
): GeoPoint {
  const originLatRad = (origin.lat * Math.PI) / 180;

  const dLat = northMeters / EARTH_RADIUS;
  const dLng = eastMeters / (EARTH_RADIUS * Math.cos(originLatRad));

  return {
    lat: origin.lat + (dLat * 180) / Math.PI,
    lng: origin.lng + (dLng * 180) / Math.PI,
  };
}

/**
 * Speed in m/s between two timestamped GeoPoints.
 */
export function speedBetween(
  a: TimestampedGeoPoint,
  b: TimestampedGeoPoint,
): number {
  const dt = Math.abs(b.timestamp - a.timestamp) / 1000; // ms -> s
  if (dt === 0) return 0;
  return distanceBetween(a, b) / dt;
}
