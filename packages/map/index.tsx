"use client";

import { useEffect, useState } from "react";
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
  console.info("[map-debug] PMTiles protocol registered");
}

export type MapProps = {
  geocoder?:
    | ({
        provider: "photon";
      } & Omit<PhotonGeocoderControlProps, "map">)
    | null;
};

export default function Map({ geocoder = null }: MapProps) {
  ensurePmtilesProtocol();
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    console.info("[map-debug] component mounted", {
      pmtilesUrl: (MAP_STYLE.sources as Record<string, { url?: string }>)
        .protomaps?.url,
      sprite: MAP_STYLE.sprite,
    });

    return () => {
      console.info("[map-debug] component unmounted");
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        backgroundColor: "#fff",
      }}
    >
      <MapGL
        initialViewState={INITIAL_VIEW_STATE}
        style={{ width: "100%", height: "100%", backgroundColor: "white" }}
        canvasContextAttributes={{
          antialias: true,
          preserveDrawingBuffer: true,
        }}
        mapStyle={MAP_STYLE}
        onLoad={(event) => {
          const map = event.target as maplibregl.Map;
          setMapInstance(map);
          console.info("[map-debug] map load", {
            styleLoaded: map.isStyleLoaded(),
            center: map.getCenter().toArray(),
            zoom: map.getZoom(),
          });
          map.on("error", (e) => {
            console.error("[map-debug] map error", e.error);
          });
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
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 20, 20]} intensity={1.2} />

          <mesh position={[0, 0, 18]}>
            <boxGeometry args={[20, 20, 20]} />
            <meshStandardMaterial color="#ff4da6" />
          </mesh>
        </Canvas>
      </MapGL>
    </div>
  );
}
