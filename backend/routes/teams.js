const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware');
const { getIO } = require('../io');

const router = express.Router();

// ─── CREATE TEAM ───────────────────────────────────────────
router.post('/', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const { name, game } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }
    const result = await db.query(
      `INSERT INTO teams (name, game, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), game || 'Valorant', req.user.id]
    );
    const team = result.rows[0];

    // Auto-add creator as team owner (insert into team_members with role 'captain')
    await db.query(
      `INSERT INTO team_members (team_id, player_id, role, status) VALUES ($1, $2, $3, 'active')`,
      [team.id, req.user.id, 'captain']
    );

    res.status(201).json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET PLAYER'S CURRENT TEAM (by playerId param) ─────────
router.get('/player/:playerId/current', authenticate, async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    const memberResult = await db.query(
      `SELECT tm.* FROM team_members tm WHERE tm.player_id = $1 AND tm.status = 'active'`,
      [playerId]
    );
    if (!memberResult.rows.length) return res.json(null);

    const tm = memberResult.rows[0];
    const teamResult = await db.query(`SELECT * FROM teams WHERE id = $1`, [tm.team_id]);
    if (!teamResult.rows.length) return res.json(null);

    const team = teamResult.rows[0];
    const creatorResult = await db.query(`SELECT id, username, avatar FROM users WHERE id = $1`, [team.created_by]);

    res.json({
      ...tm,
      team_name: team.name,
      team_game: team.game,
      creator: creatorResult.rows[0] || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET PLAYER'S FORMER TEAMS (by playerId param) ─────────
router.get('/player/:playerId/former', authenticate, async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    const memberResult = await db.query(
      `SELECT tm.*, u.username, u.avatar FROM team_members tm JOIN users u ON u.id = tm.player_id WHERE tm.player_id = $1 AND tm.status = 'former' ORDER BY tm.left_at DESC`,
      [playerId]
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

// ─── GET MY TEAMS ──────────────────────────────────────────
router.get('/mine', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM teams WHERE created_by = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET ALL TEAMS ─────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM teams ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET TEAM BY ID (with roster) ──────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const teamResult = await db.query(`SELECT * FROM teams WHERE id = $1`, [req.params.id]);
    if (!teamResult.rows.length) return res.status(404).json({ error: 'Team not found' });
    const team = teamResult.rows[0];

    const activeResult = await db.query(
      `SELECT tm.*, u.username, u.avatar FROM team_members tm JOIN users u ON u.id = tm.player_id WHERE tm.team_id = $1 AND tm.status = 'active'`,
      [req.params.id]
    );
    const formerResult = await db.query(
      `SELECT tm.*, u.username, u.avatar FROM team_members tm JOIN users u ON u.id = tm.player_id WHERE tm.team_id = $1 AND tm.status = 'former' ORDER BY tm.left_at DESC`,
      [req.params.id]
    );

    const creator = await db.query(`SELECT id, username, avatar FROM users WHERE id = $1`, [team.created_by]);

    res.json({
      ...team,
      active_members: activeResult.rows,
      former_members: formerResult.rows,
      member_count: activeResult.rows.length,
      creator: creator.rows[0] || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET PLAYER'S CURRENT TEAM ─────────────────────────────
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

    res.json({
      ...tm,
      team_name: team.name,
      team_game: team.game,
      creator: creatorResult.rows[0] || null,
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

// ─── SEND RECRUITMENT REQUEST ──────────────────────────────
router.post('/:id/recruit/:playerId', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const playerId = parseInt(req.params.playerId, 10);
    const message = req.body.message || '';

    // Verify team belongs to scout
    const teamResult = await db.query(`SELECT * FROM teams WHERE id = $1`, [teamId]);
    if (!teamResult.rows.length) return res.status(404).json({ error: 'Team not found' });
    if (teamResult.rows[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not your team' });
    }

    // Check player is not already active on this team
    const existing = await db.query(
      `SELECT * FROM team_members WHERE team_id = $1 AND player_id = $2 AND status = 'active'`,
      [teamId, playerId]
    );
    if (existing.rows.length) {
      return res.status(400).json({ error: 'Player is already on this team' });
    }

    // Check for existing pending request
    if (req.app.locals.recruitmentRequests) {
      const exists = req.app.locals.recruitmentRequests.find(
        r => r.team_id === teamId && r.player_id === playerId && r.status === 'pending'
      );
      if (exists) return res.status(400).json({ error: 'Pending request already exists' });
    }

    const result = await db.query(
      `INSERT INTO recruitment_requests (team_id, scout_id, player_id, message) VALUES ($1, $2, $3, $4) RETURNING *`,
      [teamId, req.user.id, playerId, message]
    );
    const rr = result.rows[0];

    // Emit socket event to player
    const io = getIO();
    if (io) {
      const team = teamResult.rows[0];
      io.to(`user:${playerId}`).emit('recruitmentRequest', {
        id: rr.id,
        team_id: teamId,
        team_name: team.name,
        scout_name: req.user.username,
        scout_avatar: req.user.avatar || '',
        message,
      });
      io.to(`user:${playerId}`).emit('notification_created', {
        type: 'recruitment_request',
        title: `${req.user.username} invited you to ${team.name}`,
        message: message || 'Join their team!',
        related_id: rr.id,
      });
    }

    res.status(201).json(rr);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET PENDING REQUESTS FOR PLAYER ───────────────────────
router.get('/recruitment/pending', authenticate, requireRole('player'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT rr.*, t.name AS team_name, u.username AS scout_name, u.avatar AS scout_avatar
       FROM recruitment_requests rr
       JOIN teams t ON t.id = rr.team_id
       JOIN users u ON u.id = rr.scout_id
       WHERE rr.player_id = $1 AND rr.status = 'pending'
       ORDER BY rr.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET RECRUITMENT REQUESTS FOR SCOUT'S TEAMS ────────────
router.get('/recruitment/scout-pending', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT rr.*, t.name AS team_name, u.username AS player_username, u.avatar AS player_avatar
       FROM recruitment_requests rr
       JOIN teams t ON t.id = rr.team_id
       JOIN users u ON u.id = rr.player_id
       WHERE rr.scout_id = $1 AND rr.status = 'pending'
       ORDER BY rr.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ACCEPT RECRUITMENT REQUEST ────────────────────────────
router.put('/recruitment/:id/accept', authenticate, requireRole('player'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const rrResult = await db.query(`SELECT * FROM recruitment_requests WHERE id = $1`, [id]);
    if (!rrResult.rows.length) return res.status(404).json({ error: 'Request not found' });
    const rr = rrResult.rows[0];
    if (rr.player_id !== req.user.id) return res.status(403).json({ error: 'Not your request' });
    if (rr.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

    // Mark any current active membership as former
    await db.query(
      `UPDATE team_members SET status = 'former', left_at = CURRENT_TIMESTAMP WHERE player_id = $1 AND status = 'active'`,
      [req.user.id]
    );

    // Create new active membership
    const memberResult = await db.query(
      `INSERT INTO team_members (team_id, player_id, role, status) VALUES ($1, $2, 'player', 'active') RETURNING *`,
      [rr.team_id, req.user.id]
    );

    // Mark request accepted
    await db.query(
      `UPDATE recruitment_requests SET status = 'accepted' WHERE id = $1`,
      [id]
    );

    // Update player's current_team
    await db.query(
      `UPDATE users SET current_team = (SELECT name FROM teams WHERE id = $1) WHERE id = $2`,
      [rr.team_id, req.user.id]
    );

    // Create TeamActivity entry
    await db.query(
      `INSERT INTO team_activity (team_id, actor_id, target_id, activity_type, metadata) VALUES ($1, $2, $3, 'recruitment_accepted', $4)`,
      [rr.team_id, rr.scout_id, req.user.id, JSON.stringify({ recruitment_id: rr.id, message: rr.message })]
    );

    await db.query(
      `INSERT INTO team_activity (team_id, actor_id, target_id, activity_type, metadata) VALUES ($1, $2, $3, 'member_joined', $4)`,
      [rr.team_id, req.user.id, req.user.id, JSON.stringify({ role: 'player' })]
    );

    // Recalculate team member_count
    const countResult = await db.query(
      `SELECT COUNT(*) AS cnt FROM team_members WHERE team_id = $1 AND status = 'active'`,
      [rr.team_id]
    );
    const memberCount = parseInt(countResult.rows[0]?.cnt || countResult.rows[0]?.count || 0, 10);

    // Emit to scouts and player
    const io = getIO();
    if (io) {
      const teamResult = await db.query(`SELECT * FROM teams WHERE id = $1`, [rr.team_id]);
      const teamName = teamResult.rows[0]?.name || 'a team';
      io.to(`user:${rr.scout_id}`).emit('rosterUpdate', {
        team_id: rr.team_id,
        player_id: req.user.id,
        username: req.user.username,
        action: 'accepted',
        member_count: memberCount,
      });
      io.to(`user:${rr.scout_id}`).emit('notification_created', {
        type: 'recruitment_response',
        title: req.user.username,
        message: `accepted your invitation to join ${teamName}`,
        related_id: rr.id,
      });
      io.to(`user:${rr.scout_id}`).emit('statsUpdate', { type: 'member_added', team_id: rr.team_id, member_count: memberCount });
      io.to(`user:${req.user.id}`).emit('rosterUpdate', {
        team_id: rr.team_id,
        player_id: req.user.id,
        action: 'accepted',
      });
      io.to(`user:${req.user.id}`).emit('statsUpdate', { type: 'team_changed', team_id: rr.team_id, team_name: teamName });
    }

    res.json({ success: true, membership: memberResult.rows[0], member_count: memberCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET TEAM ACTIVITY ─────────────────────────────────────
router.get('/:id/activity', authenticate, async (req, res) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const result = await db.query(
      `SELECT ta.*, actor.username AS actor_name, actor.avatar AS actor_avatar,
              target.username AS target_name, target.avatar AS target_avatar
       FROM team_activity ta
       LEFT JOIN users actor ON actor.id = ta.actor_id
       LEFT JOIN users target ON target.id = ta.target_id
       WHERE ta.team_id = $1
       ORDER BY ta.created_at DESC
       LIMIT 50`,
      [teamId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET TEAM MEMBER COUNT ─────────────────────────────────
router.get('/:id/member-count', authenticate, async (req, res) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const countResult = await db.query(
      `SELECT COUNT(*) AS cnt FROM team_members WHERE team_id = $1 AND status = 'active'`,
      [teamId]
    );
    const memberCount = parseInt(countResult.rows[0]?.cnt || countResult.rows[0]?.count || 0, 10);
    res.json({ member_count: memberCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── REJECT RECRUITMENT REQUEST ────────────────────────────
router.put('/recruitment/:id/reject', authenticate, requireRole('player'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const rrResult = await db.query(`SELECT * FROM recruitment_requests WHERE id = $1`, [id]);
    if (!rrResult.rows.length) return res.status(404).json({ error: 'Request not found' });
    const rr = rrResult.rows[0];
    if (rr.player_id !== req.user.id) return res.status(403).json({ error: 'Not your request' });
    if (rr.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

    await db.query(
      `UPDATE recruitment_requests SET status = 'rejected' WHERE id = $1`,
      [id]
    );

    const io = getIO();
    if (io) {
      const teamResult = await db.query(`SELECT * FROM teams WHERE id = $1`, [rr.team_id]);
      const teamName = teamResult.rows[0]?.name || 'a team';
      io.to(`user:${rr.scout_id}`).emit('rosterUpdate', {
        team_id: rr.team_id,
        player_id: req.user.id,
        action: 'rejected',
      });
      io.to(`user:${rr.scout_id}`).emit('notification_created', {
        type: 'recruitment_response',
        title: req.user.username,
        message: `declined your invitation to join ${teamName}`,
        related_id: rr.id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── UPDATE MEMBER ROLE ────────────────────────────────────
router.put('/:id/members/:memberId', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId, 10);
    const { role } = req.body;
    if (!role || !['player', 'substitute', 'captain'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const result = await db.query(
      `UPDATE team_members SET role = $1 WHERE id = $2 RETURNING *`,
      [role, memberId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Member not found' });
    const member = result.rows[0];
    await db.query(
      `INSERT INTO team_activity (team_id, actor_id, target_id, activity_type, metadata) VALUES ($1, $2, $3, 'role_changed', $4)`,
      [member.team_id, req.user.id, member.player_id, JSON.stringify({ new_role: role })]
    );
    res.json(member);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── REMOVE MEMBER FROM TEAM (set as former) ───────────────
router.delete('/:id/members/:playerId', authenticate, requireRole('scout', 'admin'), async (req, res) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const playerId = parseInt(req.params.playerId, 10);
    await db.query(
      `UPDATE team_members SET status = 'former', left_at = CURRENT_TIMESTAMP WHERE player_id = $1 AND status = 'active'`,
      [playerId]
    );
    await db.query(
      `UPDATE users SET current_team = NULL WHERE id = $1`,
      [playerId]
    );
    await db.query(
      `INSERT INTO team_activity (team_id, actor_id, target_id, activity_type, metadata) VALUES ($1, $2, $3, 'member_removed', $4)`,
      [teamId, req.user.id, playerId, JSON.stringify({})]
    );
    const io = getIO();
    if (io) {
      io.to(`user:${playerId}`).emit('rosterUpdate', { team_id: teamId, player_id: playerId, action: 'removed' });
      io.to(`user:${playerId}`).emit('statsUpdate', { type: 'team_changed', team_id: null });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── LEAVE TEAM (player-initiated) ──────────────────────────
router.put('/leave', authenticate, requireRole('player'), async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE team_members SET status = 'former', left_at = CURRENT_TIMESTAMP WHERE player_id = $1 AND status = 'active' RETURNING *`,
      [req.user.id]
    );
    await db.query(
      `UPDATE users SET current_team = NULL WHERE id = $1`,
      [req.user.id]
    );
    const io = getIO();
    if (io && result.rows.length) {
      const tm = result.rows[0];
      await db.query(
        `INSERT INTO team_activity (team_id, actor_id, target_id, activity_type, metadata) VALUES ($1, $2, $3, 'member_left', $4)`,
        [tm.team_id, req.user.id, req.user.id, JSON.stringify({})]
      );
      const teamResult = await db.query(`SELECT created_by FROM teams WHERE id = $1`, [tm.team_id]);
      if (teamResult.rows.length) {
        io.to(`user:${teamResult.rows[0].created_by}`).emit('rosterUpdate', {
          team_id: tm.team_id,
          player_id: req.user.id,
          action: 'left',
        });
        io.to(`user:${teamResult.rows[0].created_by}`).emit('statsUpdate', { type: 'member_removed', team_id: tm.team_id });
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET TEAM ROSTER (public) ──────────────────────────────
router.get('/:id/roster', authenticate, async (req, res) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const activeResult = await db.query(
      `SELECT tm.*, u.username, u.avatar
       FROM team_members tm
       JOIN users u ON u.id = tm.player_id
       WHERE tm.team_id = $1 AND tm.status = 'active'
       ORDER BY
         CASE tm.role
           WHEN 'captain' THEN 0
           WHEN 'manager' THEN 1
           ELSE 2
         END, u.username`,
      [teamId]
    );
    res.json(activeResult.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
