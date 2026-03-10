#!/usr/bin/env node
/**
 * Scans the employees/ folder for .png files and writes
 * employees/employees_manifest.js with the list.
 *
 * Usage:  node tools/generate_employees_manifest.js
 * Run from the DCF_Valuation_Folder root.
 */
const fs   = require('fs');
const path = require('path');

const dir  = path.join(__dirname, '..', 'employees');
const out  = path.join(dir, 'employees_manifest.js');

const files = fs.readdirSync(dir)
  .filter(f => /\.png$/i.test(f))
  .sort();

const js = [
  '/**',
  ' * Auto-generated employee manifest.',
  ' * Regenerate with: node tools/generate_employees_manifest.js',
  ' */',
  'window.EMPLOYEE_MANIFEST = [',
  files.map(f => `  ${JSON.stringify(f)}`).join(',\n'),
  '];',
  '',
].join('\n');

fs.writeFileSync(out, js, 'utf8');
console.log(`Wrote ${files.length} employees to ${out}`);
