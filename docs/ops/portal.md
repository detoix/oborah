# Portal — designyour.app

## Purpose

The main hub site at `designyour.app`. Serves as:
1. The link-in-bio destination from all social accounts
2. A directory of all live tools, browsable and searchable
3. An SEO target for broad keywords ("free home design tools", "online room planner")
4. The brand anchor for the entire portfolio

## Design

Single page. Clean grid of visual cards. Each card shows:
- Tool name ("Design Your Deck")
- A thumbnail (auto-generated screenshot of the tool)
- Format badge (Configurator / Visualizer / Calculator / Explorer / Game)
- One-line description

### Filtering
- By format (configurator, visualizer, calculator, explorer, game)
- By category (outdoor, indoor, garden, workspace, hobby, fun)
- By language (auto-detect from browser, manual override)
- Search box

### Technical
- Static site (Next.js export, like all other sites)
- Cards generated from aggregated config.json data at build time
- Thumbnails pulled from auto-generated screenshots
- Deployed on Cloudflare Pages like everything else
- Rebuild when new sites are added

## SEO

Target keywords:
- "free home design tools"
- "online room planner"
- "3D house planner free"
- "interactive design tools"
- Equivalent keywords in DE, PL, ES

Include a brief intro paragraph explaining the project.

## Social accounts

All link to this portal:
- TikTok bio: designyour.app
- YouTube about: designyour.app
- Instagram bio: designyour.app
- Pinterest profile: designyour.app

## For AI agents

The portal is rebuilt whenever a new site is deployed. The deploy pipeline should:
1. Aggregate all live site configs
2. Pull thumbnails from each site's auto-generated screenshot
3. Build the portal grid
4. Deploy to designyour.app
