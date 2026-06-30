import { api } from './api.js';
import { getSocket } from './socket.js';

const NOTIF_STYLES = `
  .notif-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 360px;
    max-height: 420px;
    background: rgba(7, 11, 20, 0.97);
    backdrop-filter: blur(40px);
    border: 1px solid var(--glass-stroke, rgba(255,255,255,0.08));
    border-radius: 14px;
    box-shadow: 0 12px 48px rgba(0,0,0,0.6);
    z-index: 10000;
    display: none;
    flex-direction: column;
    overflow: hidden;
  }
  .notif-dropdown.open { display: flex; }
  .notif-dropdown-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--glass-stroke, rgba(255,255,255,0.08));
    font-family: var(--font-headline, Sora, sans-serif);
    font-size: 14px;
    font-weight: 700;
  }
  .notif-dropdown-header button {
    background: none;
    border: none;
    color: var(--hyper-purple, #a855f7);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font-mono, monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .notif-dropdown-header button:hover { opacity: 0.8; }
  .notif-dropdown-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
  }
  .notif-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.15s;
    text-decoration: none;
    color: inherit;
  }
  .notif-item:hover { background: rgba(255,255,255,0.05); }
  .notif-item img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  .notif-item-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 16px;
    background: rgba(163, 255, 18, 0.1);
    color: var(--toxic-lime, #A3FF12);
  }
  .notif-item-icon.perm { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
  .notif-item-icon.offer { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
  .notif-item-icon.recruit { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
  .notif-item-icon.response { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
  .notif-item-body {
    flex: 1;
    min-width: 0;
  }
  .notif-item-name {
    font-size: 12px;
    font-weight: 700;
    font-family: var(--font-headline, Sora, sans-serif);
  }
  .notif-item-preview {
    font-size: 12px;
    color: var(--on-surface-variant, #888);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }
  .notif-item-time {
    font-size: 10px;
    color: var(--on-surface-variant, #555);
    flex-shrink: 0;
    font-family: var(--font-mono, monospace);
  }
  .notif-dropdown-empty {
    padding: 32px 16px;
    text-align: center;
    color: var(--on-surface-variant, #666);
    font-size: 13px;
  }
  .notif-dot { display: none !important; }
  .notif-dot.active { display: block !important; animation: notif-pulse 2s ease-in-out infinite; }
  @keyframes notif-pulse {
    0%, 100% { box-shadow: 0 0 8px rgba(163,255,18,0.6); }
    50% { box-shadow: 0 0 16px rgba(163,255,18,0.9), 0 0 24px rgba(163,255,18,0.3); }
  }
  .notif-count {
    position: absolute;
    top: 0;
    right: 0;
    min-width: 16px;
    height: 16px;
    border-radius: 8px;
    background: var(--toxic-lime, #A3FF12);
    color: #04120c;
    font-size: 9px;
    font-weight: 800;
    font-family: var(--font-mono, monospace);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    box-shadow: 0 0 8px rgba(163,255,18,0.6);
    pointer-events: none;
    z-index: 3;
    line-height: 1;
  }
  .notif-dropdown-footer {
    padding: 10px 16px;
    border-top: 1px solid var(--glass-stroke, rgba(255,255,255,0.08));
    text-align: center;
    font-family: var(--font-headline, Sora, sans-serif);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    color: var(--hyper-purple, #a855f7);
  }
  .notif-dropdown-footer:hover { background: rgba(255,255,255,0.03); }
`;

(function() {
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function getIconForType(type) {
    switch (type) {
      case 'message': return { icon: '💬', cls: '' };
      case 'permission_request': return { icon: '🔍', cls: 'perm' };
      case 'team_offer': return { icon: '📋', cls: 'offer' };
      case 'recruitment_request': return { icon: '🤝', cls: 'recruit' };
      case 'permission_response': return { icon: '✅', cls: 'response' };
      case 'offer_response': return { icon: '📬', cls: 'response' };
      default: return { icon: '🔔', cls: '' };
    }
  }

  let dropdownEl = null;
  let listEl = null;
  let emptyEl = null;
  let dotEl = null;
  let countBadgeEl = null;
  let btnEl = null;
  let socket = null;
  let totalUnread = 0;

  function injectStyles() {
    if (document.getElementById('notif-styles')) return;
    const style = document.createElement('style');
    style.id = 'notif-styles';
    style.textContent = NOTIF_STYLES;
    document.head.appendChild(style);
  }

  function showCount(n) {
    if (!countBadgeEl) return;
    if (n > 0) {
      countBadgeEl.textContent = n > 9 ? '9+' : String(n);
      countBadgeEl.style.display = 'flex';
    } else {
      countBadgeEl.style.display = 'none';
    }
  }

  function updateEmptyState() {
    if (!listEl || !emptyEl) return;
    const items = listEl.querySelectorAll('.notif-item').length;
    emptyEl.style.display = items === 0 ? 'block' : 'none';
  }

  function buildDropdown() {
    dropdownEl = document.createElement('div');
    dropdownEl.className = 'notif-dropdown';
    dropdownEl.id = 'notifDropdown';
    dropdownEl.innerHTML = `
      <div class="notif-dropdown-header">
        <span>Notifications</span>
        <button id="markAllReadBtn">Mark all read</button>
      </div>
      <div class="notif-dropdown-list" id="notifList"></div>
      <div class="notif-dropdown-empty" id="notifEmpty">No notifications</div>
      <div class="notif-dropdown-footer" id="notifViewAll" style="display:none">View all</div>
    `;
    btnEl = document.querySelector('.notif-btn');
    if (btnEl) {
      btnEl.style.position = 'relative';
      btnEl.parentNode.style.position = 'relative';
      btnEl.parentNode.appendChild(dropdownEl);
      countBadgeEl = document.createElement('span');
      countBadgeEl.className = 'notif-count';
      countBadgeEl.style.display = 'none';
      btnEl.appendChild(countBadgeEl);
    }
    listEl = dropdownEl.querySelector('#notifList');
    emptyEl = dropdownEl.querySelector('#notifEmpty');
    dotEl = document.querySelector('.notif-dot');

    document.getElementById('markAllReadBtn').onclick = markAllRead;
    document.getElementById('notifViewAll').onclick = () => {
      window.location.href = 'messages.html';
    };
    dropdownEl.onclick = (e) => e.stopPropagation();
    if (btnEl) btnEl.onclick = toggleDropdown;

    document.addEventListener('click', () => {
      if (dropdownEl) dropdownEl.classList.remove('open');
    });
  }

  function toggleDropdown(e) {
    e.stopPropagation();
    if (!dropdownEl) return;
    const isOpen = dropdownEl.classList.contains('open');
    dropdownEl.classList.toggle('open', !isOpen);
  }

  function showDot(show) {
    if (dotEl) dotEl.classList.toggle('active', show);
  }

  function renderNotificationItem(item) {
    const iconInfo = getIconForType(item.type);
    const name = item.title || 'Unknown';
    const avatar = item.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
    const href = item.route ? (relativePath() + item.route) : '#';

    if (item.type === 'message') {
      return `<a class="notif-item" data-type="${item.type}" data-id="${item.id}" data-related="${item.related_id}" href="${href}">
        <img src="${avatar}" alt="" loading="lazy">
        <div class="notif-item-body">
          <div class="notif-item-name">${esc(name)}</div>
          <div class="notif-item-preview">${esc(item.message || '')}</div>
        </div>
        <span class="notif-item-time">${formatTime(item.created_at)}</span>
      </a>`;
    }

    return `<a class="notif-item" data-type="${item.type}" data-id="${item.id}" data-related="${item.related_id}" href="${href}">
      <div class="notif-item-icon ${iconInfo.cls}">${iconInfo.icon}</div>
      <div class="notif-item-body">
        <div class="notif-item-name">${esc(name)}</div>
        <div class="notif-item-preview">${esc(item.message || '')}</div>
      </div>
      <span class="notif-item-time">${formatTime(item.created_at)}</span>
    </a>`;
  }

  function renderList(items) {
    if (!listEl || !emptyEl) return;
    totalUnread = items ? items.length : 0;
    showCount(totalUnread);
    const footer = document.getElementById('notifViewAll');
    if (totalUnread === 0) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      showDot(false);
      if (footer) footer.style.display = 'none';
      return;
    }
    emptyEl.style.display = 'none';
    showDot(true);
    const display = items.slice(0, 10);
    listEl.innerHTML = display.map(item => renderNotificationItem(item)).join('');
    if (footer) footer.style.display = totalUnread > 10 ? 'block' : 'none';
  }

  function relativePath() {
    return '';
  }

  async function fetchUnread() {
    try {
      const data = await api('/notifications');
      renderList(data.notifications || []);
    } catch {
      // Fallback to conversations unread
      try {
        const data = await api('/conversations/unread');
        renderList((data.unread || []).map(m => ({
          id: 'msg_' + m.id,
          type: 'message',
          title: m.sender_name || 'Unknown',
          message: m.message || '',
          avatar: m.sender_avatar || '',
          sender_id: m.sender_id,
          related_id: m.conversation_id,
          route: '/messages.html?conv=' + m.conversation_id,
          is_read: false,
          created_at: m.created_at
        })));
      } catch {
        renderList([]);
        showCount(0);
        showDot(false);
        const footer = document.getElementById('notifViewAll');
        if (footer) footer.style.display = 'none';
      }
    }
  }

  async function markAllRead() {
    try {
      await api('/conversations/read-all', { method: 'PUT' });
      totalUnread = 0;
      renderList([]);
      showDot(false);
      const footer = document.getElementById('notifViewAll');
      if (footer) footer.style.display = 'none';
      if (dropdownEl) dropdownEl.classList.remove('open');
    } catch {}
  }

  function handleNewNotification(notif) {
    if (!listEl || !emptyEl) return;
    emptyEl.style.display = 'none';
    showDot(true);

    // Check if this notification already exists
    const existing = listEl.querySelector('[data-id="' + notif.id + '"]');
    if (existing) return;

    const el = document.createElement('div');
    el.innerHTML = renderNotificationItem(notif);
    const child = el.firstElementChild;
    if (child) {
      listEl.insertBefore(child, listEl.firstChild);
    }
    const items = listEl.querySelectorAll('.notif-item');
    if (items.length > 10) items[items.length - 1].remove();
    totalUnread++;
    showCount(totalUnread);
    const footer = document.getElementById('notifViewAll');
    if (footer) footer.style.display = totalUnread > 10 ? 'block' : 'none';
  }

  function setupSocket() {
    if (typeof io === 'undefined') return;
    try {
      socket = getSocket();
      socket.on('connect', () => { fetchUnread(); });
      socket.on('reconnect', () => { fetchUnread(); });
      socket.on('connect_error', () => {});

      // Video view count updates
      socket.on('viewUpdate', (data) => {
        const span = document.querySelector('.views-count[data-video-id="' + data.videoId + '"]');
        if (span) span.textContent = data.views;
      });

      // New message notification
      socket.on('unreadUpdate', (data) => {
        const { message, sender } = data;
        if (!message || !sender) return;
        handleNewNotification({
          id: 'msg_' + (message.id || Date.now()),
          type: 'message',
          title: sender.username || 'Unknown',
          message: message.message || (message.message_type === 'image' ? 'Sent an image' : 'Sent a voice message'),
          avatar: sender.avatar || '',
          sender_id: sender.id,
          related_id: data.conversationId || message.conversation_id,
          route: '/messages.html?conv=' + (data.conversationId || message.conversation_id),
          is_read: false,
          created_at: message.created_at || new Date().toISOString(),
        });
      });

      // Messages read
      socket.on('notification_read', (data) => {
        if (!listEl) return;
        const items = listEl.querySelectorAll('[data-type="message"][data-related="' + data.conversationId + '"]');
        const removed = items.length;
        items.forEach(el => el.remove());
        totalUnread = Math.max(0, totalUnread - removed);
        showCount(totalUnread);
        updateEmptyState();
        if (totalUnread === 0) showDot(false);
        const footer = document.getElementById('notifViewAll');
        if (footer && totalUnread <= 10) footer.style.display = 'none';
      });

      // System notifications: permission request
      socket.on('permissionRequest', (data) => {
        handleNewNotification({
          id: 'perm_' + data.id,
          type: 'permission_request',
          title: data.scout_name || 'A scout',
          message: 'wants permission to recruit you',
          avatar: data.scout_avatar || '',
          related_id: data.id,
          route: '/pages/player/dashboard.html',
          is_read: false,
          created_at: new Date().toISOString(),
        });
      });

      // System notification: permission response
      socket.on('permissionResponse', (data) => {
        handleNewNotification({
          id: 'perm_resp_' + data.id,
          type: 'permission_response',
          title: data.player_username || 'A player',
          message: data.status === 'approved' ? 'approved your recruitment request' : (data.status === 'declined' ? 'declined your recruitment request' : 'response: ' + data.status),
          avatar: data.player_avatar || '',
          related_id: data.id,
          route: '/pages/scout/dashboard.html',
          is_read: false,
          created_at: new Date().toISOString(),
        });
      });

      // System notification: team offer
      socket.on('teamOffer', (data) => {
        handleNewNotification({
          id: 'offer_' + data.id,
          type: 'team_offer',
          title: (data.scout_name || 'A scout') + ' offered you a spot',
          message: 'Join ' + (data.team_name || 'a team') + ' as ' + (data.role || 'player'),
          avatar: data.scout_avatar || '',
          related_id: data.id,
          route: '/pages/player/dashboard.html',
          is_read: false,
          created_at: new Date().toISOString(),
        });
      });

      // System notification: offer response
      socket.on('offerResponse', (data) => {
        handleNewNotification({
          id: 'offer_resp_' + data.id,
          type: 'offer_response',
          title: data.player_username || 'A player',
          message: data.status === 'accepted' ? 'accepted your offer' : (data.status === 'declined' ? 'declined your offer' : 'response: ' + data.status),
          avatar: data.player_avatar || '',
          related_id: data.id,
          route: '/pages/scout/dashboard.html',
          is_read: false,
          created_at: new Date().toISOString(),
        });
      });

      // System notification: recruitment request
      socket.on('recruitmentRequest', (data) => {
        handleNewNotification({
          id: 'recruit_' + data.id,
          type: 'recruitment_request',
          title: (data.scout_name || 'A scout') + ' invited you to ' + (data.team_name || 'a team'),
          message: data.message || 'Join their team!',
          avatar: data.scout_avatar || '',
          related_id: data.id,
          route: '/pages/player/dashboard.html',
          is_read: false,
          created_at: new Date().toISOString(),
        });
      });

      // Catch-all for notification badge refresh
      socket.on('notification_created', () => { fetchUnread(); });

      // General system notification (for other events)
      socket.on('systemNotification', (data) => {
        handleNewNotification({
          id: 'sys_' + (data.id || Date.now()),
          type: data.type || 'system',
          title: data.title || 'System',
          message: data.message || '',
          avatar: data.avatar || '',
          related_id: data.related_id || null,
          route: data.route || null,
          is_read: false,
          created_at: new Date().toISOString(),
        });
      });

    } catch {}
  }

  injectStyles();
  buildDropdown();

  // Wait for DOM to be ready before fetching
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      fetchUnread();
      setupSocket();
    });
  } else {
    fetchUnread();
    setupSocket();
  }
})();
