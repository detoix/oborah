# Dashboard

> This page uses the Obsidian Dataview plugin. Install it from Community Plugins for the queries to render.

## Portfolio summary

### Live sites
```dataview
TABLE WITHOUT ID
  link(file.link, name) as "App",
  format as "Format",
  monthly_visits as "Visits/mo",
  monthly_revenue as "Rev/mo",
  domain as "Domain",
  length(langs) as "Langs"
FROM "backlog"
WHERE status = "live"
SORT monthly_revenue DESC
```

### Total revenue
```dataview
TABLE WITHOUT ID
  sum(rows.monthly_revenue) as "Total Monthly Revenue",
  length(rows) as "Live Sites",
  sum(rows.monthly_visits) as "Total Monthly Visits"
FROM "backlog"
WHERE status = "live"
GROUP BY true
```

### Revenue by format
```dataview
TABLE WITHOUT ID
  format as "Format",
  length(rows) as "Live Sites",
  sum(rows.monthly_revenue) as "Monthly Revenue",
  sum(rows.monthly_visits) as "Monthly Visits"
FROM "backlog"
WHERE status = "live"
GROUP BY format
SORT sum(rows.monthly_revenue) DESC
```

## Pipeline

### In development
```dataview
TABLE WITHOUT ID
  link(file.link, name) as "App",
  format as "Format",
  status as "Status",
  submode as "Mode",
  assets_ready as "Assets Ready",
  priority as "Priority"
FROM "backlog"
WHERE status != "live" AND status != "killed" AND status != "idea"
SORT priority ASC
```

### Next to build (prioritized ideas)
```dataview
TABLE WITHOUT ID
  link(file.link, name) as "App",
  format as "Format",
  submode as "Mode",
  cpc_estimate as "CPC",
  map_enabled as "Map"
FROM "backlog"
WHERE status = "idea" AND priority != null
SORT priority ASC
LIMIT 20
```

### Unprioritized ideas
```dataview
TABLE WITHOUT ID
  link(file.link, name) as "App",
  format as "Format",
  submode as "Mode",
  cpc_estimate as "CPC"
FROM "backlog"
WHERE status = "idea" AND priority = null
SORT file.name ASC
```

## Performance analysis

### Top earners
```dataview
TABLE WITHOUT ID
  link(file.link, name) as "App",
  monthly_revenue as "Rev/mo",
  monthly_visits as "Visits/mo",
  round(monthly_revenue / monthly_visits * 1000, 2) as "RPM",
  format as "Format"
FROM "backlog"
WHERE status = "live" AND monthly_revenue > 0
SORT monthly_revenue DESC
LIMIT 10
```

### Underperformers (live but no revenue)
```dataview
TABLE WITHOUT ID
  link(file.link, name) as "App",
  monthly_visits as "Visits/mo",
  last_deploy as "Deployed",
  format as "Format"
FROM "backlog"
WHERE status = "live" AND monthly_revenue = 0
SORT last_deploy ASC
```

### Killed sites (post-mortem reference)
```dataview
TABLE WITHOUT ID
  link(file.link, name) as "App",
  killed as "Killed date",
  kill_reason as "Reason"
FROM "backlog"
WHERE status = "killed"
SORT killed DESC
```

## Asset coverage

### Texture sets in use
```dataview
TABLE WITHOUT ID
  texture_sets as "Textures"
FROM "backlog"
WHERE status = "live" OR status = "dev"
FLATTEN texture_sets
GROUP BY texture_sets
```

### Sites needing hero models
```dataview
TABLE WITHOUT ID
  link(file.link, name) as "App",
  hero_models as "Models needed"
FROM "backlog"
WHERE length(hero_models) > 0 AND assets_ready = false
```

## Content status

### Videos
```dataview
TABLE WITHOUT ID
  link(file.link, name) as "App",
  video_generated as "Generated",
  video_posted as "Posted to"
FROM "backlog"
WHERE status = "live"
SORT video_generated ASC
```

## Monthly review checklist

- [ ] Pull analytics data for all live sites
- [ ] Pull AdSense revenue data
- [ ] Update frontmatter for all live sites
- [ ] Identify new winners (traffic growing)
- [ ] Identify dead weight (6+ months, no traffic)
- [ ] Reprioritize backlog based on patterns
- [ ] Plan next batch of sites
- [ ] Run video generation for new sites
- [ ] Check for any broken deployments
