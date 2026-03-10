/* ============================================================
   TASK 16 — Context Panel (UI Layer)
   DOM rendering only. Renders the right-side context panel
   with severity badges, sector/regime chips, and checklist
   cards sorted by severity.

   API:
     initContextPanel()        — mount shell into #section-context
     updateContextPanel(report) — update cards efficiently
     refreshContextPanel()     — recompute + update (convenience)
============================================================ */

/* ----------------------------------------------------------
   TOOLTIP STYLES — injected once into <head>
---------------------------------------------------------- */
(function _injectCtxTooltipStyles() {
  if (document.getElementById('ctx-tooltip-styles')) return;
  const s = document.createElement('style');
  s.id = 'ctx-tooltip-styles';
  s.textContent = `
    .ctx-card-metrics[data-has-tooltip] { cursor: help; }
    .ctx-metric-tooltip {
      position: fixed;
      z-index: 10000;
      pointer-events: none;
      display: none;
      background: var(--bg-elevated, #1e2130);
      color: var(--text-primary, #e0e4ef);
      border: 1px solid var(--border-strong, #3a3f52);
      border-radius: 8px;
      padding: 10px 12px;
      max-width: 360px;
      min-width: 220px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.45);
      font-family: inherit;
      line-height: 1.5;
      opacity: 0;
      transition: opacity 120ms ease-in;
    }
    .ctx-metric-tooltip.ctx-tt-visible {
      display: block;
      opacity: 1;
    }
    .ctx-tt-title {
      font-size: 0.6875rem;
      font-weight: 700;
      color: var(--accent-primary, #4f8ef7);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 4px;
    }
    .ctx-tt-def {
      font-size: 0.75rem;
      color: var(--text-secondary, #a0a8c0);
      margin-bottom: 6px;
    }
    .ctx-tt-formula-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
      padding: 4px 6px;
      background: rgba(79, 142, 247, 0.06);
      border-radius: 4px;
    }
    .ctx-tt-formula-tag {
      font-size: 0.5625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted, #6b7394);
      white-space: nowrap;
    }
    .ctx-tt-formula {
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 0.6875rem;
      color: var(--accent-primary, #4f8ef7);
    }
    .ctx-tt-divider {
      border-top: 1px solid var(--border-subtle, #2a2f40);
      margin: 6px 0;
    }
    .ctx-tt-inputs-header {
      font-size: 0.5625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted, #6b7394);
      margin-bottom: 4px;
    }
    .ctx-tt-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 1px 0;
    }
    .ctx-tt-label {
      font-size: 0.6875rem;
      color: var(--text-secondary, #a0a8c0);
    }
    .ctx-tt-val {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--text-primary, #e0e4ef);
      white-space: nowrap;
    }
  `;
  document.head.appendChild(s);
})();

/* ----------------------------------------------------------
   CONSTANTS
---------------------------------------------------------- */
const _CTX_STATUS_ICONS = {
  red:    '&#x25CF;',  // filled circle
  yellow: '&#x25CF;',
  green:  '&#x25CF;',
  na:     '&#x25CB;',  // outline circle
};

const _CTX_STATUS_COLORS = {
  red:    'var(--accent-danger)',
  yellow: 'var(--accent-warning)',
  green:  'var(--accent-success)',
  na:     'var(--text-muted)',
};

/* ----------------------------------------------------------
   DEBOUNCE for context panel updates (50–80ms)
---------------------------------------------------------- */
let _ctxDebounceTimer = null;
function _ctxDebounce(fn, ms) {
  clearTimeout(_ctxDebounceTimer);
  _ctxDebounceTimer = setTimeout(fn, ms);
}

/* ----------------------------------------------------------
   INIT — mount the panel shell
---------------------------------------------------------- */
function initContextPanel() {
  const mount = document.getElementById('section-context');
  if (!mount) return;

  mount.innerHTML = `
    <div class="ctx-panel">
      <div class="ctx-header">
        <span class="ctx-title">DCF Valuation Diagnostics</span>
        <div class="ctx-badges" id="ctx-badges"></div>
      </div>
      <div class="ctx-chips" id="ctx-chips"></div>
      <div class="ctx-cards-list" id="ctx-cards-list">
        <div class="ctx-empty">Waiting for DCF model...</div>
      </div>
      <div class="ctx-diagnostics" id="ctx-diagnostics"></div>
    </div>
  `;
}

/* ----------------------------------------------------------
   UPDATE — efficient DOM update from contextReport
   Reuses existing card nodes when possible.
---------------------------------------------------------- */
let _prevCardIds = [];

function updateContextPanel(report) {
  if (!report) return;

  // Store for tooltip lookups
  _ctxLatestReport = report;

  const badgesEl = document.getElementById('ctx-badges');
  const chipsEl  = document.getElementById('ctx-chips');
  const listEl   = document.getElementById('ctx-cards-list');
  const diagEl   = document.getElementById('ctx-diagnostics');
  if (!badgesEl || !listEl) return;

  // ── Badges ──────────────────────────────────────────────
  const s = report.summary;
  badgesEl.innerHTML = `
    <span class="ctx-badge ctx-badge-red" title="Red flags">${s.redCount}</span>
    <span class="ctx-badge ctx-badge-yellow" title="Yellow flags">${s.yellowCount}</span>
    <span class="ctx-badge ctx-badge-green" title="Green checks">${s.greenCount}</span>
  `;

  // ── Chips ───────────────────────────────────────────────
  if (chipsEl) {
    const ctx = (typeof state !== 'undefined' && state.context) ? state.context : {};
    const sectorLabel = ctx.sector || 'Tech';
    const regimeLabel = (CONTEXT_BENCHMARKS.regimes[ctx.regime] || {}).label || 'Base';
    chipsEl.innerHTML = `
      <span class="ctx-chip">${sectorLabel}</span>
      <span class="ctx-chip">${regimeLabel}</span>
    `;
  }

  // ── Cards — diff-based update ───────────────────────────
  const newIds = report.cards.map(c => c.id);
  const needsFullRebuild = newIds.length !== _prevCardIds.length ||
    newIds.some((id, i) => id !== _prevCardIds[i]);

  if (needsFullRebuild) {
    // Full rebuild
    listEl.innerHTML = report.cards.map(card => _renderCard(card)).join('');
    _prevCardIds = newIds;
  } else {
    // Patch in-place: update only changed content
    report.cards.forEach((card, i) => {
      const existing = listEl.children[i];
      if (!existing) return;
      // Update inner content if status or metrics changed
      const statusDot  = existing.querySelector('.ctx-card-status');
      const metricsEl  = existing.querySelector('.ctx-card-metrics');
      const whyEl      = existing.querySelector('.ctx-card-why');
      const nextStepEl = existing.querySelector('.ctx-card-nextstep');

      if (statusDot)  statusDot.innerHTML  = _statusDot(card.status);
      if (metricsEl)  metricsEl.textContent = card.metrics || '';
      if (whyEl)      whyEl.textContent     = card.why || '';
      if (nextStepEl) {
        nextStepEl.textContent = card.nextStep || '';
        nextStepEl.style.display = card.nextStep ? 'block' : 'none';
      }

      // Update card border color
      existing.style.borderLeftColor = _CTX_STATUS_COLORS[card.status] || _CTX_STATUS_COLORS.na;
    });
  }

  // ── Diagnostics ─────────────────────────────────────────
  if (diagEl) {
    if (report.diagnostics && report.diagnostics.length > 0) {
      diagEl.innerHTML = `
        <div class="ctx-diag-header">Key Drivers</div>
        ${report.diagnostics.map(d => `<div class="ctx-diag-line">${d}</div>`).join('')}
      `;
      diagEl.style.display = 'block';
    } else {
      diagEl.style.display = 'none';
    }
  }

  // ── Bind hover tooltips to metric values ──────────────
  _ctxBindCardTooltips();
}

/* ----------------------------------------------------------
   REFRESH — recompute and update (called from recalculate)
---------------------------------------------------------- */
function refreshContextPanel() {
  try {
    if (!state.dcf || !state.dcf.valid) {
      console.log('[Context] Skipped — DCF not valid');
      return;
    }

    // Auto-init panel shell if not yet mounted
    if (!document.getElementById('ctx-badges')) {
      console.log('[Context] Auto-init panel shell');
      initContextPanel();
    }

    const ctx = state.context || {};
    console.log('[Context] Computing report, sector:', ctx.sector, 'regime:', ctx.regime);
    const report = computeContextReport(
      { dcf: state.dcf, historical: state.historical, inputs: state.inputs },
      ctx
    );
    console.log('[Context] Report:', report.summary, 'cards:', report.cards.length);

    updateContextPanel(report);
  } catch (err) {
    console.error('[Context] Error in refreshContextPanel:', err);
  }
}

/* ----------------------------------------------------------
   RENDER HELPERS (private)
---------------------------------------------------------- */
function _statusDot(status) {
  return `<span style="color:${_CTX_STATUS_COLORS[status] || _CTX_STATUS_COLORS.na};font-size:0.875rem;">${_CTX_STATUS_ICONS[status] || _CTX_STATUS_ICONS.na}</span>`;
}

function _renderCard(card) {
  const borderColor = _CTX_STATUS_COLORS[card.status] || _CTX_STATUS_COLORS.na;
  const nextStepDisplay = card.nextStep ? 'block' : 'none';
  const hasTooltip = card.tooltipData ? ' data-has-tooltip="1"' : '';

  return `
    <div class="ctx-card" style="border-left-color:${borderColor};" data-card-id="${card.id}">
      <div class="ctx-card-header">
        <span class="ctx-card-status">${_statusDot(card.status)}</span>
        <span class="ctx-card-title">${card.title}</span>
        <span class="ctx-card-metrics"${hasTooltip}>${card.metrics || ''}</span>
      </div>
      <div class="ctx-card-why">${card.why || ''}</div>
      <div class="ctx-card-nextstep" style="display:${nextStepDisplay};">${card.nextStep || ''}</div>
    </div>
  `;
}

/* ----------------------------------------------------------
   TOOLTIP — shared element, formatting, positioning, binding
---------------------------------------------------------- */

// Format a component value based on its fmt type
function _ctxFmtComponent(comp) {
  if (comp.fmt === 'text' && comp.text) return comp.text;
  const v = comp.val;
  if (v === null || v === undefined || !isFinite(v)) return '<span style="color:var(--text-muted);font-style:italic;">n/a</span>';
  switch (comp.fmt) {
    case 'pct':    return (v * 100).toFixed(2) + '%';
    case 'pp':     return (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + 'pp';
    case 'mult':   return v.toFixed(1) + 'x';
    case 'dollar': {
      const abs = Math.abs(v);
      if (abs >= 1e12) return (v < 0 ? '-$' : '$') + (abs / 1e12).toFixed(2) + 'T';
      if (abs >= 1e9)  return (v < 0 ? '-$' : '$') + (abs / 1e9).toFixed(2) + 'B';
      if (abs >= 1e6)  return (v < 0 ? '-$' : '$') + (abs / 1e6).toFixed(1) + 'M';
      if (abs >= 1e3)  return (v < 0 ? '-$' : '$') + (abs / 1e3).toFixed(1) + 'K';
      return (v < 0 ? '-$' : '$') + abs.toFixed(1);
    }
    default: return String(v);
  }
}

// Ensure tooltip element exists (created once)
function _ctxGetTooltip() {
  let el = document.getElementById('ctx-metric-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ctx-metric-tooltip';
    el.className = 'ctx-metric-tooltip';
    document.body.appendChild(el);
  }
  return el;
}

// Position tooltip near cursor, flip if near viewport edge
function _ctxPositionTooltip(el, x, y) {
  const pad = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = el.getBoundingClientRect();
  let left = x + pad;
  let top  = y + pad;
  if (left + rect.width > vw - 8) left = x - rect.width - pad;
  if (top + rect.height > vh - 8) top  = y - rect.height - pad;
  if (left < 4) left = 4;
  if (top < 4) top = 4;
  el.style.left = left + 'px';
  el.style.top  = top + 'px';
}

// Build tooltip HTML from a card's tooltipData
function _ctxBuildTooltipHtml(title, td) {
  let html = '<div class="ctx-tt-title">' + title + '</div>';
  html += '<div class="ctx-tt-def">' + td.def + '</div>';
  if (td.formula) {
    html += '<div class="ctx-tt-formula-row">'
      + '<span class="ctx-tt-formula-tag">Formula</span>'
      + '<span class="ctx-tt-formula">' + td.formula + '</span>'
      + '</div>';
  }
  if (td.components && td.components.length) {
    html += '<div class="ctx-tt-divider"></div>';
    html += '<div class="ctx-tt-inputs-header">Calculation Inputs</div>';
    td.components.forEach(function(c) {
      html += '<div class="ctx-tt-row">'
        + '<span class="ctx-tt-label">' + c.label + '</span>'
        + '<span class="ctx-tt-val">' + _ctxFmtComponent(c) + '</span>'
        + '</div>';
    });
  }
  return html;
}

// Store latest report for tooltip lookups
let _ctxLatestReport = null;

// Bind hover events to .ctx-card-metrics[data-has-tooltip] elements
function _ctxBindCardTooltips() {
  if (!_ctxLatestReport) return;
  const tooltip = _ctxGetTooltip();
  const listEl = document.getElementById('ctx-cards-list');
  if (!listEl) return;

  const metricsEls = listEl.querySelectorAll('.ctx-card-metrics[data-has-tooltip]');
  metricsEls.forEach(function(el) {
    // Avoid duplicate bindings on patch updates
    if (el._ctxTooltipBound) return;
    el._ctxTooltipBound = true;

    el.addEventListener('mouseenter', function(e) {
      // Look up card at hover time so latest report data is always used
      const cardEl = el.closest('.ctx-card');
      if (!cardEl || !_ctxLatestReport) return;
      const cardId = cardEl.getAttribute('data-card-id');
      const card = _ctxLatestReport.cards.find(function(c) { return c.id === cardId; });
      if (!card || !card.tooltipData) return;

      tooltip.innerHTML = _ctxBuildTooltipHtml(card.title, card.tooltipData);
      tooltip.classList.add('ctx-tt-visible');
      _ctxPositionTooltip(tooltip, e.clientX, e.clientY);
    });

    el.addEventListener('mousemove', function(e) {
      if (tooltip.classList.contains('ctx-tt-visible')) {
        _ctxPositionTooltip(tooltip, e.clientX, e.clientY);
      }
    });

    el.addEventListener('mouseleave', function() {
      tooltip.classList.remove('ctx-tt-visible');
    });
  });
}
