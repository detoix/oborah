# Deployment & Operations

## The factory

Adding a new site should take under an hour. The scripts handle everything else.

## Creating a new site

```bash
./scripts/new-site.sh \
  --slug garden-bed \
  --mode design \
  --submode ground-plane \
  --copy-from deck \
  --langs en,de,pl,es
```

This script:
1. Creates `/sites/garden-bed/` from a template
2. Copies and adapts config.json from the `--copy-from` source (if specified)
3. Creates `app/page.tsx` (thin wrapper — identical for all sites)
4. Creates `next.config.js` (static export config)
5. Creates `package.json` with dependency on `@engine/core`
6. Logs next steps to the terminal

**After running the script, you:**
1. Edit `config.json` — define catalog items, materials, SEO text, related sites
2. Add any site-specific GLB assets to `/sites/garden-bed/public/assets/`
3. Test locally: `turbo dev --filter=garden-bed`
4. Deploy: `./scripts/deploy.sh garden-bed`

## Deployment

### Target: Cloudflare Pages

Each site is deployed as a separate Cloudflare Pages project.

```bash
./scripts/deploy.sh garden-bed
```

This script:
1. Builds the site: `turbo build --filter=garden-bed`
2. Exports static files: `next export` → `/sites/garden-bed/out/`
3. Deploys to Cloudflare Pages via Wrangler CLI
4. Provisions subdomain if it doesn't exist: `garden-bed.designyour.app`
5. Outputs the live URL

### Deploying everything that changed

```bash
./scripts/deploy-all.sh
```

Uses Turborepo's change detection to rebuild and deploy only sites that have changed since last deploy.

### Domain strategy

**Phase 1 — Subdomains (free, easy, instant)**
- All sites live under `*.designyour.app`
- One Cloudflare zone, DNS managed via Cloudflare API
- `deck.designyour.app`, `fence.designyour.app`, etc.
- Each language on a subpath: `deck.designyour.app/de/`, `deck.designyour.app/pl/`

**Phase 2 — Custom domains for winners**
- Sites that reach 5k+ monthly visitors get their own domain
- `designyourdeck.com`, `fencedesigner.app`, `terrassenplaner.de`
- Point custom domain to the same Cloudflare Pages deployment
- Maintain the subdomain as a redirect for continuity

**Domain purchasing:** Namecheap or Cloudflare Registrar (cheaper, integrated DNS)

## CI/CD

### GitHub Actions workflow

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx turbo build --filter='...[@since=HEAD~1]'
      - run: ./scripts/deploy-changed.sh
```

On every push to main, only the sites that changed are rebuilt and deployed. The engine package changes trigger rebuilds of all sites.

## Monitoring

### Analytics
- **Self-hosted Plausible** or **Umami** on a small VPS ($5/month)
- One analytics instance, all sites report to it
- Each site tagged with its slug
- Dashboards: per-site traffic, aggregate traffic, referral sources, geo distribution

### Uptime
- Simple cron job (or free service like UptimeRobot) that pings each site's URL daily
- Alert on HTTP errors or timeouts

### AdSense
- Google AdSense dashboard natively shows per-domain performance
- Monthly: check which domains earn, which don't
- Record revenue per site in backlog entry frontmatter

### Monthly review process
1. Open Obsidian [[dashboard]]
2. Check which sites are earning and which aren't
3. Update frontmatter in backlog entries with latest traffic/revenue numbers
4. Decide: any sites to kill? Any categories to double down on?
5. Plan next batch of sites to build

## Environment variables

Managed via Cloudflare Pages environment settings or `.env` files (not committed to git).

Required per deployment:
- `NEXT_PUBLIC_MAPBOX_TOKEN` — Mapbox API key
- `NEXT_PUBLIC_ADSENSE_ID` — AdSense publisher ID
- `NEXT_PUBLIC_ANALYTICS_SITE_ID` — Plausible/Umami site identifier
- `NEXT_PUBLIC_SITE_SLUG` — auto-set by deploy script

## Disaster recovery

- All code is in git. Recovery = `git clone` + `deploy-all.sh`
- Static sites on Cloudflare CDN are inherently redundant
- Asset files on Cloudflare R2 are replicated
- Obsidian vault is in the same git repo
- No database to back up. No server to maintain.

## For AI agents

Deployment workflow:
1. Always build locally first: `turbo dev --filter=[slug]`
2. Verify on mobile viewport before deploying
3. Run config validation: `./scripts/validate-configs.sh`
4. Deploy with: `./scripts/deploy.sh [slug]`
5. Verify live URL works
6. Update backlog entry status to `live`
