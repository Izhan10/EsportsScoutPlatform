const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { authenticate } = require('../middleware');
const { getIO } = require('../io');

const router = express.Router();

const CHAT_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'chat');
if (!fs.existsSync(CHAT_UPLOAD_DIR)) fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });

const chatStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CHAT_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname) || ''}`);
  },
});

const chatUpload = multer({
  storage: chatStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'video/mp4', 'video/webm'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|gif|webp|webm|ogg|wav|mp3|mp4)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  },
});

router.post('/upload', authenticate, (req, res) => {
  chatUpload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    const url = `/uploads/chat/${req.file.filename}`;
    res.json({ url, filename: req.file.filename, mimetype: req.file.mimetype });
  });
});

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM conversations WHERE participant1_id = $1 OR participant2_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Conversations] List error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/start', authenticate, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || userId === req.user.id) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const existing = await db.query(
      'SELECT * FROM conversations WHERE (participant1_id = $1 AND participant2_id = $2) OR (participant1_id = $2 AND participant2_id = $1)',
      [req.user.id, userId]
    );

    if (existing.rows.length > 0) {
      return res.json(existing.rows[0]);
    }

    const result = await db.query(
      'INSERT INTO conversations (participant1_id, participant2_id) VALUES ($1, $2) RETURNING *',
      [req.user.id, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Conversations] Start error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/messages', authenticate, async (req, res) => {
  try {
    const convId = parseInt(req.params.id, 10);

    const conv = await db.query(
      'SELECT * FROM conversations WHERE id = $1',
      [convId]
    );
    if (!conv.rows.length) return res.status(404).json({ error: 'Conversation not found' });

    const c = conv.rows[0];
    if (c.participant1_id !== req.user.id && c.participant2_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await db.query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY id ASC',
      [convId]
    );

    const rows = result.rows.map((msg) => {
      if (msg.message_type === 'team_offer') {
        try {
          const offerData = JSON.parse(msg.message || '{}');
          if (offerData.id) {
            const offerResult = db.query('SELECT status FROM team_offers WHERE id = $1', [offerData.id]);
            if (offerResult && offerResult.rows && offerResult.rows.length) {
              offerData.status = offerResult.rows[0].status;
              msg.message = JSON.stringify(offerData);
            }
          }
        } catch {}
      }
      return msg;
    });

    res.json(rows);
  } catch (err) {
    console.error('[Conversations] Messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/messages', authenticate, async (req, res) => {
  try {
    const convId = parseInt(req.params.id, 10);
    const { message, messageType, attachmentUrl, waveform } = req.body;
    const msgText = (message || '').trim();
    const msgType = messageType || 'text';
    if (msgType === 'text' && !msgText) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const conv = await db.query(
      'SELECT * FROM conversations WHERE id = $1',
      [convId]
    );
    if (!conv.rows.length) return res.status(404).json({ error: 'Conversation not found' });

    const c = conv.rows[0];
    if (c.participant1_id !== req.user.id && c.participant2_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await db.query(
      'INSERT INTO messages (conversation_id, sender_id, message, message_type, attachment_url, waveform) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [convId, req.user.id, msgText, msgType, attachmentUrl || '', waveform || '']
    );
    const newMsg = result.rows[0];

    const recipientId = c.participant1_id === req.user.id ? c.participant2_id : c.participant1_id;
    const senderResult = await db.query('SELECT id, username, avatar FROM users WHERE id = $1', [req.user.id]);
    const io = getIO();
    if (io) {
      io.to(`user:${recipientId}`).emit('unreadUpdate', {
        conversationId: convId,
        message: newMsg,
        sender: senderResult.rows[0] || { id: req.user.id, username: 'Unknown' },
      });
    }

    res.status(201).json(newMsg);
  } catch (err) {
    console.error('[Conversations] Send error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/unread', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.id, m.conversation_id, m.sender_id, m.message, m.created_at,
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
      [req.user.id]
    );
    res.json({ unread: result.rows });
  } catch (err) {
    console.error('[Conversations] Unread error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/read-all', authenticate, async (req, res) => {
  try {
    await db.query(
      `UPDATE messages SET read_at = CURRENT_TIMESTAMP
       WHERE conversation_id IN (
         SELECT id FROM conversations
         WHERE participant1_id = $1 OR participant2_id = $1
       )
       AND sender_id != $1 AND read_at IS NULL`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[Conversations] Read-all error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const convId = parseInt(req.params.id, 10);
    const conv = await db.query(
      'SELECT * FROM conversations WHERE id = $1',
      [convId]
    );
    if (!conv.rows.length) return res.status(404).json({ error: 'Conversation not found' });

    const c = conv.rows[0];
    if (c.participant1_id !== req.user.id && c.participant2_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.query(
      'UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL',
      [convId, req.user.id]
    );

    const io = getIO();
    if (io) {
      io.to(`user:${req.user.id}`).emit('notification_read', {
        conversationId: convId,
      });
      const recipientId = c.participant1_id === req.user.id ? c.participant2_id : c.participant1_id;
      io.to(`user:${recipientId}`).emit('messages_read', {
        conversationId: convId,
        readBy: req.user.id,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[Conversations] Read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
