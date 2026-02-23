# Content Strategy

## Principle

All content generation is automated or semi-automated. No hand-crafted content per site. The system produces content. Individual pieces either perform or they don't.

## Automated video generation

### Pipeline
```
For each live site:
  1. Playwright opens the configurator in headless Chrome (1080x1920 portrait for mobile-first video)
  2. Script enters a sample address (curated list of visually interesting locations per country)
  3. Script executes an interaction sequence defined per site:
     - Configurators: place 3-5 items, change materials, zoom/rotate
     - Visualizers: cycle through options
     - Calculators: show the analysis animating
     - Explorers: pan around the map
     - Games: trigger the interaction (drop marble, flood city, etc.)
  4. Screen record at 30fps
  5. Trim to 15-30 seconds (ffmpeg)
  6. Add background music track (royalty-free, from a curated library)
  7. Add text overlay: "Design your [X] for free 🔗 link in bio" (ffmpeg drawtext)
  8. Export as MP4
```

### Interaction scripts
Each site config includes an optional `videoScript` section:

```json
{
  "videoScript": {
    "sampleAddress": "Schönhauser Allee 175, Berlin",
    "steps": [
      { "action": "wait", "duration": 1500 },
      { "action": "place", "item": "board", "position": [0, 0] },
      { "action": "place", "item": "board", "position": [1, 0] },
      { "action": "place", "item": "board", "position": [2, 0] },
      { "action": "changeMaterial", "to": "cedar" },
      { "action": "orbit", "angle": 45, "duration": 2000 },
      { "action": "changeMaterial", "to": "composite-grey" },
      { "action": "orbit", "angle": -30, "duration": 2000 }
    ]
  }
}
```

### Batch generation
```bash
./scripts/generate-videos.sh          # all live sites
./scripts/generate-videos.sh deck     # single site
```

Output: `/content/videos/[slug]-[lang]-[variant].mp4`

### Posting
Use a scheduling tool API (Buffer, Later, or direct TikTok/YouTube/Meta APIs):
- TikTok: post 1-2 per day
- YouTube Shorts: post 1-2 per day
- Instagram Reels: post 1 per day
- Pinterest Video: post 2-3 per day

Spread across weeks. 200 sites × 2-3 variants = 400-600 videos = months of content from one batch run.

### Brand accounts
All posted under brand identity, not personal:
- TikTok: @designyourapp
- YouTube: Design Your App
- Instagram: @designyourapp
- Pinterest: Design Your App (boards per category)

No face, no voice, no personal identity exposed.

## Pinterest static pins

### Auto-generated design gallery
For each live configurator:
1. Run 5-10 different design presets through the tool (different layouts, materials)
2. Capture screenshots (4:5 aspect ratio, Pinterest-optimal)
3. Add text overlay: "Cedar Deck Design — 4×6m with Pergola" (descriptive, keyword-rich)
4. Add small watermark: designyour.app
5. Upload as pins to relevant boards

### Board structure
- "Deck & Terrace Ideas"
- "Fence Design Ideas"
- "Home Office Setups"
- "Garden Layout Plans"
- "Solar Panel Layouts"
- ...one board per category or cluster of related sites

### User-generated pins
The share/export feature in each tool generates Pinterest-optimized images. When users share their designs, they create pins that link back to the tool. This scales without effort.

## SEO content (auto-generated)

Each site page includes supporting text below the tool. This text is generated from templates, not written manually.

### Template system
```
/packages/seo/templates/
  configurator-en.txt
  configurator-de.txt
  configurator-pl.txt
  configurator-es.txt
  visualizer-en.txt
  ...
```

Each template has slots filled from config.json:
- `{product}` — "deck", "fence", "solar panels"
- `{action}` — "design", "plan", "visualize", "analyze"
- `{componentCount}` — number of catalog items
- `{materialCount}` — number of material options
- `{mapSentence}` — included if map_enabled, omitted otherwise
- `{relatedLinks}` — auto-generated links to related tools

### Example (English configurator template)
```
Free online {product} designer. Plan your {product} with our interactive 
3D tool. {mapSentence} Choose from {materialCount} real materials and see 
your design come to life. Drag and drop components, adjust dimensions, 
and visualize your project before spending a single cent.

Whether you're planning a weekend project or a major renovation, our 
{product} planner helps you make confident decisions. Try different 
layouts, compare materials side by side, and get a clear picture of 
what your finished {product} will look like.

Looking for more? Try our {relatedLinks}.
```

This generates unique-enough text per site without manual effort. Google sees supporting content alongside the tool.

## Sample addresses library

For video generation and sample screenshots, maintain a curated list of visually interesting addresses per country:

```json
{
  "de": [
    "Schönhauser Allee 175, Berlin",
    "Maximilianstraße 10, München",
    "Elbchaussee 100, Hamburg"
  ],
  "pl": [
    "Nowy Świat 15, Warszawa",
    "Floriańska 20, Kraków",
    "Piotrkowska 100, Łódź"
  ],
  "es": [
    "Calle Serrano 50, Madrid",
    "Passeig de Gràcia 43, Barcelona",
    "Calle Larios 1, Málaga"
  ],
  "en": [
    "221B Baker Street, London",
    "5th Avenue, New York",
    "1 Infinite Loop, Cupertino"
  ]
}
```

Choose addresses with:
- Clear satellite imagery
- Visible yard/roof/property (not obscured by trees)
- Recognizable or interesting locations (drives curiosity in videos)

## For AI agents

When creating content assets:
1. Video scripts go in the site's config.json under `videoScript`
2. SEO text is generated, not written — update templates, not individual sites
3. Screenshot/export images must include the watermark URL
4. All content is posted under brand accounts, never personal
5. Pinterest pins need 4:5 aspect ratio images with descriptive text overlays
