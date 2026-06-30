const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { SECRET_KEY, UPLOAD_DIR } = require('../config');
const { authenticate } = require('../middleware');

const router = express.Router();

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname) || '.pdf'}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post('/register', async (req, res) => {
  const { username, password, email, role, city } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!/\d/.test(password)) {
    return res.status(400).json({ error: 'Password must include at least one number' });
  }
  if (!/[!@#$%^&*]/.test(password)) {
    return res.status(400).json({ error: 'Password must include at least one special character (!@#$%^&*)' });
  }
  const userRole = ['player', 'scout'].includes(role) ? role : 'player';

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (username, email, password, role, city)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, role, avatar, bio, city, created_at`,
      [username, email || null, hashedPassword, userRole, city || '']
    );
    const user = result.rows[0];
    if (userRole === 'player') {
      await db.query(
        `INSERT INTO player_profiles (user_id, game, rank) VALUES ($1, 'Valorant', 'Unranked')`,
        [user.id]
      );
      await db.query(
        `INSERT INTO player_games (player_id, game) VALUES ($1, 'Valorant')`,
        [user.id]
      );
    }
    res.status(201).json(user);
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Username or email already exists' });
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Wrong information' });

    const user = result.rows[0];
    if (user.role !== role) return res.status(401).json({ error: 'Wrong information' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Wrong information' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET_KEY,
      { expiresIn: '24h' }
    );
    res.json({
      token,
      role: user.role,
      username: user.username,
      id: user.id,
      avatar: user.avatar,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', authenticate, (_req, res) => {
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.avatar, u.cover_image, u.bio, u.city, u.country, u.nationality, u.current_team, u.main_game, u.years_experience, u.real_name,
              u.liquipedia_id, u.liquipedia_url, u.liquipedia_verified, u.liquipedia_data, u.profile_source, u.profile_status, u.verification_method, u.scout_score, u.esports_value_score, u.social_links, u.created_at,
               pp.game, pp.rank, pp.kd_ratio, pp.preferred_role, pp.esv_score, pp.achievements AS player_achievements, pp.teams_played, pp.cv_url AS player_cv, pp.acs, pp.adr, pp.headshot_percent, pp.clutch_percent, pp.opening_duel_percent, pp.tournament_win_percent, pp.individual_achievements,
              sp.experience AS scout_experience, sp.teams_coached AS scout_teams, sp.achievements AS scout_achievements, sp.cv_url AS scout_cv,
              ps.win_rate, ps.matches_played, ps.tournaments_played AS ps_tournaments_played, ps.official_tournaments, ps.mvps, ps.highest_rank,
              ps.acs AS stats_acs, ps.adr AS stats_adr, ps.headshot_percent AS stats_headshot_percent, ps.clutch_percent AS stats_clutch_percent, ps.opening_duel_percent AS stats_opening_duel_percent, ps.tournament_win_percent AS stats_tournament_win_percent,
              (SELECT AVG(aa.aim_score) FROM ai_analysis aa JOIN videos v ON v.id = aa.video_id WHERE v.user_id = u.id) AS aim_score,
              (SELECT AVG(aa.positioning_score) FROM ai_analysis aa JOIN videos v ON v.id = aa.video_id WHERE v.user_id = u.id) AS positioning_score,
              (SELECT AVG(aa.teamwork_score) FROM ai_analysis aa JOIN videos v ON v.id = aa.video_id WHERE v.user_id = u.id) AS teamwork_score,
              (SELECT AVG(aa.consistency_score) FROM ai_analysis aa JOIN videos v ON v.id = aa.video_id WHERE v.user_id = u.id) AS consistency_score,
              (SELECT AVG(aa.decision_score) FROM ai_analysis aa JOIN videos v ON v.id = aa.video_id WHERE v.user_id = u.id) AS decision_score
       FROM users u
       LEFT JOIN player_profiles pp ON pp.user_id = u.id
       LEFT JOIN scout_profiles sp ON sp.user_id = u.id
       LEFT JOIN player_stats ps ON ps.player_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/profile', authenticate, async (req, res) => {
  const { username, email, city, bio, avatar, cover_image, country, nationality, current_team, main_game, years_experience, real_name, liquipedia_id, liquipedia_url, liquipedia_verified, liquipedia_data, profile_source, profile_status, verification_method, scout_score, esports_value_score, social_links } = req.body;
  try {
    const result = await db.query(
      `UPDATE users
       SET username = COALESCE($1, username),
           email = COALESCE($2, email),
           city = COALESCE($3, city),
           bio = COALESCE($4, bio),
           avatar = COALESCE($5, avatar),
           cover_image = COALESCE($6, cover_image),
           country = COALESCE($7, country),
           nationality = COALESCE($8, nationality),
           current_team = COALESCE($9, current_team),
           main_game = COALESCE($10, main_game),
           years_experience = COALESCE($11, years_experience),
           real_name = COALESCE($12, real_name),
           liquipedia_id = COALESCE($13, liquipedia_id),
           liquipedia_url = COALESCE($14, liquipedia_url),
           liquipedia_verified = COALESCE($15, liquipedia_verified),
           liquipedia_data = COALESCE($16, liquipedia_data),
           profile_source = COALESCE($17, profile_source),
           profile_status = COALESCE($18, profile_status),
           verification_method = COALESCE($19, verification_method),
           scout_score = COALESCE($20, scout_score),
           esports_value_score = COALESCE($21, esports_value_score),
           social_links = COALESCE($22, social_links)
       WHERE id = $23
       RETURNING id, username, email, role, avatar, bio, city, country, current_team, main_game, years_experience, real_name, liquipedia_id, liquipedia_url, liquipedia_verified, profile_source, profile_status, scout_score, esports_value_score, created_at`,
      [username, email, city, bio, avatar, cover_image, country, nationality, current_team, main_game, years_experience, real_name, liquipedia_id || '', liquipedia_url || '', liquipedia_verified || false, liquipedia_data || '{}', profile_source || 'manual', profile_status || 'community', verification_method || '', scout_score || 0, esports_value_score || 0, social_links || '{}', req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Username or email already exists' });
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/player-profile', authenticate, async (req, res) => {
  const { game, rank, kd_ratio, preferred_role, achievements, teams_played, cv_url, acs, adr, headshot_percent, clutch_percent, opening_duel_percent, tournament_win_percent, individual_achievements } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO player_profiles (user_id, game, rank, kd_ratio, preferred_role, achievements, teams_played, cv_url, acs, adr, headshot_percent, clutch_percent, opening_duel_percent, tournament_win_percent, individual_achievements)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (user_id) DO UPDATE SET
         game = COALESCE($2, player_profiles.game),
         rank = COALESCE($3, player_profiles.rank),
         kd_ratio = COALESCE($4, player_profiles.kd_ratio),
         preferred_role = COALESCE($5, player_profiles.preferred_role),
         achievements = COALESCE($6, player_profiles.achievements),
         teams_played = COALESCE($7, player_profiles.teams_played),
         cv_url = COALESCE($8, player_profiles.cv_url),
         acs = COALESCE($9, player_profiles.acs),
         adr = COALESCE($10, player_profiles.adr),
         headshot_percent = COALESCE($11, player_profiles.headshot_percent),
         clutch_percent = COALESCE($12, player_profiles.clutch_percent),
         opening_duel_percent = COALESCE($13, player_profiles.opening_duel_percent),
         tournament_win_percent = COALESCE($14, player_profiles.tournament_win_percent),
         individual_achievements = COALESCE($15, player_profiles.individual_achievements)
       RETURNING *`,
      [
        req.user.id,
        game || '',
        rank || '',
        kd_ratio !== undefined ? parseFloat(kd_ratio) : 0,
        preferred_role || '',
        achievements || '',
        teams_played || '',
        cv_url || '',
        acs !== undefined ? parseFloat(acs) : 0,
        adr !== undefined ? parseFloat(adr) : 0,
        headshot_percent !== undefined ? parseFloat(headshot_percent) : 0,
        clutch_percent !== undefined ? parseFloat(clutch_percent) : 0,
        opening_duel_percent !== undefined ? parseFloat(opening_duel_percent) : 0,
        tournament_win_percent !== undefined ? parseFloat(tournament_win_percent) : 0,
        individual_achievements ? (typeof individual_achievements === 'string' ? individual_achievements : JSON.stringify(individual_achievements)) : '[]',
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/scout-profile', authenticate, async (req, res) => {
  const { experience, teams_coached, achievements, cv_url, organization, coaching_specialty, best_achievement, years_experience, profile_source, liquipedia_id, liquipedia_url, liquipedia_verified } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO scout_profiles (user_id, experience, teams_coached, achievements, cv_url, organization, coaching_specialty, best_achievement, years_experience, profile_source, liquipedia_id, liquipedia_url, liquipedia_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (user_id) DO UPDATE SET
         experience = COALESCE($2, scout_profiles.experience),
         teams_coached = COALESCE($3, scout_profiles.teams_coached),
         achievements = COALESCE($4, scout_profiles.achievements),
         cv_url = COALESCE($5, scout_profiles.cv_url),
         organization = COALESCE($6, scout_profiles.organization),
         coaching_specialty = COALESCE($7, scout_profiles.coaching_specialty),
         best_achievement = COALESCE($8, scout_profiles.best_achievement),
         years_experience = COALESCE($9, scout_profiles.years_experience),
         profile_source = COALESCE($10, scout_profiles.profile_source),
         liquipedia_id = COALESCE($11, scout_profiles.liquipedia_id),
         liquipedia_url = COALESCE($12, scout_profiles.liquipedia_url),
         liquipedia_verified = COALESCE($13, scout_profiles.liquipedia_verified)
       RETURNING *`,
      [
        req.user.id,
        experience || '',
        teams_coached || '',
        achievements || '',
        cv_url || '',
        organization || '',
        coaching_specialty || '',
        best_achievement || '',
        years_experience !== undefined ? years_experience : 0,
        profile_source || 'manual',
        liquipedia_id || '',
        liquipedia_url || '',
        liquipedia_verified || false,
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }
  try {
    const result = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { username, email, newPassword } = req.body;
  if (!username || !email || !newPassword) {
    return res.status(400).json({ error: 'Username, email, and new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!/\d/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must include at least one number' });
  }
  if (!/[!@#$%^&*]/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must include at least one special character (!@#$%^&*)' });
  }
  try {
    const result = await db.query(
      'SELECT id, email FROM users WHERE username = $1',
      [username]
    );
    if (!result.rows.length) {
      return res.status(400).json({ error: 'Username and email do not match our records' });
    }
    const user = result.rows[0];
    if (!user.email || user.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({ error: 'Username and email do not match our records' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, user.id]);
    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/account', authenticate, async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.json({ success: true, message: 'Account permanently deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

const ALLOWED_GAMES = ['Valorant', 'Tekken 8', 'PUBG Mobile'];

router.get('/me/games', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT game FROM (
        SELECT game FROM tournaments
        UNION
        SELECT game_title AS game FROM videos
        UNION
        SELECT game FROM player_profiles
      ) sub WHERE game IS NOT NULL AND game != ''
      ORDER BY game`
    );
    res.json([...ALLOWED_GAMES].sort());
  } catch (err) {
    console.error(err);
    res.json(ALLOWED_GAMES);
  }
});

router.post('/upload-doc', authenticate, upload.single('doc'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No document file uploaded' });
  const docUrl = `/uploads/${req.file.filename}`;
  res.json({ url: docUrl });
});

module.exports = router;
