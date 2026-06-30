const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware');
const { getIO } = require('../io');

const router = express.Router();

/**
 * GET /api/notifications
 * Returns all pending notifications for the authenticated user.
 * Aggregates: unread messages, pending permission requests (player),
 *   pending team offers (player), pending recruitment requests (player),
 *   permission responses (scout), offer responses (scout).
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const notifications = [];

    // 1. Unread messages (for all users)
    try {
      const unreadResult = await db.query(
        `SELECT m.id, m.conversation_id, m.sender_id, m.message, m.message_type, m.attachment_url, m.created_at,
                u.username AS sender_name, u.avatar AS sender_avatar
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id IN (
           SELECT id FROM conversations
           WHERE participant1_id = $1 OR participant2_id = $1
         )
         AND m.sender_id != $1
         AND m.read_at IS NULL
         ORDER BY m.created_at DESC
         LIMIT 20`,
        [userId]
      );
      if (unreadResult.rows) {
        unreadResult.rows.forEach(msg => {
          notifications.push({
            id: `msg_${msg.id}`,
            type: 'message',
            title: msg.sender_name || 'Unknown',
            message: msg.message || (msg.message_type === 'image' ? 'Sent an image' : msg.message_type === 'voice' ? 'Sent a voice message' : 'Sent a file'),
            avatar: msg.sender_avatar || '',
            sender_id: msg.sender_id,
            related_id: msg.conversation_id,
            route: `/messages.html?conv=${msg.conversation_id}`,
            is_read: false,
            created_at: msg.created_at || new Date().toISOString(),
            raw: msg,
          });
        });
      }
    } catch (e) {
      console.error('[Notifications] Unread messages error:', e.message);
    }

    // 2. Pending recruitment permissions (for players)
    if (role === 'player') {
      try {
        const permResult = await db.query(
          `SELECT rp.id, rp.status, rp.created_at,
                  u.username AS scout_username, u.avatar AS scout_avatar
           FROM recruitment_permissions rp
           JOIN users u ON u.id = rp.scout_id
           WHERE rp.player_id = $1 AND rp.status = 'pending'
           ORDER BY rp.created_at DESC
           LIMIT 20`,
          [userId]
        );
        if (permResult.rows) {
          permResult.rows.forEach(rp => {
            notifications.push({
              id: `perm_${rp.id}`,
              type: 'permission_request',
              title: rp.scout_username || 'A scout',
              message: 'wants permission to recruit you',
              avatar: rp.scout_avatar || '',
              sender_id: null,
              related_id: rp.id,
              route: '/pages/player/dashboard.html',
              is_read: false,
              created_at: rp.created_at || new Date().toISOString(),
              raw: { ...rp, permission_id: rp.id },
            });
          });
        }
      } catch (e) {
        console.error('[Notifications] Permissions error:', e.message);
      }

      // 3. Pending team offers (for players)
      try {
        const offerResult = await db.query(
          `SELECT tof.id, tof.team_name, tof.role, tof.status, tof.created_at,
                  u.username AS scout_username, u.avatar AS scout_avatar
           FROM team_offers tof
           JOIN users u ON u.id = tof.scout_id
           WHERE tof.player_id = $1 AND tof.status = 'pending'
           ORDER BY tof.created_at DESC
           LIMIT 20`,
          [userId]
        );
        if (offerResult.rows) {
          offerResult.rows.forEach(o => {
            notifications.push({
              id: `offer_${o.id}`,
              type: 'team_offer',
              title: `${o.scout_username || 'A scout'} offered you a spot`,
              message: `Join ${o.team_name} as ${o.role}`,
              avatar: o.scout_avatar || '',
              sender_id: null,
              related_id: o.id,
              route: '/pages/player/dashboard.html',
              is_read: false,
              created_at: o.created_at || new Date().toISOString(),
              raw: { ...o, offer_id: o.id },
            });
          });
        }
      } catch (e) {
        console.error('[Notifications] Offers error:', e.message);
      }

      // 4. Pending recruitment requests (for players)
      try {
        const recruitResult = await db.query(
          `SELECT rr.id, rr.message, rr.created_at,
                  t.name AS team_name,
                  u.username AS scout_name, u.avatar AS scout_avatar
           FROM recruitment_requests rr
           JOIN teams t ON t.id = rr.team_id
           JOIN users u ON u.id = rr.scout_id
           WHERE rr.player_id = $1 AND rr.status = 'pending'
           ORDER BY rr.created_at DESC
           LIMIT 20`,
          [userId]
        );
        if (recruitResult.rows) {
          recruitResult.rows.forEach(rr => {
            notifications.push({
              id: `recruit_${rr.id}`,
              type: 'recruitment_request',
              title: `${rr.scout_name || 'A scout'} invited you to ${rr.team_name}`,
              message: rr.message || 'Join their team!',
              avatar: rr.scout_avatar || '',
              sender_id: null,
              related_id: rr.id,
              route: '/pages/player/dashboard.html',
              is_read: false,
              created_at: rr.created_at || new Date().toISOString(),
              raw: { ...rr, request_id: rr.id },
            });
          });
        }
      } catch (e) {
        console.error('[Notifications] Recruitment requests error:', e.message);
      }
    }

    // 5. For scouts: pending permission responses (approved/declined by player)
    //    and offer responses (accepted/declined by player)
    if (role === 'scout') {
      try {
        // Recent permission responses (non-pending, sorted by updated_at)
        const scoutPermResult = await db.query(
          `SELECT rp.id, rp.status, rp.updated_at,
                  u.username AS player_username, u.avatar AS player_avatar
           FROM recruitment_permissions rp
           JOIN users u ON u.id = rp.player_id
           WHERE rp.scout_id = $1 AND rp.status IN ('approved', 'declined')
           ORDER BY rp.updated_at DESC
           LIMIT 20`,
          [userId]
        );
        if (scoutPermResult.rows) {
          scoutPermResult.rows.forEach(rp => {
            notifications.push({
              id: `perm_resp_${rp.id}`,
              type: 'permission_response',
              title: rp.player_username || 'A player',
              message: rp.status === 'approved' ? 'approved your recruitment request' : 'declined your recruitment request',
              avatar: rp.player_avatar || '',
              sender_id: null,
              related_id: rp.id,
              route: '/pages/scout/dashboard.html',
              is_read: false,
              created_at: rp.updated_at || new Date().toISOString(),
              raw: { ...rp, permission_id: rp.id, response: rp.status },
            });
          });
        }
      } catch (e) {
        console.error('[Notifications] Scout permissions error:', e.message);
      }

      try {
        const scoutOfferResult = await db.query(
          `SELECT tof.id, tof.status, tof.team_name, tof.role, tof.updated_at,
                  u.username AS player_username, u.avatar AS player_avatar
           FROM team_offers tof
           JOIN users u ON u.id = tof.player_id
           WHERE tof.scout_id = $1 AND tof.status IN ('accepted', 'declined')
           ORDER BY tof.updated_at DESC
           LIMIT 20`,
          [userId]
        );
        if (scoutOfferResult.rows) {
          scoutOfferResult.rows.forEach(o => {
            notifications.push({
              id: `offer_resp_${o.id}`,
              type: 'offer_response',
              title: o.player_username || 'A player',
              message: o.status === 'accepted'
                ? `accepted your offer to join ${o.team_name} as ${o.role}`
                : `declined your offer to join ${o.team_name}`,
              avatar: o.player_avatar || '',
              sender_id: null,
              related_id: o.id,
              route: '/pages/scout/dashboard.html',
              is_read: false,
              created_at: o.updated_at || new Date().toISOString(),
              raw: { ...o, offer_id: o.id, response: o.status },
            });
          });
        }
      } catch (e) {
        console.error('[Notifications] Scout offers error:', e.message);
      }
    }

    // Sort all by created_at descending
    notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Limit to 50
    const limited = notifications.slice(0, 50);

    res.json({ notifications: limited, total: limited.length, unread: limited.length });
  } catch (err) {
    console.error('[Notifications] Global error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/notifications/count
 * Returns just the unread count for the badge.
 */
router.get('/count', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    let count = 0;

    // Count unread messages
    try {
      const msgResult = await db.query(
        `SELECT COUNT(*) AS cnt FROM messages
         WHERE conversation_id IN (
           SELECT id FROM conversations
           WHERE participant1_id = $1 OR participant2_id = $1
         )
         AND sender_id != $1 AND read_at IS NULL`,
        [userId]
      );
      count += parseInt(msgResult.rows?.[0]?.cnt || 0, 10);
    } catch (e) {}

    // Count pending permissions (player)
    if (role === 'player') {
      try {
        const permResult = await db.query(
          `SELECT COUNT(*) AS cnt FROM recruitment_permissions WHERE player_id = $1 AND status = 'pending'`,
          [userId]
        );
        count += parseInt(permResult.rows?.[0]?.cnt || 0, 10);
      } catch (e) {}
      try {
        const offerResult = await db.query(
          `SELECT COUNT(*) AS cnt FROM team_offers WHERE player_id = $1 AND status = 'pending'`,
          [userId]
        );
        count += parseInt(offerResult.rows?.[0]?.cnt || 0, 10);
      } catch (e) {}
      try {
        const recruitResult = await db.query(
          `SELECT COUNT(*) AS cnt FROM recruitment_requests WHERE player_id = $1 AND status = 'pending'`,
          [userId]
        );
        count += parseInt(recruitResult.rows?.[0]?.cnt || 0, 10);
      } catch (e) {}
    }

    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
