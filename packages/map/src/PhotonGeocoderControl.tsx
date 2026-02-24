"use client";

import { useEffect } from "react";
import maplibregl from "maplibre-gl";
import MaplibreGeocoder from "@maplibre/maplibre-gl-geocoder";
import "@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css";

import { createPhotonGeocoder, type PhotonGeocoderOptions } from "./photonGeocoder";

export type PhotonGeocoderControlProps = PhotonGeocoderOptions & {
  map: maplibregl.Map | null;
  position?: maplibregl.ControlPosition;
  placeholder?: string;
};

export default function PhotonGeocoderControl({
  map,
  position = "top-left",
  placeholder = "Search places",
  endpoint,
  language,
  limit,
}: PhotonGeocoderControlProps) {
  useEffect(() => {
    if (!map) {
      return;
    }

    const geocoder = new MaplibreGeocoder(
      createPhotonGeocoder({ endpoint, language, limit }),
      {
        maplibregl,
        marker: true,
        showResultsWhileTyping: true,
        placeholder,
      },
    );

    map.addControl(geocoder, position);

    return () => {
      map.removeControl(geocoder);
    };
  }, [endpoint, language, limit, map, placeholder, position]);

  return null;
}

