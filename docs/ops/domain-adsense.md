# Domain & AdSense Setup

## Domain strategy

### Phase 1 — Subdomains
All sites live under `*.designyour.app`:
- `deck.designyour.app`
- `fence.designyour.app`
- `marble-roll.designyour.app`
- etc.

**Pros:** Free, instant provisioning, one DNS zone to manage.
**Cons:** Slightly weaker SEO vs dedicated domains. All sites share domain authority (good and bad).

### Phase 2 — Custom domains for winners
When a site consistently earns or gets 5k+ monthly visits, buy a dedicated domain.

**Naming patterns:**
- `designyourdeck.com`
- `fencedesigner.app`
- `terrassenplaner.de` (localized TLD for DE market)
- `solarroofcalculator.com`

**Registrar:** Cloudflare Registrar (cheapest, integrated DNS) or Namecheap.

**Setup:** Point custom domain to the existing Cloudflare Pages deployment. Keep subdomain as 301 redirect for link continuity.

**Budget:** ~$10/year per domain. At 20 custom domains = $200/year.

## AdSense setup

### Initial setup
1. Apply for Google AdSense with `designyour.app` as the primary site
2. Once approved, add the auto-ads script to the `@engine/ad-wrapper` component
3. All sites inherit it automatically

### Auto-ads configuration
Use AdSense auto-ads. Google places ads where they work best. No manual ad unit management per site.

**Important:** Configure exclusions so ads don't overlay the 3D canvas. The ad-wrapper component should define ad-free zones.

### Per-domain tracking
AdSense natively reports revenue per domain/subdomain. No extra setup needed.

### Custom domain additions
When adding a custom domain, add it to the AdSense account (Settings → Sites → Add site). Usually auto-approved if the main domain is already approved.

## Analytics setup

### Self-hosted Plausible
- Run on a $5/month VPS (Hetzner, DigitalOcean)
- One Plausible instance tracks all sites
- Each site sends pageviews tagged with its slug
- Dashboard: plausible.designyour.app (or similar)
- Privacy-friendly: no cookies, GDPR-compliant out of the box

### Alternative: Umami
- Same concept, different software
- Also self-hosted, also privacy-friendly
- Choose whichever you prefer

### What to track
- Pageviews per site
- Session duration (high dwell time = good tool engagement)
- Referral source (organic, social, direct, cross-promo)
- Country/language (which markets perform)
- Device type (mobile vs desktop — confirms mobile-first strategy)

## For AI agents

- All sites include the AdSense snippet via the shared `@engine/ad-wrapper` package
- All sites include the analytics snippet via the shared layout
- Environment variables `NEXT_PUBLIC_ADSENSE_ID` and `NEXT_PUBLIC_ANALYTICS_SITE_ID` must be set
- When deploying a new site, the ad and analytics setup is automatic — no manual steps
