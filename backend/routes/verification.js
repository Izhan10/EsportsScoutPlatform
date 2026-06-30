const express = require('express');
const db = require('../db');
const { authenticate, requireRole } = require('../middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const VERIFICATION_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'verification');
if (!fs.existsSync(VERIFICATION_UPLOAD_DIR)) {
  fs.mkdirSync(VERIFICATION_UPLOAD_DIR, { recursive: true });
}

const ALLOWED_PROVIDERS = ['instagram', 'youtube', 'twitter', 'twitch', 'discord'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VERIFICATION_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webp';
    cb(null, `selfie-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files allowed'));
  }
});

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'VERIFY-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getPlatformInstructions(platform, code) {
  const names = {
    instagram: 'Instagram',
    youtube: 'YouTube',
    twitter: 'X (Twitter)',
    twitch: 'Twitch',
    discord: 'Discord'
  };
  const displayName = names[platform] || platform;
  return `Copy this code: ${code}\nPaste it into your ${displayName} bio/about section and click "Confirm" below.\nThe code must be visible on your public profile.`;
}

async function checkAndUpgrade(userId) {
  const socialResult = await db.query(
    `SELECT * FROM social_verifications WHERE user_id = $1`,
    [userId]
  );
  const verifiedCount = socialResult.rows.filter(s => s.verified === true || s.verified === 'true').length;

  const selfieResult = await db.query(
    `SELECT * FROM selfie_verifications WHERE user_id = $1`,
    [userId]
  );
  const selfieDone = selfieResult.rows.length > 0;

  if (verifiedCount >= 2 && selfieDone) {
    await db.query(
      `UPDATE users SET profile_status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [userId]
    );
    return 'verified';
  }
  return 'claimed';
}

/* ─── EXISTING: Generate verification code ─── */
router.post('/generate-code', authenticate, async (req, res) => {
  try {
    const { platform, platform_url } = req.body;
    if (!platform || !['twitter', 'twitch', 'youtube', 'discord'].includes(platform)) {
      return res.status(400).json({ error: 'Valid platform required (twitter, twitch, youtube, discord)' });
    }
    const code = generateCode();
    const result = await db.query(
      `INSERT INTO verification_codes (user_id, code, platform, platform_url) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, code, platform, platform_url || '']
    );
    res.json({ code: result.rows[0].code, platform, instructions: getPlatformInstructions(platform, code) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

/* ─── EXISTING: Verify code ─── */
router.post('/verify-code', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Verification code required' });

    const result = await db.query(
      `SELECT * FROM verification_codes WHERE user_id = $1 AND code = $2 AND status = 'pending'`,
      [req.user.id, code]
    );
    if (!result.rows.length) {
      return res.status(400).json({ error: 'Invalid or expired code. Generate a new one.' });
    }
    const vc = result.rows[0];

    await db.query(`UPDATE verification_codes SET status = 'verified' WHERE id = $1`, [vc.id]);

    await db.query(
      `UPDATE users SET profile_status = 'verified_player', verification_method = 'social', verified_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [req.user.id]
    );

    res.json({ verified: true, message: 'Profile verified successfully! Your verified badge is now active.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/* ─── EXISTING: My codes ─── */
router.get('/my-codes', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM verification_codes WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch codes' });
  }
});



/* ════════════════════════════════════════
   NEW: CLAIM PROFILE & VERIFICATION SYSTEM
   ════════════════════════════════════════ */

/* ─── 1. Claim an imported profile ─── */
router.post('/claim/:profileId', authenticate, requireRole('player'), async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId, 10);
    if (!profileId) return res.status(400).json({ error: 'Invalid profile ID' });

    const profileResult = await db.query(`SELECT * FROM users WHERE id = $1`, [profileId]);
    if (!profileResult.rows.length) return res.status(404).json({ error: 'Profile not found' });

    const profile = profileResult.rows[0];
    if (profile.role !== 'player') return res.status(400).json({ error: 'Only player profiles can be claimed' });
    if (profile.claimed_by_user_id) return res.status(400).json({ error: 'Profile already claimed' });
    if (profile.profile_status === 'verified') return res.status(400).json({ error: 'Profile is already verified' });

    await db.query(
      `UPDATE users SET claimed_by_user_id = $1, profile_status = 'claimed' WHERE id = $2`,
      [req.user.id, profileId]
    );

    res.json({
      success: true,
      profile_id: profileId,
      profile_status: 'claimed',
      message: `You have claimed @${profile.username}. Complete verification to become a Verified Player.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to claim profile' });
  }
});

/* ─── 2. Get verification status/dashboard ─── */
router.get('/claim/:profileId/status', authenticate, async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId, 10);
    const profileResult = await db.query(`SELECT * FROM users WHERE id = $1`, [profileId]);
    if (!profileResult.rows.length) return res.status(404).json({ error: 'Profile not found' });

    const profile = profileResult.rows[0];

    const socialResult = await db.query(
      `SELECT * FROM social_verifications WHERE user_id = $1`,
      [profileId]
    );

    const selfieResult = await db.query(
      `SELECT * FROM selfie_verifications WHERE user_id = $1`,
      [profileId]
    );

    const socialAccounts = ALLOWED_PROVIDERS.map(provider => {
      const sv = socialResult.rows.find(s => s.provider === provider);
      return {
        provider,
        connected: !!sv,
        verified: sv ? (sv.verified === true || sv.verified === 'true') : false,
        username: sv ? sv.username : null,
        verification_code: sv && !sv.verified ? sv.verification_code : null
      };
    });

    const verifiedSocialCount = socialAccounts.filter(s => s.verified).length;
    const selfieDone = selfieResult.rows.length > 0;

    const progress = {
      social: { completed: verifiedSocialCount, required: 2 },
      selfie: { completed: selfieDone ? 1 : 0, required: 1 }
    };
    const totalCompleted = verifiedSocialCount + (selfieDone ? 1 : 0);
    const totalRequired = 3;

    res.json({
      profile_id: profileId,
      profile_status: profile.profile_status,
      claimed_by_user_id: profile.claimed_by_user_id,
      verified_at: profile.verified_at,
      social_accounts: socialAccounts,
      selfie_verified: selfieDone,
      selfie_verified_at: selfieResult.rows[0] ? selfieResult.rows[0].verified_at : null,
      progress,
      total_completed: totalCompleted,
      total_required: totalRequired,
      is_verified: totalCompleted >= totalRequired
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

/* ─── 3. Initiate social verification ─── */
router.post('/claim/:profileId/social/verify', authenticate, requireRole('player'), async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId, 10);
    const { provider, profile_url } = req.body;

    if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: `Valid provider required: ${ALLOWED_PROVIDERS.join(', ')}` });
    }

    const profileResult = await db.query(`SELECT * FROM users WHERE id = $1`, [profileId]);
    if (!profileResult.rows.length) return res.status(404).json({ error: 'Profile not found' });
    if (profileResult.rows[0].claimed_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this profile' });
    }

    const existing = await db.query(
      `SELECT * FROM social_verifications WHERE user_id = $1 AND provider = $2`,
      [profileId, provider]
    );
    if (existing.rows.length && existing.rows[0].verified === true) {
      return res.json({ verified: true, provider, message: `${provider} already verified` });
    }

    const code = generateCode();
    const codeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    if (existing.rows.length) {
      await db.query(`UPDATE social_verifications SET verification_code = $1, code_expires_at = $2, verified = false WHERE id = $3`,
        [code, codeExpires, existing.rows[0].id]);
    } else {
      await db.query(
        `INSERT INTO social_verifications (user_id, provider, provider_user_id, username, verification_code, code_expires_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [profileId, provider, profile_url || '', '', code, codeExpires]
      );
    }

    res.json({
      provider,
      code,
      instructions: getPlatformInstructions(provider, code)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to initiate verification' });
  }
});

/* ─── 4. Confirm social verification ─── */
router.post('/claim/:profileId/social/confirm', authenticate, requireRole('player'), async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId, 10);
    const { provider, code } = req.body;

    if (!provider || !code) return res.status(400).json({ error: 'Provider and code required' });

    const svResult = await db.query(
      `SELECT * FROM social_verifications WHERE user_id = $1 AND verification_code = $2`,
      [profileId, code]
    );
    if (!svResult.rows.length) {
      return res.status(400).json({ error: 'Invalid code. Generate a new verification code.' });
    }

    const sv = svResult.rows[0];
    if (sv.provider !== provider) {
      return res.status(400).json({ error: 'Code does not match the provider' });
    }
    if (sv.verified === true || sv.verified === 'true') {
      return res.json({ verified: true, provider, message: 'Already verified' });
    }

    await db.query(`UPDATE social_verifications SET verified = true WHERE id = $1`, [sv.id]);

    const newStatus = await checkAndUpgrade(profileId);

    res.json({
      verified: true,
      provider,
      profile_status: newStatus,
      message: `${provider} verified successfully!`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to confirm verification' });
  }
});

/* ─── 5. Upload selfie ─── */
router.post('/claim/:profileId/selfie', authenticate, requireRole('player'), upload.single('selfie'), async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId, 10);
    if (!req.file) return res.status(400).json({ error: 'Selfie image required' });

    const profileResult = await db.query(`SELECT * FROM users WHERE id = $1`, [profileId]);
    if (!profileResult.rows.length) return res.status(404).json({ error: 'Profile not found' });
    if (profileResult.rows[0].claimed_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this profile' });
    }

    const imageUrl = `/uploads/verification/${req.file.filename}`;

    await db.query(
      `INSERT INTO selfie_verifications (user_id, image_url) VALUES ($1, $2)`,
      [profileId, imageUrl]
    );

    const newStatus = await checkAndUpgrade(profileId);

    res.json({
      verified: true,
      image_url: imageUrl,
      profile_status: newStatus,
      message: 'Selfie verified successfully!'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload selfie' });
  }
});

module.exports = router;
