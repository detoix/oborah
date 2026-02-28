"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapGL, {
  Layer,
  Source,
  GeolocateControl,
  Marker,
} from "react-map-gl/maplibre";
import { Canvas } from "react-three-map/maplibre";
import { Protocol } from "pmtiles";
import maplibregl from "maplibre-gl";
import type { ClientPoint, GeoCenter, GeoPoint } from "@oborah/geo";
import "maplibre-gl/dist/maplibre-gl.css";
import PhotonGeocoderControl, {
  type PhotonGeocoderControlProps,
} from "./PhotonGeocoderControl";

let pmtilesProtocolRegistered = false;
let pmtilesProtocolInstance: Protocol | null = null;

export type MapViewState = {
  center: GeoCenter;
  zoom: number;
  pitch: number;
  bearing: number;
};

export type MapApi = {
  getCenter: () => GeoCenter | null;
  screenToLngLat: (point: ClientPoint) => GeoPoint | null;
  flyTo: (opts: { center: [number, number]; zoom?: number }) => void;
  resize: () => void;
};

const INITIAL_VIEW_STATE = {
  longitude: 19.945,
  latitude: 50.0647,
  zoom: 13,
  pitch: 55,
  bearing: 0,
};

const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

function ensurePmtilesProtocol() {
  if (typeof window === "undefined" || pmtilesProtocolRegistered) {
    return;
  }

  pmtilesProtocolInstance ??= new Protocol();
  maplibregl.addProtocol("pmtiles", pmtilesProtocolInstance.tile);
  pmtilesProtocolRegistered = true;
}

export type MapProps = {
  geocoder?:
    | ({
        provider: "photon";
      } & Omit<PhotonGeocoderControlProps, "map">)
    | null;
  children?: React.ReactNode;
  onMapReady?: (api: MapApi) => void;
  interactive?: boolean;
  onMapClick?: (coords: GeoPoint) => void;
  onCanvasPointerMissed?: (event: MouseEvent) => void;
  interactiveLayerIds?: string[];
  onViewChange?: (view: MapViewState) => void;
  userLocation?: { lng: number; lat: number; accuracy: number } | null;
  enableUserLocationAnchor?: boolean;
  userLocationAnchor?: GeoPoint | null;
  onUserLocationAnchorCreate?: (location: GeoPoint) => void;
  onUserLocationAnchorChange?: (location: GeoPoint) => void;
};

export default function Map({
  geocoder = null,
  children,
  onMapReady,
  interactive = true,
  onMapClick,
  onCanvasPointerMissed,
  interactiveLayerIds,
  onViewChange,
  userLocation: userLocationProp,
  enableUserLocationAnchor = false,
  userLocationAnchor = null,
  onUserLocationAnchorCreate,
  onUserLocationAnchorChange,
}: MapProps) {
  ensurePmtilesProtocol();
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [internalLocation, setInternalLocation] = useState<{
    lng: number;
    lat: number;
    accuracy: number;
  } | null>(null);

  useEffect(() => {
    // Skip internal GPS watcher when an external stabilized location is provided
    if (userLocationProp !== undefined) return;
    if (typeof window === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setInternalLocation({
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => console.error("Map geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [userLocationProp !== undefined]);

  const userLocation =
    userLocationProp !== undefined ? userLocationProp : internalLocation;
  const [canvasCenter, setCanvasCenter] = useState({
    longitude: INITIAL_VIEW_STATE.longitude,
    latitude: INITIAL_VIEW_STATE.latitude,
  });
  const mapApi = useMemo<MapApi>(
    () => ({
      getCenter: () => {
        const center = mapRef.current?.getCenter();
        if (!center) return null;
        return { lng: center.lng, lat: center.lat };
      },
      screenToLngLat: ({ clientX, clientY }) => {
        const map = mapRef.current;
        if (!map) return null;
        const rect = map.getCanvas().getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const lngLat = map.unproject([x, y]);
        return { lng: lngLat.lng, lat: lngLat.lat };
      },
      flyTo: (opts) => {
        mapRef.current?.flyTo(opts);
      },
      resize: () => {
        mapRef.current?.resize();
      },
    }),
    [],
  );

  const syncViewFromMap = useCallback(
    (map: maplibregl.Map) => {
      const center = map.getCenter();
      const next = { longitude: center.lng, latitude: center.lat };
      setCanvasCenter((prev) =>
        prev.longitude === next.longitude && prev.latitude === next.latitude
          ? prev
          : next,
      );
      onViewChange?.({
        center: { lng: next.longitude, lat: next.latitude },
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      });
    },
    [onViewChange],
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        backgroundColor: "#fff",
      }}
    >
      <MapGL
        initialViewState={INITIAL_VIEW_STATE}
        style={{ width: "100%", height: "100%", backgroundColor: "white" }}
        attributionControl={false}
        interactiveLayerIds={interactiveLayerIds}
        dragPan={interactive}
        dragRotate={interactive}
        scrollZoom={interactive}
        touchZoomRotate={interactive}
        canvasContextAttributes={{
          antialias: true,
          preserveDrawingBuffer: true,
        }}
        mapStyle={MAP_STYLE}
        onLoad={(event) => {
          const map = event.target as maplibregl.Map;
          mapRef.current = map;
          setMapInstance(map);
          syncViewFromMap(map);
          onMapReady?.(mapApi);
        }}
        onMoveEnd={(event) => {
          syncViewFromMap(event.target as maplibregl.Map);
        }}
        onClick={(event) => {
          onMapClick?.({ lng: event.lngLat.lng, lat: event.lngLat.lat });
        }}
      >
        <GeolocateControl position="bottom-right" trackUserLocation={true} />

        {userLocation && (
          <>
            <Source
              id="user-accuracy"
              type="geojson"
              data={{
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [userLocation.lng, userLocation.lat],
                },
                properties: {},
              }}
            >
              <Layer
                id="user-accuracy-layer"
                type="circle"
                paint={{
                  "circle-radius": [
                    "interpolate",
                    ["exponential", 2],
                    ["zoom"],
                    0,
                    0,
                    20,
                    userLocation.accuracy, // This is an approximation since circle-radius is in pixels, but for debugging it helps
                  ],
                  "circle-color": "#007cbf",
                  "circle-opacity": 0.15,
                  "circle-stroke-width": 1,
                  "circle-stroke-color": "#007cbf",
                }}
              />
            </Source>
            <Marker
              longitude={userLocation.lng}
              latitude={userLocation.lat}
              anchor="center"
            >
              <button
                type="button"
                aria-label={
                  enableUserLocationAnchor
                    ? "Create draggable AR position marker"
                    : "Current GPS position"
                }
                onClick={(event) => {
                  event.stopPropagation();
                  if (!enableUserLocationAnchor) return;
                  onUserLocationAnchorCreate?.({
                    lng: userLocation.lng,
                    lat: userLocation.lat,
                  });
                }}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "9999px",
                  border: "none",
                  background: "transparent",
                  cursor: enableUserLocationAnchor ? "pointer" : "default",
                  pointerEvents: "auto",
                  display: "grid",
                  placeItems: "center",
                  padding: 0,
                }}
              >
                <span
                  style={{
                    width: enableUserLocationAnchor ? 10 : 14,
                    height: enableUserLocationAnchor ? 10 : 14,
                    borderRadius: "9999px",
                    border: "2px solid white",
                    background: "#007cbf",
                    opacity: enableUserLocationAnchor ? 0.72 : 1,
                    boxShadow: enableUserLocationAnchor
                      ? "0 0 0 6px rgba(0,124,191,0.14)"
                      : "0 0 0 4px rgba(0,124,191,0.25)",
                  }}
                />
              </button>
            </Marker>
          </>
        )}

        {enableUserLocationAnchor && userLocationAnchor && (
          <Marker
            longitude={userLocationAnchor.lng}
            latitude={userLocationAnchor.lat}
            draggable={true}
            anchor="center"
            onDragEnd={(event) => {
              onUserLocationAnchorChange?.({
                lng: event.lngLat.lng,
                lat: event.lngLat.lat,
              });
            }}
          >
            <div
              aria-label="AR anchor marker"
              style={{
                width: 20,
                height: 20,
                borderRadius: "9999px",
                border: "3px solid white",
                background: "#f97316",
                boxShadow:
                  "0 0 0 7px rgba(249,115,22,0.36), 0 0 0 14px rgba(249,115,22,0.15)",
                cursor: "grab",
                pointerEvents: "auto",
              }}
            />
          </Marker>
        )}

        <Source
          id="protomaps"
          type="vector"
          url="pmtiles://https://pub-e9b147ce12714178ac88c0aefdf3b47f.r2.dev/europe_west.pmtiles/europe_west.pmtiles"
        >
          <Layer
            id="buildings-3d"
            type="fill-extrusion"
            source-layer="buildings"
            minzoom={12}
            paint={{
              "fill-extrusion-color": "#d8d8d8",
              "fill-extrusion-height": [
                "case",
                ["has", "height"],
                ["to-number", ["get", "height"]],
                ["has", "render_height"],
                ["to-number", ["get", "render_height"]],
                5,
              ],
              "fill-extrusion-base": [
                "case",
                ["has", "min_height"],
                ["to-number", ["get", "min_height"]],
                ["has", "render_min_height"],
                ["to-number", ["get", "render_min_height"]],
                0,
              ],
              "fill-extrusion-opacity": 0.9,
            }}
          />
        </Source>
        {geocoder?.provider === "photon" ? (
          <PhotonGeocoderControl
            map={mapInstance}
            position={geocoder.position}
            placeholder={geocoder.placeholder}
            endpoint={geocoder.endpoint}
            language={geocoder.language}
            limit={geocoder.limit}
          />
        ) : null}
        <Canvas
          latitude={canvasCenter.latitude}
          longitude={canvasCenter.longitude}
          onPointerMissed={(event) => {
            onCanvasPointerMissed?.(event);
          }}
        >
          {children}
        </Canvas>
      </MapGL>
    </div>
  );
}
