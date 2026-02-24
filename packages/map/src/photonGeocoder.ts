"use client";

import type {
  CarmenGeojsonFeature,
  MaplibreGeocoderApi,
  MaplibreGeocoderApiConfig,
  MaplibreGeocoderFeatureResults,
} from "@maplibre/maplibre-gl-geocoder";

type PhotonProperties = {
  name?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  postcode?: string;
  extent?: [number, number, number, number];
  osm_id?: number;
  osm_type?: string;
  osm_key?: string;
  osm_value?: string;
  [key: string]: unknown;
};

type PhotonFeature = {
  geometry?: {
    type?: string;
    coordinates?: [number, number];
  };
  properties?: PhotonProperties;
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

export type PhotonGeocoderOptions = {
  endpoint?: string;
  language?: string;
  limit?: number;
};

function buildPlaceName(properties: PhotonProperties, fallbackText: string) {
  const streetLine = [properties.street, properties.housenumber]
    .filter(Boolean)
    .join(" ")
    .trim();

  const locality = [properties.city, properties.county, properties.state, properties.country]
    .filter(Boolean)
    .join(", ")
    .trim();

  return [fallbackText, streetLine, locality].filter(Boolean).join(", ");
}

function toGeocoderFeature(feature: PhotonFeature): CarmenGeojsonFeature | null {
  if (feature.geometry?.type !== "Point" || !feature.geometry.coordinates) {
    return null;
  }

  const [longitude, latitude] = feature.geometry.coordinates;
  if (typeof longitude !== "number" || typeof latitude !== "number") {
    return null;
  }

  const properties = feature.properties ?? {};
  const fallbackText = [properties.street, properties.city, properties.country]
    .filter(Boolean)
    .join(", ");
  const text = properties.name ?? (fallbackText || "Search result");

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [longitude, latitude],
    },
    center: [longitude, latitude],
    text,
    place_name: buildPlaceName(properties, text),
    place_type: ["place"],
    bbox: properties.extent,
    properties: {
      provider: "photon",
      ...properties,
    },
  } as CarmenGeojsonFeature;
}

export function createPhotonGeocoder(
  options: PhotonGeocoderOptions = {},
): MaplibreGeocoderApi {
  const endpoint = options.endpoint ?? "https://photon.komoot.io/api";
  const limit = options.limit ?? 8;

  return {
    async forwardGeocode(
      config: MaplibreGeocoderApiConfig,
    ): Promise<MaplibreGeocoderFeatureResults> {
      const query = typeof config.query === "string" ? config.query.trim() : "";
      if (!query) {
        return { type: "FeatureCollection", features: [] };
      }

      const url = new URL(endpoint);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(limit));

      if (options.language) {
        url.searchParams.set("lang", options.language);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return { type: "FeatureCollection", features: [] };
      }

      const data = (await response.json()) as PhotonResponse;
      const features = (data.features ?? [])
        .map(toGeocoderFeature)
        .filter((feature): feature is CarmenGeojsonFeature => feature !== null);

      return { type: "FeatureCollection", features };
    },
  };
}
