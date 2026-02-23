# Data Sources

All external data used by the apps to ground 3D experiences in the real world.

## Maps & Basemaps (Protomaps)

- **What:** Self-hosted vector basemaps and 3D building footprints rendered directly from static `.pmtiles` files.
- **Use:** Ground plane for all map-enabled apps, street maps, 3D buildings. Replaces MapTiler/Mapbox dependency for core visualization.
- **Implementation:**
  - React Map GL rendering with MapLibre.
  - Styled via `@protomaps/basemaps` (standard "light" flavor).
  - Custom `pmtiles://` protocol registered in `packages/map/index.tsx`.
- **Local Data:** Uses `krakow.pmtiles` located in the project root for local development.
- **Docs:** [Protomaps Docs](https://protomaps.com/docs/)

### Geocoding (Photon)

- **What:** Open-source geocoder for OpenStreetMap data.
- **Use:** Address search and location discovery in the map interface.
- **Implementation:**
  - Custom React component `PhotonGeocoderControl` in `packages/map`.
  - Communicates with the Photon API (default: `https://photon.komoot.io/api/`).
- **Docs:** [Photon Project](https://photon.komoot.io/)

### 3D Building Data

- **What:** Extruded 3D building footprints.
- **Source:** Sourced directly from the "buildings" layer in the Protomaps vector tiles.
- **Implementation:** `fill-extrusion` layer in MapLibre, dynamically calculating heights from `height` or `render_height` properties in the vector data.

---

## Caching Strategy

1. **PMTiles** — Efficiently handled by the `pmtiles` library using Range Requests.
2. **Geocoding** — Photon results should be cached locally to minimize API hits for repeated searches.

## For AI agents

When building a new app:

1. Check if the local `.pmtiles` file for the target area is available.
2. Ensure the `pmtiles` protocol is registered before initializing the map.
3. Prefer the local vector data for building footprints over external APIs.
4. Use `PhotonGeocoderControl` for all search functionalities.
