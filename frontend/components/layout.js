/**
 * Premium layout system for PakEsports Scout PRO.
 * Injects pe-sidebar + pe-topbar into any authenticated page.
 * Usage: import { initLayout } from '/components/layout.js'; initLayout();
 */

const SCOUT_NAV = [
  { label: 'Dashboard', icon: 'dashboard', href: 'dashboard.html' },
  { label: 'Gameplay Feed', icon: 'smart_display', href: 'feed.html' },
  { label: 'Saved Videos', icon: 'bookmark', href: 'saved-videos.html' },
  { label: 'Search Players', icon: 'search', href: 'search.html' },
  { label: 'Shortlisted', icon: 'stars', href: 'shortlist.html' },
  { label: 'Tournaments', icon: 'emoji_events', href: 'tournaments.html' },
  { label: 'Messages', icon: 'chat', href: 'messages.html' },
  { label: 'Profile', icon: 'person', href: 'profile.html' },
]

const PLAYER_NAV = [
  { label: 'Dashboard', icon: 'dashboard', href: 'dashboard.html' },
  { label: 'My Gameplay', icon: 'smart_display', href: 'feed.html' },
  { label: 'Saved Clips', icon: 'bookmark', href: 'saved-videos.html' },
  { label: 'Upload Clip', icon: 'videocam', href: 'upload.html' },
  { label: 'Find Tournaments', icon: 'emoji_events', href: 'tournaments.html' },
  { label: 'Messages', icon: 'chat', href: 'messages.html' },
  { label: 'Profile', icon: 'person', href: 'profile.html' },
]

const CMD_SEARCH_HISTORY_KEY = 'peCmdHistory'
function getCmdHistory() {
  try { return JSON.parse(localStorage.getItem(CMD_SEARCH_HISTORY_KEY) || '[]') } catch { return [] }
}
function addCmdHistory(q) {
  const h = getCmdHistory().filter(s => s.toLowerCase() !== q.toLowerCase())
  h.unshift(q)
  localStorage.setItem(CMD_SEARCH_HISTORY_KEY, JSON.stringify(h.slice(0, 8)))
}

function getRoot() {
  const p = window.location.pathname.replace(/\\/g, '/')
  if (p.includes('/pages/player/') || p.includes('/pages/scout/')) return '../..'
  if (p.includes('/pages/')) return '..'
  return '.'
}

function isCollapsed() {
  return localStorage.getItem('sidebarCollapsed') === 'true'
}
function setCollapsed(v) {
  localStorage.setItem('sidebarCollapsed', v ? 'true' : 'false')
}

function getPageFile() {
  return window.location.pathname.replace(/\\/g, '/').split('/').pop() || ''
}

function createSidebar(role) {
  const navs = role === 'scout' ? SCOUT_NAV : PLAYER_NAV
  const root = getRoot()
  const cur = getPageFile()
  const collapsed = isCollapsed()

  const el = document.createElement('aside')
  el.className = `pe-sidebar${collapsed ? ' collapsed' : ''}`
  el.id = 'peSidebar'

  const logo = document.createElement('div')
  logo.className = 'pe-logo'
  logo.innerHTML = `
    <div class="pe-logo-badge">PE</div>
    <div class="pe-logo-text">
      <div class="pe-logo-title">PakEsports</div>
      <div class="pe-logo-sub">SCOUT PRO</div>
    </div>
  `
  el.appendChild(logo)

  const nav = document.createElement('nav')
  nav.className = 'pe-nav scrollbar-thin'
  navs.forEach(item => {
    const active = cur === item.href
    const a = document.createElement('a')
    a.className = `pe-nav-item${active ? ' active' : ''}`
    a.href = item.href
    a.innerHTML = `
      <span class="pe-nav-icon material-symbols-outlined">${item.icon}</span>
      <span class="pe-nav-label">${item.label}</span>
      ${active ? '<span class="pe-nav-dot"></span>' : ''}
    `
    nav.appendChild(a)
  })
  el.appendChild(nav)

  const bottom = document.createElement('div')
  bottom.className = 'pe-sidebar-bottom'

  const collapseBtn = document.createElement('button')
  collapseBtn.className = 'pe-bottom-btn'
  collapseBtn.id = 'peCollapseBtn'
  collapseBtn.innerHTML = `
    <span class="pe-btn-icon material-symbols-outlined">chevron_left</span>
    <span class="pe-btn-label">Collapse</span>
  `
  collapseBtn.addEventListener('click', () => {
    el.classList.toggle('collapsed')
    setCollapsed(el.classList.contains('collapsed'))
    const tb = document.getElementById('peTopbar')
    const mc = document.getElementById('peMain')
    const w = el.classList.contains('collapsed') ? '64px' : '250px'
    if (tb) tb.style.left = w
    if (mc) mc.style.marginLeft = w
  })

  const logoutBtn = document.createElement('button')
  logoutBtn.className = 'pe-bottom-btn logout'
  logoutBtn.innerHTML = `
    <span class="pe-btn-icon material-symbols-outlined">logout</span>
    <span class="pe-btn-label">Log Out</span>
  `
  logoutBtn.addEventListener('click', () => {
    localStorage.clear()
    window.location.href = `${root}/index.html`
  })

  bottom.appendChild(collapseBtn)
  bottom.appendChild(logoutBtn)
  el.appendChild(bottom)
  return el
}

// ────────────────────────────────────────────────────────────
// SCOUT: GLOBAL COMMAND BAR + PALETTE
// ────────────────────────────────────────────────────────────
function createScoutSearchTrigger() {
  const container = document.createElement('div')
  container.className = 'pe-cmd-trigger'
  container.setAttribute('role', 'button')
  container.setAttribute('tabindex', '0')
  container.innerHTML = `
    <span class="material-symbols-outlined pe-cmd-trigger-icon">search</span>
    <span class="pe-cmd-trigger-label">Search players, tournaments...</span>
    <kbd class="pe-cmd-kbd">${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}K</kbd>
  `
  container.addEventListener('click', openCommandPalette)
  container.addEventListener('keydown', e => { if (e.key === 'Enter') openCommandPalette() })
  return container
}

// Global command palette state
let _cmdOverlay = null
let _cmdActiveIdx = -1
let _cmdResults = []
let _cmdAbort = null

function openCommandPalette() {
  const existing = document.querySelector('.pe-cmd-overlay')
  if (existing) { existing.remove(); return }

  const overlay = document.createElement('div')
  overlay.className = 'pe-cmd-overlay'
  overlay.innerHTML = `
    <div class="pe-cmd-backdrop"></div>
    <div class="pe-cmd-palette">
      <div class="pe-cmd-input-wrap">
        <span class="material-symbols-outlined pe-cmd-search-icon">search</span>
        <input type="text" class="pe-cmd-input" placeholder="Search players, tournaments, messages..." autofocus>
        <button class="pe-cmd-close-btn" aria-label="Close"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="pe-cmd-results">
        <div class="pe-cmd-empty">Start typing to search...</div>
      </div>
      <div class="pe-cmd-footer">
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>Enter</kbd> select</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    </div>
  `

  const backdrop = overlay.querySelector('.pe-cmd-backdrop')
  const input = overlay.querySelector('.pe-cmd-input')
  const resultsEl = overlay.querySelector('.pe-cmd-results')
  const closeBtn = overlay.querySelector('.pe-cmd-close-btn')

  _cmdActiveIdx = -1
  _cmdResults = []

  backdrop.addEventListener('click', () => overlay.remove())
  closeBtn.addEventListener('click', () => overlay.remove())

  // Show recent searches on open
  renderRecentSearches(resultsEl)

  input.addEventListener('input', () => {
    _cmdActiveIdx = -1
    const q = input.value.trim()
    if (!q) { renderRecentSearches(resultsEl); return }
    performSearch(q, resultsEl)
  })

  input.addEventListener('keydown', (e) => {
    const items = resultsEl.querySelectorAll('.pe-cmd-item')
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      _cmdActiveIdx = Math.min(_cmdActiveIdx + 1, items.length - 1)
      highlightItem(items)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      _cmdActiveIdx = Math.max(_cmdActiveIdx - 1, 0)
      highlightItem(items)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (_cmdActiveIdx >= 0 && _cmdActiveIdx < items.length) {
        items[_cmdActiveIdx]?.click()
      } else if (items.length === 1) {
        items[0]?.click()
      }
    } else if (e.key === 'Escape') {
      overlay.remove()
    }
  })

  document.body.appendChild(overlay)
  setTimeout(() => input.focus(), 50)
  _cmdOverlay = overlay
}

function highlightItem(items) {
  items.forEach((el, i) => el.classList.toggle('active', i === _cmdActiveIdx))
  const active = items[_cmdActiveIdx]
  if (active) active.scrollIntoView({ block: 'nearest' })
}

function renderRecentSearches(el) {
  const history = getCmdHistory()
  if (!history.length) {
    el.innerHTML = '<div class="pe-cmd-empty">Start typing to search players, tournaments, messages...</div>'
    return
  }
  el.innerHTML = `
    <div class="pe-cmd-section-label">Recent Searches</div>
    ${history.map((s, i) => `
      <div class="pe-cmd-item" data-action="search" data-query="${s}" tabindex="0">
        <span class="material-symbols-outlined pe-cmd-item-icon">history</span>
        <span class="pe-cmd-item-label">${escHtml(s)}</span>
      </div>
    `).join('')}
  `
  el.querySelectorAll('.pe-cmd-item').forEach(item => {
    item.addEventListener('click', () => {
      const q = item.dataset.query
      document.querySelector('.pe-cmd-input').value = q
      performSearch(q, el)
    })
  })
}

async function performSearch(q, el) {
  if (_cmdAbort) { _cmdAbort.abort(); _cmdAbort = null }
  const ac = new AbortController()
  _cmdAbort = ac

  el.innerHTML = '<div class="pe-cmd-loading"><span class="pe-cmd-spinner"></span> Searching...</div>'
  addCmdHistory(q)

  const role = localStorage.getItem('role') || 'scout'
  const sections = []

  // 1. Pages (local, always)
  const navItems = role === 'scout' ? SCOUT_NAV : PLAYER_NAV
  const ql = q.toLowerCase()
  const pageHits = navItems.filter(n => n.label.toLowerCase().includes(ql))
  if (pageHits.length) {
    sections.push({ label: 'Pages', items: pageHits.map(n => ({
      label: n.label, icon: n.icon, href: n.href, action: 'navigate'
    }))})
  }

  // 2. Players (scout only, via API)
  if (role === 'scout') {
    try {
      const data = await api(`/scout/search?q=${encodeURIComponent(q)}&limit=5`, { signal: ac.signal })
      const players = Array.isArray(data) ? data : (data.players || data.results || [])
      if (players.length) {
        sections.push({ label: 'Players', items: players.map(p => ({
          label: p.username, icon: 'person', href: `../player/public-profile.html?id=${p.id}`, action: 'navigate',
          meta: `${p.game || ''} ESV ${p.esv_score || 0}`
        }))})
      }
    } catch (e) { if (e.name !== 'AbortError') console.error(e) }
  }

  // 3. Tournaments (via API)
  try {
    const data = await api(`/tournaments?q=${encodeURIComponent(q)}&limit=3`, { signal: ac.signal })
    const tournaments = Array.isArray(data) ? data : (data.tournaments || data.results || [])
    if (tournaments.length) {
      sections.push({ label: 'Tournaments', items: tournaments.map(t => ({
        label: t.name, icon: 'emoji_events', href: `../scout/tournaments.html?id=${t.id}`, action: 'navigate',
        meta: t.city || t.date || ''
      }))})
    }
  } catch (e) { if (e.name !== 'AbortError') console.error(e) }

  // 4. Messages (via conversations API, filtered locally)
  if (role === 'scout') {
    try {
      const convs = await api(`/conversations?q=${encodeURIComponent(q)}&limit=3`, { signal: ac.signal })
      const conversations = Array.isArray(convs) ? convs : []
      const filtered = conversations.filter(c => {
        const name = c.otherUser?.username || ''
        const lastMsg = c.lastMessage?.text || c.lastMessage?.message || ''
        return name.toLowerCase().includes(ql) || lastMsg.toLowerCase().includes(ql)
      }).slice(0, 3)
      if (filtered.length) {
        sections.push({ label: 'Messages', items: filtered.map(c => ({
          label: c.otherUser?.username || 'Conversation', icon: 'chat',
          href: `../scout/messages.html?conv=${c.id}`, action: 'navigate',
          meta: c.lastMessage ? (c.lastMessage.message || c.lastMessage.text || '') : ''
        }))})
      }
    } catch (e) { if (e.name !== 'AbortError') console.error(e) }
  }

  // 5. Teams (scout only)
  if (role === 'scout') {
    try {
      const teams = await api(`/teams/mine?q=${encodeURIComponent(q)}`, { signal: ac.signal })
      const filtered = (Array.isArray(teams) ? teams : []).filter(t =>
        (t.name || '').toLowerCase().includes(ql)
      ).slice(0, 3)
      if (filtered.length) {
        sections.push({ label: 'Teams', items: filtered.map(t => ({
          label: t.name, icon: 'groups', href: `../scout/teams.html?id=${t.id}`, action: 'navigate',
          meta: t.game || ''
        }))})
      }
    } catch (e) { if (e.name !== 'AbortError') console.error(e) }
  }

  if (ac.signal.aborted) return

  if (!sections.length) {
    el.innerHTML = `<div class="pe-cmd-empty">No results for "${escHtml(q)}"</div>`
    return
  }

  el.innerHTML = sections.map(s => `
    <div class="pe-cmd-section-label">${s.label}</div>
    ${s.items.map(item => `
      <div class="pe-cmd-item" data-href="${item.href}" data-action="${item.action}" tabindex="0">
        <span class="material-symbols-outlined pe-cmd-item-icon">${item.icon}</span>
        <span class="pe-cmd-item-label">${escHtml(item.label)}</span>
        ${item.meta ? `<span class="pe-cmd-item-meta">${escHtml(item.meta)}</span>` : ''}
      </div>
    `).join('')}
  `).join('')

  el.querySelectorAll('.pe-cmd-item').forEach(item => {
    item.addEventListener('click', () => {
      const href = item.dataset.href
      if (href) window.location.href = href
    })
  })

  _cmdResults = sections.flatMap(s => s.items)
}

function escHtml(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function api(endpoint, opts = {}) {
  const base = 'http://localhost:5000'
  const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  return fetch(`${base}${endpoint}`, { ...opts, headers }).then(r => {
    if (!r.ok) throw new Error('API error')
    return r.json()
  })
}

// Register global Ctrl+K listener
function initGlobalCommandBar() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      openCommandPalette()
    }
  })
}

// ────────────────────────────────────────────────────────────
// PLAYER: STATUS + QUICK ACTIONS BAR
// ────────────────────────────────────────────────────────────
async function createPlayerStatusBar() {
  const container = document.createElement('div')
  container.className = 'pe-player-bar'

  // Team status badge
  const teamBadge = document.createElement('div')
  teamBadge.className = 'pe-player-team'
  try {
    const teamData = await api('/recruitment/my-team/player')
    if (teamData) {
      teamBadge.innerHTML = `
        <span class="material-symbols-outlined pe-player-team-icon">groups</span>
        <span class="pe-player-team-name">${escHtml(teamData.team_name)}</span>
        <span class="pe-player-team-status active">Active</span>
      `
    } else {
      teamBadge.innerHTML = `
        <span class="material-symbols-outlined pe-player-team-icon">person_search</span>
        <span class="pe-player-team-name">Free Agent</span>
        <span class="pe-player-team-status free">Open</span>
      `
    }
  } catch {
    teamBadge.innerHTML = `
      <span class="material-symbols-outlined pe-player-team-icon">person_search</span>
      <span class="pe-player-team-name">Free Agent</span>
      <span class="pe-player-team-status free">Open</span>
    `
  }
  teamBadge.addEventListener('click', () => { window.location.href = 'dashboard.html' })
  container.appendChild(teamBadge)

  // Pending offers pill
  try {
    const offers = await api('/recruitment/offers/pending-player')
    if (offers.length) {
      const offerPill = document.createElement('a')
      offerPill.className = 'pe-player-offer-pill'
      offerPill.href = 'dashboard.html'
      offerPill.innerHTML = `
        <span class="material-symbols-outlined" style="font-size:16px;">handshake</span>
        ${offers.length} pending offer${offers.length > 1 ? 's' : ''}
      `
      container.appendChild(offerPill)
    }
  } catch {}

  // Quick actions
  const actions = document.createElement('div')
  actions.className = 'pe-player-actions'

  const uploadBtn = document.createElement('a')
  uploadBtn.className = 'pe-player-action-btn'
  uploadBtn.href = 'upload.html'
  uploadBtn.title = 'Upload Video'
  uploadBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span>'

  const msgsBtn = document.createElement('a')
  msgsBtn.className = 'pe-player-action-btn'
  msgsBtn.href = 'messages.html'
  msgsBtn.title = 'Messages'
  msgsBtn.innerHTML = '<span class="material-symbols-outlined">chat</span>'

  actions.appendChild(uploadBtn)
  actions.appendChild(msgsBtn)
  container.appendChild(actions)

  return container
}

// ────────────────────────────────────────────────────────────
// TOPBAR CREATOR (role-aware)
// ────────────────────────────────────────────────────────────
async function createTopbar() {
  const role = localStorage.getItem('role') || 'scout'
  const uname = localStorage.getItem('username') || 'User'
  const initial = uname.charAt(0).toUpperCase()
  const root = getRoot()
  const collapsed = isCollapsed()

  const el = document.createElement('header')
  el.className = 'pe-topbar'
  el.id = 'peTopbar'
  if (collapsed) el.style.left = '64px'

  const left = document.createElement('div')
  left.className = 'pe-topbar-left'

  /* Hamburger */
  const ham = document.createElement('button')
  ham.className = 'pe-hamburger'
  ham.id = 'peHamburger'
  ham.innerHTML = '<span class="material-symbols-outlined">menu</span>'
  ham.addEventListener('click', () => {
    document.getElementById('peSidebar')?.classList.toggle('mobile-open')
    document.getElementById('peSidebarOverlay')?.classList.toggle('open')
  })
  left.appendChild(ham)

  /* Mobile search trigger (visible only on small screens) */
  const msBtn = document.createElement('button')
  msBtn.className = 'pe-icon-btn pe-search-mobile-btn'
  msBtn.id = 'peSearchMobileBtn'
  msBtn.innerHTML = '<span class="material-symbols-outlined">search</span>'
  msBtn.addEventListener('click', () => {
    const ov = document.getElementById('peMobileSearch')
    ov?.classList.toggle('open')
  })
  if (role === 'scout') left.appendChild(msBtn)

  /* Role-specific center section */
  if (role === 'scout') {
    left.appendChild(createScoutSearchTrigger())
  } else {
    const statusBar = await createPlayerStatusBar()
    left.appendChild(statusBar)
  }

  el.appendChild(left)

  /* Right — shared for both roles */
  const right = document.createElement('div')
  right.className = 'pe-topbar-right'

  const notif = document.createElement('button')
  notif.className = 'pe-icon-btn notif-btn'
  notif.innerHTML = `
    <span class="material-symbols-outlined">notifications</span>
    <span class="pe-notif-dot notif-dot"></span>
  `
  right.appendChild(notif)

  const settings = document.createElement('button')
  settings.className = 'pe-icon-btn'
  settings.innerHTML = '<span class="material-symbols-outlined">settings</span>'
  settings.addEventListener('click', () => { window.location.href = 'settings.html' })
  right.appendChild(settings)

  const avatar = document.createElement('div')
  avatar.className = 'pe-user-avatar'
  avatar.style.cursor = 'pointer'
  avatar.innerHTML = `
    <div class="pe-avatar-circle">${initial}</div>
    <span class="pe-avatar-name">${uname}</span>
  `
  avatar.addEventListener('click', () => { window.location.href = 'profile.html' })
  right.appendChild(avatar)
  el.appendChild(right)

  return el
}

// ────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────
export async function initLayout() {
  const role = localStorage.getItem('role') || 'scout'

  if (!localStorage.getItem('token')) {
    window.location.href = `${getRoot()}/index.html`
    return
  }

  let content = document.querySelector('.main-area')
  if (!content) content = document.querySelector('.app-main')
  if (!content) content = document.querySelector('main')
  if (!content) content = document.body

  let layout = document.querySelector('.pe-layout')
  if (!layout) {
    layout = document.createElement('div')
    layout.className = 'pe-layout'
    layout.id = 'peLayout'
    content.parentNode?.insertBefore(layout, content)
    layout.appendChild(content)
  }

  if (!content.id) content.id = 'peMain'
  content.classList.add('pe-main')
  if (isCollapsed()) content.style.marginLeft = '64px'

  layout.insertBefore(createSidebar(role), layout.firstChild)

  // Topbar creation is now async
  const topbar = await createTopbar()
  layout.insertBefore(topbar, content)

  const overlay = document.createElement('div')
  overlay.className = 'pe-sidebar-overlay'
  overlay.id = 'peSidebarOverlay'
  overlay.addEventListener('click', () => {
    overlay.classList.remove('open')
    document.getElementById('peSidebar')?.classList.remove('mobile-open')
  })
  document.body.appendChild(overlay)

  // Mobile search — only for scout
  if (role === 'scout') {
    const mobSearch = document.createElement('div')
    mobSearch.className = 'pe-mobile-search'
    mobSearch.id = 'peMobileSearch'
    mobSearch.innerHTML = `
      <div class="pe-cmd-trigger pe-mobile-cmd-btn" role="button">
        <span class="material-symbols-outlined pe-cmd-trigger-icon">search</span>
        <span class="pe-cmd-trigger-label">Search...</span>
        <kbd class="pe-cmd-kbd">⌘K</kbd>
      </div>
      <button class="pe-mobile-search-close" id="peMobileSearchClose">
        <span class="material-symbols-outlined">close</span>
      </button>
    `
    mobSearch.querySelector('.pe-mobile-cmd-btn')?.addEventListener('click', () => {
      mobSearch.classList.remove('open')
      openCommandPalette()
    })
    mobSearch.querySelector('#peMobileSearchClose')?.addEventListener('click', () => mobSearch.classList.remove('open'))
    document.body.appendChild(mobSearch)
  }

  // Global Ctrl+K for all roles
  initGlobalCommandBar()
}
