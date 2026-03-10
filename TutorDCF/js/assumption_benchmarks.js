/* ============================================================
   Assumption Benchmarks — All Segment-Based Data
   =================================================================
   Loaded before 07_assumptions_panel.js.
   Centralizes ALL segment-specific data so updates only require
   editing this one file.

   Exports:
     window.ASSUMPTION_BENCHMARKS  — percentile data for boxplots
     window.ADVANCED_SEGMENT_RANGES — validation ranges for year-by-year grid

   All percent values stored as decimals (0.10 = 10%).
   Percentile keys: p10, p25, p50, p75, p90.
   Segments: general, tech.
============================================================ */

window.ASSUMPTION_BENCHMARKS = {
  revenueGrowth: {
    label: 'Revenue Growth',
    unit: 'pct',
    general: { p10: 0.02, p25: 0.04, p50: 0.06, p75: 0.10, p90: 0.15 },
    tech:    { p10: 0.05, p25: 0.08, p50: 0.12, p75: 0.18, p90: 0.30 },
  },
  ebitMargin: {
    label: 'EBIT Margin',
    unit: 'pct',
    general: { p10: 0.04, p25: 0.08, p50: 0.13, p75: 0.20, p90: 0.28 },
    tech:    { p10: 0.05, p25: 0.10, p50: 0.18, p75: 0.28, p90: 0.38 },
  },
  taxRate: {
    label: 'Tax Rate',
    unit: 'pct',
    general: { p10: 0.15, p25: 0.20, p50: 0.23, p75: 0.26, p90: 0.30 },
    tech:    { p10: 0.10, p25: 0.15, p50: 0.20, p75: 0.24, p90: 0.28 },
  },
  capexPct: {
    label: 'CapEx (% Rev)',
    unit: 'pct',
    general: { p10: 0.02, p25: 0.04, p50: 0.06, p75: 0.09, p90: 0.12 },
    tech:    { p10: 0.02, p25: 0.03, p50: 0.05, p75: 0.07, p90: 0.10 },
  },
  nwcPct: {
    label: 'NWC Change (% Rev)',
    unit: 'pct',
    general: { p10: -0.02, p25: 0.00, p50: 0.01, p75: 0.02, p90: 0.04 },
    tech:    { p10: -0.03, p25: -0.01, p50: 0.005, p75: 0.015, p90: 0.03 },
  },
  costOfEquity: {
    label: 'Cost of Equity',
    unit: 'pct',
    general: { p10: 0.07, p25: 0.085, p50: 0.10, p75: 0.12, p90: 0.15 },
    tech:    { p10: 0.08, p25: 0.095, p50: 0.11, p75: 0.14, p90: 0.18 },
  },
  costOfDebt: {
    label: 'Cost of Debt',
    unit: 'pct',
    general: { p10: 0.035, p25: 0.045, p50: 0.055, p75: 0.07, p90: 0.09 },
    tech:    { p10: 0.03, p25: 0.04, p50: 0.055, p75: 0.07, p90: 0.10 },
  },
  wacc: {
    label: 'WACC',
    unit: 'pct',
    general: { p10: 0.065, p25: 0.08, p50: 0.09, p75: 0.105, p90: 0.13 },
    tech:    { p10: 0.07, p25: 0.085, p50: 0.10, p75: 0.12, p90: 0.15 },
  },
  terminalGrowth: {
    label: 'Terminal Growth Rate',
    unit: 'pct',
    general: { p10: 0.01, p25: 0.015, p50: 0.02, p75: 0.025, p90: 0.035 },
    tech:    { p10: 0.015, p25: 0.02, p50: 0.025, p75: 0.03, p90: 0.04 },
  },
};

// ======================================================================
// SEGMENT-BASED VALIDATION RANGES FOR ADVANCED YEAR-BY-YEAR ASSUMPTIONS
// Used by the advanced assumptions grid and the DCF engine validator.
// Each canonical key has { warnMin, warnMax, errorMin, errorMax } in decimal.
//   warnMin/warnMax  — unusual but possible (shows yellow warning)
//   errorMin/errorMax — clearly invalid (blocks valuation, shows red error)
// ======================================================================
window.ADVANCED_SEGMENT_RANGES = {
  general: {
    revenueGrowth:   { warnMin: -0.10, warnMax: 0.30, errorMin: -0.50, errorMax: 1.00 },
    ebitdaMargin:    { warnMin: 0.02,  warnMax: 0.40, errorMin: -0.50, errorMax: 0.80 },
    taxRate:         { warnMin: 0.10,  warnMax: 0.40, errorMin: 0.00,  errorMax: 0.60 },
    capexPctRevenue: { warnMin: 0.01,  warnMax: 0.15, errorMin: 0.00,  errorMax: 0.50 },
    nwcPctRevenue:   { warnMin: -0.05, warnMax: 0.10, errorMin: -0.20, errorMax: 0.30 },
  },
  tech: {
    revenueGrowth:   { warnMin: -0.05, warnMax: 0.50, errorMin: -0.50, errorMax: 1.00 },
    ebitdaMargin:    { warnMin: 0.05,  warnMax: 0.55, errorMin: -0.50, errorMax: 0.80 },
    taxRate:         { warnMin: 0.10,  warnMax: 0.35, errorMin: 0.00,  errorMax: 0.60 },
    capexPctRevenue: { warnMin: 0.01,  warnMax: 0.12, errorMin: 0.00,  errorMax: 0.50 },
    nwcPctRevenue:   { warnMin: -0.05, warnMax: 0.08, errorMin: -0.20, errorMax: 0.30 },
  },
};
