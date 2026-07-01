import { api, API_URL } from './api.js';

const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

export function renderMessageHTML(msg, myId) {
  const isSelf = msg.sender_id === myId;
  const time = formatTime(msg.created_at);
  const msgType = msg.message_type || 'text';

  let content = '';
  if (msgType === 'image' && msg.attachment_url) {
    content = `
      <div class="msg ${isSelf ? 'self' : ''}" data-msg-id="${msg.id}">
        <img class="msg-image" src="${esc(msg.attachment_url)}" alt="Shared image" loading="lazy" onclick="openLightbox('${esc(msg.attachment_url)}')">
        <div class="msg-time">${time}</div>
      </div>`;
  } else if (msgType === 'voice' && msg.attachment_url) {
    const wf = msg.waveform || '';
    content = `
      <div class="msg ${isSelf ? 'self' : ''} voice-msg" data-msg-id="${msg.id}">
        <div class="voice-player" data-src="${esc(msg.attachment_url)}" data-waveform="${esc(wf)}">
          <button class="voice-play-btn" aria-label="Play">
            <span class="material-symbols-outlined">play_arrow</span>
          </button>
          <canvas class="voice-waveform" width="120" height="32"></canvas>
          <span class="voice-duration">0:00</span>
        </div>
        <div class="msg-time">${time}</div>
      </div>`;
  } else if (msgType === 'permission_request') {
    const pData = (() => { try { return JSON.parse(msg.message || '{}'); } catch { return {}; } })();
    const pStatus = pData.status || 'pending';
    if (pStatus === 'pending') {
      content = `
        <div class="msg system-msg permission-card" data-perm-id="${esc(pData.permissionId || '')}">
          <div class="perm-card">
            <span class="material-symbols-outlined perm-icon">policy</span>
            <div class="perm-text">
              <strong>Recruiting Permission Requested</strong>
              ${isSelf ? '<p>Waiting for player response...</p>' : '<p>A scout wants permission to recruit you.</p>'}
            </div>
            <span class="perm-badge pending">Pending</span>
          </div>
          ${!isSelf ? `
          <div class="perm-actions">
            <button class="allow-btn" data-perm-id="${esc(pData.permissionId || '')}" onclick="handlePermAction(${esc(pData.permissionId || '')}, 'approve')">Allow</button>
            <button class="decline-btn" data-perm-id="${esc(pData.permissionId || '')}" onclick="handlePermAction(${esc(pData.permissionId || '')}, 'decline')">Decline</button>
          </div>` : ''}
          <div class="msg-time">${time}</div>
        </div>`;
    } else {
      const statusLabel = pStatus.charAt(0).toUpperCase() + pStatus.slice(1);
      const statusIcon = pStatus === 'approved' ? 'check_circle' : pStatus === 'declined' ? 'cancel' : 'remove_circle';
      content = `
        <div class="msg system-msg permission-card">
          <div class="perm-card">
            <span class="material-symbols-outlined perm-icon">${statusIcon}</span>
            <div class="perm-text">
              <strong>Permission ${statusLabel}</strong>
              <p>${isSelf ? 'You' : 'The player'} ${pStatus === 'approved' ? 'approved' : pStatus === 'declined' ? 'declined' : 'revoked'} the recruiting permission.</p>
            </div>
            <span class="perm-badge ${pStatus}">${statusLabel}</span>
          </div>
          <div class="msg-time">${time}</div>
        </div>`;
    }
  } else if (msgType === 'team_offer') {
    const offer = (() => { try { return JSON.parse(msg.message || '{}'); } catch { return {}; } })();
    const oStatus = offer.status || 'pending';
    content = `
      <div class="msg system-msg offer-card" data-offer-id="${esc(offer.id || '')}">
        <div class="offer-card-inner">
          <div class="offer-header">
            <span class="material-symbols-outlined offer-icon">handshake</span>
            <strong>Team Offer</strong>
            <span class="offer-badge ${oStatus}">${esc(oStatus.charAt(0).toUpperCase() + oStatus.slice(1))}</span>
          </div>
          <div class="offer-details">
            <div class="offer-row"><span>Team</span><strong>${esc(offer.team_name || '—')}</strong></div>
            <div class="offer-row"><span>Role</span><strong>${esc(offer.role || '—')}</strong></div>
            ${offer.tournament_focus ? `<div class="offer-row"><span>Tournament Focus</span><strong>${esc(offer.tournament_focus)}</strong></div>` : ''}
            ${offer.contract_duration ? `<div class="offer-row"><span>Contract</span><strong>${esc(offer.contract_duration)}</strong></div>` : ''}
            ${offer.prize_share ? `<div class="offer-row"><span>Prize Share</span><strong>${esc(offer.prize_share)}%</strong></div>` : ''}
            ${offer.notes ? `<div class="offer-row notes"><span>Notes</span><p>${esc(offer.notes)}</p></div>` : ''}
          </div>
          ${!isSelf && oStatus === 'pending' ? `
          <div class="offer-actions">
            <button class="accept-btn" data-offer-id="${esc(offer.id || '')}" onclick="handleOfferAction(${esc(offer.id || '')}, 'accept')">Accept</button>
            <button class="decline-offer-btn" data-offer-id="${esc(offer.id || '')}" onclick="handleOfferAction(${esc(offer.id || '')}, 'decline')">Decline</button>
          </div>` : ''}
        </div>
        <div class="msg-time">${time}</div>
      </div>`;
  } else if (msgType === 'offer_change') {
    const oc = (() => { try { return JSON.parse(msg.message || '{}'); } catch { return {}; } })();
    const action = oc.action || 'updated';
    content = `
      <div class="msg system-msg">
        <div class="system-text">
          <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;margin-right:4px;">info</span>
          Offer ${esc(action)} — ${esc(oc.detail || '')}
        </div>
        <div class="msg-time">${time}</div>
      </div>`;
  } else {
    const txt = esc(msg.message || '');
    content = `
      <div class="msg ${isSelf ? 'self' : ''}">${txt}<div class="msg-time">${time}</div></div>`;
  }
  return content;
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

export function formatMessagePreview(msg) {
  const type = msg.messageType || msg.message_type || 'text';
  if (type === 'image') return '📷 Image';
  if (type === 'voice') return '🎤 Voice message';
  return msg.text || msg.message || '';
}

export function initVoicePlayers(container, waveformColor) {
  if (!waveformColor) {
    const isScout = document.body.classList.contains('shell-scout');
    waveformColor = isScout ? '#A855F7' : '#a3ff12';
  }
  container.querySelectorAll('.voice-player').forEach(el => {
    if (el.dataset.initialized) return;
    el.dataset.initialized = '1';
    const btn = el.querySelector('.voice-play-btn');
    const canvas = el.querySelector('.voice-waveform');
    const durSpan = el.querySelector('.voice-duration');
    const src = el.dataset.src;
    const wfData = el.dataset.waveform;

    if (wfData) {
      try {
        const amplitudes = JSON.parse(wfData);
        drawWaveform(canvas, amplitudes, waveformColor, false);
      } catch {}
    }

    let audio = null;
    let isPlaying = false;

    btn.onclick = async () => {
      if (!audio) {
        audio = new Audio(src);
        audio.onloadedmetadata = () => {
          const min = Math.floor(audio.duration / 60);
          const sec = Math.floor(audio.duration % 60);
          durSpan.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
        };
        audio.onended = () => {
          isPlaying = false;
          btn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
        };
        audio.onplay = () => {
          isPlaying = true;
          btn.innerHTML = '<span class="material-symbols-outlined">pause</span>';
        };
        audio.onpause = () => {
          isPlaying = false;
          btn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
        };
      }
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(() => {});
      }
    };
  });
}

function drawWaveform(canvas, amplitudes, color, active) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!amplitudes || amplitudes.length === 0) return;
  const step = w / amplitudes.length;
  ctx.strokeStyle = active ? '#fff' : color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < amplitudes.length; i++) {
    const x = i * step;
    const amp = Math.max(1, Math.abs(amplitudes[i] || 0) * h * 0.8);
    const y = (h - amp) / 2;
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + amp);
  }
  ctx.stroke();
}

export async function generateWaveformData(audioBlob) {
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const rawData = audioBuffer.getChannelData(0);
    const samples = 60;
    const blockSize = Math.floor(rawData.length / samples);
    const amplitudes = [];
    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[(i * blockSize) + j] || 0);
      }
      amplitudes.push(sum / blockSize);
    }
    audioCtx.close();
    return amplitudes;
  } catch {
    return [];
  }
}

export function setupImageAttach(config) {
  const { chatForm } = config;
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';

  const attachBtn = document.createElement('button');
  attachBtn.type = 'button';
  attachBtn.className = 'chat-attach-btn';
  attachBtn.setAttribute('aria-label', 'Attach image');
  attachBtn.innerHTML = '<span class="material-symbols-outlined">image</span>';

  const sendBtn = chatForm.querySelector('.chat-send-btn');
  chatForm.insertBefore(attachBtn, sendBtn);
  chatForm.insertBefore(fileInput, sendBtn);

  attachBtn.onclick = () => fileInput.click();

  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    fileInput.value = '';

    const convId = config.getActiveConvId();
    if (!convId) return;

    attachBtn.disabled = true;
    attachBtn.innerHTML = '<span class="material-symbols-outlined" style="animation:spin 1s linear infinite">sync</span>';

    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch(`${API_URL}/conversations/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.url) throw new Error('Upload failed');

      const msg = { conversationId: convId, senderId: config.getMyId(), message: '', messageType: 'image', attachmentUrl: uploadData.url };
      config.appendMessage(msg);
      if (config.getSocket()) {
        config.getSocket().emit('chatMessage', msg);
      } else {
        await api(`/conversations/${convId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ message: '', messageType: 'image', attachmentUrl: uploadData.url }),
        });
      }
      if (config.onMessageSent) config.onMessageSent();
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      attachBtn.disabled = false;
      attachBtn.innerHTML = '<span class="material-symbols-outlined">image</span>';
    }
  };

  config.cleanupFns = config.cleanupFns || [];
  config.cleanupFns.push(() => { fileInput.remove(); attachBtn.remove(); });
}

export function setupVoiceRecorder(config) {
  const { chatForm } = config;
  let mediaRecorder = null;
  let audioChunks = [];
  let recording = false;
  let recordingTimer = null;
  let recordingSeconds = 0;
  let recordedBlob = null;
  let recordedUrl = null;
  let previewAudio = null;

  const micBtn = document.createElement('button');
  micBtn.type = 'button';
  micBtn.className = 'chat-mic-btn';
  micBtn.setAttribute('aria-label', 'Record voice message');
  micBtn.innerHTML = '<span class="material-symbols-outlined">mic</span>';

  const sendBtn = chatForm.querySelector('.chat-send-btn');
  const attachBtn = chatForm.querySelector('.chat-attach-btn');
  if (attachBtn) {
    chatForm.insertBefore(micBtn, attachBtn.nextSibling);
  } else {
    chatForm.insertBefore(micBtn, sendBtn);
  }

  const chatFormWrap = chatForm.closest('.chat-form-wrap') || chatForm.parentElement;

  /* Phase 1 — Recording bar: [🔴][timer][❌][⏹] */
  const recordingBar = document.createElement('div');
  recordingBar.className = 'voice-recording-bar';
  recordingBar.style.display = 'none';
  recordingBar.innerHTML = `
    <span class="recording-dot"></span>
    <span class="recording-timer">0:00</span>
    <div class="recording-actions">
      <button type="button" class="recording-cancel-btn" aria-label="Cancel recording">
        <span class="material-symbols-outlined">close</span>
      </button>
      <button type="button" class="recording-stop-btn" aria-label="Stop recording">
        <span class="material-symbols-outlined">stop</span>
      </button>
    </div>
  `;

  /* Phase 2 — Preview bar: [▶️][waveform][timer][❌][➡️] */
  const previewBar = document.createElement('div');
  previewBar.className = 'voice-preview-bar';
  previewBar.style.display = 'none';
  previewBar.innerHTML = `
    <button type="button" class="preview-play-btn" aria-label="Play recording">
      <span class="material-symbols-outlined">play_arrow</span>
    </button>
    <canvas class="preview-waveform" width="120" height="32"></canvas>
    <span class="preview-timer">0:00</span>
    <div class="preview-actions">
      <button type="button" class="preview-cancel-btn" aria-label="Discard recording">
        <span class="material-symbols-outlined">close</span>
      </button>
      <button type="button" class="preview-send-btn" aria-label="Send recording">
        <span class="material-symbols-outlined">arrow_upward</span>
      </button>
    </div>
  `;

  chatFormWrap.insertBefore(recordingBar, chatForm);
  chatFormWrap.insertBefore(previewBar, chatForm);
  chatForm.style.display = '';

  const timerEl = recordingBar.querySelector('.recording-timer');
  const cancelBtn = recordingBar.querySelector('.recording-cancel-btn');
  const stopBtn = recordingBar.querySelector('.recording-stop-btn');

  const previewPlayBtn = previewBar.querySelector('.preview-play-btn');
  const previewCancelBtn = previewBar.querySelector('.preview-cancel-btn');
  const previewSendBtn = previewBar.querySelector('.preview-send-btn');
  const previewTimer = previewBar.querySelector('.preview-timer');
  const previewCanvas = previewBar.querySelector('.preview-waveform');

  /* ── Phase 1: Recording ── */
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg;codecs=opus';
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunks = [];
      mediaRecorder.streamRef = stream;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        if (mediaRecorder.streamRef) {
          mediaRecorder.streamRef.getTracks().forEach(t => t.stop());
        }
      };

      mediaRecorder.start();
      recording = true;
      recordingSeconds = 0;
      chatForm.style.display = 'none';
      recordingBar.style.display = 'flex';

      recordingTimer = setInterval(() => {
        recordingSeconds++;
        const m = Math.floor(recordingSeconds / 60);
        const s = recordingSeconds % 60;
        timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      }, 1000);

    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  }

  function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = () => {
        if (mediaRecorder.streamRef) {
          mediaRecorder.streamRef.getTracks().forEach(t => t.stop());
        }
      };
      mediaRecorder.stop();
    } else if (mediaRecorder && mediaRecorder.streamRef) {
      mediaRecorder.streamRef.getTracks().forEach(t => t.stop());
    }
    cleanupRecording();
  }

  function cleanupRecording() {
    recording = false;
    clearInterval(recordingTimer);
    recordingTimer = null;
    chatForm.style.display = '';
    recordingBar.style.display = 'none';
    timerEl.textContent = '0:00';
    audioChunks = [];
  }

  /* ── Stop recording → Phase 2 preview ── */
  function stopAndPreview() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      clearInterval(recordingTimer);
      recordingTimer = null;
      mediaRecorder.onstop = () => {
        if (mediaRecorder.streamRef) {
          mediaRecorder.streamRef.getTracks().forEach(t => t.stop());
        }
        showPreview();
      };
      mediaRecorder.stop();
    }
  }

  async function showPreview() {
    if (!audioChunks.length) return;
    recordedBlob = new Blob(audioChunks, { type: 'audio/webm' });
    recordedUrl = URL.createObjectURL(recordedBlob);

    recordingBar.style.display = 'none';
    previewBar.style.display = 'flex';

    const m = Math.floor(recordingSeconds / 60);
    const s = recordingSeconds % 60;
    previewTimer.textContent = `${m}:${s.toString().padStart(2, '0')}`;

    try {
      const amplitudes = await generateWaveformData(recordedBlob);
      const ctx = previewCanvas.getContext('2d');
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      const isScout = document.body.classList.contains('shell-scout');
      const waveformColor = isScout ? '#a855f7' : '#84cc16';
      drawWaveform(previewCanvas, amplitudes, waveformColor, false);
    } catch (e) {
      /* waveform drawing optional */
    }
  }

  /* ── Preview playback ── */
  previewPlayBtn.onclick = () => {
    if (!recordedUrl) return;
    if (!previewAudio) {
      previewAudio = new Audio(recordedUrl);
      previewAudio.onended = () => {
        previewPlayBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
      };
    }
    if (previewAudio.paused) {
      previewAudio.play();
      previewPlayBtn.innerHTML = '<span class="material-symbols-outlined">pause</span>';
    } else {
      previewAudio.pause();
      previewPlayBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
    }
  };

  /* ── Discard preview ── */
  function discardPreview() {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio = null;
    }
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    recordedBlob = null;
    recordedUrl = null;
    previewBar.style.display = 'none';
    audioChunks = [];
    chatForm.style.display = '';
    previewPlayBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
  }

  previewCancelBtn.onclick = discardPreview;

  /* ── Send from preview ── */
  async function sendFromPreview() {
    if (!recordedBlob) return;
    const convId = config.getActiveConvId();
    if (!convId) return;

    previewSendBtn.disabled = true;

    try {
      const waveformData = await generateWaveformData(recordedBlob);
      const formData = new FormData();
      formData.append('file', recordedBlob, 'voice.webm');
      const uploadRes = await fetch(`${API_URL}/conversations/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.url) throw new Error('Upload failed');

      const msg = {
        conversationId: convId,
        senderId: config.getMyId(),
        message: '',
        messageType: 'voice',
        attachmentUrl: uploadData.url,
        waveform: JSON.stringify(waveformData),
      };
      config.appendMessage(msg);
      if (config.getSocket()) {
        config.getSocket().emit('chatMessage', msg);
      } else {
        await api(`/conversations/${convId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ message: '', messageType: 'voice', attachmentUrl: uploadData.url, waveform: JSON.stringify(waveformData) }),
        });
      }
      if (config.onMessageSent) config.onMessageSent();
    } catch (err) {
      console.error('Voice upload failed:', err);
    } finally {
      previewSendBtn.disabled = false;
      cleanupPreviewResources();
      discardPreview();
    }
  }

  function cleanupPreviewResources() {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.src = '';
      previewAudio.load();
      previewAudio = null;
    }
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      recordedUrl = null;
    }
    recordedBlob = null;
  }

  previewSendBtn.onclick = sendFromPreview;

  /* ── Wire buttons ── */
  micBtn.onclick = startRecording;
  cancelBtn.onclick = cancelRecording;
  stopBtn.onclick = stopAndPreview;

  config.cleanupFns = config.cleanupFns || [];
  config.cleanupFns.push(() => { micBtn.remove(); recordingBar.remove(); previewBar.remove(); });
}

export function setupVideoCall(config) {
  const { chatHeader, getActiveConvId, getSocket, getMyId } = config;

  let localStream = null;
  let remoteStream = null;
  let peerConnection = null;
  let inCall = false;
  let callActive = false;
  const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceTransportPolicy: 'all',
};

  const videoCallBtn = document.createElement('button');
  videoCallBtn.type = 'button';
  videoCallBtn.className = 'chat-video-btn';
  videoCallBtn.setAttribute('aria-label', 'Video call');
  videoCallBtn.innerHTML = '<span class="material-symbols-outlined">videocam</span>';

  const headerActions = chatHeader.querySelector('.chat-header-actions') || (() => {
    const div = document.createElement('div');
    div.className = 'chat-header-actions';
    chatHeader.appendChild(div);
    return div;
  })();
  headerActions.appendChild(videoCallBtn);

  const overlay = document.createElement('div');
  overlay.className = 'video-call-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div class="call-container">
      <video class="remote-video" autoplay playsinline></video>
      <video class="local-video" autoplay playsinline muted></video>
      <div class="call-info">
        <span class="call-status">Connecting...</span>
        <span class="call-timer">00:00</span>
      </div>
      <div class="call-controls">
        <button class="call-btn call-mic-btn" aria-label="Toggle microphone">
          <span class="material-symbols-outlined">mic</span>
        </button>
        <button class="call-btn call-camera-btn" aria-label="Toggle camera">
          <span class="material-symbols-outlined">videocam</span>
        </button>
        <button class="call-btn call-end-btn" aria-label="End call">
          <span class="material-symbols-outlined">call_end</span>
        </button>
        <button class="call-btn call-speaker-btn" aria-label="Toggle speaker">
          <span class="material-symbols-outlined">volume_up</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const incomingOverlay = document.createElement('div');
  incomingOverlay.className = 'incoming-call-overlay';
  incomingOverlay.style.display = 'none';
  incomingOverlay.innerHTML = `
    <div class="incoming-call-card">
      <div class="incoming-call-info">
        <span class="material-symbols-outlined incoming-call-icon">videocam</span>
        <div>
          <div class="incoming-caller-name">Incoming Call</div>
          <div class="incoming-call-status">Video call...</div>
        </div>
      </div>
      <div class="incoming-call-actions">
        <button class="call-btn call-answer-btn" aria-label="Answer">
          <span class="material-symbols-outlined">videocam</span>
        </button>
        <button class="call-btn call-decline-btn" aria-label="Decline">
          <span class="material-symbols-outlined">call_end</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(incomingOverlay);

  const remoteVideo = overlay.querySelector('.remote-video');
  const localVideo = overlay.querySelector('.local-video');
  const callTimerEl = overlay.querySelector('.call-timer');
  const callStatusEl = overlay.querySelector('.call-status');
  const micToggle = overlay.querySelector('.call-mic-btn');
  const cameraToggle = overlay.querySelector('.call-camera-btn');
  const endBtn = overlay.querySelector('.call-end-btn');
  const speakerBtn = overlay.querySelector('.call-speaker-btn');
  const answerBtn = incomingOverlay.querySelector('.call-answer-btn');
  const declineBtn = incomingOverlay.querySelector('.call-decline-btn');
  const incomingCallerName = incomingOverlay.querySelector('.incoming-caller-name');

  let callTimerInterval = null;
  let callSeconds = 0;
  let micEnabled = true;
  let cameraEnabled = true;
  let speakerEnabled = true;
  let pendingOffer = null;
  let incomingCallerId = null;

  const socket = getSocket();

  function resetCallState() {
    callActive = false;
    inCall = false;
    localStream = null;
    remoteStream = null;
    peerConnection = null;
    pendingOffer = null;
    incomingCallerId = null;
    clearInterval(callTimerInterval);
    callTimerInterval = null;
    callSeconds = 0;
    callTimerEl.textContent = '00:00';
  }

  function showOverlay() { overlay.style.display = 'flex'; }
  function hideOverlay() { overlay.style.display = 'none'; }
  function showIncoming() { incomingOverlay.style.display = 'flex'; }
  function hideIncoming() { incomingOverlay.style.display = 'none'; }

  async function startLocalStream() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
      return localStream;
    } catch (err) {
      console.error('Could not get media devices:', err);
      callStatusEl.textContent = 'Camera/mic access denied';
      return null;
    }
  }

  function stopLocalStream() {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
  }

  function createPeerConnection() {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }
    pc.ontrack = (event) => {
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteVideo.srcObject = remoteStream;
      }
      event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
    };
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('videoCall:ice-candidate', { conversationId: getActiveConvId(), candidate: event.candidate });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        endCall();
      }
    };
    return pc;
  }

  async function startCallTimer() {
    callSeconds = 0;
    callTimerInterval = setInterval(() => {
      callSeconds++;
      const m = Math.floor(callSeconds / 60);
      const s = callSeconds % 60;
      callTimerEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, 1000);
  }

  async function initiateCall() {
    if (!socket) return;
    const stream = await startLocalStream();
    if (!stream) return;
    callActive = true;
    inCall = true;
    showOverlay();
    callStatusEl.textContent = 'Calling...';

    peerConnection = createPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('videoCall:offer', { conversationId: getActiveConvId(), offer });
  }

  async function answerCall() {
    if (!socket || !pendingOffer) return;
    hideIncoming();
    const stream = await startLocalStream();
    if (!stream) return;
    callActive = true;
    inCall = true;
    showOverlay();
    callStatusEl.textContent = 'Connected';

    peerConnection = createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(pendingOffer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('videoCall:answer', { conversationId: getActiveConvId(), answer });
    startCallTimer();
  }

  function declineCall() {
    if (socket) {
      socket.emit('videoCall:decline', { conversationId: getActiveConvId() });
    }
    hideIncoming();
    resetCallState();
  }

  function endCall() {
    if (!callActive && !peerConnection) return;
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    stopLocalStream();
    callActive = false;
    if (socket) {
      socket.emit('videoCall:end', { conversationId: getActiveConvId() });
    }
    hideOverlay();
    hideIncoming();
    resetCallState();
  }

  videoCallBtn.onclick = initiateCall;

  endBtn.onclick = endCall;

  answerBtn.onclick = answerCall;
  declineBtn.onclick = declineCall;

  micToggle.onclick = () => {
    micEnabled = !micEnabled;
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = micEnabled);
    }
    micToggle.innerHTML = `<span class="material-symbols-outlined">${micEnabled ? 'mic' : 'mic_off'}</span>`;
    micToggle.classList.toggle('call-btn-off', !micEnabled);
  };

  cameraToggle.onclick = () => {
    cameraEnabled = !cameraEnabled;
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = cameraEnabled);
    }
    cameraToggle.innerHTML = `<span class="material-symbols-outlined">${cameraEnabled ? 'videocam' : 'videocam_off'}</span>`;
    cameraToggle.classList.toggle('call-btn-off', !cameraEnabled);
  };

  speakerBtn.onclick = () => {
    speakerEnabled = !speakerEnabled;
    if (remoteVideo && typeof remoteVideo.setSinkId === 'function') {
      remoteVideo.setSinkId(speakerEnabled ? '' : 'default').catch(() => {});
    }
    speakerBtn.innerHTML = `<span class="material-symbols-outlined">${speakerEnabled ? 'volume_up' : 'volume_off'}</span>`;
  };

  if (socket) {
    socket.on('videoCall:offer', async (data) => {
      if (callActive) {
        socket.emit('videoCall:busy', { conversationId: getActiveConvId() });
        return;
      }
      pendingOffer = data.offer;
      incomingCallerId = data.callerId;
      incomingCallerName.textContent = `${data.callerUsername || 'Someone'} is calling`;
      showIncoming();
    });

    socket.on('videoCall:answer', async (data) => {
      if (!peerConnection) return;
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        callStatusEl.textContent = 'Connected';
        startCallTimer();
      } catch (err) {
        console.error('Error setting remote description:', err);
      }
    });

    socket.on('videoCall:ice-candidate', async (data) => {
      if (!peerConnection) return;
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });

    socket.on('videoCall:end', () => {
      endCall();
    });

    socket.on('videoCall:decline', () => {
      hideIncoming();
      callStatusEl.textContent = 'Call declined';
      setTimeout(() => { hideOverlay(); resetCallState(); }, 1500);
    });

    socket.on('videoCall:busy', () => {
      hideIncoming();
      callStatusEl.textContent = 'Busy';
      setTimeout(() => { hideOverlay(); resetCallState(); }, 1500);
    });
  }

  config.cleanupFns = config.cleanupFns || [];
  config.cleanupFns.push(() => { videoCallBtn.remove(); overlay.remove(); incomingOverlay.remove(); });
}

export function openLightbox(src) {
  const existing = document.querySelector('.lightbox-overlay');
  if (existing) existing.remove();

  const lb = document.createElement('div');
  lb.className = 'lightbox-overlay';
  lb.innerHTML = `
    <button class="lightbox-close" aria-label="Close"><span class="material-symbols-outlined">close</span></button>
    <img class="lightbox-image" src="${esc(src)}" alt="Full size image">
  `;
  lb.onclick = (e) => {
    if (e.target === lb || e.target.closest('.lightbox-close')) lb.remove();
  };
  document.body.appendChild(lb);
}

if (typeof window !== 'undefined') {
  window.openLightbox = openLightbox;
}
