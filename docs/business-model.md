# Business Model

## Revenue model

Contextual display ads (Google AdSense). No affiliate links, no product databases, no per-country program management.

Google automatically serves relevant, high-CPC ads based on page content and user intent. A user on a deck configurator sees ads from Bauhaus, Home Depot, Leroy Merlin, etc. without any manual setup.

## Why ads over affiliate

| Factor | Affiliate | Ads |
|---|---|---|
| Setup per site | High (product DB, links, per-country programs) | Zero (one AdSense snippet) |
| Maintenance | Ongoing (broken links, program changes) | None |
| Multi-language scaling | Manual per market | Automatic |
| Revenue per conversion | Higher | Lower |
| Scales to 200 sites | Painful | Trivial |

At 200 sites, affiliate maintenance is a full-time job. Ads are a config line.

## Revenue math

### Assumptions
- Home improvement / construction niche: estimated $5-12 RPM (revenue per 1000 pageviews)
- Interactive tools with high dwell time typically earn higher RPM than content pages
- 200 sites across 4 languages = 800 indexable pages

### Conservative scenario
- 50 sites get meaningful traffic (average 3,000 visits/month each)
- Average RPM: $6
- Monthly revenue: 50 × 3,000 × $6 / 1,000 = **$900/month**

### Moderate scenario
- 80 sites get traffic (average 5,000 visits/month)
- 10 breakout sites (average 30,000 visits/month)
- Average RPM: $8
- Monthly: (80 × 5,000 + 10 × 30,000) × $8 / 1,000 = **$5,600/month**

### Optimistic scenario
- 120 sites with traffic (average 8,000 visits/month)
- 20 breakout sites (average 50,000 visits/month)
- Average RPM: $10
- Monthly: (120 × 8,000 + 20 × 50,000) × $10 / 1,000 = **$19,600/month**

### Key insight
No single site needs to be a success. The portfolio model means the variance works in your favor — a few unexpected winners can carry many underperformers.

## Cost structure

| Item | Monthly cost |
|---|---|
| Cloudflare Pages | $0 (free tier) |
| Mapbox | $0 up to 50k loads, then usage-based |
| Domains (if using custom) | ~$0.80/domain/month ($10/year × 200) = $160 |
| Subdomains (if using *.designyour.app) | $0 |
| Texture/asset storage (Cloudflare R2) | ~$5-15 |
| Analytics (self-hosted Plausible/Umami) | ~$5 VPS |
| **Total** | **$10-180/month** |

Essentially zero fixed costs. Revenue is almost pure margin.

## Timeline to revenue

| Phase | Duration | Output |
|---|---|---|
| Engine development | Weeks 1-4 | Core engine, first site live |
| Factory setup | Weeks 5-6 | Deploy pipeline, site template, first 10 sites |
| Scale phase 1 | Months 2-4 | 50 sites live, SEO indexing begins |
| Scale phase 2 | Months 4-8 | 200 sites live, first traffic and revenue |
| Maturation | Months 8-18 | SEO compounds, winners emerge, revenue grows |

First meaningful AdSense revenue: **month 4-6**.
Portfolio reaching steady state: **month 12-18**.

## Exit / evolution options

If the portfolio reaches significant traffic:
- **Direct ad deals** with construction/home improvement brands (higher CPM than AdSense)
- **White-label licensing** — sell the engine to companies wanting their own configurator
- **Premium tier** — some configurators get a "save project" or "PDF export" feature behind a paywall
- **Data insights** — anonymized aggregate data on what people design (what deck sizes are popular, what materials trend) could be valuable to manufacturers

These are optional. The base model (ads on free tools) is the business. Everything else is upside.

## For AI agents

The business model should not influence technical decisions beyond:
1. Every page must have the AdSense wrapper
2. Every page must be SEO-optimized (structured data, meta tags, supporting text)
3. Every page must load fast (Core Web Vitals directly affect ad revenue)
4. Cross-promotion between related sites is a revenue multiplier
