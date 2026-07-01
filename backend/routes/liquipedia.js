const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { authenticate } = require('../middleware');
const liquipediaService = require('../services/liquipediaService');

const router = express.Router();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many search requests. Please wait before searching again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/search-player', authenticate, searchLimiter, async (req, res) => {
  try {
    const { name, autocomplete } = req.body;
    if (!name) return res.status(400).json({ error: 'Player name required' });
    const results = await liquipediaService.searchPlayer(name, { autocomplete: !!autocomplete });
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Liquipedia search failed' });
  }
});

router.post('/search-scout', authenticate, searchLimiter, async (req, res) => {
  try {
    const { name, autocomplete } = req.body;
    if (!name) return res.status(400).json({ error: 'Scout name required' });
    const results = await liquipediaService.searchScout(name, { autocomplete: !!autocomplete });
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Liquipedia search failed' });
  }
});

router.post('/import-player', authenticate, async (req, res) => {
  try {
    const { liquipediaId, wiki } = req.body;
    if (!liquipediaId) return res.status(400).json({ error: 'Liquipedia ID required' });

    const remoteProfile = await liquipediaService.fetchPlayerProfile(liquipediaId, wiki);
    const mapped = liquipediaService.mapLiquipediaData(remoteProfile, 'player');

    mapped.profile_source = 'liquipedia';
    mapped.profile_status = 'imported';
    mapped.liquipedia_id = liquipediaId;
    const lpWiki = wiki || 'valorant';
    mapped.liquipedia_url = `https://liquipedia.net/${lpWiki}/${encodeURIComponent(mapped.real_name || mapped.username)}`;
    mapped.liquipedia_verified = false;

    console.log('[LIQUIPEDIA IMPORT] remoteProfile:', JSON.stringify(remoteProfile, null, 2));
    console.log('[LIQUIPEDIA IMPORT] mapped response fields:', Object.keys(mapped));
    console.log('[LIQUIPEDIA IMPORT] mapped.liquipedia_data keys:', Object.keys(mapped.liquipedia_data || {}));
    console.log('[LIQUIPEDIA IMPORT] mapped:', JSON.stringify(mapped, null, 2));

    res.json({ profile: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Liquipedia import failed' });
  }
});

router.post('/import-scout', authenticate, async (req, res) => {
  try {
    const { liquipediaId, wiki } = req.body;
    if (!liquipediaId) return res.status(400).json({ error: 'Liquipedia ID required' });

    const remoteProfile = await liquipediaService.fetchScoutProfile(liquipediaId, wiki);
    const mapped = liquipediaService.mapLiquipediaData(remoteProfile, 'scout');

    mapped.profile_source = 'liquipedia';
    mapped.profile_status = 'imported';
    mapped.liquipedia_id = liquipediaId;
    const lpWiki = wiki || 'valorant';
    mapped.liquipedia_url = `https://liquipedia.net/${lpWiki}/${encodeURIComponent(mapped.real_name || mapped.username)}`;
    mapped.liquipedia_verified = false;

    res.json({ profile: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Liquipedia import failed' });
  }
});

router.post('/import-player-as-scout', authenticate, async (req, res) => {
  try {
    const { liquipediaId, wiki } = req.body;
    if (!liquipediaId) return res.status(400).json({ error: 'Liquipedia ID required' });

    const remoteProfile = await liquipediaService.fetchPlayerProfile(liquipediaId, wiki);
    const lpWiki = wiki || 'valorant';

    const teams = (remoteProfile.teams || []).map(t => ({
      name: t.name || '',
      role: t.role || '',
      year: parseInt((t.start_date || t.end_date || '').split('-')[0]) || null,
    }));

    const tournaments = (remoteProfile.tournaments || []).map(t => ({
      name: t.name || '',
      placement: t.placement || '',
      date: (t.date || '').split('T')[0] || '',
    }));

    const accolades = (remoteProfile.achievements || []).map(a => ({
      title: a.title || a.name || '',
      description: a.placement || '',
      year: a.year || (a.date || '').split('-')[0] || '',
    }));

    const mapped = {
      real_name: remoteProfile.real_name || remoteProfile.name || '',
      avatar: remoteProfile.image || '',
      bio: `${remoteProfile.real_name || remoteProfile.name || 'Player'} is a former ${remoteProfile.role || 'professional'} ${remoteProfile.game || 'esports'} player` + (remoteProfile.country ? ` from ${remoteProfile.country}` : '') + `.`,
      country: remoteProfile.country || '',
      social_links: remoteProfile.social_links || {},
      organization: (remoteProfile.teams || [])[0]?.name || '',
      coaching_specialty: remoteProfile.game || remoteProfile.role || '',
      best_achievement: accolades[0]?.title || '',
      years_experience: 0,
      teams_coached: teams.map(t => `${t.name} (${t.role})`).join(', '),
      achievements: accolades.map(a => `• ${a.title}${a.year ? ' (' + a.year + ')' : ''}`).join('\n'),
      experience: '',
      cv_url: '',
      liquipedia_id: liquipediaId,
      liquipedia_url: `https://liquipedia.net/${lpWiki}/${encodeURIComponent(remoteProfile.real_name || remoteProfile.name || liquipediaId)}`,
      liquipedia_data: remoteProfile,
      profile_source: 'liquipedia',
      teams,
      tournaments,
      accolades,
    };

    console.log('[LIQUIPEDIA IMPORT-PLAYER-AS-SCOUT] mapped fields:', Object.keys(mapped));
    console.log('[LIQUIPEDIA IMPORT-PLAYER-AS-SCOUT] teams:', teams.length, 'tournaments:', tournaments.length, 'accolades:', accolades.length);

    res.json({ profile: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Liquipedia import failed' });
  }
});

router.post('/log-failure', authenticate, async (req, res) => {
  const { playerName, error } = req.body;
  if (!playerName) return res.status(400).json({ error: 'playerName required' });
  const path = require('path');
  const fs = require('fs');
  const logPath = path.join(__dirname, '..', 'failed_imports.json');
  try {
    const log = fs.existsSync(logPath)
      ? JSON.parse(fs.readFileSync(logPath, 'utf8'))
      : [];
    log.push({ player: playerName, error: error || 'unknown', time: new Date().toISOString() });
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
    res.json({ logged: true });
  } catch {
    res.json({ logged: false });
  }
});

module.exports = router;
