/* ============================================================
   CHAT PANEL -- TutorDCF right-side chat UI
   Vanilla JS component for "Call a Tutor" and "Conference Call"
   ============================================================ */

(function () {
  'use strict';

  // ================================================================
  // CONSTANTS
  // ================================================================
  const PANEL_WIDTH       = 390;
  const TYPE_DELAY        = 12;   // ms per character for typing effect
  const TYPE_DELAY_FAST   = 6;    // faster for long messages
  const MSG_PAUSE         = 400;  // pause between queued messages

  const QUICK_CHIPS = [
    { label: 'Ask about impact', topic: 'impact' },
    { label: 'Revenue growth',   topic: 'revenueGrowth' },
    { label: 'Margin',           topic: 'margin' },
    { label: 'NWC',              topic: 'nwc' },
    { label: 'WACC',             topic: 'wacc' },
    { label: 'Terminal growth',  topic: 'terminalGrowth' },
  ];

  // ================================================================
  // SESSION STATE
  // ================================================================
  let session = {
    active:    false,
    mode:      null,     // 'tutor' | 'conference'
    personas:  [],       // [{ name, file, role? }]
    messages:  [],       // [{ role, speaker?, text, timestamp }]
    turnIndex: 0,        // for conference alternation
    typing:    false,    // true while typewriter is running
    queue:     [],       // pending messages to type
  };

  // DOM references (set in init)
  let panelEl       = null;
  let msgListEl     = null;
  let inputEl       = null;
  let sendBtnEl     = null;
  let headerEl      = null;
  let dashboardBody = null;

  // ================================================================
  // PERSONA HELPERS
  // ================================================================

  function parsePersonaName(filename) {
    return filename.replace(/\.png$/i, '').replace(/_/g, ' ');
  }

  function pickPersonas(count) {
    const manifest = window.EMPLOYEE_MANIFEST || [];
    if (manifest.length === 0) {
      // Fallback if manifest not loaded
      return count === 1
        ? [{ name: 'Analyst', file: null }]
        : [{ name: 'Bull Analyst', file: null, role: 'bull' }, { name: 'Bear Analyst', file: null, role: 'bear' }];
    }

    const shuffled = [...manifest].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, Math.min(count, manifest.length));

    return picks.map((file, i) => ({
      name: parsePersonaName(file),
      file: file,
      role: count === 2 ? (i === 0 ? 'bull' : 'bear') : null,
    }));
  }

  // ================================================================
  // DOM CONSTRUCTION
  // ================================================================

  function buildPanel() {
    if (panelEl) return; // already built

    panelEl = document.createElement('div');
    panelEl.id = 'chat-panel';
    panelEl.className = 'chat-panel chat-panel--closed';
    panelEl.innerHTML = `
      <div class="chat-panel__header" id="chat-panel-header">
        <div class="chat-panel__header-top">
          <span class="chat-panel__demo-badge">Demo Mode</span>
          <button class="chat-panel__end-btn" id="chat-end-btn">End Call</button>
        </div>
        <div class="chat-panel__personas" id="chat-personas"></div>
      </div>
      <div class="chat-panel__disclaimer">Demo Mode: scripted placeholder, no live AI.</div>
      <div class="chat-panel__messages" id="chat-messages"></div>
      <div class="chat-panel__chips" id="chat-chips"></div>
      <div class="chat-panel__input-row">
        <input type="text" class="chat-panel__input" id="chat-input" placeholder="Explain WACC" autocomplete="off" />
        <button class="chat-panel__send-btn" id="chat-send-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    `;

    document.body.appendChild(panelEl);

    // Cache references
    msgListEl  = panelEl.querySelector('#chat-messages');
    inputEl    = panelEl.querySelector('#chat-input');
    sendBtnEl  = panelEl.querySelector('#chat-send-btn');
    headerEl   = panelEl.querySelector('#chat-panel-header');
    dashboardBody = document.getElementById('dashboard-body');

    // Build quick chips
    const chipsEl = panelEl.querySelector('#chat-chips');
    QUICK_CHIPS.forEach(chip => {
      const btn = document.createElement('button');
      btn.className = 'chat-chip';
      btn.textContent = chip.label;
      btn.addEventListener('click', () => handleChipClick(chip));
      chipsEl.appendChild(btn);
    });

    // Event listeners
    panelEl.querySelector('#chat-end-btn').addEventListener('click', endSession);
    sendBtnEl.addEventListener('click', handleSend);
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  // ================================================================
  // PANEL OPEN / CLOSE
  // ================================================================

  function openPanel() {
    if (!panelEl) buildPanel();
    panelEl.classList.remove('chat-panel--closed');
    panelEl.classList.add('chat-panel--open');

    // Shrink dashboard
    if (dashboardBody) {
      dashboardBody.style.marginRight = PANEL_WIDTH + 'px';
      dashboardBody.style.transition = 'margin-right 0.3s cubic-bezier(0.4,0,0.2,1)';
    }

    // Also shift the sticky header
    const header = document.getElementById('section-header');
    if (header) {
      header.style.right = PANEL_WIDTH + 'px';
      header.style.transition = 'right 0.3s cubic-bezier(0.4,0,0.2,1)';
    }
  }

  function closePanel() {
    if (!panelEl) return;
    panelEl.classList.remove('chat-panel--open');
    panelEl.classList.add('chat-panel--closed');

    if (dashboardBody) {
      dashboardBody.style.marginRight = '';
    }

    const header = document.getElementById('section-header');
    if (header) {
      header.style.right = '';
    }
  }

  // ================================================================
  // SESSION MANAGEMENT
  // ================================================================

  function startSession(mode) {
    // If another session is active, end it first
    if (session.active) {
      resetSession();
    }

    buildPanel();

    session.active    = true;
    session.mode      = mode;
    session.messages  = [];
    session.turnIndex = 0;
    session.typing    = false;
    session.queue     = [];

    // Pick personas
    session.personas = mode === 'tutor' ? pickPersonas(1) : pickPersonas(2);

    // Snapshot dcf.state for impact analysis
    try {
      state.__chatSessionStartSnapshot = JSON.parse(JSON.stringify({
        inputs:     state.inputs,
        dcf:        state.dcf,
        historical: state.historical,
      }));
    } catch (e) {
      state.__chatSessionStartSnapshot = null;
    }

    // Render header personas
    renderPersonas();

    // Clear messages
    msgListEl.innerHTML = '';

    // Open panel
    openPanel();

    // Focus input
    setTimeout(() => inputEl.focus(), 350);

    // Send greeting(s)
    if (mode === 'tutor') {
      const persona = session.personas[0];
      const greeting = getGreeting('tutor', state);
      enqueueAssistantMessage(greeting, persona.name);
    } else {
      // Conference: bull speaks first, then bear
      const bull = session.personas.find(p => p.role === 'bull') || session.personas[0];
      const bear = session.personas.find(p => p.role === 'bear') || session.personas[1];

      const bullGreet = getGreeting('conference', state, 'bull');
      const bearGreet = getGreeting('conference', state, 'bear');

      enqueueAssistantMessage(bullGreet, bull.name, 'bull');
      enqueueAssistantMessage(bearGreet, bear.name, 'bear');
    }

    // Update button states
    updateHeaderButtons();
  }

  function endSession() {
    resetSession();
    closePanel();
    updateHeaderButtons();
  }

  function resetSession() {
    session.active    = false;
    session.mode      = null;
    session.personas  = [];
    session.messages  = [];
    session.turnIndex = 0;
    session.typing    = false;
    session.queue     = [];

    // Clear snapshot
    if (typeof state !== 'undefined') {
      delete state.__chatSessionStartSnapshot;
    }
  }

  // ================================================================
  // PERSONA RENDERING
  // ================================================================

  function renderPersonas() {
    const container = panelEl.querySelector('#chat-personas');
    container.innerHTML = '';

    session.personas.forEach(p => {
      const div = document.createElement('div');
      div.className = 'chat-persona';

      const imgWrap = document.createElement('div');
      imgWrap.className = 'chat-persona__img-wrap';

      if (p.file) {
        const img = document.createElement('img');
        img.src = 'employees/' + p.file;
        img.alt = p.name;
        img.className = 'chat-persona__img';
        imgWrap.appendChild(img);
      } else {
        // Fallback avatar
        imgWrap.innerHTML = '<div class="chat-persona__img chat-persona__img--fallback">' +
          p.name.charAt(0).toUpperCase() + '</div>';
      }

      const info = document.createElement('div');
      info.className = 'chat-persona__info';

      const nameEl = document.createElement('span');
      nameEl.className = 'chat-persona__name';
      nameEl.textContent = p.name;
      info.appendChild(nameEl);

      if (p.role) {
        const roleEl = document.createElement('span');
        roleEl.className = 'chat-persona__role chat-persona__role--' + p.role;
        roleEl.textContent = p.role === 'bull' ? 'Bull' : 'Bear';
        info.appendChild(roleEl);
      }

      div.appendChild(imgWrap);
      div.appendChild(info);
      container.appendChild(div);
    });
  }

  // ================================================================
  // MESSAGE RENDERING
  // ================================================================

  function addUserMessage(text) {
    session.messages.push({ role: 'user', text, timestamp: Date.now() });

    const bubble = document.createElement('div');
    bubble.className = 'chat-msg chat-msg--user';
    bubble.innerHTML = `<div class="chat-msg__text">${escapeHtml(text)}</div>`;
    msgListEl.appendChild(bubble);
    scrollToBottom();
  }

  function createAssistantBubble(speaker, role) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-msg chat-msg--assistant';

    let labelHtml = '';
    if (session.mode === 'conference' && role) {
      const roleClass = role === 'bull' ? 'chat-msg__role--bull' : 'chat-msg__role--bear';
      const roleLabel = role === 'bull' ? 'Bull:' : 'Bear:';
      labelHtml = `<span class="chat-msg__role ${roleClass}">${roleLabel}</span> `;
    }

    // Find persona image
    const persona = session.personas.find(p => p.name === speaker);
    let avatarHtml = '';
    if (persona && persona.file) {
      avatarHtml = `<img class="chat-msg__avatar" src="employees/${persona.file}" alt="${escapeHtml(speaker)}" />`;
    }

    bubble.innerHTML = `
      ${avatarHtml}
      <div class="chat-msg__body">
        <div class="chat-msg__speaker">${labelHtml}${escapeHtml(speaker)}</div>
        <div class="chat-msg__text"></div>
      </div>
    `;

    msgListEl.appendChild(bubble);
    scrollToBottom();
    return bubble.querySelector('.chat-msg__text');
  }

  // ================================================================
  // TYPING EFFECT + MESSAGE QUEUE
  // ================================================================

  function typeMessage(textEl, text, onDone) {
    const delay = text.length > 200 ? TYPE_DELAY_FAST : TYPE_DELAY;
    let i = 0;
    session.typing = true;

    function tick() {
      if (i < text.length) {
        textEl.textContent += text.charAt(i);
        i++;
        scrollToBottom();
        setTimeout(tick, delay);
      } else {
        session.typing = false;
        if (onDone) onDone();
      }
    }

    tick();
  }

  function enqueueAssistantMessage(text, speaker, role) {
    session.queue.push({ text, speaker, role });
    processQueue();
  }

  function processQueue() {
    if (session.typing || session.queue.length === 0) return;

    const msg = session.queue.shift();
    const textEl = createAssistantBubble(msg.speaker, msg.role);

    session.messages.push({
      role: 'assistant',
      speaker: msg.speaker,
      roleTag: msg.role,
      text: msg.text,
      timestamp: Date.now(),
    });

    // Dispatch focus event if applicable
    // (done before typing so highlight appears while reading)

    typeMessage(textEl, msg.text, () => {
      setTimeout(processQueue, MSG_PAUSE);
    });
  }

  // ================================================================
  // USER INPUT HANDLING
  // ================================================================

  function handleSend() {
    const text = (inputEl.value || '').trim();
    if (!text || !session.active) return;
    if (session.typing) return; // wait for current typing to finish

    inputEl.value = '';
    addUserMessage(text);

    generateResponse(text);
  }

  function handleChipClick(chip) {
    if (!session.active) return;
    if (session.typing) return;

    // Inject as user message
    addUserMessage(chip.label);
    generateResponse(chip.label);
  }

  function generateResponse(userText) {
    if (session.mode === 'tutor') {
      const persona = session.personas[0];
      const result = getTutorResponse(userText, state, {});
      enqueueAssistantMessage(result.text, persona.name);

      if (result.focus) {
        dispatchFocus(result.focus);
      }
    } else if (session.mode === 'conference') {
      // Strict alternation: bull then bear
      const bull = session.personas.find(p => p.role === 'bull') || session.personas[0];
      const bear = session.personas.find(p => p.role === 'bear') || session.personas[1];

      const bullResult = getConferenceTurn('bull', userText, state, {});
      const bearResult = getConferenceTurn('bear', userText, state, {});

      enqueueAssistantMessage(bullResult.text, bull.name, 'bull');
      enqueueAssistantMessage(bearResult.text, bear.name, 'bear');

      if (bullResult.focus) dispatchFocus(bullResult.focus);
      else if (bearResult.focus) dispatchFocus(bearResult.focus);
    }
  }

  // ================================================================
  // FOCUS EVENT DISPATCH
  // ================================================================

  function dispatchFocus(target) {
    window.dispatchEvent(new CustomEvent('tutordcf:focus', {
      detail: { target: target }
    }));
  }

  // ================================================================
  // UTILITIES
  // ================================================================

  function scrollToBottom() {
    if (msgListEl) {
      msgListEl.scrollTop = msgListEl.scrollHeight;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function updateHeaderButtons() {
    const tutorBtn = document.getElementById('btn-call-tutor');
    const confBtn  = document.getElementById('btn-conference');
    if (!tutorBtn || !confBtn) return;

    if (session.active && session.mode === 'tutor') {
      tutorBtn.classList.add('chat-btn--active');
      confBtn.classList.remove('chat-btn--active');
    } else if (session.active && session.mode === 'conference') {
      confBtn.classList.add('chat-btn--active');
      tutorBtn.classList.remove('chat-btn--active');
    } else {
      tutorBtn.classList.remove('chat-btn--active');
      confBtn.classList.remove('chat-btn--active');
    }
  }

  // ================================================================
  // RESET HOOK -- called when user uploads a new file
  // ================================================================

  function onDataReset() {
    if (session.active) {
      endSession();
    }
  }

  // ================================================================
  // PUBLIC API (attached to window)
  // ================================================================

  window.TutorChat = {
    startTutor:      function () { startSession('tutor'); },
    startConference: function () { startSession('conference'); },
    endSession:      endSession,
    onDataReset:     onDataReset,
    isActive:        function () { return session.active; },
    getSession:      function () { return session; },
  };

})();
