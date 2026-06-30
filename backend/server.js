const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { PORT, UPLOAD_DIR, SECRET_KEY } = require('./config');
const { setIO } = require('./io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
setIO(io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Missing token'));
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    socket.user = decoded;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

async function verifyConversationAccess(conversationId, userId) {
  try {
    const conv = await db.query('SELECT * FROM conversations WHERE id = $1', [conversationId]);
    if (!conv.rows.length) return false;
    const c = conv.rows[0];
    return c.participant1_id === userId || c.participant2_id === userId;
  } catch {
    return false;
  }
}

const VALID_MESSAGE_TYPES = new Set(['text', 'image', 'voice', 'file', 'permission_request', 'team_offer', 'offer_change']);

io.on('connection', (socket) => {
  if (socket.user) {
    socket.join(`user:${socket.user.id}`);
    socket.broadcast.emit('user_online', { userId: socket.user.id, username: socket.user.username });
  }

  socket.on('disconnect', () => {
    if (socket.user) {
      socket.broadcast.emit('user_offline', { userId: socket.user.id });
    }
  });

  socket.on('joinConversation', async (conversationId) => {
    const userId = socket.user?.id;
    if (!userId || !conversationId) return;
    const hasAccess = await verifyConversationAccess(conversationId, userId);
    if (!hasAccess) return;
    socket.join(`conv:${conversationId}`);
  });

  socket.on('leaveConversation', (conversationId) => {
    socket.leave(`conv:${conversationId}`);
  });

  socket.on('chatMessage', async (data) => {
    try {
      const senderId = socket.user?.id;
      const { conversationId, message, messageType, attachmentUrl, waveform } = data;
      if (!conversationId || !senderId) return;
      const hasAccess = await verifyConversationAccess(conversationId, senderId);
      if (!hasAccess) return;

      const msgType = VALID_MESSAGE_TYPES.has(messageType) ? messageType : 'text';
      if (msgType === 'text' && !message) return;

      const result = await db.query(
        'INSERT INTO messages (conversation_id, sender_id, message, message_type, attachment_url, waveform) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [conversationId, senderId, message || '', msgType, attachmentUrl || '', waveform || '']
      );
      const newMsg = result.rows[0];
      io.to(`conv:${conversationId}`).emit('chatMessage', newMsg);

      const conv = await db.query('SELECT * FROM conversations WHERE id = $1', [conversationId]);
      if (conv.rows.length) {
        const c = conv.rows[0];
        const recipientId = c.participant1_id === senderId ? c.participant2_id : c.participant1_id;
        const sender = await db.query('SELECT id, username, avatar FROM users WHERE id = $1', [senderId]);
        io.to(`user:${recipientId}`).emit('unreadUpdate', {
          conversationId,
          message: newMsg,
          sender: sender.rows[0] || { id: senderId, username: 'Unknown' },
        });
      }
    } catch (err) {
      console.error('Socket DB Error', err);
    }
  });

  // --- Video Call Signaling ---
  socket.on('videoCall:offer', async (data) => {
    const { conversationId, offer } = data;
    const userId = socket.user?.id;
    if (!userId || !conversationId) return;
    const hasAccess = await verifyConversationAccess(conversationId, userId);
    if (!hasAccess) return;
    socket.to(`conv:${conversationId}`).emit('videoCall:offer', {
      offer,
      callerId: userId,
      callerUsername: socket.user?.username || 'Unknown',
    });
  });

  socket.on('videoCall:answer', async (data) => {
    const { conversationId, answer } = data;
    const userId = socket.user?.id;
    if (!userId || !conversationId) return;
    const hasAccess = await verifyConversationAccess(conversationId, userId);
    if (!hasAccess) return;
    socket.to(`conv:${conversationId}`).emit('videoCall:answer', { answer });
  });

  socket.on('videoCall:ice-candidate', async (data) => {
    const { conversationId, candidate } = data;
    const userId = socket.user?.id;
    if (!userId || !conversationId) return;
    const hasAccess = await verifyConversationAccess(conversationId, userId);
    if (!hasAccess) return;
    socket.to(`conv:${conversationId}`).emit('videoCall:ice-candidate', { candidate });
  });

  socket.on('videoCall:end', async (data) => {
    const { conversationId } = data;
    const userId = socket.user?.id;
    if (!userId || !conversationId) return;
    const hasAccess = await verifyConversationAccess(conversationId, userId);
    if (!hasAccess) return;
    socket.to(`conv:${conversationId}`).emit('videoCall:end', {});
  });

  socket.on('videoCall:decline', async (data) => {
    const { conversationId } = data;
    const userId = socket.user?.id;
    if (!userId || !conversationId) return;
    const hasAccess = await verifyConversationAccess(conversationId, userId);
    if (!hasAccess) return;
    socket.to(`conv:${conversationId}`).emit('videoCall:decline', {});
  });

  socket.on('videoCall:busy', async (data) => {
    const { conversationId } = data;
    const userId = socket.user?.id;
    if (!userId || !conversationId) return;
    const hasAccess = await verifyConversationAccess(conversationId, userId);
    if (!hasAccess) return;
    socket.to(`conv:${conversationId}`).emit('videoCall:busy', {});
  });

  socket.on('typing:start', async (data) => {
    const { conversationId } = data;
    const userId = socket.user?.id;
    if (!userId || !conversationId) return;
    const hasAccess = await verifyConversationAccess(conversationId, userId);
    if (!hasAccess) return;
    socket.to(`conv:${conversationId}`).emit('typing:start', { conversationId, userId });
  });

  socket.on('typing:stop', async (data) => {
    const { conversationId } = data;
    const userId = socket.user?.id;
    if (!userId || !conversationId) return;
    const hasAccess = await verifyConversationAccess(conversationId, userId);
    if (!hasAccess) return;
    socket.to(`conv:${conversationId}`).emit('typing:stop', { conversationId, userId });
  });
});

const authRoutes = require('./routes/auth');
const videoRoutes = require('./routes/videos');
const analysisRoutes = require('./routes/analysis');
const scoutRoutes = require('./routes/scout');
const playerRoutes = require('./routes/players');
const scoutProfileRoutes = require('./routes/scouts');
const liquipediaRoutes = require('./routes/liquipedia');
const tournamentRoutes = require('./routes/tournaments');

const messageRoutes = require('./routes/messages');
const conversationRoutes = require('./routes/conversations');
const activityRoutes = require('./routes/activities');
const verificationRoutes = require('./routes/verification');
const importRoutes = require('./routes/import');
const teamRoutes = require('./routes/teams');
const recruitmentRoutes = require('./routes/recruitment');
const notificationsRoutes = require('./routes/notifications');

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/auth', authRoutes);
app.use('/videos', videoRoutes);
app.use('/analysis', analysisRoutes);
app.use('/scout', scoutRoutes);
app.use('/', importRoutes);
app.use('/players', playerRoutes);
app.use('/scouts', scoutProfileRoutes);
app.use('/liquipedia', liquipediaRoutes);
app.use('/tournaments', tournamentRoutes);

app.use('/messages', messageRoutes);
app.use('/conversations', conversationRoutes);
app.use('/activities', activityRoutes);
app.use('/verification', verificationRoutes);
app.use('/teams', teamRoutes);
app.use('/recruitment', recruitmentRoutes);
app.use('/notifications', notificationsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

server.listen(PORT, () => console.log(`PakEsports API running on http://localhost:${PORT}`));

