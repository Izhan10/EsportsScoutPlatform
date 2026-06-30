const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware');
const { getIO } = require('../io');

const router = express.Router();

// ─── REQUEST RECRUITING PERMISSION ─────────────────────────
router.post('/permissions/request', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: 'Player ID required' });
    const playerIdNum = parseInt(playerId, 10);

    const playerResult = await db.query('SELECT id, username, role FROM users WHERE id = $1', [playerIdNum]);
    if (!playerResult.rows.length) return res.status(404).json({ error: 'Player not found' });
    if (playerResult.rows[0].role !== 'player') return res.status(400).json({ error: 'User is not a player' });

    const result = await db.query(
      `INSERT INTO recruitment_permissions (scout_id, player_id) VALUES ($1, $2) RETURNING *`,
      [req.user.id, playerIdNum]
    );
    const rp = result.rows[0];

    const io = getIO();
    if (io) {
      const scoutData = await db.query('SELECT id, username, avatar FROM users WHERE id = $1', [req.user.id]);
      io.to(`user:${playerIdNum}`).emit('permissionRequest', {
        id: rp.id,
        scout_id: req.user.id,
        scout_name: scoutData.rows[0]?.username || req.user.username,
        scout_avatar: scoutData.rows[0]?.avatar || '',
        status: 'pending',
      });
      io.to(`user:${playerIdNum}`).emit('notification_created', {
        type: 'permission_request',
        title: scoutData.rows[0]?.username || req.user.username,
        message: 'wants permission to recruit you',
        related_id: rp.id,
      });
    }

    res.status(201).json(rp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── CHECK PERMISSION STATUS (between scout and player) ────
router.get('/permissions/status/:playerId', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    const result = await db.query(
      `SELECT * FROM recruitment_permissions WHERE scout_id = $1 AND player_id = $2 ORDER BY updated_at DESC LIMIT 1`,
      [req.user.id, playerId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET PENDING PERMISSIONS FOR PLAYER ────────────────────
router.get('/permissions/pending-player', authenticate, requireRole('player'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT rp.*, u.username AS scout_username, u.avatar AS scout_avatar FROM recruitment_permissions rp JOIN users u ON u.id = rp.scout_id WHERE rp.player_id = $1 AND rp.status = 'pending' ORDER BY rp.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET PERMISSIONS STATUS FOR PLAYER (all statuses) ─────
router.get('/permissions/all-player', authenticate, requireRole('player'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT rp.*, u.username AS scout_username, u.avatar AS scout_avatar FROM recruitment_permissions rp JOIN users u ON u.id = rp.scout_id WHERE rp.player_id = $1 ORDER BY rp.updated_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET PENDING PERMISSIONS FOR SCOUT ─────────────────────
router.get('/permissions/pending-scout', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT rp.*, u.username AS player_username, u.avatar AS player_avatar FROM recruitment_permissions rp JOIN users u ON u.id = rp.player_id WHERE rp.scout_id = $1 AND rp.status = 'pending' ORDER BY rp.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET APPROVED PERMISSIONS FOR SCOUT ────────────────────
router.get('/permissions/approved-scout', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT rp.*, u.username AS player_username, u.avatar AS player_avatar, u.current_team, pp.game, pp.preferred_role FROM recruitment_permissions rp JOIN users u ON u.id = rp.player_id LEFT JOIN player_profiles pp ON pp.user_id = rp.player_id WHERE rp.scout_id = $1 AND rp.status = 'approved' ORDER BY rp.updated_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── APPROVE PERMISSION ────────────────────────────────────
router.put('/permissions/:id/approve', authenticate, requireRole('player'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const rpResult = await db.query(`SELECT * FROM recruitment_permissions WHERE id = $1`, [id]);
    if (!rpResult.rows.length) return res.status(404).json({ error: 'Permission not found' });
    const rp = rpResult.rows[0];
    if (rp.player_id !== req.user.id) return res.status(403).json({ error: 'Not your permission' });
    if (rp.status !== 'pending') return res.status(400).json({ error: 'Permission already processed' });

    const result = await db.query(`UPDATE recruitment_permissions SET status = 'approved' WHERE id = $1 RETURNING *`, [id]);
    const updated = result.rows[0];

    const io = getIO();
    if (io) {
      io.to(`user:${rp.scout_id}`).emit('permissionResponse', {
        id: rp.id,
        player_id: req.user.id,
        player_username: req.user.username,
        status: 'approved',
        permission: updated,
      });
      io.to(`user:${rp.scout_id}`).emit('notification_created', {
        type: 'permission_response',
        title: req.user.username,
        message: 'approved your recruitment request',
        related_id: rp.id,
      });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DECLINE PERMISSION ────────────────────────────────────
router.put('/permissions/:id/decline', authenticate, requireRole('player'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const rpResult = await db.query(`SELECT * FROM recruitment_permissions WHERE id = $1`, [id]);
    if (!rpResult.rows.length) return res.status(404).json({ error: 'Permission not found' });
    const rp = rpResult.rows[0];
    if (rp.player_id !== req.user.id) return res.status(403).json({ error: 'Not your permission' });
    if (rp.status !== 'pending') return res.status(400).json({ error: 'Permission already processed' });

    const result = await db.query(`UPDATE recruitment_permissions SET status = 'declined' WHERE id = $1 RETURNING *`, [id]);

    const io = getIO();
    if (io) {
      io.to(`user:${rp.scout_id}`).emit('permissionResponse', {
        id: rp.id,
        player_id: req.user.id,
        player_username: req.user.username,
        status: 'declined',
      });
      io.to(`user:${rp.scout_id}`).emit('notification_created', {
        type: 'permission_response',
        title: req.user.username,
        message: 'declined your recruitment request',
        related_id: rp.id,
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── REVOKE PERMISSION ─────────────────────────────────────
router.put('/permissions/:id/revoke', authenticate, requireRole('player', 'scout'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const rpResult = await db.query(`SELECT * FROM recruitment_permissions WHERE id = $1`, [id]);
    if (!rpResult.rows.length) return res.status(404).json({ error: 'Permission not found' });
    const rp = rpResult.rows[0];
    if (rp.player_id !== req.user.id && rp.scout_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your permission' });
    }

    const result = await db.query(`UPDATE recruitment_permissions SET status = 'revoked' WHERE id = $1 RETURNING *`, [id]);

    const io = getIO();
    if (io) {
      const notifyId = rp.player_id === req.user.id ? rp.scout_id : rp.player_id;
      io.to(`user:${notifyId}`).emit('permissionResponse', {
        id: rp.id,
        status: 'revoked',
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── SEND TEAM OFFER (requires approved permission) ────────
router.post('/offers/send', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const { playerId, teamName, role, tournamentFocus, contractDuration, prizeShare, notes } = req.body;
    if (!playerId || !teamName || !role) {
      return res.status(400).json({ error: 'Player ID, team name, and role are required' });
    }
    const playerIdNum = parseInt(playerId, 10);

    const permResult = await db.query(
      `SELECT * FROM recruitment_permissions WHERE scout_id = $1 AND player_id = $2 AND status = 'approved' ORDER BY updated_at DESC LIMIT 1`,
      [req.user.id, playerIdNum]
    );
    if (!permResult.rows.length) {
      return res.status(403).json({ error: 'No approved recruitment permission. Request permission first.' });
    }

    const result = await db.query(
      `INSERT INTO team_offers (scout_id, player_id, team_name, role, tournament_focus, contract_duration, prize_share, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, playerIdNum, teamName, role, tournamentFocus || '', contractDuration || '', prizeShare || 0, notes || '']
    );
    const offer = result.rows[0];

    const io = getIO();
    if (io) {
      const scoutData = await db.query('SELECT id, username, avatar FROM users WHERE id = $1', [req.user.id]);
      io.to(`user:${playerIdNum}`).emit('teamOffer', {
        id: offer.id,
        scout_id: req.user.id,
        scout_name: scoutData.rows[0]?.username || req.user.username,
        scout_avatar: scoutData.rows[0]?.avatar || '',
        ...offer,
      });
      io.to(`user:${playerIdNum}`).emit('notification_created', {
        type: 'team_offer',
        title: `${scoutData.rows[0]?.username || req.user.username} offered you a spot`,
        message: `Join ${teamName} as ${role}`,
        related_id: offer.id,
      });
    }

    res.status(201).json(offer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET PENDING OFFERS FOR PLAYER ─────────────────────────
router.get('/offers/pending-player', authenticate, requireRole('player'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT tof.*, u.username AS scout_username, u.avatar AS scout_avatar FROM team_offers tof JOIN users u ON u.id = tof.scout_id WHERE tof.player_id = $1 AND tof.status = 'pending' ORDER BY tof.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET ALL OFFERS FOR PLAYER (history) ───────────────────
router.get('/offers/all-player', authenticate, requireRole('player'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT tof.*, u.username AS scout_username, u.avatar AS scout_avatar FROM team_offers tof JOIN users u ON u.id = tof.scout_id WHERE tof.player_id = $1 ORDER BY tof.updated_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET SENT OFFERS FOR SCOUT ─────────────────────────────
router.get('/offers/sent-scout', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT tof.*, u.username AS player_username, u.avatar AS player_avatar FROM team_offers tof JOIN users u ON u.id = tof.player_id WHERE tof.scout_id = $1 ORDER BY tof.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET OFFERS BY STATUS FOR SCOUT ────────────────────────
router.get('/offers/scout-by-status/:status', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const status = req.params.status;
    const validStatuses = ['pending', 'accepted', 'declined', 'expired'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const result = await db.query(
      `SELECT tof.*, u.username AS player_username, u.avatar AS player_avatar FROM team_offers tof JOIN users u ON u.id = tof.player_id WHERE tof.scout_id = $1 AND tof.status = $2 ORDER BY tof.created_at DESC`,
      [req.user.id, status]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ACCEPT OFFER ──────────────────────────────────────────
router.put('/offers/:id/accept', authenticate, requireRole('player'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const offerResult = await db.query(`SELECT * FROM team_offers WHERE id = $1`, [id]);
    if (!offerResult.rows.length) return res.status(404).json({ error: 'Offer not found' });
    const offer = offerResult.rows[0];
    if (offer.player_id !== req.user.id) return res.status(403).json({ error: 'Not your offer' });
    if (offer.status !== 'pending') return res.status(400).json({ error: 'Offer already processed' });

    // Optimistic lock: try to atomically update status, skip if already processed
    const lockResult = await db.query(
      `UPDATE team_offers SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id]
    );
    if (!lockResult.rows.length) {
      return res.status(400).json({ error: 'Offer already processed by another request' });
    }

    // Check if player already has active membership on this team
    let teamResult = await db.query(`SELECT * FROM teams WHERE name = $1 AND created_by = $2`, [offer.team_name, offer.scout_id]);
    let teamId;
    if (teamResult.rows.length) {
      teamId = teamResult.rows[0].id;
      const existingMember = await db.query(
        `SELECT * FROM team_members WHERE team_id = $1 AND player_id = $2 AND status = 'active'`,
        [teamId, req.user.id]
      );
      if (existingMember.rows.length) {
        await db.query(
          `UPDATE users SET current_team = (SELECT name FROM teams WHERE id = $1) WHERE id = $2`,
          [teamId, req.user.id]
        );
        const io = getIO();
        if (io) {
          io.to(`user:${offer.scout_id}`).emit('offerResponse', { id: offer.id, player_id: req.user.id, player_username: req.user.username, status: 'accepted', team_id: teamId, already_member: true });
          io.to(`user:${req.user.id}`).emit('rosterUpdate', { team_id: teamId, player_id: req.user.id, action: 'accepted' });
        }
        return res.json({ success: true, membership: existingMember.rows[0], team_id: teamId, already_member: true });
      }
    }

    // Mark any current active membership as former
    await db.query(
      `UPDATE team_members SET status = 'former', left_at = CURRENT_TIMESTAMP WHERE player_id = $1 AND status = 'active'`,
      [req.user.id]
    );

    // Find or create team
    if (!teamResult.rows.length) {
      const newTeam = await db.query(
        `INSERT INTO teams (name, game, created_by) VALUES ($1, $2, $3) RETURNING *`,
        [offer.team_name, '', offer.scout_id]
      );
      teamId = newTeam.rows[0].id;
    }

    // Create active membership
    const memberResult = await db.query(
      `INSERT INTO team_members (team_id, player_id, role, status) VALUES ($1, $2, $3, 'active') RETURNING *`,
      [teamId, req.user.id, offer.role]
    );

    // Update player's current_team
    await db.query(
      `UPDATE users SET current_team = (SELECT name FROM teams WHERE id = $1) WHERE id = $2`,
      [teamId, req.user.id]
    );

    // Create TeamActivity entries
    await db.query(
      `INSERT INTO team_activity (team_id, actor_id, target_id, activity_type, metadata) VALUES ($1, $2, $3, 'recruitment_accepted', $4)`,
      [teamId, offer.scout_id, req.user.id, JSON.stringify({ offer_id: offer.id, team_name: offer.team_name })]
    );

    await db.query(
      `INSERT INTO team_activity (team_id, actor_id, target_id, activity_type, metadata) VALUES ($1, $2, $3, 'member_joined', $4)`,
      [teamId, req.user.id, req.user.id, JSON.stringify({ role: offer.role })]
    );

    const io = getIO();
    if (io) {
      io.to(`user:${offer.scout_id}`).emit('offerResponse', {
        id: offer.id,
        player_id: req.user.id,
        player_username: req.user.username,
        status: 'accepted',
        team_id: teamId,
        team_name: offer.team_name,
      });
      io.to(`user:${req.user.id}`).emit('rosterUpdate', {
        team_id: teamId,
        player_id: req.user.id,
        action: 'accepted',
      });
      io.to(`user:${offer.scout_id}`).emit('notification_created', {
        type: 'offer_response',
        title: req.user.username,
        message: `accepted your offer to join ${offer.team_name}`,
        related_id: offer.id,
      });
      io.to(`user:${offer.scout_id}`).emit('statsUpdate', { type: 'member_added', team_id: teamId });
      io.to(`user:${req.user.id}`).emit('statsUpdate', { type: 'team_changed', team_id: teamId, team_name: offer.team_name });
    }

    res.json({ success: true, membership: memberResult.rows[0], team_id: teamId, team_name: offer.team_name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DECLINE OFFER ─────────────────────────────────────────
router.put('/offers/:id/decline', authenticate, requireRole('player'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const offerResult = await db.query(`SELECT * FROM team_offers WHERE id = $1`, [id]);
    if (!offerResult.rows.length) return res.status(404).json({ error: 'Offer not found' });
    const offer = offerResult.rows[0];
    if (offer.player_id !== req.user.id) return res.status(403).json({ error: 'Not your offer' });
    if (offer.status !== 'pending') return res.status(400).json({ error: 'Offer already processed' });

    await db.query(`UPDATE team_offers SET status = 'declined' WHERE id = $1`, [id]);

    const io = getIO();
    if (io) {
      io.to(`user:${offer.scout_id}`).emit('offerResponse', {
        id: offer.id,
        player_id: req.user.id,
        player_username: req.user.username,
        status: 'declined',
      });
      io.to(`user:${offer.scout_id}`).emit('notification_created', {
        type: 'offer_response',
        title: req.user.username,
        message: `declined your offer to join ${offer.team_name}`,
        related_id: offer.id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET PLAYER'S ACTIVE TEAM (via offers accepted) ────────
router.get('/my-team/player', authenticate, requireRole('player'), async (req, res) => {
  try {
    const memberResult = await db.query(
      `SELECT tm.* FROM team_members tm WHERE tm.player_id = $1 AND tm.status = 'active'`,
      [req.user.id]
    );
    if (!memberResult.rows.length) return res.json(null);

    const tm = memberResult.rows[0];
    const teamResult = await db.query(`SELECT * FROM teams WHERE id = $1`, [tm.team_id]);
    if (!teamResult.rows.length) return res.json(null);

    const team = teamResult.rows[0];
    const creatorResult = await db.query(`SELECT id, username, avatar FROM users WHERE id = $1`, [team.created_by]);

    // Get accepted offer info for this team+player
    const offerResult = await db.query(
      `SELECT * FROM team_offers WHERE scout_id = $1 AND player_id = $2 AND status = 'accepted' ORDER BY updated_at DESC LIMIT 1`,
      [team.created_by, req.user.id]
    );

    res.json({
      ...tm,
      team_name: team.name,
      team_game: team.game,
      creator: creatorResult.rows[0] || null,
      offer: offerResult.rows[0] || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET PLAYER'S FORMER TEAMS ─────────────────────────────
router.get('/former-teams/player', authenticate, requireRole('player'), async (req, res) => {
  try {
    const memberResult = await db.query(
      `SELECT tm.*, u.username, u.avatar FROM team_members tm JOIN users u ON u.id = tm.player_id WHERE tm.player_id = $1 AND tm.status = 'former' ORDER BY tm.left_at DESC`,
      [req.user.id]
    );
    const rows = memberResult.rows.map(r => {
      const t = db.readData().teams.find(tt => tt.id === r.team_id);
      return { ...r, team_name: t ? t.name : 'Unknown' };
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
