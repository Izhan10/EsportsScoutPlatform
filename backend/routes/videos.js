const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { authenticate } = require('../middleware');
const { analyzeClip } = require('../services/analyzeClip');
const { analyzeVideo, extractThumbnail } = require('../services/videoAnalyzer');
const { UPLOAD_DIR } = require('../config');
const { getIO } = require('../io');

const router = express.Router();

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname) || '.mp4'}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.originalname.match(/\.(mp4|webm|mov)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files allowed'));
    }
  },
});

async function attachAnalysis(videoId, gameTitle, videoMeta, frameAnalysis, mlConfidence, gameSkillResult) {
  const analysis = await analyzeClip({ gameTitle, videoMeta, frameAnalysis, mlConfidence });
  await db.query(
    `INSERT INTO ai_analysis (video_id, aim_score, positioning_score, teamwork_score,
      consistency_score, decision_score, summary, recommendations)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (video_id) DO UPDATE SET
       aim_score=$2, positioning_score=$3, teamwork_score=$4,
       consistency_score=$5, decision_score=$6, summary=$7, recommendations=$8`,
    [
      videoId,
      analysis.aim,
      analysis.positioning,
      analysis.teamplay,
      analysis.consistency,
      analysis.decisionMaking,
      analysis.summary,
      JSON.stringify(analysis.recommendations),
    ]
  );
  await db.query(
    `UPDATE videos SET esv_score=$1, ai_feedback=$2 WHERE id=$3`,
    [analysis.esv, analysis.summary, videoId]
  );
  await db.query(
    `UPDATE player_profiles SET esv_score = GREATEST(esv_score, $1) WHERE user_id = (
       SELECT user_id FROM videos WHERE id = $2
     )`,
    [analysis.esv, videoId]
  );

  if (gameSkillResult) {
    await db.query(
      `INSERT INTO game_skill_analysis (video_id, game, skill_score, source, confidence, metrics)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (video_id) DO UPDATE SET
         game=$2, skill_score=$3, source=$4, confidence=$5, metrics=$6`,
      [
        videoId,
        gameTitle,
        gameSkillResult.skillScore,
        gameSkillResult.source || 'cv',
        gameSkillResult.confidence,
        JSON.stringify(gameSkillResult.metrics),
      ]
    );
  }

  return analysis;
}

function mapVideoRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    avatar: row.avatar || '',
    city: row.city || '',
    videoUrl: row.video_url,
    thumbnailUrl: row.thumbnail_url,
    caption: row.caption,
    gameTitle: row.game_title,
    rank: row.rank,
    esvScore: row.esv_score,
    aiFeedback: row.ai_feedback,
    uploadedAt: row.uploaded_at,
    views: row.views,
    likes: row.likes,
    liked: row.liked || false,
    saved: row.saved || false,
    following: row.following || false,
    shortlisted: row.shortlisted || false,
    analysis: row.aim_score != null ? {
      aim: row.aim_score,
      positioning: row.positioning_score,
      teamplay: row.teamwork_score,
      consistency: row.consistency_score,
      decisionMaking: row.decision_score,
      summary: row.summary,
      recommendations:
        typeof row.recommendations === 'string'
          ? JSON.parse(row.recommendations)
          : row.recommendations || [],
    } : null,
    gameSkill: row.gs_skill_score != null ? {
      skillScore: row.gs_skill_score,
      game: row.gs_game,
      confidence: row.gs_confidence,
      source: row.gs_source,
      metrics: typeof row.gs_metrics === 'string'
        ? JSON.parse(row.gs_metrics)
        : row.gs_metrics || {},
    } : null,
  };
}

const feedQuery = `
  SELECT v.*, u.username, u.avatar, u.city,
    a.aim_score, a.positioning_score, a.teamwork_score,
    a.consistency_score, a.decision_score, a.summary, a.recommendations,
    gs.skill_score AS gs_skill_score, gs.game AS gs_game,
    gs.confidence AS gs_confidence, gs.metrics AS gs_metrics, gs.source AS gs_source,
    EXISTS(SELECT 1 FROM video_likes vl WHERE vl.video_id=v.id AND vl.user_id=$1) AS liked,
    EXISTS(SELECT 1 FROM video_saves vs WHERE vs.video_id=v.id AND vs.user_id=$1) AS saved,
    EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.following_id=v.user_id) AS following,
    EXISTS(SELECT 1 FROM shortlists s WHERE s.scout_id=$1 AND s.player_id=v.user_id) AS shortlisted
  FROM videos v
  JOIN users u ON u.id = v.user_id
  LEFT JOIN ai_analysis a ON a.video_id = v.id
  LEFT JOIN game_skill_analysis gs ON gs.video_id = v.id
`;

router.post('/upload', authenticate, upload.single('video'), async (req, res) => {
  try {
    const { caption, gameTitle, rank } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Video file upload required — URL-only submissions are not supported' });
    }

    const url = `/uploads/${req.file.filename}`;

    const ALLOWED_GAMES = ['Valorant', 'Tekken 8', 'PUBG Mobile'];
    const submittedGame = (gameTitle || 'Valorant').trim();
    if (!ALLOWED_GAMES.some(g => g.toLowerCase() === submittedGame.toLowerCase())) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'Wrong video — only gameplay videos for Valorant, Tekken 8, and PUBG Mobile are supported'
      });
    }

    const videoCheck = await analyzeVideo(req.file.path, submittedGame);
    if (!videoCheck.isGameplay) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: `Video not supported — ${videoCheck.reasons[0] || 'does not appear to contain gameplay footage'}`
      });
    }

    const result = await db.query(
      `INSERT INTO videos (user_id, video_url, caption, game_title, rank)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, url, caption || '', submittedGame, rank || '']
    );
    const video = result.rows[0];

    // Generate thumbnail
    let thumbnailUrl = '';
    try {
      const thumbDir = path.join(UPLOAD_DIR, 'thumbnails');
      if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
      const thumbFilename = `thumb_${video.id}.jpg`;
      const thumbPath = path.join(thumbDir, thumbFilename);
      await extractThumbnail(req.file.path, thumbPath);
      thumbnailUrl = `/uploads/thumbnails/${thumbFilename}`;
      await db.query('UPDATE videos SET thumbnail_url=$1 WHERE id=$2', [thumbnailUrl, video.id]);
    } catch (_) {
      // thumbnail generation is non-critical
    }

    const analysis = await attachAnalysis(
      video.id,
      submittedGame,
      videoCheck.metadata,
      videoCheck.frameAnalysis,
      videoCheck.mlConfidence,
      videoCheck.gameSkillResult
    );
    const full = await db.query(`${feedQuery} WHERE v.id = $2`, [req.user.id, video.id]);
    const mapped = mapVideoRow(full.rows[0]);
    mapped.thumbnailUrl = mapped.thumbnailUrl || thumbnailUrl;
    res.status(201).json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

router.get('/feed', authenticate, async (req, res) => {
  try {
    const { game, rank, minEsv, city, sort = 'recent', limit = 20, offset = 0 } = req.query;
    let query = `${feedQuery} WHERE 1=1`;
    const params = [req.user.id];
    let idx = 2;

    if (game) {
      query += ` AND LOWER(v.game_title) LIKE $${idx++}`;
      params.push(`%${game.toLowerCase()}%`);
    }
    if (rank) {
      query += ` AND LOWER(v.rank) LIKE $${idx++}`;
      params.push(`%${rank.toLowerCase()}%`);
    }
    if (minEsv) {
      query += ` AND v.esv_score >= $${idx++}`;
      params.push(parseInt(minEsv, 10) || 0);
    }
    if (city) {
      query += ` AND LOWER(u.city) LIKE $${idx++}`;
      params.push(`%${city.toLowerCase()}%`);
    }

    switch (sort) {
      case 'skill':
        query += ` ORDER BY gs.skill_score DESC NULLS LAST`;
        break;
      case 'esv':
        query += ` ORDER BY v.esv_score DESC NULLS LAST`;
        break;
      case 'trending':
        query += ` ORDER BY (v.esv_score + COALESCE(gs.skill_score, 0)) DESC NULLS LAST`;
        break;
      case 'recent':
      default:
        query += ` ORDER BY v.uploaded_at DESC`;
        break;
    }

    query += ` LIMIT $${idx++} OFFSET $${idx}`;
    params.push(parseInt(limit, 10) || 20, parseInt(offset, 10) || 0);

    const result = await db.query(query, params);
    res.json(result.rows.map(mapVideoRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/feed/trending', authenticate, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const query = `${feedQuery} ORDER BY (v.views * 0.3 + v.likes * 0.7) DESC LIMIT $2 OFFSET $3`;
    const result = await db.query(query, [req.user.id, parseInt(limit, 10) || 20, parseInt(offset, 10) || 0]);
    res.json(result.rows.map(mapVideoRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/feed/following', authenticate, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const query = `${feedQuery} WHERE EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.following_id=v.user_id) ORDER BY v.uploaded_at DESC LIMIT $2 OFFSET $3`;
    const result = await db.query(query, [req.user.id, parseInt(limit, 10) || 20, parseInt(offset, 10) || 0]);
    res.json(result.rows.map(mapVideoRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/player/:userId', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `${feedQuery} WHERE v.user_id = $2 ORDER BY v.uploaded_at DESC`,
      [req.user.id, req.params.userId]
    );
    res.json(result.rows.map(mapVideoRow));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/saved', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `${feedQuery} WHERE EXISTS (SELECT 1 FROM video_saves vs WHERE vs.video_id=v.id AND vs.user_id=$1) ORDER BY v.uploaded_at DESC`,
      [req.user.id]
    );
    res.json(result.rows.map(mapVideoRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query(`${feedQuery} WHERE v.id = $2`, [req.user.id, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Video not found' });
    res.json(mapVideoRow(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const vid = parseInt(req.params.id, 10);
    const existing = await db.query(
      'SELECT 1 FROM video_likes WHERE video_id=$1 AND user_id=$2',
      [vid, req.user.id]
    );
    if (existing.rows.length) {
      await db.query('DELETE FROM video_likes WHERE video_id=$1 AND user_id=$2', [vid, req.user.id]);
      await db.query('UPDATE videos SET likes = GREATEST(likes - 1, 0) WHERE id=$1', [vid]);
      return res.json({ liked: false });
    }
    await db.query('INSERT INTO video_likes (video_id, user_id) VALUES ($1,$2)', [vid, req.user.id]);
    await db.query('UPDATE videos SET likes = likes + 1 WHERE id=$1', [vid]);
    res.json({ liked: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/save', authenticate, async (req, res) => {
  try {
    const vid = parseInt(req.params.id, 10);
    const existing = await db.query(
      'SELECT 1 FROM video_saves WHERE video_id=$1 AND user_id=$2',
      [vid, req.user.id]
    );
    if (existing.rows.length) {
      await db.query('DELETE FROM video_saves WHERE video_id=$1 AND user_id=$2', [vid, req.user.id]);
      return res.json({ saved: false });
    }
    await db.query('INSERT INTO video_saves (video_id, user_id) VALUES ($1,$2)', [vid, req.user.id]);
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/view', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE videos SET views = views + 1 WHERE id=$1 RETURNING views',
      [req.params.id]
    );
    const views = result.rows[0]?.views || 0;
    const io = getIO();
    if (io) io.emit('viewUpdate', { videoId: parseInt(req.params.id, 10), views });
    res.json({ ok: true, views });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const video = await db.query('SELECT user_id, video_url, thumbnail_url FROM videos WHERE id=$1', [req.params.id]);
    if (!video.rows.length) return res.status(404).json({ error: 'Video not found' });
    if (video.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const v = video.rows[0];
    await db.query('DELETE FROM videos WHERE id=$1', [req.params.id]);
    const filePath = path.join(UPLOAD_DIR, path.basename(v.video_url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (v.thumbnail_url) {
      const thumbPath = path.join(UPLOAD_DIR, 'thumbnails', path.basename(v.thumbnail_url));
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/follow', authenticate, async (req, res) => {
  try {
    const video = await db.query('SELECT user_id FROM videos WHERE id=$1', [req.params.id]);
    if (!video.rows.length) return res.status(404).json({ error: 'Video not found' });
    const playerId = video.rows[0].user_id;
    if (playerId === req.user.id) return res.json({ following: false });

    const existing = await db.query(
      'SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=$2',
      [req.user.id, playerId]
    );
    if (existing.rows.length) {
      await db.query('DELETE FROM follows WHERE follower_id=$1 AND following_id=$2', [
        req.user.id,
        playerId,
      ]);
      return res.json({ following: false });
    }
    await db.query('INSERT INTO follows (follower_id, following_id) VALUES ($1,$2)', [
      req.user.id,
      playerId,
    ]);
    res.json({ following: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
