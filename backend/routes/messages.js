const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM messages ORDER BY id ASC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    const result = await db.query(
      'INSERT INTO messages (sender_id, message) VALUES ($1, $2) RETURNING *',
      [req.user.id, message]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
