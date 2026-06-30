# 🚀 Deployment Guide

## Quick Start

### 1. Install Dependencies
```bash
cd scout-dashboard-nextjs
npm install
```

### 2. Set Up Supabase
Create a Supabase project at [supabase.com](https://supabase.com)

#### Required Tables
Run this SQL in your Supabase SQL editor:

```sql
-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  game TEXT,
  rank TEXT,
  region TEXT,
  esv_score INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  growth NUMERIC DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Shortlist table
CREATE TABLE shortlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_id UUID REFERENCES auth.users NOT NULL,
  player_id UUID REFERENCES players NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Prospect feed table
CREATE TABLE prospect_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- player_joined, esv_changed, highlight_uploaded, application_received
  player TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity timeline table
CREATE TABLE activity_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- profile_viewed, stats_updated, esv_changed, application_submitted
  player TEXT NOT NULL,
  scout TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Matches table
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1 TEXT NOT NULL,
  player2 TEXT NOT NULL,
  game TEXT NOT NULL,
  status TEXT NOT NULL, -- live, completed, upcoming
  score TEXT,
  time TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tournaments table
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  game TEXT NOT NULL,
  prize TEXT,
  date TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Set Environment Variables
Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...your-anon-key
```

### 4. Deploy to Vercel

#### Option A: Automatic (Recommended)
1. Push to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Set environment variables in Vercel dashboard
5. Deploy

#### Option B: CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --env NEXT_PUBLIC_SUPABASE_URL=your_supabase_url --env NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 5. Run Development Server
```bash
npm run dev
# Open http://localhost:3000/scout-dashboard
```

### 6. Build for Production
```bash
npm run build
npm run start
```

## Deployment Checklist

- [ ] Supabase project created
- [ ] Database tables created
- [ ] Environment variables set
- [ ] Dependencies installed
- [ ] Vercel project configured
- [ ] Domain connected (optional)
- [ ] SSL certificate (handled by Vercel)

## Troubleshooting

### Build Errors
- Check TypeScript errors: `npm run build`
- Check Tailwind imports
- Verify all components exist

### Supabase Errors
- Verify URL and anon key are correct
- Check table permissions (RLS)
- Ensure tables exist

### Realtime Issues
- Enable Realtime in Supabase dashboard
- Set replica identity for tables:
  ```sql
  ALTER TABLE prospect_feed REPLICA IDENTITY FULL;
  ALTER TABLE shortlist REPLICA IDENTITY FULL;
  ALTER TABLE activity_timeline REPLICA IDENTITY FULL;
  ```

## Performance Optimization

- Images are lazy-loaded
- Components use React Query caching
- Supabase Realtime is efficient
- Framer Motion animations are optimized
- Tailwind CSS is purged in production