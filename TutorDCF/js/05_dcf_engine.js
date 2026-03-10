/* ============================================================
   TASK 05 — DCF Engine Core Logic
   Implements calculateDCF(inputs, historicalData) with:
   - Mid-year discounting convention
   - Terminal value (Gordon Growth Model)
   - IRR solver (bisection method)
   - Default assumptions from 3-year historical averages
   - Validation: WACC > terminal growth rate
   - Advanced year-by-year assumptions (dcf.state.assumptionsByYear)
   Stores results in state.dcf.
   NO charts. NO sensitivity tables. NO UI rendering.
============================================================ */

// ======================================================================
// ADVANCED ASSUMPTIONS STATE
// dcf.state.advancedAssumptionsEnabled: boolean — when true, use per-year
// dcf.state.assumptionsByYear: { "2026E": { revenueGrowth, ebitdaMargin,
//   taxRate, capexPctRevenue, nwcPctRevenue }, ... }
// Canonical keys in assumptionsByYear map to engine keys:
//   revenueGrowth   -> revenueGrowth
//   ebitdaMargin    -> ebitMargin
//   taxRate         -> taxRate
//   capexPctRevenue -> capexPct
//   nwcPctRevenue   -> nwcPct
// ======================================================================

/** Mapping from canonical assumptionsByYear keys to engine input keys. */
const ADVANCED_KEY_MAP = {
  revenueGrowth:   'revenueGrowth',
  ebitdaMargin:    'ebitMargin',
  taxRate:         'taxRate',
  capexPctRevenue: 'capexPct',
  nwcPctRevenue:   'nwcPct',
};

/** Reverse mapping: engine key -> canonical key */
const ADVANCED_KEY_MAP_REV = {};
for (const [canon, engine] of Object.entries(ADVANCED_KEY_MAP)) {
  ADVANCED_KEY_MAP_REV[engine] = canon;
}

/**
 * Get the forecast year labels array from current state.
 * Uses the same base-year logic as calculateDCF.
 * Returns strings like ["2026E", "2027E", ...].
 */
function getForecastYears() {
  const hist = state.historical;
  if (!hist || !hist.years || hist.years.length === 0) return [];
  const last = hist.years[hist.years.length - 1];
  const match = String(last).match(/\d{4}/);
  const baseYear = match ? parseInt(match[0]) : new Date().getFullYear();
  const n = state.inputs.forecastYears || 5;
  return Array.from({ length: n }, (_, i) => `${baseYear + i + 1}E`);
}

/**
 * Ensure assumptionsByYear is initialized for all forecast years,
 * auto-filling missing values from basic assumptions.
 */
function ensureAssumptionsByYearInitializedFromBasic() {
  if (!state.advancedAssumptionsEnabled && !state._advancedSectionOpen) return;
  if (!state.assumptionsByYear) state.assumptionsByYear = {};

  const years = getForecastYears();
  const inp = state.inputs;

  for (const yr of years) {
    if (!state.assumptionsByYear[yr]) {
      state.assumptionsByYear[yr] = {};
    }
    const yObj = state.assumptionsByYear[yr];
    // Fill each canonical key from the basic assumption if missing
    if (yObj.revenueGrowth   == null) yObj.revenueGrowth   = inp.revenueGrowth   ?? 0.05;
    if (yObj.ebitdaMargin    == null) yObj.ebitdaMargin     = inp.ebitMargin       ?? 0.12;
    if (yObj.taxRate         == null) yObj.taxRate           = inp.taxRate          ?? 0.25;
    if (yObj.capexPctRevenue == null) yObj.capexPctRevenue   = inp.capexPct         ?? 0.05;
    if (yObj.nwcPctRevenue   == null) yObj.nwcPctRevenue     = inp.nwcPct           ?? 0.02;
  }

  // Remove years that no longer exist in the forecast horizon
  const yearSet = new Set(years);
  for (const k of Object.keys(state.assumptionsByYear)) {
    if (!yearSet.has(k)) delete state.assumptionsByYear[k];
  }
}

/**
 * Validate assumptionsByYear for the given segment.
 * Returns { isValid: bool, errors: string[], warnings: string[], cellMap: {} }.
 * cellMap[yearLabel][canonicalKey] = { status: 'ok'|'warning'|'error', message: string }
 */
function validateAssumptionsByYear(segment) {
  const years = getForecastYears();
  const aby = state.assumptionsByYear || {};
  const errors = [];
  const warnings = [];
  const cellMap = {};

  // Import range config (defined in assumption_benchmarks.js)
  const ranges = (typeof window !== 'undefined' && window.ADVANCED_SEGMENT_RANGES)
    ? window.ADVANCED_SEGMENT_RANGES : null;
  const segRanges = ranges ? (ranges[segment] || ranges['general'] || {}) : {};

  for (const yr of years) {
    cellMap[yr] = {};
    const yObj = aby[yr];

    for (const canonKey of Object.keys(ADVANCED_KEY_MAP)) {
      if (!yObj || yObj[canonKey] == null || !isFinite(yObj[canonKey])) {
        cellMap[yr][canonKey] = { status: 'error', message: 'Missing or invalid' };
        errors.push(`${_advancedKeyLabel(canonKey)} missing for ${yr}`);
        continue;
      }

      const val = yObj[canonKey];
      const range = segRanges[canonKey];
      if (range) {
        if (val < range.errorMin || val > range.errorMax) {
          cellMap[yr][canonKey] = { status: 'error', message: `Out of valid range (${_fmtRangePct(range.errorMin)}–${_fmtRangePct(range.errorMax)})` };
          errors.push(`${_advancedKeyLabel(canonKey)} out of range for ${segment} in ${yr}`);
        } else if (val < range.warnMin || val > range.warnMax) {
          cellMap[yr][canonKey] = { status: 'warning', message: `Unusual for ${segment} (typical: ${_fmtRangePct(range.warnMin)}–${_fmtRangePct(range.warnMax)})` };
          warnings.push(`${_advancedKeyLabel(canonKey)} unusual for ${segment} in ${yr}`);
        } else {
          cellMap[yr][canonKey] = { status: 'ok', message: '' };
        }
      } else {
        cellMap[yr][canonKey] = { status: 'ok', message: '' };
      }
    }
  }

  return { isValid: errors.length === 0, errors, warnings, cellMap };
}

/** Human-readable labels for canonical advanced keys. */
function _advancedKeyLabel(canonKey) {
  const labels = {
    revenueGrowth:   'Revenue Growth',
    ebitdaMargin:    'EBITDA Margin',
    taxRate:         'Tax Rate',
    capexPctRevenue: 'CapEx % Rev',
    nwcPctRevenue:   'NWC % Rev',
  };
  return labels[canonKey] || canonKey;
}

function _fmtRangePct(v) {
  return (v * 100).toFixed(1) + '%';
}

// --- 3-year trailing average of a series (ignores nulls) ---
function trailingAvg(series, years = 3) {
  if (!series) return null;
  const valid = series.slice(-years).filter(v => v !== null && isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

// --- Last non-null value in a series ---
function lastValue(series) {
  if (!series) return null;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] !== null && isFinite(series[i])) return series[i];
  }
  return null;
}

// --- Build default inputs from historical data ---
// Called once after normalizeData + computeDerivedMetrics.
// Only sets keys that aren't already in state.inputs.
function buildDefaultInputs(historicalData) {
  if (!historicalData) return;
  const m = historicalData.metrics  || {};
  const d = historicalData.derived  || {};

  // D&A % of revenue from historical data (per Capital IQ spec)
  const daPctDefault = (() => {
    if (m.depreciation && m.revenue) {
      const daAvg  = trailingAvg(m.depreciation);
      const revAvg = trailingAvg(m.revenue);
      if (daAvg != null && revAvg != null && revAvg !== 0) {
        return Math.abs(daAvg / revAvg);
      }
    }
    return 0.04; // fallback
  })();

  // NWC % of revenue from historical data (per Capital IQ spec)
  const nwcPctDefault = (() => {
    // Try direct changeInNWC metric first
    if (m.changeInNWC && m.revenue) {
      const nwcAvg = trailingAvg(m.changeInNWC);
      const revAvg = trailingAvg(m.revenue);
      if (nwcAvg != null && revAvg != null && revAvg !== 0) {
        return Math.abs(nwcAvg / revAvg);
      }
    }
    // Derive from current assets - current liabilities if available
    if (m.currentAssets && m.currentLiabilities && m.revenue) {
      const caLast = lastValue(m.currentAssets);
      const clLast = lastValue(m.currentLiabilities);
      const revLast = lastValue(m.revenue);
      if (caLast != null && clLast != null && revLast != null && revLast !== 0) {
        return Math.abs((caLast - clLast) / revLast) * 0.1; // use 10% of NWC/Rev as change proxy
      }
    }
    return 0.02; // fallback
  })();

  // Exit multiple suggestion from Multiples or Key Stats sheet
  const exitMultipleDefault = (() => {
    if (m.evToEbitda) {
      const val = lastValue(m.evToEbitda);
      if (val != null && val > 0 && val < 100) {
        console.log('[DCF] Suggested exit multiple from Multiples tab: EV/EBITDA =', val.toFixed(1));
        return val;
      }
    }
    return 10.0; // fallback per spec
  })();

  const defaults = {
    forecastYears:    5,
    revenueGrowth:    trailingAvg(d.revenueGrowth)  ?? 0.05,
    ebitMargin:       trailingAvg(d.ebitMargin)      ?? 0.12,
    taxRate:          0.25,
    capexPct:         safeDivide(trailingAvg(m.capex), trailingAvg(m.revenue)) != null
                        ? Math.abs(trailingAvg(m.capex) / trailingAvg(m.revenue))
                        : 0.05,
    // D&A as % of revenue (per Capital IQ DCF spec)
    daPct:            daPctDefault,
    // Working capital change as % of revenue (per Capital IQ DCF spec)
    nwcPct:           nwcPctDefault,
    // Exit multiple (EV/EBITDA, suggested from Multiples tab)
    exitMultiple:     exitMultipleDefault,
    // WACC components
    costOfEquity:     0.10,
    costOfDebt:       0.05,
    debtWeight:       0.30,
    equityWeight:     0.70,
    // Derived WACC (overridable)
    wacc:             null,   // computed below if null
    terminalGrowth:   0.025,
    // Current share price (for upside calc)
    currentPrice:     null,
    sharesOutstanding: lastValue(m.sharesOutstanding) ?? null,
    // Balance sheet items for bridge (per Capital IQ spec)
    netDebt:          lastValue(d.netDebt)   ?? 0,
    minorityInterest: lastValue(m.minorityInterest) ?? 0,
    preferredEquity:  lastValue(m.preferredEquity) ?? 0,
  };

  // Compute WACC from components if not set
  defaults.wacc = defaults.costOfEquity * defaults.equityWeight
                + defaults.costOfDebt   * defaults.debtWeight * (1 - defaults.taxRate);

  // Merge: only fill keys missing from state.inputs
  for (const [key, val] of Object.entries(defaults)) {
    if (state.inputs[key] === undefined || state.inputs[key] === null) {
      state.inputs[key] = val;
    }
  }

  console.log('[DCF] Default inputs built:', state.inputs);
}

// --- NPV of a cash flow array ---
// cashFlows[i] discounted at period (i+0.5) — mid-year convention
function npvMidYear(cashFlows, discountRate) {
  return cashFlows.reduce((sum, cf, i) => {
    if (cf === null || !isFinite(cf)) return sum;
    return sum + cf / Math.pow(1 + discountRate, i + 0.5);
  }, 0);
}

// --- IRR solver via bisection ---
// cashFlows[0] is typically the negative initial investment (equity value)
function solveIRR(cashFlows, maxIter = 200, tol = 1e-7) {
  // Simple NPV function (period 0 = now, period i+1 for subsequent)
  const npv = rate => cashFlows.reduce((sum, cf, i) =>
    sum + cf / Math.pow(1 + rate, i), 0
  );

  let lo = -0.999, hi = 10.0;

  // Verify sign change exists
  if (npv(lo) * npv(hi) > 0) return null;

  let mid;
  for (let i = 0; i < maxIter; i++) {
    mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < tol) break;
    if (npv(lo) * fMid < 0) hi = mid;
    else lo = mid;
  }
  return mid;
}

// --- Pure DCF calculation (no state mutation, no DOM) ---
// Used by attribution engine for "what-if" reruns.
// Returns { valid, enterpriseValue, impliedPrice, irr, pvTerminal, terminalValue, npvFCF } or { valid: false }.
// Does NOT use advanced assumptions — always uses flat-rate inputs.
function calculateDCFPure(inputs, historicalData) {
  if (!historicalData || !historicalData.metrics) return { valid: false };
  if (inputs.wacc <= inputs.terminalGrowth) return { valid: false };

  const m = historicalData.metrics;
  const n = inputs.forecastYears;
  const wacc = inputs.wacc;
  const g = inputs.terminalGrowth;
  const baseRevenue = lastValue(m.revenue);
  if (!baseRevenue) return { valid: false };

  const forecastFCF = [];
  let prevRevenue = baseRevenue;
  for (let i = 0; i < n; i++) {
    const rev = prevRevenue * (1 + inputs.revenueGrowth);
    const ebit = rev * inputs.ebitMargin;
    const nopat = ebit * (1 - inputs.taxRate);
    const capex = rev * inputs.capexPct;
    const da = inputs.daPct != null ? rev * inputs.daPct : capex * 0.8;
    const nwcDelta = (rev - prevRevenue) * inputs.nwcPct;
    const fcf = nopat + da - capex - nwcDelta;
    forecastFCF.push(fcf);
    prevRevenue = rev;
  }

  const terminalFCF = forecastFCF[n - 1] * (1 + g);
  const terminalValue = terminalFCF / (wacc - g);
  const pvFCFs = forecastFCF.map((fcf, i) => fcf / Math.pow(1 + wacc, i + 0.5));
  const npvFCF = pvFCFs.reduce((s, v) => s + v, 0);
  const pvTerminal = terminalValue / Math.pow(1 + wacc, n);
  const enterpriseValue = npvFCF + pvTerminal;
  // Equity Value = EV - Net Debt - Preferred Equity - Minority Interest
  // Note: Net Debt already = Total Debt - Cash, so cash is NOT added back separately.
  const equityValue = enterpriseValue - inputs.netDebt - (inputs.preferredEquity || 0) - inputs.minorityInterest;
  const impliedPrice = inputs.sharesOutstanding && inputs.sharesOutstanding > 0
    ? (equityValue * getUnitScale()) / inputs.sharesOutstanding : null;

  const irrCashFlows = [-equityValue, ...forecastFCF];
  irrCashFlows[irrCashFlows.length - 1] += terminalValue;
  const irr = solveIRR(irrCashFlows);

  return {
    valid: true,
    enterpriseValue,
    equityValue,
    impliedPrice,
    irr,
    pvTerminal,
    terminalValue,
    npvFCF,
  };
}

// --- Main DCF calculation ---
// inputs: from state.inputs (populated by buildDefaultInputs + user edits)
// historicalData: state.historical
// Returns result object; also stores in state.dcf.
// When state.advancedAssumptionsEnabled is true, uses per-year assumptions
// from state.assumptionsByYear instead of flat rates.
function calculateDCF(inputs, historicalData) {
  // --- Validate ---
  const errors = [];
  if (!historicalData || !historicalData.metrics) {
    errors.push('Historical data not loaded.');
  }
  if (inputs.wacc <= inputs.terminalGrowth) {
    errors.push(`WACC (${(inputs.wacc * 100).toFixed(1)}%) must exceed terminal growth rate (${(inputs.terminalGrowth * 100).toFixed(1)}%).`);
  }

  // --- Advanced mode validation: block if enabled and invalid ---
  const advancedEnabled = !!state.advancedAssumptionsEnabled;
  if (advancedEnabled) {
    const segment = (state.context && state.context.sector)
      ? (/tech/i.test(state.context.sector) ? 'tech' : 'general')
      : 'general';
    const validation = validateAssumptionsByYear(segment);
    // Store validation result for UI consumption
    state.advancedValidation = validation;
    if (!validation.isValid) {
      state.dcf = {
        errors: ['Advanced assumptions have errors: ' + validation.errors.slice(0, 3).join('; ')],
        valid: false,
        advancedBlocked: true,
      };
      console.warn('[DCF] calculateDCF blocked by advanced validation:', validation.errors);
      return state.dcf;
    }
  } else {
    // Clear validation state when not in advanced mode
    state.advancedValidation = null;
  }

  if (errors.length) {
    state.dcf = { errors, valid: false };
    console.warn('[DCF] calculateDCF validation failed:', errors);
    return state.dcf;
  }

  const m = historicalData.metrics;
  const n = inputs.forecastYears;
  const wacc = inputs.wacc;
  const g    = inputs.terminalGrowth;

  // --- Base year revenue ---
  const baseRevenue = lastValue(m.revenue);
  if (!baseRevenue) {
    state.dcf = { errors: ['No base revenue found.'], valid: false };
    return state.dcf;
  }

  // --- Resolve per-year assumptions ---
  // If advanced mode: read from assumptionsByYear for each year.
  // If basic mode: use flat inputs across all years.
  const forecastLabels = getForecastYears();
  const aby = state.assumptionsByYear || {};

  function getYearAssumption(yearIdx, canonicalKey, engineKey) {
    if (advancedEnabled) {
      const yr = forecastLabels[yearIdx];
      const yObj = aby[yr];
      if (yObj && yObj[canonicalKey] != null) return yObj[canonicalKey];
    }
    return inputs[engineKey];
  }

  // --- Project forecast years ---
  const forecastRevenue  = [];
  const forecastEBIT     = [];
  const forecastNOPAT    = [];
  const forecastCapex    = [];
  const forecastNWCDelta = [];
  const forecastDA       = [];
  const forecastFCF      = [];

  let prevRevenue = baseRevenue;

  for (let i = 0; i < n; i++) {
    const revGrowth  = getYearAssumption(i, 'revenueGrowth',   'revenueGrowth');
    const margin     = getYearAssumption(i, 'ebitdaMargin',    'ebitMargin');
    const tax        = getYearAssumption(i, 'taxRate',         'taxRate');
    const capexRate  = getYearAssumption(i, 'capexPctRevenue', 'capexPct');
    const nwcRate    = getYearAssumption(i, 'nwcPctRevenue',   'nwcPct');

    const rev    = prevRevenue * (1 + revGrowth);
    const ebit   = rev * margin;
    const nopat  = ebit * (1 - tax);
    const capex  = rev * capexRate;
    // D&A as % of revenue (per Capital IQ spec; falls back to capex * 0.8)
    const da     = inputs.daPct != null ? rev * inputs.daPct : capex * 0.8;
    // NWC change = nwcPct * change in revenue (per Capital IQ spec)
    const nwcDelta = (rev - prevRevenue) * nwcRate;
    const fcf    = nopat + da - capex - nwcDelta;

    forecastRevenue.push(rev);
    forecastEBIT.push(ebit);
    forecastNOPAT.push(nopat);
    forecastCapex.push(capex);
    forecastDA.push(da);
    forecastNWCDelta.push(nwcDelta);
    forecastFCF.push(fcf);

    prevRevenue = rev;
  }

  // --- Terminal value (Gordon Growth Model on final FCF) ---
  const terminalFCF   = forecastFCF[n - 1] * (1 + g);
  const terminalValue = terminalFCF / (wacc - g);

  // --- Discount FCFs (mid-year convention) ---
  const pvFCFs = forecastFCF.map((fcf, i) =>
    fcf / Math.pow(1 + wacc, i + 0.5)
  );
  const npvFCF = pvFCFs.reduce((s, v) => s + v, 0);

  // --- Discount terminal value (end of forecast period) ---
  const pvTerminal = terminalValue / Math.pow(1 + wacc, n);

  // --- Enterprise value ---
  const enterpriseValue = npvFCF + pvTerminal;

  // --- Equity bridge (per Capital IQ spec) ---
  // Equity Value = EV - Net Debt - Preferred Equity - Minority Interest
  // Note: Net Debt already = Total Debt - Cash, so cash is NOT added back separately.
  const equityValue = enterpriseValue
    - inputs.netDebt
    - (inputs.preferredEquity || 0)
    - inputs.minorityInterest;

  // --- Implied share price ---
  // equityValue is in data units (e.g. $K, $M, $B per source file);
  // sharesOutstanding is in actual shares — multiply by unit scale to convert.
  const impliedPrice = inputs.sharesOutstanding && inputs.sharesOutstanding > 0
    ? (equityValue * getUnitScale()) / inputs.sharesOutstanding
    : null;

  // --- Upside / downside vs current price ---
  const upside = inputs.currentPrice && impliedPrice
    ? (impliedPrice - inputs.currentPrice) / inputs.currentPrice
    : null;

  // --- IRR (Year 0 = -equity value, Years 1..n = FCFs, Year n += terminal value) ---
  const irrCashFlows = [-equityValue, ...forecastFCF];
  irrCashFlows[irrCashFlows.length - 1] += terminalValue;
  const irr = solveIRR(irrCashFlows);

  // --- Build label array for forecast years ---
  const baseYear = historicalData.years.length > 0
    ? (() => {
        const last = historicalData.years[historicalData.years.length - 1];
        const match = String(last).match(/\d{4}/);
        return match ? parseInt(match[0]) : new Date().getFullYear();
      })()
    : new Date().getFullYear();

  const forecastYearLabels = Array.from({ length: n }, (_, i) => `${baseYear + i + 1}E`);

  // --- Build historical data for table display ---
  // histYears and metric arrays are aligned 1:1 by index (both length = yearCount).
  // The last element is the base year. We display all prior years that have data.
  const histYears   = historicalData.years || [];
  const histMetrics = historicalData.metrics || {};
  const histDerived = historicalData.derived || {};

  // All years except the last (base year), with their corresponding metric values
  const historicalYearLabels = histYears.slice(0, -1).map(y => String(y));

  function sliceHistorical(series) {
    if (!series) return [];
    return series.slice(0, histYears.length - 1);
  }

  const historicalForTable = {
    revenue:       sliceHistorical(histMetrics.revenue),
    ebit:          sliceHistorical(histMetrics.ebit),
    fcf:           sliceHistorical(histDerived.fcf),
    ebitMargin:    sliceHistorical(histDerived.ebitMargin),
    // Additional historical series for full DCF table population
    depreciation:  sliceHistorical(histMetrics.depreciation),
    capex:         sliceHistorical(histMetrics.capex),
    nwcDelta:      sliceHistorical(histMetrics.changeInNWC),
    incomeTax:     sliceHistorical(histMetrics.incomeTax),
    ebitda:        sliceHistorical(histMetrics.ebitda),
  };

  console.log('[DCF] Historical for table:', historicalYearLabels.length, 'years,',
    'revenue sample:', historicalForTable.revenue.slice(0, 3), '...',
    historicalForTable.revenue.slice(-2));

  // --- Store result ---
  state.dcf = {
    valid: true,
    errors: [],
    inputs: { ...inputs },
    baseYear,
    forecastYearLabels,
    historicalYearLabels,
    historical: historicalForTable,
    forecast: {
      revenue:    forecastRevenue,
      ebit:       forecastEBIT,
      nopat:      forecastNOPAT,
      capex:      forecastCapex,
      da:         forecastDA,
      nwcDelta:   forecastNWCDelta,
      fcf:        forecastFCF,
      pvFCF:      pvFCFs,
    },
    summary: {
      npvFCF,
      pvTerminal,
      terminalValue,
      enterpriseValue,
      netDebt:           inputs.netDebt,
      minorityInterest:  inputs.minorityInterest,
      equityValue,
      impliedPrice,
      currentPrice:      inputs.currentPrice,
      upside,
      irr,
      wacc,
      terminalGrowth:    g,
    },
  };

  console.log('[DCF] calculateDCF result:', {
    enterpriseValue: enterpriseValue.toFixed(1),
    equityValue:     equityValue.toFixed(1),
    impliedPrice:    impliedPrice?.toFixed(2) ?? 'n/a',
    upside:          upside != null ? (upside * 100).toFixed(1) + '%' : 'n/a',
    irr:             irr != null ? (irr * 100).toFixed(1) + '%' : 'n/a',
    npvFCF:          npvFCF.toFixed(1),
    pvTerminal:      pvTerminal.toFixed(1),
    terminalValue:   terminalValue.toFixed(1),
  });

  // --- Compute Key Metrics by year ---
  computeKeyMetrics();

  return state.dcf;
}

// ============================================================
// KEY METRICS COMPUTATION
// Computes per-year return ratios, margins, and multiples.
// Stores in state.dcf.keyMetrics[yearLabel] = { metricKey: value }
// and state.dcf.keyMetricsTrace[yearLabel][metricKey] = traceObj
// ============================================================

function computeKeyMetrics() {
  if (!state.dcf || !state.dcf.valid) return;

  const d = state.dcf;
  const f = d.forecast;
  const s = d.summary;
  const inp = d.inputs;
  const histM = state.historical?.metrics || {};
  const histD = state.historical?.derived || {};
  const histLabels = d.historicalYearLabels || [];
  const forecastLabels = d.forecastYearLabels || [];
  const baseLabel = String(d.baseYear);
  const h = d.historical || {};

  // Constant EV for multiples (current implied EV from valuation)
  const currentEV = s.enterpriseValue;

  // All year columns matching the DCF table (historical + base + forecast)
  // Terminal column excluded for key metrics (ratios don't apply)
  const allYears = [...histLabels, baseLabel, ...forecastLabels];

  const keyMetrics = {};
  const keyMetricsTrace = {};

  // Helper: get a metric value for a given year
  function getVal(year, metricKey) {
    const hIdx = histLabels.indexOf(year);

    // Historical year
    if (hIdx >= 0) {
      // Check raw metrics first
      if (histM[metricKey]) return histM[metricKey][hIdx] ?? null;
      // Check derived
      if (histD[metricKey]) return histD[metricKey][hIdx] ?? null;
      // Check historical-for-table
      if (h[metricKey]) return h[metricKey][hIdx] ?? null;
      return null;
    }

    // Base year (last historical value)
    if (year === baseLabel) {
      if (histM[metricKey]) return lastValue(histM[metricKey]);
      if (histD[metricKey]) return lastValue(histD[metricKey]);
      return null;
    }

    // Forecast year
    const fIdx = forecastLabels.indexOf(year);
    if (fIdx >= 0) {
      // Map metric keys to forecast arrays
      const forecastMap = {
        revenue: f.revenue, ebit: f.ebit, nopat: f.nopat,
        capex: f.capex, da: f.da, nwcDelta: f.nwcDelta, fcf: f.fcf,
      };
      if (forecastMap[metricKey]) return forecastMap[metricKey][fIdx] ?? null;
      return null;
    }

    return null;
  }

  // Per-year advanced assumption resolver
  const advancedEnabled = !!state.advancedAssumptionsEnabled;
  const aby = state.assumptionsByYear || {};
  function getTaxRate(year) {
    if (advancedEnabled) {
      const yObj = aby[year];
      if (yObj && yObj.taxRate != null) return yObj.taxRate;
    }
    return inp.taxRate ?? 0.25;
  }

  for (const year of allYears) {
    const m = {};
    const t = {};

    // --- Fetch base values ---
    const revenue = getVal(year, 'revenue');
    const ebit = getVal(year, 'ebit');
    const netIncome = getVal(year, 'netIncome');
    const totalAssets = getVal(year, 'totalAssets');
    const totalEquity = getVal(year, 'totalEquity');
    const totalDebt = getVal(year, 'totalDebt');
    const cash = getVal(year, 'cash');
    const interestExp = getVal(year, 'interestExpense');
    const currentAssets = getVal(year, 'currentAssets');
    const currentLiabilities = getVal(year, 'currentLiabilities');

    // EBITDA: use reported for historical, projected for forecast
    const fIdx = forecastLabels.indexOf(year);
    let ebitda;
    if (fIdx >= 0) {
      // Projected EBITDA = EBIT + D&A
      const da = f.da[fIdx];
      ebitda = (ebit != null && da != null) ? ebit + da : null;
    } else {
      // Historical/base: use reported EBITDA
      ebitda = getVal(year, 'ebitda');
      // Fallback: compute from EBIT + D&A if no reported EBITDA
      if (ebitda == null) {
        const da = getVal(year, 'depreciation');
        ebitda = (ebit != null && da != null) ? ebit + Math.abs(da) : null;
      }
    }

    // NOPAT: reuse forecast nopat for projected years, derive for historical
    let nopat;
    if (fIdx >= 0) {
      nopat = f.nopat[fIdx];
    } else {
      const taxRate = getTaxRate(year);
      nopat = ebit != null ? ebit * (1 - taxRate) : null;
    }

    // Invested Capital (Method A): NWC + Net PP&E + Other Op Assets - Other Op Liab
    // Simplified: use NWC approximation (CA - CL) + (Total Assets - Current Assets - Goodwill/Intangibles)
    // Per spec: NWC + Net PP&E, exclude goodwill. Since we don't have netPPE separately,
    // use: Invested Capital = Total Assets - Current Liabilities - Cash (approximation excluding excess cash)
    // Better: Equity + Debt - Cash (matches existing ROIC denominator in derived metrics)
    let investedCapital = null;
    if (totalEquity != null && totalDebt != null && cash != null) {
      investedCapital = totalEquity + totalDebt - cash;
    }

    // Net Debt
    const netDebt = (totalDebt != null && cash != null) ? totalDebt - cash : null;

    // --- Compute ratios ---
    const taxRate = getTaxRate(year);

    // ROI = NOPAT / Invested Capital (same as ROIC per spec)
    m.roi = safeDivideKM(nopat, investedCapital);
    t.roi = makeTrace('ROI', 'ROI = NOPAT / Invested Capital', nopat, investedCapital,
      'NOPAT', 'Invested Capital', 'dcf.nopat', 'derived.invested_capital', year);

    // ROIC = NOPAT / Invested Capital
    m.roic = safeDivideKM(nopat, investedCapital);
    t.roic = makeTrace('ROIC', 'ROIC = NOPAT / Invested Capital', nopat, investedCapital,
      'NOPAT', 'Invested Capital', 'dcf.nopat', 'derived.invested_capital', year);

    // ROE = Net Income / Total Equity
    m.roe = safeDivideKM(netIncome, totalEquity);
    t.roe = makeTrace('ROE', 'ROE = Net Income / Total Equity', netIncome, totalEquity,
      'Net Income', 'Total Equity', 'income.net_income', 'balance.total_equity', year);

    // ROA = Net Income / Total Assets
    m.roa = safeDivideKM(netIncome, totalAssets);
    t.roa = makeTrace('ROA', 'ROA = Net Income / Total Assets', netIncome, totalAssets,
      'Net Income', 'Total Assets', 'income.net_income', 'balance.total_assets', year);

    // EBITDA Margin = EBITDA / Revenue
    m.ebitda_margin = safeDivideKM(ebitda, revenue);
    t.ebitda_margin = makeTrace('EBITDA Margin', 'EBITDA Margin = EBITDA / Revenue', ebitda, revenue,
      'EBITDA', 'Revenue', 'income.ebitda', 'income.revenue', year);

    // EBIT Margin = EBIT / Revenue
    m.ebit_margin = safeDivideKM(ebit, revenue);
    t.ebit_margin = makeTrace('EBIT Margin', 'EBIT Margin = EBIT / Revenue', ebit, revenue,
      'EBIT', 'Revenue', 'income.ebit', 'income.revenue', year);

    // Net Margin = Net Income / Revenue
    m.net_margin = safeDivideKM(netIncome, revenue);
    t.net_margin = makeTrace('Net Margin', 'Net Margin = Net Income / Revenue', netIncome, revenue,
      'Net Income', 'Revenue', 'income.net_income', 'income.revenue', year);

    // EV / Revenue
    m.ev_revenue = safeDivideKM(currentEV, revenue);
    t.ev_revenue = makeTrace('EV / Revenue', 'EV / Revenue = Enterprise Value / Revenue', currentEV, revenue,
      'Enterprise Value (Current)', 'Revenue', 'valuation.enterprise_value_current', 'income.revenue', year);

    // EV / EBITDA
    m.ev_ebitda = safeDivideKM(currentEV, ebitda);
    t.ev_ebitda = makeTrace('EV / EBITDA', 'EV / EBITDA = Enterprise Value / EBITDA', currentEV, ebitda,
      'Enterprise Value (Current)', 'EBITDA', 'valuation.enterprise_value_current', 'income.ebitda', year);

    // EV / EBIT
    m.ev_ebit = safeDivideKM(currentEV, ebit);
    t.ev_ebit = makeTrace('EV / EBIT', 'EV / EBIT = Enterprise Value / EBIT', currentEV, ebit,
      'Enterprise Value (Current)', 'EBIT', 'valuation.enterprise_value_current', 'income.ebit', year);

    // Net Debt / EBITDA
    m.net_debt_ebitda = safeDivideKM(netDebt, ebitda);
    t.net_debt_ebitda = makeTrace('Net Debt / EBITDA', 'Net Debt / EBITDA = Net Debt / EBITDA', netDebt, ebitda,
      'Net Debt', 'EBITDA', 'derived.net_debt', 'income.ebitda', year);

    // Interest Coverage = EBIT / Interest Expense
    const intExpAbs = interestExp != null ? Math.abs(interestExp) : null;
    m.interest_coverage = (intExpAbs != null && intExpAbs > 0) ? safeDivideKM(ebit, intExpAbs) : null;
    t.interest_coverage = (intExpAbs != null && intExpAbs > 0)
      ? makeTrace('Interest Coverage', 'Interest Coverage = EBIT / |Interest Expense|', ebit, intExpAbs,
          'EBIT', 'Interest Expense', 'income.ebit', 'income.interest_expense', year)
      : makeDenomUnavailableTrace('Interest Coverage', year, 'Interest expense unavailable');

    keyMetrics[year] = m;
    keyMetricsTrace[year] = t;
  }

  state.dcf.keyMetrics = keyMetrics;
  state.dcf.keyMetricsTrace = keyMetricsTrace;
}

// Safe divide for key metrics (returns null on 0 or null denominator)
function safeDivideKM(num, denom) {
  if (num == null || denom == null || !isFinite(num) || !isFinite(denom) || denom === 0) return null;
  return num / denom;
}

// Build a trace object for a key metric cell
function makeTrace(label, formula, numerator, denominator, numLabel, denomLabel, numSource, denomSource, year) {
  const result = safeDivideKM(numerator, denominator);
  const numFmt = (numerator != null && isFinite(numerator)) ? numerator : null;
  const denomFmt = (denominator != null && isFinite(denominator)) ? denominator : null;

  if (denomFmt == null || denomFmt === 0) {
    return {
      title: `${label} (${year})`,
      formulaText: formula,
      expandedMathText: 'Denominator unavailable or zero',
      components: [
        { label: numLabel, value: numFmt, statement: numSource, capiqField: '', statePath: numSource },
        { label: denomLabel, value: denomFmt, statement: denomSource, capiqField: '', statePath: denomSource },
      ],
      notes: ['Denominator is unavailable or zero — metric cannot be computed.'],
    };
  }

  return {
    title: `${label} (${year})`,
    formulaText: formula,
    expandedMathText: `${_kmFmt(result)} = ${_kmFmt(numFmt)} / ${_kmFmt(denomFmt)}`,
    components: [
      { label: numLabel, value: numFmt, statement: numSource, capiqField: '', statePath: numSource },
      { label: denomLabel, value: denomFmt, statement: denomSource, capiqField: '', statePath: denomSource },
    ],
    notes: [],
  };
}

function makeDenomUnavailableTrace(label, year, reason) {
  return {
    title: `${label} (${year})`,
    formulaText: `${label} — not computed`,
    expandedMathText: '—',
    components: [],
    notes: [reason || 'Denominator unavailable.'],
  };
}

function _kmFmt(val) {
  if (val === null || val === undefined || !isFinite(val)) return 'N/A';
  if (Math.abs(val) < 2 && val !== 0) return (val * 100).toFixed(1) + '%';
  return val.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
