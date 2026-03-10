const XLSX = require('xlsx');
const path = '/Users/markdillemuth/Desktop/Company_Data/Adobe Inc NasdaqGS ADBE Financials.xls';

const wb = XLSX.readFile(path);

console.log("=== SHEET NAMES ===");
console.log(wb.SheetNames);
console.log("");

// Helper: extract year from a cell value like "12 months\nNov-30-2012" or similar
function extractYear(val) {
  if (val == null) return null;
  const s = String(val);
  const m = s.match(/(\d{4})/);
  return m ? parseInt(m[1]) : null;
}

// Helper: check if a row looks like a header row (has multiple year-like values)
function isHeaderRow(row) {
  let yearCount = 0;
  for (let c = 1; c < row.length; c++) {
    if (extractYear(row[c])) yearCount++;
  }
  return yearCount >= 3; // at least 3 year-like values
}

function analyzeSheet(sheetName) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`=== SHEET: "${sheetName}" ===`);
  console.log(`${"=".repeat(70)}`);
  
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.log("  Sheet not found!");
    return;
  }
  
  // Get the range
  const range = XLSX.utils.decode_range(ws['!ref']);
  console.log(`Range: ${ws['!ref']}`);
  console.log(`Rows: ${range.s.r} to ${range.e.r}, Cols: ${range.s.c} to ${range.e.c}`);
  
  // Convert to array of arrays (raw values)
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  
  console.log(`\nTotal rows in data: ${data.length}`);
  
  // Scan rows 0-20 for the header row
  let headerRowIdx = -1;
  console.log("\n--- Scanning rows 0-20 for header row ---");
  for (let r = 0; r <= Math.min(20, data.length - 1); r++) {
    const row = data[r] || [];
    const nonNull = row.filter(v => v != null).length;
    if (nonNull > 0) {
      // Show abbreviated row content
      const preview = row.slice(0, Math.min(row.length, 15)).map((v, i) => {
        if (v == null) return `[${i}]:null`;
        const s = String(v).replace(/\n/g, '\\n').substring(0, 40);
        return `[${i}]:"${s}"`;
      }).join('  ');
      console.log(`  Row ${r} (${row.length} cols, ${nonNull} non-null): ${preview}`);
      
      if (isHeaderRow(row) && headerRowIdx === -1) {
        headerRowIdx = r;
        console.log(`    ^^^ THIS IS THE HEADER ROW ^^^`);
      }
    }
  }
  
  if (headerRowIdx === -1) {
    console.log("\n  No header row found in rows 0-20!");
    return;
  }
  
  const headerRow = data[headerRowIdx];
  
  // Print ALL header values
  console.log(`\n--- ALL Header Values (Row ${headerRowIdx}) ---`);
  for (let c = 0; c < headerRow.length; c++) {
    const raw = headerRow[c];
    const rawStr = raw == null ? 'null' : String(raw).replace(/\n/g, '\\n');
    const year = extractYear(raw);
    console.log(`  Col ${c}: raw="${rawStr}"  =>  year=${year}`);
  }
  
  // Also check the actual cell objects for formatting info
  console.log(`\n--- Cell objects for header row ---`);
  for (let c = 0; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRowIdx, c: c });
    const cell = ws[addr];
    if (cell) {
      console.log(`  ${addr}: type=${cell.t}, v=${JSON.stringify(cell.v)}, w=${JSON.stringify(cell.w)}`);
    }
  }
  
  // Build year mapping
  const yearMap = {};
  for (let c = 1; c < headerRow.length; c++) {
    const year = extractYear(headerRow[c]);
    if (year) yearMap[c] = year;
  }
  console.log(`\n--- Year Mapping ---`);
  console.log(`  Total year columns: ${Object.keys(yearMap).length}`);
  console.log(`  Years: ${Object.values(yearMap).join(', ')}`);
  
  // Find Revenue row
  console.log(`\n--- Searching for Revenue row ---`);
  let revenueRowIdx = -1;
  for (let r = 0; r < data.length; r++) {
    const row = data[r] || [];
    if (row[0] != null) {
      const label = String(row[0]).trim().toLowerCase();
      if (label === 'revenue' || label === 'total revenue' || label === 'total revenues' || label === 'revenues') {
        revenueRowIdx = r;
        console.log(`  Found "${row[0]}" at row ${r}`);
        
        console.log(`\n--- ALL Values from Revenue Row (Row ${r}) ---`);
        for (let c = 0; c < row.length; c++) {
          console.log(`    Col ${c}: ${row[c]}`);
        }
        
        console.log(`\n--- Year → Revenue Mapping ---`);
        for (const [colStr, year] of Object.entries(yearMap)) {
          const col = parseInt(colStr);
          const val = row[col];
          console.log(`    ${year} => ${val}`);
        }
        break;
      }
    }
  }
  
  if (revenueRowIdx === -1) {
    // Print all row labels to help find it
    console.log("  Revenue row not found. Printing all row labels:");
    for (let r = 0; r < Math.min(data.length, 60); r++) {
      const row = data[r] || [];
      if (row[0] != null) {
        console.log(`    Row ${r}: "${String(row[0]).substring(0, 60)}"`);
      }
    }
  }
  
  // Also look for other key rows
  console.log(`\n--- Key rows scan ---`);
  const keyTerms = ['revenue', 'net income', 'ebitda', 'free cash flow', 'operating', 'depreciation', 'capex', 'capital expenditure', 'cash from operations'];
  for (let r = 0; r < data.length; r++) {
    const row = data[r] || [];
    if (row[0] != null) {
      const label = String(row[0]).trim().toLowerCase();
      for (const term of keyTerms) {
        if (label.includes(term)) {
          const vals = [];
          for (const [colStr, year] of Object.entries(yearMap)) {
            vals.push(`${year}:${row[parseInt(colStr)]}`);
          }
          console.log(`  Row ${r} "${row[0]}": ${vals.join(', ')}`);
          break;
        }
      }
    }
  }
}

// Analyze each sheet
const sheetsToAnalyze = ['Income Statement', 'Key Stats', 'Cash Flow'];
for (const name of sheetsToAnalyze) {
  // Try exact match first, then case-insensitive partial match
  let matchedName = wb.SheetNames.find(s => s === name);
  if (!matchedName) {
    matchedName = wb.SheetNames.find(s => s.toLowerCase().includes(name.toLowerCase()));
  }
  if (matchedName) {
    analyzeSheet(matchedName);
  } else {
    console.log(`\nSheet "${name}" not found. Available: ${wb.SheetNames.join(', ')}`);
  }
}

// Summary
console.log(`\n\n${"=".repeat(70)}`);
console.log("=== SUMMARY ===");
console.log(`${"=".repeat(70)}`);
console.log(`Sheets in workbook: ${wb.SheetNames.join(', ')}`);
