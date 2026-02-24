"use client";

import { useState } from "react";
import MapGL, { Layer, Source } from "react-map-gl/maplibre";
import { Canvas } from "react-three-map/maplibre";
import { Protocol } from "pmtiles";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import PhotonGeocoderControl, {
  type PhotonGeocoderControlProps,
} from "./PhotonGeocoderControl";

let pmtilesProtocolRegistered = false;
let pmtilesProtocolInstance: Protocol | null = null;

const INITIAL_VIEW_STATE = {
  longitude: 19.945,
  latitude: 50.0647,
  zoom: 13,
  pitch: 55,
  bearing: -20,
};

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

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
  onCanvasPointerMissed?: (event: MouseEvent) => void;
  interactiveLayerIds?: string[];
};

export default function Map({
  geocoder = null,
  children,
  onMapInstance,
  interactive = true,
  onMapClick,
  onCanvasPointerMissed,
  interactiveLayerIds,
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
          setMapInstance(map);
          onMapInstance?.(map);
        }}
        onClick={(event) => {
          onMapClick?.({ lng: event.lngLat.lng, lat: event.lngLat.lat });
        }}
      >
        <Source id="protomaps" type="vector" url="pmtiles:///krakow.pmtiles">
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
          latitude={INITIAL_VIEW_STATE.latitude}
          longitude={INITIAL_VIEW_STATE.longitude}
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
