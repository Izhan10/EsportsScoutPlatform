const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticate } = require('../middleware');
const { analyzeClip } = require('../services/analyzeClip');
const { analyzeVideo } = require('../services/videoAnalyzer');
const { UPLOAD_DIR } = require('../config');

const router = express.Router();

router.get('/:videoId', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, v.esv_score, v.game_title,
              gs.skill_score AS gs_skill_score, gs.game AS gs_game,
              gs.confidence AS gs_confidence, gs.metrics AS gs_metrics, gs.source AS gs_source
       FROM ai_analysis a
       JOIN videos v ON v.id = a.video_id
       LEFT JOIN game_skill_analysis gs ON gs.video_id = a.video_id
       WHERE a.video_id = $1`,
      [req.params.videoId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Analysis not found' });
    const row = result.rows[0];
    res.json({
      videoId: row.video_id,
      esv: row.esv_score,
      aim: row.aim_score,
      positioning: row.positioning_score,
      teamplay: row.teamwork_score,
      consistency: row.consistency_score,
      decisionMaking: row.decision_score,
      summary: row.summary,
      recommendations: row.recommendations || [],
      gameSkill: row.gs_skill_score != null ? {
        skillScore: row.gs_skill_score,
        game: row.gs_game,
        confidence: row.gs_confidence,
        source: row.gs_source,
        metrics: typeof row.gs_metrics === 'string'
          ? JSON.parse(row.gs_metrics)
          : row.gs_metrics || {},
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/analyze/:videoId', authenticate, async (req, res) => {
  try {
    const videoId = parseInt(req.params.videoId, 10);

    const videoResult = await db.query('SELECT game_title, video_url FROM videos WHERE id=$1', [videoId]);
    if (!videoResult.rows.length) return res.status(404).json({ error: 'Video not found' });
    const videoRow = videoResult.rows[0];
    const gameTitle = videoRow.game_title || 'Valorant';

    const videoFilename = path.basename(videoRow.video_url);
    const videoPath = path.join(UPLOAD_DIR, videoFilename);

    if (!fs.existsSync(videoPath)) {
      return res.status(400).json({ error: 'Video file not found on server for re-analysis' });
    }

    const videoCheck = await analyzeVideo(videoPath);
    if (!videoCheck.isGameplay) {
      return res.status(400).json({
        error: `Video not supported — ${videoCheck.reasons[0] || 'does not appear to contain gameplay footage'}`
      });
    }

    const analysis = await analyzeClip({ gameTitle, videoMeta: videoCheck.metadata, frameAnalysis: videoCheck.frameAnalysis, mlConfidence: videoCheck.mlConfidence });
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
    await db.query('UPDATE videos SET esv_score=$1, ai_feedback=$2 WHERE id=$3', [
      analysis.esv,
      analysis.summary,
      videoId,
    ]);

    if (videoCheck.gameSkillResult) {
      const gs = videoCheck.gameSkillResult;
      await db.query(
        `INSERT INTO game_skill_analysis (video_id, game, skill_score, source, confidence, metrics)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (video_id) DO UPDATE SET
           game=$2, skill_score=$3, source=$4, confidence=$5, metrics=$6`,
        [videoId, gameTitle, gs.skillScore, gs.source || 'cv', gs.confidence, JSON.stringify(gs.metrics)]
      );
    }

    res.json({
      ...analysis,
      gameSkill: videoCheck.gameSkillResult || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
