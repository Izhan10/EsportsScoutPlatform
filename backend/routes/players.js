const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware');

const router = express.Router();

router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await db.query(
      `SELECT u.id, u.username, u.avatar, u.cover_image, u.bio, u.city, u.country, u.nationality, u.current_team, u.main_game,
               u.years_experience, u.real_name, u.liquipedia_id, u.liquipedia_url, u.liquipedia_verified, u.liquipedia_data, u.profile_source,
               u.profile_status, u.claimed_by_user_id, u.verification_method, u.verified_at, u.scout_score, u.esports_value_score, u.social_links,
                 pp.game, pp.rank, pp.kd_ratio, pp.preferred_role, pp.esv_score, pp.achievements, pp.teams_played, pp.acs, pp.adr, pp.headshot_percent, pp.clutch_percent, pp.opening_duel_percent, pp.tournament_win_percent, pp.individual_achievements
        FROM users u
        LEFT JOIN player_profiles pp ON pp.user_id = u.id
        WHERE u.id = $1 AND u.role = 'player'`,
      [req.params.id]
    );
    if (!user.rows.length) return res.status(404).json({ error: 'Player not found' });

    const stats = await db.query(
      'SELECT * FROM player_stats WHERE player_id = $1',
      [req.params.id]
    );

    const history = await db.query(
      'SELECT * FROM player_history WHERE player_id = $1 ORDER BY entry_year DESC',
      [req.params.id]
    );

    const videos = await db.query(
      `SELECT v.id, v.video_url, v.caption, v.game_title, v.esv_score, v.uploaded_at, v.views, v.likes
       FROM videos v WHERE v.user_id = $1 ORDER BY v.uploaded_at DESC`,
      [req.params.id]
    );

    res.json({
      player: user.rows[0],
      stats: stats.rows[0] || null,
      history: history.rows,
      videos: videos.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  if (parseInt(req.params.id, 10) !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own profile' });
  }
  try {
    const { bio, city, country, current_team, main_game, years_experience, real_name } = req.body;
    const result = await db.query(
      `UPDATE users SET
        bio = COALESCE($1, bio),
        city = COALESCE($2, city),
        country = COALESCE($3, country),
        current_team = COALESCE($4, current_team),
        main_game = COALESCE($5, main_game),
        years_experience = COALESCE($6, years_experience),
        real_name = COALESCE($7, real_name)
       WHERE id = $8 RETURNING id, username, avatar, bio, city, country, current_team, main_game, years_experience, real_name`,
      [bio, city, country, current_team, main_game, years_experience, real_name, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM player_stats WHERE player_id = $1', [req.params.id]);
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/stats', authenticate, async (req, res) => {
  if (parseInt(req.params.id, 10) !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const { kd_ratio, win_rate, matches_played, tournaments_played, official_tournaments, mvps, highest_rank, acs, adr, headshot_percent, clutch_percent, opening_duel_percent, tournament_win_percent } = req.body;
    const result = await db.query(
      `INSERT INTO player_stats (player_id, kd_ratio, win_rate, matches_played, tournaments_played, official_tournaments, mvps, highest_rank, acs, adr, headshot_percent, clutch_percent, opening_duel_percent, tournament_win_percent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (player_id) DO UPDATE SET
         kd_ratio = $2, win_rate = $3, matches_played = $4,
         tournaments_played = $5, official_tournaments = $6, mvps = $7, highest_rank = $8,
         acs = $9, adr = $10, headshot_percent = $11, clutch_percent = $12, opening_duel_percent = $13, tournament_win_percent = $14
       RETURNING *`,
      [req.user.id, kd_ratio, win_rate, matches_played, tournaments_played, official_tournaments, mvps, highest_rank, acs, adr, headshot_percent, clutch_percent, opening_duel_percent, tournament_win_percent]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/history', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM player_history WHERE player_id = $1 ORDER BY entry_year DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/history', authenticate, async (req, res) => {
  if (parseInt(req.params.id, 10) !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const { entry_type, title, subtitle, entry_year } = req.body;
    const result = await db.query(
      `INSERT INTO player_history (player_id, entry_type, title, subtitle, entry_year)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, entry_type, title, subtitle || '', entry_year || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/history/:hid', authenticate, async (req, res) => {
  if (parseInt(req.params.id, 10) !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    await db.query('DELETE FROM player_history WHERE id = $1', [req.params.hid]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/individual-achievements', authenticate, async (req, res) => {
  if (parseInt(req.params.id, 10) !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const { title, year } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const pp = await db.query(
      "SELECT individual_achievements FROM player_profiles WHERE user_id = $1",
      [req.user.id]
    );
    const current = pp.rows[0]?.individual_achievements || [];
    if (typeof current === 'string') {
      try { current = JSON.parse(current); } catch { current = []; }
    }

    const newEntry = { title, year: year || '', type: 'individual', source: 'manual' };
    current.push(newEntry);

    await db.query(
      `INSERT INTO player_profiles (user_id, individual_achievements)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET individual_achievements = $2`,
      [req.user.id, JSON.stringify(current)]
    );
    res.status(201).json(newEntry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/individual-achievements/:index', authenticate, async (req, res) => {
  if (parseInt(req.params.id, 10) !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const index = parseInt(req.params.index, 10);
    const pp = await db.query(
      "SELECT individual_achievements FROM player_profiles WHERE user_id = $1",
      [req.user.id]
    );
    let current = pp.rows[0]?.individual_achievements || [];
    if (typeof current === 'string') {
      try { current = JSON.parse(current); } catch { current = []; }
    }
    if (index < 0 || index >= current.length) {
      return res.status(404).json({ error: 'Achievement not found' });
    }
    current.splice(index, 1);
    await db.query(
      `INSERT INTO player_profiles (user_id, individual_achievements)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET individual_achievements = $2`,
      [req.user.id, JSON.stringify(current)]
    );
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
