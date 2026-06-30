/**
 * Run after schema.sql: node scripts/seed.js
 * Demo passwords: demo123 (players/scout), admin123 (admin)
 */
const bcrypt = require('bcrypt');
const db = require('../db');

async function seed() {
  const demoHash = await bcrypt.hash('demo123', 10);

  const demos = [
    ['pro_player', 'player', 'Lahore', 'Valorant IGL from Lahore', 'Immortal 3', 91],
    ['scout_ali', 'scout', 'Karachi', 'Professional esports scout', null, 0],
    ['krimson_pk', 'player', 'Islamabad', 'Radiant duelist main', 'Radiant', 94],
  ];

  const userIds = {};
  for (const [username, role, city, bio, rank, esv] of demos) {
    const r = await db.query(
      `INSERT INTO users (username, email, password, role, avatar, bio, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password
       RETURNING id`,
      [
        username,
        `${username}@pakesports.pk`,
        demoHash,
        role,
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        bio,
        city,
      ]
    );
    userIds[username] = r.rows[0].id;
    if (role === 'player') {
      await db.query(
        `INSERT INTO player_profiles (user_id, game, rank, esv_score)
         VALUES ($1, 'Valorant', $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET rank=$2, esv_score=$3`,
        [r.rows[0].id, rank || 'Unranked', esv]
      );
    }
  }

  const { rows: vc } = await db.query('SELECT COUNT(*)::int AS c FROM videos');
  if (vc[0].c === 0) {
    console.log('  No seed videos — upload gameplay clips through the uploader to populate the feed.');
  }

await db.query(
    `INSERT INTO messages (conversation_id, sender_id, message, message_type) VALUES
     (1, 3, 'Welcome to PakEsports Scout Network!', 'text'),
     (1, 2, 'Just uploaded my latest clutch clip — check the feed!', 'text')`
   ).catch(() => {});

  console.log('Seed complete.');
  console.log('  pro_player / demo123');
  console.log('  scout_ali / demo123');
  console.log('  krimson_pk / demo123');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
