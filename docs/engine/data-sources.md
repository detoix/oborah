# Data Sources

All external data used by the apps to ground 3D experiences in the real world.

## Maps & satellite imagery

### Protomaps (PMTiles)

- **What:** Self-hosted basemaps and 3D building footprints rendered directly from static `.pmtiles` files.
- **Use:** Ground plane for all map-enabled apps, street maps, 3D buildings. Replaces MapTiler/Mapbox dependency for core visualization.
- **Benefits:** No external API dependency, zero cost at runtime, entirely offline-capable. Fast load times due to Range Requests on static files.
- **Implementation:** React Map GL rendering with MapLibre, styled via `protomaps-themes-base`.
- **Docs:** https://protomaps.com/docs/

### OpenStreetMap / Overpass API

- **What:** Additional property boundaries, land use, amenities.
- **Use:** Lot boundary detection, specific OSM queries beyond map rendering.
- **Cost:** Free. Rate-limited but generous for our use case.
- **No API key needed** for Overpass
- **Docs:** https://wiki.openstreetmap.org/wiki/Overpass_API

### Satellite Imagery (Fallback)

- **What:** Satellite imagery (Google Maps/Mapbox/Bing).
- **Use:** Occasional satellite overlay if Protomaps vector tiles lack sufficient visual context.
- **Note:** Keep as backup, not primary.

## Elevation & terrain

### Mapbox Terrain

- **What:** Global terrain elevation tiles with 3D rendering
- **Use:** Terrain for marble roll game, slope analysis, elevation profiles
- **Included in Mapbox free tier**

### Copernicus / SRTM

- **What:** High-resolution elevation data (EU/global), 30m resolution
- **Use:** Detailed terrain analysis, flood simulation, snow load estimation
- **Cost:** Free (EU-funded open data)
- **Source:** https://land.copernicus.eu/ and https://earthexplorer.usgs.gov/

## Sun & weather

### SunCalc

- **What:** JavaScript library for sun position, sunrise/sunset, moon phase
- **Use:** Shadow simulation, sun exposure analysis, lighting planners
- **Cost:** Free (npm package, runs client-side, no API)
- **Repo:** https://github.com/mourner/suncalc

### Open-Meteo

- **What:** Free weather API. Historical climate data, current conditions, forecasts.
- **Use:** Climate analysis for calculators (rain, snow, wind, temperature normals)
- **Cost:** Free for non-commercial; free for commercial up to 10k requests/day
- **Docs:** https://open-meteo.com/

## Building & property data

### OpenCadastre (varies by country)

- **What:** Official property boundary data
- **Germany:** Available via state-level Geoportale (varies by Bundesland). Some free, some require registration.
- **Poland:** Geoportal.gov.pl — building outlines and basic cadastral data freely accessible via WMS/WFS
- **Spain:** Sede Electrónica del Catastro — property boundaries and building footprints, free API
- **Note:** Quality and accessibility vary enormously. OSM building footprints are a good fallback.

### OpenStreetMap building data

- **What:** Building footprints with height data (where available)
- **Use:** Automatic building detection at user's address
- **Quality:** Good in urban areas of EU, sparse in rural areas
- **Access:** Overpass API queries

## Environmental data

### EU Noise maps

- **What:** Strategic noise maps required by EU Directive 2002/49/EC
- **Use:** Noise exposure visualization in explorer apps
- **Source:** National portals (Umgebungslaerm.de for Germany, etc.)
- **Cost:** Free (public data)

### EU flood maps

- **What:** Flood hazard maps
- **Use:** Flood risk visualization
- **Source:** European Flood Awareness System (EFAS) and national portals
- **Cost:** Free

### Air quality

- **What:** Real-time and historical air quality data
- **Use:** Air quality explorer
- **Source:** European Environment Agency (EEA) API, OpenAQ
- **Cost:** Free

## Real estate & urban data

### OpenStreetMap amenities

- **What:** Shops, parks, schools, hospitals, transit stops, etc.
- **Use:** Walkability analysis, amenity distance visualization
- **Cost:** Free via Overpass API

### National statistics offices

- **What:** Population density, property prices (aggregated), demographics
- **Use:** Property price heatmaps, neighborhood explorers
- **Note:** Granularity and availability vary by country

## 3D assets

### Polyhaven

- **What:** Free PBR textures, HDRIs, and 3D models. CC0 license.
- **Use:** Material textures for the engine (wood, stone, metal, concrete)
- **Docs:** https://polyhaven.com/
- **License:** CC0 (fully free, commercial use, no attribution needed)

### ambientCG

- **What:** Free PBR materials. CC0 license.
- **Use:** Supplementary textures
- **Docs:** https://ambientcg.com/
- **License:** CC0

## Rate limits and caching strategy

Most external APIs have rate limits. The caching strategy:

1. **Satellite tiles** — cached by Mapbox CDN automatically. No action needed.
2. **Overpass API queries** — cache building footprint results in localStorage for the session. Same address = no repeat query.
3. **Geocoding** — cache results. Same address typed twice should not hit the API twice.
4. **Weather/climate data** — cache aggressively. Climate normals don't change daily.
5. **SunCalc** — runs entirely client-side. No API, no rate limits.

## For AI agents

When building a new app:

1. Check which data sources the app needs (listed in config.json)
2. All API keys are stored as environment variables, never in code
3. Always implement caching for external API calls
4. Prefer free/open data sources over paid ones
5. Mapbox is the primary map provider — use alternatives only if Mapbox lacks coverage
6. SunCalc is preferred for all sun/shadow calculations (no API dependency)
7. Test with real addresses in all four target countries (DE, PL, ES, US/UK for English)
