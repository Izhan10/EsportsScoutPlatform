import { api, getFeed, API_URL } from '../services/api.js';

export class EsportsFeed {
  constructor(container, options = {}) {
    this.container = container;
    this.mode = options.mode || 'player';
    this.filters = options.filters || {};
    this.videos = [];
    this.activeIndex = 0;
    this.panel = null;
    this.observer = null;
    this.defaultVolume = this.loadDefaultVolume();
    this.volumeToast = null;
    this.volumeToastTimer = null;
    this.longPressTimers = new WeakMap();
  }

  escHtml(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  async init() {
    this.container.innerHTML = `
      <div class="feed-top-bar">
        <div class="feed-categories" id="feedCategories">
          <button class="category-pill active" data-game="">All Games</button>
          <button class="category-pill" data-game="Valorant">Valorant</button>
          <button class="category-pill" data-game="PUBG Mobile">PUBG</button>
          <button class="category-pill" data-game="Tekken 8">Tekken</button>
        </div>
        <div class="feed-sort-bar">
          <select id="feedSort" class="feed-sort-select">
            <option value="recent">Recent</option>
            <option value="trending">Trending</option>
          </select>
        </div>
      </div>
      <div class="feed-viewport" id="feedViewport">
        <div class="feed-track" id="feedTrack"></div>
      </div>
      <div class="vol-toast" id="volToast" aria-hidden="true"></div>
      <div class="esv-panel" id="esvPanel" aria-hidden="true">
        <div class="esv-panel-handle" title="Close">✕</div>
        <div class="esv-panel-content" id="esvPanelContent"></div>
      </div>
    `;
    this.track = this.container.querySelector('#feedTrack');
    this.viewport = this.container.querySelector('#feedViewport');
    this.panel = this.container.querySelector('#esvPanel');
    this.panelContent = this.container.querySelector('#esvPanelContent');
    this.volumeToast = this.container.querySelector('#volToast');
    this.sortSelect = this.container.querySelector('#feedSort');

    this.panel.querySelector('.esv-panel-handle').addEventListener('click', () => this.closePanel());
    this.panel.addEventListener('click', (e) => {
      if (e.target === this.panel) this.closePanel();
    });
    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', (e) => {
        this.sortSelect.blur();
        this.setFilters({ sort: e.target.value });
      });
      this.sortSelect.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.stopPropagation();
        }
      });
    }

    this.categoryBtns = this.container.querySelectorAll('.category-pill');
    if (this.categoryBtns) {
      this.categoryBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.categoryBtns.forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          this.setFilters({ game: e.target.dataset.game });
        });
      });
    }

    await this.loadVideos();
  }

  loadDefaultVolume() {
    const stored = localStorage.getItem('feedVolume');
    if (stored !== null) {
      const v = parseFloat(stored);
      return isNaN(v) ? 0.75 : Math.max(0, Math.min(1, v));
    }
    return 0.75;
  }

  saveDefaultVolume() {
    localStorage.setItem('feedVolume', String(this.defaultVolume));
  }

  volumeIcon(muted, vol) {
    if (muted || vol === 0) return '🔇';
    if (vol < 0.5) return '🔉';
    return '🔊';
  }

  playVideoSafely(video) {
    if (!video) return;
    const card = video.closest('.feed-card');
    const isActive = card && parseInt(card.dataset.index, 10) === this.activeIndex;
    if (isActive) {
      video.volume = this.defaultVolume;
      video.muted = false;
    } else {
      video.muted = true;
    }
    const tryPlay = () => {
      video.play().catch(() => {});
    };
    if (video.readyState >= 2) {
      tryPlay();
    } else {
      video.addEventListener('canplay', tryPlay, { once: true });
      setTimeout(() => { if (video.paused) tryPlay(); }, 3000);
    }
  }

  showVolumeToast(pct) {
    if (!this.volumeToast) return;
    this.volumeToast.textContent = `Volume ${pct}%`;
    this.volumeToast.setAttribute('aria-hidden', 'false');
    clearTimeout(this.volumeToastTimer);
    this.volumeToastTimer = setTimeout(() => {
      if (this.volumeToast) {
        this.volumeToast.setAttribute('aria-hidden', 'true');
      }
    }, 1000);
  }

  async loadVideos(extraParams = {}) {
    const params = { ...this.filters, ...extraParams };
    this.videos = await getFeed(params);
    this.activeIndex = 0;
    this.viewport.scrollTop = 0;
    this.render();
    if (this.observer) this.observer.disconnect();
    this.setupSnapObserver();
    this.playActiveVideo();
  }

  render() {
    if (!this.videos.length) {
      this.track.innerHTML = `<div class="feed-empty"><h3>No clips yet</h3><p>Upload your first gameplay clip to appear in the global feed.</p></div>`;
      return;
    }

    this.track.innerHTML = this.videos
      .map((v, i) => this.renderCard(v, i))
      .join('');

    this.bindCardEvents();
  }

  videoSrc(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
  }

  combinedScore(v) {
    const esv = v.esvScore ?? 0;
    const skill = v.gameSkill?.skillScore;
    if (skill != null) return Math.round((esv + skill) / 2);
    return esv;
  }

  renderCard(v, index) {
    const eh = (s) => this.escHtml(s);
    const scoutExtras =
      this.mode === 'scout'
        ? `
        <div class="scout-overlay">
          <button class="scout-btn" data-action="shortlist" data-player="${v.userId}" data-shortlisted="${v.shortlisted}">
            ${v.shortlisted ? '★ Shortlisted' : '☆ Shortlist'}
          </button>
          <button class="scout-btn" data-action="report" data-player="${v.userId}">📄 Report</button>
          <button class="scout-btn" data-action="compare" data-player="${v.userId}">⚖ Compare</button>
        </div>
        <div class="scout-hover-stats">
          <span>K/D profile</span>
          <span>${eh(v.city) || 'PK'}</span>
          <span>ESV ${v.esvScore}</span>
        </div>`
        : '';

    const volIcon = this.volumeIcon(false, this.defaultVolume);
    const autoplayAttr = index === 0 ? 'autoplay' : '';
    const preloadAttr = index === 0 ? 'auto' : 'metadata';
    const profileLink = `../../pages/player/public-profile.html?id=${v.userId}`;
    return `
      <section class="feed-card" data-index="${index}" data-id="${v.id}">
        <video class="feed-video" src="${this.videoSrc(v.videoUrl)}" playsinline loop ${autoplayAttr} preload="${preloadAttr}"></video>
        <div class="feed-play-overlay" data-action="toggleplay" data-index="${index}">
          <span class="play-icon">▶</span>
        </div>
        <div class="speaker-corner">
          <button class="speaker-btn" title="Volume">${volIcon}</button>
          <div class="vol-slider-shell">
            <input type="range" class="vol-slider" min="0" max="1" step="0.05" value="${this.defaultVolume}">
          </div>
        </div>
        <div class="feed-gradient"></div>
        <div class="feed-meta">
          <a href="${profileLink}" class="feed-avatar-link"><img class="feed-avatar" src="${eh(v.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(v.username))}" alt=""></a>
          <div>
            <a href="${profileLink}" style="color:inherit;text-decoration:none;"><h4>@${eh(v.username)}</h4></a>
            <p class="feed-game">${eh(v.gameTitle)} · ${eh(v.rank) || 'Unranked'}</p>
            <p class="feed-caption">${eh(v.caption)}</p>
            <p class="feed-stats"><span class="views-count" data-video-id="${v.id}">${v.views}</span> views · ${this.timeAgo(v.uploadedAt)}</p>
          </div>
        </div>
        <div class="feed-actions">
          <button class="action-btn ${v.liked ? 'active' : ''}" data-action="like" data-id="${v.id}" title="Like">❤<span>${v.likes}</span></button>
          <button class="action-btn ${v.saved ? 'active' : ''}" data-action="save" data-id="${v.id}" title="Save"><span class="material-symbols-outlined">bookmark</span></button>
          <button class="action-btn ${v.following ? 'active' : ''}" data-action="follow" data-id="${v.id}" title="Follow">＋</button>
          ${this.mode === 'player' ? `<button class="action-btn" data-action="share" data-id="${v.id}" title="Share">↗</button>` : ''}
        </div>
        <div class="score-capsules">
          <button class="esv-capsule" data-action="analysis" data-index="${index}" data-score="${this.combinedScore(v)}">
            <span class="fire-emoji">🔥</span>
            <span class="esv-label">Rating</span>
            <span class="esv-score">
              <span class="score-number">${this.combinedScore(v)}</span>
              <span class="score-total">/100</span>
            </span>
          </button>
        </div>
        ${scoutExtras}
      </section>`;
  }

  bindCardEvents() {
    this.track.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => this.handleAction(e.currentTarget));
    });

    this.track.querySelectorAll('[data-action="toggleplay"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const card = e.currentTarget.closest('.feed-card');
        const video = card?.querySelector('video');
        if (!video) return;
        if (video.paused) video.play().catch(() => {});
        else video.pause();
      });
    });

    this.track.querySelectorAll('.feed-video').forEach((video) => {
      video.addEventListener('click', () => {
        if (video.paused) video.play().catch(() => {});
        else video.pause();
      });
      video.addEventListener('play', () => {
        const overlay = video.parentElement?.querySelector('.feed-play-overlay');
        if (overlay) overlay.classList.add('playing');
      });
      video.addEventListener('pause', () => {
        const overlay = video.parentElement?.querySelector('.feed-play-overlay');
        if (overlay) overlay.classList.remove('playing');
      });
    });

    this.track.querySelectorAll('.speaker-corner').forEach((corner) => {
      const btn = corner.querySelector('.speaker-btn');
      const card = corner.closest('.feed-card');
      const shell = card?.querySelector('.vol-slider-shell');
      const slider = shell?.querySelector('.vol-slider');
      let closeTimer = null;

      const cancelCloseTimer = () => {
        if (closeTimer) {
          clearTimeout(closeTimer);
          closeTimer = null;
        }
      };

      const cancelLongPress = () => {
        const timer = this.longPressTimers.get(btn);
        if (timer) {
          clearTimeout(timer);
          this.longPressTimers.delete(btn);
        }
      };

      const toggleMute = () => {
        const video = card?.querySelector('video');
        if (!video) return;
        const wasMuted = video.muted;
        video.muted = !wasMuted;
        if (video.muted) {
          btn.textContent = this.volumeIcon(true, this.defaultVolume);
        } else {
          video.volume = this.defaultVolume;
          btn.textContent = this.volumeIcon(false, this.defaultVolume);
          if (video.paused) video.play().catch(() => {});
        }
      };

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (shell?.classList.contains('open')) {
          shell.classList.remove('open');
        }
        toggleMute();
      });

      corner.addEventListener('mouseenter', () => {
        cancelCloseTimer();
        if (shell) shell.classList.add('open');
      });

      corner.addEventListener('mouseleave', () => {
        if (slider && slider.matches(':active')) return;
        closeTimer = setTimeout(() => {
          if (shell) shell.classList.remove('open');
        }, 200);
      });

      if (shell) {
        shell.addEventListener('mouseenter', cancelCloseTimer);
      }

      const startLongPress = (e) => {
        cancelLongPress();
        const timer = setTimeout(() => {
          if (shell) {
            shell.classList.add('open');
            if (slider) slider.focus({ preventScroll: true });
          }
        }, 500);
        this.longPressTimers.set(btn, timer);
      };

      btn.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        startLongPress(e);
      });
      btn.addEventListener('mouseup', cancelLongPress);
      btn.addEventListener('mouseleave', cancelLongPress);

      btn.addEventListener('touchstart', (e) => {
        startLongPress(e);
      }, { passive: true });
      btn.addEventListener('touchend', cancelLongPress);
      btn.addEventListener('touchcancel', cancelLongPress);
    });

    const closeAllSliders = () => {
      this.track.querySelectorAll('.vol-slider-shell.open').forEach((s) => {
        s.classList.remove('open');
      });
    };
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
    }
    this._docClickHandler = () => closeAllSliders();
    document.addEventListener('click', this._docClickHandler);

    this.track.querySelectorAll('.vol-slider-shell').forEach((shell) => {
      shell.addEventListener('click', (e) => e.stopPropagation());
    });

    this.track.querySelectorAll('.vol-slider').forEach((slider) => {
      const updateVol = () => {
        const card = slider.closest('.feed-card');
        const video = card?.querySelector('video');
        const btn = card?.querySelector('.speaker-btn');
        if (!video || !btn) return;
        const val = parseFloat(slider.value);
        this.defaultVolume = val;
        video.volume = val;
        if (val === 0) {
          video.muted = true;
        } else {
          video.muted = false;
        }
        btn.textContent = this.volumeIcon(video.muted, val);
        this.saveDefaultVolume();
        this.showVolumeToast(Math.round(val * 100));
      };
      slider.addEventListener('input', updateVol);
      slider.addEventListener('change', updateVol);
      slider.addEventListener('click', (e) => e.stopPropagation());

      slider.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      slider.addEventListener('touchstart', (e) => {
        e.stopPropagation();
      }, { passive: true });

      const closeSelf = () => {
        const shell = slider.closest('.vol-slider-shell');
        if (shell) shell.classList.remove('open');
      };
      slider.addEventListener('mouseup', closeSelf);
      slider.addEventListener('touchend', closeSelf);
    });
  }

  async handleAction(btn) {
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const index = parseInt(btn.dataset.index, 10);

    if (action === 'analysis') {
      this.openAnalysis(this.videos[index]);
      return;
    }
    if (action === 'like') {
      try {
        const res = await api(`/videos/${id}/like`, { method: 'POST' });
        btn.classList.toggle('active', res.liked);
      } catch {
        btn.classList.toggle('active');
      }
      return;
    }
    if (action === 'save') {
      try {
        const res = await api(`/videos/${id}/save`, { method: 'POST' });
        btn.classList.toggle('active', res.saved);
      } catch {
        btn.classList.toggle('active');
      }
      return;
    }
    if (action === 'follow') {
      try {
        const res = await api(`/videos/${id}/follow`, { method: 'POST' });
        btn.classList.toggle('active', res.following);
      } catch {
        btn.classList.toggle('active');
      }
      return;
    }
    if (action === 'shortlist') {
      const playerId = btn.dataset.player;
      try {
        if (btn.dataset.shortlisted === 'true') {
          await api(`/scout/shortlist/${playerId}`, { method: 'DELETE' });
          btn.dataset.shortlisted = 'false';
          btn.textContent = '☆ Shortlist';
        } else {
          await api(`/scout/shortlist/${playerId}`, { method: 'POST' });
          btn.dataset.shortlisted = 'true';
          btn.textContent = '★ Shortlisted';
        }
      } catch {
        btn.classList.toggle('active');
      }
      return;
    }
    if (action === 'report') {
      try {
        const report = await api(`/scout/report/${btn.dataset.player}`);
        alert(`Scouting report for ${report.player.username}\nESV: ${report.player.esv_score}\nClips: ${report.clips.length}`);
      } catch {
        alert('Report generation unavailable');
      }
      return;
    }
    if (action === 'compare') {
      alert('Comparison available via Search Players tab');
    }
  }

  openAnalysis(video) {
    const a = video.analysis || {};
    const gs = video.gameSkill || {};
    const eh = (s) => this.escHtml(s);
    const recs = (a.recommendations || []).map((r) => `<li>${eh(r)}</li>`).join('');

    let skillHtml = '';
    if (gs.skillScore && gs.metrics) {
      const m = gs.metrics;
      const metricNames = this.getMetricLabels(video.gameTitle, m);
      skillHtml = `
        <h4>Game-Specific Skill — ${eh(gs.game || video.gameTitle)}</h4>
        <div class="score-grid">
          ${metricNames.map(({ label, value }) => `
            <div class="score-item"><span>${eh(label)}</span><strong>${value ?? '—'}</strong></div>
          `).join('')}
        </div>
        <p class="esv-note">Confidence: ${Math.round((gs.confidence || 0) * 100)}% · Source: CV analysis</p>
      `;
    }

    this.panelContent.innerHTML = `
      <h3><span class="panel-title-icon">🔥</span> AI Clip Analysis</h3>
      <p class="esv-big" data-score="${this.combinedScore(video)}"><span class="big-score-label">Rating</span> <span class="big-score-value">${this.combinedScore(video)}</span> <span class="big-score-total">/100</span></p>
      <div class="score-grid">
        <div class="score-item"><span>Authenticity</span><strong>${a.aim ?? '—'}</strong></div>
        <div class="score-item"><span>Action</span><strong>${a.positioning ?? '—'}</strong></div>
        <div class="score-item"><span>Clarity</span><strong>${a.teamplay ?? '—'}</strong></div>
        <div class="score-item"><span>Crosshair</span><strong>${a.consistency ?? '—'}</strong></div>
        <div class="score-item"><span>Quality</span><strong>${a.decisionMaking ?? '—'}</strong></div>
      </div>
      ${skillHtml}
      <p class="esv-summary">${eh(a.summary || video.aiFeedback) || 'Analysis pending...'}</p>
      <h4>Suggested improvements</h4>
      <ul class="esv-recs">${recs || '<li>Keep uploading clips for richer AI feedback</li>'}</ul>
    `;
    this.panel.classList.add('open');
    this.panel.setAttribute('aria-hidden', 'false');
  }

  getMetricLabels(gameTitle, metrics) {
    if (!metrics) return [];
    if (gameTitle === 'Valorant') {
      return [
        { label: 'Crosshair Smoothness', value: metrics.crosshairSmoothness },
        { label: 'Kill Activity', value: metrics.killActivity },
        { label: 'Crosshair Placement', value: metrics.crosshairPlacement },
        { label: 'Ability Usage', value: metrics.abilityUsage },
        { label: 'Game Knowledge', value: metrics.gameKnowledge },
      ];
    }
    if (gameTitle === 'PUBG Mobile') {
      return [
        { label: 'Combat Activity', value: metrics.combatActivity },
        { label: 'Survival Awareness', value: metrics.survivalAwareness },
        { label: 'Weapon Handling', value: metrics.weaponHandling },
        { label: 'Movement Quality', value: metrics.movementQuality },
      ];
    }
    if (gameTitle === 'Tekken 8') {
      return [
        { label: 'Combo Execution', value: metrics.comboExecution },
        { label: 'Defense', value: metrics.defense },
        { label: 'Damage Output', value: metrics.damageOutput },
        { label: 'Match Pacing', value: metrics.matchPacing },
      ];
    }
    return Object.entries(metrics).map(([k, v]) => ({ label: k, value: v }));
  }

  closePanel() {
    this.panel.classList.remove('open');
    this.panel.setAttribute('aria-hidden', 'true');
  }

  setupSnapObserver() {
    const cards = () => this.track.querySelectorAll('.feed-card');
    if (this.observer) this.observer.disconnect();

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target.querySelector('video');
          if (!video) return;
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            this.activeIndex = parseInt(entry.target.dataset.index, 10);
            this.playVideoSafely(video);
            const vid = this.videos[this.activeIndex];
            if (vid) api(`/videos/${vid.id}/view`, { method: 'POST' }).catch(() => {});
          } else {
            video.pause();
            video.muted = true;
          }
        });
      },
      { root: this.viewport, threshold: [0.6] }
    );

    cards().forEach((c) => this.observer.observe(c));
  }

  playActiveVideo() {
    requestAnimationFrame(() => {
      const card = this.track.querySelector(`[data-index="${this.activeIndex}"]`);
      const video = card?.querySelector('video');
      this.playVideoSafely(video);
    });
  }

  timeAgo(dateStr) {
    if (!dateStr) return 'just now';
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  setFilters(filters) {
    this.filters = { ...this.filters, ...filters };
    return this.loadVideos();
  }
}
