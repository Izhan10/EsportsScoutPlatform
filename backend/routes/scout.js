const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware');

const router = express.Router();

router.get('/dashboard', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const { readData } = db;
    const data = readData();
    const userId = req.user.id;
    const players = data.users.filter(u => u.role === 'player');
    const profiles = data.player_profiles;
    const shortlists = data.shortlists;
    const activities = data.scout_activity || [];
    const tournaments = data.tournaments || [];
    const stats = data.player_stats || [];

    const totalPlayers = players.length;
    const esvScores = profiles.filter(p => p.esv_score > 0).map(p => p.esv_score);
    const avgEsv = esvScores.length ? (esvScores.reduce((a, b) => a + b, 0) / esvScores.length).toFixed(1) : '0.0';
    const myShortlists = shortlists.filter(s => s.scout_id === userId);
    const myViews = activities.filter(a => a.scout_id === userId && a.activity_type === 'profile_view');

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newThisWeek = players.filter(p => new Date(p.created_at) >= oneWeekAgo).length;

    const engagementRate = totalPlayers ? ((myViews.length / totalPlayers) * 100).toFixed(1) : 0;

    const prospects = players.map(u => {
      const p = profiles.find(pp => pp.user_id === u.id) || {};
      const s = stats.find(st => st.player_id === u.id) || {};
      return {
        id: u.id, username: u.username, avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`,
        city: u.city, game: p.game || 'Valorant', rank: p.rank || 'Unranked',
        esv_score: p.esv_score || 0, kd_ratio: p.kd_ratio || 1.0,
        win_rate: s.win_rate || 0, growth: s.growth || 0,
      };
    }).sort((a, b) => b.esv_score - a.esv_score).slice(0, 12);

    const myShortlistData = myShortlists.map(s => {
      const u = data.users.find(usr => usr.id === s.player_id) || {};
      const p = profiles.find(pp => pp.user_id === s.player_id) || {};
      return {
        id: u.id, username: u.username, avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`,
        city: u.city, game: p.game || 'Valorant', rank: p.rank || 'Unranked',
        esv_score: p.esv_score || 0, created_at: s.created_at,
      };
    });

    const cityCounts = {};
    players.forEach(p => { if (p.city) cityCounts[p.city] = (cityCounts[p.city] || 0) + 1; });
    const cityDistribution = Object.entries(cityCounts).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);

    const esvDist = {};
    esvScores.forEach(score => {
      const r = Math.floor(score);
      if (r >= 0 && r <= 9) { const k = `${r}-${r + 1}`; esvDist[k] = (esvDist[k] || 0) + 1; }
    });
    const esvDistribution = Object.entries(esvDist).map(([range, count]) => ({ range, count }));

    const myActivity = activities.filter(a => a.scout_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20)
      .map(a => {
        const pl = data.users.find(u => u.id === a.player_id) || {};
        const pp = profiles.find(p => p.user_id === a.player_id) || {};
        return {
          id: a.id, activity_type: a.activity_type, created_at: a.created_at,
          player_id: a.player_id, player_name: pl.username, player_avatar: pl.avatar,
          game: pp.game, esv_score: pp.esv_score,
        };
      });

    const sortedTournaments = tournaments
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 6);

    res.json({
      stats: {
        totalPlayers, avgEsv: parseFloat(avgEsv),
        shortlistedCount: myShortlists.length, profileViews: myViews.length,
        engagementRate: parseFloat(engagementRate), newThisWeek,
        cityDistribution, esvDistribution,
      },
      prospects, shortlist: myShortlistData,
      tournaments: sortedTournaments, activity: myActivity,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/profile', (_req, res) => {
  res.redirect('/pages/scout/profile.html');
});

router.get('/search', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const { game, city, score, rank, q } = req.query;
    let query = `
      SELECT u.id, u.username, u.avatar, u.bio, u.city,
             pp.game, pp.rank, pp.kd_ratio, pp.preferred_role, pp.esv_score,
             (SELECT COUNT(*) FROM videos v WHERE v.user_id = u.id) AS clip_count
      FROM users u
      JOIN player_profiles pp ON pp.user_id = u.id
      WHERE u.role = 'player'
    `;
    const params = [];
    let idx = 1;

    if (game) {
      query += ` AND LOWER(pp.game) LIKE $${idx++}`;
      params.push(`%${game.toLowerCase()}%`);
    }
    if (city) {
      query += ` AND LOWER(u.city) LIKE $${idx++}`;
      params.push(`%${city.toLowerCase()}%`);
    }
    if (rank) {
      query += ` AND LOWER(pp.rank) LIKE $${idx++}`;
      params.push(`%${rank.toLowerCase()}%`);
    }
    if (score) {
      query += ` AND pp.esv_score >= $${idx++}`;
      params.push(parseInt(score, 10) || 0);
    }
    if (q) {
      query += ` AND LOWER(u.username) LIKE $${idx++}`;
      params.push(`%${q.toLowerCase()}%`);
    }

    query += ' ORDER BY pp.esv_score DESC NULLS LAST';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/shortlist/:playerId', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    await db.query(
      `INSERT INTO shortlists (scout_id, player_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, req.params.playerId]
    );
    await db.query(
      `INSERT INTO scout_activity (scout_id, player_id, activity_type) VALUES ($1, $2, 'shortlist_add')`,
      [req.user.id, req.params.playerId]
    );
    res.json({ shortlisted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/shortlist/:playerId', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM shortlists WHERE scout_id=$1 AND player_id=$2', [
      req.user.id,
      req.params.playerId,
    ]);
    await db.query(
      `INSERT INTO scout_activity (scout_id, player_id, activity_type) VALUES ($1, $2, 'shortlist_remove')`,
      [req.user.id, req.params.playerId]
    );
    res.json({ shortlisted: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/shortlist', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.avatar, u.city, pp.game, pp.rank, pp.esv_score, s.created_at
       FROM shortlists s
       JOIN users u ON u.id = s.player_id
       JOIN player_profiles pp ON pp.user_id = u.id
       WHERE s.scout_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/report/:playerId', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const player = await db.query(
      `SELECT u.*, pp.game, pp.rank, pp.kd_ratio, pp.preferred_role, pp.esv_score
       FROM users u
       JOIN player_profiles pp ON pp.user_id = u.id
       WHERE u.id = $1`,
      [req.params.playerId]
    );
    if (!player.rows.length) return res.status(404).json({ error: 'Player not found' });

    const clips = await db.query(
      `SELECT v.id, v.caption, v.game_title, v.esv_score, v.uploaded_at,
              a.aim_score, a.positioning_score, a.teamwork_score, a.decision_score, a.summary
       FROM videos v
       LEFT JOIN ai_analysis a ON a.video_id = v.id
       WHERE v.user_id = $1 ORDER BY v.uploaded_at DESC LIMIT 10`,
      [req.params.playerId]
    );

    res.json({
      player: player.rows[0],
      clips: clips.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/notes/:playerId', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM internal_notes WHERE scout_id = $1 AND player_id = $2',
      [req.user.id, req.params.playerId]
    );
    res.json(result.rows[0] || { content: '' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/notes/:playerId', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const { content } = req.body;
    const result = await db.query(
      `INSERT INTO internal_notes (scout_id, player_id, content)
       VALUES ($1, $2, $3)
       ON CONFLICT (scout_id, player_id) DO UPDATE SET
         content = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.id, req.params.playerId, content || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/stats', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const totalPlayers = await db.query(
      `SELECT COUNT(*) FROM users WHERE role = 'player'`
    );
    const avgEsv = await db.query(
      `SELECT COALESCE(AVG(pp.esv_score), 0) AS avg_esv
       FROM player_profiles pp WHERE pp.esv_score > 0`
    );
    const shortlisted = await db.query(
      `SELECT COUNT(*) FROM shortlists WHERE scout_id = $1`,
      [req.user.id]
    );
    const views = await db.query(
      `SELECT COUNT(*) FROM scout_activity WHERE scout_id = $1 AND activity_type = 'profile_view'`,
      [req.user.id]
    );
    const cityStats = await db.query(
      `SELECT u.city, COUNT(*) AS count
       FROM users u
       JOIN player_profiles pp ON pp.user_id = u.id
       WHERE u.role = 'player' AND u.city IS NOT NULL AND u.city != ''
       GROUP BY u.city
       ORDER BY count DESC`
    );
    res.json({
      totalPlayers: parseInt(totalPlayers.rows[0].count, 10),
      avgEsv: parseFloat(avgEsv.rows[0].avg_esv).toFixed(1),
      shortlistedCount: parseInt(shortlisted.rows[0].count, 10),
      profileViews: parseInt(views.rows[0].count, 10),
      cityDistribution: cityStats.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
