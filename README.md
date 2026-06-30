# PakEsports Scout PRO

A Pakistani esports talent discovery platform with a **TikTok-style competitive clip feed**, **AI-powered ESV scoring**, and **role-separated** player vs scout experiences.

## Architecture

| Layer | Stack |
|-------|--------|
| Frontend | Vanilla HTML/CSS/JS (ES modules), mobile-first dark UI |
| Backend | Node.js, Express, modular routes |
| Database | PostgreSQL |
| Auth | JWT (24h), role-based guards |
| Realtime | Socket.io (chat) |

### Public flow
`Landing (index.html)` → Register/Login → Redirect by role:
- **player** → `pages/player/feed.html`
- **scout** → `pages/scout/feed.html`
- **admin** → `pages/admin.html`

Guests see **no dashboard navigation**.

## Project structure

```
PakEsports-Scout-PRO/
├── backend/
│   ├── server.js
│   ├── config.js
│   ├── db.js
│   ├── middleware.js
│   ├── schema.sql
│   ├── routes/          # auth, videos, analysis, scout, tournaments, admin, messages
│   ├── services/        # analyzeClip.js (mock AI)
│   ├── scripts/seed.js
│   └── uploads/         # local video storage
└── frontend/
    ├── index.html       # landing + auth only
    ├── pages/
    │   ├── player/      # feed, upload, profile, tournaments, messages
    │   ├── scout/       # discover feed, search, shortlist, tournaments, messages
    │   └── admin.html
    ├── components/feed.js
    ├── services/api.js, auth.js
    └── styles/main.css, feed.css
```

## Setup

### 1. PostgreSQL

```bash
createdb pakesports
psql -U postgres -d pakesports -f backend/schema.sql
cd backend
npm install
node scripts/seed.js
```

Edit `backend/db.js` if your Postgres credentials differ.

### 2. Backend

```bash
cd backend
npm install
npm start
# API: http://localhost:5000
```

### 3. Frontend

Serve the `frontend` folder with any static server (required for ES modules):

```bash
npx serve frontend -p 3000
# or: python -m http.server 3000 --directory frontend
```

Open `http://localhost:3000`

## Demo accounts

| User | Password | Role |
|------|----------|------|
| admin | admin123 | admin |
| pro_player | demo123 | player |
| scout_ali | demo123 | scout |
| krimson_pk | demo123 | player |

## API routes

| Prefix | Endpoints |
|--------|-----------|
| `/auth` | POST register, login, logout · GET me |
| `/videos` | POST upload · GET feed, :id, player/:userId · POST like, save, view, follow |
| `/analysis` | GET :videoId · POST analyze/:videoId |
| `/scout` | GET search, shortlist, report/:playerId · POST/DELETE shortlist/:playerId |
| `/tournaments` | GET / · POST / · POST /:id/register |
| `/admin` | GET users, stats · DELETE users/:id |
| `/messages` | GET / · POST / |

## Features vs original proposal

| Feature | Status |
|---------|--------|
| TikTok-style feed | ✅ Core UX |
| AI ESV in-feed capsule + slide-up panel | ✅ |
| Upload → auto analyze → feed | ✅ |
| Role-separated dashboards | ✅ |
| Scout shortlist & search | ✅ |
| Tournament discovery | ✅ |
| Messaging | ✅ (basic) |
| Admin moderation | ✅ |
| Team/sponsor matching | ❌ Future |
| Real ML video analysis | ❌ Mock service (`analyzeClip.js`) |
| PandaScore/Liquipedia APIs | ❌ Not integrated |

## Testing checklist

- [ ] Guest cannot open `/pages/player/feed.html` (redirects to login)
- [ ] Player login lands on player feed, not scout
- [ ] Scout login lands on scout discover feed with filters
- [ ] ESV capsule opens analysis panel without page navigation
- [ ] Upload clip appears in feed after submit
- [ ] Scout can shortlist from feed and search
- [ ] Admin can list/delete users
- [ ] Vertical feed snap-scroll plays active video only

## Migration from old version

1. **Backup** existing `pakesports` database.
2. Run new `schema.sql` (drops old `players` roster table).
3. Run `node scripts/seed.js`.
4. Replace frontend usage: old `script.js` monolith → ES modules under `services/` and `components/`.
5. API paths changed: `/login` → `/auth/login`, `/players` → `/videos/feed`, etc.

## Assumptions

- Clips use uploaded files **or** external MP4 URLs for demos.
- AI analysis is **mocked** with realistic score ranges; swap `services/analyzeClip.js` for a real model later.
- Frontend mock feed works when API is offline (2 sample clips).
- `compare players` and tournament registration are UI stubs.

## Optional enhancements

- Infinite scroll (`offset` on `/videos/feed`)
- Video preloading for next card
- WebSocket live ESV updates
- Trending sidebar “Top Pakistani Pros”
