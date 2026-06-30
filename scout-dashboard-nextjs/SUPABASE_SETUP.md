# PakEsports Scout PRO - Supabase Setup for Next.js Dashboard

The scout-dashboard-nextjs app requires a Supabase project with the following schema:

## Required Tables

### players
- id (uuid, PK)
- username (text)
- game (text)
- rank (text)
- region (text)
- esv_score (int4)
- win_rate (float8)
- growth (float8)
- avatar (text, nullable)

### shortlist
- id (uuid, PK)
- scout_id (uuid, FK -> users)
- player_id (uuid, FK -> players)
- created_at (timestamptz)

### prospect_feed
- id (uuid, PK)
- player_id (uuid, FK -> players)
- action (text)
- timestamp (timestamptz)

### activity_timeline
- id (uuid, PK)
- scout_id (uuid, FK -> users)
- player_id (uuid, FK -> players)
- action (text)
- created_at (timestamptz)

### matches
- id (uuid, PK)
- team1 (text)
- team2 (text)
- game (text)
- score (text)
- status (text)
- start_time (timestamptz)

## Required RPC Functions

### get_dashboard_kpis()
Returns: { trendingProspects, shortlistedPlayers, pendingApplications, esvGrowth, newProspects, risingPlayers }

### get_regional_distribution()
Returns: { region, count }[]

## Configuration

Copy .env.example to .env.local and set:
- NEXT_PUBLIC_SUPABASE_URL: Your Supabase project URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY: Your Supabase anon/public key

Note: The vanilla frontend (in /frontend) does NOT use Supabase.
It connects to the Express backend at http://localhost:5000.
