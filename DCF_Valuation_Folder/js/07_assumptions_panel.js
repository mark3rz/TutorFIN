/* ============================================================
   TASK 07 — Assumptions Panel + "Why did valuation move?" Learning Panel
   Renders editable input fields for all DCF assumptions into
   #section-assumptions. Auto-recalculates on input changes (debounced).
   Right-hand panel explains valuation changes vs a saved Base Case
   using one-at-a-time attribution reruns.

   REQUIRED SCRIPT ORDER:
     js/assumption_glossary.js    (window.ASSUMPTION_HELP)
     js/assumption_benchmarks.js  (window.ASSUMPTION_BENCHMARKS)
     js/07_assumptions_panel.js   (this file)
============================================================ */

/** Canonical advanced assumption rows for the year-by-year grid. */
const ADVANCED_GRID_ROWS = [
  { key: 'revenueGrowth',   label: 'Revenue Growth',  format: 'pct' },
  { key: 'ebitdaMargin',    label: 'EBITDA Margin',    format: 'pct' },
  { key: 'taxRate',         label: 'Tax Rate',         format: 'pct' },
  { key: 'capexPctRevenue', label: 'CapEx % Rev',      format: 'pct' },
  { key: 'nwcPctRevenue',   label: 'NWC % Rev',        format: 'pct' },
];

// ======================================================================
// LEARNING OVERLAY STATE
// ======================================================================
window.learningState = {
  baseInputs: null,
  baseOutputs: null,     // { enterpriseValue, impliedPrice, irr, pvTerminal, terminalValue, npvFCF }
  isBaseAutoCaptured: false,
};

// ======================================================================
// INPUT FIELD DEFINITION SCHEMA
// ======================================================================
const ASSUMPTION_GROUPS = [
  {
    label: 'Forecast Settings',
    fields: [
      { key: 'forecastYears',  label: 'Forecast Years',    type: 'int',  suffix: 'yrs', min: 1,   max: 20,  step: 1 },
      { key: 'currentPrice',   label: 'Current Share Price', type: 'float', prefix: '$', min: 0,   max: null, step: 0.01 },
    ],
  },
  {
    label: 'Revenue & Margins',
    fields: [
      { key: 'revenueGrowth', label: 'Revenue Growth',  type: 'pct', suffix: '%', min: -50, max: 100, step: 0.1 },
      { key: 'ebitMargin',    label: 'EBIT Margin',     type: 'pct', suffix: '%', min: -100, max: 100, step: 0.1 },
      { key: 'taxRate',       label: 'Tax Rate',        type: 'pct', suffix: '%', min: 0,   max: 60,  step: 0.1 },
      { key: 'capexPct',      label: 'CapEx (% Rev)',   type: 'pct', suffix: '%', min: 0,   max: 50,  step: 0.1 },
      { key: 'nwcPct',        label: 'NWC Change (% Rev)', type: 'pct', suffix: '%', min: -20, max: 20, step: 0.1 },
    ],
  },
  {
    label: 'WACC Components',
    fields: [
      { key: 'costOfEquity',  label: 'Cost of Equity',  type: 'pct', suffix: '%', min: 0, max: 50, step: 0.1 },
      { key: 'costOfDebt',    label: 'Cost of Debt',    type: 'pct', suffix: '%', min: 0, max: 30, step: 0.1 },
      { key: 'equityWeight',  label: 'Equity Weight',   type: 'pct', suffix: '%', min: 0, max: 100, step: 1 },
      { key: 'debtWeight',    label: 'Debt Weight',     type: 'pct', suffix: '%', min: 0, max: 100, step: 1 },
      { key: 'wacc',          label: 'WACC (override)', type: 'pct', suffix: '%', min: 0, max: 50, step: 0.1 },
    ],
  },
  {
    label: 'Terminal Value',
    fields: [
      { key: 'terminalGrowth', label: 'Terminal Growth Rate', type: 'pct', suffix: '%', min: 0, max: 10, step: 0.1 },
    ],
  },
  {
    label: 'Balance Sheet Bridge',
    fields: [
      { key: 'netDebt',          label: 'Net Debt',           type: 'float', suffix: '', min: null, max: null, step: 1 },
      { key: 'minorityInterest', label: 'Minority Interest',  type: 'float', suffix: '', min: 0,    max: null, step: 1 },
      { key: 'sharesOutstanding',label: 'Shares Outstanding', type: 'float', suffix: '', min: 0,    max: null, step: 0.1 },
    ],
  },
];

// ======================================================================
// ATTRIBUTION DRIVER DEFINITIONS
// ======================================================================
const ATTRIBUTION_DRIVERS = [
  { key: 'revenueGrowth',  label: 'Revenue Growth',       type: 'rate' },
  { key: 'ebitMargin',     label: 'EBIT Margin',          type: 'rate' },
  { key: 'taxRate',        label: 'Tax Rate',             type: 'rate' },
  { key: 'capexPct',       label: 'CapEx (% Rev)',        type: 'rate' },
  { key: 'nwcPct',         label: 'NWC Change (% Rev)',   type: 'rate' },
  { key: 'wacc',           label: 'WACC',                 type: 'rate' },
  { key: 'terminalGrowth', label: 'Terminal Growth Rate', type: 'rate' },
  { key: 'netDebt',        label: 'Net Debt',             type: 'dollar' },
  { key: 'sharesOutstanding', label: 'Shares Outstanding', type: 'shares' },
];

// ======================================================================
// FORMAT / PARSE HELPERS
// ======================================================================
function inputDisplayValue(field, rawVal) {
  if (rawVal === null || rawVal === undefined) return '';
  if (field.type === 'pct') return (rawVal * 100).toFixed(field.step < 1 ? 1 : 0);
  if (field.type === 'int') return Math.round(rawVal);
  return Number(rawVal).toFixed(field.step < 1 ? 2 : 0);
}

function parseInputValue(field, strVal) {
  const n = parseFloat(strVal);
  if (isNaN(n)) return null;
  if (field.type === 'pct') return n / 100;
  if (field.type === 'int') return Math.round(n);
  return n;
}

// ======================================================================
// BUILD INPUT ROWS
// ======================================================================
function buildInputRow(field) {
  const val = inputDisplayValue(field, state.inputs[field.key]);
  const prefix = field.prefix ? `<span class="input-affix">${field.prefix}</span>` : '';
  const suffix = field.suffix ? `<span class="input-affix">${field.suffix}</span>` : '';
  const help = (window.ASSUMPTION_HELP || {})[field.key];
  const tooltip = help?.tooltip || '';

  return `
    <div class="assumption-field">
      <label
        for="inp-${field.key}"
        class="assumption-label"
        data-assumption-key="${field.key}"
        title="${tooltip}"
        tabindex="0"
      >${field.label}</label>
      <div class="input-wrap">
        ${prefix}
        <input
          class="input-control"
          type="number"
          id="inp-${field.key}"
          data-key="${field.key}"
          value="${val}"
          ${field.min !== null ? `min="${field.min}"` : ''}
          ${field.max !== null ? `max="${field.max}"` : ''}
          step="${field.step}"
        />
        ${suffix}
      </div>
    </div>
  `;
}

function buildGroupCard(group) {
  return `
    <div class="assumption-group">
      <p class="assumption-group-title">${group.label}</p>
      <div class="assumption-fields">
        ${group.fields.map(buildInputRow).join('')}
      </div>
    </div>
  `;
}

// ======================================================================
// COLLECT INPUTS FROM DOM
// ======================================================================
function collectInputs() {
  for (const group of ASSUMPTION_GROUPS) {
    for (const field of group.fields) {
      const el = document.getElementById(`inp-${field.key}`);
      if (!el) continue;
      const parsed = parseInputValue(field, el.value);
      if (parsed !== null) state.inputs[field.key] = parsed;
    }
  }

  const computed = state.inputs.costOfEquity * state.inputs.equityWeight
                 + state.inputs.costOfDebt   * state.inputs.debtWeight * (1 - state.inputs.taxRate);

  const waccEl = document.getElementById('inp-wacc');
  if (waccEl && Math.abs(parseInputValue({ type: 'pct', step: 0.1 }, waccEl.value) - state.inputs.wacc) < 0.0005) {
    state.inputs.wacc = computed;
  }
}

// ======================================================================
// DEBOUNCED RECALCULATION
// ======================================================================
let _recalcTimer = null;
function recalculateDebounced() {
  clearTimeout(_recalcTimer);
  _recalcTimer = setTimeout(recalculate, 200);
}

function recalculate() {
  collectInputs();

  // Keep advanced grid in sync when forecast years or basic assumptions change
  if (typeof refreshAdvancedGridIfOpen === 'function') refreshAdvancedGridIfOpen();

  calculateDCF(state.inputs, state.historical);

  // Auto-capture base case on first successful run
  if (!window.learningState.baseInputs && state.dcf && state.dcf.valid) {
    captureBaseCase();
    window.learningState.isBaseAutoCaptured = true;
  }

  if (typeof renderExecutiveMetrics === 'function') renderExecutiveMetrics();
  if (typeof renderDCFTable        === 'function') renderDCFTable();
  if (typeof renderCharts          === 'function') renderCharts();
  if (typeof renderSensitivity     === 'function') renderSensitivity();
  if (typeof renderScenario        === 'function') renderScenario();
  if (typeof renderDiagnostics     === 'function') renderDiagnostics();
  if (typeof refreshContextPanel   === 'function') refreshContextPanel();

  // Refresh WACC display after recompute
  const waccEl = document.getElementById('inp-wacc');
  if (waccEl) waccEl.value = inputDisplayValue({ type: 'pct', step: 0.1 }, state.inputs.wacc);

  // Update learning panel
  updateLearningPanel();
}

// ======================================================================
// BASE CASE MANAGEMENT
// ======================================================================
function captureBaseCase() {
  const s = state.dcf && state.dcf.summary;
  window.learningState.baseInputs = { ...state.inputs };
  window.learningState.baseOutputs = s ? {
    enterpriseValue: s.enterpriseValue,
    equityValue: s.equityValue,
    impliedPrice: s.impliedPrice,
    irr: s.irr,
    pvTerminal: s.pvTerminal,
    terminalValue: s.terminalValue,
    npvFCF: s.npvFCF,
  } : null;
}

function onSetBaseCase() {
  captureBaseCase();
  window.learningState.isBaseAutoCaptured = false;
  updateLearningPanel();
}

// ======================================================================
// ATTRIBUTION ENGINE
// ======================================================================
function hasDriverChanged(driverDef, baseInputs, currentInputs) {
  const bv = baseInputs[driverDef.key];
  const cv = currentInputs[driverDef.key];
  if (bv == null || cv == null) return false;

  if (driverDef.type === 'rate') {
    // threshold: 0.05 percentage points = 0.0005 in decimal
    return Math.abs(cv - bv) >= 0.0005;
  }
  // dollar or shares: 0.5% relative
  if (bv === 0) return cv !== 0;
  return Math.abs((cv - bv) / bv) >= 0.005;
}

function computeAttribution() {
  const ls = window.learningState;
  if (!ls.baseInputs || !ls.baseOutputs || !state.dcf || !state.dcf.valid) return null;
  if (!state.historical) return null;

  const baseIn = ls.baseInputs;
  const baseOut = ls.baseOutputs;
  const currIn = { ...state.inputs };
  const currSummary = state.dcf.summary;

  const currentOutputs = {
    enterpriseValue: currSummary.enterpriseValue,
    impliedPrice: currSummary.impliedPrice,
    irr: currSummary.irr,
  };

  // Find which drivers changed
  const changedDrivers = ATTRIBUTION_DRIVERS.filter(d => hasDriverChanged(d, baseIn, currIn));

  // One-at-a-time reruns (max 10)
  const impacts = [];
  const maxReruns = 10;
  const driversToRun = changedDrivers.slice(0, maxReruns);

  for (const driver of driversToRun) {
    const scenarioInputs = { ...baseIn, [driver.key]: currIn[driver.key] };
    const result = calculateDCFPure(scenarioInputs, state.historical);
    if (!result || !result.valid) continue;

    impacts.push({
      key: driver.key,
      label: driver.label,
      type: driver.type,
      baseVal: baseIn[driver.key],
      currVal: currIn[driver.key],
      evImpact: result.enterpriseValue - baseOut.enterpriseValue,
      priceImpact: (result.impliedPrice != null && baseOut.impliedPrice != null)
        ? result.impliedPrice - baseOut.impliedPrice : null,
      irrImpact: (result.irr != null && baseOut.irr != null)
        ? result.irr - baseOut.irr : null,
    });
  }

  // Sort by absolute EV impact descending
  impacts.sort((a, b) => Math.abs(b.evImpact) - Math.abs(a.evImpact));

  // Terminal value % of EV
  const baseTVPct = (baseOut.pvTerminal != null && baseOut.enterpriseValue)
    ? baseOut.pvTerminal / baseOut.enterpriseValue : null;
  const currTVPct = (currSummary.pvTerminal != null && currSummary.enterpriseValue)
    ? currSummary.pvTerminal / currSummary.enterpriseValue : null;

  return {
    baseOut,
    currentOutputs,
    impacts,
    baseTVPct,
    currTVPct,
  };
}

// ======================================================================
// NARRATIVE GENERATOR
// ======================================================================
function generateNarrative(attribution) {
  if (!attribution || attribution.impacts.length === 0) {
    return ['No meaningful changes from the base case.'];
  }

  const bullets = [];
  // Take top 3 drivers by absolute EV impact
  const top = attribution.impacts.slice(0, 3);

  for (const imp of top) {
    const direction = imp.evImpact > 0 ? 'increases' : 'decreases';
    const absEV = fmtCompact(Math.abs(imp.evImpact));

    switch (imp.key) {
      case 'revenueGrowth':
        bullets.push(imp.evImpact > 0
          ? `Higher revenue growth compounds across the forecast, lifting projected free cash flows and adding ${absEV} to EV.`
          : `Lower revenue growth reduces projected free cash flows across every forecast year, reducing EV by ${absEV}.`);
        break;
      case 'ebitMargin':
        bullets.push(imp.evImpact > 0
          ? `Higher EBIT margin raises NOPAT in each year, increasing free cash flow and adding ${absEV} to EV.`
          : `Lower EBIT margin compresses NOPAT, reducing free cash flow and cutting ${absEV} from EV.`);
        break;
      case 'taxRate':
        bullets.push(imp.evImpact > 0
          ? `A lower tax rate keeps more of EBIT as after-tax income, adding ${absEV} to EV.`
          : `A higher tax rate reduces after-tax income (NOPAT), removing ${absEV} from EV.`);
        break;
      case 'capexPct':
        bullets.push(imp.evImpact > 0
          ? `Lower CapEx as a share of revenue frees up more cash flow, adding ${absEV} to EV.`
          : `Higher CapEx consumes more cash flow, reducing EV by ${absEV}.`);
        break;
      case 'nwcPct':
        bullets.push(imp.evImpact > 0
          ? `Lower working capital requirements release cash, adding ${absEV} to EV.`
          : `Higher working capital needs absorb cash, reducing EV by ${absEV}.`);
        break;
      case 'wacc':
        bullets.push(imp.evImpact > 0
          ? `Lower WACC increases all present values, especially terminal value, adding ${absEV} to EV.`
          : `Higher WACC discounts future cash flows more heavily, reducing EV by ${absEV}.`);
        break;
      case 'terminalGrowth':
        bullets.push(imp.evImpact > 0
          ? `Higher terminal growth rate raises the perpetuity value, adding ${absEV} to EV.`
          : `Lower terminal growth rate reduces the perpetuity value, cutting ${absEV} from EV.`);
        break;
      case 'netDebt':
        bullets.push(imp.evImpact > 0
          ? `Lower net debt ${direction} equity value by ${absEV} (EV unchanged, but bridge improves).`
          : `Higher net debt ${direction} equity value by ${absEV} through the equity bridge.`);
        break;
      case 'sharesOutstanding':
        bullets.push(imp.priceImpact != null && imp.priceImpact > 0
          ? `Fewer shares outstanding raise the per-share implied price.`
          : `More shares outstanding dilute the per-share implied price.`);
        break;
      default:
        bullets.push(`${imp.label} ${direction} EV by ${absEV}.`);
    }
  }

  return bullets;
}

// ======================================================================
// FORMAT HELPERS
// ======================================================================
function fmtDollar(v) {
  if (v == null || !isFinite(v)) return 'N/A';
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v < 0 ? '-' : '') + '$' + (abs / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return (v < 0 ? '-' : '') + '$' + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (v < 0 ? '-' : '') + '$' + (abs / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (v < 0 ? '-' : '') + '$' + (abs / 1e3).toFixed(1) + 'K';
  return '$' + v.toFixed(2);
}

function fmtCompact(v) {
  if (v == null || !isFinite(v)) return 'N/A';
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v < 0 ? '-' : '') + '$' + (abs / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return (v < 0 ? '-' : '') + '$' + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (v < 0 ? '-' : '') + '$' + (abs / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (v < 0 ? '-' : '') + '$' + (abs / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}

function fmtPrice(v) {
  if (v == null || !isFinite(v)) return 'N/A';
  return '$' + v.toFixed(2);
}

function fmtPct(v) {
  if (v == null || !isFinite(v)) return 'N/A';
  return (v * 100).toFixed(1) + '%';
}

function fmtPP(v) {
  if (v == null || !isFinite(v)) return 'N/A';
  const pp = v * 100;
  return (pp >= 0 ? '+' : '') + pp.toFixed(2) + ' pp';
}

function fmtDelta(v, formatter) {
  if (v == null || !isFinite(v)) return 'N/A';
  const sign = v > 0 ? '+' : '';
  return sign + formatter(v);
}

function deltaColor(v) {
  if (v == null || !isFinite(v)) return 'lp-neutral';
  return v > 0 ? 'lp-positive' : v < 0 ? 'lp-negative' : 'lp-neutral';
}

function deltaColorReverse(v) {
  // For metrics where negative is good (like WACC impact on price)
  if (v == null || !isFinite(v)) return 'lp-neutral';
  return v > 0 ? 'lp-positive' : v < 0 ? 'lp-negative' : 'lp-neutral';
}

// ======================================================================
// LEARNING PANEL RENDERING
// ======================================================================
function updateLearningPanel() {
  const container = document.getElementById('learning-panel-content');
  if (!container) return;

  const ls = window.learningState;

  // No base case yet
  if (!ls.baseInputs || !ls.baseOutputs) {
    container.innerHTML = `
      <div class="lp-empty">
        <p class="lp-empty-text">Waiting for first model run to capture base case...</p>
      </div>
    `;
    return;
  }

  // DCF not valid
  if (!state.dcf || !state.dcf.valid) {
    const errMsg = state.dcf && state.dcf.errors ? state.dcf.errors.join(' ') : 'Model not ready.';
    container.innerHTML = `
      <div class="lp-empty">
        <p class="lp-empty-text lp-negative">${errMsg}</p>
      </div>
    `;
    return;
  }

  const attribution = computeAttribution();
  if (!attribution) {
    container.innerHTML = `<div class="lp-empty"><p class="lp-empty-text">Unable to compute attribution.</p></div>`;
    return;
  }

  const bo = attribution.baseOut;
  const co = attribution.currentOutputs;

  // Deltas
  const evDelta = co.enterpriseValue - bo.enterpriseValue;
  const evPctDelta = bo.enterpriseValue ? evDelta / Math.abs(bo.enterpriseValue) : null;
  const priceDelta = (co.impliedPrice != null && bo.impliedPrice != null) ? co.impliedPrice - bo.impliedPrice : null;
  const pricePctDelta = (bo.impliedPrice && priceDelta != null) ? priceDelta / Math.abs(bo.impliedPrice) : null;
  const irrDelta = (co.irr != null && bo.irr != null) ? co.irr - bo.irr : null;

  // Auto-captured note
  const autoNote = ls.isBaseAutoCaptured
    ? `<div class="lp-auto-note">Base case captured from initial run.</div>` : '';

  // Summary cards
  const summaryHTML = `
    ${autoNote}
    <div class="lp-summary-cards">
      <div class="lp-summary-card">
        <div class="lp-summary-label">Enterprise Value</div>
        <div class="lp-summary-row">
          <span class="lp-summary-base">${fmtDollar(bo.enterpriseValue)}</span>
          <span class="lp-summary-arrow">&#8594;</span>
          <span class="lp-summary-current">${fmtDollar(co.enterpriseValue)}</span>
        </div>
        <div class="lp-summary-delta ${deltaColor(evDelta)}">
          ${fmtDelta(evDelta, fmtCompact)}${evPctDelta != null ? ' (' + fmtDelta(evPctDelta, fmtPct) + ')' : ''}
        </div>
      </div>
      <div class="lp-summary-card">
        <div class="lp-summary-label">Implied Share Price</div>
        <div class="lp-summary-row">
          <span class="lp-summary-base">${fmtPrice(bo.impliedPrice)}</span>
          <span class="lp-summary-arrow">&#8594;</span>
          <span class="lp-summary-current">${fmtPrice(co.impliedPrice)}</span>
        </div>
        <div class="lp-summary-delta ${deltaColor(priceDelta)}">
          ${priceDelta != null ? fmtDelta(priceDelta, fmtPrice) : 'N/A'}${pricePctDelta != null ? ' (' + fmtDelta(pricePctDelta, fmtPct) + ')' : ''}
        </div>
      </div>
      <div class="lp-summary-card">
        <div class="lp-summary-label">IRR</div>
        <div class="lp-summary-row">
          <span class="lp-summary-base">${fmtPct(bo.irr)}</span>
          <span class="lp-summary-arrow">&#8594;</span>
          <span class="lp-summary-current">${fmtPct(co.irr)}</span>
        </div>
        <div class="lp-summary-delta ${deltaColor(irrDelta)}">
          ${fmtPP(irrDelta)}
        </div>
      </div>
    </div>
  `;

  // Narrative
  const narrative = generateNarrative(attribution);
  const narrativeHTML = narrative.length > 0 ? `
    <div class="lp-section">
      <div class="lp-section-title">What's driving the change?</div>
      <ul class="lp-narrative-list">
        ${narrative.map(b => `<li>${b}</li>`).join('')}
      </ul>
    </div>
  ` : '';

  // Attribution table
  let attrTableHTML = '';
  if (attribution.impacts.length > 0) {
    const rows = attribution.impacts.map(imp => {
      const evCell = `<span class="${deltaColor(imp.evImpact)}">${fmtDelta(imp.evImpact, fmtCompact)}</span>`;
      const priceCell = imp.priceImpact != null
        ? `<span class="${deltaColor(imp.priceImpact)}">${fmtDelta(imp.priceImpact, fmtPrice)}</span>`
        : `<span class="lp-neutral">N/A</span>`;
      const irrCell = imp.irrImpact != null
        ? `<span class="${deltaColor(imp.irrImpact)}">${fmtPP(imp.irrImpact)}</span>`
        : `<span class="lp-neutral">N/A</span>`;

      return `
        <tr>
          <td class="lp-attr-driver">${imp.label}</td>
          <td class="lp-attr-val">${evCell}</td>
          <td class="lp-attr-val">${priceCell}</td>
          <td class="lp-attr-val">${irrCell}</td>
        </tr>
      `;
    }).join('');

    attrTableHTML = `
      <div class="lp-section">
        <div class="lp-section-title">Quantified Attribution</div>
        <div class="lp-attr-table-wrap">
          <table class="lp-attr-table">
            <thead>
              <tr>
                <th class="lp-attr-th-driver">Driver</th>
                <th class="lp-attr-th">EV Impact</th>
                <th class="lp-attr-th">Price Impact</th>
                <th class="lp-attr-th">IRR Impact</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
        <div class="lp-attr-note">Attribution is an approximation using one-at-a-time changes from the base case.</div>
      </div>
    `;
  }

  // Terminal value dependency callout
  let tvCalloutHTML = '';
  if (attribution.baseTVPct != null || attribution.currTVPct != null) {
    const baseTVStr = attribution.baseTVPct != null ? (attribution.baseTVPct * 100).toFixed(1) + '%' : 'N/A';
    const currTVStr = attribution.currTVPct != null ? (attribution.currTVPct * 100).toFixed(1) + '%' : 'N/A';
    const tvIncreased = attribution.currTVPct != null && attribution.baseTVPct != null
      && attribution.currTVPct > attribution.baseTVPct + 0.01;

    tvCalloutHTML = `
      <div class="lp-section lp-tv-callout">
        <div class="lp-section-title">Model Dependency</div>
        <div class="lp-tv-row">
          <span class="lp-tv-label">Terminal Value % of EV</span>
          <span class="lp-tv-values">${baseTVStr} &#8594; ${currTVStr}</span>
        </div>
        ${tvIncreased ? '<div class="lp-tv-warn">Terminal value now accounts for a larger share of EV. The model is more sensitive to long-term assumptions (WACC, terminal growth).</div>' : ''}
      </div>
    `;
  }

  container.innerHTML = summaryHTML + narrativeHTML + attrTableHTML + tvCalloutHTML;
}

// ======================================================================
// MARKET CONTEXT ACCORDION (collapsed by default)
// Stores values under state.context, separate from core DCF assumptions.
// ======================================================================
function _initContextState() {
  if (!state.context) {
    const baseRegime = (typeof CONTEXT_BENCHMARKS !== 'undefined')
      ? CONTEXT_BENCHMARKS.regimes.base : { rfr: 0.04, erp: 0.055 };
    state.context = {
      sector: 'Tech',
      regime: 'base',
      rfr: baseRegime.rfr,
      erp: baseRegime.erp,
      useContextForWacc: false,
    };
  }
}

function _buildMarketContextAccordion() {
  _initContextState();
  const ctx = state.context;
  const regimes = (typeof CONTEXT_BENCHMARKS !== 'undefined') ? CONTEXT_BENCHMARKS.regimes : {};
  const sectors = (typeof CONTEXT_BENCHMARKS !== 'undefined') ? Object.keys(CONTEXT_BENCHMARKS.sectors) : ['Tech', 'Generic'];

  return `
    <details class="ctx-accordion" id="ctx-accordion">
      <summary class="ctx-accordion-summary">
        <span class="ctx-accordion-label">Market Context</span>
        <span class="ctx-accordion-badge">Advanced</span>
      </summary>
      <div class="ctx-accordion-body">
        <div class="ctx-accordion-fields">
          <div class="assumption-field">
            <label for="ctx-sector">Sector</label>
            <select id="ctx-sector" class="input-control" style="width:90px;text-align:left;">
              ${sectors.map(s => `<option value="${s}" ${s === ctx.sector ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="assumption-field">
            <label for="ctx-regime">Regime</label>
            <select id="ctx-regime" class="input-control" style="width:90px;text-align:left;">
              ${Object.entries(regimes).map(([k, v]) => `<option value="${k}" ${k === ctx.regime ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select>
          </div>
          <div class="assumption-field">
            <label for="ctx-rfr">Risk-Free Rate</label>
            <div class="input-wrap">
              <input class="input-control" type="number" id="ctx-rfr" value="${(ctx.rfr * 100).toFixed(1)}" step="0.1" min="0" max="15" />
              <span class="input-affix">%</span>
            </div>
          </div>
          <div class="assumption-field">
            <label for="ctx-erp">Equity Risk Premium</label>
            <div class="input-wrap">
              <input class="input-control" type="number" id="ctx-erp" value="${(ctx.erp * 100).toFixed(1)}" step="0.1" min="0" max="15" />
              <span class="input-affix">%</span>
            </div>
          </div>
          <div class="assumption-field">
            <label for="ctx-use-wacc">Use for WACC</label>
            <input type="checkbox" id="ctx-use-wacc" ${ctx.useContextForWacc ? 'checked' : ''} style="accent-color:var(--accent-primary);" />
          </div>
        </div>
      </div>
    </details>
  `;
}

function _wireMarketContextListeners() {
  const sectorEl  = document.getElementById('ctx-sector');
  const regimeEl  = document.getElementById('ctx-regime');
  const rfrEl     = document.getElementById('ctx-rfr');
  const erpEl     = document.getElementById('ctx-erp');
  const toggleEl  = document.getElementById('ctx-use-wacc');

  if (!sectorEl) return; // accordion not rendered

  _initContextState();

  function onContextChange() {
    const ctx = state.context;
    if (sectorEl) ctx.sector = sectorEl.value;
    if (regimeEl) ctx.regime = regimeEl.value;
    if (rfrEl)    ctx.rfr    = parseFloat(rfrEl.value) / 100;
    if (erpEl)    ctx.erp    = parseFloat(erpEl.value) / 100;
    if (toggleEl) ctx.useContextForWacc = toggleEl.checked;

    // Refresh context panel (does NOT trigger DCF recalc unless toggle is on)
    if (ctx.useContextForWacc) {
      // Feed RFR+ERP into WACC: simplified CAPM for cost of equity
      // CoE = RFR + Beta * ERP; assume beta = 1 for simplicity
      const contextCoE = ctx.rfr + ctx.erp;
      const ceEl = document.getElementById('inp-costOfEquity');
      if (ceEl) {
        ceEl.value = (contextCoE * 100).toFixed(1);
        // Trigger input event to propagate WACC recalculation
        ceEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // Always refresh the context panel on context input changes
    if (typeof refreshContextPanel === 'function') {
      _ctxDebounce(refreshContextPanel, 60);
    }
  }

  // Regime change auto-fills RFR and ERP
  function onRegimeChange() {
    const regimes = (typeof CONTEXT_BENCHMARKS !== 'undefined') ? CONTEXT_BENCHMARKS.regimes : {};
    const preset = regimes[regimeEl.value];
    if (preset && rfrEl && erpEl) {
      rfrEl.value = (preset.rfr * 100).toFixed(1);
      erpEl.value = (preset.erp * 100).toFixed(1);
    }
    onContextChange();
  }

  sectorEl.addEventListener('change', onContextChange);
  regimeEl.addEventListener('change', onRegimeChange);
  rfrEl.addEventListener('input', onContextChange);
  erpEl.addEventListener('input', onContextChange);
  toggleEl.addEventListener('change', onContextChange);
}

// ======================================================================
// ASSUMPTION HELP — STATE, GUIDANCE PANEL, TOOLTIPS
// ======================================================================

/** Safely initialize state.ui.assumptionHelp if missing. */
function initAssumptionHelpState() {
  if (!state.ui) state.ui = {};
  if (!state.ui.assumptionHelp) {
    state.ui.assumptionHelp = { selectedKey: null, isOpen: false };
  }
}

/**
 * Canonical sector bucket resolver: returns 'tech' or 'general'.
 * Single source of truth used by guidance, boxplot, and advanced validation.
 */
function _getSegmentBucket() {
  try {
    const sector = state.context?.sector || '';
    return /tech/i.test(sector) ? 'tech' : 'general';
  } catch (_) {
    return 'general';
  }
}

/** Resolve sector bucket: 'tech' or 'general'. (alias for backward compat) */
function _getHelpSectorBucket() {
  return _getSegmentBucket();
}

/** Build collapsible Assumption Guidance panel HTML. */
function buildAssumptionGuidancePanel() {
  initAssumptionHelpState();
  const { selectedKey, isOpen } = state.ui.assumptionHelp;
  const openAttr = isOpen ? 'open' : '';

  return `
    <details class="ag-panel" id="ag-panel" ${openAttr}>
      <summary class="ag-panel-summary" id="ag-panel-toggle">
        <span class="ag-panel-label">Assumption Guidance</span>
        <span class="ag-panel-chevron">${isOpen ? '\u25B2' : '\u25BC'}</span>
      </summary>
      <div class="ag-panel-body" id="ag-panel-body">
        ${renderGuidanceContent(selectedKey)}
      </div>
    </details>
  `;
}

// ======================================================================
// BENCHMARK HELPERS — Box-and-Whisker Distribution Chart
// ======================================================================

/** Safely retrieve benchmarks for a given assumption key. */
function getBench(key) {
  return (window.ASSUMPTION_BENCHMARKS && window.ASSUMPTION_BENCHMARKS[key])
    ? window.ASSUMPTION_BENCHMARKS[key] : null;
}

/** Determine selected sector bucket from state.context. */
function getSelectedSectorBucket() {
  return _getSegmentBucket();
}

/** Set of metric keys that support a boxplot. */
const _BOXPLOT_KEYS = new Set([
  'revenueGrowth', 'ebitMargin', 'taxRate', 'capexPct', 'nwcPct',
  'costOfEquity', 'costOfDebt', 'wacc', 'terminalGrowth',
]);

/**
 * Compute a data-adaptive axis range for a metric.
 * Uses the benchmark percentile extremes (p10/p90 for both sectors)
 * plus the user's current value, then adds ~20% padding and rounds
 * to a clean step so tick labels look tidy.
 */
function getAxisForMetric(key) {
  if (!_BOXPLOT_KEYS.has(key)) return null;

  const bench = getBench(key);
  if (!bench) return null;

  // Gather all data points that should be visible
  const vals = [];
  if (bench.general) { vals.push(bench.general.p10, bench.general.p90); }
  if (bench.tech)    { vals.push(bench.tech.p10, bench.tech.p90); }
  const userVal = state.inputs ? state.inputs[key] : null;
  if (userVal != null && isFinite(userVal)) vals.push(userVal);

  if (vals.length === 0) return null;

  let dMin = Math.min(...vals);
  let dMax = Math.max(...vals);

  // Add 20% padding on each side (minimum 1pp = 0.01 padding)
  const span = dMax - dMin || 0.01;
  const pad = Math.max(span * 0.20, 0.01);
  dMin -= pad;
  dMax += pad;

  // Round to a clean step: pick a step that gives 4-6 ticks
  const rawStep = (dMax - dMin) / 5;
  // Nice steps in decimal (representing percentage points):
  //  0.005 (0.5pp), 0.01, 0.02, 0.05, 0.10, 0.20, 0.50
  const niceSteps = [0.005, 0.01, 0.02, 0.05, 0.10, 0.20, 0.50];
  let step = niceSteps[niceSteps.length - 1];
  for (const s of niceSteps) {
    if (s >= rawStep) { step = s; break; }
  }

  // Floor min / ceil max to step
  dMin = Math.floor(dMin / step) * step;
  dMax = Math.ceil(dMax / step) * step;

  // Ensure non-degenerate
  if (dMax <= dMin) dMax = dMin + step;

  return { min: dMin, max: dMax };
}

/** Format a decimal as "12.3%". */
function fmtPctFromDecimal(x) {
  if (x == null || !isFinite(x)) return 'N/A';
  return (x * 100).toFixed(1) + '%';
}

/** Clamp a value between min and max. */
function _clampVal(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Escape HTML for tooltip safety. */
function _escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/**
 * Build an SVG box-and-whisker chart comparing General vs Selected sector.
 * Returns an HTML string with an inline <svg>.
 */
function buildBoxplotSVG(key) {
  const bench = getBench(key);
  if (!bench) return '<p class="ag-no-bench">No benchmark data available yet.</p>';

  const axis = getAxisForMetric(key);
  if (!axis) return '<p class="ag-no-bench">No benchmark data available yet.</p>';

  const sectorBucket = getSelectedSectorBucket();
  const generalData = bench.general;
  const sectorData = bench[sectorBucket];
  if (!generalData || !sectorData) {
    return '<p class="ag-no-bench">No benchmark data available yet.</p>';
  }

  // Determine if we show one or two boxes
  const isSameSector = sectorBucket === 'general';
  const sectorLabel = sectorBucket === 'tech' ? 'Tech' : 'General';

  // SVG dimensions
  const svgW = 200;
  const svgH = 240;
  const padTop = 20;
  const padBot = 28;
  const padLeft = 42;
  const padRight = 12;
  const chartTop = padTop;
  const chartBot = svgH - padBot;
  const chartH = chartBot - chartTop;

  // Axis mapping: value → y
  const axMin = axis.min;
  const axMax = axis.max;
  function valToY(v) {
    return chartTop + (1 - (v - axMin) / (axMax - axMin)) * chartH;
  }

  // Box x positions
  const boxW = isSameSector ? 40 : 32;
  const chartLeft = padLeft;
  const chartRight = svgW - padRight;
  const chartMidW = chartRight - chartLeft;
  let genX, secX;
  if (isSameSector) {
    genX = chartLeft + chartMidW / 2 - boxW / 2;
    secX = null;
  } else {
    const gap = 14;
    const totalBoxW = boxW * 2 + gap;
    const startX = chartLeft + (chartMidW - totalBoxW) / 2;
    genX = startX;
    secX = startX + boxW + gap;
  }

  // User's current assumption value
  const userVal = state.inputs ? state.inputs[key] : null;
  const hasUserVal = userVal != null && isFinite(userVal);

  // Colors
  const genColor = 'rgba(79, 142, 247, 0.7)';
  const genFill = 'rgba(79, 142, 247, 0.15)';
  const genMedian = 'rgba(79, 142, 247, 1)';
  const secColor = 'rgba(34, 197, 94, 0.7)';
  const secFill = 'rgba(34, 197, 94, 0.15)';
  const secMedian = 'rgba(34, 197, 94, 1)';
  const markerColor = '#f59e0b';

  // Build axis ticks at nice step boundaries
  // Determine the step from the axis range (reverse-engineer from getAxisForMetric logic)
  const axRange = axMax - axMin;
  const rawTickStep = axRange / 5;
  const niceSteps = [0.005, 0.01, 0.02, 0.05, 0.10, 0.20, 0.50];
  let tickStep = niceSteps[niceSteps.length - 1];
  for (const s of niceSteps) {
    if (s >= rawTickStep) { tickStep = s; break; }
  }
  let ticks = [];
  for (let v = axMin; v <= axMax + tickStep * 0.001; v += tickStep) {
    ticks.push(Math.round(v * 10000) / 10000); // avoid float drift
  }

  let svg = `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">`;

  // Axis line
  svg += `<line x1="${padLeft}" y1="${chartTop}" x2="${padLeft}" y2="${chartBot}" class="ag-boxplot-axis-line"/>`;

  // Tick marks and labels
  for (const tv of ticks) {
    const y = valToY(tv);
    svg += `<line x1="${padLeft - 4}" y1="${y}" x2="${padLeft}" y2="${y}" class="ag-boxplot-tick"/>`;
    svg += `<text x="${padLeft - 6}" y="${y + 3}" text-anchor="end" class="ag-boxplot-axis-label">${fmtPctFromDecimal(tv)}</text>`;
    // Grid line
    svg += `<line x1="${padLeft}" y1="${y}" x2="${chartRight}" y2="${y}" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="2,3"/>`;
  }

  // Draw a single box group
  function drawBox(data, x, color, fill, medianColor, groupId) {
    const y10 = valToY(data.p10);
    const y25 = valToY(data.p25);
    const y50 = valToY(data.p50);
    const y75 = valToY(data.p75);
    const y90 = valToY(data.p90);
    const cx = x + boxW / 2;

    let g = `<g class="ag-bp-group" data-group="${groupId}">`;
    // Whisker line P10 to P90
    g += `<line x1="${cx}" y1="${y90}" x2="${cx}" y2="${y10}" class="ag-boxplot-whisker" stroke="${color}"/>`;
    // Whisker caps
    g += `<line x1="${cx - 6}" y1="${y90}" x2="${cx + 6}" y2="${y90}" stroke="${color}" stroke-width="1.5"/>`;
    g += `<line x1="${cx - 6}" y1="${y10}" x2="${cx + 6}" y2="${y10}" stroke="${color}" stroke-width="1.5"/>`;
    // Box P25 to P75
    const boxH = y25 - y75;
    g += `<rect x="${x}" y="${y75}" width="${boxW}" height="${boxH}" fill="${fill}" stroke="${color}" class="ag-boxplot-box"/>`;
    // Median line
    g += `<line x1="${x}" y1="${y50}" x2="${x + boxW}" y2="${y50}" stroke="${medianColor}" class="ag-boxplot-median"/>`;
    // Invisible hover target (wider than box for easier hover)
    g += `<rect x="${x - 4}" y="${y90 - 4}" width="${boxW + 8}" height="${(y10 - y90) + 8}" fill="transparent" class="ag-bp-hover" data-group="${groupId}" style="cursor:pointer;"/>`;
    g += `</g>`;
    return g;
  }

  // Draw General box
  svg += drawBox(generalData, genX, genColor, genFill, genMedian, 'general');

  // Draw Sector box (if different)
  if (!isSameSector && secX != null) {
    svg += drawBox(sectorData, secX, secColor, secFill, secMedian, 'sector');
  }

  // User assumption marker
  if (hasUserVal) {
    const clampedVal = _clampVal(userVal, axMin, axMax);
    const markerY = valToY(clampedVal);
    // Draw marker on each box
    function drawMarker(x) {
      const cx = x + boxW / 2;
      return `<circle cx="${cx}" cy="${markerY}" r="4" fill="${markerColor}" stroke="#fff" stroke-width="1.5" class="ag-bp-marker" data-group="marker" style="cursor:pointer;"/>`;
    }
    svg += drawMarker(genX);
    if (!isSameSector && secX != null) {
      svg += drawMarker(secX);
    }
  }

  // Labels beneath boxes
  const labelY = chartBot + 14;
  const genLabelX = genX + boxW / 2;
  svg += `<text x="${genLabelX}" y="${labelY}" class="ag-boxplot-label">General</text>`;
  if (!isSameSector && secX != null) {
    const secLabelX = secX + boxW / 2;
    svg += `<text x="${secLabelX}" y="${labelY}" class="ag-boxplot-label">${sectorLabel}</text>`;
  }

  svg += `</svg>`;
  return svg;
}

/**
 * Initialize the boxplot tooltip element and wire hover events
 * on the guidance panel's SVG elements.
 */
function _wireBoxplotTooltips(key) {
  // Create tooltip if not present
  let tip = document.getElementById('ag-boxplot-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'ag-boxplot-tooltip';
    tip.className = 'ag-boxplot-tooltip';
    document.body.appendChild(tip);
  }

  const bench = getBench(key);
  if (!bench) return;

  const sectorBucket = getSelectedSectorBucket();
  const sectorLabel = sectorBucket === 'tech' ? 'Tech' : 'General';
  const userVal = state.inputs ? state.inputs[key] : null;
  const hasUserVal = userVal != null && isFinite(userVal);
  const userStr = hasUserVal ? fmtPctFromDecimal(userVal) : 'N/A';

  function buildPercentileHTML(label, data) {
    return `
      <div class="tt-header">${_escHtml(label)}</div>
      <div class="tt-row"><span class="tt-label">P90</span><span class="tt-value">${fmtPctFromDecimal(data.p90)}</span></div>
      <div class="tt-row"><span class="tt-label">P75</span><span class="tt-value">${fmtPctFromDecimal(data.p75)}</span></div>
      <div class="tt-row"><span class="tt-label">P50</span><span class="tt-value">${fmtPctFromDecimal(data.p50)}</span></div>
      <div class="tt-row"><span class="tt-label">P25</span><span class="tt-value">${fmtPctFromDecimal(data.p25)}</span></div>
      <div class="tt-row"><span class="tt-label">P10</span><span class="tt-value">${fmtPctFromDecimal(data.p10)}</span></div>
      <div class="tt-divider"></div>
      <div class="tt-row"><span class="tt-label">Your assumption</span><span class="tt-value tt-user">${userStr}</span></div>
    `;
  }

  const chartCol = document.querySelector('.ag-chart-col');
  if (!chartCol) return;

  const hoverTargets = chartCol.querySelectorAll('.ag-bp-hover, .ag-bp-marker');
  hoverTargets.forEach(el => {
    el.addEventListener('mouseenter', (e) => {
      const group = el.dataset.group;
      if (group === 'general') {
        tip.innerHTML = buildPercentileHTML('General', bench.general);
      } else if (group === 'sector') {
        const data = bench[sectorBucket] || bench.general;
        tip.innerHTML = buildPercentileHTML(sectorLabel, data);
      } else if (group === 'marker') {
        tip.innerHTML = `<div class="tt-row"><span class="tt-label">Your assumption</span><span class="tt-value tt-user">${userStr}</span></div>`;
      }
      tip.style.display = 'block';
      _posBoxplotTooltip(tip, e);
    });
    el.addEventListener('mousemove', (e) => {
      if (tip.style.display === 'block') _posBoxplotTooltip(tip, e);
    });
    el.addEventListener('mouseleave', () => {
      tip.style.display = 'none';
    });
  });
}

function _posBoxplotTooltip(tip, e) {
  const pad = 12;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  if (x + tw > window.innerWidth - pad) x = e.clientX - tw - pad;
  if (y + th > window.innerHeight - pad) y = e.clientY - th - pad;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}

/** Render guidance content for a given assumption key (or empty state). */
function renderGuidanceContent(key) {
  const HELP = window.ASSUMPTION_HELP;
  if (!HELP) {
    return '<p class="ag-empty">Glossary not loaded.</p>';
  }
  if (!key) {
    return '<p class="ag-empty">Select an assumption to see guidance.</p>';
  }
  const entry = HELP[key];
  if (!entry) {
    return '<p class="ag-empty">No guidance available for this assumption.</p>';
  }

  const bucket = _getHelpSectorBucket();
  const rangeText = entry.ranges?.[bucket] || entry.ranges?.general || '';

  const summaryHTML = entry.summary
    ? entry.summary.map(s => `<p class="ag-summary-line">${s}</p>`).join('')
    : '';

  const rangeHTML = rangeText
    ? `<p class="ag-range"><strong>Range:</strong> ${rangeText}</p>`
    : '';

  const questionsHTML = (entry.questions && entry.questions.length > 0)
    ? `<div class="ag-section">
        <p class="ag-section-title">Questions to Consider</p>
        <ul class="ag-list">${entry.questions.map(q => `<li>${q}</li>`).join('')}</ul>
      </div>`
    : '';

  const whereHTML = (entry.whereToLook && entry.whereToLook.length > 0)
    ? `<div class="ag-section">
        <p class="ag-section-title">Where to Look</p>
        <ul class="ag-list">${entry.whereToLook.map(w => `<li>${w}</li>`).join('')}</ul>
      </div>`
    : '';

  // Build the chart column (boxplot or no-data message)
  const bench = getBench(key);
  const hasAxis = !!getAxisForMetric(key);
  let chartHTML;
  if (bench && hasAxis) {
    chartHTML = `<div class="ag-chart-col" data-bench-key="${key}">${buildBoxplotSVG(key)}</div>`;
  } else if (hasAxis) {
    chartHTML = `<div class="ag-chart-col"><p class="ag-no-bench">No benchmark data available yet.</p></div>`;
  } else {
    chartHTML = ''; // non-range-able metric, no chart column
  }

  // If chart exists, use 2-column layout; otherwise single column
  if (chartHTML) {
    return `
      <div class="ag-content ag-two-col">
        <div class="ag-text-col">
          <p class="ag-selected-label">${entry.label || key}</p>
          ${summaryHTML}
          ${rangeHTML}
          ${questionsHTML}
          ${whereHTML}
        </div>
        ${chartHTML}
      </div>
    `;
  }

  return `
    <div class="ag-content">
      <p class="ag-selected-label">${entry.label || key}</p>
      ${summaryHTML}
      ${rangeHTML}
      ${questionsHTML}
      ${whereHTML}
    </div>
  `;
}

/** Wire click and keyboard activation on assumption labels. */
function wireAssumptionLabelInteractions() {
  const labels = document.querySelectorAll('.assumption-label[data-assumption-key]');
  labels.forEach(label => {
    // Click handler
    label.addEventListener('click', (e) => {
      e.preventDefault();
      _onAssumptionLabelSelect(label.dataset.assumptionKey);
    });
    // Keyboard: Enter or Space
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        _onAssumptionLabelSelect(label.dataset.assumptionKey);
      }
    });
  });
}

function _onAssumptionLabelSelect(key) {
  initAssumptionHelpState();
  state.ui.assumptionHelp.selectedKey = key;
  state.ui.assumptionHelp.isOpen = true;

  // Update guidance panel body in-place (no full re-render)
  const body = document.getElementById('ag-panel-body');
  if (body) {
    body.innerHTML = renderGuidanceContent(key);
    // Wire boxplot tooltips if chart was rendered
    if (getBench(key) && getAxisForMetric(key)) {
      _wireBoxplotTooltips(key);
    }
  }

  // Ensure panel is open
  const panel = document.getElementById('ag-panel');
  if (panel && !panel.open) panel.open = true;

  // Update chevron
  const chevron = panel?.querySelector('.ag-panel-chevron');
  if (chevron) chevron.textContent = '\u25B2';

  // Highlight selected label
  document.querySelectorAll('.assumption-label').forEach(el => {
    el.classList.toggle('ag-label-active', el.dataset.assumptionKey === key);
  });
}

/** Wire the guidance panel toggle to persist open/close state. */
function _wireGuidancePanelToggle() {
  const panel = document.getElementById('ag-panel');
  if (!panel) return;
  panel.addEventListener('toggle', () => {
    initAssumptionHelpState();
    state.ui.assumptionHelp.isOpen = panel.open;
    const chevron = panel.querySelector('.ag-panel-chevron');
    if (chevron) chevron.textContent = panel.open ? '\u25B2' : '\u25BC';
  });
}

/** Create a floating tooltip div and wire mouseenter/mouseleave on labels. */
function initAssumptionTooltips() {
  // Create tooltip element if not already present
  let tip = document.getElementById('assumption-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'assumption-tooltip';
    tip.className = 'assumption-tooltip';
    tip.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;display:none;'
      + 'background:var(--bg-elevated, #1e2130);color:var(--text-primary, #e0e4ef);'
      + 'border:1px solid var(--border-strong, #3a3f52);border-radius:6px;'
      + 'padding:6px 10px;font-size:12px;line-height:1.4;max-width:280px;'
      + 'box-shadow:0 4px 12px rgba(0,0,0,0.4);';
    document.body.appendChild(tip);
  }

  const labels = document.querySelectorAll('.assumption-label[data-assumption-key]');
  labels.forEach(label => {
    label.addEventListener('mouseenter', (e) => {
      const help = (window.ASSUMPTION_HELP || {})[label.dataset.assumptionKey];
      if (!help?.tooltip) return;
      tip.textContent = help.tooltip;
      tip.style.display = 'block';
      _positionTooltip(tip, e);
    });
    label.addEventListener('mousemove', (e) => {
      if (tip.style.display === 'block') _positionTooltip(tip, e);
    });
    label.addEventListener('mouseleave', () => {
      tip.style.display = 'none';
    });
  });
}

function _positionTooltip(tip, e) {
  const pad = 12;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  if (x + tw > window.innerWidth - pad) x = e.clientX - tw - pad;
  if (y + th > window.innerHeight - pad) y = e.clientY - th - pad;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}

// ======================================================================
// MAIN RENDER FUNCTION
// ======================================================================
function renderAssumptionsPanel() {
  const container = document.getElementById('section-assumptions');
  if (!container) return;

  // Ensure context state exists so segment selector has a value
  _initContextState();

  container.innerHTML = `
    <div class="assumptions-learning-layout">
      <div class="assumptions-left-panel">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <p class="caption">Assumptions</p>
          <div class="segment-selector-row">
            <label for="segment-select" class="segment-selector-label">Segment:</label>
            <select id="segment-select" class="input-control" style="width:90px;text-align:left;">
              <option value="general" ${_getSegmentBucket() === 'general' ? 'selected' : ''}>General</option>
              <option value="tech" ${_getSegmentBucket() === 'tech' ? 'selected' : ''}>Tech</option>
            </select>
          </div>
        </div>
        <div class="assumptions-grid">
          ${ASSUMPTION_GROUPS.map(buildGroupCard).join('')}
        </div>
        ${_buildAdvancedAssumptionsSection()}
        ${buildAssumptionGuidancePanel()}
      </div>
      <div class="learning-right-panel">
        <div class="lp-header">
          <p class="lp-title">Why did valuation move?</p>
          <button class="btn-secondary lp-base-btn" id="btn-set-base">Set Base Case</button>
        </div>
        <div id="learning-panel-content" class="lp-content">
          <div class="lp-empty">
            <p class="lp-empty-text">Change an assumption to see how it affects the valuation.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire set base case button
  document.getElementById('btn-set-base').addEventListener('click', onSetBaseCase);

  // Live-update WACC display as components change (fires immediately for UI feel)
  ['inp-costOfEquity','inp-costOfDebt','inp-equityWeight','inp-debtWeight','inp-taxRate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      const ce = parseInputValue({ type: 'pct', step: 0.1 }, document.getElementById('inp-costOfEquity')?.value) ?? state.inputs.costOfEquity;
      const cd = parseInputValue({ type: 'pct', step: 0.1 }, document.getElementById('inp-costOfDebt')?.value)   ?? state.inputs.costOfDebt;
      const ew = parseInputValue({ type: 'pct', step: 1   }, document.getElementById('inp-equityWeight')?.value) ?? state.inputs.equityWeight;
      const dw = parseInputValue({ type: 'pct', step: 1   }, document.getElementById('inp-debtWeight')?.value)   ?? state.inputs.debtWeight;
      const tr = parseInputValue({ type: 'pct', step: 0.1 }, document.getElementById('inp-taxRate')?.value)      ?? state.inputs.taxRate;
      const waccComputed = ce * ew + cd * dw * (1 - tr);
      const waccEl = document.getElementById('inp-wacc');
      if (waccEl) waccEl.value = (waccComputed * 100).toFixed(1);
    });
  });

  // Auto-recalculate on any assumption input change (debounced 200ms)
  for (const group of ASSUMPTION_GROUPS) {
    for (const field of group.fields) {
      const el = document.getElementById(`inp-${field.key}`);
      if (el) el.addEventListener('input', recalculateDebounced);
    }
  }

  // Wire main Segment Selector (top of assumptions panel)
  _wireSegmentSelector();

  // Wire Advanced Assumptions section listeners
  _wireAdvancedAssumptionsListeners();

  // Initialize context panel if mount point exists
  if (typeof initContextPanel === 'function') initContextPanel();

  // Assumption help: state, label interactions, tooltips, guidance panel toggle
  initAssumptionHelpState();
  wireAssumptionLabelInteractions();
  initAssumptionTooltips();
  _wireGuidancePanelToggle();

  // Restore active label highlight if a selection persists across re-render
  if (state.ui.assumptionHelp.selectedKey) {
    document.querySelectorAll('.assumption-label').forEach(el => {
      el.classList.toggle('ag-label-active', el.dataset.assumptionKey === state.ui.assumptionHelp.selectedKey);
    });
  }
}

// ======================================================================
// SEGMENT SELECTOR — wires the top-level segment dropdown
// ======================================================================

/**
 * Wire the main segment selector that lives in the basic assumptions header.
 * Updates state.context.sector, refreshes the guidance chart, syncs the
 * advanced-section segment dropdown (if present), and re-validates.
 */
function _wireSegmentSelector() {
  const segSelect = document.getElementById('segment-select');
  if (!segSelect) return;

  segSelect.addEventListener('change', () => {
    _initContextState();
    state.context.sector = segSelect.value === 'tech' ? 'Tech' : 'Generic';

    // Refresh the assumption guidance chart if a key is selected
    _refreshGuidanceForCurrentKey();

    // Re-validate advanced assumptions with the new segment
    _runAdvancedValidation();

    // Refresh context panel
    if (typeof refreshContextPanel === 'function') refreshContextPanel();
  });
}

/**
 * Re-render the guidance content and boxplot tooltips for the currently
 * selected assumption key (if any). Called when the segment changes.
 */
function _refreshGuidanceForCurrentKey() {
  initAssumptionHelpState();
  const key = state.ui.assumptionHelp.selectedKey;
  if (!key) return;

  const body = document.getElementById('ag-panel-body');
  if (body) {
    body.innerHTML = renderGuidanceContent(key);
    if (getBench(key) && getAxisForMetric(key)) {
      _wireBoxplotTooltips(key);
    }
  }
}

// ======================================================================
// ADVANCED ASSUMPTIONS — Year-by-Year Grid
// ======================================================================

/** Build the collapsible Advanced Assumptions section. */
function _buildAdvancedAssumptionsSection() {
  const isEnabled = !!state.advancedAssumptionsEnabled;
  const isOpen = isEnabled || !!state._advancedSectionOpen;

  return `
    <details class="adv-assumptions-panel" id="adv-assumptions-panel" ${isOpen ? 'open' : ''}>
      <summary class="adv-assumptions-summary">
        <span class="adv-assumptions-label">Advanced Assumptions</span>
        <span id="adv-status-pill" class="adv-status-pill adv-status-hidden"></span>
      </summary>
      <div class="adv-assumptions-body">
        <div class="adv-toggle-row">
          <label class="adv-toggle-label" for="adv-enable-toggle">
            <input type="checkbox" id="adv-enable-toggle" ${isEnabled ? 'checked' : ''} />
            Enable year-by-year assumptions
          </label>
        </div>
        <div id="adv-grid-container" class="adv-grid-container ${isEnabled ? '' : 'adv-grid-disabled'}">
          ${_buildAdvancedGrid()}
        </div>
        <div id="adv-error-list" class="adv-error-list" style="display:none;"></div>
      </div>
    </details>
  `;
}

/** Get the current advanced segment from shared state.context. */
function _getAdvancedSegment() {
  return _getSegmentBucket();
}

/** Build the spreadsheet-style year-by-year grid HTML. */
function _buildAdvancedGrid() {
  const years = (typeof getForecastYears === 'function') ? getForecastYears() : [];
  if (years.length === 0) {
    return '<p class="adv-grid-empty">Upload data and set forecast years to enable the grid.</p>';
  }

  // Ensure state is initialized
  if (typeof ensureAssumptionsByYearInitializedFromBasic === 'function') {
    state._advancedSectionOpen = true;
    ensureAssumptionsByYearInitializedFromBasic();
  }

  const aby = state.assumptionsByYear || {};

  // Column headers: row label + years
  let headerCells = `<th class="adv-grid-corner"></th>`;
  for (const yr of years) {
    headerCells += `<th class="adv-grid-year-header">${yr}</th>`;
  }

  // Data rows
  let rowsHTML = '';
  for (const rowDef of ADVANCED_GRID_ROWS) {
    let cells = `<td class="adv-grid-row-label">${rowDef.label}</td>`;
    for (let yIdx = 0; yIdx < years.length; yIdx++) {
      const yr = years[yIdx];
      const val = aby[yr] ? aby[yr][rowDef.key] : null;
      const displayVal = val != null ? (val * 100).toFixed(1) : '';
      const cellId = `adv-${rowDef.key}-${yr}`;
      cells += `
        <td class="adv-grid-cell" id="cell-wrap-${cellId}">
          <div class="adv-grid-cell-inner">
            <input
              class="adv-grid-input"
              type="number"
              id="${cellId}"
              data-canon-key="${rowDef.key}"
              data-year="${yr}"
              data-year-idx="${yIdx}"
              value="${displayVal}"
              step="0.1"
            /><span class="adv-grid-pct">%</span>
            <button
              class="adv-fill-right-btn"
              data-canon-key="${rowDef.key}"
              data-year-idx="${yIdx}"
              title="Set constant to the right"
            >&raquo;</button>
          </div>
        </td>`;
    }
    rowsHTML += `<tr>${cells}</tr>`;
  }

  return `
    <div class="adv-grid-scroll">
      <table class="adv-grid-table">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>
  `;
}

/** Commit a single advanced grid input: update state, validate, recalc. */
function _commitAdvancedCell(inputEl) {
  const canonKey = inputEl.dataset.canonKey;
  const yr = inputEl.dataset.year;
  const rawVal = parseFloat(inputEl.value);
  const decVal = isNaN(rawVal) ? null : rawVal / 100;

  if (!state.assumptionsByYear) state.assumptionsByYear = {};
  if (!state.assumptionsByYear[yr]) state.assumptionsByYear[yr] = {};
  state.assumptionsByYear[yr][canonKey] = decVal;

  _runAdvancedValidation();
  if (state.advancedAssumptionsEnabled) {
    recalculateDebounced();
  }
}

/** Wire all event listeners for the advanced assumptions section. */
function _wireAdvancedAssumptionsListeners() {
  const panel = document.getElementById('adv-assumptions-panel');
  const toggle = document.getElementById('adv-enable-toggle');
  const gridContainer = document.getElementById('adv-grid-container');

  if (!panel) return;

  // Track open/close for state persistence
  panel.addEventListener('toggle', () => {
    state._advancedSectionOpen = panel.open;
    if (panel.open) {
      // Auto-fill grid on first open
      if (typeof ensureAssumptionsByYearInitializedFromBasic === 'function') {
        ensureAssumptionsByYearInitializedFromBasic();
      }
      _refreshAdvancedGrid();
    }
  });

  // Enable/disable toggle
  if (toggle) {
    toggle.addEventListener('change', () => {
      state.advancedAssumptionsEnabled = toggle.checked;
      const gc = document.getElementById('adv-grid-container');
      if (gc) gc.classList.toggle('adv-grid-disabled', !toggle.checked);

      if (toggle.checked) {
        if (typeof ensureAssumptionsByYearInitializedFromBasic === 'function') {
          ensureAssumptionsByYearInitializedFromBasic();
        }
        _refreshAdvancedGrid();
      }

      _runAdvancedValidation();
      recalculateDebounced();
    });
  }

  // Grid cell commit: fires on blur or Enter — not while typing.
  // Using 'change' instead of 'input' so the grid doesn't rebuild
  // mid-keystroke and steal focus from the user.
  if (gridContainer) {
    gridContainer.addEventListener('change', (e) => {
      if (!e.target.classList.contains('adv-grid-input')) return;
      _commitAdvancedCell(e.target);
    });

    // "Set constant to the right" buttons (delegated)
    gridContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.adv-fill-right-btn');
      if (!btn) return;
      const canonKey = btn.dataset.canonKey;
      const startIdx = parseInt(btn.dataset.yearIdx);
      const years = (typeof getForecastYears === 'function') ? getForecastYears() : [];
      if (startIdx >= years.length) return;

      // Get current cell value
      const sourceYr = years[startIdx];
      const aby = state.assumptionsByYear || {};
      const sourceVal = aby[sourceYr] ? aby[sourceYr][canonKey] : null;
      if (sourceVal == null) return;

      // Fill from startIdx through end
      for (let i = startIdx; i < years.length; i++) {
        const yr = years[i];
        if (!state.assumptionsByYear[yr]) state.assumptionsByYear[yr] = {};
        state.assumptionsByYear[yr][canonKey] = sourceVal;
        // Update DOM input
        const inp = document.getElementById(`adv-${canonKey}-${yr}`);
        if (inp) inp.value = (sourceVal * 100).toFixed(1);
      }

      _runAdvancedValidation();
      if (state.advancedAssumptionsEnabled) {
        recalculateDebounced();
      }
    });
  }
}

/** Refresh the grid HTML in-place (when forecast years change). */
function _refreshAdvancedGrid() {
  const gc = document.getElementById('adv-grid-container');
  if (!gc) return;
  gc.innerHTML = _buildAdvancedGrid();
  _runAdvancedValidation();
}

/** Run validation and update cell styling + status pill + error list. */
function _runAdvancedValidation() {
  const isEnabled = !!state.advancedAssumptionsEnabled;
  const pill = document.getElementById('adv-status-pill');
  const errorListEl = document.getElementById('adv-error-list');

  if (!isEnabled) {
    // Hide status pill and errors when disabled
    if (pill) { pill.className = 'adv-status-pill adv-status-hidden'; pill.textContent = ''; }
    if (errorListEl) errorListEl.style.display = 'none';
    // Clear all cell highlights
    document.querySelectorAll('.adv-grid-cell').forEach(td => {
      td.classList.remove('adv-cell-warning', 'adv-cell-error');
      td.title = '';
    });
    // Store validation result for engine
    state.advancedValidation = null;
    return;
  }

  const segment = _getSegmentBucket();
  const validation = (typeof validateAssumptionsByYear === 'function')
    ? validateAssumptionsByYear(segment)
    : { isValid: true, errors: [], warnings: [], cellMap: {} };

  // Store for engine access
  state.advancedValidation = validation;

  // Update cell styles
  const years = (typeof getForecastYears === 'function') ? getForecastYears() : [];
  for (const yr of years) {
    for (const rowDef of ADVANCED_GRID_ROWS) {
      const cellWrap = document.getElementById(`cell-wrap-adv-${rowDef.key}-${yr}`);
      if (!cellWrap) continue;
      const cellInfo = validation.cellMap[yr] ? validation.cellMap[yr][rowDef.key] : null;
      cellWrap.classList.remove('adv-cell-warning', 'adv-cell-error');
      if (cellInfo) {
        if (cellInfo.status === 'error') cellWrap.classList.add('adv-cell-error');
        else if (cellInfo.status === 'warning') cellWrap.classList.add('adv-cell-warning');
        cellWrap.title = cellInfo.message || '';
      } else {
        cellWrap.title = '';
      }
    }
  }

  // Update status pill
  if (pill) {
    if (!validation.isValid) {
      pill.className = 'adv-status-pill adv-status-blocked';
      pill.textContent = 'Blocked';
    } else if (validation.warnings.length > 0) {
      pill.className = 'adv-status-pill adv-status-warnings';
      pill.textContent = 'Warnings';
    } else {
      pill.className = 'adv-status-pill adv-status-ok';
      pill.textContent = 'OK';
    }
  }

  // Update error/warning list
  if (errorListEl) {
    if (validation.errors.length > 0 || validation.warnings.length > 0) {
      errorListEl.style.display = 'block';
      let html = '';
      for (const e of validation.errors.slice(0, 5)) {
        html += `<div class="adv-issue adv-issue-error">${e}</div>`;
      }
      for (const w of validation.warnings.slice(0, 5)) {
        html += `<div class="adv-issue adv-issue-warning">${w}</div>`;
      }
      errorListEl.innerHTML = html;
    } else {
      errorListEl.style.display = 'none';
    }
  }
}

/**
 * Called when forecast years or basic assumptions change, to keep the
 * advanced grid in sync. Called from recalculate() after collectInputs().
 * Skips the full grid rebuild if the user is currently editing a cell
 * (focus is inside the grid), to avoid destroying their in-progress input.
 */
function refreshAdvancedGridIfOpen() {
  const panel = document.getElementById('adv-assumptions-panel');
  if (!panel || !panel.open) return;

  // Don't rebuild while user is typing in a grid cell
  const gc = document.getElementById('adv-grid-container');
  if (gc && gc.contains(document.activeElement)) return;

  if (typeof ensureAssumptionsByYearInitializedFromBasic === 'function') {
    ensureAssumptionsByYearInitializedFromBasic();
  }
  _refreshAdvancedGrid();
}
