const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const DB_FILE = path.join(__dirname, 'database.json');
let usePostgres = false;

function initDb() {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!data.game_skill_analysis) data.game_skill_analysis = [];
    if (!data.conversations) data.conversations = [];
    if (!data.scout_activity) data.scout_activity = [];
    if (!data.teams) data.teams = [];
    if (!data.team_members) data.team_members = [];
    if (!data.recruitment_requests) data.recruitment_requests = [];
    if (!data.team_activity) data.team_activity = [];
    return data;
  } catch (e) {
    console.error('Error reading database.json, re-initializing...', e);
  }

  const demoHash = bcrypt.hashSync('demo123', 10);

  const db = {
    users: [
      { id: 1, username: 'pro_player', email: 'pro_player@pakesports.pk', password: demoHash, role: 'player', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=pro_player', bio: 'Valorant IGL from Lahore', city: 'Lahore', country: 'Pakistan', current_team: 'Portal Esports', main_game: 'Valorant', years_experience: 3, real_name: 'Ahmed Khan', liquipedia_id: '', liquipedia_url: '', liquipedia_verified: false, profile_source: 'manual', created_at: new Date().toISOString() },
      { id: 3, username: 'scout_ali', email: 'scout_ali@pakesports.pk', password: demoHash, role: 'scout', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=scout_ali', bio: 'Professional esports scout', city: 'Karachi', country: 'Pakistan', current_team: '', main_game: '', years_experience: 0, real_name: 'Ali Raza', liquipedia_id: '', liquipedia_url: '', liquipedia_verified: false, profile_source: 'manual', created_at: new Date().toISOString() },
      { id: 4, username: 'krimson_pk', email: 'krimson_pk@pakesports.pk', password: demoHash, role: 'player', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=krimson_pk', bio: 'Radiant duelist main', city: 'Islamabad', country: 'Pakistan', current_team: 'vanguard_pk', main_game: 'Valorant', years_experience: 2, real_name: 'Zain Malik', liquipedia_id: '', liquipedia_url: '', liquipedia_verified: false, profile_source: 'manual', created_at: new Date().toISOString() }
    ],
    player_profiles: [
      { user_id: 2, game: 'Valorant', rank: 'Immortal 3', kd_ratio: 1.25, preferred_role: 'Flex', esv_score: 91, achievements: 'Runner up Red Bull Campus Clutch 2025', teams_played: 'Portal Esports, pak_pros', cv_url: '' },
      { user_id: 4, game: 'Valorant', rank: 'Radiant', kd_ratio: 1.45, preferred_role: 'Duelist', esv_score: 94, achievements: 'MVP Dew Gamers Arena 2025', teams_played: 'vanguard_pk', cv_url: '' }
    ],
    scout_profiles: [
      { user_id: 3, experience: '5 years scouting and coaching in local tournaments', teams_coached: 'Karachi Kings esports, Team X', achievements: 'Recruited 12 professional players in south Asia', cv_url: '' }
    ],
    videos: [],
    video_likes: [],
    video_saves: [],
    follows: [],
    ai_analysis: [],
    shortlists: [],
    tournaments: [
      { id: 1, name: 'Red Bull Campus Clutch', game: 'Valorant', prize: '500,000 PKR', city: 'Islamabad', date: '2026-06-15' },
      { id: 2, name: 'Dew Gamers Arena', game: 'CS2', prize: '1,000,000 PKR', city: 'Lahore', date: '2026-07-20' },
      { id: 3, name: 'PUBG Mobile Pro League PK', game: 'PUBG Mobile', prize: '750,000 PKR', city: 'Karachi', date: '2026-08-01' }
    ],
    messages: [],
    conversations: [
      { id: 1, participant1_id: 2, participant2_id: 3, created_at: new Date().toISOString() }
    ],
    player_stats: [
      { player_id: 2, kd_ratio: 1.25, win_rate: 58.5, matches_played: 342, tournaments_played: 15, official_tournaments: 8, mvps: 3, highest_rank: 'Immortal 3' },
      { player_id: 4, kd_ratio: 1.45, win_rate: 62.3, matches_played: 521, tournaments_played: 22, official_tournaments: 12, mvps: 5, highest_rank: 'Radiant' }
    ],
    player_games: [
      { player_id: 2, game: 'Valorant' },
      { player_id: 4, game: 'Valorant' },
      { player_id: 4, game: 'CS2' }
    ],
    player_history: [
      { id: 1, player_id: 2, entry_type: 'team', title: 'Portal Esports', subtitle: 'IGL / Flex', entry_year: 2025 },
      { id: 2, player_id: 2, entry_type: 'tournament', title: 'Red Bull Campus Clutch', subtitle: 'Runner Up', entry_year: 2025 },
      { id: 3, player_id: 4, entry_type: 'team', title: 'vanguard_pk', subtitle: 'Duelist', entry_year: 2024 },
      { id: 4, player_id: 4, entry_type: 'achievement', title: 'MVP Dew Gamers Arena', subtitle: 'Valorant', entry_year: 2025 }
    ],
    scout_history: [
      { id: 1, scout_id: 3, entry_type: 'team', title: 'Karachi Kings Esports', subtitle: 'Head Scout', entry_year: 2022 },
      { id: 2, scout_id: 3, entry_type: 'achievement', title: 'Recruited 12+ Pro Players', subtitle: 'South Asia Region', entry_year: 2025 }
    ],
    internal_notes: [],
    social_verifications: [],
    selfie_verifications: [],
    game_skill_analysis: [],
    teams: [],
    team_members: [],
    recruitment_requests: [],
    team_activity: []
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  return db;
}

function readData() {
  return initDb();
}

function writeData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Custom in-memory regex SQL query processor
async function mockQuery(text, params = []) {
  const data = readData();
  const queryStr = text.replace(/\s+/g, ' ').trim();

  // --- 1. INSERT INTO users ---
  if (queryStr.startsWith('INSERT INTO users')) {
    const username = params[0];
    const email = params[1];
    const password = params[2];
    const role = params[3];
    const city = params[4];

    // Check unique constraints
    const exists = data.users.some(u => u.username === username || (email && u.email === email));
    if (exists) {
      const err = new Error('duplicate key value violates unique constraint');
      err.code = '23505';
      throw err;
    }

    const nextId = data.users.length ? Math.max(...data.users.map(u => u.id)) + 1 : 1;
    const newUser = {
      id: nextId,
      username,
      email: email || null,
      password,
      role: role || 'player',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      bio: '',
      city: city || 'Karachi',
      country: 'Pakistan',
      current_team: '',
      main_game: 'Valorant',
      years_experience: 0,
      real_name: '',
      liquipedia_id: '',
      liquipedia_url: '',
      liquipedia_verified: false,
      profile_source: 'manual',
      profile_status: 'community',
      claimed_by_user_id: null,
      verification_method: '',
      verification_code: '',
      verification_code_created_at: null,
      verified_by: null,
      verified_at: null,
      scout_score: 0,
      esports_value_score: 0,
      cover_image: '',
      social_links: {},
      liquipedia_data: {},
      nationality: 'Pakistani',
      created_at: new Date().toISOString()
    };

    data.users.push(newUser);
    writeData(data);

    return { rows: [newUser] };
  }

  // --- 2. SELECT FROM users (login, me, etc.) ---
  if (queryStr.includes('FROM users WHERE username = $1') || queryStr.includes('FROM users WHERE username=$1')) {
    const user = data.users.find(u => u.username === params[0]);
    return { rows: user ? [user] : [] };
  }

  if (queryStr.includes('scout_profiles') && queryStr.includes('FROM users') && queryStr.includes('player_profiles') && queryStr.includes('u.id = $1')) {
    const userId = parseInt(params[0], 10);
    const user = data.users.find(u => u.id === userId);
    if (!user) return { rows: [] };
    const pp = data.player_profiles.find(p => p.user_id === userId) || {};
    const ps = data.player_stats.find(s => s.player_id === userId) || {};
    const sp = data.scout_profiles.find(s => s.user_id === userId) || {};
    const result = {
      ...user,
      ...ps,
      ...pp,
      player_achievements: pp.achievements || '',
      teams_played: pp.teams_played || '',
      player_cv: pp.cv_url || '',
      scout_experience: sp.experience || '',
      scout_teams: sp.teams_coached || '',
      scout_achievements: sp.achievements || '',
      scout_cv: sp.cv_url || ''
    };
    console.log('[DB] /auth/me response keys:', Object.keys(result));
    console.log('[DB] /auth/me stats fields:', { kd_ratio: result.kd_ratio, win_rate: result.win_rate, matches_played: result.matches_played, highest_rank: result.highest_rank, acs: result.acs, adr: result.adr, headshot_percent: result.headshot_percent, clutch_percent: result.clutch_percent, player_achievements: result.player_achievements });
    console.log('[DB] /auth/me liquipedia_data:', result.liquipedia_data);
    return { rows: [result] };
  }

  function setUserField(user, field, val) {
    switch (field) {
      case 'years_experience': case 'scout_score': case 'esports_value_score':
        user[field] = parseInt(val, 10);
        break;
      case 'liquipedia_verified':
        user[field] = val === true || val === 'true' || val === true;
        break;
      case 'verified_by':
        user[field] = val === true || val === 'true' ? true : (parseInt(val, 10) || val || null);
        break;
      case 'liquipedia_data':
        try { user.liquipedia_data = typeof val === 'string' ? JSON.parse(val) : val; } catch { user.liquipedia_data = {}; }
        break;
      case 'social_links':
        try { user.social_links = typeof val === 'string' ? JSON.parse(val) : val; } catch { user.social_links = {}; }
        break;
      default:
        user[field] = val;
    }
  }

  // --- SELECT player detail for /players/:id (users + player_profiles JOIN) ---
  if (queryStr.includes('FROM users u') && queryStr.includes('LEFT JOIN player_profiles pp') && queryStr.includes("u.role = 'player'") && queryStr.includes('u.id = $1')) {
    const userId = parseInt(params[0], 10);
    const user = data.users.find(u => u.id === userId && u.role === 'player');
    if (!user) return { rows: [] };
    const pp = data.player_profiles.find(p => p.user_id === userId) || {};
    return { rows: [{ ...user, ...pp }] };
  }

  // --- SELECT scout detail for /scouts/:id (users + scout_profiles JOIN) ---
  if (queryStr.includes('FROM users u') && queryStr.includes('LEFT JOIN scout_profiles sp') && queryStr.includes("u.role = 'scout'") && queryStr.includes('u.id = $1')) {
    const userId = parseInt(params[0], 10);
    const user = data.users.find(u => u.id === userId && u.role === 'scout');
    if (!user) return { rows: [] };
    const sp = data.scout_profiles.find(p => p.user_id === userId) || {};
    return { rows: [{ ...user, ...sp }] };
  }

  // --- SELECT simple FROM users (single by id) ---
  if (queryStr.includes('FROM users') && (queryStr.includes('WHERE id = $1') || queryStr.includes('WHERE u.id = $1')) && !queryStr.includes('player_profiles')) {
    const userId = parseInt(params[0], 10);
    const user = data.users.find(u => u.id === userId);
    if (!user) return { rows: [] };
    const sp = queryStr.includes('LEFT JOIN scout_profiles') ? (data.scout_profiles.find(p => p.user_id === userId) || {}) : {};
    return { rows: [{ ...user, ...sp }] };
  }

  // --- UPDATE users ---
  if (queryStr.startsWith('UPDATE users SET') && !queryStr.includes('password')) {
    const idMatch = queryStr.match(/\$(\d+)\s*$/);
    const lastParamIndex = idMatch ? parseInt(idMatch[1], 10) : params.length;
    const userId = parseInt(params[lastParamIndex - 1], 10);

    const user = data.users.find(u => u.id === userId);
    console.log('[DB] UPDATE users user_id=' + userId + ' params:', JSON.stringify(params));
    if (user) {
      // Handle subquery: current_team = (SELECT name FROM teams WHERE id = $1)
      const subqueryRegex = /(\w+)\s*=\s*\(SELECT\s+(\w+)\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*\$(\d+)\)/g;
      let subMatch;
      while ((subMatch = subqueryRegex.exec(queryStr)) !== null) {
        const field = subMatch[1];
        const selectCol = subMatch[2];
        const fromTable = subMatch[3];
        const whereCol = subMatch[4];
        const paramIdx = parseInt(subMatch[5], 10) - 1;
        if (paramIdx < params.length) {
          const refId = parseInt(params[paramIdx], 10);
          if (fromTable === 'teams') {
            const refTeam = (data.teams || []).find(t => t.id === refId);
            if (refTeam) {
              setUserField(user, field, refTeam[selectCol] || '');
            }
          }
        }
      }

      // Extract COALESCE assignments: "field = COALESCE($N, field)"
      const coalesceRegex = /(\w+)\s*=\s*COALESCE\(\$(\d+),/g;
      let match;
      while ((match = coalesceRegex.exec(queryStr)) !== null) {
        const field = match[1];
        const paramIdx = parseInt(match[2], 10) - 1;
        if (paramIdx < params.length) {
          const val = params[paramIdx];
          if (val !== undefined && val !== null && val !== '') {
            setUserField(user, field, val);
          }
        }
      }
      // Extract hardcoded assignments: "field = 'value'" or "field = $N"
      const setClause = queryStr.substring(
        queryStr.indexOf('SET') + 4,
        queryStr.indexOf('WHERE')
      );
      const hardcodedRegex = /(\w+)\s*=\s*(?:'([^']*)'|true|false|CURRENT_TIMESTAMP|\$(\d+))/g;
      while ((match = hardcodedRegex.exec(setClause)) !== null) {
        const field = match[1];
        const strVal = match[2];
        const paramIdx = match[3] ? parseInt(match[3], 10) - 1 : -1;
        if (strVal !== undefined) {
          setUserField(user, field, strVal);
        } else if (paramIdx >= 0 && paramIdx < params.length) {
          setUserField(user, field, params[paramIdx]);
        } else if (match[0].includes('= true')) {
          setUserField(user, field, true);
        } else if (match[0].includes('= false')) {
          setUserField(user, field, false);
        } else if (match[0].includes('CURRENT_TIMESTAMP')) {
          setUserField(user, field, new Date().toISOString());
        }
      }
      writeData(data);
    }
    return { rows: user ? [user] : [] };
  }

  // --- UPDATE users SET password (used by reset-password) ---
  if (queryStr.startsWith('UPDATE users SET password = $1')) {
    const userId = parseInt(params[params.length - 1], 10);
    const user = data.users.find(u => u.id === userId);
    if (user) {
      user.password = params[0];
      writeData(data);
    }
    return { rows: user ? [user] : [] };
  }

  // --- 3. INSERT INTO player_profiles ---
  if (queryStr.startsWith('INSERT INTO player_profiles')) {
    console.log('[DB] INSERT INTO player_profiles params:', JSON.stringify(params));
    const colMatch = queryStr.match(/INSERT INTO player_profiles\s*\(([^)]+)\)/i);
    const columns = colMatch ? colMatch[1].split(',').map(c => c.trim()) : [];

    const COL_TO_KEY = {
      user_id: 'user_id', game: 'game', rank: 'rank', kd_ratio: 'kd_ratio',
      preferred_role: 'preferred_role', achievements: 'achievements',
      teams_played: 'teams_played', cv_url: 'cv_url', acs: 'acs', adr: 'adr',
      headshot_percent: 'headshot_percent', clutch_percent: 'clutch_percent',
      opening_duel_percent: 'opening_duel_percent', tournament_win_percent: 'tournament_win_percent',
      esv_score: 'esv_score', individual_achievements: 'individual_achievements',
    };

    const NUMERIC_FIELDS = new Set([
      'kd_ratio','acs','adr','headshot_percent','clutch_percent',
      'opening_duel_percent','tournament_win_percent','esv_score',
    ]);

    const entry = { user_id: parseInt(params[0], 10) };
    for (let i = 1; i < columns.length && i < params.length; i++) {
      const key = COL_TO_KEY[columns[i]];
      if (key) {
        if (key === 'individual_achievements') {
          try { entry[key] = typeof params[i] === 'string' ? JSON.parse(params[i]) : params[i]; } catch { entry[key] = []; }
        } else if (NUMERIC_FIELDS.has(key)) {
          entry[key] = params[i] !== undefined ? parseFloat(params[i]) : 0;
        } else {
          entry[key] = params[i] || '';
        }
      }
    }

    const DEFAULTS = {
      game: 'Valorant', rank: 'Unranked', kd_ratio: 1.0, preferred_role: 'Flex',
      achievements: '', teams_played: '', cv_url: '', esv_score: 0,
      acs: 0, adr: 0, headshot_percent: 0, clutch_percent: 0,
      opening_duel_percent: 0, tournament_win_percent: 0,
      individual_achievements: [],
    };
    const merged = { ...DEFAULTS, ...entry };

    let profile = data.player_profiles.find(p => p.user_id === merged.user_id);
    if (profile) {
      Object.assign(profile, merged);
    } else {
      profile = merged;
      data.player_profiles.push(profile);
    }
    writeData(data);
    return { rows: [profile] };
  }

  // --- INSERT INTO scout_profiles ---
  if (queryStr.startsWith('INSERT INTO scout_profiles')) {
    console.log('[DB] INSERT INTO scout_profiles params:', JSON.stringify(params));
    const colMatch = queryStr.match(/INSERT INTO scout_profiles\s*\(([^)]+)\)/i);
    const columns = colMatch ? colMatch[1].split(',').map(c => c.trim()) : [];

    const COL_TO_KEY = {
      user_id: 'user_id', experience: 'experience', teams_coached: 'teams_coached',
      achievements: 'achievements', cv_url: 'cv_url', organization: 'organization',
      coaching_specialty: 'coaching_specialty', best_achievement: 'best_achievement',
      years_experience: 'years_experience', profile_source: 'profile_source',
      liquipedia_id: 'liquipedia_id', liquipedia_url: 'liquipedia_url',
      liquipedia_verified: 'liquipedia_verified',
    };

    const entry = { user_id: parseInt(params[0], 10) };
    for (let i = 1; i < columns.length && i < params.length; i++) {
      const key = COL_TO_KEY[columns[i]];
      if (key) {
        if (key === 'years_experience') {
          entry[key] = params[i] !== undefined ? parseInt(params[i], 10) : 0;
        } else if (key === 'liquipedia_verified') {
          entry[key] = params[i] === true || params[i] === 'true' || params[i] === true;
        } else {
          entry[key] = params[i] || '';
        }
      }
    }

    const DEFAULTS = {
      experience: '', teams_coached: '', achievements: '', cv_url: '',
      organization: '', coaching_specialty: '', best_achievement: '',
      years_experience: 0, profile_source: 'manual', liquipedia_id: '',
      liquipedia_url: '', liquipedia_verified: false,
    };
    const merged = { ...DEFAULTS, ...entry };

    let profile = data.scout_profiles.find(p => p.user_id === merged.user_id);
    if (profile) {
      Object.assign(profile, merged);
    } else {
      profile = merged;
      data.scout_profiles.push(profile);
    }
    writeData(data);
    return { rows: [profile] };
  }

  // --- 4. INSERT INTO videos ---
  if (queryStr.startsWith('INSERT INTO videos')) {
    const userId = parseInt(params[0], 10);
    const url = params[1];
    const caption = params[2];
    const game = params[3];
    const rank = params[4];
    const esv = params[5] || 0;
    const views = params[6] || 0;
    const likes = params[7] || 0;

    const nextId = data.videos.length ? Math.max(...data.videos.map(v => v.id)) + 1 : 1;
    const video = {
      id: nextId,
      user_id: userId,
      video_url: url,
      thumbnail_url: '',
      caption: caption || '',
      game_title: game || 'Valorant',
      rank: rank || '',
      esv_score: esv,
      ai_feedback: '',
      uploaded_at: new Date().toISOString(),
      views,
      likes
    };

    data.videos.push(video);
    writeData(data);
    return { rows: [video] };
  }

  // --- 5. INSERT/UPDATE ai_analysis ---
  if (queryStr.startsWith('INSERT INTO ai_analysis')) {
    const videoId = parseInt(params[0], 10);
    const aim = params[1];
    const pos = params[2];
    const team = params[3];
    const cons = params[4];
    const dec = params[5];
    const summary = params[6];
    const recs = typeof params[7] === 'string' ? JSON.parse(params[7]) : params[7];

    let analysis = data.ai_analysis.find(a => a.video_id === videoId);
    if (!analysis) {
      analysis = { video_id: videoId };
      data.ai_analysis.push(analysis);
    }
    analysis.aim_score = aim;
    analysis.positioning_score = pos;
    analysis.teamwork_score = team;
    analysis.consistency_score = cons;
    analysis.decision_score = dec;
    analysis.summary = summary;
    analysis.recommendations = recs;

    writeData(data);
    return { rows: [analysis] };
  }

  // --- 6. UPDATE videos (ESV / feedback) ---
  if (queryStr.startsWith('UPDATE videos SET esv_score=$1')) {
    const esv = params[0];
    const feedback = params[1];
    const id = parseInt(params[2], 10);
    const video = data.videos.find(v => v.id === id);
    if (video) {
      video.esv_score = esv;
      video.ai_feedback = feedback;
      writeData(data);
    }
    return { rows: video ? [video] : [] };
  }

  if (queryStr.startsWith('UPDATE videos SET views = views + 1')) {
    const id = parseInt(params[0], 10);
    const video = data.videos.find(v => v.id === id);
    if (video) {
      video.views = (video.views || 0) + 1;
      writeData(data);
    }
    return { rows: video ? [video] : [] };
  }

  if (queryStr.startsWith('UPDATE videos SET likes =')) {
    const id = parseInt(params[0], 10);
    const video = data.videos.find(v => v.id === id);
    if (video) {
      if (queryStr.includes('+ 1')) {
        video.likes = (video.likes || 0) + 1;
      } else {
        video.likes = Math.max((video.likes || 0) - 1, 0);
      }
      writeData(data);
    }
    return { rows: video ? [video] : [] };
  }

  // --- 7. UPDATE player_profiles (GREATEST ESV) ---
  if (queryStr.startsWith('UPDATE player_profiles SET esv_score = GREATEST')) {
    const esv = params[0];
    const videoId = parseInt(params[1], 10);
    const video = data.videos.find(v => v.id === videoId);
    if (video) {
      const profile = data.player_profiles.find(p => p.user_id === video.user_id);
      if (profile) {
        profile.esv_score = Math.max(profile.esv_score || 0, esv);
        writeData(data);
      }
    }
    return { rows: [] };
  }

  // --- 7b. SELECT simple from videos ---
  if (queryStr.includes('FROM videos WHERE')) {
    // Simple queries like SELECT game_title, video_url FROM videos WHERE id=$1
    const videoId = parseInt(params[0], 10);
    const v = data.videos.find(x => x.id === videoId);
    if (!v) return { rows: [] };
    // Project only requested columns
    const cols = queryStr.substring(7, queryStr.indexOf('FROM')).split(',').map(c => c.trim().replace(/\s+/g, ' '));
    const projected = {};
    for (const col of cols) {
      const c = col.replace(/"/g, '').trim();
      projected[c] = v[c] || null;
    }
    return { rows: [projected] };
  }

  // --- 8. SELECT FROM videos (feed, player videos, details) ---
  if (queryStr.includes('FROM videos v')) {
    const activeUserId = parseInt(params[0], 10);
    const hasGameSkill = queryStr.includes('game_skill_analysis');
    const skillData = data.game_skill_analysis || [];
    let list = data.videos.map(v => {
      const u = data.users.find(usr => usr.id === v.user_id) || {};
      const a = data.ai_analysis.find(an => an.video_id === v.id) || {};
      const gs = hasGameSkill ? skillData.find(g => g.video_id === v.id) || {} : {};
      const liked = data.video_likes.some(l => l.video_id === v.id && l.user_id === activeUserId);
      const saved = data.video_saves.some(s => s.video_id === v.id && s.user_id === activeUserId);
      const following = data.follows.some(f => f.follower_id === activeUserId && f.following_id === v.user_id);
      const shortlisted = data.shortlists.some(s => s.scout_id === activeUserId && s.player_id === v.user_id);

      return {
        ...v,
        username: u.username || 'unknown',
        avatar: u.avatar || '',
        city: u.city || '',
        aim_score: a.aim_score,
        positioning_score: a.positioning_score,
        teamwork_score: a.teamwork_score,
        consistency_score: a.consistency_score,
        decision_score: a.decision_score,
        summary: a.summary,
        recommendations: a.recommendations,
        gs_skill_score: gs.skill_score,
        gs_game: gs.game,
        gs_confidence: gs.confidence,
        gs_source: gs.source,
        gs_metrics: gs.metrics,
        liked,
        saved,
        following,
        shortlisted
      };
    });

    // Filtering by v.user_id = $2
    if (queryStr.includes('v.user_id = $2')) {
      const targetUserId = parseInt(params[1], 10);
      list = list.filter(v => v.user_id === targetUserId);
    }
    // Filtering by v.id = $2
    if (queryStr.includes('v.id = $2')) {
      const targetId = parseInt(params[1], 10);
      list = list.filter(v => v.id === targetId);
    }
    // Filtering by video_saves existence (saved videos)
    if (queryStr.includes('WHERE EXISTS (SELECT 1 FROM video_saves vs WHERE vs.video_id=v.id')) {
      list = list.filter(v => data.video_saves.some(s => s.video_id === v.id && s.user_id === activeUserId));
    }
    // Filtering by v.id = $1 (details request)
    if (queryStr.includes('WHERE v.id = $1') && params.length === 1) {
      const targetId = parseInt(params[0], 10);
      list = list.filter(v => v.id === targetId);
    }

    // Advanced feed filters (game, rank, score, city)
    if (queryStr.includes('AND LOWER(v.game_title) LIKE')) {
      const gameVal = params.find(p => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'));
      if (gameVal) {
        const term = gameVal.slice(1, -1).toLowerCase();
        list = list.filter(v => v.game_title.toLowerCase().includes(term));
      }
    }
    if (queryStr.includes('v.esv_score >= $')) {
      const esvParamIdx = params.findIndex(p => typeof p === 'number' && p > 0 && p < 100);
      if (esvParamIdx !== -1) {
        list = list.filter(v => v.esv_score >= params[esvParamIdx]);
      }
    }

    // Sort
    if (queryStr.includes('ORDER BY gs.skill_score DESC')) {
      list.sort((a, b) => (b.gs_skill_score || 0) - (a.gs_skill_score || 0));
    } else if (queryStr.includes('ORDER BY v.esv_score DESC')) {
      list.sort((a, b) => (b.esv_score || 0) - (a.esv_score || 0));
    } else if (queryStr.includes('v.esv_score +')) {
      list.sort((a, b) => ((b.esv_score || 0) + (b.gs_skill_score || 0)) - ((a.esv_score || 0) + (a.gs_skill_score || 0)));
    } else {
      // Sort by uploaded_at DESC
      list.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
    }
    return { rows: list };
  }

  // --- 9. SELECT FROM ai_analysis (details view) ---
  if (queryStr.includes('FROM ai_analysis a') && queryStr.includes('WHERE a.video_id = $1')) {
    const videoId = parseInt(params[0], 10);
    const analysis = data.ai_analysis.find(x => x.video_id === videoId);
    const video = data.videos.find(v => v.id === videoId) || {};
    const skillData = data.game_skill_analysis || [];
    const gs = skillData.find(g => g.video_id === videoId) || {};
    if (!analysis) return { rows: [] };
    return { rows: [{ ...analysis, esv_score: video.esv_score, gs_skill_score: gs.skill_score, gs_game: gs.game, gs_confidence: gs.confidence, gs_source: gs.source, gs_metrics: gs.metrics }] };
  }

  // --- 10. INSERT/DELETE video_likes & video_saves ---
  if (queryStr.startsWith('SELECT 1 FROM video_likes')) {
    const exists = data.video_likes.some(l => l.video_id === params[0] && l.user_id === params[1]);
    return { rows: exists ? [{ 1: 1 }] : [] };
  }
  if (queryStr.startsWith('INSERT INTO video_likes')) {
    data.video_likes.push({ video_id: params[0], user_id: params[1] });
    writeData(data);
    return { rows: [] };
  }
  if (queryStr.startsWith('DELETE FROM video_likes')) {
    data.video_likes = data.video_likes.filter(l => !(l.video_id === params[0] && l.user_id === params[1]));
    writeData(data);
    return { rows: [] };
  }

  if (queryStr.startsWith('SELECT 1 FROM video_saves')) {
    const exists = data.video_saves.some(s => s.video_id === params[0] && s.user_id === params[1]);
    return { rows: exists ? [{ 1: 1 }] : [] };
  }
  if (queryStr.startsWith('INSERT INTO video_saves')) {
    data.video_saves.push({ video_id: params[0], user_id: params[1] });
    writeData(data);
    return { rows: [] };
  }
  if (queryStr.startsWith('DELETE FROM video_saves')) {
    data.video_saves = data.video_saves.filter(s => !(s.video_id === params[0] && s.user_id === params[1]));
    writeData(data);
    return { rows: [] };
  }

  // --- 11. FOLLOWS ---
  if (queryStr.startsWith('SELECT 1 FROM follows')) {
    const exists = data.follows.some(f => f.follower_id === params[0] && f.following_id === params[1]);
    return { rows: exists ? [{ 1: 1 }] : [] };
  }
  if (queryStr.startsWith('INSERT INTO follows')) {
    data.follows.push({ follower_id: params[0], following_id: params[1] });
    writeData(data);
    return { rows: [] };
  }
  if (queryStr.startsWith('DELETE FROM follows')) {
    data.follows = data.follows.filter(f => !(f.follower_id === params[0] && f.following_id === params[1]));
    writeData(data);
    return { rows: [] };
  }

  // --- 12. MESSAGES ---
  if (queryStr.startsWith('INSERT INTO messages')) {
    const conversationId = parseInt(params[0], 10);
    const senderId = parseInt(params[1], 10);
    const message = params[2];
    const messageType = (params[3] === undefined || params[3] === null) ? 'text' : params[3];
    const attachmentUrl = params[4] || '';
    const waveform = params[5] || '';
    const nextId = data.messages.length ? Math.max(...data.messages.map(m => m.id)) + 1 : 1;
    const msg = {
      id: nextId,
      conversation_id: conversationId,
      sender_id: senderId,
      message,
      message_type: messageType,
      attachment_url: attachmentUrl,
      waveform,
      read_at: null,
      created_at: new Date().toISOString()
    };
    data.messages.push(msg);
    writeData(data);
    return { rows: [msg] };
  }
  if (queryStr.includes('FROM messages WHERE conversation_id = $1')) {
    const convId = parseInt(params[0], 10);
    const msgs = data.messages.filter(m => m.conversation_id === convId).sort((a, b) => a.id - b.id);
    return { rows: msgs };
  }
  if (queryStr.startsWith('UPDATE messages SET read_at') && queryStr.includes('conversation_id = $1')) {
    const convId = parseInt(params[0], 10);
    const userId = parseInt(params[1], 10);
    data.messages.forEach(m => {
      if (m.conversation_id === convId && m.sender_id !== userId && !m.read_at) {
        m.read_at = new Date().toISOString();
      }
    });
    writeData(data);
    return { rows: [] };
  }
  // COUNT(*) FROM messages WHERE conversation_id IN (SELECT...) -- for notifications route
  if (queryStr.includes('COUNT(*) AS cnt FROM messages') && queryStr.includes('conversation_id IN (') && queryStr.includes('SELECT id FROM conversations WHERE participant1_id') && queryStr.includes('sender_id != ') && queryStr.includes('read_at IS NULL') && !queryStr.includes('conversation_id =')) {
    const userId = parseInt(params[0], 10);
    const convIds = data.conversations.filter(c => c.participant1_id === userId || c.participant2_id === userId).map(c => c.id);
    const count = data.messages.filter(m => convIds.includes(m.conversation_id) && m.sender_id !== userId && !m.read_at).length;
    return { rows: [{ count }] };
  }

  if (queryStr.includes('COUNT(*) FROM messages WHERE conversation_id') && queryStr.includes('read_at IS NULL')) {
    const convId = parseInt(params[0], 10);
    const userId = parseInt(params[1], 10);
    const count = data.messages.filter(m => m.conversation_id === convId && m.sender_id !== userId && !m.read_at).length;
    return { rows: [{ count }] };
  }

  if (queryStr.includes('m.conversation_id IN (') && queryStr.includes('SELECT id FROM conversations WHERE participant1_id') && queryStr.includes('FROM messages m JOIN users u')) {
    const userId = parseInt(params[0], 10);
    const convIds = data.conversations
      .filter(c => c.participant1_id === userId || c.participant2_id === userId)
      .map(c => c.id);
    const unread = data.messages
      .filter(m => convIds.includes(m.conversation_id) && m.sender_id !== userId && !m.read_at)
      .map(m => {
        const sender = data.users.find(u => u.id === m.sender_id) || {};
        return {
          id: m.id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          message: m.message,
          created_at: m.created_at,
          sender_name: sender.username || 'Unknown',
          sender_avatar: sender.avatar || '',
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20);
    return { rows: unread };
  }

  // --- 12b. CONVERSATIONS ---
  if (queryStr.startsWith('SELECT * FROM conversations') && queryStr.includes('WHERE id = $1') && !queryStr.includes('participant1_id')) {
    const convId = parseInt(params[0], 10);
    const conv = data.conversations.find(c => c.id === convId);
    return { rows: conv ? [conv] : [] };
  }
  if (queryStr.includes('FROM conversations c') && queryStr.includes('JOIN users u') && queryStr.includes('WHERE c.id = $2')) {
    const userId = parseInt(params[0], 10);
    const convId = parseInt(params[1], 10);
    const conv = data.conversations.find(c => c.id === convId);
    if (!conv || (conv.participant1_id !== userId && conv.participant2_id !== userId)) {
      return { rows: [] };
    }
    const otherId = conv.participant1_id === userId ? conv.participant2_id : conv.participant1_id;
    const otherUser = data.users.find(u => u.id === otherId) || {};
    return {
      rows: [{
        id: conv.id,
        created_at: conv.created_at,
        other_id: otherUser.id,
        username: otherUser.username,
        avatar: otherUser.avatar || '',
        role: otherUser.role,
      }],
    };
  }
  if (queryStr.includes('FROM conversations') && queryStr.includes('participant1_id') && queryStr.includes('participant2_id')) {
    const uid1 = parseInt(params[0], 10);
    const uid2 = params[1] ? parseInt(params[1], 10) : null;
    if (uid2 !== null) {
      const conv = data.conversations.find(c =>
        (c.participant1_id === uid1 && c.participant2_id === uid2) ||
        (c.participant1_id === uid2 && c.participant2_id === uid1)
      );
      return { rows: conv ? [conv] : [] };
    }
    const userId = uid1;
    const list = data.conversations
      .filter(c => c.participant1_id === userId || c.participant2_id === userId)
      .map(c => {
        const otherId = c.participant1_id === userId ? c.participant2_id : c.participant1_id;
        const otherUser = data.users.find(u => u.id === otherId) || {};
        const lastMsg = data.messages.filter(m => m.conversation_id === c.id).sort((a, b) => b.id - a.id)[0] || null;
        const unread = data.messages.filter(m => m.conversation_id === c.id && m.sender_id !== userId && !m.read_at).length;
        return {
          id: c.id,
          otherUser: {
            id: otherUser.id,
            username: otherUser.username,
            avatar: otherUser.avatar || '',
            role: otherUser.role
          },
          lastMessage: lastMsg ? { text: lastMsg.message, createdAt: lastMsg.created_at, senderId: lastMsg.sender_id, messageType: lastMsg.message_type || 'text', attachmentUrl: lastMsg.attachment_url || '' } : null,
          unreadCount: unread,
          createdAt: c.created_at
        };
      });
    list.sort((a, b) => {
      const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.createdAt).getTime();
      const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
    return { rows: list };
  }
  if (queryStr.includes('COUNT(*)') && queryStr.includes('FROM conversations') && queryStr.includes('participant1_id')) {
    const userId = parseInt(params[0], 10);
    const count = data.conversations.filter(c => c.participant1_id === userId || c.participant2_id === userId).length;
    return { rows: [{ count }] };
  }
  if (queryStr.startsWith('INSERT INTO conversations')) {
    const p1 = parseInt(params[0], 10);
    const p2 = parseInt(params[1], 10);
    const existing = data.conversations.find(c =>
      (c.participant1_id === p1 && c.participant2_id === p2) ||
      (c.participant1_id === p2 && c.participant2_id === p1)
    );
    if (existing) {
      return { rows: [existing] };
    }
    const nextId = data.conversations.length ? Math.max(...data.conversations.map(c => c.id)) + 1 : 1;
    const conv = { id: nextId, participant1_id: p1, participant2_id: p2, created_at: new Date().toISOString() };
    data.conversations.push(conv);
    writeData(data);
    return { rows: [conv] };
  }

  // --- 13. TOURNAMENTS ---
  if (queryStr.startsWith('SELECT * FROM tournaments')) {
    return { rows: data.tournaments };
  }
  if (queryStr.startsWith('INSERT INTO tournaments')) {
    const name = params[0];
    const game = params[1];
    const prize = params[2];
    const city = params[3];
    const date = params[4];
    const createdBy = params[5];

    const nextId = data.tournaments.length ? Math.max(...data.tournaments.map(t => t.id)) + 1 : 1;
    const tour = {
      id: nextId,
      name,
      game,
      prize,
      city,
      date,
      created_by: createdBy
    };
    data.tournaments.push(tour);
    writeData(data);
    return { rows: [tour] };
  }

  // --- 14. SHORTLISTS ---
  if (queryStr.startsWith('INSERT INTO shortlists')) {
    const scoutId = parseInt(params[0], 10);
    const playerId = parseInt(params[1], 10);
    const exists = data.shortlists.some(s => s.scout_id === scoutId && s.player_id === playerId);
    if (!exists) {
      data.shortlists.push({ scout_id: scoutId, player_id: playerId, created_at: new Date().toISOString() });
      writeData(data);
    }
    return { rows: [] };
  }
  if (queryStr.startsWith('DELETE FROM shortlists')) {
    const scoutId = parseInt(params[0], 10);
    const playerId = parseInt(params[1], 10);
    data.shortlists = data.shortlists.filter(s => !(s.scout_id === scoutId && s.player_id === playerId));
    writeData(data);
    return { rows: [] };
  }
  if (queryStr.includes('FROM shortlists s')) {
    const scoutId = parseInt(params[0], 10);
    const list = data.shortlists
      .filter(s => s.scout_id === scoutId)
      .map(s => {
        const u = data.users.find(usr => usr.id === s.player_id) || {};
        const p = data.player_profiles.find(prof => prof.user_id === s.player_id) || {};
        return {
          id: u.id,
          username: u.username,
          avatar: u.avatar || '',
          city: u.city || '',
          game: p.game || 'Valorant',
          rank: p.rank || 'Unranked',
          esv_score: p.esv_score || 0,
          created_at: s.created_at
        };
      });
    return { rows: list };
  }

  // --- 15. SCOUT SEARCH ---
  if (queryStr.includes('FROM users u JOIN player_profiles pp') && queryStr.includes("u.role = 'player'")) {
    let list = data.users
      .filter(u => u.role === 'player')
      .map(u => {
        const p = data.player_profiles.find(prof => prof.user_id === u.id) || {};
        const clips = data.videos.filter(v => v.user_id === u.id);
        return {
          id: u.id,
          username: u.username,
          avatar: u.avatar || '',
          bio: u.bio || '',
          city: u.city || '',
          game: p.game || 'Valorant',
          rank: p.rank || 'Unranked',
          kd_ratio: p.kd_ratio || 1.0,
          preferred_role: p.preferred_role || 'Flex',
          esv_score: p.esv_score || 0,
          clip_count: clips.length
        };
      });

    const qVal = params.find(p => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'));
    if (qVal) {
      const term = qVal.slice(1, -1).toLowerCase();
      list = list.filter(p => p.username.toLowerCase().includes(term) || p.city.toLowerCase().includes(term));
    }

    list.sort((a, b) => b.esv_score - a.esv_score);
    return { rows: list };
  }

  // --- 16. PLAYER_STATS ---
  if (queryStr.includes('FROM player_stats WHERE player_id = $1')) {
    const playerId = parseInt(params[0], 10);
    const stats = data.player_stats.find(s => s.player_id === playerId);
    return { rows: stats ? [stats] : [] };
  }
  if (queryStr.startsWith('INSERT INTO player_stats')) {
    console.log('[DB] INSERT INTO player_stats params:', JSON.stringify(params));
    const colMatch = queryStr.match(/INSERT INTO player_stats\s*\(([^)]+)\)/i);
    const columns = colMatch ? colMatch[1].split(',').map(c => c.trim()) : [];

    const COL_TO_KEY = {
      player_id: 'player_id', kd_ratio: 'kd_ratio', win_rate: 'win_rate',
      matches_played: 'matches_played', tournaments_played: 'tournaments_played',
      official_tournaments: 'official_tournaments', mvps: 'mvps',
      highest_rank: 'highest_rank', acs: 'acs', adr: 'adr',
      headshot_percent: 'headshot_percent', clutch_percent: 'clutch_percent',
      opening_duel_percent: 'opening_duel_percent', tournament_win_percent: 'tournament_win_percent',
    };

    const NUMERIC_FIELDS = new Set([
      'kd_ratio','win_rate','matches_played','tournaments_played',
      'official_tournaments','mvps','acs','adr','headshot_percent',
      'clutch_percent','opening_duel_percent','tournament_win_percent'
    ]);

    const entry = { player_id: parseInt(params[0], 10) };
    for (let i = 1; i < columns.length && i < params.length; i++) {
      const key = COL_TO_KEY[columns[i]];
      if (key) {
        entry[key] = key === 'highest_rank'
          ? (params[i] || '')
          : (params[i] !== undefined ? parseFloat(params[i]) : 0);
      }
    }

    const DEFAULTS = {
      kd_ratio: 1.0, win_rate: 0, matches_played: 0, tournaments_played: 0,
      official_tournaments: 0, mvps: 0, highest_rank: '',
      acs: 0, adr: 0, headshot_percent: 0, clutch_percent: 0,
      opening_duel_percent: 0, tournament_win_percent: 0,
    };
    const merged = { ...DEFAULTS, ...entry };

    let stats = data.player_stats.find(s => s.player_id === merged.player_id);
    if (stats) {
      Object.assign(stats, merged);
    } else {
      stats = merged;
      data.player_stats.push(stats);
    }
    writeData(data);
    return { rows: [stats] };
  }

  // --- 17a. SELECT FROM player_profiles ---
  if (queryStr.includes('FROM player_profiles') && queryStr.includes('WHERE user_id = $1') && !queryStr.includes('JOIN')) {
    const userId = parseInt(params[0], 10);
    const pp = data.player_profiles.find(p => p.user_id === userId) || {};
    return { rows: [pp] };
  }

  // --- 17b. PLAYER_GAMES ---
  if (queryStr.includes('FROM player_games WHERE player_id = $1')) {
    const playerId = parseInt(params[0], 10);
    const games = data.player_games.filter(g => g.player_id === playerId);
    return { rows: games };
  }
  if (queryStr.startsWith('INSERT INTO player_games')) {
    const playerId = parseInt(params[0], 10);
    const game = params[1];
    const exists = data.player_games.some(g => g.player_id === playerId && g.game === game);
    if (!exists) {
      data.player_games.push({ player_id: playerId, game });
      writeData(data);
    }
    return { rows: [{ player_id: playerId, game }] };
  }

  // --- 18. PLAYER_HISTORY ---
  if (queryStr.includes('FROM player_history WHERE player_id = $1')) {
    const playerId = parseInt(params[0], 10);
    const list = data.player_history.filter(h => h.player_id === playerId).sort((a, b) => (b.entry_year || 0) - (a.entry_year || 0));
    return { rows: list };
  }
  if (queryStr.startsWith('INSERT INTO player_history')) {
    const playerId = parseInt(params[0], 10);
    const entryType = params[1];
    const title = params[2];
    const subtitle = params[3] || '';
    const year = params[4] !== undefined ? parseInt(params[4], 10) : null;
    const nextId = data.player_history.length ? Math.max(...data.player_history.map(h => h.id)) + 1 : 1;
    const entry = { id: nextId, player_id: playerId, entry_type: entryType, title, subtitle, entry_year: year, created_at: new Date().toISOString() };
    data.player_history.push(entry);
    writeData(data);
    return { rows: [entry] };
  }
  if (queryStr.startsWith('DELETE FROM player_history WHERE player_id = $1')) {
    const playerId = parseInt(params[0], 10);
    data.player_history = data.player_history.filter(h => h.player_id !== playerId);
    writeData(data);
    return { rows: [] };
  }
  if (queryStr.startsWith('DELETE FROM player_history WHERE id = $1')) {
    const id = parseInt(params[0], 10);
    data.player_history = data.player_history.filter(h => h.id !== id);
    writeData(data);
    return { rows: [] };
  }

  // --- 19. SCOUT_HISTORY ---
  if (queryStr.includes('FROM scout_history WHERE scout_id = $1')) {
    const scoutId = parseInt(params[0], 10);
    const list = data.scout_history.filter(h => h.scout_id === scoutId).sort((a, b) => (b.entry_year || 0) - (a.entry_year || 0));
    return { rows: list };
  }
  if (queryStr.startsWith('INSERT INTO scout_history')) {
    const scoutId = parseInt(params[0], 10);
    const entryType = params[1];
    const title = params[2];
    const subtitle = params[3] || '';
    const year = params[4] !== undefined ? parseInt(params[4], 10) : null;
    const nextId = data.scout_history.length ? Math.max(...data.scout_history.map(h => h.id)) + 1 : 1;
    const entry = { id: nextId, scout_id: scoutId, entry_type: entryType, title, subtitle, entry_year: year, created_at: new Date().toISOString() };
    data.scout_history.push(entry);
    writeData(data);
    return { rows: [entry] };
  }
  if (queryStr.startsWith('DELETE FROM scout_history WHERE id = $1')) {
    const id = parseInt(params[0], 10);
    data.scout_history = data.scout_history.filter(h => h.id !== id);
    writeData(data);
    return { rows: [] };
  }

  // --- 20. INTERNAL_NOTES ---
  if (queryStr.includes('FROM internal_notes WHERE scout_id = $1 AND player_id = $2')) {
    const scoutId = parseInt(params[0], 10);
    const playerId = parseInt(params[1], 10);
    const note = data.internal_notes.find(n => n.scout_id === scoutId && n.player_id === playerId);
    return { rows: note ? [note] : [] };
  }
  if (queryStr.startsWith('INSERT INTO internal_notes')) {
    const scoutId = parseInt(params[0], 10);
    const playerId = parseInt(params[1], 10);
    const content = params[2];
    let note = data.internal_notes.find(n => n.scout_id === scoutId && n.player_id === playerId);
    if (note) {
      note.content = content;
      note.updated_at = new Date().toISOString();
    } else {
      const nextId = data.internal_notes.length ? Math.max(...data.internal_notes.map(n => n.id)) + 1 : 1;
      note = { id: nextId, scout_id: scoutId, player_id: playerId, content, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      data.internal_notes.push(note);
    }
    writeData(data);
    return { rows: [note] };
  }

  // --- 21. game_skill_analysis ---
  if (queryStr.startsWith('INSERT INTO game_skill_analysis')) {
    if (!data.game_skill_analysis) data.game_skill_analysis = [];
    const videoId = parseInt(params[0], 10);
    const game = params[1];
    const skillScore = params[2];
    const source = params[3];
    const confidence = params[4];
    const metrics = typeof params[5] === 'string' ? JSON.parse(params[5]) : params[5];
    let entry = data.game_skill_analysis.find(g => g.video_id === videoId);
    if (!entry) {
      entry = { video_id: videoId };
      data.game_skill_analysis.push(entry);
    }
    entry.game = game;
    entry.skill_score = skillScore;
    entry.source = source;
    entry.confidence = confidence;
    entry.metrics = metrics;
    entry.analyzed_at = new Date().toISOString();
    writeData(data);
    return { rows: [entry] };
  }

  // --- 22. SELECT FROM game_skill_analysis ---
  if (queryStr.includes('FROM game_skill_analysis')) {
    if (!data.game_skill_analysis) data.game_skill_analysis = [];
    let rows = data.game_skill_analysis;
    if (queryStr.includes('WHERE video_id')) {
      const videoId = parseInt(params[0], 10);
      rows = rows.filter(r => r.video_id === videoId);
    }
    return { rows };
  }

  // --- 23. ALL DISTINCT GAMES (union from tournaments, videos, player_profiles) ---
  if (queryStr.includes('SELECT DISTINCT game') && queryStr.includes('UNION') &&
      queryStr.includes('tournaments') && queryStr.includes('videos') && queryStr.includes('player_profiles')) {
    const games = new Set();
    data.tournaments.forEach(t => { if (t.game) games.add(t.game); });
    data.videos.forEach(v => { if (v.game_title) games.add(v.game_title); });
    data.player_profiles.forEach(p => { if (p.game) games.add(p.game); });
    const sorted = Array.from(games).sort();
    return { rows: sorted.map(g => ({ game: g })) };
  }

  // --- 24. VERIFICATION CODES ---
  if (queryStr.startsWith('INSERT INTO verification_codes')) {
    const userId = parseInt(params[0], 10);
    const code = params[1];
    const platform = params[2];
    const platformUrl = params[3] || '';
    const nextId = (data.verification_codes || []).length ? Math.max(...data.verification_codes.map(v => v.id)) + 1 : 1;
    const vc = { id: nextId, user_id: userId, code, platform, platform_url: platformUrl, status: 'pending', created_at: new Date().toISOString(), verified_at: null };
    if (!data.verification_codes) data.verification_codes = [];
    data.verification_codes.push(vc);
    writeData(data);
    return { rows: [vc] };
  }
  if (queryStr.includes('FROM verification_codes WHERE user_id = $1')) {
    const userId = parseInt(params[0], 10);
    const codes = (data.verification_codes || []).filter(v => v.user_id === userId);
    return { rows: codes };
  }
  if (queryStr.includes('FROM verification_codes') && queryStr.includes('user_id = $1') && queryStr.includes('code = $2')) {
    const userId = parseInt(params[0], 10);
    const code = params[1];
    const vc = (data.verification_codes || []).find(v => v.user_id === userId && v.code === code);
    return { rows: vc ? [vc] : [] };
  }
  if (queryStr.startsWith('UPDATE verification_codes SET status')) {
    const status = params[0];
    const id = parseInt(params[1], 10);
    const vc = (data.verification_codes || []).find(v => v.id === id);
    if (vc) { vc.status = status; vc.verified_at = new Date().toISOString(); writeData(data); }
    return { rows: vc ? [vc] : [] };
  }

  // --- 25a. SOCIAL VERIFICATIONS ---
  if (queryStr.startsWith('INSERT INTO social_verifications') && !queryStr.includes('verification')) {
    const userId = parseInt(params[0], 10);
    const provider = params[1];
    const providerUserId = params[2] || '';
    const username = params[3] || '';
    const verificationCode = params[4] || '';
    const codeExpiresStr = params[5] || null;
    if (!data.social_verifications) data.social_verifications = [];
    const nextId = data.social_verifications.length ? Math.max(...data.social_verifications.map(s => s.id)) + 1 : 1;
    const sv = {
      id: nextId,
      user_id: userId,
      provider,
      provider_user_id: providerUserId,
      username,
      verification_code: verificationCode,
      code_expires_at: codeExpiresStr,
      verified: false,
      verified_at: null,
      created_at: new Date().toISOString()
    };
    data.social_verifications.push(sv);
    writeData(data);
    return { rows: [sv] };
  }

  if (queryStr.includes('FROM social_verifications') && queryStr.includes('WHERE user_id = $1') && queryStr.includes('provider = $2')) {
    const userId = parseInt(params[0], 10);
    const provider = params[1];
    const sv = (data.social_verifications || []).find(s => s.user_id === userId && s.provider === provider);
    return { rows: sv ? [sv] : [] };
  }

  if (queryStr.includes('FROM social_verifications') && queryStr.includes('WHERE user_id = $1') && queryStr.includes('verification_code = $2')) {
    const userId = parseInt(params[0], 10);
    const code = params[1];
    const sv = (data.social_verifications || []).find(s => s.user_id === userId && s.verification_code === code);
    return { rows: sv ? [sv] : [] };
  }

  if (queryStr.includes('FROM social_verifications') && queryStr.includes('WHERE user_id = $1') && !queryStr.includes('provider') && !queryStr.includes('code')) {
    const userId = parseInt(params[0], 10);
    const list = (data.social_verifications || []).filter(s => s.user_id === userId);
    return { rows: list };
  }

  if (queryStr.startsWith('UPDATE social_verifications SET verified = true')) {
    const id = parseInt(params[0], 10);
    const sv = (data.social_verifications || []).find(s => s.id === id);
    if (sv) { sv.verified = true; sv.verified_at = new Date().toISOString(); writeData(data); }
    return { rows: sv ? [sv] : [] };
  }

  // --- 25b. SELFIE VERIFICATIONS ---
  if (queryStr.startsWith('INSERT INTO selfie_verifications')) {
    const userId = parseInt(params[0], 10);
    const imageUrl = params[1] || '';
    if (!data.selfie_verifications) data.selfie_verifications = [];
    const nextId = data.selfie_verifications.length ? Math.max(...data.selfie_verifications.map(s => s.id)) + 1 : 1;
    const sf = {
      id: nextId,
      user_id: userId,
      image_url: imageUrl,
      verified_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    const existing = data.selfie_verifications.find(s => s.user_id === userId);
    if (existing) {
      Object.assign(existing, sf);
    } else {
      data.selfie_verifications.push(sf);
    }
    writeData(data);
    return { rows: [sf] };
  }

  if (queryStr.includes('FROM selfie_verifications') && queryStr.includes('WHERE user_id = $1')) {
    const userId = parseInt(params[0], 10);
    const sf = (data.selfie_verifications || []).find(s => s.user_id === userId) || null;
    return { rows: sf ? [sf] : [] };
  }

  // --- 25. VERIFICATION REQUESTS ---
  if (queryStr.startsWith('INSERT INTO verification_requests')) {
    const userId = parseInt(params[0], 10);
    const method = params[1];
    const evidenceUrls = params[2] || '';
    const notes = params[3] || '';
    const nextId = (data.verification_requests || []).length ? Math.max(...data.verification_requests.map(v => v.id)) + 1 : 1;
    const vr = { id: nextId, user_id: userId, method, status: 'pending', reviewed_by: null, evidence_urls: evidenceUrls, notes, created_at: new Date().toISOString(), reviewed_at: null };
    if (!data.verification_requests) data.verification_requests = [];
    data.verification_requests.push(vr);
    writeData(data);
    return { rows: [vr] };
  }
  if (queryStr.includes('FROM verification_requests')) {
    const list = (data.verification_requests || []).map(vr => {
      const u = data.users.find(u => u.id === vr.user_id) || {};
      const rvu = vr.reviewed_by ? data.users.find(u => u.id === vr.reviewed_by) : null;
      return { ...vr, username: u.username, reviewer_username: rvu ? rvu.username : null };
    });
    if (queryStr.includes('WHERE user_id = $1')) {
      const userId = parseInt(params[0], 10);
      return { rows: list.filter(v => v.user_id === userId) };
    }
    if (queryStr.includes('WHERE id = $1')) {
      const id = parseInt(params[0], 10);
      return { rows: list.filter(v => v.id === id) };
    }
    if (queryStr.includes('WHERE status = $1')) {
      const status = params[0];
      return { rows: list.filter(v => v.status === status) };
    }
    return { rows: list };
  }
  if (queryStr.startsWith('UPDATE verification_requests SET status')) {
    const status = params[0];
    const reviewedBy = params[1] ? parseInt(params[1], 10) : null;
    const id = parseInt(params[2], 10);
    const vr = (data.verification_requests || []).find(v => v.id === id);
    if (vr) { vr.status = status; vr.reviewed_by = reviewedBy; vr.reviewed_at = new Date().toISOString(); writeData(data); }
    return { rows: vr ? [vr] : [] };
  }

  // --- 26. SCOUT ACTIVITY ---
  if (queryStr.includes('FROM scout_activity sa') && queryStr.includes('JOIN users u')) {
    if (!data.scout_activity) data.scout_activity = [];
    const scoutId = parseInt(params[0], 10);
    let list = (data.scout_activity || [])
      .filter(a => a.scout_id === scoutId)
      .map(a => {
        const u = data.users.find(usr => usr.id === a.player_id) || {};
        return { ...a, username: u.username || 'Unknown', avatar: u.avatar || '', role: u.role || '' };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 30);
    return { rows: list };
  }
  if (queryStr.includes('FROM scout_activity') && queryStr.includes('COUNT(*)')) {
    if (!data.scout_activity) data.scout_activity = [];
    const scoutId = parseInt(params[0], 10);
    const activityType = params[1] || null;
    let count = data.scout_activity.filter(a => a.scout_id === scoutId);
    if (activityType) count = count.filter(a => a.activity_type === activityType);
    return { rows: [{ count: count.length }] };
  }
  if (queryStr.startsWith('INSERT INTO scout_activity')) {
    if (!data.scout_activity) data.scout_activity = [];
    const scoutId = parseInt(params[0], 10);
    const playerId = parseInt(params[1], 10);
    const activityType = params[2];
    const entry = { id: Date.now(), scout_id: scoutId, player_id: playerId, activity_type: activityType, created_at: new Date().toISOString() };
    data.scout_activity.push(entry);
    writeData(data);
    return { rows: [entry] };
  }

  // --- 27. CONVERSATIONS UNREAD (JOIN messages + users) ---
  if (queryStr.includes('FROM messages m') && queryStr.includes('JOIN users u') && queryStr.includes('m.read_at IS NULL')) {
    const userId = parseInt(params[0], 10);
    const myConvs = data.conversations.filter(c => c.participant1_id === userId || c.participant2_id === userId);
    const convIds = myConvs.map(c => c.id);
    const unread = data.messages
      .filter(m => convIds.includes(m.conversation_id) && m.sender_id !== userId && !m.read_at)
      .map(m => {
        const sender = data.users.find(u => u.id === m.sender_id) || {};
        return {
          id: m.id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          message: m.message || '',
          created_at: m.created_at,
          sender_name: sender.username || 'Unknown',
          sender_avatar: sender.avatar || '',
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20);
    return { rows: unread };
  }

  // --- 28. CONVERSATIONS READ-ALL (UPDATE messages SET read_at for all user conversations) ---
  if (queryStr.includes('UPDATE messages SET read_at') && queryStr.includes('CURRENT_TIMESTAMP') && !queryStr.includes('conversation_id = $1')) {
    const userId = parseInt(params[0], 10);
    const myConvs = data.conversations.filter(c => c.participant1_id === userId || c.participant2_id === userId);
    const convIds = myConvs.map(c => c.id);
    data.messages.forEach(m => {
      if (convIds.includes(m.conversation_id) && m.sender_id !== userId && !m.read_at) {
        m.read_at = new Date().toISOString();
      }
    });
    writeData(data);
    return { rows: [] };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 29. TEAMS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (queryStr.startsWith('INSERT INTO teams')) {
    const name = params[0];
    const game = params[1] || 'Valorant';
    const createdBy = parseInt(params[2], 10);
    const nextId = data.teams.length ? Math.max(...data.teams.map(t => t.id)) + 1 : 1;
    const team = { id: nextId, name, game, created_by: createdBy, created_at: new Date().toISOString() };
    if (!data.teams) data.teams = [];
    data.teams.push(team);
    writeData(data);
    return { rows: [team] };
  }

  if (queryStr.includes('FROM teams') && queryStr.includes('WHERE id = $1') && !queryStr.includes('created_by')) {
    const id = parseInt(params[0], 10);
    const team = (data.teams || []).find(t => t.id === id);
    return { rows: team ? [team] : [] };
  }

  if (queryStr.includes('FROM teams') && queryStr.includes('WHERE created_by = $1')) {
    const userId = parseInt(params[0], 10);
    const teams = (data.teams || []).filter(t => t.created_by === userId);
    return { rows: teams };
  }

  if (queryStr.includes('FROM teams') && queryStr.includes('WHERE name = $1') && queryStr.includes('created_by = $2')) {
    const name = params[0];
    const createdBy = parseInt(params[1], 10);
    const team = (data.teams || []).find(t => t.name === name && t.created_by === createdBy);
    return { rows: team ? [team] : [] };
  }

  if ((queryStr.includes('SELECT * FROM teams') || queryStr.includes('SELECT id, name, game')) && !queryStr.includes('WHERE')) {
    return { rows: (data.teams || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 30. TEAM MEMBERS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // COUNT(*) FROM team_members (must come before the generic SELECT handler)
  if (queryStr.includes('COUNT(*)') && queryStr.includes('FROM team_members')) {
    const hasTeamId = queryStr.includes('team_id = $1') || queryStr.includes('tm.team_id = $1');
    const hasPlayerId = queryStr.includes('player_id = $1') || queryStr.includes('tm.player_id = $1');
    const statusMatch = queryStr.match(/status\s*=\s*'(\w+)'/);
    const status = statusMatch ? statusMatch[1] : null;

    let teamId, playerId, paramIdx = 0;
    if (hasTeamId) { teamId = parseInt(params[paramIdx], 10); paramIdx++; }
    if (hasPlayerId) { playerId = parseInt(params[paramIdx], 10); paramIdx++; }

    let list = (data.team_members || []).slice();
    if (teamId) list = list.filter(m => m.team_id === teamId);
    if (playerId) list = list.filter(m => m.player_id === playerId);
    if (status) list = list.filter(m => m.status === status);

    return { rows: [{ cnt: list.length }] };
  }

  // SELECT * FROM team_members WHERE team_id = $1 AND player_id = $2 AND status = 'active' (no tm. alias)
  if (queryStr.includes('FROM team_members WHERE') && !queryStr.includes('tm.') && !queryStr.includes('JOIN')) {
    const hasTeamId = queryStr.includes('team_id = $1');
    const hasPlayerId = queryStr.includes('player_id = $2');
    const hasPlayerId1 = queryStr.includes('player_id = $1');
    const statusMatch = queryStr.match(/status\s*=\s*'(\w+)'/);
    const status = statusMatch ? statusMatch[1] : null;

    let teamId, playerId;
    if (hasTeamId) teamId = parseInt(params[0], 10);
    if (hasPlayerId) playerId = parseInt(params[1], 10);
    if (hasPlayerId1 && !hasTeamId) playerId = parseInt(params[0], 10);

    let list = (data.team_members || []).slice();
    if (teamId) list = list.filter(m => m.team_id === teamId);
    if (playerId) list = list.filter(m => m.player_id === playerId);
    if (status) list = list.filter(m => m.status === status);

    return { rows: list };
  }

  if (queryStr.startsWith('INSERT INTO team_members')) {
    const teamId = parseInt(params[0], 10);
    const playerId = parseInt(params[1], 10);
    const role = params[2] || 'player';
    const status = params[3] || 'active';
    if (!data.team_members) data.team_members = [];
    const existing = data.team_members.find(m => m.team_id === teamId && m.player_id === playerId && m.status === 'active');
    if (existing) {
      return { rows: [existing] };
    }
    const nextId = data.team_members.length ? Math.max(...data.team_members.map(m => m.id)) + 1 : 1;
    const member = { id: nextId, team_id: teamId, player_id: playerId, role, status, joined_at: new Date().toISOString(), left_at: null };
    data.team_members.push(member);
    writeData(data);
    return { rows: [member] };
  }

  // UPDATE team_members SET status = 'former', left_at = CURRENT_TIMESTAMP WHERE player_id = $1 AND status = 'active'
  if (queryStr.startsWith('UPDATE team_members SET status') && queryStr.includes('left_at') && queryStr.includes('player_id = $1')) {
    const playerId = parseInt(params[0], 10);
    const m = (data.team_members || []).find(mm => mm.player_id === playerId && mm.status === 'active');
    if (m) {
      const oldStatus = m.status;
      m.status = 'former';
      m.left_at = new Date().toISOString();
      writeData(data);
    }
    return { rows: m ? [m] : [] };
  }

  // SELECT tm.* FROM team_members tm WHERE ... (no JOIN)
  if (queryStr.includes('FROM team_members tm WHERE') && !queryStr.includes('JOIN')) {
    const hasTeamId = queryStr.includes('tm.team_id = $1');
    const hasPlayerId = queryStr.includes('tm.player_id = $1');
    const statusMatch = queryStr.match(/tm\.status\s*=\s*'(\w+)'/);

    let teamId, playerId, status;
    if (hasTeamId) teamId = parseInt(params[0], 10);
    if (hasPlayerId) playerId = parseInt(params[0], 10);
    if (statusMatch) status = statusMatch[1];

    let list = (data.team_members || []).slice();
    if (teamId) list = list.filter(m => m.team_id === teamId);
    if (playerId) list = list.filter(m => m.player_id === playerId);
    if (status) list = list.filter(m => m.status === status);

    return { rows: list };
  }

  // UPDATE team_members SET role = $1 WHERE id = $2
  if (queryStr.startsWith('UPDATE team_members SET role') && queryStr.includes('WHERE id = $2')) {
    const role = params[0];
    const id = parseInt(params[1], 10);
    const m = (data.team_members || []).find(mm => mm.id === id);
    if (m) { m.role = role; writeData(data); }
    return { rows: m ? [m] : [] };
  }

  // SELECT tm.*, u.username, u.avatar FROM team_members tm JOIN users u
  if (queryStr.includes('FROM team_members tm') && queryStr.includes('JOIN users u')) {
    const hasTeamId = queryStr.includes('tm.team_id = $1');
    const hasPlayerId = queryStr.includes('tm.player_id = $1');
    const statusMatch = queryStr.match(/tm\.status\s*=\s*'(\w+)'/);
    const hasOrderLeftAt = queryStr.includes('ORDER BY tm.left_at DESC');

    let teamId, playerId, status;

    if (hasTeamId) teamId = parseInt(params[0], 10);
    if (hasPlayerId) playerId = parseInt(params[0], 10);
    if (statusMatch) status = statusMatch[1];

    let list = (data.team_members || []).map(m => {
      const u = data.users.find(usr => usr.id === m.player_id) || {};
      return { ...m, username: u.username || 'Unknown', avatar: u.avatar || '' };
    });

    if (teamId) list = list.filter(m => m.team_id === teamId);
    if (playerId) list = list.filter(m => m.player_id === playerId);
    if (status) list = list.filter(m => m.status === status);

    if (hasOrderLeftAt) {
      list.sort((a, b) => {
        if (a.left_at && b.left_at) return new Date(b.left_at) - new Date(a.left_at);
        if (a.left_at) return 1;
        if (b.left_at) return -1;
        return 0;
      });
    }

    return { rows: list };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 31. RECRUITMENT REQUESTS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (queryStr.startsWith('INSERT INTO recruitment_requests')) {
    const teamId = parseInt(params[0], 10);
    const scoutId = parseInt(params[1], 10);
    const playerId = parseInt(params[2], 10);
    const message = params[3] || '';
    const nextId = data.recruitment_requests.length ? Math.max(...data.recruitment_requests.map(r => r.id)) + 1 : 1;
    const rr = { id: nextId, team_id: teamId, scout_id: scoutId, player_id: playerId, message, status: 'pending', created_at: new Date().toISOString() };
    if (!data.recruitment_requests) data.recruitment_requests = [];
    data.recruitment_requests.push(rr);
    writeData(data);
    return { rows: [rr] };
  }

  // SELECT with JOIN for pending requests by player
  if (queryStr.includes('FROM recruitment_requests rr') && queryStr.includes('JOIN teams t') && queryStr.includes('JOIN users u')) {
    const isScoutQuery = queryStr.includes('rr.scout_id = $1');
    const id = parseInt(params[0], 10);
    const statusMatch = queryStr.match(/rr\.status\s*=\s*'(\w+)'/);
    const status = statusMatch ? statusMatch[1] : 'pending';

    let list = (data.recruitment_requests || []);

    if (isScoutQuery) {
      list = list.filter(r => r.scout_id === id && r.status === status);
    } else {
      list = list.filter(r => r.player_id === id && r.status === status);
    }

    list = list.map(r => {
      const t = (data.teams || []).find(tt => tt.id === r.team_id) || {};
      const scoutUser = data.users.find(usr => usr.id === r.scout_id) || {};
      const playerUser = data.users.find(usr => usr.id === r.player_id) || {};
      return {
        ...r,
        team_name: t.name || 'Unknown',
        scout_name: scoutUser.username || 'Unknown',
        scout_avatar: scoutUser.avatar || '',
        player_username: playerUser.username || 'Unknown',
        player_avatar: playerUser.avatar || '',
      };
    })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return { rows: list };
  }

  // SELECT * FROM recruitment_requests WHERE id = $1
  if (queryStr.includes('FROM recruitment_requests') && queryStr.includes('WHERE id = $1') && !queryStr.includes('JOIN')) {
    const id = parseInt(params[0], 10);
    const rr = (data.recruitment_requests || []).find(r => r.id === id);
    return { rows: rr ? [rr] : [] };
  }

  // UPDATE recruitment_requests SET status = '...' WHERE id = $1
  if (queryStr.startsWith('UPDATE recruitment_requests SET status')) {
    const statusMatch = queryStr.match(/SET\s+status\s*=\s*'(\w+)'/i);
    const status = statusMatch ? statusMatch[1] : params[0];
    const id = parseInt(params[0], 10);
    const rr = (data.recruitment_requests || []).find(r => r.id === id);
    if (rr) { rr.status = status; writeData(data); }
    return { rows: rr ? [rr] : [] };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 32. RECRUITMENT PERMISSIONS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (queryStr.startsWith('INSERT INTO recruitment_permissions')) {
    const scoutId = parseInt(params[0], 10);
    const playerId = parseInt(params[1], 10);
    if (!data.recruitment_permissions) data.recruitment_permissions = [];
    const existing = data.recruitment_permissions.find(r => r.scout_id === scoutId && r.player_id === playerId);
    if (existing) {
      existing.status = 'pending';
      existing.updated_at = new Date().toISOString();
      writeData(data);
      return { rows: [existing] };
    }
    const nextId = data.recruitment_permissions.length ? Math.max(...data.recruitment_permissions.map(r => r.id)) + 1 : 1;
    const rp = { id: nextId, scout_id: scoutId, player_id: playerId, status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    data.recruitment_permissions.push(rp);
    writeData(data);
    return { rows: [rp] };
  }

  // SELECT recruitment_permissions by various conditions
  if (queryStr.includes('FROM recruitment_permissions')) {
    if (!data.recruitment_permissions) data.recruitment_permissions = [];
    let list = [...data.recruitment_permissions];

    // Normalize query: strip table alias prefixes for pattern matching
    const rpQuery = queryStr.replace(/\b(?:rp|u|pp)\./g, '');

    // By scout_id and player_id (status check)
    if (rpQuery.includes('scout_id = $1') && rpQuery.includes('player_id = $2')) {
      const scoutId = parseInt(params[0], 10);
      const playerId = parseInt(params[1], 10);
      list = list.filter(r => r.scout_id === scoutId && r.player_id === playerId);
    }
    // By player_id (with optional status filter)
    else if (rpQuery.includes('player_id = $1')) {
      const playerId = parseInt(params[0], 10);
      list = list.filter(r => r.player_id === playerId);
      const statusMatch = rpQuery.match(/status\s*=\s*'([^']+)'/);
      if (statusMatch) list = list.filter(r => r.status === statusMatch[1]);
    }
    // By scout_id (with optional status filter)
    else if (rpQuery.includes('scout_id = $1')) {
      const scoutId = parseInt(params[0], 10);
      list = list.filter(r => r.scout_id === scoutId);
      const statusMatch = rpQuery.match(/status\s*=\s*'([^']+)'/);
      if (statusMatch) list = list.filter(r => r.status === statusMatch[1]);
    }
    // By id
    else if (rpQuery.includes('WHERE id = $1')) {
      const id = parseInt(params[0], 10);
      list = list.filter(r => r.id === id);
    }

    // Enrich with scout info
    if (queryStr.includes('JOIN users')) {
      list = list.map(r => {
        const u = data.users.find(usr => usr.id === r.scout_id) || {};
        return { ...r, scout_username: u.username, scout_avatar: u.avatar, scout_role: u.role };
      });
    }

    list.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
    return { rows: list };
  }

  // UPDATE recruitment_permissions SET status
  if (queryStr.startsWith('UPDATE recruitment_permissions SET status')) {
    const statusMatch = queryStr.match(/status\s*=\s*'([^']+)'/);
    let status, id;
    if (statusMatch) {
      status = statusMatch[1];
      id = parseInt(params[0], 10);
    } else {
      const paramStatusMatch = queryStr.match(/status\s*=\s*\$(\d+)/i);
      if (paramStatusMatch) {
        const statusParamIdx = parseInt(paramStatusMatch[1], 10) - 1;
        status = params[statusParamIdx];
        id = parseInt(params[params.length - 1], 10);
      } else {
        return { rows: [] };
      }
    }
    const rp = (data.recruitment_permissions || []).find(r => r.id === id);
    if (rp) { rp.status = status; rp.updated_at = new Date().toISOString(); writeData(data); }
    return { rows: rp ? [rp] : [] };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 33. TEAM OFFERS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (queryStr.startsWith('INSERT INTO team_offers')) {
    if (!data.team_offers) data.team_offers = [];
    const scoutId = parseInt(params[0], 10);
    const playerId = parseInt(params[1], 10);
    const teamName = params[2];
    const role = params[3];
    const tournamentFocus = params[4] || '';
    const contractDuration = params[5] || '';
    const prizeShare = params[6] || 0;
    const notes = params[7] || '';
    const nextId = data.team_offers.length ? Math.max(...data.team_offers.map(o => o.id)) + 1 : 1;
    const offer = {
      id: nextId, scout_id: scoutId, player_id: playerId,
      team_name: teamName, role, tournament_focus: tournamentFocus,
      contract_duration: contractDuration, prize_share: prizeShare,
      notes, status: 'pending',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    data.team_offers.push(offer);
    writeData(data);
    return { rows: [offer] };
  }

  // SELECT team_offers by various conditions
  if (queryStr.includes('FROM team_offers')) {
    if (!data.team_offers) data.team_offers = [];
    let list = [...data.team_offers];

    const tofQuery = queryStr.replace(/\b(?:tof|u|pp)\./g, '');

    if (tofQuery.includes('player_id = $1')) {
      const playerId = parseInt(params[0], 10);
      list = list.filter(o => o.player_id === playerId);
      const statusMatch = tofQuery.match(/status\s*=\s*'([^']+)'/);
      if (statusMatch) list = list.filter(o => o.status === statusMatch[1]);
    }
    else if (tofQuery.includes('scout_id = $1')) {
      const scoutId = parseInt(params[0], 10);
      list = list.filter(o => o.scout_id === scoutId);
      const statusMatch = tofQuery.match(/status\s*=\s*(?:'([^']+)'|\$(\d+))/);
      if (statusMatch) {
        if (statusMatch[1]) list = list.filter(o => o.status === statusMatch[1]);
        else if (statusMatch[2]) {
          const paramIdx = parseInt(statusMatch[2], 10) - 1;
          if (paramIdx < params.length) list = list.filter(o => o.status === params[paramIdx]);
        }
      }
    }
    else if (tofQuery.includes('WHERE id = $1')) {
      const id = parseInt(params[0], 10);
      list = list.filter(o => o.id === id);
    }

    // Enrich with scout info
    if (queryStr.includes('JOIN users')) {
      list = list.map(o => {
        const u = data.users.find(usr => usr.id === o.scout_id) || {};
        const p = data.users.find(usr => usr.id === o.player_id) || {};
        return { ...o, scout_username: u.username, scout_avatar: u.avatar, player_username: p.username, player_avatar: p.avatar };
      });
    }

    list.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
    return { rows: list };
  }

  // UPDATE team_offers SET status
  if (queryStr.startsWith('UPDATE team_offers SET status')) {
    const statusMatch = queryStr.match(/status\s*=\s*'([^']+)'/);
    const status = statusMatch ? statusMatch[1] : params[0];
    const id = parseInt(params[0], 10);
    const offer = (data.team_offers || []).find(o => o.id === id);
    if (offer) { offer.status = status; offer.updated_at = new Date().toISOString(); writeData(data); }
    return { rows: offer ? [offer] : [] };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 34. TEAM ACTIVITY
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (queryStr.startsWith('INSERT INTO team_activity')) {
    if (!data.team_activity) data.team_activity = [];
    const teamId = parseInt(params[0], 10);
    const actorId = parseInt(params[1], 10);
    const targetId = params[2] ? parseInt(params[2], 10) : null;
    const activityTypeMatch = queryStr.match(/VALUES\s*\([^,]+,[^,]+,[^,]+,\s*'([^']+)'/);
    const activityType = activityTypeMatch ? activityTypeMatch[1] : (params[3] || '');
    const metadata = typeof params[3] === 'string' ? JSON.parse(params[3]) : (params[3] || {});
    const nextId = data.team_activity.length ? Math.max(...data.team_activity.map(a => a.id)) + 1 : 1;
    const entry = { id: nextId, team_id: teamId, actor_id: actorId, target_id: targetId, activity_type: activityType, metadata, created_at: new Date().toISOString() };
    data.team_activity.push(entry);
    writeData(data);
    return { rows: [entry] };
  }

  if (queryStr.includes('FROM team_activity ta') && queryStr.includes('LEFT JOIN users')) {
    if (!data.team_activity) data.team_activity = [];
    const hasTeamId = queryStr.includes('ta.team_id = $1');
    let teamId = null;
    if (hasTeamId) teamId = parseInt(params[0], 10);
    let list = (data.team_activity || []).slice();
    if (teamId) list = list.filter(a => a.team_id === teamId);
    list = list.map(a => {
      const actor = data.users.find(u => u.id === a.actor_id) || {};
      const target = a.target_id ? (data.users.find(u => u.id === a.target_id) || {}) : {};
      return {
        ...a,
        actor_name: actor.username || 'Unknown',
        actor_avatar: actor.avatar || '',
        target_name: target.username || null,
        target_avatar: target.avatar || null,
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50);
    return { rows: list };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 35. ORGANIZATIONS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (queryStr.startsWith('INSERT INTO organizations')) {
    if (!data.organizations) data.organizations = [];
    const name = params[0];
    const description = params[1] || '';
    const logoUrl = params[2] || '';
    const website = params[3] || '';
    const createdBy = params[4] ? parseInt(params[4], 10) : null;
    const nextId = data.organizations.length ? Math.max(...data.organizations.map(o => o.id)) + 1 : 1;
    const org = { id: nextId, name, description, logo_url: logoUrl, website, created_by: createdBy, created_at: new Date().toISOString() };
    data.organizations.push(org);
    writeData(data);
    return { rows: [org] };
  }

  if (queryStr.includes('FROM organizations')) {
    if (queryStr.includes('WHERE id = $1')) {
      const id = parseInt(params[0], 10);
      const org = (data.organizations || []).find(o => o.id === id);
      return { rows: org ? [org] : [] };
    }
    return { rows: (data.organizations || []).sort((a, b) => a.name.localeCompare(b.name)) };
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 35. COUNT(*) for new tables
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (queryStr.includes('COUNT(*) FROM recruitment_permissions')) {
    if (queryStr.includes('WHERE scout_id = $1')) {
      const scoutId = parseInt(params[0], 10);
      const count = (data.recruitment_permissions || []).filter(r => r.scout_id === scoutId).length;
      return { rows: [{ count }] };
    }
    if (queryStr.includes('WHERE player_id = $1')) {
      const playerId = parseInt(params[0], 10);
      const count = (data.recruitment_permissions || []).filter(r => r.player_id === playerId).length;
      return { rows: [{ count }] };
    }
  }

  if (queryStr.includes('COUNT(*) FROM recruitment_requests')) {
    if (queryStr.includes('WHERE player_id = ') && queryStr.includes('status = ')) {
      const playerId = parseInt(params[0], 10);
      const count = (data.recruitment_requests || []).filter(r => r.player_id === playerId && r.status === 'pending').length;
      return { rows: [{ count }] };
    }
    if (queryStr.includes('WHERE scout_id = ')) {
      const scoutId = parseInt(params[0], 10);
      const count = (data.recruitment_requests || []).filter(r => r.scout_id === scoutId).length;
      return { rows: [{ count }] };
    }
  }

  if (queryStr.includes('COUNT(*) FROM team_offers')) {
    if (queryStr.includes('WHERE scout_id = $1')) {
      const scoutId = parseInt(params[0], 10);
      const count = (data.team_offers || []).filter(o => o.scout_id === scoutId).length;
      return { rows: [{ count }] };
    }
    if (queryStr.includes('WHERE player_id = $1')) {
      const playerId = parseInt(params[0], 10);
      const count = (data.team_offers || []).filter(o => o.player_id === playerId).length;
      return { rows: [{ count }] };
    }
  }

  return { rows: [] };
};

module.exports = {
  query: (text, params) => {
    if (usePostgres) {
      return pool.query(text, params);
    } else {
      return mockQuery(text, params);
    }
  },
  readData,
  writeData,
};

