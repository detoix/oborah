# Traffic Strategy

## Core principle

This is a cattle operation. Traffic strategy must be systematic and automatable. No hand-crafted promotion per site. The system generates traffic. Individual sites either catch or they don't.

## Channel 1 — Programmatic SEO (primary, most passive)

### How it works
Each site is automatically generated with:
- The interactive tool (high engagement, low bounce rate, long dwell time — Google loves this)
- Auto-generated supporting text from SEO templates (300-500 words below the tool)
- `SoftwareApplication` structured data markup
- Open Graph tags with auto-generated preview image (screenshot of tool in action)
- Auto-generated sitemap per site
- Internal cross-links to related sites (from `related` field in config)
- hreflang tags linking language versions

### What makes these rank
- **Unique interactive content** — no other page on the internet has this exact tool. Google can't replace it with an AI overview.
- **High engagement signals** — users spend 3-10 minutes on a configurator vs 30 seconds on an article. Time on page and low bounce rate are ranking signals.
- **Low competition** — "terrassenplaner online" or "fence designer tool" have far less competition than "best fence materials" because almost nobody builds tools.
- **Multi-language coverage** — Polish and Spanish markets for these tools are nearly empty.

### SEO text template approach
Supporting text below each tool is generated from templates:

```
Template: "Free online {product} designer. Plan your {product} with our 
interactive {2D/3D} tool. {Map sentence if map enabled}. Choose from 
{N} materials, see real dimensions, and visualize your project before 
you buy. {Related tools sentence}."
```

Each language has its own template set. The config.json fills in the variables. No manual copywriting per site.

### Keyword research
Before building a new site, check search volume for the target keyword in each language. Tools: Google Keyword Planner (free with a Google Ads account), Ubersuggest, or Ahrefs free tier.

Minimum threshold to justify building: combined 1,000+ monthly searches across all 4 languages.

Record keyword data in the backlog entry frontmatter.

### Timeline
SEO is slow. Expect 3-6 months for a page to rank. The strategy is to deploy many pages and wait. By month 6-12, the winners will be apparent in analytics.

## Channel 2 — Automated short-form video (secondary, can be fast)

### How it works
A headless browser script opens each configurator, runs a scripted interaction sequence, and screen-records it. The output is a 15-30 second video per configurator showing the tool in action.

### The video factory
```
For each configurator:
  1. Open in headless browser (Playwright)
  2. Enter a sample address (or skip if no map)
  3. Execute scripted sequence: place items, change materials, rotate view
  4. Screen-record the session
  5. Trim to 15-30 seconds
  6. Add subtle background music (royalty-free)
  7. Add caption: "Design your [X] for free — link in bio"
  8. Export
```

Run this for all 200 configurators → 200 videos → batch upload.

### Distribution
Post under brand accounts (no personal identity):
- TikTok
- YouTube Shorts
- Instagram Reels
- Pinterest Video

Use a scheduling tool (Buffer, Later, or similar) to drip-post over weeks.

### What makes these perform
- Satisfying visual transformation (empty space → designed space)
- The satellite/map hook ("is that their actual yard?")
- Niche specificity — each video hits a micro-community
- No production overhead — pure screen recordings

### Link routing
All social bio links point to `designyour.app` portal page. The portal shows all configurators as a visual grid. User picks what interests them.

### Realistic expectations
Most videos: 200-500 views. Some: 5k-50k. A few: 100k+. Volume strategy — at 200 videos, you only need a small hit rate to drive meaningful traffic.

## Channel 3 — Pinterest (tertiary, compounding)

### How it works
Every configurator's export/screenshot feature generates shareable images. Post these as pins linking back to the tool.

### Automation
- Generate sample designs per configurator (scripted, same as video)
- Auto-create Pinterest-formatted images (4:5 aspect ratio, tool screenshot + text overlay)
- Bulk schedule via Pinterest API or Tailwind

### Boards
Create boards per category: "Deck Ideas," "Garden Layouts," "Home Office Setups," "Fence Designs."

### User-generated pins
The share button in each configurator generates a Pinterest-ready image with watermark URL. If users pin their own designs, each pin is free distribution linking back to the tool.

## Channel 4 — Cross-promotion (internal, free)

### How it works
Every configurator shows a "You might also like" bar with 3-4 related configurators. This is auto-generated from the `related` field in each site's config.

### The portal
`designyour.app` is the hub — a visual directory of all configurators, categorized and searchable. It's also an SEO target itself for queries like "free home design tools" and "online room planner."

### The watermark
Every exported screenshot includes the designyour.app URL. Passive branding on every share.

## What is NOT part of the strategy

- ❌ LinkedIn posting
- ❌ Personal brand content
- ❌ Manual Reddit/forum posting per site
- ❌ Paid ads
- ❌ Influencer outreach
- ❌ Email marketing (phase 1)
- ❌ Manual anything per site

Every traffic channel must either be automated or work passively via SEO indexing.

## Measurement

Track via self-hosted analytics (Plausible or Umami):
- Pageviews per site per month
- Average session duration per site
- Referral sources per site (organic, social, direct, cross-promo)
- Geographic distribution (which language markets perform)

Update Obsidian backlog entries monthly with performance data. The [[dashboard]] aggregates it all.

## For AI agents

When building new sites, ensure:
1. SEO text is generated from templates, not written manually
2. Open Graph image is auto-generated (screenshot of tool with sample design)
3. The `related` field in config is populated for cross-promotion
4. hreflang tags are set for all language versions
5. Structured data (SoftwareApplication schema) is included
6. The export/share feature generates watermarked images
