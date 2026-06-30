const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware');

const router = express.Router();

router.post('/', authenticate, async (req, res) => {
  try {
    const { playerId, activityType } = req.body;
    if (!playerId || !activityType) {
      return res.status(400).json({ error: 'playerId and activityType required' });
    }
    const validTypes = ['profile_view', 'shortlist_add', 'shortlist_remove'];
    if (!validTypes.includes(activityType)) {
      return res.status(400).json({ error: 'Invalid activityType' });
    }
    await db.query(
      `INSERT INTO scout_activity (scout_id, player_id, activity_type) VALUES ($1, $2, $3)`,
      [req.user.id, playerId, activityType]
    );
    res.status(201).json({ logged: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { readData } = db;
    const data = readData();
    const activities = (data.scout_activity || [])
      .filter(a => a.scout_id === req.user.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 30)
      .map(a => {
        const u = data.users.find(usr => usr.id === a.player_id) || {};
        const p = data.player_profiles.find(pp => pp.user_id === a.player_id) || {};
        return {
          id: a.id, activity_type: a.activity_type, created_at: a.created_at,
          player_id: a.player_id, player_name: u.username, player_avatar: u.avatar,
          game: p.game || '', esv_score: p.esv_score || 0,
        };
      });
    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:playerId', authenticate, async (req, res) => {
  try {
    const { playerId } = req.params;
    const result = await db.query(
      `SELECT sa.id, sa.activity_type, sa.created_at,
              u.id AS scout_id, u.username AS scout_name, u.avatar AS scout_avatar
       FROM scout_activity sa
       JOIN users u ON u.id = sa.scout_id
       WHERE sa.player_id = $1
       ORDER BY sa.created_at DESC
       LIMIT 20`,
      [playerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
