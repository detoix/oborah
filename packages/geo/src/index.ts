export * from "./math";

export type GeoPoint = {
  lng: number;
  lat: number;
};

export type TimestampedGeoPoint = GeoPoint & {
  timestamp: number;
  accuracy?: number;
};

export type GeoCenter = GeoPoint;

export type ClientPoint = {
  clientX: number;
  clientY: number;
};
