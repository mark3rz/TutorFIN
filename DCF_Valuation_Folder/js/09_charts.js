/* ============================================================
   TASK 09 — Core Charts (Upgraded: Diagnostic + Teaching Layer)
   ============================================================

   INTEGRATION NOTES
   -----------------
   Expected state fields used by this module:

   state.historical.years             — array of year labels
   state.historical.metrics.revenue   — revenue series
   state.historical.metrics.ebitda    — EBITDA series (optional)
   state.historical.metrics.ebit      — EBIT series (fallback)
   state.historical.metrics.freeCashFlow — raw FCF if available
   state.historical.metrics.netDebt   — net debt series (optional, derived preferred)
   state.historical.metrics.totalDebt — total debt (for net debt derivation)
   state.historical.metrics.cash      — cash (for net debt derivation)
   state.historical.metrics.totalEquity   — total equity (for invested capital)
   state.historical.metrics.evToEbitda    — EV/EBITDA multiple (optional, from Multiples tab)
   state.historical.derived.fcf       — derived FCF series
   state.historical.derived.ebitdaMargin — EBITDA/Revenue margin series
   state.historical.derived.ebitMargin   — EBIT/Revenue margin series
   state.historical.derived.roic      — ROIC series (NOPAT / Invested Capital)
   state.historical.derived.netDebt   — net debt series (Total Debt - Cash)
   state.historical.derived.netDebtToEbitda — leverage series

   state.dcf.valid                    — boolean
   state.dcf.forecast.revenue         — projected revenue array
   state.dcf.forecast.ebit            — projected EBIT array
   state.dcf.forecast.fcf             — projected FCF array
   state.dcf.forecast.pvFCF           — PV of each forecast FCF
   state.dcf.forecastYearLabels       — e.g. ['2025E','2026E',...]
   state.dcf.summary.pvTerminal       — PV of terminal value
   state.dcf.summary.enterpriseValue  — total EV
   state.dcf.summary.npvFCF           — sum of PV FCFs
   state.dcf.summary.terminalValue    — undiscounted terminal value
   state.dcf.summary.wacc             — WACC used
   state.dcf.summary.terminalGrowth   — terminal growth rate used
   state.dcf.inputs.wacc              — WACC input
   state.dcf.inputs.terminalGrowth    — terminal growth input
   state.dcf.inputs.ebitMargin        — forecast EBIT margin
   state.dcf.inputs.revenueGrowth     — forecast revenue growth
   state.dcf.inputs.exitMultiple      — exit EV/EBITDA multiple (optional)

   state.market.evToEbitda            — current market EV/EBITDA (optional)
   state.market.enterpriseValue       — current market EV (optional)

   New field this module derives (not required from engine):
     lastActualYearIndex — computed here as state.historical.years.length - 1
       when combining historical + forecast labels on a chart

   Where fields should be set:
     - state.historical.*        -> set by 03_normalization + 04_derived_metrics
     - state.dcf.*               -> set by 05_dcf_engine.calculateDCF()
     - Badge computations        -> computed locally in this file from the above
============================================================ */

// --- Chart instance registry (destroy before recreate) ---
const _chartInstances = {};

function destroyChart(key) {
  if (_chartInstances[key]) {
    _chartInstances[key].destroy();
    _chartInstances[key] = null;
  }
}

// --- Shared dark theme defaults applied to every chart ---
function darkDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        labels: {
          color: DESIGN_TOKENS.textSecondary,
          font: { family: 'Inter, system-ui, sans-serif', size: 11 },
          boxWidth: 10,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: DESIGN_TOKENS.bgElevated,
        titleColor: DESIGN_TOKENS.textPrimary,
        bodyColor: DESIGN_TOKENS.textSecondary,
        borderColor: DESIGN_TOKENS.borderStrong,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        titleFont: { family: 'Inter, system-ui, sans-serif', size: 12, weight: '600' },
        bodyFont: { family: 'Inter, system-ui, sans-serif', size: 11 },
      },
    },
    scales: {
      x: {
        grid:  { color: DESIGN_TOKENS.borderSubtle, drawBorder: false },
        ticks: { color: DESIGN_TOKENS.textMuted, font: { size: 11 } },
      },
      y: {
        grid:  { color: DESIGN_TOKENS.borderSubtle, drawBorder: false },
        ticks: { color: DESIGN_TOKENS.textMuted, font: { size: 11 } },
      },
    },
  };
}

// --- Format axis tick values compactly ---
function compactFmt(val) {
  if (val === null || !isFinite(val)) return '';
  const abs = Math.abs(val);
  if (abs >= 1e9)  return (val / 1e9).toFixed(1)  + 'B';
  if (abs >= 1e6)  return (val / 1e6).toFixed(1)  + 'M';
  if (abs >= 1e3)  return (val / 1e3).toFixed(0)  + 'K';
  return val.toFixed(1);
}

// ============================================================
// BADGE HELPER FUNCTIONS
// Lightweight computations for insight badges.
// These read from state and return display-ready values.
// ============================================================

/** Revenue CAGR over historical years */
function _calcRevenueCagr() {
  const rev = state.historical?.metrics?.revenue;
  if (!rev || rev.length < 2) return null;
  const vals = rev.filter(v => v != null && isFinite(v) && v > 0);
  if (vals.length < 2) return null;
  const first = vals[0];
  const last  = vals[vals.length - 1];
  const n     = vals.length - 1;
  if (first <= 0 || last <= 0) return null;
  return Math.pow(last / first, 1 / n) - 1;
}

/** EBITDA margin trend over last N years: 'expanding' | 'flat' | 'compressing' */
function _calcMarginTrend(n) {
  n = n || 4;
  const margins = state.historical?.derived?.ebitdaMargin
    || state.historical?.derived?.ebitMargin;
  if (!margins) return null;
  const valid = margins.filter(v => v != null && isFinite(v));
  if (valid.length < 2) return null;
  const recent = valid.slice(-Math.min(n, valid.length));
  // Simple linear slope via first vs last
  const first = recent[0];
  const last  = recent[recent.length - 1];
  const diff  = last - first;
  // Threshold: 1pp = meaningful
  if (diff > 0.01)       return 'expanding';
  if (diff < -0.01)      return 'compressing';
  return 'flat';
}

/** FCF conversion ratio = FCF / EBITDA, fallback FCF / EBIT */
function _calcFCFConversion() {
  const fcf    = state.historical?.derived?.fcf || state.historical?.metrics?.freeCashFlow;
  const ebitda = state.historical?.metrics?.ebitda;
  const ebit   = state.historical?.metrics?.ebit;
  if (!fcf) return { value: null, basis: null };

  const denom = ebitda || ebit;
  const basis = ebitda ? 'EBITDA' : ebit ? 'EBIT' : null;
  if (!denom) return { value: null, basis: null };

  // Use trailing 3-year average
  const recentFCF   = fcf.slice(-3).filter(v => v != null && isFinite(v));
  const recentDenom = denom.slice(-3).filter(v => v != null && isFinite(v) && v !== 0);
  if (!recentFCF.length || !recentDenom.length) return { value: null, basis };

  const avgFCF   = recentFCF.reduce((s, v) => s + v, 0) / recentFCF.length;
  const avgDenom = recentDenom.reduce((s, v) => s + v, 0) / recentDenom.length;
  if (avgDenom === 0) return { value: null, basis };
  return { value: avgFCF / avgDenom, basis };
}

/**
 * FCF volatility indicator.
 * Coefficient of variation (stdev / |mean|) of historical FCF.
 * Returns { cv, label } where label is 'low' | 'moderate' | 'high'.
 */
function _calcFCFVolatility() {
  const fcf = state.historical?.derived?.fcf || state.historical?.metrics?.freeCashFlow;
  if (!fcf) return null;
  const valid = fcf.filter(v => v != null && isFinite(v));
  if (valid.length < 3) return null;

  const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
  if (mean === 0) return { cv: Infinity, label: 'high' };
  const variance = valid.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / valid.length;
  const cv = Math.sqrt(variance) / Math.abs(mean);

  let label = 'low';
  if (cv > 0.5)      label = 'high';
  else if (cv > 0.25) label = 'moderate';
  return { cv, label };
}

/** Terminal value as % of EV */
function _calcTVPercent() {
  const d = state.dcf;
  if (!d?.valid || !d.summary) return null;
  const ev = d.summary.enterpriseValue;
  if (!ev || ev === 0) return null;
  return d.summary.pvTerminal / ev;
}

// ============================================================
// NEW CHART HELPER FUNCTIONS (for 5 advanced charts)
// ============================================================

/** CAGR of a numeric series over a sliding window.
 *  Returns null if insufficient data. */
function safeCAGR(series, years, window) {
  if (!series || series.length < 2) return null;
  const w = window || series.length;
  const slice = series.slice(-w).filter(v => v != null && isFinite(v) && v > 0);
  if (slice.length < 2) return null;
  const n = slice.length - 1;
  return Math.pow(slice[slice.length - 1] / slice[0], 1 / n) - 1;
}

/** Format a ratio as percent with 1 decimal, e.g. 0.123 => '12.3%' */
function safePct(val) {
  if (val == null || !isFinite(val)) return 'n/a';
  return (val * 100).toFixed(1) + '%';
}

/** Classify trend of a numeric series over lookback window.
 *  Returns 'expanding' | 'flat' | 'compressing'. */
function classifyTrend(series, lookback) {
  lookback = lookback || 4;
  if (!series) return null;
  const valid = series.filter(v => v != null && isFinite(v));
  if (valid.length < 2) return null;
  const recent = valid.slice(-Math.min(lookback, valid.length));
  const diff = recent[recent.length - 1] - recent[0];
  if (diff > 0.01) return 'expanding';
  if (diff < -0.01) return 'compressing';
  return 'flat';
}

/** Terminal Value % of Enterprise Value */
function computeTVPercent(pvTerminal, ev) {
  if (pvTerminal == null || ev == null || ev === 0) return null;
  return pvTerminal / ev;
}

/** FCF conversion series: FCF[i] / denominator[i] */
function computeFCFConversion(fcf, ebitda, ebit) {
  if (!fcf) return { series: null, basis: null };
  const denom = ebitda || ebit;
  const basis = ebitda ? 'EBITDA' : ebit ? 'EBIT' : null;
  if (!denom) return { series: null, basis: null };
  const len = Math.min(fcf.length, denom.length);
  const series = [];
  for (let i = 0; i < len; i++) {
    const f = fcf[i];
    const d = denom[i];
    if (f != null && d != null && d !== 0 && isFinite(f) && isFinite(d)) {
      series.push(f / d);
    } else {
      series.push(null);
    }
  }
  return { series, basis };
}

/** Leverage series: netDebt[i] / denominator[i] */
function computeLeverage(netDebt, ebitda, ebit) {
  if (!netDebt) return { series: null, basis: null };
  const denom = ebitda || ebit;
  const basis = ebitda ? 'EBITDA' : ebit ? 'EBIT' : null;
  if (!denom) return { series: null, basis: null };
  const len = Math.min(netDebt.length, denom.length);
  const series = [];
  for (let i = 0; i < len; i++) {
    const nd = netDebt[i];
    const d = denom[i];
    if (nd != null && d != null && d !== 0 && isFinite(nd) && isFinite(d)) {
      series.push(nd / d);
    } else {
      series.push(null);
    }
  }
  return { series, basis };
}

/** Get the last valid (non-null, finite) value from a series */
function _lastValid(series) {
  if (!series) return null;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null && isFinite(series[i])) return series[i];
  }
  return null;
}


// ============================================================
// NEW BADGE FUNCTIONS (for 5 advanced charts)
// ============================================================

/** Badges for ROIC vs WACC chart.
 *  Sources ROIC from keyMetrics (single source of truth). */
function _roicWaccBadges() {
  const parts = [];
  const wacc = state.dcf?.inputs?.wacc ?? state.dcf?.summary?.wacc;

  // Build ROIC series from keyMetrics for badge computation
  const kmData = _getROICFromKeyMetrics();
  const roicSeries = kmData ? kmData.values : (state.historical?.derived?.roic || null);
  const lastROIC = _lastValid(roicSeries);

  if (lastROIC != null) {
    const type = lastROIC > 0.12 ? 'good' : lastROIC < 0.05 ? 'bad' : 'neutral';
    parts.push(_badge('ROIC', safePct(lastROIC), type,
      'ROIC = NOPAT / Invested Capital'));
  }
  if (lastROIC != null && wacc != null) {
    const spread = lastROIC - wacc;
    const type = spread > 0.02 ? 'good' : spread < -0.02 ? 'bad' : 'warn';
    parts.push(_badge('Spread', safePct(spread), type,
      'ROIC - WACC spread. Positive = value creation'));
  }
  const trend = classifyTrend(roicSeries);
  if (trend) {
    const type = trend === 'expanding' ? 'good' : trend === 'compressing' ? 'bad' : 'neutral';
    const label = trend.charAt(0).toUpperCase() + trend.slice(1);
    parts.push(_badge('Trend', label, type,
      'Direction of ROIC over recent years'));
  }
  return parts.join('');
}

/** Badges for Terminal Value Dependency chart */
function _terminalDepBadges() {
  const parts = [];
  const d = state.dcf;
  if (!d?.valid || !d.summary) return '';
  const tvPct = computeTVPercent(d.summary.pvTerminal, d.summary.enterpriseValue);
  if (tvPct != null) {
    const pct = (tvPct * 100).toFixed(0) + '%';
    const type = tvPct > 0.75 ? 'bad' : tvPct > 0.60 ? 'warn' : 'good';
    parts.push(_badge('TV % of EV', pct, type,
      'PV(Terminal Value) / Enterprise Value'));
  }
  if (d.summary.npvFCF != null) {
    parts.push(_badge('PV FCFs', compactFmt(d.summary.npvFCF), 'neutral',
      'Sum of discounted forecast free cash flows'));
  }
  if (d.summary.pvTerminal != null) {
    parts.push(_badge('PV Terminal', compactFmt(d.summary.pvTerminal), 'neutral',
      'Present value of terminal value'));
  }
  return parts.join('');
}

/** Badges for Implied Exit Multiple chart */
function _impliedExitBadges() {
  const parts = [];
  const d = state.dcf;
  if (!d?.valid) return '';

  // Implied exit multiple from terminal value
  const impliedMultiple = _getImpliedExitMultiple();
  if (impliedMultiple != null) {
    const type = impliedMultiple > 20 ? 'warn' : impliedMultiple < 5 ? 'warn' : 'neutral';
    parts.push(_badge('Implied Exit', impliedMultiple.toFixed(1) + 'x', type,
      'Terminal EV / Terminal EBITDA (implied by DCF)'));
  }

  // Current multiple
  const currentMultiple = _getCurrentEVEBITDA();
  if (currentMultiple != null) {
    parts.push(_badge('Current', currentMultiple.toFixed(1) + 'x', 'neutral',
      'Current EV / EBITDA from market data'));
  }

  if (impliedMultiple != null && currentMultiple != null && currentMultiple !== 0) {
    const premDisc = (impliedMultiple - currentMultiple) / currentMultiple;
    const label = premDisc >= 0
      ? '+' + (premDisc * 100).toFixed(0) + '% premium'
      : (premDisc * 100).toFixed(0) + '% discount';
    const type = Math.abs(premDisc) > 0.3 ? 'warn' : 'neutral';
    parts.push(_badge('Gap', label, type,
      '(Implied - Current) / Current'));
  }
  return parts.join('');
}

/** Badges for FCF Conversion Trend chart */
function _fcfConversionBadges() {
  const parts = [];
  const fcf = state.historical?.derived?.fcf || state.historical?.metrics?.freeCashFlow;
  const ebitda = state.historical?.metrics?.ebitda;
  const ebit = state.historical?.metrics?.ebit;
  const { series, basis } = computeFCFConversion(fcf, ebitda, ebit);
  if (!series) return '';

  const lastVal = _lastValid(series);
  if (lastVal != null) {
    const pct = (lastVal * 100).toFixed(0) + '%';
    const type = lastVal > 0.6 ? 'good' : lastVal < 0.2 ? 'bad' : 'warn';
    parts.push(_badge('Latest FCF/' + basis, pct, type,
      'FCF / ' + basis + ' in most recent period'));
  }

  const trend = classifyTrend(series);
  if (trend) {
    const type = trend === 'expanding' ? 'good' : trend === 'compressing' ? 'bad' : 'neutral';
    const label = trend.charAt(0).toUpperCase() + trend.slice(1);
    parts.push(_badge('Trend', label, type,
      'Direction of FCF conversion over recent years'));
  }

  // Warning if persistently low
  const valid = series.filter(v => v != null && isFinite(v));
  const lowCount = valid.filter(v => v < 0.2).length;
  if (valid.length >= 3 && lowCount >= Math.ceil(valid.length * 0.5)) {
    parts.push(_badge('Warning', 'Low conversion', 'bad',
      'More than half of periods show conversion below 20%'));
  }
  return parts.join('');
}

/** Badges for Net Debt / EBITDA chart */
function _leverageBadges() {
  const parts = [];
  const netDebt = state.historical?.derived?.netDebt;
  const ebitda = state.historical?.metrics?.ebitda;
  const ebit = state.historical?.metrics?.ebit;
  const { series, basis } = computeLeverage(netDebt, ebitda, ebit);
  if (!series) return '';

  const lastVal = _lastValid(series);
  if (lastVal != null) {
    const type = lastVal > 3 ? 'bad' : lastVal > 2 ? 'warn' : 'good';
    parts.push(_badge('Net Debt/' + basis, lastVal.toFixed(1) + 'x', type,
      'Net Debt / ' + basis + ' in most recent period'));
  }

  // Direction
  const valid = series.filter(v => v != null && isFinite(v));
  if (valid.length >= 2) {
    const first = valid[Math.max(0, valid.length - 4)];
    const last = valid[valid.length - 1];
    const diff = last - first;
    const direction = diff < -0.3 ? 'Deleveraging' : diff > 0.3 ? 'Levering up' : 'Stable';
    const type = direction === 'Deleveraging' ? 'good' : direction === 'Levering up' ? 'bad' : 'neutral';
    parts.push(_badge('Direction', direction, type,
      'Change in leverage over recent years'));
  }
  return parts.join('');
}


// ============================================================
// DATA RETRIEVAL HELPERS (for new charts)
// ============================================================

/** Get ROIC series from keyMetrics (single source of truth).
 *  Returns { labels: [...], values: [...] } covering historical + base + forecast.
 *  Falls back to state.historical.derived.roic for historical-only if keyMetrics unavailable. */
function _getROICSeries() {
  return state.historical?.derived?.roic || null;
}

/** Build full ROIC series from keyMetrics for chart use.
 *  Returns array of ROIC values aligned with allYears (hist + base + forecast). */
function _getROICFromKeyMetrics() {
  const km = state.dcf?.keyMetrics;
  if (!km) return null;

  const histLabels = state.dcf?.historicalYearLabels || [];
  const baseLabel = state.dcf?.baseYear ? String(state.dcf.baseYear) : null;
  const forecastLabels = state.dcf?.forecastYearLabels || [];
  const allYears = [...histLabels, ...(baseLabel ? [baseLabel] : []), ...forecastLabels];
  if (!allYears.length) return null;

  const values = allYears.map(yr => km[yr]?.roic ?? null);
  // Only return if at least one value is non-null
  if (!values.some(v => v != null)) return null;
  return { labels: allYears, values };
}

/** Get WACC: prefer dcf.inputs.wacc, then dcf.summary.wacc */
function _getWACC() {
  return state.dcf?.inputs?.wacc ?? state.dcf?.summary?.wacc ?? null;
}

/** Compute implied exit EV/EBITDA from terminal value.
 *  Terminal EBITDA = terminal year revenue * EBITDA margin.
 *  If no EBITDA margin available, use EBIT margin.
 *  Implied multiple = Terminal Value / Terminal EBITDA. */
function _getImpliedExitMultiple() {
  const d = state.dcf;
  if (!d?.valid || !d.summary?.terminalValue) return null;
  const n = d.inputs?.forecastYears || d.forecast?.revenue?.length;
  if (!n) return null;

  // Terminal year revenue
  const termRev = d.forecast?.revenue?.[n - 1];
  if (!termRev) return null;

  // Terminal EBITDA: try to compute from EBIT + D&A
  const termEbit = d.forecast?.ebit?.[n - 1];
  const termDA = d.forecast?.da?.[n - 1];
  let termEbitda = null;
  if (termEbit != null && termDA != null) {
    termEbitda = termEbit + termDA;
  }

  // Fallback: use EBITDA margin from historical if available
  if (termEbitda == null) {
    const ebitdaMargin = _lastValid(state.historical?.derived?.ebitdaMargin);
    if (ebitdaMargin != null) {
      termEbitda = termRev * ebitdaMargin;
    }
  }

  // Final fallback: use EBIT as rough proxy
  if (termEbitda == null && termEbit != null) {
    termEbitda = termEbit;
  }

  if (!termEbitda || termEbitda <= 0) return null;
  return d.summary.terminalValue / termEbitda;
}

/** Get current EV/EBITDA: prefer state.market, then historical metrics, then derive */
function _getCurrentEVEBITDA() {
  // Option 1: explicit market data
  if (state.market?.evToEbitda != null) return state.market.evToEbitda;

  // Option 2: from Multiples tab in historical metrics
  const fromMultiples = _lastValid(state.historical?.metrics?.evToEbitda);
  if (fromMultiples != null && fromMultiples > 0) return fromMultiples;

  // Option 3: derive from market EV and current EBITDA
  const marketEV = state.market?.enterpriseValue;
  const currentEBITDA = _lastValid(state.historical?.metrics?.ebitda);
  if (marketEV != null && currentEBITDA != null && currentEBITDA > 0) {
    return marketEV / currentEBITDA;
  }

  return null;
}


// ============================================================
// CHART.JS PLUGIN: Actual vs Forecast divider + shading
// ============================================================
const actualVsForecastPlugin = {
  id: 'actualVsForecast',
  beforeDraw(chart) {
    const opts = chart.options.plugins?.actualVsForecast;
    if (!opts || opts.dividerIndex == null) return;

    const { ctx, chartArea } = chart;
    const xScale = chart.scales.x;
    const idx = opts.dividerIndex;

    // Get pixel position between last actual and first forecast tick
    const tickPositions = xScale.ticks.map((_, i) => xScale.getPixelForTick(i));
    if (idx < 0 || idx >= tickPositions.length) return;

    const dividerX = idx < tickPositions.length - 1
      ? (tickPositions[idx] + tickPositions[idx + 1]) / 2
      : tickPositions[idx] + 20;

    // Forecast shading region (right of divider)
    ctx.save();
    ctx.fillStyle = 'rgba(79, 142, 247, 0.04)';
    ctx.fillRect(
      dividerX, chartArea.top,
      chartArea.right - dividerX, chartArea.bottom - chartArea.top
    );

    // Divider line
    ctx.strokeStyle = CHART_COLORS.primary;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(dividerX, chartArea.top);
    ctx.lineTo(dividerX, chartArea.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.font = '600 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = DESIGN_TOKENS.textMuted;
    ctx.fillText('ACTUAL', dividerX - 6, chartArea.top + 12);
    ctx.textAlign = 'left';
    ctx.fillStyle = CHART_COLORS.primary;
    ctx.fillText('FORECAST', dividerX + 6, chartArea.top + 12);

    ctx.restore();
  }
};

// Register the plugin globally
Chart.register(actualVsForecastPlugin);


// ============================================================
// BADGE HTML GENERATION
// ============================================================

function _badgeColor(type) {
  switch (type) {
    case 'good':    return `background:rgba(34,197,94,0.12);color:${CHART_COLORS.success}`;
    case 'bad':     return `background:rgba(239,68,68,0.12);color:${CHART_COLORS.danger}`;
    case 'warn':    return `background:rgba(245,158,11,0.12);color:${CHART_COLORS.warning}`;
    case 'neutral': return `background:rgba(79,142,247,0.10);color:${CHART_COLORS.primary}`;
    default:        return `background:${DESIGN_TOKENS.bgElevated};color:${DESIGN_TOKENS.textSecondary}`;
  }
}

function _badge(label, value, type, tooltip) {
  const style = _badgeColor(type);
  const tip = tooltip ? ` data-chart-tip="${tooltip.replace(/"/g, '&quot;')}"` : '';
  return `<span class="chart-insight-badge" style="${style}"${tip}>${label}: ${value}</span>`;
}

/** Build badge row HTML for the Revenue + EBITDA chart */
function _revenueBadges() {
  const parts = [];
  const cagr = _calcRevenueCagr();
  if (cagr != null) {
    const pct = (cagr * 100).toFixed(1) + '%';
    const type = cagr > 0.05 ? 'good' : cagr < 0 ? 'bad' : 'neutral';
    parts.push(_badge('Rev CAGR', pct, type, 'CAGR = (Last Rev / First Rev)^(1/n) - 1'));
  }
  const trend = _calcMarginTrend();
  if (trend) {
    const type = trend === 'expanding' ? 'good' : trend === 'compressing' ? 'bad' : 'neutral';
    const label = trend.charAt(0).toUpperCase() + trend.slice(1);
    parts.push(_badge('Margin', label, type, 'Compares earliest vs latest EBITDA margin over recent years'));
  }
  return parts.join('');
}

/** Build badge row HTML for the FCF chart */
function _fcfBadges() {
  const parts = [];
  const conv = _calcFCFConversion();
  if (conv.value != null) {
    const pct = (conv.value * 100).toFixed(0) + '%';
    const type = conv.value > 0.6 ? 'good' : conv.value < 0.3 ? 'bad' : 'warn';
    parts.push(_badge('FCF/' + conv.basis, pct, type,
      'FCF Conversion = trailing 3yr avg FCF / avg ' + conv.basis));
  }
  const vol = _calcFCFVolatility();
  if (vol) {
    const cvPct = (vol.cv * 100).toFixed(0) + '%';
    const type = vol.label === 'low' ? 'good' : vol.label === 'high' ? 'bad' : 'warn';
    const label = vol.label.charAt(0).toUpperCase() + vol.label.slice(1);
    parts.push(_badge('Volatility', label + ' (' + cvPct + ' CV)', type,
      'Coefficient of Variation = stdev(FCF) / |mean(FCF)|'));
  }
  return parts.join('');
}

/** Build badge row HTML for the EV waterfall chart */
function _evBadges() {
  const parts = [];
  const tvPct = _calcTVPercent();
  if (tvPct != null) {
    const pct = (tvPct * 100).toFixed(0) + '%';
    const type = tvPct > 0.75 ? 'warn' : tvPct > 0.60 ? 'neutral' : 'good';
    parts.push(_badge('Terminal % of EV', pct, type,
      'PV(Terminal Value) / Enterprise Value. High % means valuation is heavily assumption-dependent'));
  }
  const d = state.dcf;
  if (d?.valid && d.summary) {
    const wacc = d.summary.wacc != null ? (d.summary.wacc * 100).toFixed(1) + '%' : '?';
    const g    = d.summary.terminalGrowth != null ? (d.summary.terminalGrowth * 100).toFixed(1) + '%' : '?';
    parts.push(_badge('WACC', wacc, 'neutral', 'Weighted Average Cost of Capital used to discount cash flows'));
    parts.push(_badge('Terminal g', g, 'neutral', 'Perpetual growth rate applied to terminal FCF'));
  }
  return parts.join('');
}


// ============================================================
// TEACHING EXPLANATIONS (small note beneath each chart)
// ============================================================

function _teachingNote(text, formula) {
  const formulaHtml = formula
    ? ` <span class="chart-formula" data-chart-tip="${formula.replace(/"/g, '&quot;')}">[ formula ]</span>`
    : '';
  return `<div class="chart-teaching-note">${text}${formulaHtml}</div>`;
}


// ============================================================
// FCF VOLATILITY BAND COMPUTATION
// Returns { upper, lower, mean } arrays parallel to data labels
// ============================================================
function _fcfVolatilityBand(fcfSeries) {
  if (!fcfSeries) return null;
  const valid = fcfSeries.filter(v => v != null && isFinite(v));
  if (valid.length < 3) return null;
  const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
  const stdev = Math.sqrt(valid.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / valid.length);

  return {
    upper: fcfSeries.map(v => v != null ? v + stdev : null),
    lower: fcfSeries.map(v => v != null ? v - stdev : null),
    mean:  fcfSeries.map(() => mean),
    stdev,
  };
}


// ============================================================
// CHART 1: EV Waterfall
// ============================================================
function renderEVWaterfall(canvasId) {
  destroyChart('evWaterfall');
  const canvas = document.getElementById(canvasId);
  if (!canvas || !state.dcf?.valid) return;

  const d      = state.dcf;
  const n      = d.inputs.forecastYears;
  const labels = [...d.forecastYearLabels, 'Terminal\nValue', 'Enterprise\nValue'];

  const pvFCFData    = [...d.forecast.pvFCF, null, null];
  const terminalData = [...Array(n).fill(null), d.summary.pvTerminal, null];
  const evTotalData  = [...Array(n + 1).fill(null), d.summary.enterpriseValue];

  // Terminal % for enhanced tooltip
  const tvPct = _calcTVPercent();
  const fcfPct = tvPct != null ? (1 - tvPct) : null;

  const cfg = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'PV of FCF',
          data: pvFCFData,
          backgroundColor: CHART_COLORS.primary + 'cc',
          borderColor: CHART_COLORS.primary,
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'PV of Terminal Value',
          data: terminalData,
          backgroundColor: CHART_COLORS.secondary + 'cc',
          borderColor: CHART_COLORS.secondary,
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Enterprise Value',
          data: evTotalData,
          backgroundColor: CHART_COLORS.terminal + 'cc',
          borderColor: CHART_COLORS.terminal,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...darkDefaults(),
      plugins: {
        ...darkDefaults().plugins,
        title: {
          display: true,
          text: 'Enterprise Value Bridge',
          color: DESIGN_TOKENS.textPrimary,
          font: { size: 13, weight: '600', family: 'Inter, system-ui, sans-serif' },
          padding: { bottom: 12 },
        },
        tooltip: {
          ...darkDefaults().plugins.tooltip,
          callbacks: {
            label(ctx) {
              const base = ` ${ctx.dataset.label}: ${compactFmt(ctx.raw)}`;
              // Add composition % on EV bar
              if (ctx.datasetIndex === 2 && ctx.raw != null && fcfPct != null) {
                return [
                  base,
                  `  FCF component: ${(fcfPct * 100).toFixed(0)}%`,
                  `  Terminal component: ${(tvPct * 100).toFixed(0)}%`,
                ];
              }
              return base;
            },
          },
        },
      },
      scales: {
        x: darkDefaults().scales.x,
        y: {
          ...darkDefaults().scales.y,
          ticks: { ...darkDefaults().scales.y.ticks, callback: v => compactFmt(v) },
        },
      },
    },
  };

  _chartInstances.evWaterfall = new Chart(canvas, cfg);
}


// ============================================================
// CHART 2: Free Cash Flow (Historical + optional Forecast)
// ============================================================
function renderFCFChart(canvasId) {
  destroyChart('fcfChart');
  const canvas = document.getElementById(canvasId);
  if (!canvas || !state.historical) return;

  const histYears = state.historical.years;
  const fcf       = state.historical.derived?.fcf || state.historical.metrics?.freeCashFlow;
  if (!fcf) return;

  const hasForecast = !!(state.dcf?.valid && state.dcf.forecast?.fcf);

  // Combine historical + forecast labels and data
  let labels, fcfData, lastActualIndex;
  if (hasForecast) {
    labels = [...histYears, ...state.dcf.forecastYearLabels];
    fcfData = [...fcf, ...state.dcf.forecast.fcf];
    lastActualIndex = histYears.length - 1;
  } else {
    labels = histYears;
    fcfData = fcf;
    lastActualIndex = null;
  }

  // Color bars: green positive, red negative; forecast bars slightly more transparent
  const barColors = fcfData.map((v, i) => {
    const isForecast = hasForecast && i > lastActualIndex;
    const alpha = isForecast ? '88' : 'cc';
    if (v === null) return CHART_COLORS.neutral + '66';
    return v >= 0 ? CHART_COLORS.success + alpha : CHART_COLORS.danger + alpha;
  });
  const borderColors = fcfData.map((v, i) => {
    const isForecast = hasForecast && i > lastActualIndex;
    if (v === null) return CHART_COLORS.neutral;
    const base = v >= 0 ? CHART_COLORS.success : CHART_COLORS.danger;
    return isForecast ? base + 'aa' : base;
  });

  const datasets = [{
    label: 'Free Cash Flow',
    data: fcfData,
    backgroundColor: barColors,
    borderColor: borderColors,
    borderWidth: 1,
    borderRadius: 4,
  }];

  // Volatility band (historical only)
  const band = _fcfVolatilityBand(fcf);
  if (band) {
    // Extend band arrays with nulls for forecast period
    const upperData = hasForecast
      ? [...band.upper, ...state.dcf.forecast.fcf.map(() => null)]
      : band.upper;
    const lowerData = hasForecast
      ? [...band.lower, ...state.dcf.forecast.fcf.map(() => null)]
      : band.lower;
    const meanData = hasForecast
      ? [...band.mean, ...state.dcf.forecast.fcf.map(() => null)]
      : band.mean;

    datasets.push({
      label: 'Mean + 1 Stdev',
      data: upperData,
      type: 'line',
      borderColor: CHART_COLORS.neutral + '66',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderDash: [3, 3],
      pointRadius: 0,
      fill: false,
    });
    datasets.push({
      label: 'Mean - 1 Stdev',
      data: lowerData,
      type: 'line',
      borderColor: CHART_COLORS.neutral + '66',
      backgroundColor: CHART_COLORS.neutral + '0d',
      borderWidth: 1,
      borderDash: [3, 3],
      pointRadius: 0,
      fill: '-1', // fill between this and previous dataset
    });
  }

  const cfg = {
    type: 'bar',
    data: { labels, datasets },
    options: {
      ...darkDefaults(),
      plugins: {
        ...darkDefaults().plugins,
        title: {
          display: true,
          text: hasForecast ? 'Free Cash Flow (Actual + Forecast)' : 'Historical Free Cash Flow',
          color: DESIGN_TOKENS.textPrimary,
          font: { size: 13, weight: '600', family: 'Inter, system-ui, sans-serif' },
          padding: { bottom: 12 },
        },
        tooltip: {
          ...darkDefaults().plugins.tooltip,
          filter: item => item.dataset.label === 'Free Cash Flow',
          callbacks: {
            label: ctx => ` FCF: ${compactFmt(ctx.raw)}`,
          },
        },
        actualVsForecast: lastActualIndex != null
          ? { dividerIndex: lastActualIndex }
          : undefined,
        legend: {
          ...darkDefaults().plugins.legend,
          labels: {
            ...darkDefaults().plugins.legend.labels,
            filter: item => item.text === 'Free Cash Flow',
          },
        },
      },
      scales: {
        x: darkDefaults().scales.x,
        y: {
          ...darkDefaults().scales.y,
          ticks: { ...darkDefaults().scales.y.ticks, callback: v => compactFmt(v) },
        },
      },
    },
  };

  _chartInstances.fcfChart = new Chart(canvas, cfg);
}


// ============================================================
// CHART 3: Revenue + EBITDA/EBIT + Margin % (dual axis)
//   with optional forecast overlay
// ============================================================
function renderRevenueEBITDAChart(canvasId) {
  destroyChart('revenueChart');
  const canvas = document.getElementById(canvasId);
  if (!canvas || !state.historical) return;

  const histYears = state.historical.years;
  const revenue   = state.historical.metrics?.revenue;
  const ebitda    = state.historical.metrics?.ebitda;
  const ebit      = state.historical.metrics?.ebit;
  if (!revenue) return;

  const hasForecast = !!(state.dcf?.valid && state.dcf.forecast?.revenue);
  const profitMetric = ebitda ? 'EBITDA' : ebit ? 'EBIT' : null;
  const profitData   = ebitda || ebit;

  // Compute margin series for historical data
  const histMargins = state.historical.derived?.ebitdaMargin
    || state.historical.derived?.ebitMargin;

  // Build combined labels and data
  let labels, revData, profData, marginData, lastActualIndex;

  if (hasForecast) {
    labels = [...histYears, ...state.dcf.forecastYearLabels];
    revData = [...revenue, ...state.dcf.forecast.revenue];
    lastActualIndex = histYears.length - 1;

    // Profit: use forecast EBIT for projected portion
    if (profitData) {
      const forecastProfit = state.dcf.forecast.ebit || [];
      profData = [...profitData, ...forecastProfit];
    } else {
      profData = null;
    }

    // Margin: compute for forecast from ebit margin input
    if (histMargins) {
      const forecastMargins = state.dcf.forecast.revenue.map((rev, i) => {
        const forecastEbit = state.dcf.forecast.ebit?.[i];
        if (rev && forecastEbit) return forecastEbit / rev;
        return state.dcf.inputs?.ebitMargin || null;
      });
      marginData = [...histMargins, ...forecastMargins];
    } else {
      marginData = null;
    }
  } else {
    labels = histYears;
    revData = revenue;
    profData = profitData;
    marginData = histMargins;
    lastActualIndex = null;
  }

  const datasets = [];

  // Revenue bars
  const revBarColors = revData.map((_, i) => {
    const isForecast = hasForecast && i > lastActualIndex;
    return CHART_COLORS.primary + (isForecast ? '44' : '66');
  });
  const revBorderColors = revData.map((_, i) => {
    const isForecast = hasForecast && i > lastActualIndex;
    return CHART_COLORS.primary + (isForecast ? '88' : 'ff');
  });

  datasets.push({
    type: 'bar',
    label: 'Revenue',
    data: revData,
    backgroundColor: revBarColors,
    borderColor: revBorderColors,
    borderWidth: 1,
    borderRadius: 4,
    yAxisID: 'y',
    order: 2,
  });

  // Profitability line (EBITDA or EBIT)
  if (profData) {
    const lineColor = ebitda ? CHART_COLORS.terminal : CHART_COLORS.warning;
    datasets.push({
      type: 'line',
      label: profitMetric,
      data: profData,
      borderColor: lineColor,
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointBackgroundColor: lineColor,
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.3,
      yAxisID: 'y',
      order: 1,
    });
  }

  // EBITDA/EBIT margin line on right axis (y1)
  if (marginData) {
    const marginLabel = profitMetric ? profitMetric + ' Margin %' : 'Margin %';
    datasets.push({
      type: 'line',
      label: marginLabel,
      data: marginData.map(v => v != null ? v * 100 : null),
      borderColor: CHART_COLORS.warning + 'cc',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderDash: [4, 3],
      pointBackgroundColor: CHART_COLORS.warning,
      pointRadius: 2,
      pointHoverRadius: 4,
      tension: 0.3,
      yAxisID: 'y1',
      order: 0,
    });
  }

  const cfg = {
    type: 'bar',
    data: { labels, datasets },
    options: {
      ...darkDefaults(),
      plugins: {
        ...darkDefaults().plugins,
        title: {
          display: true,
          text: 'Revenue' + (profitMetric ? ' & ' + profitMetric : '') + (marginData ? ' + Margin' : ''),
          color: DESIGN_TOKENS.textPrimary,
          font: { size: 13, weight: '600', family: 'Inter, system-ui, sans-serif' },
          padding: { bottom: 12 },
        },
        tooltip: {
          ...darkDefaults().plugins.tooltip,
          callbacks: {
            label(ctx) {
              if (ctx.dataset.yAxisID === 'y1') {
                return ` ${ctx.dataset.label}: ${ctx.raw != null ? ctx.raw.toFixed(1) + '%' : 'n/a'}`;
              }
              return ` ${ctx.dataset.label}: ${compactFmt(ctx.raw)}`;
            },
          },
        },
        actualVsForecast: lastActualIndex != null
          ? { dividerIndex: lastActualIndex }
          : undefined,
      },
      scales: {
        x: darkDefaults().scales.x,
        y: {
          ...darkDefaults().scales.y,
          position: 'left',
          ticks: { ...darkDefaults().scales.y.ticks, callback: v => compactFmt(v) },
        },
        // Right axis for margin %
        ...(marginData ? {
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              color: CHART_COLORS.warning,
              font: { size: 10 },
              callback: v => v.toFixed(0) + '%',
            },
            title: {
              display: true,
              text: 'Margin %',
              color: CHART_COLORS.warning,
              font: { size: 10 },
            },
          },
        } : {}),
      },
    },
  };

  _chartInstances.revenueChart = new Chart(canvas, cfg);
}


// ============================================================
// CHART 4: ROIC vs WACC (Value Creation)
// Sources ROIC from state.dcf.keyMetrics (single source of truth).
// For forecast years without balance sheet data, ROIC will be null
// and the chart will show gaps — no fabricated approximations.
// ============================================================
function renderROICvsWACCChart(canvasId) {
  destroyChart('roicWaccChart');
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const wacc = _getWACC();

  // Primary source: keyMetrics (covers hist + base + forecast, null where unavailable)
  const kmData = _getROICFromKeyMetrics();

  // Fallback: historical derived ROIC only (pre-DCF state)
  const histROIC = _getROICSeries();
  const histYears = state.historical?.years || [];

  let labels, roicData, waccData, lastActualIndex;

  if (kmData) {
    // Use keyMetrics — already aligned across all years
    labels = kmData.labels;
    roicData = kmData.values;
    // Determine last actual index: count historical + base years
    const histLabels = state.dcf?.historicalYearLabels || [];
    const baseLabel = state.dcf?.baseYear ? String(state.dcf.baseYear) : null;
    const numActual = histLabels.length + (baseLabel ? 1 : 0);
    lastActualIndex = numActual > 0 && state.dcf?.forecastYearLabels?.length > 0
      ? numActual - 1 : null;
    waccData = wacc != null ? labels.map(() => wacc) : null;
  } else if (histROIC) {
    // Fallback: historical only
    labels = histYears;
    roicData = histROIC;
    waccData = wacc != null ? labels.map(() => wacc) : null;
    lastActualIndex = null;
  } else {
    // No ROIC data at all
    if (wacc == null) return;
    labels = histYears;
    roicData = [];
    waccData = labels.map(() => wacc);
    lastActualIndex = null;
  }

  const datasets = [];

  // ROIC line
  if (roicData && roicData.some(v => v != null)) {
    datasets.push({
      label: 'ROIC',
      data: roicData.map(v => v != null ? v * 100 : null),
      borderColor: CHART_COLORS.success,
      backgroundColor: CHART_COLORS.success + '22',
      borderWidth: 2.5,
      pointBackgroundColor: CHART_COLORS.success,
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.3,
      fill: false,
      spanGaps: false, // Don't connect across missing forecast values
    });
  }

  // WACC line (flat)
  if (waccData) {
    datasets.push({
      label: 'WACC',
      data: waccData.map(v => v != null ? v * 100 : null),
      borderColor: CHART_COLORS.danger,
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [6, 3],
      pointRadius: 0,
      fill: false,
    });
  }

  if (!datasets.length) return;

  const cfg = {
    type: 'line',
    data: { labels, datasets },
    options: {
      ...darkDefaults(),
      plugins: {
        ...darkDefaults().plugins,
        title: {
          display: true,
          text: 'ROIC vs WACC (Value Creation)',
          color: DESIGN_TOKENS.textPrimary,
          font: { size: 13, weight: '600', family: 'Inter, system-ui, sans-serif' },
          padding: { bottom: 12 },
        },
        tooltip: {
          ...darkDefaults().plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.raw != null ? ctx.raw.toFixed(1) + '%' : 'n/a'}`,
          },
        },
        actualVsForecast: lastActualIndex != null
          ? { dividerIndex: lastActualIndex }
          : undefined,
      },
      scales: {
        x: darkDefaults().scales.x,
        y: {
          ...darkDefaults().scales.y,
          ticks: {
            ...darkDefaults().scales.y.ticks,
            callback: v => v.toFixed(0) + '%',
          },
          title: {
            display: true,
            text: 'Return / Cost of Capital (%)',
            color: DESIGN_TOKENS.textMuted,
            font: { size: 10 },
          },
        },
      },
    },
  };

  _chartInstances.roicWaccChart = new Chart(canvas, cfg);
}


// ============================================================
// CHART 5: Terminal Value Dependency (PV FCF vs PV Terminal)
// ============================================================
function renderTerminalDependencyChart(canvasId) {
  destroyChart('termDepChart');
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const d = state.dcf;
  if (!d?.valid || !d.summary) return;

  const npvFCF = d.summary.npvFCF;
  const pvTerminal = d.summary.pvTerminal;
  const ev = d.summary.enterpriseValue;
  if (npvFCF == null || pvTerminal == null || ev == null) return;

  const tvPct = computeTVPercent(pvTerminal, ev);
  const fcfPct = tvPct != null ? 1 - tvPct : null;

  const cfg = {
    type: 'bar',
    data: {
      labels: ['PV of Forecast\nCash Flows', 'PV of Terminal\nValue'],
      datasets: [{
        label: 'Value Component',
        data: [npvFCF, pvTerminal],
        backgroundColor: [CHART_COLORS.primary + 'cc', CHART_COLORS.secondary + 'cc'],
        borderColor: [CHART_COLORS.primary, CHART_COLORS.secondary],
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.5,
      }],
    },
    options: {
      ...darkDefaults(),
      indexAxis: 'y',
      plugins: {
        ...darkDefaults().plugins,
        title: {
          display: true,
          text: 'Terminal Value Dependency',
          color: DESIGN_TOKENS.textPrimary,
          font: { size: 13, weight: '600', family: 'Inter, system-ui, sans-serif' },
          padding: { bottom: 12 },
        },
        tooltip: {
          ...darkDefaults().plugins.tooltip,
          callbacks: {
            label(ctx) {
              const val = compactFmt(ctx.raw);
              const pct = ctx.dataIndex === 0
                ? (fcfPct != null ? ' (' + (fcfPct * 100).toFixed(0) + '% of EV)' : '')
                : (tvPct != null ? ' (' + (tvPct * 100).toFixed(0) + '% of EV)' : '');
              return ` ${val}${pct}`;
            },
          },
        },
        legend: { display: false },
      },
      scales: {
        x: {
          ...darkDefaults().scales.x,
          ticks: {
            ...darkDefaults().scales.x.ticks,
            callback: v => compactFmt(v),
          },
        },
        y: {
          ...darkDefaults().scales.y,
          ticks: {
            ...darkDefaults().scales.y.ticks,
            font: { size: 10 },
          },
        },
      },
    },
  };

  _chartInstances.termDepChart = new Chart(canvas, cfg);
}


// ============================================================
// CHART 6: Implied Exit Multiple vs Current Multiple
// ============================================================
function renderImpliedExitMultipleChart(canvasId) {
  destroyChart('exitMultChart');
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const implied = _getImpliedExitMultiple();
  const current = _getCurrentEVEBITDA();

  // Need at least one value
  if (implied == null && current == null) return;

  const labels = [];
  const data = [];
  const colors = [];
  const borders = [];

  if (implied != null) {
    labels.push('Implied Exit\nEV/EBITDA');
    data.push(implied);
    colors.push(CHART_COLORS.primary + 'cc');
    borders.push(CHART_COLORS.primary);
  }
  if (current != null) {
    labels.push('Current\nEV/EBITDA');
    data.push(current);
    colors.push(CHART_COLORS.terminal + 'cc');
    borders.push(CHART_COLORS.terminal);
  }

  const cfg = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'EV/EBITDA Multiple',
        data,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.4,
      }],
    },
    options: {
      ...darkDefaults(),
      plugins: {
        ...darkDefaults().plugins,
        title: {
          display: true,
          text: 'Implied Exit Multiple vs Current',
          color: DESIGN_TOKENS.textPrimary,
          font: { size: 13, weight: '600', family: 'Inter, system-ui, sans-serif' },
          padding: { bottom: 12 },
        },
        tooltip: {
          ...darkDefaults().plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.raw.toFixed(1)}x EV/EBITDA`,
          },
        },
        legend: { display: false },
      },
      scales: {
        x: darkDefaults().scales.x,
        y: {
          ...darkDefaults().scales.y,
          ticks: {
            ...darkDefaults().scales.y.ticks,
            callback: v => v.toFixed(0) + 'x',
          },
          title: {
            display: true,
            text: 'EV / EBITDA',
            color: DESIGN_TOKENS.textMuted,
            font: { size: 10 },
          },
          beginAtZero: true,
        },
      },
    },
  };

  _chartInstances.exitMultChart = new Chart(canvas, cfg);
}


// ============================================================
// CHART 7: FCF Conversion Trend (FCF / EBITDA or / EBIT)
// ============================================================
function renderFCFConversionTrendChart(canvasId) {
  destroyChart('fcfConvChart');
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const histYears = state.historical?.years || [];
  const fcf = state.historical?.derived?.fcf || state.historical?.metrics?.freeCashFlow;
  const ebitda = state.historical?.metrics?.ebitda;
  const ebit = state.historical?.metrics?.ebit;
  const { series, basis } = computeFCFConversion(fcf, ebitda, ebit);
  if (!series || !series.some(v => v != null)) return;

  const hasForecast = !!(state.dcf?.valid && state.dcf.forecast?.fcf);
  let labels, convData, lastActualIndex;

  if (hasForecast) {
    labels = [...histYears, ...state.dcf.forecastYearLabels];
    lastActualIndex = histYears.length - 1;

    // Compute forecast conversion
    const fFCF = state.dcf.forecast.fcf;
    const fEbit = state.dcf.forecast.ebit;
    const fDA = state.dcf.forecast.da;
    const forecastConv = [];
    for (let i = 0; i < (fFCF?.length || 0); i++) {
      let denom = null;
      if (basis === 'EBITDA' && fEbit?.[i] != null && fDA?.[i] != null) {
        denom = fEbit[i] + fDA[i];
      } else if (fEbit?.[i] != null) {
        denom = fEbit[i];
      }
      if (fFCF?.[i] != null && denom != null && denom !== 0) {
        forecastConv.push(fFCF[i] / denom);
      } else {
        forecastConv.push(null);
      }
    }
    convData = [...series, ...forecastConv];
  } else {
    labels = histYears;
    convData = series;
    lastActualIndex = null;
  }

  // Color points by quality
  const pointColors = convData.map(v => {
    if (v == null) return CHART_COLORS.neutral;
    if (v > 0.6) return CHART_COLORS.success;
    if (v > 0.3) return CHART_COLORS.warning;
    return CHART_COLORS.danger;
  });

  const cfg = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'FCF / ' + basis,
        data: convData.map(v => v != null ? v * 100 : null),
        borderColor: CHART_COLORS.primary,
        backgroundColor: CHART_COLORS.primary + '18',
        borderWidth: 2.5,
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: true,
        spanGaps: true,
      }],
    },
    options: {
      ...darkDefaults(),
      plugins: {
        ...darkDefaults().plugins,
        title: {
          display: true,
          text: 'FCF Conversion Trend (FCF / ' + basis + ')',
          color: DESIGN_TOKENS.textPrimary,
          font: { size: 13, weight: '600', family: 'Inter, system-ui, sans-serif' },
          padding: { bottom: 12 },
        },
        tooltip: {
          ...darkDefaults().plugins.tooltip,
          callbacks: {
            label: ctx => ` FCF/${basis}: ${ctx.raw != null ? ctx.raw.toFixed(1) + '%' : 'n/a'}`,
          },
        },
        actualVsForecast: lastActualIndex != null
          ? { dividerIndex: lastActualIndex }
          : undefined,
      },
      scales: {
        x: darkDefaults().scales.x,
        y: {
          ...darkDefaults().scales.y,
          ticks: {
            ...darkDefaults().scales.y.ticks,
            callback: v => v.toFixed(0) + '%',
          },
          title: {
            display: true,
            text: 'Conversion Rate (%)',
            color: DESIGN_TOKENS.textMuted,
            font: { size: 10 },
          },
        },
      },
    },
  };

  _chartInstances.fcfConvChart = new Chart(canvas, cfg);
}


// ============================================================
// CHART 8: Net Debt / EBITDA Trend (Leverage)
// ============================================================
function renderNetDebtEbitdaChart(canvasId) {
  destroyChart('leverageChart');
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const histYears = state.historical?.years || [];
  const netDebt = state.historical?.derived?.netDebt;
  const ebitda = state.historical?.metrics?.ebitda;
  const ebit = state.historical?.metrics?.ebit;
  const { series, basis } = computeLeverage(netDebt, ebitda, ebit);
  if (!series || !series.some(v => v != null)) return;

  const labels = histYears;
  const levData = series;

  // Threshold bands for background shading
  // Conservative: < 2x, Moderate: 2-3x, Aggressive: > 3x
  const thresholdPlugin = {
    id: 'leverageThresholds',
    beforeDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const yScale = scales.y;
      if (!yScale) return;

      ctx.save();

      // Green zone: 0 to 2x
      const y2 = yScale.getPixelForValue(2);
      const y0 = yScale.getPixelForValue(0);
      if (y2 < chartArea.bottom && y0 > chartArea.top) {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.04)';
        ctx.fillRect(chartArea.left, Math.max(y2, chartArea.top),
          chartArea.right - chartArea.left,
          Math.min(y0, chartArea.bottom) - Math.max(y2, chartArea.top));
      }

      // Yellow zone: 2x to 3x
      const y3 = yScale.getPixelForValue(3);
      if (y3 < chartArea.bottom) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.04)';
        ctx.fillRect(chartArea.left, Math.max(y3, chartArea.top),
          chartArea.right - chartArea.left,
          Math.min(y2, chartArea.bottom) - Math.max(y3, chartArea.top));
      }

      // Red zone: > 3x
      if (y3 > chartArea.top) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
        ctx.fillRect(chartArea.left, chartArea.top,
          chartArea.right - chartArea.left,
          Math.min(y3, chartArea.bottom) - chartArea.top);
      }

      ctx.restore();
    },
  };

  // Color points by leverage level
  const pointColors = levData.map(v => {
    if (v == null) return CHART_COLORS.neutral;
    if (v <= 2) return CHART_COLORS.success;
    if (v <= 3) return CHART_COLORS.warning;
    return CHART_COLORS.danger;
  });

  const cfg = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Net Debt / ' + basis,
        data: levData,
        borderColor: CHART_COLORS.warning,
        backgroundColor: CHART_COLORS.warning + '18',
        borderWidth: 2.5,
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: true,
        spanGaps: true,
      }],
    },
    plugins: [thresholdPlugin],
    options: {
      ...darkDefaults(),
      plugins: {
        ...darkDefaults().plugins,
        title: {
          display: true,
          text: 'Net Debt / ' + basis + ' (Leverage)',
          color: DESIGN_TOKENS.textPrimary,
          font: { size: 13, weight: '600', family: 'Inter, system-ui, sans-serif' },
          padding: { bottom: 12 },
        },
        tooltip: {
          ...darkDefaults().plugins.tooltip,
          callbacks: {
            label: ctx => ` Net Debt/${basis}: ${ctx.raw != null ? ctx.raw.toFixed(1) + 'x' : 'n/a'}`,
          },
        },
        legend: {
          ...darkDefaults().plugins.legend,
          display: false,
        },
      },
      scales: {
        x: darkDefaults().scales.x,
        y: {
          ...darkDefaults().scales.y,
          ticks: {
            ...darkDefaults().scales.y.ticks,
            callback: v => v.toFixed(1) + 'x',
          },
          title: {
            display: true,
            text: 'Net Debt / ' + basis,
            color: DESIGN_TOKENS.textMuted,
            font: { size: 10 },
          },
        },
      },
    },
  };

  _chartInstances.leverageChart = new Chart(canvas, cfg);
}


// ============================================================
// "DATA NOT AVAILABLE" PLACEHOLDER CARD
// ============================================================
function _unavailableCard(title, reason) {
  return `
    <div class="chart-card">
      <div class="chart-wrapper" style="display:flex;align-items:center;justify-content:center;">
        <div style="text-align:center;">
          <p style="font-size:0.75rem;font-weight:600;color:${DESIGN_TOKENS.textSecondary};margin:0 0 4px;">${title}</p>
          <p style="font-size:0.625rem;color:${DESIGN_TOKENS.textMuted};margin:0;">${reason}</p>
        </div>
      </div>
    </div>`;
}


// ============================================================
// MAIN RENDER FUNCTION
// Builds section HTML with badge rows + teaching notes,
// then draws all charts inside requestAnimationFrame.
// ============================================================
function renderCharts() {
  const container = document.getElementById('section-charts');
  if (!container) return;

  const hasHistorical = !!state.historical;
  const hasDCF        = !!(state.dcf?.valid);

  if (!hasHistorical) {
    container.innerHTML = `<div class="card"><p class="body text-muted">Charts will appear after a file is loaded.</p></div>`;
    return;
  }

  // Pre-compute badge HTML for original charts
  const evBadgeHtml  = hasDCF ? _evBadges() : '';
  const revBadgeHtml = _revenueBadges();
  const fcfBadgeHtml = _fcfBadges();

  // Pre-compute badge HTML for new charts
  const roicWaccBadgeHtml = _roicWaccBadges();
  const termDepBadgeHtml  = hasDCF ? _terminalDepBadges() : '';
  const exitMultBadgeHtml = hasDCF ? _impliedExitBadges() : '';
  const fcfConvBadgeHtml  = _fcfConversionBadges();
  const leverageBadgeHtml = _leverageBadges();

  // Data availability checks for new charts
  const hasROIC = !!(_getROICFromKeyMetrics() || _getROICSeries() || _getWACC() != null);
  const hasTermDep = !!(hasDCF && state.dcf.summary?.npvFCF != null && state.dcf.summary?.pvTerminal != null);
  const hasExitMult = !!(_getImpliedExitMultiple() != null || _getCurrentEVEBITDA() != null);
  const hasFCFConv = (() => {
    const fcf = state.historical?.derived?.fcf || state.historical?.metrics?.freeCashFlow;
    const ebitda = state.historical?.metrics?.ebitda;
    const ebit = state.historical?.metrics?.ebit;
    const { series } = computeFCFConversion(fcf, ebitda, ebit);
    return series && series.some(v => v != null);
  })();
  const hasLeverage = (() => {
    const nd = state.historical?.derived?.netDebt;
    const ebitda = state.historical?.metrics?.ebitda;
    const ebit = state.historical?.metrics?.ebit;
    const { series } = computeLeverage(nd, ebitda, ebit);
    return series && series.some(v => v != null);
  })();

  container.innerHTML = `
    <p class="caption" style="margin-bottom:6px;">Charts</p>
    <div class="charts-grid">
      ${hasDCF ? `
      <div class="chart-card">
        <div class="chart-badge-row">${evBadgeHtml}</div>
        <div class="chart-wrapper">
          <canvas id="canvas-ev-waterfall"></canvas>
        </div>
        ${_teachingNote(
          'Shows how forecast cash flows and terminal value combine to form Enterprise Value.',
          'EV = Sum(PV of FCF_t) + PV(Terminal Value)'
        )}
      </div>` : ''}

      <div class="chart-card">
        <div class="chart-badge-row">${revBadgeHtml}</div>
        <div class="chart-wrapper">
          <canvas id="canvas-revenue-ebitda"></canvas>
        </div>
        ${_teachingNote(
          'Revenue trend with profitability overlay. Margin % on the right axis shows operating efficiency.',
          'EBITDA Margin = EBITDA / Revenue'
        )}
      </div>

      <div class="chart-card">
        <div class="chart-badge-row">${fcfBadgeHtml}</div>
        <div class="chart-wrapper">
          <canvas id="canvas-fcf"></canvas>
        </div>
        ${_teachingNote(
          'Cash available to all capital providers after reinvestment. The shaded band shows historical volatility (+/- 1 stdev).',
          'FCF = NOPAT + D&A - CapEx - Change in NWC'
        )}
      </div>

      ${hasROIC ? `
      <div class="chart-card">
        <div class="chart-badge-row">${roicWaccBadgeHtml}</div>
        <div class="chart-wrapper">
          <canvas id="canvas-roic-wacc"></canvas>
        </div>
        ${_teachingNote(
          'ROIC above WACC indicates value creation. A widening spread signals improving capital efficiency.',
          'ROIC = NOPAT / Invested Capital; Spread = ROIC - WACC'
        )}
      </div>` : _unavailableCard('ROIC vs WACC', 'Requires EBIT, total equity, total debt, and cash data')}

      ${hasTermDep ? `
      <div class="chart-card">
        <div class="chart-badge-row">${termDepBadgeHtml}</div>
        <div class="chart-wrapper">
          <canvas id="canvas-term-dep"></canvas>
        </div>
        ${_teachingNote(
          'High terminal dependence increases sensitivity to WACC and terminal growth assumptions.',
          'TV % = PV(Terminal Value) / Enterprise Value'
        )}
      </div>` : (hasDCF ? '' : _unavailableCard('Terminal Value Dependency', 'Run DCF valuation to see this chart'))}

      ${hasExitMult ? `
      <div class="chart-card">
        <div class="chart-badge-row">${exitMultBadgeHtml}</div>
        <div class="chart-wrapper">
          <canvas id="canvas-exit-mult"></canvas>
        </div>
        ${_teachingNote(
          'Large gaps between implied and current multiples require conviction in growth or margin changes.',
          'Implied Exit EV/EBITDA = Terminal Value / Terminal EBITDA'
        )}
      </div>` : (hasDCF ? _unavailableCard('Implied Exit Multiple', 'Requires terminal value and EBITDA data') : '')}

      ${hasFCFConv ? `
      <div class="chart-card">
        <div class="chart-badge-row">${fcfConvBadgeHtml}</div>
        <div class="chart-wrapper">
          <canvas id="canvas-fcf-conv"></canvas>
        </div>
        ${_teachingNote(
          'Low conversion suggests working capital build or heavy capex relative to earnings.',
          'FCF Conversion = Free Cash Flow / EBITDA (or EBIT if no EBITDA)'
        )}
      </div>` : _unavailableCard('FCF Conversion Trend', 'Requires FCF and EBITDA or EBIT data')}

      ${hasLeverage ? `
      <div class="chart-card">
        <div class="chart-badge-row">${leverageBadgeHtml}</div>
        <div class="chart-wrapper">
          <canvas id="canvas-leverage"></canvas>
        </div>
        ${_teachingNote(
          'Higher leverage reduces flexibility in downturns. Below 2x is generally conservative.',
          'Leverage = Net Debt / EBITDA (or EBIT)'
        )}
      </div>` : _unavailableCard('Net Debt / EBITDA', 'Requires net debt (total debt, cash) and EBITDA data')}
    </div>
  `;

  // Defer chart rendering until DOM has painted
  requestAnimationFrame(() => {
    // Original charts
    if (hasDCF) renderEVWaterfall('canvas-ev-waterfall');
    renderRevenueEBITDAChart('canvas-revenue-ebitda');
    renderFCFChart('canvas-fcf');

    // New charts
    if (hasROIC)     renderROICvsWACCChart('canvas-roic-wacc');
    if (hasTermDep)  renderTerminalDependencyChart('canvas-term-dep');
    if (hasExitMult) renderImpliedExitMultipleChart('canvas-exit-mult');
    if (hasFCFConv)  renderFCFConversionTrendChart('canvas-fcf-conv');
    if (hasLeverage) renderNetDebtEbitdaChart('canvas-leverage');

    _bindChartTooltips();
    _bindChartDblClickForReportBuilder();
  });
}

// ============================================================
// REPORT BUILDER INTEGRATION — double-click chart to add
// ============================================================
function _bindChartDblClickForReportBuilder() {
  const container = document.getElementById('section-charts');
  if (!container) return;

  container.querySelectorAll('.chart-card').forEach(card => {
    if (card._rbDblClickBound) return;
    card._rbDblClickBound = true;

    card.addEventListener('dblclick', (e) => {
      // Don't capture if clicking on badges or teaching notes
      if (e.target.closest('.chart-badge-row') || e.target.closest('.chart-teaching-note')) return;
      if (typeof ReportBuilder !== 'undefined' && ReportBuilder.isOpen()) {
        ReportBuilder.onChartDblClick(card);
      }
    });
  });
}


// ============================================================
// LIGHTWEIGHT TOOLTIP HANDLER for chart badges + formula tags
// Uses data-chart-tip attribute. Does not conflict with 11a_tooltips.
// ============================================================
function _bindChartTooltips() {
  const container = document.getElementById('section-charts');
  if (!container) return;

  const els = container.querySelectorAll('[data-chart-tip]');
  els.forEach(el => {
    if (el._chartTipBound) return;
    el._chartTipBound = true;

    el.addEventListener('mouseenter', function (e) {
      _showChartTip(this.getAttribute('data-chart-tip'), e.clientX, e.clientY);
    });
    el.addEventListener('mousemove', function (e) {
      _positionChartTip(e.clientX, e.clientY);
    });
    el.addEventListener('mouseleave', function () {
      _hideChartTip();
    });
  });
}

let _chartTipEl = null;

function _getChartTipEl() {
  if (_chartTipEl) return _chartTipEl;
  _chartTipEl = document.createElement('div');
  _chartTipEl.className = 'chart-tip-popup';
  Object.assign(_chartTipEl.style, {
    position: 'fixed',
    zIndex: '10000',
    maxWidth: '280px',
    padding: '8px 12px',
    background: DESIGN_TOKENS.bgElevated,
    border: '1px solid ' + DESIGN_TOKENS.borderStrong,
    borderRadius: '6px',
    color: DESIGN_TOKENS.textSecondary,
    fontSize: '11px',
    lineHeight: '1.5',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    pointerEvents: 'none',
    opacity: '0',
    transform: 'translateY(4px)',
    transition: 'opacity 150ms ease, transform 150ms ease',
    display: 'none',
  });
  document.body.appendChild(_chartTipEl);
  return _chartTipEl;
}

function _showChartTip(text, x, y) {
  const el = _getChartTipEl();
  el.textContent = text;
  el.style.display = 'block';
  _positionChartTip(x, y);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
}

function _positionChartTip(x, y) {
  if (!_chartTipEl) return;
  const gap = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = _chartTipEl.offsetWidth || 280;
  const h = _chartTipEl.offsetHeight || 40;

  let left = x + gap;
  let top = y - h / 2;
  if (left + w > vw - 8) left = x - w - gap;
  top = Math.max(8, Math.min(top, vh - h - 8));

  _chartTipEl.style.left = left + 'px';
  _chartTipEl.style.top = top + 'px';
}

function _hideChartTip() {
  if (!_chartTipEl) return;
  _chartTipEl.style.opacity = '0';
  _chartTipEl.style.transform = 'translateY(4px)';
  setTimeout(() => {
    if (_chartTipEl && _chartTipEl.style.opacity === '0') {
      _chartTipEl.style.display = 'none';
    }
  }, 160);
}
