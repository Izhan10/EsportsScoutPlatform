const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { authenticate } = require('../middleware');
const liquipediaService = require('../services/liquipediaService');

const router = express.Router();

const tournamentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many tournament requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/liquipedia', authenticate, tournamentLimiter, async (req, res) => {
  try {
    const { wiki = 'valorant', status, limit = 20 } = req.query;
    const tournaments = await liquipediaService.searchTournaments({
      wiki,
      status: status || undefined,
      limit: parseInt(limit, 10) || 20,
    });
    res.json(tournaments);
  } catch (err) {
    console.error(err);
    const fallback = await db.query('SELECT * FROM tournaments WHERE game = $1 ORDER BY id DESC LIMIT 20', [req.query.wiki || 'Valorant']).catch(() => ({ rows: [] }));
    if (fallback.rows.length) {
      return res.json(fallback.rows);
    }
    res.status(503).json({ error: 'Tournament data temporarily unavailable. Please try again later.' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tournaments ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  const { name, game, prize, city, date } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO tournaments (name, game, prize, city, date, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, game, prize, city, date, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/register', authenticate, async (req, res) => {
  res.json({ message: 'Registration recorded (demo)', tournamentId: req.params.id });
});

module.exports = router;
