"use client";

import { useState } from "react";
import MapGL from "react-map-gl/maplibre";
import { Canvas } from "react-three-map/maplibre";
import { Protocol } from "pmtiles";
import maplibregl from "maplibre-gl";
import { layers, namedFlavor } from "@protomaps/basemaps";
import "maplibre-gl/dist/maplibre-gl.css";
import PhotonGeocoderControl, {
  type PhotonGeocoderControlProps,
} from "./PhotonGeocoderControl";

// We need to register the PMTiles protocol with MapLibre
let pmtilesProtocolRegistered = false;
let pmtilesProtocolInstance: Protocol | null = null;

const INITIAL_VIEW_STATE = {
  longitude: 19.945,
  latitude: 50.0647,
  zoom: 13,
  pitch: 55,
  bearing: -20,
};

const BASEMAP_LAYERS = layers("protomaps", namedFlavor("light"), {
  lang: "en",
});

const MAP_STYLE = {
  version: 8,
  glyphs:
    "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  // Protomaps basemap symbol layers reference sprite icons (POIs, shields, etc.)
  sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
  sources: {
    protomaps: {
      type: "vector",
      url: "pmtiles:///krakow.pmtiles",
      attribution: "Protomaps © OpenStreetMap",
    },
  },
  layers: [
    ...BASEMAP_LAYERS,
    {
      id: "buildings-3d",
      source: "protomaps",
      "source-layer": "buildings",
      type: "fill-extrusion",
      minzoom: 12,
      paint: {
        "fill-extrusion-color": "#d8d8d8",
        "fill-extrusion-height": [
          "case",
          ["has", "height"],
          ["to-number", ["get", "height"]],
          ["has", "render_height"],
          ["to-number", ["get", "render_height"]],
          5, // Default to 5 meters if height properties are entirely missing
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
      },
    },
  ],
} as maplibregl.StyleSpecification;

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
  onMapInstance?: (map: maplibregl.Map) => void;
  interactive?: boolean;
  onMapClick?: (coords: { lng: number; lat: number }) => void;
};

export default function Map({
  geocoder = null,
  children,
  onMapInstance,
  interactive = true,
  onMapClick,
}: MapProps) {
  ensurePmtilesProtocol();
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

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
          setMapInstance(map);
          onMapInstance?.(map);
        }}
        onClick={(event) => {
          onMapClick?.({ lng: event.lngLat.lng, lat: event.lngLat.lat });
        }}
      >
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
          latitude={INITIAL_VIEW_STATE.latitude}
          longitude={INITIAL_VIEW_STATE.longitude}
          gl={{ preserveDrawingBuffer: true }}
        >
          {children}
        </Canvas>
      </MapGL>
    </div>
  );
}
