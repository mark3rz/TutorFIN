/* ============================================================
   TASK 02 -- Excel Ingestion (Capital IQ Adapter)
   Handles three file layouts:
     A) Simple format -- company in A1, units in A2, years in row 4
     B) Capital IQ/FactSet format -- metadata rows 1-14, year headers
        in row 15 as "12 months\nNov-29-2019" multiline strings,
        data from row 17 onward.
     C) Capital IQ "2020 FY" style -- year headers like "2020 FY",
        "2021E", "FY2022" with estimate markers.
   Schema derived from DCF_Tutor/capiq_dcf_prompts specs 03-05.
   Adapter: detects format via header pattern, normalizes to
   canonical { years, yearMetadata, sheets } structure expected
   by 03_normalization.js and downstream pipeline.
   Backward compatible with old Capital IQ format.
   NO number parsing. NO calculations. NO layout changes.
============================================================ */

// --- Sheet keyword groups for detection ---
// Capital IQ sheets: "Income Statement", "Balance Sheet", "Cash Flow",
// "Key Stats", "Capitalization", "Multiples"
const SHEET_KEYWORDS = {
  income:     ['income', 'p&l', 'profit', 'loss', 'pnl', 'revenue', 'is'],
  balance:    ['balance', 'bs', 'assets', 'liabilities', 'equity'],
  cashflow:   ['cash flow', 'cashflow', 'cf', 'cash'],
  multiples:  ['multiples', 'multiple', 'ev/ebitda', 'trading comps'],
  summary:    ['summary', 'overview', 'model', 'dcf', 'valuation', 'key stats',
               'capitalization', 'cap table'],
};

// --- Detect sheet type from name ---
function detectSheetType(name) {
  const lower = name.toLowerCase();
  for (const [type, keywords] of Object.entries(SHEET_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return type;
  }
  return 'unknown';
}

// --- Detect if a year header represents an estimate/forecast ---
// Capital IQ uses tokens like "E", "Est", "Estimate" near the year.
// Returns true for "2021E", "2021 Est", "FY2021E", "Estimate" in multiline.
function isEstimateHeader(cellValue) {
  if (cellValue === null || cellValue === undefined) return false;
  const s = String(cellValue).trim();
  // Look for E/Est/Estimate tokens near the year
  if (/\d{4}\s*E\b/i.test(s)) return true;
  if (/\bE\s*\d{4}/i.test(s)) return true;
  if (/\best(?:imate)?\b/i.test(s)) return true;
  if (/\bforecast\b/i.test(s)) return true;
  if (/\bprojected?\b/i.test(s)) return true;
  return false;
}

// --- Extract a 4-digit year from various string formats ---
// Handles: "2021", "FY2021", "2021A", "2021E", "2020 FY",
//          "12 months\nNov-29-2019", "Restated\n12 months\nNov-30-2018",
//          Excel date serial numbers
function extractYear(cellValue, dateMode) {
  if (cellValue === null || cellValue === undefined || cellValue === '') return null;

  // Numeric — could be Excel date serial
  if (typeof cellValue === 'number') {
    // Plausible year integer
    if (cellValue >= 1990 && cellValue <= 2100) return String(Math.round(cellValue));
    // Excel date serial (> 40000 ≈ year 2009+)
    if (cellValue > 40000 && typeof XLSX !== 'undefined') {
      try {
        const d = XLSX.SSF.parse_date_code(cellValue);
        if (d && d.y >= 1990) return String(d.y);
      } catch (e) { /* ignore */ }
    }
    return null;
  }

  const s = String(cellValue).trim();

  // Direct 4-digit year or labelled year: "FY2021", "2021A", "2021E"
  const direct = s.match(/\b(19|20)\d{2}\b/);
  if (direct) return direct[0];

  // Multiline format: "12 months\nNov-29-2019" or "Restated\n12 months\nNov-30-2018"
  const monthYear = s.match(/[A-Za-z]{3}[-\s](\d{1,2})[-\s]((?:19|20)\d{2})/);
  if (monthYear) return monthYear[2];

  // "Nov-2019" shorthand
  const shortYear = s.match(/((?:19|20)\d{2})/);
  if (shortYear) return shortYear[1];

  return null;
}

// --- Scan a worksheet to find the year-header row ---
// Looks for the first row where >=3 consecutive columns contain 4-digit years.
// Returns { headerRow (0-based), dataStartRow (0-based), yearCols [],
//           yearMetadata: { year: { is_estimate, raw_header } } }
function findYearHeaderRow(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const maxScanRow = Math.min(range.e.r, 30); // only scan first 30 rows

  for (let r = 0; r <= maxScanRow; r++) {
    const yearsFound = [];
    const yearMeta = {};
    for (let c = 0; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      const rawHeader = cell.v;
      const yr = extractYear(rawHeader);
      if (yr) {
        yearsFound.push({ col: c, year: yr });
        yearMeta[yr] = {
          is_estimate: isEstimateHeader(rawHeader),
          raw_header: String(rawHeader).trim(),
        };
      }
    }
    if (yearsFound.length >= 3) {
      // Found year header row
      // Data starts after metadata rows below the header.
      // Capital IQ files have several metadata rows between the year headers
      // and the actual data: Current/Restated, Period Ended (date serials),
      // Financial Filing Date (date serials), Exchange Rates, blank spacers,
      // and unit indicators like "($000)". Skip all of these.
      let dataStartRow = r + 1;
      const META_SKIP_KEYWORDS = [
        'currency', 'current', 'restated', 'period ended', 'period end',
        'financial filing', 'filing date', 'spot exchange', 'average exchange',
        'exchange rate', 'reporting', '($000)', '($ 000)', '($mm)', '($m)',
      ];
      const maxSkip = Math.min(r + 12, range.e.r); // scan up to 12 rows past header
      for (let sr = dataStartRow; sr <= maxSkip; sr++) {
        const skipAddr = XLSX.utils.encode_cell({ r: sr, c: 0 });
        const skipCell = ws[skipAddr];
        if (!skipCell) { dataStartRow = sr + 1; continue; } // blank row, skip
        const skipText = String(skipCell.v).toLowerCase().trim();
        if (skipText === '' || skipText === ' ') { dataStartRow = sr + 1; continue; } // blank/space
        // Check if this row is metadata
        const isMeta = META_SKIP_KEYWORDS.some(kw => skipText.includes(kw));
        if (isMeta) {
          dataStartRow = sr + 1;
          continue;
        }
        // Check if column A has a date serial number (numeric between 30000-60000)
        if (typeof skipCell.v === 'number' && skipCell.v > 30000 && skipCell.v < 60000) {
          dataStartRow = sr + 1;
          continue;
        }
        // Found a non-metadata row; this is where data starts
        break;
      }
      console.log('[DCF] Year header at row', r, '-> dataStartRow:', dataStartRow);
      return { headerRow: r, dataStartRow, yearCols: yearsFound, yearMetadata: yearMeta };
    }
  }
  return null;
}

// --- Extract company name from Capital IQ title row ---
// Title typically looks like: "Adobe Inc. (NasdaqGS:ADBE) > Financials > Income Statement"
function extractCompanyFromTitle(titleStr) {
  if (!titleStr) return null;
  const s = String(titleStr).trim();
  // Grab everything before " (", " >", or " |" (Capital IQ uses "Company | Sheet Title")
  const match = s.match(/^([^(>|]+)/);
  return match ? match[1].trim() : s;
}

// --- Extract units from metadata rows (rows 5-14) ---
// Normalize a raw units string to '$K', '$M', or '$B'
function normalizeUnitsLabel(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase().trim();
  if (s === '$k' || s === '$m' || s === '$b') return s.toUpperCase();
  // Text patterns
  if (s.includes('thousand'))  return '$K';
  if (s.includes('million'))   return '$M';
  if (s.includes('billion'))   return '$B';
  // Numeric exponent patterns (Capital IQ "Decimals" value)
  if (s === '-3' || s === '3') return '$K';
  if (s === '-6' || s === '6') return '$M';
  if (s === '-9' || s === '9') return '$B';
  // Shorthand patterns (e.g. "USD Th", "$ mm", "Mn")
  if (/\bth(ous)?\b/.test(s))  return '$K';
  if (/\b(mm|mn|mil)\b/.test(s)) return '$M';
  if (/\b(bn|bil)\b/.test(s))  return '$B';
  return null;
}

function extractUnitsFromMeta(ws, maxRow = 14) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = 0; r <= Math.min(range.e.r, maxRow); r++) {
    // Scan columns A and B for unit indicators
    for (let c = 0; c <= Math.min(range.e.c, 3); c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      const text = String(cell.v).toLowerCase().trim();

      // Direct unit label match (e.g. "USD Thousands", "In Millions", etc.)
      const normalized = normalizeUnitsLabel(text);
      if (normalized) {
        console.log('[DCF] Units detected from cell', addr, ':', text, '->', normalized);
        return normalized;
      }

      // Row label that indicates units info is nearby
      if (text.includes('decimal') || text.includes('unit') || text.includes('currency')
        || text.includes('in million') || text.includes('in thousand') || text.includes('in billion')
        || text.includes('denomination') || text.includes('reporting')) {
        // Check adjacent cells for the actual value
        for (let cc = c + 1; cc <= Math.min(range.e.c, c + 3); cc++) {
          const adjAddr = XLSX.utils.encode_cell({ r, c: cc });
          const adjCell = ws[adjAddr];
          if (adjCell) {
            const adj = normalizeUnitsLabel(String(adjCell.v));
            if (adj) {
              console.log('[DCF] Units detected from', adjAddr, '(label at', addr, '):', String(adjCell.v), '->', adj);
              return adj;
            }
          }
        }
        // Try the label itself
        const fromLabel = normalizeUnitsLabel(text);
        if (fromLabel) return fromLabel;
      }
    }
  }
  console.log('[DCF] Units: metadata detection returned null (will use default)');
  return null;
}

// --- Extract metadata + rows from a worksheet ---
function extractSheetMeta(ws) {
  const meta = {
    company:       null,
    units:         null,
    years:         [],
    yearMetadata:  {},    // { year: { is_estimate, raw_header } }
    headerRow:     null,
    dataStartRow:  null,
    format:        'simple', // 'simple' | 'capiq'
  };

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // -- Try to find year header row (works for both simple and Capital IQ) --
  const found = findYearHeaderRow(ws);

  if (found) {
    meta.headerRow    = found.headerRow;
    meta.dataStartRow = found.dataStartRow;
    meta.years        = found.yearCols.map(yc => yc.year);
    meta.yearMetadata = found.yearMetadata || {};

    // Detect Capital IQ format: header row > 3 (metadata rows above)
    // or multiline year headers containing month names
    const sampleHeader = Object.values(meta.yearMetadata)[0];
    if (found.headerRow > 3 ||
        (sampleHeader && /\n/.test(sampleHeader.raw_header))) {
      meta.format = 'capiq';
    }

    // Company name: scan rows above headerRow for a title string
    for (let r = 0; r < found.headerRow; r++) {
      const aAddr = XLSX.utils.encode_cell({ r, c: 0 });
      const aCell = ws[aAddr];
      if (aCell && String(aCell.v).trim().length > 5) {
        const candidate = extractCompanyFromTitle(aCell.v);
        if (candidate && candidate.length > 2) {
          meta.company = candidate;
          break;
        }
      }
    }

    // Units: scan metadata rows
    meta.units = extractUnitsFromMeta(ws, found.headerRow);

  } else {
    // Fallback: simple format -- A1=company, A2=units, row 4=years
    const a1 = ws['A1'];
    if (a1) meta.company = String(a1.v).trim();
    const a2 = ws['A2'];
    if (a2) meta.units = String(a2.v).trim();

    meta.headerRow    = 3; // row 4 (0-based)
    meta.dataStartRow = 4; // row 5
    meta.format       = 'simple';

    for (let col = 1; col <= range.e.c; col++) {
      const addr = XLSX.utils.encode_cell({ r: 3, c: col });
      const cell = ws[addr];
      if (!cell || cell.v === undefined || cell.v === '') break;
      const rawHeader = cell.v;
      const yr = extractYear(rawHeader);
      if (yr) {
        meta.years.push(yr);
        meta.yearMetadata[yr] = {
          is_estimate: isEstimateHeader(rawHeader),
          raw_header: String(rawHeader).trim(),
        };
      }
    }
  }

  return meta;
}

// --- Extract all data rows from a worksheet ---
// Starts from meta.dataStartRow, column 0 = label, cols 1+ = values
function extractRows(ws, dataStartRow) {
  const startRow = dataStartRow != null ? dataStartRow : 4;
  const range    = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const rows     = [];

  for (let r = startRow; r <= range.e.r; r++) {
    const row = [];
    for (let c = 0; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      row.push(cell ? cell.v : null);
    }
    if (row.every(v => v === null || v === '')) continue;
    rows.push(row);
  }

  return rows;
}

// --- Main ingestion function ---
function ingestFile(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const data     = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: false });

      const detected   = {};
      const sheetNames = workbook.SheetNames;

      console.log('[DCF] Sheets found:', sheetNames);

      for (const name of sheetNames) {
        const type = detectSheetType(name);
        const ws   = workbook.Sheets[name];
        const meta = extractSheetMeta(ws);
        const rows = extractRows(ws, meta.dataStartRow);

        detected[name] = { type, meta, rows };

        console.log(`[DCF] Sheet "${name}" → type: ${type}, years: [${meta.years.join(', ')}], rows: ${rows.length}, dataStartRow: ${meta.dataStartRow}`);
      }

      // Pick best company name — prefer income or cash flow sheet title
      let companyName = null;
      let units       = null;
      let years       = [];

      const preferred = ['Income Statement', 'Cash Flow', 'Balance Sheet'];
      const orderedNames = [
        ...preferred.filter(n => sheetNames.includes(n)),
        ...sheetNames.filter(n => !preferred.includes(n)),
      ];

      // Pick years from the best financial statement sheet (income > cashflow > balance)
      // rather than whichever sheet has the most columns (which could be a quarterly
      // sheet like Multiples with 60 columns that misaligns with annual data).
      let yearsSource = null;
      for (const name of orderedNames) {
        const s = detected[name];
        if (!companyName && s.meta.company) companyName = s.meta.company;
        if (!units       && s.meta.units)   units       = s.meta.units;
        // Prefer years from the first preferred sheet that has them
        if (!yearsSource && preferred.includes(name) && s.meta.years.length >= 3) {
          years       = s.meta.years;
          yearsSource = name;
        }
      }
      // Fallback: if no preferred sheet had years, use the sheet with the most
      if (!yearsSource) {
        for (const name of orderedNames) {
          const s = detected[name];
          if (s.meta.years.length > years.length) {
            years       = s.meta.years;
            yearsSource = name;
          }
        }
      }
      console.log('[DCF] Years source sheet:', yearsSource, '(' + years.length + ' years)');

      // Warn if still no years
      if (years.length === 0) {
        state.warnings.push('Could not detect fiscal year headers. Please check the file format.');
      }

      const types = Object.values(detected).map(s => s.type);
      if (!types.includes('income') && !types.includes('cashflow') && !types.includes('summary')) {
        state.warnings.push('No income statement, cash flow, or summary sheet detected. Check sheet names.');
      }

      // Merge yearMetadata from the years source sheet
      let yearMetadata = {};
      let detectedFormat = 'simple';
      if (yearsSource && detected[yearsSource]) {
        yearMetadata = detected[yearsSource].meta.yearMetadata || {};
        detectedFormat = detected[yearsSource].meta.format || 'simple';
      }

      // Filter to actuals-only years by default (exclude estimates)
      // Preserve full year list for reference; downstream can use yearMetadata
      const actualYears = years.filter(y => {
        const m = yearMetadata[y];
        return !m || !m.is_estimate;
      });

      // Default units: Capital IQ files are almost always in thousands ($K);
      // simple/generic files default to millions ($M).
      const defaultUnits = detectedFormat === 'capiq' ? '$K' : '$M';
      if (!units) {
        console.log('[DCF] Units not detected from metadata; defaulting to', defaultUnits, '(format:', detectedFormat + ')');
      }

      state.rawData = {
        fileName:      file.name,
        sheetNames,
        sheets:        detected,
        companyName:   companyName || file.name.replace(/\.[^.]+$/, ''),
        units:         units || defaultUnits,
        years,                    // all years (actuals + estimates)
        actualYears,              // actuals only (no estimates)
        yearMetadata,             // { year: { is_estimate, raw_header } }
        format:        detectedFormat, // 'simple' | 'capiq'
      };

      // -- PHASE 4: Validation console summary --
      const estCount = years.filter(y => yearMetadata[y] && yearMetadata[y].is_estimate).length;
      const sheetSummary = Object.entries(detected).map(([n, s]) => {
        return `${n} (${s.type}, ${s.rows.length} rows)`;
      });
      console.log('[DCF] === Ingestion Summary ===');
      console.log('[DCF] Format detected:', detectedFormat);
      console.log('[DCF] Company:', state.rawData.companyName);
      console.log('[DCF] Units:', state.rawData.units);
      console.log('[DCF] Years detected:', years.join(', '));
      console.log('[DCF] Actual years:', actualYears.join(', '));
      console.log('[DCF] Estimate years:', estCount);
      console.log('[DCF] Year metadata:', yearMetadata);
      console.log('[DCF] Sheets:', sheetSummary);
      console.log('[DCF] Years source sheet:', yearsSource);
      console.log('[DCF] === End Ingestion Summary ===');

      // Task 03: parse numbers + fuzzy-match line items
      if (typeof normalizeData === 'function') normalizeData();

      // Task 04: compute derived historical metrics
      if (typeof computeDerivedMetrics === 'function') computeDerivedMetrics();

      // Task 05: build default DCF inputs then run the engine
      if (typeof buildDefaultInputs === 'function') buildDefaultInputs(state.historical);
      if (typeof calculateDCF === 'function') calculateDCF(state.inputs, state.historical);

      // Task 06: render executive summary + animate header metrics
      if (typeof renderExecutiveMetrics === 'function') renderExecutiveMetrics();

      // Task 07: render assumptions panel
      if (typeof renderAssumptionsPanel === 'function') renderAssumptionsPanel();

      // Task 08: render DCF projection table
      if (typeof renderDCFTable === 'function') renderDCFTable();

      // Task 09: render core charts
      if (typeof renderCharts === 'function') renderCharts();

      // Task 10A: render sensitivity tables
      if (typeof renderSensitivity === 'function') renderSensitivity();

      // Task 10B: render scenario builder + tornado
      if (typeof renderScenario === 'function') renderScenario();

      // Task 11A: attach tooltips to rendered content
      if (typeof initTooltips === 'function') initTooltips();

      // Task 11B: render searchable glossary panel
      if (typeof renderGlossary === 'function') renderGlossary();

      // Task 12: render raw source data tabs
      if (typeof renderRawDataTabs === 'function') renderRawDataTabs();

      // Task 13: render DCF diagnostics
      if (typeof renderDiagnostics === 'function') renderDiagnostics();

      // Task 14–16: populate context panel with initial report
      if (typeof refreshContextPanel === 'function') refreshContextPanel();

      // Update header brand
      const elName = document.getElementById('company-name');
      const elMeta = document.getElementById('company-meta');
      if (elName) elName.textContent = state.rawData.companyName;
      if (elMeta) elMeta.textContent = [state.rawData.units, state.rawData.years.join(' · ')].filter(Boolean).join(' · ');

      renderWarnings();
      hideUploadScreen();

    } catch (err) {
      state.warnings.push(`File read error: ${err.message}`);
      console.error('[DCF] Ingestion error:', err);
      renderWarnings();
      hideUploadScreen();
    }
  };

  reader.onerror = function () {
    state.warnings.push('Could not read file. Please try again with a valid Excel or CSV file.');
    renderWarnings();
  };

  reader.readAsArrayBuffer(file);
}
