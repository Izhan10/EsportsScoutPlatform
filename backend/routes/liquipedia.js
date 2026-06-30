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
