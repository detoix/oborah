# Architecture

## Overview

A monorepo containing a shared set of internal workspace packages and independent React applications. This is designed for direct coding and integration rather than a template-driven or configuration-first approach.

## Monorepo structure

```
/monorepo
  /docs                          ← Documentation, architecture notes, and data source information
  /packages
    /map                         ← PMTiles React MapLibre implementation (@engine/map)
    /...                         ← Any other shared UI components, hooks, or engine logic
  /apps
    /pmtiles-map-app             ← The main Next.js mapping application
```

## Tech stack decisions

### Next.js

- Local apps built on Next.js App Router (React 19).
- Shared workspace dependencies mapped through NPM workspaces.
- Local development via the app's Next.js dev server.

### React Three Fiber over raw Three.js

- Keeps everything in React's component model.
- Declarative scene description.
- Performance is identical to raw Three.js.

### Protomaps (PMTiles) with MapLibre GL JS

- Local `.pmtiles` vector files as the base map and ground texture
- Self-hosted street maps and Protomaps vector tiles integration via `protomaps-themes-base`
- Local building footprints (3D buildings layer extruded via height/min_height properties)
- Fast performance mapped natively to `react-map-gl/maplibre`

### Zustand for state

- Used in local apps where shared UI state is needed.

## Performance budget

| Metric                   | Target  |
| ------------------------ | ------- |
| Triangle count (scene)   | < 200k  |
| Texture memory           | < 256MB |
| Load time to interactive | < 2s    |
| Frame rate               | 60fps   |

### Performance techniques:

- KTX2 compressed textures where applicable.
- LOD (level of detail) for complex 3D models.
- Instanced rendering for repeated objects.
- MapLibre handles massive vector tile data streaming natively.
