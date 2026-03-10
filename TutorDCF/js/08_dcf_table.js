/* ============================================================
   TASK 08 - DCF Projection Table + Formula Trace Bar
   Renders the full DCF model table into #section-dcf-table.
   Sections:
     1. Historical actuals + projection rows (base year + forecast years)
     2. Discounting rows (mid-year convention)
     3. Valuation bridge (EV -> equity -> implied price)
   Table ties out exactly to state.dcf.summary.enterpriseValue.
   Called by recalculate() and on initial load.

   Formula Trace Bar:
     Clicking any numeric cell shows a human-readable formula,
     expanded math, and source pointers for each component.
============================================================ */

// --- Active tab state for DCF Projection vs Key Metrics ---
let _dcfActiveTab = 'projection'; // 'projection' | 'metrics'

// --- Local formatting helpers (mirror 06_executive_summary.js) ---
function tblFmt(val, decimals = 1) {
  if (val === null || val === undefined || !isFinite(val)) return '\u2014';
  return val.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function tblFmtPct(val) {
  if (val === null || val === undefined || !isFinite(val)) return '\u2014';
  return (val * 100).toFixed(1) + '%';
}

// --- Mapping from display labels to trace registry keys ---
const _LABEL_TO_TRACE_KEY = {
  'Revenue':                     'revenue',
  'EBIT':                        'ebit',
  'EBIT Margin':                 'ebit_margin',
  '(-) Taxes':                   'taxes',
  'NOPAT':                       'nopat',
  '(+) D&A':                     'da',
  '(-) CapEx':                   'capex',
  '(-) \u0394Working Capital':   'delta_wc',
  'Unlevered Free Cash Flow':    'ufcf',
  'Discount Factor':             'discount_factor',
  'PV of FCF':                   'pv_fcf',
  'Terminal FCF (\u00d71+g)':    'terminal_fcf',
  'Terminal Value':               'terminal_value',
  'PV of Terminal Value':         'pv_terminal_value',
  'NPV of FCFs':                 'npv_fcfs',
  '(+) PV of Terminal Value':    'pv_terminal_value',
  'Enterprise Value':             'enterprise_value',
  '(-) Net Debt':                'net_debt',
  '(-) Minority Interest':       'minority_interest',
  'Equity Value':                 'equity_value',
  '\u00f7 Shares Outstanding':   'shares_outstanding',
  'Implied Share Price':          'implied_share_price',
  'Current Price':                'current_price',
  'Upside / Downside':           'upside',
};

// --- Build a table row <tr> with data attributes for trace ---
// opts.lineItemKey: stable key for formula trace
// opts.cellClasses: optional array of CSS class strings, one per value cell
function tableRow(label, values, opts = {}) {
  const {
    bold        = false,
    highlight   = false,
    indent      = false,
    isTotal     = false,
    isPct       = false,
    decimals    = 1,
    topBorder   = false,
    accentClass = '',
    cellClasses = null,
    lineItemKey = '',
    yearLabels  = null,
  } = opts;

  const labelStyle = [
    bold   ? 'font-weight:600;color:var(--text-primary);' : '',
    indent ? 'padding-left:var(--space-6);' : '',
  ].join('');

  const rowClass = [
    'table-row',
    highlight ? 'row-highlight' : '',
    isTotal   ? 'row-total'     : '',
    topBorder ? 'row-top-border': '',
  ].filter(Boolean).join(' ');

  const cells = values.map((v, i) => {
    const formatted = isPct ? tblFmtPct(v) : tblFmt(v, decimals);
    const cls = [accentClass, cellClasses ? cellClasses[i] || '' : ''].filter(Boolean).join(' ');
    const yearAttr = yearLabels && yearLabels[i] ? ` data-year="${yearLabels[i]}"` : '';
    const keyAttr = lineItemKey ? ` data-line-item="${lineItemKey}"` : '';
    // Only add clickable class to cells with actual values
    const hasValue = v !== null && v !== undefined && isFinite(v);
    const clickCls = (hasValue && lineItemKey) ? ' dcf-cell-clickable' : '';
    // Report Builder metadata
    const reportLabel = hasValue ? ` data-report-label="${label}"` : '';
    const reportValue = hasValue ? ` data-report-value="${v}"` : '';
    const reportFmt = hasValue ? ` data-report-format="${isPct ? 'percent' : 'currency'}"` : '';
    const reportSrc = hasValue ? ' data-report-source="dcf-projection"' : '';
    return `<td class="${cls}${clickCls}"${keyAttr}${yearAttr}${reportLabel}${reportValue}${reportFmt}${reportSrc}>${formatted}</td>`;
  }).join('');

  return `
    <tr class="${rowClass}">
      <td style="${labelStyle}">${label}</td>
      ${cells}
    </tr>
  `;
}

// --- Build a section header row ---
function sectionHeaderRow(label, colCount) {
  return `
    <tr class="table-row section-header-row">
      <td colspan="${colCount + 1}" style="
        background:var(--bg-secondary);
        color:var(--text-muted);
        font-size:0.6875rem;
        font-weight:600;
        letter-spacing:0.06em;
        text-transform:uppercase;
        padding:var(--space-2) var(--space-4);
      ">${label}</td>
    </tr>
  `;
}

// --- Inject sticky-column + trace bar CSS (idempotent) ---
function injectDCFTableStickyStyle() {
  if (document.getElementById('dcf-table-sticky-style')) return;
  const style = document.createElement('style');
  style.id = 'dcf-table-sticky-style';
  style.textContent = `
    /* Safari fix: sticky doesn't work with border-collapse: collapse */
    #dcfTable, #kmTable {
      border-collapse: separate !important;
      border-spacing: 0;
    }

    /* Freeze first column in every row (th and td) */
    #dcfTable thead tr th:first-child,
    #dcfTable tbody tr:not(.section-header-row) td:first-child,
    #kmTable thead tr th:first-child,
    #kmTable tbody tr:not(.section-header-row) td:first-child {
      position: sticky;
      left: 0;
      z-index: 2;
      background: var(--bg-tertiary);
      border-right: 1px solid var(--border-strong);
      box-shadow: 2px 0 4px rgba(0, 0, 0, 0.15);
    }

    /* Header cells get the header background */
    #dcfTable thead tr th:first-child,
    #kmTable thead tr th:first-child {
      background: var(--bg-secondary);
      z-index: 3;
    }

    /* Section header rows span full width - not sticky */
    #dcfTable tbody tr.section-header-row td,
    #kmTable tbody tr.section-header-row td {
      position: static;
    }

    /* Row hover: sticky cell inherits the hover background */
    #dcfTable tbody tr.table-row:hover td:first-child,
    #kmTable tbody tr.table-row:hover td:first-child {
      background: var(--bg-elevated);
    }

    /* Highlighted row sticky cell */
    #dcfTable tbody tr.row-highlight td:first-child,
    #kmTable tbody tr.row-highlight td:first-child {
      background: var(--bg-elevated);
    }
    #dcfTable tbody tr.row-highlight:hover td:first-child,
    #kmTable tbody tr.row-highlight:hover td:first-child {
      background: var(--bg-elevated);
    }

    /* --- Clickable cells --- */
    .dcf-cell-clickable {
      cursor: pointer;
      transition: background 0.12s ease;
    }
    .dcf-cell-clickable:hover {
      background: rgba(79, 142, 247, 0.08) !important;
    }

    /* --- Selected cell highlight --- */
    .dcf-cell-selected {
      background: rgba(79, 142, 247, 0.16) !important;
      outline: 1.5px solid rgba(79, 142, 247, 0.5);
      outline-offset: -1.5px;
    }

    /* --- Formula Trace Bar --- */
    .formula-trace-bar {
      margin-top: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: var(--bg-secondary);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      font-size: 0.75rem;
      line-height: 1.55;
      color: var(--text-secondary);
      min-height: 2.2em;
      word-break: break-word;
    }

    .formula-trace-bar .ft-title {
      color: var(--text-primary);
      font-weight: 600;
      margin-right: 6px;
    }

    .formula-trace-bar .ft-formula {
      color: var(--accent-primary);
      font-weight: 500;
    }

    .formula-trace-bar .ft-math {
      color: var(--text-primary);
      font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
      font-size: 0.7rem;
    }

    .formula-trace-bar .ft-sep {
      color: var(--text-muted);
      margin: 0 6px;
    }

    .formula-trace-bar .ft-component {
      color: var(--text-secondary);
    }

    .formula-trace-bar .ft-source {
      color: var(--text-muted);
      font-style: italic;
      font-size: 0.675rem;
    }

    .formula-trace-bar .ft-note {
      color: var(--text-muted);
      font-size: 0.675rem;
      display: block;
      margin-top: 2px;
    }

    .formula-trace-bar .ft-empty {
      color: var(--text-muted);
      font-style: italic;
    }

    /* --- DCF Tab Toggle --- */
    .dcf-tab-toggle {
      display: inline-flex;
      gap: 0;
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      overflow: hidden;
    }
    .dcf-tab-btn {
      padding: 5px 16px;
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.02em;
      color: var(--text-muted);
      background: var(--bg-secondary);
      border: none;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      line-height: 1.4;
    }
    .dcf-tab-btn:not(:last-child) {
      border-right: 1px solid var(--border-subtle);
    }
    .dcf-tab-btn:hover {
      color: var(--text-secondary);
      background: var(--bg-tertiary);
    }
    .dcf-tab-btn.active {
      color: var(--text-primary);
      background: var(--bg-elevated);
      font-weight: 600;
    }

    /* --- Key Metrics section header rows --- */
    .km-section-header td {
      background: var(--bg-secondary) !important;
      color: var(--accent-primary) !important;
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: var(--space-2) var(--space-4);
    }
  `;
  document.head.appendChild(style);
}

// --- Initialize UI state for selected cell ---
function _initTraceUIState() {
  if (!state.ui) state.ui = {};
  if (!state.ui.selectedCell) state.ui.selectedCell = null;
}

// --- Render the Formula Trace Bar content ---
function renderFormulaTraceBar(selectedCell) {
  const bar = document.getElementById('formula-trace-bar');
  if (!bar) return;

  if (!selectedCell) {
    bar.innerHTML = '<span class="ft-empty">Select a cell to see formula and source trace.</span>';
    return;
  }

  if (typeof buildFormulaTrace !== 'function') {
    bar.innerHTML = '<span class="ft-empty">Trace module not loaded.</span>';
    return;
  }

  const trace = buildFormulaTrace(selectedCell);
  if (!trace) {
    bar.innerHTML = '<span class="ft-empty">No trace data available.</span>';
    return;
  }

  // Build the display string
  let html = '';

  // Title
  html += `<span class="ft-title">${_escTraceHtml(trace.title)}</span>`;

  // Formula
  if (trace.formulaText) {
    html += `<span class="ft-sep">|</span>`;
    html += `<span class="ft-formula">${_escTraceHtml(trace.formulaText)}</span>`;
  }

  // Expanded math
  if (trace.expandedMathText && trace.expandedMathText !== '-') {
    html += `<span class="ft-sep">|</span>`;
    html += `<span class="ft-math">${_escTraceHtml(trace.expandedMathText)}</span>`;
  }

  // Components with source pointers
  if (trace.components && trace.components.length > 0) {
    html += `<span class="ft-sep">|</span>`;
    const compParts = trace.components.map(c => {
      let part = `<span class="ft-component">${_escTraceHtml(c.label)}: ${_traceFmtForBar(c.value)}</span>`;
      const sources = [];
      if (c.statement) sources.push(c.statement);
      if (c.statePath) sources.push(c.statePath);
      if (sources.length > 0) {
        part += ` <span class="ft-source">(${_escTraceHtml(sources.join(', '))})</span>`;
      }
      return part;
    });
    html += compParts.join('<span class="ft-sep">|</span>');
  }

  // Notes
  if (trace.notes && trace.notes.length > 0) {
    for (const note of trace.notes) {
      html += `<span class="ft-note">${_escTraceHtml(note)}</span>`;
    }
  }

  bar.innerHTML = html;
}

function _escTraceHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _traceFmtForBar(val) {
  if (val === null || val === undefined || !isFinite(val)) return 'N/A';
  // Small values (likely percentages stored as decimals)
  if (Math.abs(val) < 1 && val !== 0) return (val * 100).toFixed(1) + '%';
  return val.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// --- Main render function ---
function renderDCFTable() {
  const container = document.getElementById('section-dcf-table');
  if (!container) return;

  injectDCFTableStickyStyle();
  _initTraceUIState();

  if (!state.dcf || !state.dcf.valid) {
    container.innerHTML = `
      <div class="card">
        <p class="body text-muted">DCF table unavailable - run a valuation first.</p>
      </div>`;
    return;
  }

  const d   = state.dcf;
  const f   = d.forecast;
  const s   = d.summary;
  const inp = d.inputs;
  const n   = inp.forecastYears;
  const units = state.rawData?.units ? ` (${state.rawData.units})` : '';

  // --- Historical columns (years before the base year) ---
  const histLabels = d.historicalYearLabels || [];
  const h          = d.historical || {};
  const hCount     = histLabels.length; // number of historical columns

  // --- Projection columns: Base Year + Forecast Years + Terminal ---
  const baseLabel = String(d.baseYear);
  const projYearCols = [baseLabel, ...d.forecastYearLabels, 'Terminal'];

  // --- Full column set: Historical + Projection ---
  const allYearCols = [...histLabels, ...projYearCols];
  const colCount    = allYearCols.length;

  // --- Cell class arrays ---
  // Historical cells get muted styling; base year column gets a left-border divider
  function buildCellClasses() {
    const classes = [];
    for (let i = 0; i < hCount; i++) classes.push('col-historical');
    // Base year: divider + muted base style
    classes.push('col-divider col-base');
    // Forecast years: no special class
    for (let i = 0; i < n; i++) classes.push('');
    // Terminal column
    classes.push('col-terminal');
    return classes;
  }
  const cellCls = buildCellClasses();

  // Base-year actuals from historical (last value of each series)
  const hist = state.historical?.metrics || {};
  const lastRev   = lastValue(hist.revenue)      ?? null;
  const lastEBIT  = lastValue(hist.ebit)         ?? null;
  const lastNI    = lastValue(hist.netIncome)     ?? null;
  const lastFCF   = lastValue(state.historical?.derived?.fcf) ?? null;
  const lastDA    = lastValue(hist.depreciation)  ?? null;
  const lastCapex = lastValue(hist.capex)         ?? null;
  const lastNWC   = lastValue(hist.changeInNWC)   ?? null;
  const lastTax   = lastValue(hist.incomeTax)     ?? null;

  // -- Terminal value column content --
  const termFCF      = f.fcf[n - 1] * (1 + inp.terminalGrowth);
  const termTV       = s.terminalValue;
  const termPV       = s.pvTerminal;

  // Discount factors for each forecast year (mid-year)
  const discFactors  = f.fcf.map((_, i) => 1 / Math.pow(1 + inp.wacc, i + 0.5));
  const termFactor   = 1 / Math.pow(1 + inp.wacc, n);

  // Running total check - should equal enterpriseValue
  const pvFCFTotal   = f.pvFCF.reduce((a, b) => a + b, 0);
  const evCheck      = pvFCFTotal + termPV;

  // -- Build table header --
  const headerCells = allYearCols.map((y, i) => {
    const classes = ['table-header'];
    if (i < hCount) {
      classes.push('col-historical');
    } else if (i === hCount) {
      classes.push('col-divider', 'col-base');
    } else if (i === allYearCols.length - 1) {
      classes.push('col-terminal');
    }
    return `<th class="${classes.join(' ')}">${y}</th>`;
  }).join('');

  // -- Period label row (Historical | Projected) --
  const periodLabelRow = (hCount > 0) ? `
    <tr>
      <th class="table-header" style="text-align:left;border-bottom:none;padding-bottom:0;"></th>
      ${hCount > 0 ? `<th class="table-header col-historical" colspan="${hCount}" style="text-align:center;border-bottom:none;padding-bottom:0;">
        <span class="period-badge badge-historical">Historical</span>
      </th>` : ''}
      <th class="table-header col-divider" colspan="${projYearCols.length}" style="text-align:center;border-bottom:none;padding-bottom:0;">
        <span class="period-badge badge-projected">Projected</span>
      </th>
    </tr>
  ` : '';

  // -- Build HTML --
  const tabToggleHtml = `
    <div class="dcf-tab-toggle">
      <button class="dcf-tab-btn ${_dcfActiveTab === 'projection' ? 'active' : ''}" data-tab="projection">DCF Projection</button>
      <button class="dcf-tab-btn ${_dcfActiveTab === 'metrics' ? 'active' : ''}" data-tab="metrics">Key Metrics</button>
    </div>`;

  const html = `
    <div class="card-elevated" style="margin-bottom:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-5);">
        <div style="display:flex;align-items:center;gap:var(--space-4);">
          <h2 class="h2" style="margin:0;">${_dcfActiveTab === 'projection' ? 'DCF Projection' : 'Key Metrics'}</h2>
          ${tabToggleHtml}
        </div>
        <span class="caption">${_dcfActiveTab === 'projection' ? `${units} - Mid-year discounting - Gordon Growth terminal value` : 'Returns, Margins & Multiples (EV = current implied)'}</span>
      </div>

      ${_dcfActiveTab === 'projection' ? _buildProjectionTableHtml(h, f, s, inp, n, histLabels, allYearCols, colCount, cellCls, lastRev, lastEBIT, lastDA, lastCapex, lastNWC, lastTax, lastFCF, termFCF, termTV, termPV, discFactors, termFactor, pvFCFTotal, evCheck, periodLabelRow, headerCells) : _buildKeyMetricsTableHtml(d, histLabels, allYearCols, colCount, cellCls, periodLabelRow, headerCells)}

      <!-- Formula Trace Bar -->
      <div class="formula-trace-bar" id="formula-trace-bar">
        <span class="ft-empty">Select a cell to see formula and source trace.</span>
      </div>

      ${_dcfActiveTab === 'projection' ? `
      <!-- Tie-out check -->
      <p class="caption" style="margin-top:var(--space-3);text-align:right;">
        EV tie-out: ${tblFmt(evCheck)} &nbsp;-&nbsp; Engine EV: ${tblFmt(s.enterpriseValue)} &nbsp;-&nbsp;
        ${Math.abs(evCheck - s.enterpriseValue) < 0.01
          ? '<span style="color:var(--accent-success);">\u2713 Ties out</span>'
          : '<span style="color:var(--accent-danger);">\u2717 Mismatch - check inputs</span>'}
      </p>` : ''}
    </div>
  `;

  container.innerHTML = html;

  // Wire tab toggle clicks
  container.querySelectorAll('.dcf-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab && tab !== _dcfActiveTab) {
        _dcfActiveTab = tab;
        state.ui.selectedCell = null; // clear selection on tab switch
        renderDCFTable();
      }
    });
  });

  // Wire click handlers for formula trace (works for both tables)
  const tableId = _dcfActiveTab === 'projection' ? 'dcfTable' : 'kmTable';
  _wireCellClickHandlersOnTable(tableId);

  // Restore selection if a cell was previously selected
  if (state.ui.selectedCell) {
    const { lineItemKey, year } = state.ui.selectedCell;
    const table = document.getElementById(tableId);
    if (table) {
      const cell = table.querySelector(`td[data-line-item="${lineItemKey}"][data-year="${year}"]`);
      if (cell) {
        cell.classList.add('dcf-cell-selected');
        renderFormulaTraceBar(state.ui.selectedCell);
      } else {
        renderFormulaTraceBar(null);
      }
    }
  }
}

// --- Wire cell click handlers on a specific table ---
function _wireCellClickHandlersOnTable(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  table.addEventListener('click', (e) => {
    const td = e.target.closest('td.dcf-cell-clickable');
    if (!td) return;

    const lineItemKey = td.dataset.lineItem;
    const year = td.dataset.year;
    if (!lineItemKey || !year) return;

    _initTraceUIState();
    state.ui.selectedCell = { lineItemKey, year, scenario: 'base' };

    table.querySelectorAll('.dcf-cell-selected').forEach(el => el.classList.remove('dcf-cell-selected'));
    td.classList.add('dcf-cell-selected');
    renderFormulaTraceBar(state.ui.selectedCell);
  });

  // Report Builder: double-click to insert fact
  table.addEventListener('dblclick', (e) => {
    const td = e.target.closest('td.dcf-cell-clickable');
    if (!td) return;
    if (typeof ReportBuilder !== 'undefined' && ReportBuilder.isOpen()) {
      ReportBuilder.onDashboardValueDblClick(td);
    }
  });
}

// ============================================================
// DCF Projection Table HTML Builder (extracted from renderDCFTable)
// ============================================================

function _buildProjectionTableHtml(h, f, s, inp, n, histLabels, allYearCols, colCount, cellCls, lastRev, lastEBIT, lastDA, lastCapex, lastNWC, lastTax, lastFCF, termFCF, termTV, termPV, discFactors, termFactor, pvFCFTotal, evCheck, periodLabelRow, headerCells) {
  const hCount = histLabels.length;

  function row(label, histArr, baseVal, forecastArr, terminalVal, opts = {}) {
    let hVals;
    if (!histArr || histArr.length === 0) {
      hVals = Array(hCount).fill(null);
    } else if (histArr.length < hCount) {
      hVals = [...histArr, ...Array(hCount - histArr.length).fill(null)];
    } else {
      hVals = histArr.slice(0, hCount);
    }
    const values = [...hVals, baseVal, ...forecastArr, terminalVal];
    const traceKey = _LABEL_TO_TRACE_KEY[label] || '';
    return tableRow(label, values, { ...opts, cellClasses: cellCls, lineItemKey: traceKey, yearLabels: allYearCols });
  }

  function bridgeRow(label, termVal, opts = {}) {
    const values = [...Array(hCount).fill(null), null, ...Array(n).fill(null), termVal];
    const traceKey = _LABEL_TO_TRACE_KEY[label] || '';
    return tableRow(label, values, { ...opts, cellClasses: cellCls, lineItemKey: traceKey, yearLabels: allYearCols });
  }

  return `
      <div class="table-container">
        <table id="dcfTable">
          <thead>
            ${periodLabelRow}
            <tr>
              <th class="table-header" style="text-align:left;min-width:200px;">Line Item</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>

            ${sectionHeaderRow('Income Statement Bridge', colCount)}

            ${row('Revenue', h.revenue, lastRev, f.revenue, null, { indent: false })}
            ${row('EBIT', h.ebit, lastEBIT, f.ebit, null, { indent: true })}
            ${row('EBIT Margin', h.ebitMargin,
              (lastEBIT != null && lastRev != null && lastRev !== 0) ? lastEBIT / lastRev : null,
              f.ebit.map((e, i) => {
                const rev = f.revenue[i];
                return (e !== null && rev !== null && rev !== 0) ? e / rev : null;
              }), null, { indent: true, isPct: true })}
            ${row('(-) Taxes',
              h.incomeTax ? h.incomeTax.map(v => v != null ? -Math.abs(v) : null) : null,
              lastTax != null ? -Math.abs(lastTax) : null,
              f.nopat.map((np, i) => {
                const e = f.ebit[i];
                return (e !== null && np !== null) ? -(e - np) : null;
              }), null, { indent: true })}
            ${row('NOPAT',
              (h.ebit && h.incomeTax) ? h.ebit.map((e, i) => {
                const tax = h.incomeTax[i];
                return (e != null && tax != null) ? e - Math.abs(tax) : null;
              }) : null,
              (lastEBIT != null && lastTax != null) ? lastEBIT - Math.abs(lastTax) : null,
              f.nopat, null, { bold: true })}

            ${sectionHeaderRow('Free Cash Flow Build', colCount)}

            ${row('(+) D&A',
              h.depreciation ? h.depreciation.map(v => v != null ? Math.abs(v) : null) : null,
              lastDA != null ? Math.abs(lastDA) : null,
              f.da, null, { indent: true })}
            ${row('(-) CapEx',
              h.capex ? h.capex.map(v => v != null ? -Math.abs(v) : null) : null,
              lastCapex != null ? -Math.abs(lastCapex) : null,
              f.capex.map(v => v !== null ? -v : null), null, { indent: true })}
            ${row('(-) \u0394Working Capital',
              h.nwcDelta ? h.nwcDelta.map(v => v != null ? v : null) : null,
              lastNWC != null ? lastNWC : null,
              f.nwcDelta.map(v => v !== null ? -v : null), null, { indent: true })}
            ${row('Unlevered Free Cash Flow', h.fcf, lastFCF, f.fcf, termFCF, { bold: true, topBorder: true })}

            ${sectionHeaderRow('Discounting (Mid-Year Convention)', colCount)}

            ${row('Discount Factor', null, null, discFactors, termFactor, { decimals: 4 })}
            ${row('PV of FCF', null, null, f.pvFCF, null, { bold: true })}

            ${sectionHeaderRow('Terminal Value', colCount)}
            ${row('Terminal FCF (\u00d71+g)', null, null, [...Array(n - 1).fill(null), termFCF], null, { indent: true })}
            ${row('Terminal Value', null, null, Array(n).fill(null), termTV, { indent: true })}
            ${row('PV of Terminal Value', null, null, Array(n).fill(null), termPV, { bold: true })}

            ${sectionHeaderRow('Valuation Bridge', colCount)}

            ${bridgeRow('NPV of FCFs', pvFCFTotal, { bold: false })}
            ${bridgeRow('(+) PV of Terminal Value', termPV, {})}
            ${bridgeRow('Enterprise Value', evCheck, { bold: true, topBorder: true, accentClass: 'text-terminal' })}
            ${bridgeRow('(-) Net Debt', s.netDebt !== null ? -s.netDebt : null, {})}
            ${bridgeRow('(-) Minority Interest', s.minorityInterest !== null ? -s.minorityInterest : null, {})}
            ${bridgeRow('Equity Value', s.equityValue, { bold: true })}
            ${bridgeRow('\u00f7 Shares Outstanding', inp.sharesOutstanding, { indent: true })}
            ${bridgeRow('Implied Share Price', s.impliedPrice, {
              bold: true,
              highlight: true,
              accentClass: s.upside == null ? '' : s.upside >= 0 ? 'text-success' : 'text-danger',
              decimals: 2,
            })}
            ${inp.currentPrice ? bridgeRow('Current Price', inp.currentPrice, { indent: true, decimals: 2 }) : ''}
            ${s.upside != null ? bridgeRow('Upside / Downside', s.upside, {
              indent: true,
              isPct: true,
              accentClass: s.upside >= 0 ? 'text-success' : 'text-danger',
            }) : ''}

          </tbody>
        </table>
      </div>`;
}

// ============================================================
// KEY METRICS TABLE
// ============================================================

// Row config for key metrics
const _KM_ROW_CONFIG = [
  // Returns
  { section: 'Returns' },
  { label: 'ROI (NOPAT / IC)',   key: 'roi',    format: 'percent' },
  { label: 'ROIC',               key: 'roic',   format: 'percent' },
  { label: 'ROE',                key: 'roe',    format: 'percent' },
  { label: 'ROA',                key: 'roa',    format: 'percent' },
  // Margins
  { section: 'Margins' },
  { label: 'EBITDA Margin',      key: 'ebitda_margin', format: 'percent' },
  { label: 'EBIT Margin',        key: 'ebit_margin',   format: 'percent' },
  { label: 'Net Margin',         key: 'net_margin',    format: 'percent' },
  // Multiples
  { section: 'Multiples (Current Implied EV)' },
  { label: 'EV / Revenue',       key: 'ev_revenue',  format: 'multiple' },
  { label: 'EV / EBITDA',        key: 'ev_ebitda',   format: 'multiple' },
  { label: 'EV / EBIT',          key: 'ev_ebit',     format: 'multiple' },
  // Leverage
  { section: 'Leverage' },
  { label: 'Net Debt / EBITDA',  key: 'net_debt_ebitda',   format: 'ratio' },
  { label: 'Interest Coverage',  key: 'interest_coverage', format: 'ratio' },
];

function _fmtKMValue(val, format) {
  if (val === null || val === undefined || !isFinite(val)) return '\u2014';
  if (format === 'percent') return (val * 100).toFixed(1) + '%';
  if (format === 'multiple') return val.toFixed(1) + 'x';
  if (format === 'ratio') return val.toFixed(1) + 'x';
  return val.toFixed(1);
}

function _buildKeyMetricsTableHtml(dcfData, histLabels, allYearCols, colCount, cellCls, periodLabelRow, headerCells) {
  const km = dcfData.keyMetrics || {};
  const hCount = histLabels.length;
  const baseLabel = String(dcfData.baseYear);
  const forecastLabels = dcfData.forecastYearLabels || [];

  // Key Metrics table excludes the Terminal column — use columns without Terminal
  const kmYearCols = allYearCols.filter(y => y !== 'Terminal');
  const kmColCount = kmYearCols.length;

  // Build cell classes without terminal
  const kmCellCls = cellCls.slice(0, -1); // remove terminal class

  // Build header cells without terminal
  const kmHeaderCells = kmYearCols.map((y, i) => {
    const classes = ['table-header'];
    if (i < hCount) {
      classes.push('col-historical');
    } else if (i === hCount) {
      classes.push('col-divider', 'col-base');
    }
    return `<th class="${classes.join(' ')}">${y}</th>`;
  }).join('');

  // Period label row for Key Metrics
  const kmPeriodLabelRow = (hCount > 0) ? `
    <tr>
      <th class="table-header" style="text-align:left;border-bottom:none;padding-bottom:0;"></th>
      ${hCount > 0 ? `<th class="table-header col-historical" colspan="${hCount}" style="text-align:center;border-bottom:none;padding-bottom:0;">
        <span class="period-badge badge-historical">Historical</span>
      </th>` : ''}
      <th class="table-header col-divider" colspan="${1 + forecastLabels.length}" style="text-align:center;border-bottom:none;padding-bottom:0;">
        <span class="period-badge badge-projected">Projected</span>
      </th>
    </tr>
  ` : '';

  // Build rows
  let rowsHtml = '';
  for (const cfg of _KM_ROW_CONFIG) {
    if (cfg.section) {
      // Section header
      rowsHtml += `
        <tr class="table-row section-header-row km-section-header">
          <td colspan="${kmColCount + 1}" style="
            background:var(--bg-secondary);
            color:var(--text-muted);
            font-size:0.6875rem;
            font-weight:600;
            letter-spacing:0.06em;
            text-transform:uppercase;
            padding:var(--space-2) var(--space-4);
          ">${cfg.section}</td>
        </tr>`;
      continue;
    }

    // Data row
    const values = kmYearCols.map(year => {
      const yearMetrics = km[year];
      if (!yearMetrics) return null;
      return yearMetrics[cfg.key] ?? null;
    });

    const traceKey = 'km_' + cfg.key;
    const cells = values.map((v, i) => {
      const formatted = _fmtKMValue(v, cfg.format);
      const cls = [kmCellCls[i] || ''].filter(Boolean).join(' ');
      const yearAttr = ` data-year="${kmYearCols[i]}"`;
      const keyAttr = ` data-line-item="${traceKey}"`;
      const hasValue = v !== null && v !== undefined && isFinite(v);
      const clickCls = hasValue ? ' dcf-cell-clickable' : '';
      // Report Builder metadata
      const reportLabel = hasValue ? ` data-report-label="${cfg.label}"` : '';
      const reportValue = hasValue ? ` data-report-value="${v}"` : '';
      const reportFmt = hasValue ? ` data-report-format="${cfg.format || 'plain'}"` : '';
      const reportSrc = hasValue ? ' data-report-source="key-metrics"' : '';
      return `<td class="${cls}${clickCls}"${keyAttr}${yearAttr}${reportLabel}${reportValue}${reportFmt}${reportSrc}>${formatted}</td>`;
    }).join('');

    rowsHtml += `
      <tr class="table-row">
        <td>${cfg.label}</td>
        ${cells}
      </tr>`;
  }

  return `
      <div class="table-container">
        <table id="kmTable">
          <thead>
            ${kmPeriodLabelRow}
            <tr>
              <th class="table-header" style="text-align:left;min-width:200px;">Metric</th>
              ${kmHeaderCells}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>`;
}
