-- PakEsports Scout PRO — Refactored Schema v2 (Profile Redesign + Verification System)
-- psql -U postgres -c "CREATE DATABASE pakesports;"
-- psql -U postgres -d pakesports -f schema.sql
-- node scripts/seed.js

DROP TABLE IF EXISTS team_offers CASCADE;
DROP TABLE IF EXISTS recruitment_permissions CASCADE;
DROP TABLE IF EXISTS recruitment_requests CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS verification_requests CASCADE;
DROP TABLE IF EXISTS verification_codes CASCADE;
DROP TABLE IF EXISTS internal_notes CASCADE;
DROP TABLE IF EXISTS scout_history CASCADE;
DROP TABLE IF EXISTS player_history CASCADE;
DROP TABLE IF EXISTS player_stats CASCADE;
DROP TABLE IF EXISTS video_likes CASCADE;
DROP TABLE IF EXISTS video_saves CASCADE;
DROP TABLE IF EXISTS follows CASCADE;
DROP TABLE IF EXISTS ai_analysis CASCADE;
DROP TABLE IF EXISTS shortlists CASCADE;
DROP TABLE IF EXISTS videos CASCADE;
DROP TABLE IF EXISTS player_profiles CASCADE;
DROP TABLE IF EXISTS scout_profiles CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS tournaments CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'scout')),
  avatar TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  city TEXT DEFAULT 'Karachi',
  country TEXT DEFAULT 'Pakistan',
  nationality TEXT DEFAULT '',
  current_team TEXT DEFAULT '',
  main_game TEXT DEFAULT 'Valorant',
  years_experience INT DEFAULT 0,
  real_name TEXT DEFAULT '',
  liquipedia_id TEXT DEFAULT '',
  liquipedia_url TEXT DEFAULT '',
  liquipedia_verified BOOLEAN DEFAULT FALSE,
  liquipedia_data JSONB DEFAULT '{}'::jsonb,
  profile_source TEXT DEFAULT 'manual' CHECK (profile_source IN ('manual', 'liquipedia', 'both')),
  profile_status TEXT DEFAULT 'community' CHECK (profile_status IN ('community', 'imported', 'verified_player', 'verified_organization')),
  verification_method TEXT DEFAULT '' CHECK (verification_method IN ('', 'social', 'organization', 'admin')),
  verification_code TEXT DEFAULT '',
  verification_code_created_at TIMESTAMP,
  verified_by INT REFERENCES users(id),
  verified_at TIMESTAMP,
  scout_score INT DEFAULT 0,
  esports_value_score INT DEFAULT 0,
  social_links JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE player_profiles (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  game TEXT DEFAULT 'Valorant',
  rank TEXT DEFAULT 'Unranked',
  kd_ratio DECIMAL(4,2) DEFAULT 1.0,
  preferred_role TEXT DEFAULT 'Flex',
  esv_score INT DEFAULT 0,
  achievements TEXT DEFAULT '',
  teams_played TEXT DEFAULT '',
  cv_url TEXT DEFAULT '',
  acs DECIMAL(6,2) DEFAULT 0,
  adr DECIMAL(6,2) DEFAULT 0,
  headshot_percent DECIMAL(4,2) DEFAULT 0,
  clutch_percent DECIMAL(4,2) DEFAULT 0,
  opening_duel_percent DECIMAL(4,2) DEFAULT 0,
  tournament_win_percent DECIMAL(4,2) DEFAULT 0
);

CREATE TABLE player_stats (
  player_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kd_ratio DECIMAL(4,2) DEFAULT 1.0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  matches_played INT DEFAULT 0,
  tournaments_played INT DEFAULT 0,
  official_tournaments INT DEFAULT 0,
  mvps INT DEFAULT 0,
  highest_rank TEXT DEFAULT '',
  acs DECIMAL(6,2) DEFAULT 0,
  adr DECIMAL(6,2) DEFAULT 0,
  headshot_percent DECIMAL(4,2) DEFAULT 0,
  clutch_percent DECIMAL(4,2) DEFAULT 0,
  opening_duel_percent DECIMAL(4,2) DEFAULT 0,
  tournament_win_percent DECIMAL(4,2) DEFAULT 0
);

CREATE TABLE player_games (
  player_id INT REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  PRIMARY KEY (player_id, game)
);

CREATE TABLE player_history (
  id SERIAL PRIMARY KEY,
  player_id INT REFERENCES users(id) ON DELETE CASCADE,
  entry_type TEXT CHECK (entry_type IN ('team', 'tournament', 'placement', 'achievement')),
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  entry_year INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scout_profiles (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  experience TEXT DEFAULT '',
  teams_coached TEXT DEFAULT '',
  achievements TEXT DEFAULT '',
  cv_url TEXT DEFAULT '',
  country TEXT DEFAULT 'Pakistan',
  organization TEXT DEFAULT '',
  coaching_specialty TEXT DEFAULT '',
  best_achievement TEXT DEFAULT '',
  years_experience INT DEFAULT 0,
  liquipedia_id TEXT DEFAULT '',
  liquipedia_url TEXT DEFAULT '',
  liquipedia_verified BOOLEAN DEFAULT FALSE,
  profile_source TEXT DEFAULT 'manual'
);

CREATE TABLE scout_history (
  id SERIAL PRIMARY KEY,
  scout_id INT REFERENCES users(id) ON DELETE CASCADE,
  entry_type TEXT CHECK (entry_type IN ('team', 'tournament', 'achievement', 'discovery')),
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  entry_year INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE internal_notes (
  id SERIAL PRIMARY KEY,
  scout_id INT REFERENCES users(id) ON DELETE CASCADE,
  player_id INT REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scout_id, player_id)
);

CREATE TABLE videos (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  game_title TEXT NOT NULL,
  rank TEXT DEFAULT '',
  esv_score INT DEFAULT 0,
  ai_feedback TEXT DEFAULT '',
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  views INT DEFAULT 0,
  likes INT DEFAULT 0
);

CREATE TABLE video_likes (
  video_id INT REFERENCES videos(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, user_id)
);

CREATE TABLE video_saves (
  video_id INT REFERENCES videos(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, user_id)
);

CREATE TABLE follows (
  follower_id INT REFERENCES users(id) ON DELETE CASCADE,
  following_id INT REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE ai_analysis (
  video_id INT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  aim_score INT DEFAULT 0,
  positioning_score INT DEFAULT 0,
  teamwork_score INT DEFAULT 0,
  consistency_score INT DEFAULT 0,
  decision_score INT DEFAULT 0,
  summary TEXT DEFAULT '',
  recommendations JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE game_skill_analysis (
  video_id INT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  skill_score INT DEFAULT 0,
  source TEXT DEFAULT 'cv' CHECK (source IN ('cv', 'yolo', 'api')),
  confidence DECIMAL(3,2) DEFAULT 0,
  metrics JSONB DEFAULT '{}'::jsonb,
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scout_activity (
  id SERIAL PRIMARY KEY,
  scout_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('profile_view', 'shortlist_add', 'shortlist_remove')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scout_activity_player ON scout_activity(player_id, created_at DESC);

CREATE TABLE shortlists (
  scout_id INT REFERENCES users(id) ON DELETE CASCADE,
  player_id INT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (scout_id, player_id)
);

CREATE TABLE tournaments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  game TEXT NOT NULL,
  prize TEXT NOT NULL,
  city TEXT NOT NULL,
  date TEXT NOT NULL,
  created_by INT REFERENCES users(id)
);

CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  participant1_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant2_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(participant1_id, participant2_id)
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  attachment_url TEXT DEFAULT '',
  waveform TEXT DEFAULT '',
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conv ON messages(conversation_id);

-- Verification System Tables
-- Organizations
CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  website TEXT DEFAULT '',
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team / Recruitment System
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  game TEXT DEFAULT 'Valorant',
  created_by INT REFERENCES users(id),
  organization_id INT REFERENCES organizations(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE team_members (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'player' CHECK (role IN ('player', 'substitute', 'captain')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'former')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  UNIQUE(team_id, player_id, status)
);

CREATE TABLE recruitment_requests (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  scout_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recruitment Permissions: scout must obtain permission before sending offers
CREATE TABLE recruitment_permissions (
  id SERIAL PRIMARY KEY,
  scout_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'revoked')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scout_id, player_id)
);

-- Team Activity: tracks join/leave/recruitment events for dashboards
CREATE TABLE team_activity (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  actor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INT REFERENCES users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('member_joined', 'member_left', 'member_removed', 'role_changed', 'recruitment_accepted')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_team_activity_team ON team_activity(team_id, created_at DESC);
CREATE INDEX idx_team_activity_actor ON team_activity(actor_id, created_at DESC);

-- Team Offers: detailed offer from scout to player (requires approved permission)
CREATE TABLE team_offers (
  id SERIAL PRIMARY KEY,
  scout_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  role TEXT NOT NULL,
  tournament_focus TEXT DEFAULT '',
  contract_duration TEXT DEFAULT '',
  prize_share DECIMAL(5,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE verification_codes (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'twitch', 'youtube', 'discord')),
  platform_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP
);

CREATE TABLE verification_requests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('social', 'organization', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by INT REFERENCES users(id),
  evidence_urls TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP
);

INSERT INTO player_games (player_id, game) VALUES
(2, 'Valorant'),
(4, 'Valorant'),
(4, 'CS2');
