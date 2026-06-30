const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware');

const router = express.Router();

router.get('/:id/activity', authenticate, async (req, res) => {
  try {
    if (parseInt(req.params.id, 10) !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const result = await db.query(
      `SELECT sa.*, u.username, u.avatar, u.role
       FROM scout_activity sa
       JOIN users u ON u.id = sa.player_id
       WHERE sa.scout_id = $1
       ORDER BY sa.created_at DESC
       LIMIT 30`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await db.query(
      `SELECT u.id, u.username, u.avatar, u.bio, u.city, u.country, u.real_name,
              u.liquipedia_data,
              sp.experience, sp.teams_coached, sp.achievements, sp.organization,
              sp.coaching_specialty, sp.best_achievement, sp.years_experience,
              sp.liquipedia_id, sp.liquipedia_url, sp.liquipedia_verified, sp.profile_source
       FROM users u
       LEFT JOIN scout_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1 AND u.role = 'scout'`,
      [req.params.id]
    );
    if (!user.rows.length) return res.status(404).json({ error: 'Scout not found' });

    const history = await db.query(
      'SELECT * FROM scout_history WHERE scout_id = $1 ORDER BY entry_year DESC',
      [req.params.id]
    );

    const shortlistedCount = await db.query(
      'SELECT COUNT(*)::int AS count FROM shortlists WHERE scout_id = $1',
      [req.params.id]
    );

    const convCount = await db.query(
      'SELECT COUNT(*)::int AS count FROM conversations WHERE participant1_id = $1 OR participant2_id = $1',
      [req.params.id]
    );

    res.json({
      scout: user.rows[0],
      history: history.rows,
      shortlistedCount: shortlistedCount.rows[0]?.count || 0,
      conversationCount: convCount.rows[0]?.count || 0,
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
    const { bio, city, country, real_name } = req.body;
    await db.query(
      `UPDATE users SET bio = COALESCE($1, bio), city = COALESCE($2, city),
       country = COALESCE($3, country), real_name = COALESCE($4, real_name) WHERE id = $5`,
      [bio, city, country, real_name, req.user.id]
    );

    const { experience, teams_coached, achievements, organization, coaching_specialty, best_achievement, years_experience } = req.body;
    const result = await db.query(
      `INSERT INTO scout_profiles (user_id, experience, teams_coached, achievements, organization, coaching_specialty, best_achievement, years_experience)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         experience = COALESCE($2, scout_profiles.experience),
         teams_coached = COALESCE($3, scout_profiles.teams_coached),
         achievements = COALESCE($4, scout_profiles.achievements),
         organization = COALESCE($5, scout_profiles.organization),
         coaching_specialty = COALESCE($6, scout_profiles.coaching_specialty),
         best_achievement = COALESCE($7, scout_profiles.best_achievement),
         years_experience = COALESCE($8, scout_profiles.years_experience)
       RETURNING *`,
      [req.user.id, experience, teams_coached, achievements, organization, coaching_specialty, best_achievement, years_experience]
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
      'SELECT * FROM scout_history WHERE scout_id = $1 ORDER BY entry_year DESC',
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
      `INSERT INTO scout_history (scout_id, entry_type, title, subtitle, entry_year)
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
    await db.query('DELETE FROM scout_history WHERE id = $1', [req.params.hid]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/import', authenticate, async (req, res) => {
  const {
    username, avatar, bio, real_name, city, country, social_links,
    organization, coaching_specialty, best_achievement, years_experience,
    teams_coached, achievements, experience, cv_url,
    liquipedia_id, liquipedia_url, liquipedia_data,
    teams, tournaments, accolades
  } = req.body;

  try {
    await db.query('BEGIN');

    await db.query(
      `UPDATE users SET
        username = COALESCE($1, username),
        avatar = COALESCE($2, avatar),
        bio = COALESCE($3, bio),
        real_name = COALESCE($4, real_name),
        city = COALESCE($5, city),
        country = COALESCE($6, country),
        social_links = COALESCE($7::jsonb, social_links),
        liquipedia_data = COALESCE($8::jsonb, liquipedia_data)
       WHERE id = $9`,
      [username, avatar, bio, real_name, city, country, JSON.stringify(social_links || {}), JSON.stringify(liquipedia_data || {}), req.user.id]
    );

    await db.query(
      `INSERT INTO scout_profiles (user_id, organization, coaching_specialty, best_achievement, years_experience, teams_coached, achievements, experience, cv_url, liquipedia_id, liquipedia_url, profile_source, liquipedia_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (user_id) DO UPDATE SET
         organization = COALESCE($2, scout_profiles.organization),
         coaching_specialty = COALESCE($3, scout_profiles.coaching_specialty),
         best_achievement = COALESCE($4, scout_profiles.best_achievement),
         years_experience = COALESCE($5, scout_profiles.years_experience),
         teams_coached = COALESCE($6, scout_profiles.teams_coached),
         achievements = COALESCE($7, scout_profiles.achievements),
         experience = COALESCE($8, scout_profiles.experience),
         cv_url = COALESCE($9, scout_profiles.cv_url),
         liquipedia_id = COALESCE($10, scout_profiles.liquipedia_id),
         liquipedia_url = COALESCE($11, scout_profiles.liquipedia_url),
         profile_source = COALESCE($12, scout_profiles.profile_source),
         liquipedia_verified = true`,
      [req.user.id, organization || '', coaching_specialty || '', best_achievement || '', years_experience || 0,
       teams_coached || '', achievements || '', experience || '', cv_url || '',
       liquipedia_id || '', liquipedia_url || '', 'liquipedia', true]
    );

    if (teams && teams.length) {
      for (const t of teams) {
        await db.query(
          `INSERT INTO scout_history (scout_id, entry_type, title, subtitle, entry_year)
           VALUES ($1, 'team', $2, $3, $4)`,
          [req.user.id, t.name || t.team, t.role || '', t.year || null]
        );
      }
    }
    if (tournaments && tournaments.length) {
      for (const t of tournaments) {
        await db.query(
          `INSERT INTO scout_history (scout_id, entry_type, title, subtitle, entry_year)
           VALUES ($1, 'tournament', $2, $3, $4)`,
          [req.user.id, t.name || t.tournament, t.result || t.placement || t.role || '', t.year || t.date ? String(t.year || t.date) : '']
        );
      }
    }
    if (accolades && accolades.length) {
      for (const a of accolades) {
        await db.query(
          `INSERT INTO scout_history (scout_id, entry_type, title, subtitle, entry_year)
           VALUES ($1, 'achievement', $2, $3, $4)`,
          [req.user.id, a.title || a.name || a.achievement, a.description || a.tier || '', a.year || a.date ? String(a.year || a.date) : '']
        );
      }
    }

    await db.query('COMMIT');

    const updated = await db.query(
      `SELECT u.id, u.username, u.avatar, u.bio, u.city, u.country, u.real_name,
              u.liquipedia_data,
              sp.experience, sp.teams_coached, sp.achievements, sp.organization,
              sp.coaching_specialty, sp.best_achievement, sp.years_experience,
              sp.liquipedia_id, sp.liquipedia_url, sp.liquipedia_verified, sp.profile_source
       FROM users u
       LEFT JOIN scout_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    const history = await db.query(
      'SELECT * FROM scout_history WHERE scout_id = $1 ORDER BY entry_year DESC',
      [req.user.id]
    );

    res.json({ scout: updated.rows[0], history: history.rows });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Scout import error:', err);
    res.status(500).json({ error: 'Failed to import scout data' });
  }
});

module.exports = router;
