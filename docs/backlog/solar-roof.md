---
slug: solar-roof
name: Solar Potential of Your Roof
format: calculator
mode: analyze
submode: map-roof
status: idea
priority: 3
map_enabled: true
sun_enabled: true
langs: [en, de, pl, es]
domain: solar-roof.designyour.app
custom_domain: ""
assets_ready: true
procedural_only: true
hero_models: []
texture_sets: [solar-panel-blue, solar-panel-black]
seo_keyword_en: "solar panel calculator my roof"
seo_keyword_de: "solarpotenzial dach berechnen"
seo_keyword_pl: "kalkulator paneli slonecznych dach"
seo_keyword_es: "calculadora solar tejado"
search_volume_en: 0
search_volume_de: 0
search_volume_pl: 0
search_volume_es: 0
cpc_estimate: high
monthly_visits: 0
monthly_revenue: 0.00
adsense_active: false
last_deploy: ""
related: [ev-charger, heat-pump, sun-exposure, roof-area]
video_generated: false
video_posted: []
created: 2025-02-23
launched: ""
killed: ""
kill_reason: ""
---

## Notes

- **Very high CPC niche** — solar companies bid heavily on these keywords
- User enters address → satellite view of their roof → app estimates:
  - Usable roof area (detect orientation from satellite/OSM data)
  - Sun hours per year based on location, orientation, and nearby building shadows
  - Estimated kWh output per year
  - Estimated number of panels that fit
  - Approximate cost savings per year
- Visualization: 3D panels overlaid on the roof with sun animation
- Shadow analysis from neighboring buildings using SunCalc + OSM building heights
- Data sources: Mapbox satellite, OSM buildings, SunCalc, local solar irradiance data (PVGIS — EU free API)
- Competing tools exist (Google Sunroof) but limited to US. EU market is wide open.
- DE market is especially hot due to Energiewende policies

## Assets needed

- [x] Solar panel (procedural plane with panel texture — simple)
- [x] Sun path visualization (procedural arc/line)
- [x] Everything else from map data

## Data sources specific to this app

- **PVGIS** (Photovoltaic Geographical Information System) — EU-funded, free API for solar irradiance data by location. https://re.jrc.ec.europa.eu/pvg_tools/
- **SunCalc** — sun path and shadow angles
- **OSM buildings** — neighboring building heights for shadow analysis

## SEO observations

- "solar calculator roof" has high volume AND high CPC in all four languages
- Germany: "Solarpotenzial berechnen" and "Solarrechner Dach" both strong
- This could justify a custom domain early: solarroofcalculator.com or similar

## Revenue notes

- Highest expected RPM in the portfolio due to solar industry ad spend
- Even moderate traffic (5k/month) could generate meaningful revenue

## Changelog

- 2025-02-23: Created backlog entry, set as priority 3 (high revenue potential)
