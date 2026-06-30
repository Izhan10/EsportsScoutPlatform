# Scout Dashboard - Next.js Implementation

This is a complete redesign of the Scout Dashboard using Next.js + Tailwind CSS + shadcn/ui + Framer Motion + Supabase Realtime.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Animations**: Framer Motion
- **Realtime**: Supabase Realtime
- **Data Fetching**: React Query (TanStack Query)
- **Fonts**: Inter + JetBrains Mono

## Design Philosophy

Inspired by Linear, Vercel, Faceit, and modern SaaS CRMs:
- Clean, minimal interface
- Professional SaaS appearance
- No cyberpunk glowing effects
- Strong visual hierarchy
- Generous spacing

## Color Scheme

```css
Background: #050816 (dark navy)
Cards: #0B1223 (slightly lighter navy)
Primary Accent: #8B5CF6 (violet)
Success: #22C55E (green)
```

## Layout Structure

### Header
- Large greeting with time-based salutation
- Global search with command palette behavior
- Notification bell with unread count
- Profile menu with status indicator

### Top KPI Cards (4 cards)
1. Trending Prospects - Live count with change indicator
2. Shortlisted Players - Live count with change indicator
3. New Applications - Pending reviews count
4. Rising ESV - Percentage growth indicator

### Main Grid (70/30 split)

#### Left Section (70%)
1. Live Prospect Feed - Real-time activity stream
2. Hot Prospects - Large cards with player details

#### Right Section (30%)
1. My Shortlist - Compact cards with notes
2. Activity Timeline - Chronological feed
3. Regional Distribution - Compact bar chart

### Bottom Section
1. Recent Matches
2. Upcoming Tournaments

## Components

### UI Components (`components/ui/`)
- `card.tsx` - Base card component with hover effects
- `button.tsx` - Styled buttons with variants
- `avatar.tsx` - User avatars
- `skeleton.tsx` - Loading states
- `progress.tsx` - Progress bars for charts
- `dialog.tsx` - Modal dialogs

### Feature Components (`components/`)
- `kpi-card.tsx` - Animated KPI cards with real-time updates
- `hot-prospects.tsx` - Infinite scrolling prospect cards
- `live-prospect-feed.tsx` - Real-time activity stream
- `my-shortlist.tsx` - Shortlisted players list
- `activity-timeline.tsx` - Chronological timeline
- `regional-distribution.tsx` - Regional bar chart
- `recent-matches.tsx` - Recent match history
- `upcoming-tournaments.tsx` - Tournament schedule
- `command-menu.tsx` - Global search command palette

## Realtime Architecture

Uses Supabase Realtime subscriptions:
- `prospects` - Live prospect updates
- `applications` - Application status changes
- `shortlists` - Shortlist modifications
- `esv_updates` - ESV score changes

When data changes:
1. React Query invalidates queries automatically
2. Values animate smoothly
3. Pulse indicators highlight updated cards

## Setup Instructions

### 1. Install Dependencies
```bash
cd scout-dashboard-nextjs
npm install
```

### 2. Environment Variables
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Setup Supabase
Create tables:
- `players` - Player profiles
- `shortlist` - Scout shortlists
- `prospect_feed` - Live feed events
- `activity_timeline` - Historical events
- `matches` - Match history
- `tournaments` - Tournament data

### 4. Run Development Server
```bash
npm run dev
```

## Key Features

### Micro-interactions
- Framer Motion hover effects
- Smooth card elevation
- Animated counters
- Pulse dots for live events
- Subtle transitions

### Loading States
- shadcn Skeleton components
- No empty cards with "-"
- Error boundaries with retry buttons

### Responsive Design
- Desktop: 12-column grid
- Tablet: 8-column grid
- Mobile: Single column
- Maintains premium SaaS appearance

## File Structure

```
scout-dashboard-nextjs/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/
│   │   ├── avatar.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── progress.tsx
│   │   └── skeleton.tsx
│   ├── command-menu.tsx
│   ├── providers.tsx
│   ├── kpi-card.tsx
│   ├── hot-prospects.tsx
│   ├── live-prospect-feed.tsx
│   ├── my-shortlist.tsx
│   ├── activity-timeline.tsx
│   ├── regional-distribution.tsx
│   ├── recent-matches.tsx
│   └── upcoming-tournaments.tsx
├── lib/
│   ├── utils.ts
│   └── supabase/
│       └── client.ts
├── package.json
└── tailwind.config.js
```

## Customization

### Adding New KPI Cards
```tsx
<KpiCard
  icon={YourIcon}
  label="Your Metric"
  value={data.yourMetric}
  change={calculateChange(data.yourMetric, previousData.yourMetric)}
/>
```

### Adding Realtime Subscriptions
```tsx
const { data } = useQuery({
  queryKey: ['your-data'],
  queryFn: fetchData,
})

// In Supabase client
supabase.channel('your-channel').on('postgres_changes', ...)
```

## Next Steps

1. Implement proper Supabase RPC functions for KPIs
2. Add authentication context provider
3. Implement command menu search functionality
4. Add unit and integration tests
5. Set up proper error boundaries
6. Implement export functionality
7. Add comparison view period selector

## Design References

- Linear - Clean SaaS interface
- Vercel - Premium dashboard experience
- Faceit - Esports platform design
- Modern CRMs - Professional appearance

## Notes

This implementation follows best practices:
- Server components where appropriate
- Client components for interactivity
- Proper error boundaries
- Accessible components
- Responsive design
- Performance optimized