const PlayerProfileSchema = {
  hero: {
    avatar: { type: 'string', source: 'users.avatar', label: 'Avatar URL' },
    username: { type: 'string', source: 'users.username', label: 'Username' },
    real_name: { type: 'string', source: 'users.real_name', label: 'Real Name' },
    country: { type: 'string', source: 'users.country', label: 'Country' },
    nationality: { type: 'string', source: 'users.nationality', label: 'Nationality' },
    current_team: { type: 'string', source: 'users.current_team', label: 'Current Team' },
    main_game: { type: 'string', source: 'users.main_game', label: 'Main Game' },
    preferred_role: { type: 'string', source: 'player_profiles.preferred_role', label: 'Role' },
    profile_status: { type: 'string', source: 'users.profile_status', label: 'Status' },
    profile_source: { type: 'string', source: 'users.profile_source', label: 'Source' },
    scout_score: { type: 'number', source: 'users.scout_score', label: 'Scout Score' },
    esv_score: { type: 'number', source: 'player_profiles.esv_score', label: 'ESV Score' },
    esports_value_score: { type: 'number', source: 'users.esports_value_score', label: 'ESV Score' },
    liquipedia_url: { type: 'string', source: 'users.liquipedia_url', label: 'Liquipedia URL' },
    city: { type: 'string', source: 'users.city', label: 'City' },
    cover_image: { type: 'string', source: 'users.cover_image', label: 'Cover Image' },
  },
  overview: {
    bio: { type: 'string', source: 'users.bio', label: 'Biography' },
    city: { type: 'string', source: 'users.city', label: 'City' },
    years_experience: { type: 'number', source: 'users.years_experience', label: 'Years Active' },
    social_links: { type: 'object', source: 'users.social_links', label: 'Social Links' },
  },
  statistics: {
    kd_ratio: { type: 'number', source: 'player_stats.kd_ratio', label: 'K/D Ratio' },
    win_rate: { type: 'number', source: 'player_stats.win_rate', label: 'Win Rate' },
    matches_played: { type: 'number', source: 'player_stats.matches_played', label: 'Matches Played' },
    highest_rank: { type: 'string', source: 'player_stats.highest_rank', label: 'Highest Rank' },
    tournaments_played: { type: 'number', source: 'player_stats.tournaments_played', label: 'Tournaments Played' },
    mvps: { type: 'number', source: 'player_stats.mvps', label: 'MVPs' },
    acs: { type: 'number', source: 'player_stats.acs', label: 'ACS' },
    adr: { type: 'number', source: 'player_stats.adr', label: 'ADR' },
    headshot_percent: { type: 'number', source: 'player_stats.headshot_percent', label: 'Headshot %' },
    clutch_percent: { type: 'number', source: 'player_stats.clutch_percent', label: 'Clutch %' },
    opening_duel_percent: { type: 'number', source: 'player_stats.opening_duel_percent', label: 'Opening Duel %' },
    tournament_win_percent: { type: 'number', source: 'player_stats.tournament_win_percent', label: 'Tournament Win %' },
  },
  teams: {
    entries: { type: 'array', source: 'liquipedia_data.teams', label: 'Team History' },
  },
  tournaments: {
    entries: { type: 'array', source: 'liquipedia_data.tournaments', label: 'Tournament History' },
  },
  achievements: {
    entries: { type: 'array', source: 'liquipedia_data.achievements', label: 'Achievements' },
    text: { type: 'string', source: 'player_profiles.achievements', label: 'Achievements Text' },
  },
  media: {
    videos: { type: 'array', source: 'videos', label: 'Media' },
  },
  socials: {
    links: { type: 'object', source: 'users.social_links', label: 'Social Links' },
    liquipedia_url: { type: 'string', source: 'users.liquipedia_url', label: 'Liquipedia URL' },
  },

  player_history: {
    entries: { type: 'array', source: 'player_history', label: 'Player History Timeline' },
  },
};

function getSection(sectionName) {
  return PlayerProfileSchema[sectionName] || null;
}

function getField(sectionName, fieldName) {
  const section = PlayerProfileSchema[sectionName];
  return section ? section[fieldName] || null : null;
}

function collectAllFields() {
  const fields = [];
  for (const [section, schemaFields] of Object.entries(PlayerProfileSchema)) {
    for (const [fieldName, fieldDef] of Object.entries(schemaFields)) {
      fields.push({
        section,
        field: fieldName,
        type: fieldDef.type,
        source: fieldDef.source,
        label: fieldDef.label,
      });
    }
  }
  return fields;
}

function generateEmptyProfile(userId) {
  return {
    userId,
    hero: {},
    overview: {},
    statistics: {},
    teams: { entries: [] },
    tournaments: { entries: [] },
    achievements: { entries: [], text: '' },
    media: { videos: [] },
    socials: { links: {}, liquipedia_url: '' },
    player_history: { entries: [] },
  };
}

module.exports = {
  PlayerProfileSchema,
  getSection,
  getField,
  collectAllFields,
  generateEmptyProfile,
};
