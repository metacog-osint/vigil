# Deployment Guide

## Hosting Architecture

Vigil uses a simple, cost-effective hosting stack:

| Service | Purpose | Plan |
|---------|---------|------|
| **Vercel** | Frontend hosting & CDN | Hobby (Free) |
| **Supabase** | PostgreSQL database | Free Tier |
| **GitHub** | Source code repository | Free |

## Pricing & Free Tier Limits

### Supabase Free Tier

| Resource | Limit | Current Usage |
|----------|-------|---------------|
| Database size | 500 MB | ~50-80 MB (~15%) |
| Bandwidth | 2 GB/month | Minimal |
| Projects | 2 max | 1 |
| API requests | 500K/month | Well under |

**Important Notes:**
- Projects pause after 7 days of inactivity
- Visit your site occasionally to keep it active
- No credit card required

### Vercel Hobby Plan

| Resource | Limit |
|----------|-------|
| Bandwidth | 100 GB/month |
| Build minutes | 6,000/month |
| Deployments | Unlimited |
| Serverless functions | Included |

**Limitations:**
- Single user only (no team features)
- Fixed 2 GB / 1 vCPU compute
- No commercial use (personal projects only)

### GitHub

- Unlimited public repositories (free)
- No storage limits for code

## Current Deployment

**Live URL:** `vigil-git-main-metacog-7922s-projects.vercel.app`

**GitHub Repo:** https://github.com/metacog-osint/vigil

## Environment Variables

Required in Vercel dashboard (Settings > Environment Variables):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Deployment Process

1. Push to `main` branch on GitHub
2. Vercel automatically detects changes
3. Builds with `npm run build`
4. Deploys to CDN (~30-60 seconds)

## Database Migrations

Run these in Supabase SQL Editor in order:

1. `001_initial_schema.sql` - Core tables
2. `002_trend_calculations.sql` - Trend analysis functions
3. `003_mitre_techniques.sql` - ATT&CK techniques table
4. `004_user_features.sql` - Watchlists, preferences
5. `005_alerts_and_feeds.sql` - Alerts, malware samples

## Data Ingestion

Run locally to populate database:

```bash
npm run ingest
```

Or run individual scripts:

```bash
node scripts/ingest-ransomwatch.mjs  # 16,000+ incidents
node scripts/ingest-cisa-kev.mjs     # 1,487 KEVs
node scripts/ingest-nvd.mjs          # Recent CVEs
node scripts/ingest-mitre.mjs        # ATT&CK techniques
```

## Scaling Considerations

If you exceed free tier limits:

| Service | Upgrade Cost |
|---------|--------------|
| Supabase Pro | $25/month (8 GB database) |
| Vercel Pro | $20/month/user |

Current usage is well within free tiers - no upgrades needed.

## Monitoring

- **Vercel Dashboard:** Deployment logs, analytics
- **Supabase Dashboard:** Database size, API usage
- Check `sync_log` table for ingestion history

## Troubleshooting

**Site shows old version:**
1. Check Vercel Deployments tab
2. Ensure environment variables are set
3. Trigger manual redeploy if needed

**Database connection errors:**
1. Verify `VITE_SUPABASE_URL` is correct
2. Check Supabase project isn't paused
3. Confirm anon key has correct permissions
