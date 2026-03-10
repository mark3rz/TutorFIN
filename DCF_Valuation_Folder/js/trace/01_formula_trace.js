/* ============================================================
   Formula Trace Module
   Resolves formula traces for each DCF projection table line item.
   Exposes: buildFormulaTrace({ lineItemKey, year, scenario })
   Returns a structured trace object consumed by the trace bar UI.
============================================================ */

/**
 * Safe getter - returns value at path or null.
 * @param {object} obj
 * @param {string[]} keys
 */
function _traceGet(obj, ...keys) {
  let cur = obj;
  for (const k of keys) {
    if (cur == null) return null;
    cur = cur[k];
  }
  return cur ?? null;
}

/**
 * Format a number for trace display (matches table formatting).
 * @param {number|null} val
 * @param {number} decimals
 * @returns {string}
 */
function _traceFmt(val, decimals = 1) {
  if (val === null || val === undefined || !isFinite(val)) return 'N/A';
  return val.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function _traceFmtPct(val) {
  if (val === null || val === undefined || !isFinite(val)) return 'N/A';
  return (val * 100).toFixed(1) + '%';
}

// ============================================================
// Context builder - gathers all data the resolvers need
// ============================================================

function _buildTraceContext(lineItemKey, year, scenario) {
  const d = state.dcf;
  if (!d || !d.valid) return null;

  const f = d.forecast;
  const s = d.summary;
  const inp = d.inputs;
  const n = inp.forecastYears;
  const hist = d.historical || {};
  const histLabels = d.historicalYearLabels || [];
  const forecastLabels = d.forecastYearLabels || [];
  const baseLabel = String(d.baseYear);

  // Determine column type and index
  let colType = null; // 'historical', 'base', 'forecast', 'terminal'
  let hIdx = -1;
  let fIdx = -1;

  if (year === 'Terminal') {
    colType = 'terminal';
  } else if (year === baseLabel) {
    colType = 'base';
  } else {
    hIdx = histLabels.indexOf(year);
    if (hIdx >= 0) {
      colType = 'historical';
    } else {
      fIdx = forecastLabels.indexOf(year);
      if (fIdx >= 0) {
        colType = 'forecast';
      }
    }
  }

  // Previous forecast year revenue (for delta calculations)
  let prevRevenue = null;
  if (colType === 'forecast' && fIdx >= 0) {
    if (fIdx === 0) {
      // Previous is the base year
      const histMetrics = state.historical?.metrics || {};
      prevRevenue = typeof lastValue === 'function' ? lastValue(histMetrics.revenue) : null;
    } else {
      prevRevenue = f.revenue[fIdx - 1];
    }
  }

  // Per-year assumption resolver (matches engine logic)
  const advancedEnabled = !!state.advancedAssumptionsEnabled;
  const aby = state.assumptionsByYear || {};

  function getAssumption(yearLabel, canonicalKey, engineKey) {
    if (advancedEnabled) {
      const yObj = aby[yearLabel];
      if (yObj && yObj[canonicalKey] != null) return yObj[canonicalKey];
    }
    return inp[engineKey];
  }

  return {
    d, f, s, inp, n,
    hist, histLabels, forecastLabels, baseLabel,
    colType, hIdx, fIdx,
    year, lineItemKey, scenario,
    prevRevenue,
    getAssumption,
    advancedEnabled, aby,
  };
}

// ============================================================
// TRACE REGISTRY - one resolver per line item key
// ============================================================

const TRACE_REGISTRY = {

  // ----------------------------------------------------------
  // Revenue
  // ----------------------------------------------------------
  revenue: (ctx) => {
    const { colType, hIdx, fIdx, hist, f, inp, year, getAssumption, prevRevenue } = ctx;

    if (colType === 'historical') {
      const val = _traceGet(hist, 'revenue', hIdx);
      return _sourcedTrace('Revenue', year, val, 'Income Statement', 'state.historical.metrics.revenue');
    }

    if (colType === 'base') {
      const histMetrics = state.historical?.metrics || {};
      const val = typeof lastValue === 'function' ? lastValue(histMetrics.revenue) : null;
      return _sourcedTrace('Revenue', year, val, 'Income Statement', 'state.historical.metrics.revenue');
    }

    if (colType === 'forecast' && fIdx >= 0) {
      const growth = getAssumption(year, 'revenueGrowth', 'revenueGrowth');
      const rev = f.revenue[fIdx];
      return {
        title: `Revenue (${year})`,
        formulaText: 'Revenue = Prior Revenue x (1 + Revenue Growth)',
        expandedMathText: `${_traceFmt(rev)} = ${_traceFmt(prevRevenue)} x (1 + ${_traceFmtPct(growth)})`,
        components: [
          { label: 'Prior Revenue', value: prevRevenue, statement: 'Engine Derived', capiqField: '', statePath: fIdx === 0 ? 'state.historical.metrics.revenue (last)' : `state.dcf.forecast.revenue[${fIdx - 1}]` },
          { label: 'Revenue Growth', value: growth, statement: 'Assumptions', capiqField: '', statePath: ctx.advancedEnabled ? `state.assumptionsByYear["${year}"].revenueGrowth` : 'state.inputs.revenueGrowth' },
        ],
        notes: [],
      };
    }

    return _noTraceForColumn('Revenue', year, colType);
  },

  // ----------------------------------------------------------
  // EBIT
  // ----------------------------------------------------------
  ebit: (ctx) => {
    const { colType, hIdx, fIdx, hist, f, year, getAssumption } = ctx;

    if (colType === 'historical') {
      const val = _traceGet(hist, 'ebit', hIdx);
      return _sourcedTrace('EBIT', year, val, 'Income Statement', 'state.historical.metrics.ebit');
    }

    if (colType === 'base') {
      const histMetrics = state.historical?.metrics || {};
      const val = typeof lastValue === 'function' ? lastValue(histMetrics.ebit) : null;
      return _sourcedTrace('EBIT', year, val, 'Income Statement', 'state.historical.metrics.ebit');
    }

    if (colType === 'forecast' && fIdx >= 0) {
      const rev = f.revenue[fIdx];
      const margin = getAssumption(year, 'ebitdaMargin', 'ebitMargin');
      const ebit = f.ebit[fIdx];
      return {
        title: `EBIT (${year})`,
        formulaText: 'EBIT = Revenue x EBIT Margin',
        expandedMathText: `${_traceFmt(ebit)} = ${_traceFmt(rev)} x ${_traceFmtPct(margin)}`,
        components: [
          { label: 'Revenue', value: rev, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.revenue[${fIdx}]` },
          { label: 'EBIT Margin', value: margin, statement: 'Assumptions', capiqField: '', statePath: ctx.advancedEnabled ? `state.assumptionsByYear["${year}"].ebitdaMargin` : 'state.inputs.ebitMargin' },
        ],
        notes: [],
      };
    }

    return _noTraceForColumn('EBIT', year, colType);
  },

  // ----------------------------------------------------------
  // EBIT Margin
  // ----------------------------------------------------------
  ebit_margin: (ctx) => {
    const { colType, hIdx, fIdx, hist, f, year, getAssumption } = ctx;

    if (colType === 'historical') {
      const ebit = _traceGet(hist, 'ebit', hIdx);
      const rev = _traceGet(hist, 'revenue', hIdx);
      const margin = (ebit != null && rev != null && rev !== 0) ? ebit / rev : null;
      return {
        title: `EBIT Margin (${year})`,
        formulaText: 'EBIT Margin = EBIT / Revenue',
        expandedMathText: `${_traceFmtPct(margin)} = ${_traceFmt(ebit)} / ${_traceFmt(rev)}`,
        components: [
          { label: 'EBIT', value: ebit, statement: 'Income Statement', capiqField: '', statePath: `state.dcf.historical.ebit[${hIdx}]` },
          { label: 'Revenue', value: rev, statement: 'Income Statement', capiqField: '', statePath: `state.dcf.historical.revenue[${hIdx}]` },
        ],
        notes: [],
      };
    }

    if (colType === 'base') {
      const histMetrics = state.historical?.metrics || {};
      const ebit = typeof lastValue === 'function' ? lastValue(histMetrics.ebit) : null;
      const rev = typeof lastValue === 'function' ? lastValue(histMetrics.revenue) : null;
      const margin = (ebit != null && rev != null && rev !== 0) ? ebit / rev : null;
      return {
        title: `EBIT Margin (${year})`,
        formulaText: 'EBIT Margin = EBIT / Revenue',
        expandedMathText: `${_traceFmtPct(margin)} = ${_traceFmt(ebit)} / ${_traceFmt(rev)}`,
        components: [
          { label: 'EBIT', value: ebit, statement: 'Income Statement', capiqField: '', statePath: 'state.historical.metrics.ebit (last)' },
          { label: 'Revenue', value: rev, statement: 'Income Statement', capiqField: '', statePath: 'state.historical.metrics.revenue (last)' },
        ],
        notes: [],
      };
    }

    if (colType === 'forecast' && fIdx >= 0) {
      const ebit = f.ebit[fIdx];
      const rev = f.revenue[fIdx];
      const margin = (ebit != null && rev != null && rev !== 0) ? ebit / rev : null;
      return {
        title: `EBIT Margin (${year})`,
        formulaText: 'EBIT Margin = EBIT / Revenue (equals assumed EBIT Margin)',
        expandedMathText: `${_traceFmtPct(margin)} = ${_traceFmt(ebit)} / ${_traceFmt(rev)}`,
        components: [
          { label: 'EBIT', value: ebit, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.ebit[${fIdx}]` },
          { label: 'Revenue', value: rev, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.revenue[${fIdx}]` },
        ],
        notes: ['In projected years, EBIT Margin equals the assumed margin since EBIT = Revenue x Margin.'],
      };
    }

    return _noTraceForColumn('EBIT Margin', year, colType);
  },

  // ----------------------------------------------------------
  // Taxes
  // ----------------------------------------------------------
  taxes: (ctx) => {
    const { colType, hIdx, fIdx, hist, f, year, getAssumption } = ctx;

    if (colType === 'historical') {
      const tax = _traceGet(hist, 'incomeTax', hIdx);
      const displayVal = tax != null ? -Math.abs(tax) : null;
      return _sourcedTrace('(-) Taxes', year, displayVal, 'Income Statement', 'state.historical.metrics.incomeTax');
    }

    if (colType === 'base') {
      const histMetrics = state.historical?.metrics || {};
      const tax = typeof lastValue === 'function' ? lastValue(histMetrics.incomeTax) : null;
      const displayVal = tax != null ? -Math.abs(tax) : null;
      return _sourcedTrace('(-) Taxes', year, displayVal, 'Income Statement', 'state.historical.metrics.incomeTax');
    }

    if (colType === 'forecast' && fIdx >= 0) {
      const ebit = f.ebit[fIdx];
      const nopat = f.nopat[fIdx];
      const taxAmount = (ebit !== null && nopat !== null) ? -(ebit - nopat) : null;
      const taxRate = getAssumption(year, 'taxRate', 'taxRate');
      return {
        title: `(-) Taxes (${year})`,
        formulaText: 'Taxes = -(EBIT x Tax Rate)',
        expandedMathText: `${_traceFmt(taxAmount)} = -(${_traceFmt(ebit)} x ${_traceFmtPct(taxRate)})`,
        components: [
          { label: 'EBIT', value: ebit, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.ebit[${fIdx}]` },
          { label: 'Tax Rate', value: taxRate, statement: 'Assumptions', capiqField: '', statePath: ctx.advancedEnabled ? `state.assumptionsByYear["${year}"].taxRate` : 'state.inputs.taxRate' },
        ],
        notes: ['Displayed as negative (cash outflow).'],
      };
    }

    return _noTraceForColumn('(-) Taxes', year, colType);
  },

  // ----------------------------------------------------------
  // NOPAT
  // ----------------------------------------------------------
  nopat: (ctx) => {
    const { colType, hIdx, fIdx, hist, f, year, getAssumption } = ctx;

    if (colType === 'historical') {
      const ebit = _traceGet(hist, 'ebit', hIdx);
      const tax = _traceGet(hist, 'incomeTax', hIdx);
      const nopat = (ebit != null && tax != null) ? ebit - Math.abs(tax) : null;
      return {
        title: `NOPAT (${year})`,
        formulaText: 'NOPAT = EBIT - |Taxes|',
        expandedMathText: `${_traceFmt(nopat)} = ${_traceFmt(ebit)} - ${_traceFmt(tax != null ? Math.abs(tax) : null)}`,
        components: [
          { label: 'EBIT', value: ebit, statement: 'Income Statement', capiqField: '', statePath: `state.dcf.historical.ebit[${hIdx}]` },
          { label: 'Income Tax', value: tax, statement: 'Income Statement', capiqField: '', statePath: `state.dcf.historical.incomeTax[${hIdx}]` },
        ],
        notes: [],
      };
    }

    if (colType === 'base') {
      const histMetrics = state.historical?.metrics || {};
      const ebit = typeof lastValue === 'function' ? lastValue(histMetrics.ebit) : null;
      const tax = typeof lastValue === 'function' ? lastValue(histMetrics.incomeTax) : null;
      const nopat = (ebit != null && tax != null) ? ebit - Math.abs(tax) : null;
      return {
        title: `NOPAT (${year})`,
        formulaText: 'NOPAT = EBIT - |Taxes|',
        expandedMathText: `${_traceFmt(nopat)} = ${_traceFmt(ebit)} - ${_traceFmt(tax != null ? Math.abs(tax) : null)}`,
        components: [
          { label: 'EBIT', value: ebit, statement: 'Income Statement', capiqField: '', statePath: 'state.historical.metrics.ebit (last)' },
          { label: 'Income Tax', value: tax, statement: 'Income Statement', capiqField: '', statePath: 'state.historical.metrics.incomeTax (last)' },
        ],
        notes: [],
      };
    }

    if (colType === 'forecast' && fIdx >= 0) {
      const ebit = f.ebit[fIdx];
      const taxRate = getAssumption(year, 'taxRate', 'taxRate');
      const nopat = f.nopat[fIdx];
      return {
        title: `NOPAT (${year})`,
        formulaText: 'NOPAT = EBIT x (1 - Tax Rate)',
        expandedMathText: `${_traceFmt(nopat)} = ${_traceFmt(ebit)} x (1 - ${_traceFmtPct(taxRate)})`,
        components: [
          { label: 'EBIT', value: ebit, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.ebit[${fIdx}]` },
          { label: 'Tax Rate', value: taxRate, statement: 'Assumptions', capiqField: '', statePath: ctx.advancedEnabled ? `state.assumptionsByYear["${year}"].taxRate` : 'state.inputs.taxRate' },
        ],
        notes: [],
      };
    }

    return _noTraceForColumn('NOPAT', year, colType);
  },

  // ----------------------------------------------------------
  // D&A
  // ----------------------------------------------------------
  da: (ctx) => {
    const { colType, hIdx, fIdx, hist, f, inp, year } = ctx;

    if (colType === 'historical') {
      const val = _traceGet(hist, 'depreciation', hIdx);
      const displayVal = val != null ? Math.abs(val) : null;
      return _sourcedTrace('(+) D&A', year, displayVal, 'Income Statement / Cash Flow', 'state.historical.metrics.depreciation');
    }

    if (colType === 'base') {
      const histMetrics = state.historical?.metrics || {};
      const val = typeof lastValue === 'function' ? lastValue(histMetrics.depreciation) : null;
      const displayVal = val != null ? Math.abs(val) : null;
      return _sourcedTrace('(+) D&A', year, displayVal, 'Income Statement / Cash Flow', 'state.historical.metrics.depreciation');
    }

    if (colType === 'forecast' && fIdx >= 0) {
      const da = f.da[fIdx];
      const rev = f.revenue[fIdx];
      const daPct = inp.daPct;

      if (daPct != null) {
        return {
          title: `(+) D&A (${year})`,
          formulaText: 'D&A = Revenue x D&A % of Revenue',
          expandedMathText: `${_traceFmt(da)} = ${_traceFmt(rev)} x ${_traceFmtPct(daPct)}`,
          components: [
            { label: 'Revenue', value: rev, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.revenue[${fIdx}]` },
            { label: 'D&A % of Revenue', value: daPct, statement: 'Assumptions (derived from historical Depreciation/Amortization avg)', capiqField: '', statePath: 'state.inputs.daPct' },
          ],
          notes: ['Engine projects D&A as a single line using % of Revenue. D&A % is derived from historical Depreciation (state.historical.metrics.depreciation) which may combine Depreciation + Amortization from the source data.'],
        };
      } else {
        const capex = f.capex[fIdx];
        return {
          title: `(+) D&A (${year})`,
          formulaText: 'D&A = CapEx x 0.8 (fallback)',
          expandedMathText: `${_traceFmt(da)} = ${_traceFmt(capex)} x 0.8`,
          components: [
            { label: 'CapEx', value: capex, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.capex[${fIdx}]` },
          ],
          notes: ['daPct not set; using fallback: D&A = 80% of CapEx.'],
        };
      }
    }

    return _noTraceForColumn('(+) D&A', year, colType);
  },

  // ----------------------------------------------------------
  // CapEx
  // ----------------------------------------------------------
  capex: (ctx) => {
    const { colType, hIdx, fIdx, hist, f, year, getAssumption } = ctx;

    if (colType === 'historical') {
      const val = _traceGet(hist, 'capex', hIdx);
      const displayVal = val != null ? -Math.abs(val) : null;
      return _sourcedTrace('(-) CapEx', year, displayVal, 'Cash Flow', 'state.historical.metrics.capex');
    }

    if (colType === 'base') {
      const histMetrics = state.historical?.metrics || {};
      const val = typeof lastValue === 'function' ? lastValue(histMetrics.capex) : null;
      const displayVal = val != null ? -Math.abs(val) : null;
      return _sourcedTrace('(-) CapEx', year, displayVal, 'Cash Flow', 'state.historical.metrics.capex');
    }

    if (colType === 'forecast' && fIdx >= 0) {
      const rev = f.revenue[fIdx];
      const capexRate = getAssumption(year, 'capexPctRevenue', 'capexPct');
      const capex = f.capex[fIdx];
      const displayVal = capex !== null ? -capex : null;
      return {
        title: `(-) CapEx (${year})`,
        formulaText: 'CapEx = Revenue x CapEx % of Revenue (displayed negative)',
        expandedMathText: `${_traceFmt(displayVal)} = -(${_traceFmt(rev)} x ${_traceFmtPct(capexRate)})`,
        components: [
          { label: 'Revenue', value: rev, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.revenue[${fIdx}]` },
          { label: 'CapEx % of Revenue', value: capexRate, statement: 'Assumptions', capiqField: '', statePath: ctx.advancedEnabled ? `state.assumptionsByYear["${year}"].capexPctRevenue` : 'state.inputs.capexPct' },
        ],
        notes: ['Engine stores CapEx as positive; table displays it negative (cash outflow).'],
      };
    }

    return _noTraceForColumn('(-) CapEx', year, colType);
  },

  // ----------------------------------------------------------
  // Delta Working Capital
  // ----------------------------------------------------------
  delta_wc: (ctx) => {
    const { colType, hIdx, fIdx, hist, f, year, getAssumption, prevRevenue } = ctx;

    if (colType === 'historical') {
      const val = _traceGet(hist, 'nwcDelta', hIdx);
      const displayVal = val != null ? -val : null;
      return _sourcedTrace('(-) Delta Working Capital', year, displayVal, 'Balance Sheet / Cash Flow', 'state.historical.metrics.changeInNWC');
    }

    if (colType === 'base') {
      const histMetrics = state.historical?.metrics || {};
      const val = typeof lastValue === 'function' ? lastValue(histMetrics.changeInNWC) : null;
      const displayVal = val != null ? -val : null;
      return _sourcedTrace('(-) Delta Working Capital', year, displayVal, 'Balance Sheet / Cash Flow', 'state.historical.metrics.changeInNWC');
    }

    if (colType === 'forecast' && fIdx >= 0) {
      const rev = f.revenue[fIdx];
      const nwcRate = getAssumption(year, 'nwcPctRevenue', 'nwcPct');
      const nwcDelta = f.nwcDelta[fIdx];
      const deltaRev = prevRevenue != null ? rev - prevRevenue : null;
      const displayVal = nwcDelta !== null ? -nwcDelta : null;
      return {
        title: `(-) Delta Working Capital (${year})`,
        formulaText: 'Delta WC = (Revenue - Prior Revenue) x NWC % of Revenue (displayed negative)',
        expandedMathText: `${_traceFmt(displayVal)} = -(${_traceFmt(deltaRev)} x ${_traceFmtPct(nwcRate)})`,
        components: [
          { label: 'Revenue', value: rev, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.revenue[${fIdx}]` },
          { label: 'Prior Revenue', value: prevRevenue, statement: 'Engine Derived', capiqField: '', statePath: fIdx === 0 ? 'state.historical.metrics.revenue (last)' : `state.dcf.forecast.revenue[${fIdx - 1}]` },
          { label: 'NWC % of Revenue', value: nwcRate, statement: 'Assumptions', capiqField: '', statePath: ctx.advancedEnabled ? `state.assumptionsByYear["${year}"].nwcPctRevenue` : 'state.inputs.nwcPct' },
        ],
        notes: ['Displayed negative: an increase in working capital consumes cash.'],
      };
    }

    return _noTraceForColumn('(-) Delta Working Capital', year, colType);
  },

  // ----------------------------------------------------------
  // Unlevered Free Cash Flow
  // ----------------------------------------------------------
  ufcf: (ctx) => {
    const { colType, hIdx, fIdx, hist, f, year, inp, n } = ctx;

    if (colType === 'historical') {
      const val = _traceGet(hist, 'fcf', hIdx);
      return _sourcedTrace('UFCF', year, val, 'Engine Derived', 'state.dcf.historical.fcf');
    }

    if (colType === 'base') {
      const histDerived = state.historical?.derived || {};
      const val = typeof lastValue === 'function' ? lastValue(histDerived.fcf) : null;
      return _sourcedTrace('UFCF', year, val, 'Engine Derived', 'state.historical.derived.fcf');
    }

    if (colType === 'forecast' && fIdx >= 0) {
      const nopat = f.nopat[fIdx];
      const da = f.da[fIdx];
      const capex = f.capex[fIdx];
      const nwcDelta = f.nwcDelta[fIdx];
      const fcf = f.fcf[fIdx];
      return {
        title: `Unlevered FCF (${year})`,
        formulaText: 'UFCF = NOPAT + D&A - CapEx - Delta WC',
        expandedMathText: `${_traceFmt(fcf)} = ${_traceFmt(nopat)} + ${_traceFmt(da)} - ${_traceFmt(capex)} - ${_traceFmt(nwcDelta)}`,
        components: [
          { label: 'NOPAT', value: nopat, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.nopat[${fIdx}]` },
          { label: 'D&A', value: da, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.da[${fIdx}]` },
          { label: 'CapEx', value: capex, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.capex[${fIdx}]` },
          { label: 'Delta WC', value: nwcDelta, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.nwcDelta[${fIdx}]` },
        ],
        notes: [],
      };
    }

    if (colType === 'terminal') {
      const lastFCF = f.fcf[n - 1];
      const g = inp.terminalGrowth;
      const termFCF = lastFCF * (1 + g);
      return {
        title: 'Terminal FCF',
        formulaText: 'Terminal FCF = Final Year UFCF x (1 + Terminal Growth)',
        expandedMathText: `${_traceFmt(termFCF)} = ${_traceFmt(lastFCF)} x (1 + ${_traceFmtPct(g)})`,
        components: [
          { label: 'Final Year UFCF', value: lastFCF, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.fcf[${n - 1}]` },
          { label: 'Terminal Growth', value: g, statement: 'Assumptions', capiqField: '', statePath: 'state.inputs.terminalGrowth' },
        ],
        notes: [],
      };
    }

    return _noTraceForColumn('UFCF', year, colType);
  },

  // ----------------------------------------------------------
  // Discount Factor
  // ----------------------------------------------------------
  discount_factor: (ctx) => {
    const { colType, fIdx, year, inp, n } = ctx;

    if (colType === 'forecast' && fIdx >= 0) {
      const wacc = inp.wacc;
      const period = fIdx + 0.5;
      const df = 1 / Math.pow(1 + wacc, period);
      return {
        title: `Discount Factor (${year})`,
        formulaText: 'Discount Factor = 1 / (1 + WACC)^(period)',
        expandedMathText: `${_traceFmt(df, 4)} = 1 / (1 + ${_traceFmtPct(wacc)})^${period}`,
        components: [
          { label: 'WACC', value: wacc, statement: 'Assumptions', capiqField: '', statePath: 'state.dcf.inputs.wacc' },
          { label: 'Period (mid-year)', value: period, statement: 'Engine Derived', capiqField: '', statePath: `Year index ${fIdx} + 0.5 (mid-year convention)` },
        ],
        notes: ['Mid-year discounting: cash flows assumed received at mid-year.'],
      };
    }

    if (colType === 'terminal') {
      const wacc = inp.wacc;
      const df = 1 / Math.pow(1 + wacc, n);
      return {
        title: 'Terminal Discount Factor',
        formulaText: 'Discount Factor = 1 / (1 + WACC)^n',
        expandedMathText: `${_traceFmt(df, 4)} = 1 / (1 + ${_traceFmtPct(wacc)})^${n}`,
        components: [
          { label: 'WACC', value: wacc, statement: 'Assumptions', capiqField: '', statePath: 'state.dcf.inputs.wacc' },
          { label: 'Forecast Years (n)', value: n, statement: 'Assumptions', capiqField: '', statePath: 'state.inputs.forecastYears' },
        ],
        notes: ['Terminal value discounted at end-of-period (not mid-year).'],
      };
    }

    return _noTraceForColumn('Discount Factor', year, colType);
  },

  // ----------------------------------------------------------
  // PV of FCF
  // ----------------------------------------------------------
  pv_fcf: (ctx) => {
    const { colType, fIdx, f, inp, year } = ctx;

    if (colType === 'forecast' && fIdx >= 0) {
      const fcf = f.fcf[fIdx];
      const wacc = inp.wacc;
      const period = fIdx + 0.5;
      const df = 1 / Math.pow(1 + wacc, period);
      const pvFCF = f.pvFCF[fIdx];
      return {
        title: `PV of FCF (${year})`,
        formulaText: 'PV of FCF = UFCF x Discount Factor',
        expandedMathText: `${_traceFmt(pvFCF)} = ${_traceFmt(fcf)} x ${_traceFmt(df, 4)}`,
        components: [
          { label: 'UFCF', value: fcf, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.fcf[${fIdx}]` },
          { label: 'Discount Factor', value: df, statement: 'Engine Derived', capiqField: '', statePath: `1 / (1 + WACC)^${period}` },
        ],
        notes: [],
      };
    }

    return _noTraceForColumn('PV of FCF', year, colType);
  },

  // ----------------------------------------------------------
  // Terminal FCF
  // ----------------------------------------------------------
  terminal_fcf: (ctx) => {
    const { colType, fIdx, f, inp, n, year } = ctx;

    // Terminal FCF appears in the last forecast column (not terminal column)
    if (colType === 'forecast' && fIdx === n - 1) {
      const lastFCF = f.fcf[n - 1];
      const g = inp.terminalGrowth;
      const termFCF = lastFCF * (1 + g);
      return {
        title: `Terminal FCF (${year})`,
        formulaText: 'Terminal FCF = Final Year UFCF x (1 + Terminal Growth)',
        expandedMathText: `${_traceFmt(termFCF)} = ${_traceFmt(lastFCF)} x (1 + ${_traceFmtPct(g)})`,
        components: [
          { label: 'Final Year UFCF', value: lastFCF, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.fcf[${n - 1}]` },
          { label: 'Terminal Growth', value: g, statement: 'Assumptions', capiqField: '', statePath: 'state.inputs.terminalGrowth' },
        ],
        notes: [],
      };
    }

    return _noTraceForColumn('Terminal FCF', year, colType);
  },

  // ----------------------------------------------------------
  // Terminal Value
  // ----------------------------------------------------------
  terminal_value: (ctx) => {
    const { colType, f, inp, n, s } = ctx;

    if (colType === 'terminal') {
      const lastFCF = f.fcf[n - 1];
      const g = inp.terminalGrowth;
      const wacc = inp.wacc;
      const termFCF = lastFCF * (1 + g);
      const tv = s.terminalValue;
      return {
        title: 'Terminal Value',
        formulaText: 'Terminal Value = Terminal FCF / (WACC - Terminal Growth)',
        expandedMathText: `${_traceFmt(tv)} = ${_traceFmt(termFCF)} / (${_traceFmtPct(wacc)} - ${_traceFmtPct(g)})`,
        components: [
          { label: 'Terminal FCF', value: termFCF, statement: 'Engine Derived', capiqField: '', statePath: `state.dcf.forecast.fcf[${n - 1}] x (1 + g)` },
          { label: 'WACC', value: wacc, statement: 'Assumptions', capiqField: '', statePath: 'state.dcf.inputs.wacc' },
          { label: 'Terminal Growth', value: g, statement: 'Assumptions', capiqField: '', statePath: 'state.inputs.terminalGrowth' },
        ],
        notes: ['Gordon Growth Model perpetuity.'],
      };
    }

    return _noTraceForColumn('Terminal Value', ctx.year, colType);
  },

  // ----------------------------------------------------------
  // PV of Terminal Value
  // ----------------------------------------------------------
  pv_terminal_value: (ctx) => {
    const { colType, s, inp, n } = ctx;

    if (colType === 'terminal') {
      const tv = s.terminalValue;
      const wacc = inp.wacc;
      const df = 1 / Math.pow(1 + wacc, n);
      const pvTV = s.pvTerminal;
      return {
        title: 'PV of Terminal Value',
        formulaText: 'PV of TV = Terminal Value x Discount Factor',
        expandedMathText: `${_traceFmt(pvTV)} = ${_traceFmt(tv)} x ${_traceFmt(df, 4)}`,
        components: [
          { label: 'Terminal Value', value: tv, statement: 'Engine Derived', capiqField: '', statePath: 'state.dcf.summary.terminalValue' },
          { label: 'Discount Factor', value: df, statement: 'Engine Derived', capiqField: '', statePath: `1 / (1 + WACC)^${n}` },
        ],
        notes: ['Discounted at end-of-period (year n, not mid-year).'],
      };
    }

    return _noTraceForColumn('PV of Terminal Value', ctx.year, colType);
  },

  // ----------------------------------------------------------
  // NPV of FCFs (valuation bridge - terminal column only)
  // ----------------------------------------------------------
  npv_fcfs: (ctx) => {
    const { colType, s, f } = ctx;

    if (colType === 'terminal') {
      const pvFCFTotal = f.pvFCF.reduce((a, b) => a + b, 0);
      return {
        title: 'NPV of FCFs',
        formulaText: 'NPV of FCFs = Sum of all PV of FCF across forecast years',
        expandedMathText: `${_traceFmt(pvFCFTotal)} = ${f.pvFCF.map(v => _traceFmt(v)).join(' + ')}`,
        components: f.pvFCF.map((v, i) => ({
          label: `PV of FCF Year ${i + 1}`,
          value: v,
          statement: 'Engine Derived',
          capiqField: '',
          statePath: `state.dcf.forecast.pvFCF[${i}]`,
        })),
        notes: [],
      };
    }

    return _noTraceForColumn('NPV of FCFs', ctx.year, colType);
  },

  // ----------------------------------------------------------
  // Enterprise Value
  // ----------------------------------------------------------
  enterprise_value: (ctx) => {
    const { colType, s, f } = ctx;

    if (colType === 'terminal') {
      const pvFCFTotal = f.pvFCF.reduce((a, b) => a + b, 0);
      const pvTV = s.pvTerminal;
      const ev = s.enterpriseValue;
      return {
        title: 'Enterprise Value',
        formulaText: 'EV = NPV of FCFs + PV of Terminal Value',
        expandedMathText: `${_traceFmt(ev)} = ${_traceFmt(pvFCFTotal)} + ${_traceFmt(pvTV)}`,
        components: [
          { label: 'NPV of FCFs', value: pvFCFTotal, statement: 'Engine Derived', capiqField: '', statePath: 'state.dcf.summary.npvFCF' },
          { label: 'PV of Terminal Value', value: pvTV, statement: 'Engine Derived', capiqField: '', statePath: 'state.dcf.summary.pvTerminal' },
        ],
        notes: [],
      };
    }

    return _noTraceForColumn('Enterprise Value', ctx.year, colType);
  },

  // ----------------------------------------------------------
  // Net Debt
  // ----------------------------------------------------------
  net_debt: (ctx) => {
    const { colType, s, inp } = ctx;

    if (colType === 'terminal') {
      const nd = s.netDebt;
      return _sourcedTrace('(-) Net Debt', ctx.year, nd != null ? -nd : null, 'Balance Sheet / Assumptions', 'state.inputs.netDebt');
    }

    return _noTraceForColumn('(-) Net Debt', ctx.year, ctx.colType);
  },

  // ----------------------------------------------------------
  // Minority Interest
  // ----------------------------------------------------------
  minority_interest: (ctx) => {
    const { colType, s } = ctx;

    if (colType === 'terminal') {
      const mi = s.minorityInterest;
      return _sourcedTrace('(-) Minority Interest', ctx.year, mi != null ? -mi : null, 'Balance Sheet / Assumptions', 'state.inputs.minorityInterest');
    }

    return _noTraceForColumn('(-) Minority Interest', ctx.year, ctx.colType);
  },

  // ----------------------------------------------------------
  // Equity Value
  // ----------------------------------------------------------
  equity_value: (ctx) => {
    const { colType, s, inp } = ctx;

    if (colType === 'terminal') {
      const ev = s.enterpriseValue;
      const nd = s.netDebt;
      const mi = s.minorityInterest;
      const pref = inp.preferredEquity || 0;
      const eqVal = s.equityValue;
      return {
        title: 'Equity Value',
        formulaText: 'Equity Value = EV - Net Debt - Preferred Equity - Minority Interest',
        expandedMathText: `${_traceFmt(eqVal)} = ${_traceFmt(ev)} - ${_traceFmt(nd)} - ${_traceFmt(pref)} - ${_traceFmt(mi)}`,
        components: [
          { label: 'Enterprise Value', value: ev, statement: 'Engine Derived', capiqField: '', statePath: 'state.dcf.summary.enterpriseValue' },
          { label: 'Net Debt', value: nd, statement: 'Assumptions', capiqField: '', statePath: 'state.inputs.netDebt' },
          { label: 'Preferred Equity', value: pref, statement: 'Assumptions', capiqField: '', statePath: 'state.inputs.preferredEquity' },
          { label: 'Minority Interest', value: mi, statement: 'Assumptions', capiqField: '', statePath: 'state.inputs.minorityInterest' },
        ],
        notes: ['Net Debt = Total Debt - Cash, so cash is already accounted for and not added back separately.'],
      };
    }

    return _noTraceForColumn('Equity Value', ctx.year, ctx.colType);
  },

  // ----------------------------------------------------------
  // Shares Outstanding
  // ----------------------------------------------------------
  shares_outstanding: (ctx) => {
    const { colType, inp } = ctx;

    if (colType === 'terminal') {
      return _sourcedTrace('Shares Outstanding', ctx.year, inp.sharesOutstanding, 'Market Data / Assumptions', 'state.inputs.sharesOutstanding');
    }

    return _noTraceForColumn('Shares Outstanding', ctx.year, ctx.colType);
  },

  // ----------------------------------------------------------
  // Implied Share Price
  // ----------------------------------------------------------
  implied_share_price: (ctx) => {
    const { colType, s, inp } = ctx;

    if (colType === 'terminal') {
      const eqVal = s.equityValue;
      const shares = inp.sharesOutstanding;
      const price = s.impliedPrice;
      const unitScale = typeof getUnitScale === 'function' ? getUnitScale() : 1e6;
      return {
        title: 'Implied Share Price',
        formulaText: 'Implied Price = (Equity Value x Unit Scale) / Shares Outstanding',
        expandedMathText: `$${_traceFmt(price, 2)} = (${_traceFmt(eqVal)} x ${unitScale.toExponential(0)}) / ${_traceFmt(shares, 0)}`,
        components: [
          { label: 'Equity Value', value: eqVal, statement: 'Engine Derived', capiqField: '', statePath: 'state.dcf.summary.equityValue' },
          { label: 'Unit Scale', value: unitScale, statement: 'Data Configuration', capiqField: '', statePath: 'state.rawData.units' },
          { label: 'Shares Outstanding', value: shares, statement: 'Market Data / Assumptions', capiqField: '', statePath: 'state.inputs.sharesOutstanding' },
        ],
        notes: ['Equity value is in data units; shares in actual count.'],
      };
    }

    return _noTraceForColumn('Implied Share Price', ctx.year, ctx.colType);
  },

  // ----------------------------------------------------------
  // Current Price (sourced)
  // ----------------------------------------------------------
  current_price: (ctx) => {
    const { colType, inp } = ctx;
    if (colType === 'terminal') {
      return _sourcedTrace('Current Price', ctx.year, inp.currentPrice, 'Market Data / Assumptions', 'state.inputs.currentPrice');
    }
    return _noTraceForColumn('Current Price', ctx.year, ctx.colType);
  },

  // ----------------------------------------------------------
  // Upside / Downside
  // ----------------------------------------------------------
  upside: (ctx) => {
    const { colType, s } = ctx;
    if (colType === 'terminal') {
      const implied = s.impliedPrice;
      const current = s.currentPrice;
      const upside = s.upside;
      return {
        title: 'Upside / Downside',
        formulaText: 'Upside = (Implied Price - Current Price) / Current Price',
        expandedMathText: `${_traceFmtPct(upside)} = ($${_traceFmt(implied, 2)} - $${_traceFmt(current, 2)}) / $${_traceFmt(current, 2)}`,
        components: [
          { label: 'Implied Price', value: implied, statement: 'Engine Derived', capiqField: '', statePath: 'state.dcf.summary.impliedPrice' },
          { label: 'Current Price', value: current, statement: 'Market Data', capiqField: '', statePath: 'state.inputs.currentPrice' },
        ],
        notes: [],
      };
    }
    return _noTraceForColumn('Upside / Downside', ctx.year, ctx.colType);
  },
};

// ============================================================
// Helper: build a "sourced directly" trace
// ============================================================

function _sourcedTrace(label, year, value, statement, statePath) {
  return {
    title: `${label} (${year})`,
    formulaText: 'Value sourced directly',
    expandedMathText: _traceFmt(value),
    components: [
      { label: label, value: value, statement: statement, capiqField: '', statePath: statePath },
    ],
    notes: [],
  };
}

// ============================================================
// Helper: no trace available for this column type
// ============================================================

function _noTraceForColumn(label, year, colType) {
  return {
    title: `${label} (${year})`,
    formulaText: 'No value in this column.',
    expandedMathText: '-',
    components: [],
    notes: [],
  };
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Build a formula trace for a given cell.
 * Supports both DCF projection line items (via TRACE_REGISTRY)
 * and Key Metrics items (prefix "km_" → lookup from engine-built traces).
 * @param {{ lineItemKey: string, year: string, scenario: string }} params
 * @returns {object} trace object
 */
function buildFormulaTrace({ lineItemKey, year, scenario }) {
  // --- Key Metrics trace: pre-built by engine in state.dcf.keyMetricsTrace ---
  if (lineItemKey.startsWith('km_')) {
    const metricKey = lineItemKey.slice(3); // strip "km_" prefix
    const d = state.dcf;
    if (!d || !d.valid || !d.keyMetricsTrace) {
      return { title: `${metricKey} (${year})`, formulaText: 'Key metrics not computed.', expandedMathText: '-', components: [], notes: [] };
    }
    const yearTrace = d.keyMetricsTrace[year];
    if (yearTrace && yearTrace[metricKey]) {
      return yearTrace[metricKey];
    }
    return { title: `${metricKey} (${year})`, formulaText: 'No trace data for this metric/year.', expandedMathText: '-', components: [], notes: [] };
  }

  // --- Standard DCF projection trace ---
  const ctx = _buildTraceContext(lineItemKey, year, scenario || 'base');
  if (!ctx) {
    return {
      title: `${lineItemKey} (${year})`,
      formulaText: 'DCF model not available.',
      expandedMathText: '-',
      components: [],
      notes: [],
    };
  }

  const resolver = TRACE_REGISTRY[lineItemKey];
  if (!resolver) {
    return {
      title: `${lineItemKey} (${year})`,
      formulaText: 'No trace available for this line item yet.',
      expandedMathText: '-',
      components: [],
      notes: [],
    };
  }

  try {
    return resolver(ctx);
  } catch (err) {
    console.warn('[FormulaTrace] Error resolving trace for', lineItemKey, year, err);
    return {
      title: `${lineItemKey} (${year})`,
      formulaText: 'Error building trace.',
      expandedMathText: '-',
      components: [],
      notes: [String(err)],
    };
  }
}
