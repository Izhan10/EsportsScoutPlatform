const LIQUIPEDIA_API_KEY = process.env.LIQUIPEDIA_API_KEY || '';
const LIQUIPEDIA_BASE_URL = 'https://api.liquipedia.net/api/v3';
const path = require('path');
const fs = require('fs');

// ── Wiki success ranking ──
const wikiRanking = new Map();
function recordWikiHit(wiki) {
  wikiRanking.set(wiki, (wikiRanking.get(wiki) || 0) + 1);
}
function getRankedWikis() {
  return [...ALL_WIKIS].sort((a, b) => (wikiRanking.get(b) || 0) - (wikiRanking.get(a) || 0));
}

// ── In-flight request deduplication ──
const inflightRequests = new Map();
function dedup(key, fetcher) {
  if (inflightRequests.has(key)) return inflightRequests.get(key);
  const promise = fetcher().finally(() => inflightRequests.delete(key));
  inflightRequests.set(key, promise);
  return promise;
}

// ── Per-endpoint circuit breaker ──
const endpointFailures = new Map();
const DEFAULT_FAIL_TTL = 5 * 60 * 1000;

function isEndpointFailed(endpoint) {
  const entry = endpointFailures.get(endpoint);
  if (!entry) return false;
  const ttl = entry.retryAfter || DEFAULT_FAIL_TTL;
  if (Date.now() - entry.failedAt > ttl) {
    endpointFailures.delete(endpoint);
    return false;
  }
  return true;
}

function markEndpointFailed(endpoint, retryAfterSeconds) {
  endpointFailures.set(endpoint, {
    failedAt: Date.now(),
    retryAfter: (retryAfterSeconds || 0) * 1000 || DEFAULT_FAIL_TTL,
  });
}

// ── Request queue (FIFO, 2 concurrent, 600ms interval) ──
const requestQueue = [];
let activeCount = 0;
let lastRequestTime = 0;
const MAX_CONCURRENT = 1;
const MIN_INTERVAL_MS = 1000;

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ fn, resolve, reject });
    processQueue();
  });
}

function processQueue() {
  if (activeCount >= MAX_CONCURRENT || requestQueue.length === 0) return;
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    setTimeout(processQueue, MIN_INTERVAL_MS - elapsed);
    return;
  }
  const { fn, resolve, reject } = requestQueue.shift();
  activeCount++;
  lastRequestTime = Date.now();
  fn().then(resolve, reject).finally(() => {
    activeCount--;
    processQueue();
  });
}

// ── In-memory cache ──
const cache = new Map();
const CACHE_TTL = {
  SEARCH: 5 * 60 * 1000,
  SEARCH_AUTO: 10 * 60 * 1000,
  TOURNAMENTS: 5 * 60 * 1000,
  PROFILE: 30 * 60 * 1000,
};

function getCached(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < hit.ttl) return hit.data;
  cache.delete(key);
  return null;
}

function setCache(key, data, ttl) {
  if (data) cache.set(key, { data, ts: Date.now(), ttl });
}

const FAILED_LOG_PATH = path.join(__dirname, '..', 'failed_imports.json');

function logFailedImport(playerName, wiki, errorMsg) {
  try {
    const log = fs.existsSync(FAILED_LOG_PATH)
      ? JSON.parse(fs.readFileSync(FAILED_LOG_PATH, 'utf8'))
      : [];
    log.push({ player: playerName, wiki, error: errorMsg, time: new Date().toISOString() });
    fs.writeFileSync(FAILED_LOG_PATH, JSON.stringify(log, null, 2));
    console.log('[FAILED IMPORT LOGGED]', playerName, wiki, errorMsg.slice(0, 100));
  } catch { /* silent */ }
}

async function retryWithBackoff(fn, { maxRetries = 2, baseDelay = 500 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      if (
        err.message?.includes('429') ||
        err.message?.includes('503') ||
        err.message?.includes('502') ||
        err.message?.includes('rate') ||
        err.message?.includes('timeout')
      ) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
        console.log(`[RETRY] attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms: ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
      } else if (err.message?.includes('403') || err.message?.includes('401')) {
        console.log(`[LIQUIPEDIA] Auth error, not retrying: ${err.message}`);
        throw err;
      } else {
        throw err;
      }
    }
  }
}

const WIKI_MAP = {
  'Valorant': 'valorant',
  'CS2': 'counterstrike',
  'PUBG Mobile': 'pubgmobile',
  'PUBG': 'pubgmobile',
  'Tekken 8': 'fighters',
  'Tekken': 'fighters',
  'Dota 2': 'dota2',
};

const REVERSE_WIKI_MAP = Object.fromEntries(
  Object.entries(WIKI_MAP).map(([k, v]) => [v, k])
);

const ALL_WIKIS = [...new Set(Object.values(WIKI_MAP))];

function authHeaders() {
  return { Authorization: `Apikey ${LIQUIPEDIA_API_KEY}` };
}

function gameToWiki(game) {
  return WIKI_MAP[game] || 'valorant';
}

async function fetchPlayerImage(pagename, wiki) {
  if (!pagename || !wiki) return '';
  const baseUrl = `https://liquipedia.net/${wiki}/api.php`;
  const ua = { headers: { 'User-Agent': 'PakEsportsScout/1.0' } };

  async function resizeWithFallback(src) {
    const resized = src.replace(/\/\d+px-/, '/300px-');
  if (resized !== src) {
    try {
      const check = await fetch(resized, { method: 'HEAD', ...ua });
      if (check.ok) return resized;
    } catch { /* fall through */ }
  }
  return src;
}

// Strategy 1: parse api with prop=text, regex extraction from infobox-image-wrapper
  try {
    const url = `${baseUrl}?action=parse&page=${encodeURIComponent(pagename)}&prop=text&section=0&format=json`;
    const res = await fetch(url, ua);
    if (res.ok) {
      const data = await res.json();
      const html = data?.parse?.text?.['*'] || '';
      const patterns = [
        /<div class="infobox-image-wrapper">[\s\S]*?<img[^>]+src="([^"]+)"/,
        /<div class="infobox-image[ "]lightmode["]?[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/,
        /<img[^>]+class="[^"]*infobox[^"]*"[^>]+src="([^"]+)"/,
        /<img[^>]+src="([^"]+commons\/images\/thumb\/[^"]+)"[^>]*>/,
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          let src = match[1];
          if (src.startsWith('//')) src = 'https:' + src;
          else if (src.startsWith('/')) src = `https://liquipedia.net${src}`;
          return resizeWithFallback(src);
        }
      }
    }
  } catch { /* fall through */ }

  // Strategy 2: prop=images (with continuation), broader filter, then imageinfo
  try {
    const allImages = [];
    let imContinue = null;
    do {
      let imagesUrl = `${baseUrl}?action=query&prop=images&titles=${encodeURIComponent(pagename)}&format=json`;
      if (imContinue) imagesUrl += `&imcontinue=${encodeURIComponent(imContinue)}`;
      const imgRes = await fetch(imagesUrl, ua);
      if (!imgRes.ok) break;
      const imgData = await imgRes.json();
      const pages = imgData?.query?.pages || {};
      for (const p of Object.values(pages)) {
        if (p.images) allImages.push(...p.images);
      }
      const cont = imgData?.continue || {};
      imContinue = cont.imcontinue || null;
    } while (imContinue);

    // Broader filter: exclude known non-player images
    const excludePatterns = ['icon', 'logo', 'flag', 'allmode', 'filler', 'button', 'badge', 'trophy'];
    const playerImage = allImages.find(i => {
      const t = (i.title || '').toLowerCase();
      if (excludePatterns.some(p => t.includes(p))) return false;
      if (!t.match(/\.(jpe?g|png|webp|gif)$/)) return false;
      return true;
    });
    if (!playerImage) {
      const nameMatch = allImages.find(i => {
        const t = (i.title || '').toLowerCase();
        return t.includes(pagename.toLowerCase()) && t.match(/\.(jpe?g|png|webp)$/);
      });
      if (nameMatch) {
        const infoUrl = `${baseUrl}?action=query&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(nameMatch.title)}&format=json`;
        const infoRes = await fetch(infoUrl, ua);
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          const infoPages = infoData?.query?.pages || {};
          const info = Object.values(infoPages).find(p => p.imageinfo);
          if (info?.imageinfo?.[0]?.url) {
            return resizeWithFallback(info.imageinfo[0].url);
          }
        }
      }
    }
    if (playerImage) {
      const infoUrl = `${baseUrl}?action=query&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(playerImage.title)}&format=json`;
      const infoRes = await fetch(infoUrl, ua);
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        const infoPages = infoData?.query?.pages || {};
        const info = Object.values(infoPages).find(p => p.imageinfo);
        if (info?.imageinfo?.[0]?.url) {
          return resizeWithFallback(info.imageinfo[0].url);
        }
      }
    }
  } catch { /* silent */ }

  return '';
}

async function v3Fetch(endpoint, params = {}) {
  if (isEndpointFailed(endpoint)) return [];
  return enqueue(() => retryWithBackoff(async () => {
    const qs = new URLSearchParams(params).toString();
    const url = `${LIQUIPEDIA_BASE_URL}${endpoint}${qs ? '?' + qs : ''}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { headers: authHeaders(), signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
        markEndpointFailed(endpoint, retryAfter);
        throw new Error(`Liquipedia API ${res.status}: ${res.statusText}`);
      }
      const body = await res.json();
      return body.result || [];
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }));
}

const PLAYER_QUERY = 'pagename,name,id,nationality,teampagename,type,status,links,extradata';

async function v3FetchWiki(endpoint, wiki, params = {}) {
  const results = await v3Fetch(endpoint, { wiki, ...params });
  return results.map(r => ({ ...r, wiki }));
}

function generateNamePermutations(name) {
  if (!name) return [];
  const lower = name.toLowerCase();
  const upper = name.toUpperCase();
  const title = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  const titleU = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('_');
  const exact = name;
  const exactU = name.replace(/ /g, '_');
  return [...new Set([lower, upper, title, titleU, exact, exactU])];
}

async function searchMediaWiki(term) {
  const seen = new Set();
  const results = [];

  for (const wiki of ALL_WIKIS) {
    try {
      const url = `https://liquipedia.net/${wiki}/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=8&format=json`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'PakEsportsScout/1.0' } });
      if (!resp.ok) continue;
      const data = await resp.json();
      const pages = data?.query?.search || [];
      for (const p of pages) {
        const key = `${wiki}:${p.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // Skip pages with slashes (subpages like tournaments/teams)
        if (p.title.includes('/')) continue;
        results.push({
          id: p.title,
          pagename: p.title,
          name: p.title,
          wiki,
          image: '',
          country: '',
          game: REVERSE_WIKI_MAP[wiki] || '',
          role: '',
        });
      }
      await new Promise(r => setTimeout(r, 300));
    } catch { /* skip wiki */ }
  }
  return results.slice(0, 10);
}

async function searchPlayer(name, { autocomplete } = {}) {
  const term = (name || '').toLowerCase().trim();
  if (!term || term.length < 2) return [];

  const cacheKey = 'search:player:' + term;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const ttl = autocomplete ? CACHE_TTL.SEARCH_AUTO : CACHE_TTL.SEARCH;

  const fetcher = async () => {
    try {
      const rankedWikis = getRankedWikis();
      const perms = generateNamePermutations(name.trim());
      const exactConditions = perms.length ? perms.map(p => `[[pagename::${p}]]`).join(' OR ') : '';

      for (const wiki of rankedWikis) {
        try {
          const results = await v3FetchWiki('/player', wiki, {
            conditions: exactConditions,
            query: PLAYER_QUERY,
            limit: String(perms.length || 1),
          });
          if (results.length > 0) {
            const mapped = results.slice(0, 10).map(mapV3Player);
            recordWikiHit(wiki);
            setCache(cacheKey, mapped, ttl);
            return mapped;
          }
        } catch { /* try next wiki */ }
      }

      if (autocomplete) {
        const mwResults = await searchMediaWiki(term);
        if (mwResults.length > 0) {
          setCache(cacheKey, mwResults, ttl);
          return mwResults;
        }
        return [];
      }

      for (const wiki of rankedWikis) {
        try {
          const results = await v3FetchWiki('/player', wiki, { query: PLAYER_QUERY, limit: '200' });
          const matches = results.filter((p) =>
            (p.pagename || '').toLowerCase().includes(term) ||
            (p.name || '').toLowerCase().includes(term)
          );
          if (matches.length > 0) {
            const mapped = matches.slice(0, 10).map(mapV3Player);
            recordWikiHit(wiki);
            setCache(cacheKey, mapped, ttl);
            return mapped;
          }
        } catch { /* try next wiki */ }
      }
    } catch (err) {
      console.error('[LIQUIPEDIA] v3 search failed:', err.message);
    }

    try {
      const mwResults = await searchMediaWiki(term);
      if (mwResults.length > 0) {
        setCache(cacheKey, mwResults, ttl);
        return mwResults;
      }
    } catch (err) {
      console.error('[LIQUIPEDIA] MediaWiki search failed:', err.message);
    }

    return [];
  };

  return dedup(cacheKey, fetcher);
}

async function searchScout(name, { autocomplete } = {}) {
  const term = (name || '').toLowerCase().trim();
  if (!term || term.length < 2) return [];

  const cacheKey = 'search:scout:' + term;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const ttl = autocomplete ? CACHE_TTL.SEARCH_AUTO : CACHE_TTL.SEARCH;

  const fetcher = async () => {
    try {
      const rankedWikis = getRankedWikis();
      const perms = generateNamePermutations(name.trim());
      const exactConditions = perms.length ? perms.map(p => `[[pagename::${p}]]`).join(' OR ') : '';

      for (const wiki of rankedWikis) {
        try {
          const results = await v3FetchWiki('/player', wiki, {
            conditions: `[[type::staff]] AND (${exactConditions})`,
            query: PLAYER_QUERY,
            limit: String(perms.length || 1),
          });
          const filtered = results.filter((p) => {
            const role = (p.extradata?.role || '').toLowerCase();
            return role.includes('coach') || role.includes('scout') || role.includes('analyst');
          });
          if (filtered.length > 0) {
            const mapped = filtered.slice(0, 10).map(mapV3Player);
            recordWikiHit(wiki);
            setCache(cacheKey, mapped, ttl);
            return mapped;
          }
        } catch { /* try next wiki */ }
      }

      if (autocomplete) {
        const mwResults = await searchMediaWiki(term);
        if (mwResults.length > 0) {
          setCache(cacheKey, mwResults, ttl);
          return mwResults;
        }
        return [];
      }

      for (const wiki of rankedWikis) {
        try {
          const results = await v3FetchWiki('/player', wiki, { conditions: '[[type::staff]]', query: PLAYER_QUERY, limit: '200' });
          const matches = results.filter((p) => {
            const role = (p.extradata?.role || '').toLowerCase();
            return (role.includes('coach') || role.includes('scout') || role.includes('analyst')) &&
              ((p.pagename || '').toLowerCase().includes(term) || (p.name || '').toLowerCase().includes(term));
          });
          if (matches.length > 0) {
            const mapped = matches.slice(0, 10).map(mapV3Player);
            recordWikiHit(wiki);
            setCache(cacheKey, mapped, ttl);
            return mapped;
          }
        } catch { /* try next wiki */ }
      }
    } catch (err) {
      console.error('[LIQUIPEDIA] v3 scout search failed:', err.message);
    }

    try {
      const mwResults = await searchMediaWiki(term);
      if (mwResults.length > 0) {
        setCache(cacheKey, mwResults, ttl);
        return mwResults;
      }
    } catch (err) {
      console.error('[LIQUIPEDIA] MediaWiki scout search failed:', err.message);
    }

    return [];
  };

  return dedup(cacheKey, fetcher);
}

async function fetchPlayerFromWiki(id, wiki) {
  const conditions = [
    `[[pagename::${id}]]`,
    `[[pagename::${id.replace(/ /g, '_')}]]`,
    `[[id::${id}]]`,
  ].join(' OR ');
  try {
    const results = await v3Fetch('/player', {
      wiki,
      conditions,
      query: PLAYER_QUERY,
      limit: '1',
    });
    if (results.length > 0 && results[0].pagename) {
      return mapV3Player({ ...results[0], wiki });
    }
  } catch { }
  return null;
}

async function fetchPlayerProfile(id, wiki) {
  const cacheKey = 'profile:' + id + ':' + (wiki || 'any');
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let playerData;
  try {
    if (wiki) {
      playerData = await fetchPlayerFromWiki(id, wiki);
    } else {
      for (const w of ALL_WIKIS) {
        playerData = await fetchPlayerFromWiki(id, w);
        if (playerData?.id) break;
      }
    }
  } catch (err) {
    console.error('[LIQUIPEDIA] v3 profile fetch failed:', err.message);
  }

  if (!playerData) playerData = mapV3Player({ wiki: wiki || '' });
  const pagename = playerData.id || playerData.name || id;
  const activeWiki = playerData.wiki || wiki || 'valorant';

  if (pagename) {
    if (!playerData.id) playerData.id = pagename;
    if (!playerData.name) playerData.name = pagename;
    if (!playerData.wiki) playerData.wiki = activeWiki;
    if (!playerData.liquipedia_url) playerData.liquipedia_url = `https://liquipedia.net/${activeWiki}/${encodeURIComponent(pagename)}`;

    const [fetchedTeams, fetchedTournaments, fetchedImage, pageTournaments, pageTeams, pageAwards] = await Promise.all([
      fetchPlayerTeams(pagename, activeWiki).catch(e => (logFailedImport(pagename, activeWiki, e.message), [])),
      fetchPlayerTournaments(pagename, activeWiki).catch(e => (logFailedImport(pagename, activeWiki, e.message), [])),
      fetchPlayerImage(pagename, activeWiki),
      fetchPlayerTournamentsFromPage(pagename, activeWiki).catch(() => []),
      fetchPlayerTeamsFromPage(pagename, activeWiki).catch(() => []),
      fetchPlayerAwards(pagename, activeWiki).catch(() => []),
    ]);
    if (fetchedTeams.length > 0 || pageTeams.length > 0) {
      playerData.teams = mergeTeams(fetchedTeams, pageTeams);
    }
    if (fetchedTournaments.length > 0 || pageTournaments.length > 0) {
      playerData.tournaments = mergeTournaments(fetchedTournaments, pageTournaments);
    }
    if (fetchedImage) playerData.image = fetchedImage;
    if (pageAwards.length > 0) {
      playerData.achievements = [...(playerData.achievements || []), ...pageAwards];
    }
    setCache(cacheKey, playerData, CACHE_TTL.PROFILE);
    return playerData;
  }

  logFailedImport(id || 'unknown', wiki || 'unknown', 'no pagename found');
  throw new Error(`Player "${id}" not found on Liquipedia`);
}

async function fetchScoutProfile(id, wiki) {
  return fetchPlayerProfile(id, wiki);
}

async function searchTournaments({ wiki = 'valorant', limit = 50, status } = {}) {
  const cacheKey = 'tournaments:' + wiki + ':' + (status || 'all');
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const params = {
    wiki,
    query: 'pagename,name,shortname,startdate,enddate,prizepool,locations,liquipediatier,status,type',
    order: 'startdate DESC',
    limit: String(limit),
  };
  let results = await dedup('tournaments_fetch:' + wiki + ':' + (status || 'all'), () => v3Fetch('/tournament', params));
  results = results
    .filter((t) => {
      if (t.status === 'cancelled') return false;
      if (!t.startdate || t.startdate === '0000-01-01') return false;
      return true;
    })
    .slice(0, limit);
  if (results.length > 0) {
    const mapped = results.map((t) => mapV3Tournament(t, wiki));
    setCache(cacheKey, mapped, CACHE_TTL.TOURNAMENTS);
    return mapped;
  }
  return [];
}

function mapV3Player(raw) {
  const wiki = raw.wiki || 'valorant';
  const game = REVERSE_WIKI_MAP[wiki] || 'Valorant';
  const rawImage = raw.image || raw.extradata?.image || '';
  return {
    id: raw.pagename || raw.id || '',
    name: raw.pagename || raw.name || '',
    wiki,
    real_name: raw.real_name || raw.name || raw.pagename || '',
    country: raw.nationality || raw.country || '',
    game: raw.game || game,
    role: raw.role || raw.extradata?.role || '',
    image: rawImage ? (rawImage.startsWith('http') ? rawImage : `https://liquipedia.net/${wiki}/Special:FilePath/${encodeURIComponent(rawImage)}`) : '',
    teams: raw.teams || (raw.teampagename ? [{ name: raw.teampagename, role: raw.extradata?.role || '', start_date: '', end_date: '' }] : []),
    tournaments: raw.tournaments || [],
    liquipedia_url: raw.liquipedia_url || (raw.pagename ? `https://liquipedia.net/${wiki}/${raw.pagename}` : ''),
    statistics: raw.statistics || null,
    achievements: raw.achievements || null,
    social_links: raw.links || raw.social_links || {},
  };
}

function stripHtml(s) {
  if (!s) return '';
  return String(s).replace(/<[^>]+>/g, '').trim();
}

function mapV3Tournament(raw, wiki) {
  const gameName = REVERSE_WIKI_MAP[wiki] || 'Valorant';
  const loc = raw.locations || {};
  return {
    name: raw.name || raw.pagename || '',
    game: gameName,
    prize: raw.prizepool || '',
    city: stripHtml(loc.city1 || loc.city || ''),
    country: stripHtml(loc.country1 || loc.country || ''),
    date: raw.startdate || '',
    endDate: raw.enddate || '',
    tier: raw.liquipediatier || '',
    type: raw.type || '',
    url: raw.pagename ? `https://liquipedia.net/${wiki}/${raw.pagename}` : '',
    placement: raw.placement || '',
  };
}

function generateBio(normalized) {
  const name = normalized.real_name || normalized.name || 'Player';
  const role = normalized.role || 'professional';
  const game = normalized.game || 'esports';
  const country = normalized.country || '';
  const teamNames = (normalized.teams || []).map(t => t.name).filter(Boolean);
  const mainTeam = teamNames[0] || '';
  const tourneyCount = (normalized.tournaments || []).length;
  let bio = `${name} is a ${role} ${game} player`;
  if (country) bio += ` from ${country}`;
  if (mainTeam) bio += `, currently playing for ${mainTeam}`;
  bio += '.';
  if (tourneyCount > 0) bio += ` Competed in ${tourneyCount} tournaments.`;
  return bio;
}

async function fetchPlayerTeams(pagename, wiki) {
  if (!pagename) return [];
  const query = 'link,newteam,role,joindate,leavedate,status';
  const conditions = [
    `[[link::${pagename}]]`,
    `[[pagename::${pagename}]]`,
    `[[player::${pagename}]]`,
  ].join(' OR ');
  try {
    const results = await v3Fetch('/squadplayer', {
      wiki,
      conditions,
      query,
      order: 'joindate DESC',
      limit: '100',
    });
    if (results.length > 0) {
      return results.map(r => ({
        name: r.newteam || '',
        role: r.role || '',
        start_date: r.joindate || '',
        end_date: r.leavedate || '',
      }));
    }
  } catch { }
  return [];
}

async function fetchPlayerTournaments(pagename, wiki) {
  if (!pagename) return [];
  const query = 'opponentname,tournament,placement,prizemoney,date,liquipediatier';
  const nameUnderscore = pagename.replace(/ /g, '_');
  const conditions = [
    `[[opponentname::${pagename}]]`,
    `[[opponentname::${nameUnderscore}]]`,
    `[[pagename::${pagename}]]`,
    `[[player::${pagename}]]`,
    `[[player::${nameUnderscore}]]`,
    `[[participant::${pagename}]]`,
    `[[participant::${nameUnderscore}]]`,
  ].join(' OR ');
  try {
    const results = await v3Fetch('/placement', {
      wiki,
      conditions,
      query,
      order: 'date DESC',
      limit: '100',
    });
    return (results || [])
      .map(r => ({
        name: r.tournament || '',
        placement: r.placement || '',
        date: r.date || '',
        prize: r.prizemoney || '',
        tier: r.liquipediatier || '',
      }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } catch { }
  return [];
}

async function fetchSectionWikitables(pagename, wiki, sectionIndex) {
  if (!pagename || !wiki) return [];
  const baseUrl = `https://liquipedia.net/${wiki}/api.php`;
  const ua = { headers: { 'User-Agent': 'PakEsportsScout/1.0' } };
  try {
    const contentUrl = `${baseUrl}?action=parse&page=${encodeURIComponent(pagename)}&prop=text&section=${sectionIndex}&format=json`;
    const res = await fetch(contentUrl, ua);
    if (!res.ok) return [];
    const data = await res.json();
    const html = data?.parse?.text?.['*'] || '';
    if (!html) return [];

    return parseHtmlTables(html);
  } catch {
    return [];
  }
}

function parseHtmlTables(html) {
  const tables = [];
  const seenHtml = new Set();

  const parseTable = (tableHtml) => {
    const rows = [...tableHtml.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/gi)];
    if (rows.length < 2) return null;
    const headers = [];
    const dataRows = [];
    rows.forEach((row, ri) => {
      const cells = [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => stripHtml(c[1]));
      if (ri === 0) headers.push(...cells.map(h => h.toLowerCase().trim()));
      else dataRows.push(cells);
    });
    if (headers.length === 0) return null;
    return { headers, dataRows };
  };

  const allTableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
  let tableMatch;
  while ((tableMatch = allTableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[0];
    const dedupKey = tableHtml.substring(0, 100);
    if (seenHtml.has(dedupKey)) continue;
    seenHtml.add(dedupKey);

    const hasWikitableClass = /class="[^"]*(?:wikitable|mw-collapsible|sortable)[^"]*"/i.test(tableHtml);
    const result = parseTable(tableHtml);
    if (!result) continue;

    if (hasWikitableClass) {
      tables.push(result);
    } else {
      const hasRelevantHeader = result.headers.some(h =>
        ['tournament', 'team', 'event', 'placement', 'result', 'date', 'prize', 'rank', 'game', 'score', 'player', 'opponent', 'round'].includes(h)
      );
      if (hasRelevantHeader && result.dataRows.length > 0) {
        tables.push(result);
      }
    }
  }

  return tables;
}

async function fetchFullPageTables(pagename, wiki) {
  if (!pagename || !wiki) return [];
  const baseUrl = `https://liquipedia.net/${wiki}/api.php`;
  const ua = { headers: { 'User-Agent': 'PakEsportsScout/1.0' } };
  try {
    const url = `${baseUrl}?action=parse&page=${encodeURIComponent(pagename)}&prop=text&format=json`;
    const res = await fetch(url, ua);
    if (!res.ok) return [];
    const data = await res.json();
    const html = data?.parse?.text?.['*'] || '';
    if (!html) return [];
    return parseHtmlTables(html);
  } catch {
    return [];
  }
}

async function scanAllSections(pagename, wiki) {
  if (!pagename || !wiki) return [];
  const baseUrl = `https://liquipedia.net/${wiki}/api.php`;
  const ua = { headers: { 'User-Agent': 'PakEsportsScout/1.0' } };
  try {
    const url = `${baseUrl}?action=parse&page=${encodeURIComponent(pagename)}&prop=sections&format=json`;
    const res = await fetch(url, ua);
    if (!res.ok) return [];
    const data = await res.json();
    const sections = data?.parse?.sections || [];
    const relevantKeywords = ['team', 'tournament', 'result', 'achievement', 'history', 'career', 'award', 'match', 'event', 'placement', 'statistic', 'performance', 'overview', 'biography'];
    const filtered = sections.filter(s =>
      relevantKeywords.some(k => (s.line || '').toLowerCase().includes(k))
    );
    if (filtered.length === 0) {
      const all = sections.filter(s => (s.line || '').toLowerCase() !== 'infobox');
      if (all.length > 0) all.forEach(s => s._from_fallback = true);
      return all.length > 0 ? all.slice(0, 6) : [];
    }
    const results = await Promise.allSettled(
      filtered.map(sec =>
        fetchSectionWikitables(pagename, wiki, sec.index)
          .then(tables => ({ section: sec.line?.toLowerCase() || '', tables }))
      )
    );
    return results.filter(r => r.status === 'fulfilled').map(r => r.value);
  } catch {
    return [];
  }
}

async function fetchPlayerTournamentsFromPage(pagename, wiki) {
  const allSections = await scanAllSections(pagename, wiki);
  const tournaments = [];
  const seen = new Set();

  const extractor = (headers, dataRows) => {
    const hasTournamentCol = headers.some(h =>
      ['tournament', 'event', 'competition', 'tier', 'league', 'cup', 'championship', 'series'].includes(h)
    );
    const hasPlacementCol = headers.some(h =>
      ['placement', 'result', 'place', 'finish', 'rank', 'position'].includes(h)
    );
    if (!hasTournamentCol && !hasPlacementCol) return;

    for (const cells of dataRows) {
      const entry = {};
      headers.forEach((h, hi) => { entry[h] = cells[hi] || ''; });
      const name = entry.tournament || entry.event || entry.competition || entry.name || entry.tier || entry.league || entry.cup || entry.series || '';
      const placement = entry.placement || entry.result || entry.place || entry.finish || entry.rank || entry.position || '';
      const date = entry.date || entry.year || '';
      const prize = entry.prize || entry.prizemoney || entry['prize money'] || '';
      if (!name) continue;
      const key = name + '|' + date + '|' + placement;
      if (!seen.has(key)) {
        seen.add(key);
        tournaments.push({ name, placement, date, prize, tier: '', source: 'page' });
      }
    }
  };

  for (const { section, tables } of allSections) {
    for (const { headers, dataRows } of tables) {
      extractor(headers, dataRows);
    }
  }

  if (tournaments.length === 0) {
    const allTables = await fetchFullPageTables(pagename, wiki);
    for (const { headers, dataRows } of allTables) {
      extractor(headers, dataRows);
    }
  }

  return tournaments;
}

async function fetchPlayerTeamsFromPage(pagename, wiki) {
  const allSections = await scanAllSections(pagename, wiki);
  const teams = [];
  const seen = new Set();

  const extractor = (headers, dataRows) => {
    const hasTeamCol = headers.some(h =>
      ['team', 'organization', 'team name', 'current team', 'club', 'squad'].includes(h)
    );
    const hasDateCol = headers.some(h =>
      ['join', 'joined', 'join date', 'leave', 'left', 'leave date', 'from', 'to', 'date', 'start', 'end'].includes(h)
    );
    if (!hasTeamCol && !hasDateCol) return;

    for (const cells of dataRows) {
      const entry = {};
      headers.forEach((h, hi) => { entry[h] = cells[hi] || ''; });
      const name = entry.team || entry.organization || entry['team name'] || entry.name || entry.club || entry.squad || '';
      const role = entry.role || entry.position || entry.type || entry.status || '';
      const start_date = entry.join || entry.joined || entry['join date'] || entry.start || entry['start date'] || entry.from || entry.date || '';
      const end_date = entry.leave || entry.left || entry['leave date'] || entry.end || entry['end date'] || entry.until || entry.to || '';
      if (!name) continue;
      const key = name + '|' + start_date + '|' + end_date;
      if (!seen.has(key)) {
        seen.add(key);
        teams.push({ name, role, start_date, end_date });
      }
    }
  };

  for (const { section, tables } of allSections) {
    for (const { headers, dataRows } of tables) {
      extractor(headers, dataRows);
    }
  }

  if (teams.length === 0) {
    const allTables = await fetchFullPageTables(pagename, wiki);
    for (const { headers, dataRows } of allTables) {
      extractor(headers, dataRows);
    }
  }

  return teams;
}

async function fetchPlayerAwards(pagename, wiki) {
  if (!pagename || !wiki) return [];
  const baseUrl = `https://liquipedia.net/${wiki}/api.php`;
  const ua = { headers: { 'User-Agent': 'PakEsportsScout/1.0' } };
  const awardKeywords = ['award', 'accolade', 'recognition', 'achievement'];
  try {
    const url = `${baseUrl}?action=parse&page=${encodeURIComponent(pagename)}&prop=sections&format=json`;
    const res = await fetch(url, ua);
    if (!res.ok) return [];
    const data = await res.json();
    const sections = data?.parse?.sections || [];
    const targets = sections.filter(s =>
      awardKeywords.some(k => (s.line || '').toLowerCase().includes(k))
    );
    if (targets.length === 0) return [];

    const awards = [];
    const seen = new Set();
    const results = await Promise.allSettled(
      targets.map(sec => {
        const contentUrl = `${baseUrl}?action=parse&page=${encodeURIComponent(pagename)}&prop=text&section=${sec.index}&format=json`;
        return fetch(contentUrl, ua).then(r => r.json());
      })
    );
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const html = r.value?.parse?.text?.['*'] || '';
      const liRegex = /<li>([\s\S]*?)<\/li>/gi;
      let m;
      while ((m = liRegex.exec(html)) !== null) {
        const text = stripHtml(m[1]);
        if (!text || seen.has(text)) continue;
        seen.add(text);
        const yearMatch = text.match(/(\d{4})/);
        awards.push({ title: text.trim(), type: 'individual', year: yearMatch ? yearMatch[1] : '', source: 'auto-derived' });
      }
    }
    return awards;
  } catch {
    return [];
  }
}

function mergeTournaments(v3Tournaments, pageTournaments) {
  const seen = new Set();
  const merged = [];
  for (const t of [...v3Tournaments, ...pageTournaments]) {
    const key = t.name + '|' + (t.date || '') + '|' + (t.placement || '');
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(t);
    }
  }
  return merged.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function mergeTeams(v3Teams, pageTeams) {
  const seen = new Set();
  const merged = [...v3Teams, ...pageTeams].reverse();
  const result = [];
  for (const t of merged) {
    const key = t.name + '|' + (t.start_date || '') + '|' + (t.end_date || '');
    if (key && !seen.has(key)) {
      seen.add(key);
      result.unshift(t);
    }
  }
  return result;
}

const INDIVIDUAL_AWARD_KEYWORDS = [
  'mvp', 'most valuable player', 'most kills', 'ace', 'clutch player',
  'player of the match', 'player of the tournament', 'player of the game',
  'franchise player', 'star player', 'best player', 'top player',
  'award', 'golden', 'all-star', 'all star',
];

function detectIndividualAchievements(tournaments) {
  const individual = [];
  for (const t of tournaments) {
    const name = (t.name || t.title || '').toLowerCase();
    for (const keyword of INDIVIDUAL_AWARD_KEYWORDS) {
      if (name.includes(keyword)) {
        individual.push({
          title: t.name || t.title || '',
          type: 'individual',
          year: t.year || t.date || '',
          source: 'auto-derived',
        });
        break;
      }
    }
  }
  return individual;
}

function mapLiquipediaToPlayerProfile(normalized) {
  const teams = (normalized.teams || []).map(t => ({
    name: t.name || '',
    role: t.role || '',
    start_date: t.start_date || '',
    end_date: t.end_date || '',
  }));
  const tournaments = (normalized.tournaments || []).map(t => ({
    name: t.name || '',
    placement: t.placement || '',
    date: t.date || '',
    prize: t.prize || '',
    year: t.year || t.date || '',
  }));
  const rawAchievements = (normalized.achievements || []).map(a => ({
    title: a.title || a.name || '',
    placement: a.placement || '',
    year: a.year || a.date || '',
  }));

  const individualFromTournaments = detectIndividualAchievements(normalized.tournaments || []);
  const allIndividual = [
    ...individualFromTournaments,
    ...rawAchievements.filter(a => {
      const t = (a.title || '').toLowerCase();
      return INDIVIDUAL_AWARD_KEYWORDS.some(k => t.includes(k)) || a.placement?.toLowerCase().includes('mvp');
    }),
  ];
  const uniqueIndividual = [];
  const seen = new Set();
  for (const a of allIndividual) {
    const key = a.title + '|' + a.year;
    if (!seen.has(key)) { seen.add(key); uniqueIndividual.push(a); }
  }

  const placementAchievements = [];
  const winKeywords = ['1st', 'winner', 'champion', 'gold'];
  const significant = ['2nd', '3rd', 'runner', 'semi', 'bronze', 'silver'];
  tournaments.forEach(t => {
    const placement = (t.placement || '').toLowerCase();
    if (winKeywords.some(k => placement.includes(k))) {
      placementAchievements.push({
        title: `${t.name} Champion`,
        type: 'tournament',
        placement: t.placement || '1st',
        year: t.date || t.year || '',
      });
    } else if (significant.some(k => placement.includes(k))) {
      placementAchievements.push({
        title: t.name || t.title || '',
        type: 'tournament',
        placement: t.placement || '',
        year: t.date || t.year || '',
      });
    }
  });

  const profile = {
    hero: {
      real_name: normalized.real_name || normalized.name || '',
      country: normalized.country || '',
      nationality: normalized.country || '',
      main_game: normalized.game || '',
      preferred_role: normalized.role || '',
      avatar: normalized.image || '',
      liquipedia_url: normalized.liquipedia_url || '',
      current_team: teams.length > 0 ? teams[0].name : '',
      profile_status: 'imported',
      profile_source: 'liquipedia',
    },
    overview: {
      bio: generateBio(normalized),
      social_links: normalized.social_links || {},
    },
    statistics: {
      kd_ratio: normalized.statistics?.kd_ratio || 0,
      win_rate: normalized.statistics?.win_rate || 0,
      matches_played: normalized.statistics?.matches_played || 0,
      highest_rank: normalized.statistics?.highest_rank || '',
      tournaments_played: (normalized.tournaments || []).length,
      mvps: 0,
      acs: 0,
      adr: 0,
      headshot_percent: 0,
      clutch_percent: 0,
      opening_duel_percent: 0,
      tournament_win_percent: 0,
    },
    teams: {
      entries: teams,
    },
    tournaments: {
      entries: tournaments,
    },
    achievements: {
      entries: [...placementAchievements, ...rawAchievements],
      text: [...placementAchievements, ...rawAchievements].map(a => `• ${a.title} (${a.year})`).join('\n'),
      individual: uniqueIndividual,
    },
    socials: {
      links: normalized.social_links || {},
      liquipedia_url: normalized.liquipedia_url || '',
    },
    media: { videos: [] },
    player_history: { entries: [] },
  };

  console.log('[MAP LIQUIPEDIA TO PROFILE] Input fields:', Object.keys(normalized));
  console.log('[MAP LIQUIPEDIA TO PROFILE] Teams mapped:', teams.length);
  console.log('[MAP LIQUIPEDIA TO PROFILE] Tournaments mapped:', tournaments.length);
  console.log('[MAP LIQUIPEDIA TO PROFILE] Achievements mapped:', placementAchievements.length + rawAchievements.length);
  console.log('[MAP LIQUIPEDIA TO PROFILE] Individual achievements detected:', uniqueIndividual.length);
  console.log('[MAP LIQUIPEDIA TO PROFILE] Output sections:', Object.keys(profile));
  console.log('[MAP LIQUIPEDIA TO PROFILE] Full output:', JSON.stringify(profile, null, 2));

  return profile;
}

function mapLiquipediaData(normalized, role) {
  const individualFromTournaments = detectIndividualAchievements(normalized.tournaments || []);
  const rawAsIndividual = (normalized.achievements || []).filter(a => {
    const t = (a.title || a.name || '').toLowerCase();
    return INDIVIDUAL_AWARD_KEYWORDS.some(k => t.includes(k)) || (a.placement || '').toLowerCase().includes('mvp');
  });

  const allIndividual = [
    ...individualFromTournaments,
    ...rawAsIndividual.map(a => ({
      title: a.title || a.name || '',
      type: 'individual',
      year: a.year || a.date || '',
      source: 'auto-derived',
    })),
  ];

  const tournamentData = normalized.tournaments || [];
  const totalTournaments = tournamentData.length;
  let wins = 0;
  for (const t of tournamentData) {
    const p = (t.placement || '').toLowerCase();
    if (['1st', 'winner', 'champion', 'gold'].some(k => p.includes(k))) wins++;
  }
  const winRate = totalTournaments > 0 ? Math.round((wins / totalTournaments) * 100) : 0;
  const mvps = allIndividual.length;

  const base = {
    real_name: normalized.real_name || normalized.name,
    country: normalized.country || '',
    main_game: normalized.game || '',
    avatar: normalized.image || '',
    liquipedia_url: normalized.liquipedia_url,
    nationality: normalized.country || '',
    liquipedia_data: {
      teams: normalized.teams || [],
      tournaments: normalized.tournaments || [],
      achievements: normalized.achievements || [],
      statistics: {
        win_rate: winRate,
        matches_played: totalTournaments,
        tournaments_played: totalTournaments,
        mvps: mvps,
        tournament_win_percent: winRate,
        ...(normalized.statistics || {}),
      },
      social_links: normalized.social_links || {},
      earnings: normalized.earnings || null,
      signature_heroes: normalized.signature_heroes || [],
      aliases: normalized.aliases || [],
      birth_date: normalized.birth_date || null,
      retirement_date: normalized.retirement_date || null,
      status: normalized.status || '',
      image: normalized.image || '',
      individual_achievements: allIndividual,
    },
  };
  const generatedBio = generateBio(normalized);
  if (role === 'player') {
    return {
      ...base,
      bio: generatedBio,
      preferred_role: normalized.role || '',
      teams_played: (normalized.teams || []).map((t) => `${t.name} (${t.role})`).join(', '),
      achievements: Array.isArray(normalized.achievements)
        ? normalized.achievements.map(a => `• ${a.title || a.name || ''} (${a.year || a.date || ''})`).join('\n')
        : (normalized.achievements || ''),
      kd_ratio: normalized.statistics?.kd_ratio || normalized.kd_ratio || 0,
      win_rate: winRate,
      matches_played: totalTournaments,
      highest_rank: normalized.statistics?.highest_rank || normalized.highest_rank || '',
      tournaments_played: totalTournaments,
      mvps: mvps,
      tournament_win_percent: winRate,
      social_links: normalized.social_links || {},
    };
  }
  return {
    ...base,
    bio: generatedBio,
    organization: (normalized.teams || []).map((t) => t.name).join(', '),
    coaching_specialty: normalized.role || '',
    best_achievement: '',
    achievements: Array.isArray(normalized.achievements)
      ? normalized.achievements.map(a => `• ${a.title || a.name || ''} (${a.year || a.date || ''})`).join('\n')
      : (normalized.achievements || ''),
    teams_coached: (normalized.teams || []).map((t) => `${t.name} (${t.role})`).join(', '),
    social_links: normalized.social_links || {},
  };
}

function mapLiquipediaToScoutProfile(normalized) {
  const teams = (normalized.teams || []).map(t => ({
    name: t.name || '',
    role: t.role || '',
    start_date: t.start_date || '',
    end_date: t.end_date || '',
  }));
  const tournaments = (normalized.tournaments || []).map(t => ({
    name: t.name || '',
    placement: t.placement || '',
    date: t.date || '',
  }));
  const achievements = (normalized.achievements || []).map(a => ({
    title: a.title || a.name || '',
    placement: a.placement || '',
    year: a.year || a.date || '',
  }));

  const profile = {
    hero: {
      real_name: normalized.real_name || normalized.name || '',
      country: normalized.country || '',
      nationality: normalized.country || '',
      main_game: normalized.game || '',
      preferred_role: normalized.role || '',
      avatar: normalized.image || '',
      liquipedia_url: normalized.liquipedia_url || '',
      organization: teams.length > 0 ? teams[0].name : '',
      profile_status: 'imported',
      profile_source: 'liquipedia',
    },
    overview: {
      bio: generateBio(normalized),
      social_links: normalized.social_links || {},
    },
    teams: { entries: teams },
    tournaments: { entries: tournaments },
    achievements: {
      entries: achievements,
      text: achievements.map(a => `• ${a.title} (${a.year})`).join('\n'),
    },
    socials: {
      links: normalized.social_links || {},
      liquipedia_url: normalized.liquipedia_url || '',
    },
    scout_history: { entries: [] },
  };

  return profile;
}

module.exports = {
  searchPlayer,
  searchScout,
  fetchPlayerProfile,
  fetchScoutProfile,
  fetchPlayerImage,
  fetchPlayerTournaments,
  fetchPlayerTournamentsFromPage,
  fetchPlayerTeamsFromPage,
  fetchPlayerAwards,
  searchTournaments,
  mapLiquipediaData,
  mapLiquipediaToPlayerProfile,
  mapLiquipediaToScoutProfile,
};
