/* ============================================================
   TASK 10 — Report Builder
   Panel UI, state management, fact insertion, chart/metric
   selection, and report generation trigger.
   Renders into a fixed side panel (like chat panel).
   ============================================================ */

(function () {
  'use strict';

  // ================================================================
  // CONSTANTS
  // ================================================================
  const PANEL_WIDTH = 390;
  const MAX_CHARTS = 4;
  const MAX_ADDITIONAL_METRICS = 3;

  const SECTION_CONFIG = [
    { id: 'backgroundCompany',    label: 'Background on Company' },
    { id: 'backgroundSegment',    label: 'Background on Segment' },
    { id: 'financialDiagnostics', label: 'Financial Diagnostics' },
    { id: 'dcfAssumptions',       label: 'DCF Assumptions' },
    { id: 'dcfDiagnostics',       label: 'DCF Diagnostics' },
    { id: 'exitPrice',            label: 'Exit Price' },
  ];

  // Default metrics always included in report
  const DEFAULT_METRICS = ['ev', 'impliedPrice', 'irr'];

  // ================================================================
  // STATE INITIALIZATION
  // ================================================================
  function initReportBuilderState() {
    if (!state.reportBuilder) {
      state.reportBuilder = {
        isOpen: false,
        isDockedUnderTutor: false,
        activeTextSectionId: null,
        sections: {
          backgroundCompany: '',
          backgroundSegment: '',
          financialDiagnostics: '',
          dcfAssumptions: '',
          dcfDiagnostics: '',
          exitPrice: '',
        },
        cursorState: {
          sectionId: null,
          start: 0,
          end: 0,
        },
        selectedCharts: [],
        selectedMetrics: {
          default: [],
          additional: [],
        },
        generatedReportMeta: {
          companyName: '',
          reportTitle: '',
          date: '',
          analystName: '',
        },
      };
    }
    // Populate default metrics from current state
    _refreshDefaultMetrics();
  }

  function _refreshDefaultMetrics() {
    const rb = state.reportBuilder;
    if (!rb) return;
    const s = state.dcf?.summary;
    rb.selectedMetrics.default = [
      {
        id: 'ev',
        label: 'Enterprise Value',
        formattedValue: s?.enterpriseValue != null ? _reportFmtCurrency(s.enterpriseValue) : '—',
        rawValue: s?.enterpriseValue ?? null,
        sourceKey: 'dcf-summary',
      },
      {
        id: 'impliedPrice',
        label: 'Implied Price',
        formattedValue: s?.impliedPrice != null ? ('$' + s.impliedPrice.toFixed(2)) : '—',
        rawValue: s?.impliedPrice ?? null,
        sourceKey: 'dcf-summary',
      },
      {
        id: 'irr',
        label: 'IRR',
        formattedValue: s?.irr != null ? ((s.irr * 100).toFixed(1) + '%') : '—',
        rawValue: s?.irr ?? null,
        sourceKey: 'dcf-summary',
      },
    ];
  }

  // ================================================================
  // FORMATTING HELPERS (centralized, reusable)
  // ================================================================
  function _reportFmtCurrency(val) {
    if (val == null || !isFinite(val)) return '—';
    const abs = Math.abs(val);
    let formatted;
    if (abs >= 1e12) formatted = '$' + (val / 1e12).toFixed(2) + 'T';
    else if (abs >= 1e9) formatted = '$' + (val / 1e9).toFixed(2) + 'B';
    else if (abs >= 1e6) formatted = '$' + (val / 1e6).toFixed(1) + 'M';
    else if (abs >= 1e3) formatted = '$' + (val / 1e3).toFixed(1) + 'K';
    else formatted = '$' + val.toFixed(2);
    if (val < 0) formatted = '-' + formatted.replace('$', '$');
    return formatted;
  }

  function _reportFmtPercent(val) {
    if (val == null || !isFinite(val)) return '—';
    return (val * 100).toFixed(1) + '%';
  }

  function _reportFmtMultiple(val) {
    if (val == null || !isFinite(val)) return '—';
    return val.toFixed(1) + 'x';
  }

  function _reportFmtPrice(val) {
    if (val == null || !isFinite(val)) return '—';
    return '$' + val.toFixed(2);
  }

  function _reportFmtPlain(val, dec) {
    if (val == null || !isFinite(val)) return '—';
    return val.toFixed(dec != null ? dec : 1);
  }

  /**
   * Format a value for insertion into report text.
   * @param {string} label - Metric label (e.g. "Revenue")
   * @param {string|number} value - Raw value
   * @param {string} format - 'currency'|'percent'|'multiple'|'price'|'plain'
   * @param {string} [year] - Year label if applicable
   * @returns {string} Formatted sentence fragment
   */
  function formatFactForInsertion(label, value, format, year) {
    let formatted;
    const numVal = typeof value === 'string' ? parseFloat(value) : value;
    switch (format) {
      case 'currency': formatted = _reportFmtCurrency(numVal); break;
      case 'percent':  formatted = _reportFmtPercent(numVal);  break;
      case 'multiple': formatted = _reportFmtMultiple(numVal); break;
      case 'ratio':    formatted = _reportFmtMultiple(numVal); break;
      case 'price':    formatted = _reportFmtPrice(numVal);    break;
      default:         formatted = _reportFmtPlain(numVal);    break;
    }
    const yearSuffix = year ? ` (${year})` : '';
    return `${label}${yearSuffix}: ${formatted}`;
  }

  // ================================================================
  // DOM REFERENCES
  // ================================================================
  let panelEl = null;
  let dashboardBody = null;

  // ================================================================
  // PANEL CONSTRUCTION
  // ================================================================
  function buildPanel() {
    if (panelEl) return;

    panelEl = document.createElement('div');
    panelEl.id = 'report-builder-panel';
    panelEl.className = 'rb-panel rb-panel--closed';

    panelEl.innerHTML = _buildPanelHTML();
    document.body.appendChild(panelEl);
    dashboardBody = document.getElementById('dashboard-body');

    _wirePanelEvents();
    _restoreStateToUI();
  }

  function _buildPanelHTML() {
    const sectionsHtml = SECTION_CONFIG.map((s, i) => `
      <div class="rb-accordion" data-section-id="${s.id}">
        <button class="rb-accordion-header" data-section-id="${s.id}">
          <span class="rb-accordion-title">${s.label}</span>
          <span class="rb-accordion-chevron">&#9660;</span>
        </button>
        <div class="rb-accordion-body ${i === 0 ? 'rb-accordion-body--open' : ''}">
          <textarea
            class="rb-textarea"
            data-section-id="${s.id}"
            placeholder="Write about ${s.label.toLowerCase()}..."
            rows="4"
          ></textarea>
        </div>
      </div>
    `).join('');

    return `
      <div class="rb-panel-header">
        <div class="rb-panel-header-top">
          <span class="rb-panel-title">Report Builder</span>
          <button class="rb-close-btn" id="rb-close-btn" title="Close Report Builder">&times;</button>
        </div>
        <p class="rb-helper-note">Double-click values, metrics, and charts from the dashboard to add them.</p>
      </div>

      <div class="rb-panel-content">
        <!-- Section 1: Narrative -->
        <div class="rb-section">
          <h3 class="rb-section-heading">Narrative Sections</h3>
          ${sectionsHtml}
        </div>

        <!-- Section 2: Charts -->
        <div class="rb-section">
          <h3 class="rb-section-heading">Selected Charts <span class="rb-count" id="rb-chart-count">0/${MAX_CHARTS}</span></h3>
          <div class="rb-charts-list" id="rb-charts-list">
            <p class="rb-empty-msg">No charts selected. Double-click a chart on the dashboard.</p>
          </div>
        </div>

        <!-- Section 3: Additional Metrics -->
        <div class="rb-section">
          <h3 class="rb-section-heading">Additional Metrics <span class="rb-count" id="rb-metrics-count">0/${MAX_ADDITIONAL_METRICS}</span></h3>
          <div class="rb-metrics-list" id="rb-metrics-list">
            <p class="rb-empty-msg">No additional metrics. Double-click metric cards on the dashboard.</p>
          </div>
        </div>
      </div>

      <div class="rb-panel-footer">
        <button class="rb-create-btn" id="rb-create-btn">Create Report</button>
      </div>

      <!-- Toast notifications -->
      <div class="rb-toast" id="rb-toast"></div>
    `;
  }

  // ================================================================
  // PANEL EVENTS
  // ================================================================
  function _wirePanelEvents() {
    // Close button
    panelEl.querySelector('#rb-close-btn').addEventListener('click', closePanel);

    // Create Report button
    panelEl.querySelector('#rb-create-btn').addEventListener('click', _generateReport);

    // Accordion headers
    panelEl.querySelectorAll('.rb-accordion-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const sectionId = header.dataset.sectionId;
        const body = header.nextElementSibling;
        const isOpen = body.classList.contains('rb-accordion-body--open');

        // Toggle this accordion
        if (isOpen) {
          body.classList.remove('rb-accordion-body--open');
          header.querySelector('.rb-accordion-chevron').innerHTML = '&#9660;';
        } else {
          body.classList.add('rb-accordion-body--open');
          header.querySelector('.rb-accordion-chevron').innerHTML = '&#9650;';
          // Focus the textarea
          const ta = body.querySelector('.rb-textarea');
          if (ta) setTimeout(() => ta.focus(), 50);
        }
      });
    });

    // Textarea focus/blur/input for tracking active section and cursor
    panelEl.querySelectorAll('.rb-textarea').forEach(ta => {
      ta.addEventListener('focus', () => {
        state.reportBuilder.activeTextSectionId = ta.dataset.sectionId;
        _updateCursorState(ta);
      });
      ta.addEventListener('click', () => _updateCursorState(ta));
      ta.addEventListener('keyup', () => _updateCursorState(ta));
      ta.addEventListener('input', () => {
        const sectionId = ta.dataset.sectionId;
        state.reportBuilder.sections[sectionId] = ta.value;
        _updateCursorState(ta);
        _persistState();
      });
      // Preserve cursor on blur so double-click from dashboard works
      ta.addEventListener('blur', () => {
        _updateCursorState(ta);
      });
    });

    // Chart drag-and-drop reordering
    _wireChartDragDrop();
  }

  function _updateCursorState(textarea) {
    const rb = state.reportBuilder;
    rb.cursorState.sectionId = textarea.dataset.sectionId;
    rb.cursorState.start = textarea.selectionStart;
    rb.cursorState.end = textarea.selectionEnd;
  }

  // ================================================================
  // PANEL OPEN / CLOSE
  // ================================================================
  function openPanel() {
    initReportBuilderState();
    if (!panelEl) buildPanel();

    state.reportBuilder.isOpen = true;

    // Check if chat panel is open
    const chatPanel = document.getElementById('chat-panel');
    const chatIsOpen = chatPanel && chatPanel.classList.contains('chat-panel--open');

    if (chatIsOpen) {
      // Dock under tutor: tutor top 50%, report bottom 50%
      state.reportBuilder.isDockedUnderTutor = true;
      chatPanel.style.height = '50%';
      chatPanel.style.bottom = 'auto';
      panelEl.style.top = '50%';
      panelEl.style.height = '50%';
    } else {
      state.reportBuilder.isDockedUnderTutor = false;
      panelEl.style.top = '0';
      panelEl.style.height = '100%';
    }

    panelEl.classList.remove('rb-panel--closed');
    panelEl.classList.add('rb-panel--open');

    // Shift dashboard
    if (dashboardBody) {
      dashboardBody.style.marginRight = PANEL_WIDTH + 'px';
      dashboardBody.style.transition = 'margin-right 0.3s cubic-bezier(0.4,0,0.2,1)';
    }
    const header = document.getElementById('section-header');
    if (header) {
      header.style.right = PANEL_WIDTH + 'px';
      header.style.transition = 'right 0.3s cubic-bezier(0.4,0,0.2,1)';
    }

    // Add visual indicators to dashboard
    _addDashboardIndicators();
    _refreshDefaultMetrics();
    _renderChartsList();
    _renderMetricsList();
    _restoreStateToUI();
    _persistState();

    // Update button state
    const btn = document.getElementById('btn-report-builder');
    if (btn) btn.classList.add('chat-header-btn--active');
  }

  function closePanel() {
    if (!panelEl) return;

    state.reportBuilder.isOpen = false;
    state.reportBuilder.isDockedUnderTutor = false;

    panelEl.classList.remove('rb-panel--open');
    panelEl.classList.add('rb-panel--closed');

    // Reset chat panel if it was docked
    const chatPanel = document.getElementById('chat-panel');
    if (chatPanel) {
      chatPanel.style.height = '';
      chatPanel.style.bottom = '';
    }
    panelEl.style.top = '';
    panelEl.style.height = '';

    // Only reset dashboard margin if chat panel is also closed
    const chatIsOpen = chatPanel && chatPanel.classList.contains('chat-panel--open');
    if (!chatIsOpen) {
      if (dashboardBody) dashboardBody.style.marginRight = '';
      const header = document.getElementById('section-header');
      if (header) header.style.right = '';
    }

    _removeDashboardIndicators();
    _persistState();

    // Update button state
    const btn = document.getElementById('btn-report-builder');
    if (btn) btn.classList.remove('chat-header-btn--active');
  }

  function togglePanel() {
    if (state.reportBuilder?.isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  // ================================================================
  // DASHBOARD INDICATORS (visual cues when builder is open)
  // ================================================================
  function _addDashboardIndicators() {
    document.body.classList.add('rb-active');
  }

  function _removeDashboardIndicators() {
    document.body.classList.remove('rb-active');
  }

  // ================================================================
  // TEXT INSERTION
  // ================================================================
  function insertFact(label, value, format, year) {
    const rb = state.reportBuilder;
    if (!rb.isOpen) return;

    const sectionId = rb.activeTextSectionId || rb.cursorState.sectionId;
    if (!sectionId) {
      _showToast('Click a text section first to insert facts.');
      return;
    }

    const factText = formatFactForInsertion(label, value, format, year);
    const textarea = panelEl.querySelector(`.rb-textarea[data-section-id="${sectionId}"]`);
    if (!textarea) return;

    // Ensure accordion is open
    const body = textarea.closest('.rb-accordion-body');
    if (body && !body.classList.contains('rb-accordion-body--open')) {
      body.classList.add('rb-accordion-body--open');
      const header = body.previousElementSibling;
      if (header) header.querySelector('.rb-accordion-chevron').innerHTML = '&#9650;';
    }

    const start = rb.cursorState.sectionId === sectionId ? rb.cursorState.start : textarea.value.length;
    const end = rb.cursorState.sectionId === sectionId ? rb.cursorState.end : textarea.value.length;

    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);

    // Add spacing if inserting mid-text
    const needsSpaceBefore = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
    const spacer = needsSpaceBefore ? ' ' : '';

    textarea.value = before + spacer + factText + after;
    rb.sections[sectionId] = textarea.value;

    // Move cursor after inserted text
    const newPos = start + spacer.length + factText.length;
    textarea.setSelectionRange(newPos, newPos);
    rb.cursorState.start = newPos;
    rb.cursorState.end = newPos;

    textarea.focus();
    _persistState();
    _showToast(`Inserted: ${label}`);
  }

  // ================================================================
  // CHART SELECTION
  // ================================================================
  function addChart(chartId, title, imageData) {
    const rb = state.reportBuilder;
    if (!rb.isOpen) return;

    // Check duplicate
    if (rb.selectedCharts.some(c => c.id === chartId)) {
      _showToast('This chart is already selected.');
      return;
    }

    // Check limit
    if (rb.selectedCharts.length >= MAX_CHARTS) {
      _showToast(`Maximum ${MAX_CHARTS} charts. Remove one first.`);
      return;
    }

    rb.selectedCharts.push({
      id: chartId,
      title: title,
      imageData: imageData,
      sourceKey: 'chart-section',
      sortOrder: rb.selectedCharts.length,
    });

    _renderChartsList();
    _persistState();
    _showToast(`Chart added: ${title}`);
  }

  function removeChart(chartId) {
    const rb = state.reportBuilder;
    rb.selectedCharts = rb.selectedCharts.filter(c => c.id !== chartId);
    // Re-index sort order
    rb.selectedCharts.forEach((c, i) => c.sortOrder = i);
    _renderChartsList();
    _persistState();
  }

  function _renderChartsList() {
    const container = panelEl?.querySelector('#rb-charts-list');
    const countEl = panelEl?.querySelector('#rb-chart-count');
    if (!container) return;

    const rb = state.reportBuilder;
    if (countEl) countEl.textContent = `${rb.selectedCharts.length}/${MAX_CHARTS}`;

    if (rb.selectedCharts.length === 0) {
      container.innerHTML = '<p class="rb-empty-msg">No charts selected. Double-click a chart on the dashboard.</p>';
      return;
    }

    container.innerHTML = rb.selectedCharts.map((chart, i) => `
      <div class="rb-chart-item" draggable="true" data-chart-id="${chart.id}" data-sort="${i}">
        <span class="rb-chart-drag-handle">&#9776;</span>
        <img class="rb-chart-thumb" src="${chart.imageData}" alt="${chart.title}" />
        <span class="rb-chart-title">${chart.title}</span>
        <button class="rb-remove-btn" data-chart-id="${chart.id}" title="Remove">&times;</button>
      </div>
    `).join('');

    // Wire remove buttons
    container.querySelectorAll('.rb-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeChart(btn.dataset.chartId);
      });
    });

    _wireChartDragDrop();
  }

  function _wireChartDragDrop() {
    const container = panelEl?.querySelector('#rb-charts-list');
    if (!container) return;

    let dragItem = null;

    container.querySelectorAll('.rb-chart-item[draggable]').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        dragItem = item;
        item.classList.add('rb-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        if (dragItem) dragItem.classList.remove('rb-dragging');
        dragItem = null;
        container.querySelectorAll('.rb-chart-item').forEach(el => el.classList.remove('rb-drag-over'));
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('rb-drag-over');
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('rb-drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('rb-drag-over');
        if (!dragItem || dragItem === item) return;

        const rb = state.reportBuilder;
        const fromId = dragItem.dataset.chartId;
        const toId = item.dataset.chartId;
        const fromIdx = rb.selectedCharts.findIndex(c => c.id === fromId);
        const toIdx = rb.selectedCharts.findIndex(c => c.id === toId);
        if (fromIdx < 0 || toIdx < 0) return;

        // Swap
        const [moved] = rb.selectedCharts.splice(fromIdx, 1);
        rb.selectedCharts.splice(toIdx, 0, moved);
        rb.selectedCharts.forEach((c, i) => c.sortOrder = i);

        _renderChartsList();
        _persistState();
      });
    });
  }

  // ================================================================
  // METRIC SELECTION
  // ================================================================
  function addMetric(id, label, formattedValue, rawValue, sourceKey) {
    const rb = state.reportBuilder;
    if (!rb.isOpen) return;

    // Check if it's a default metric
    if (DEFAULT_METRICS.includes(id)) {
      _showToast('This metric is already included by default.');
      return;
    }

    // Check duplicate
    if (rb.selectedMetrics.additional.some(m => m.id === id)) {
      _showToast('This metric is already selected.');
      return;
    }

    // Check limit
    if (rb.selectedMetrics.additional.length >= MAX_ADDITIONAL_METRICS) {
      _showToast(`Maximum ${MAX_ADDITIONAL_METRICS} additional metrics. Remove one first.`);
      return;
    }

    rb.selectedMetrics.additional.push({
      id, label, formattedValue, rawValue, sourceKey,
    });

    _renderMetricsList();
    _persistState();
    _showToast(`Metric added: ${label}`);
  }

  function removeMetric(metricId) {
    const rb = state.reportBuilder;
    rb.selectedMetrics.additional = rb.selectedMetrics.additional.filter(m => m.id !== metricId);
    _renderMetricsList();
    _persistState();
  }

  function _renderMetricsList() {
    const container = panelEl?.querySelector('#rb-metrics-list');
    const countEl = panelEl?.querySelector('#rb-metrics-count');
    if (!container) return;

    const rb = state.reportBuilder;
    if (countEl) countEl.textContent = `${rb.selectedMetrics.additional.length}/${MAX_ADDITIONAL_METRICS}`;

    if (rb.selectedMetrics.additional.length === 0) {
      container.innerHTML = '<p class="rb-empty-msg">No additional metrics. Double-click metric cards on the dashboard.</p>';
      return;
    }

    container.innerHTML = rb.selectedMetrics.additional.map(metric => `
      <div class="rb-metric-item">
        <div class="rb-metric-info">
          <span class="rb-metric-label">${metric.label}</span>
          <span class="rb-metric-value">${metric.formattedValue}</span>
        </div>
        <button class="rb-remove-btn" data-metric-id="${metric.id}" title="Remove">&times;</button>
      </div>
    `).join('');

    // Wire remove buttons
    container.querySelectorAll('.rb-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeMetric(btn.dataset.metricId);
      });
    });
  }

  // ================================================================
  // STATE RESTORE (on reopen)
  // ================================================================
  function _restoreStateToUI() {
    if (!panelEl || !state.reportBuilder) return;
    const rb = state.reportBuilder;

    // Restore text areas
    panelEl.querySelectorAll('.rb-textarea').forEach(ta => {
      const sectionId = ta.dataset.sectionId;
      if (rb.sections[sectionId]) {
        ta.value = rb.sections[sectionId];
      }
    });
  }

  // ================================================================
  // STATE PERSISTENCE (localStorage)
  // ================================================================
  function _persistState() {
    try {
      const rb = state.reportBuilder;
      const toSave = {
        sections: rb.sections,
        selectedCharts: rb.selectedCharts,
        selectedMetrics: rb.selectedMetrics,
        generatedReportMeta: rb.generatedReportMeta,
      };
      localStorage.setItem('tutordcf_report_builder', JSON.stringify(toSave));
    } catch (e) {
      // localStorage full or unavailable
    }
  }

  function _loadPersistedState() {
    try {
      const saved = localStorage.getItem('tutordcf_report_builder');
      if (!saved) return;
      const data = JSON.parse(saved);
      const rb = state.reportBuilder;
      if (data.sections) Object.assign(rb.sections, data.sections);
      if (data.selectedCharts) rb.selectedCharts = data.selectedCharts;
      if (data.selectedMetrics?.additional) rb.selectedMetrics.additional = data.selectedMetrics.additional;
      if (data.generatedReportMeta) Object.assign(rb.generatedReportMeta, data.generatedReportMeta);
    } catch (e) {
      // Corrupted data, ignore
    }
  }

  // ================================================================
  // TOAST NOTIFICATIONS
  // ================================================================
  function _showToast(message) {
    const toast = panelEl?.querySelector('#rb-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('rb-toast--visible');

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('rb-toast--visible');
    }, 2500);
  }

  // ================================================================
  // REPORT GENERATION
  // ================================================================
  function _generateReport() {
    const rb = state.reportBuilder;

    // Refresh default metrics with latest values
    _refreshDefaultMetrics();

    // Build report payload
    const payload = {
      sections: { ...rb.sections },
      charts: rb.selectedCharts.map(c => ({ ...c })),
      metrics: {
        default: rb.selectedMetrics.default.map(m => ({ ...m })),
        additional: rb.selectedMetrics.additional.map(m => ({ ...m })),
      },
      meta: {
        companyName: state.rawData?.companyName || state.historical?.companyName || rb.generatedReportMeta.companyName || 'Company',
        reportTitle: rb.generatedReportMeta.reportTitle || '',
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        analystName: rb.generatedReportMeta.analystName || '',
      },
    };

    // Use the renderer to open in new tab
    if (typeof window.TutorDCFReportRenderer === 'function') {
      window.TutorDCFReportRenderer(payload);
    } else {
      console.error('[ReportBuilder] Renderer not loaded.');
      _showToast('Report renderer not available.');
    }
  }

  // ================================================================
  // CHART CAPTURE UTILITY
  // ================================================================
  /**
   * Capture a chart card as a static image.
   * @param {HTMLElement} chartCard - The .chart-card element
   * @returns {{ id: string, title: string, imageData: string } | null}
   */
  function captureChart(chartCard) {
    if (!chartCard) return null;

    // Get the canvas element
    const canvas = chartCard.querySelector('canvas');
    if (!canvas) return null;

    // Get chart title from teaching note or badge context
    const titleEl = chartCard.querySelector('.chart-teaching-note');
    let title = '';
    if (titleEl) {
      // Extract first sentence as title
      const text = titleEl.textContent.trim();
      title = text.split('.')[0] || text.substring(0, 60);
    }

    // Fallback: use canvas id
    if (!title && canvas.id) {
      title = canvas.id.replace('canvas-', '').replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    }

    try {
      // Use JPEG at 0.7 quality to keep data URIs manageable and prevent tab crashes
      const imageData = canvas.toDataURL('image/jpeg', 0.7);
      const id = canvas.id || 'chart-' + Date.now();
      return { id, title, imageData };
    } catch (e) {
      console.warn('[ReportBuilder] Could not capture chart:', e);
      return null;
    }
  }

  // ================================================================
  // INTEGRATION HOOKS (called by existing modules)
  // ================================================================

  /**
   * Called when a DCF table cell or Key Metrics cell is double-clicked.
   * Extracts metadata from data attributes and inserts into active text area.
   */
  function onDashboardValueDblClick(element) {
    if (!state.reportBuilder?.isOpen) return;

    const label = element.dataset.reportLabel || element.dataset.lineItem || '';
    const year = element.dataset.reportYear || element.dataset.year || '';
    const value = element.dataset.reportValue || element.textContent.trim();
    const format = element.dataset.reportFormat || 'plain';
    const source = element.dataset.reportSource || '';

    if (!label) return;

    // Clean label for display
    const cleanLabel = label
      .replace(/^km_/, '')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();

    insertFact(cleanLabel, value, format, year);
  }

  /**
   * Called when a chart is double-clicked while builder is open.
   */
  function onChartDblClick(chartCard) {
    if (!state.reportBuilder?.isOpen) return;

    const data = captureChart(chartCard);
    if (!data) {
      _showToast('Could not capture this chart.');
      return;
    }

    addChart(data.id, data.title, data.imageData);
  }

  /**
   * Called when a diagnostics tile is double-clicked while builder is open.
   */
  function onDiagTileDblClick(tileEl) {
    if (!state.reportBuilder?.isOpen) return;

    const label = tileEl.dataset.reportLabel || tileEl.querySelector('.fd-tile-label')?.textContent || '';
    const value = tileEl.dataset.reportValue || tileEl.querySelector('.fd-tile-value')?.textContent || '';
    const format = tileEl.dataset.reportFormat || 'plain';
    const year = tileEl.dataset.reportYear || '';

    if (!label) return;
    insertFact(label, value, format, year);
  }

  /**
   * Called when a metric card on the dashboard is double-clicked for metric selection.
   */
  function onMetricCardDblClick(cardEl) {
    if (!state.reportBuilder?.isOpen) return;

    const id = cardEl.dataset.metricId || cardEl.dataset.metricKey || '';
    const label = cardEl.dataset.metricLabel || cardEl.querySelector('.fd-tile-label')?.textContent || '';
    const formattedValue = cardEl.dataset.metricFormatted || cardEl.querySelector('.fd-tile-value')?.textContent || '';
    const rawValue = cardEl.dataset.metricRaw || '';
    const sourceKey = cardEl.dataset.reportSource || 'diagnostics';

    if (!id || !label) return;
    addMetric(id, label, formattedValue, parseFloat(rawValue) || null, sourceKey);
  }

  // ================================================================
  // PUBLIC API
  // ================================================================
  window.ReportBuilder = {
    init: function () {
      initReportBuilderState();
      _loadPersistedState();
    },
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    isOpen: function () { return !!state.reportBuilder?.isOpen; },

    // Integration hooks
    onDashboardValueDblClick,
    onChartDblClick,
    onDiagTileDblClick,
    onMetricCardDblClick,
    insertFact,
    addChart,
    addMetric,

    // Formatting (reusable)
    formatFact: formatFactForInsertion,
    fmtCurrency: _reportFmtCurrency,
    fmtPercent: _reportFmtPercent,
    fmtMultiple: _reportFmtMultiple,
    fmtPrice: _reportFmtPrice,
  };

  // Auto-init on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    initReportBuilderState();
    _loadPersistedState();
  });

})();
