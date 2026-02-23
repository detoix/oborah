# Backlog Guide

## What is the backlog?

Every app in the portfolio has a single markdown file in `/backlog/`. These files serve as the source of truth for each app's status, configuration, performance, and notes.

The backlog is flat; all files are stored directly in the root of the folder:

```
/backlog
  deck.md
  solar-roof.md
  marble-roll.md
```

## Backlog entry structure

Every entry follows this template. The frontmatter is machine-readable (used by Dataview queries in the [[dashboard]]). The body is free-form notes.

```markdown
---
slug: deck
name: Design Your Deck
format: configurator
mode: design
submode: ground-plane
status: idea
priority: 0
map_enabled: true
sun_enabled: true
langs: [en, de, pl, es]
domain: deck.designyour.app
custom_domain: ""
assets_ready: false
procedural_only: false
hero_models: []
texture_sets: [cedar, pine, composite-grey, composite-brown, concrete-smooth]
seo_keyword_en: "deck designer online"
seo_keyword_de: "terrassenplaner online"
seo_keyword_pl: "projektowanie tarasu online"
seo_keyword_es: "diseñador de terrazas online"
search_volume_en: 0
search_volume_de: 0
search_volume_pl: 0
search_volume_es: 0
cpc_estimate: high
monthly_visits: 0
monthly_revenue: 0.00
adsense_active: false
last_deploy: ""
related: [fence, pergola, outdoor-lighting, garden-path, patio]
video_generated: false
video_posted: []
created: 2025-01-15
launched: ""
killed: ""
kill_reason: ""
---

## Notes

- Cedar and composite are the most popular decking materials in DE/PL
- Standard plank dimensions vary by country — config should handle this
- Railing is a common add-on, include it in catalog

## Assets needed

- [x] Board (procedural box + wood textures)
- [x] Post (procedural box/cylinder)
- [ ] Railing section (GLB — too complex for procedural)
- [ ] Stair stringer (GLB)

## SEO observations

- "deck planner" has higher volume than "deck designer" in English
- German: "Terrassenplaner" beats "Terrasse gestalten"
- Very low competition in Polish market

## Revenue notes

(Updated monthly)

## Changelog

- 2025-01-15: Created backlog entry
```

## Status values

| Status    | Meaning                                        |
| --------- | ---------------------------------------------- |
| `idea`    | In the backlog, not started                    |
| `assets`  | Building/collecting assets for this site       |
| `dev`     | Engine config written, in development          |
| `testing` | Deployed to preview, testing on mobile/desktop |
| `live`    | Deployed to production, indexed                |
| `paused`  | Live but not being maintained, underperforming |
| `killed`  | Taken down, record kept for reference          |

## Priority

0 = next to build. Higher numbers = later. Unprioritized ideas have no priority set.

Priority is reassessed monthly based on:

- Search volume of target keywords
- CPC estimate (higher = more ad revenue potential)
- Asset overlap with existing sites (more reuse = faster to build)
- Difficulty (simpler modes first)

## Monthly update process

On the first of each month:

1. Pull traffic data from analytics
2. Pull revenue data from AdSense
3. Update `monthly_visits` and `monthly_revenue` in each live site's frontmatter
4. Review the [[dashboard]] for patterns
5. Reprioritize the backlog based on what's working

## For AI agents

When creating a new backlog entry:

1. Use the template above — copy it exactly, fill in known fields, leave unknowns as defaults
2. Place the file directly in the `/docs/backlog/` folder
3. Set status to `idea`
4. Leave priority as 0 unless instructed otherwise
5. Check the taxonomy for the correct format, mode, and submode
6. Populate the `related` field with 3-5 related apps from the backlog
7. Populate `texture_sets` with materials that make sense for this app — reuse existing ones

When updating a backlog entry:

1. Only update fields that have changed
2. Add dated notes in the Changelog section
3. Never delete historical data — append to it
