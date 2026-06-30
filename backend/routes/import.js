const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware');

const router = express.Router();

router.post('/players/import', authenticate, async (req, res) => {
  try {
    const profile = req.body.profile;
    if (!profile) {
      return res.status(400).json({ error: 'Profile data required' });
    }
    const userId = req.user.id;

    console.log('[IMPORT ROUTE] === ATOMIC IMPORT START ===');
    console.log('[IMPORT ROUTE] userId:', userId);
    console.log('[IMPORT ROUTE] Received profile sections:', Object.keys(profile));
    console.log('[IMPORT ROUTE] hero:', JSON.stringify(profile.hero));
    console.log('[IMPORT ROUTE] overview:', JSON.stringify(profile.overview));
    console.log('[IMPORT ROUTE] statistics:', JSON.stringify(profile.statistics));
    console.log('[IMPORT ROUTE] teams entries:', (profile.teams?.entries || []).length);
    console.log('[IMPORT ROUTE] tournaments entries:', (profile.tournaments?.entries || []).length);
    console.log('[IMPORT ROUTE] achievements entries:', (profile.achievements?.entries || []).length);

    const h = profile.hero || {};
    const ov = profile.overview || {};
    const st = profile.statistics || {};
    const teams = profile.teams?.entries || [];
    const tournaments = profile.tournaments?.entries || [];
    const achievements = profile.achievements?.entries || [];
    const individualAchievements = profile.achievements?.individual || [];
    const socials = profile.socials?.links || {};

    await db.query(
      `UPDATE users SET
        real_name = COALESCE($1, real_name),
        country = COALESCE($2, country),
        nationality = COALESCE($3, nationality),
        main_game = COALESCE($4, main_game),
        current_team = COALESCE($5, current_team),
        avatar = COALESCE(NULLIF($6, ''), avatar),
        bio = COALESCE($7, bio),
        liquipedia_url = COALESCE($8, liquipedia_url),
        profile_source = COALESCE($9, profile_source),
        profile_status = COALESCE($10, profile_status),
        social_links = COALESCE($11, social_links),
        liquipedia_data = COALESCE($12, liquipedia_data)
      WHERE id = $13`,
      [
        h.real_name || '',
        h.country || '',
        h.nationality || '',
        h.main_game || '',
        h.current_team || '',
        h.avatar || null,
        ov.bio || '',
        h.liquipedia_url || '',
        h.profile_source || 'liquipedia',
        h.profile_status || 'imported',
        socials,
        {
          teams,
          tournaments,
          achievements,
          statistics: st,
          social_links: socials,
        },
        userId,
      ]
    );
    console.log('[IMPORT ROUTE] users table updated');

    await db.query(
      `INSERT INTO player_profiles (user_id, game, rank, kd_ratio, preferred_role, achievements, teams_played, individual_achievements)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         game = COALESCE($2, player_profiles.game),
         rank = COALESCE($3, player_profiles.rank),
         kd_ratio = COALESCE($4, player_profiles.kd_ratio),
         preferred_role = COALESCE($5, player_profiles.preferred_role),
         achievements = COALESCE($6, player_profiles.achievements),
         teams_played = COALESCE($7, player_profiles.teams_played),
         individual_achievements = COALESCE($8, player_profiles.individual_achievements)`,
      [
        userId,
        h.main_game || '',
        st.highest_rank || '',
        st.kd_ratio || 0,
        h.preferred_role || '',
        profile.achievements?.text || '',
        teams.map(t => `${t.name} (${t.role})`).join(', '),
        JSON.stringify(individualAchievements),
      ]
    );
    console.log('[IMPORT ROUTE] player_profiles table updated');

    await db.query(
      `INSERT INTO player_stats (player_id, kd_ratio, win_rate, matches_played, tournaments_played, highest_rank, mvps, acs, adr, headshot_percent, clutch_percent, opening_duel_percent, tournament_win_percent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (player_id) DO UPDATE SET
         kd_ratio = $2, win_rate = $3, matches_played = $4,
         tournaments_played = $5, highest_rank = $6,
         mvps = $7, acs = $8, adr = $9, headshot_percent = $10,
         clutch_percent = $11, opening_duel_percent = $12, tournament_win_percent = $13`,
      [
        userId,
        st.kd_ratio || 0,
        st.win_rate || 0,
        st.matches_played || 0,
        st.tournaments_played || tournaments.length,
        st.highest_rank || '',
        st.mvps || 0,
        st.acs || 0,
        st.adr || 0,
        st.headshot_percent || 0,
        st.clutch_percent || 0,
        st.opening_duel_percent || 0,
        st.tournament_win_percent || 0,
      ]
    );
    console.log('[IMPORT ROUTE] player_stats table updated');

    await db.query('DELETE FROM player_history WHERE player_id = $1', [userId]);
    console.log('[IMPORT ROUTE] cleared existing player_history');

    const historyToInsert = [
      ...teams.map(t => ({ type: 'team', title: t.name, subtitle: t.role, year: (t.start_date || '').toString() })),
      ...tournaments.map(t => ({ type: 'tournament', title: t.name, subtitle: t.placement, year: (t.date || '').toString() })),
      ...achievements.map(a => ({ type: 'achievement', title: a.title, subtitle: a.placement, year: (a.year || '').toString() })),
      ...individualAchievements.map(a => ({ type: 'achievement', title: a.title, subtitle: '', year: (a.year || '').toString() })),
    ];

    for (const entry of historyToInsert) {
      const yearNum = parseInt(entry.year, 10);
      await db.query(
        `INSERT INTO player_history (player_id, entry_type, title, subtitle, entry_year)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, entry.type, entry.title, entry.subtitle || '', isNaN(yearNum) ? null : yearNum]
      );
    }
    console.log('[IMPORT ROUTE] player_history entries added:', historyToInsert.length);

    const summary = {
      hero: Object.keys(h).filter(k => h[k]).length,
      overview: Object.keys(ov).filter(k => ov[k]).length,
      statistics: Object.keys(st).filter(k => st[k] > 0).length,
      teams_mapped: teams.length,
      tournaments_mapped: tournaments.length,
      achievements_mapped: achievements.length,
      individual_achievements_mapped: individualAchievements.length,
      history_entries: historyToInsert.length,
    };

    console.log('[IMPORT ROUTE] === ATOMIC IMPORT COMPLETE ===');
    console.log('[IMPORT ROUTE] Summary:', JSON.stringify(summary));

    res.json({
      success: true,
      message: 'Profile imported successfully',
      summary,
    });
  } catch (err) {
    console.error('[IMPORT ROUTE] Error:', err);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

module.exports = router;
