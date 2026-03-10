/* ============================================================
   CHAT FOCUS -- tutordcf:focus event listener
   Handles highlight/scroll-to behavior when chat personas
   reference specific UI elements.

   Supported focus targets:
     assumption:wacc
     assumption:terminalGrowth
     assumption:revenueGrowth
     assumption:nwcPct
     assumption:ebitMargin
     assumption:capexPct
     assumption:taxRate
     assumption:costOfEquity
     assumption:costOfDebt

   The target format is "assumption:<inputKey>", matching the
   input IDs "inp-<inputKey>" in the assumptions panel.

   Additional targets can be added by extending the FOCUS_MAP
   or adding cases in the handleFocus function.
============================================================ */

(function () {
  'use strict';

  // Map of focus targets to { selector, type }
  // type: 'input' (highlight the input control), 'row' (highlight a table row)
  const FOCUS_MAP = {
    'assumption:wacc':           { selector: '#inp-wacc',           type: 'input' },
    'assumption:terminalGrowth': { selector: '#inp-terminalGrowth', type: 'input' },
    'assumption:revenueGrowth':  { selector: '#inp-revenueGrowth',  type: 'input' },
    'assumption:nwcPct':         { selector: '#inp-nwcPct',         type: 'input' },
    'assumption:ebitMargin':     { selector: '#inp-ebitMargin',     type: 'input' },
    'assumption:capexPct':       { selector: '#inp-capexPct',       type: 'input' },
    'assumption:taxRate':        { selector: '#inp-taxRate',        type: 'input' },
    'assumption:costOfEquity':   { selector: '#inp-costOfEquity',   type: 'input' },
    'assumption:costOfDebt':     { selector: '#inp-costOfDebt',     type: 'input' },
  };

  const HIGHLIGHT_DURATION = 2200; // ms

  function handleFocus(e) {
    const target = e.detail && e.detail.target;
    if (!target) return;

    const mapping = FOCUS_MAP[target];
    if (!mapping) {
      console.log('[ChatFocus] Unknown target:', target);
      return;
    }

    const el = document.querySelector(mapping.selector);
    if (!el) {
      console.log('[ChatFocus] Element not found:', mapping.selector);
      return;
    }

    // Scroll into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (mapping.type === 'input') {
      highlightInput(el);
    } else if (mapping.type === 'row') {
      highlightRow(el);
    }
  }

  function highlightInput(inputEl) {
    // Highlight the input itself
    inputEl.classList.add('tutordcf-input-highlight');

    // Also highlight the parent .assumption-field row
    const fieldRow = inputEl.closest('.assumption-field');
    if (fieldRow) {
      fieldRow.classList.add('tutordcf-focus-highlight');
      fieldRow.style.position = 'relative';

      setTimeout(() => {
        fieldRow.classList.remove('tutordcf-focus-highlight');
      }, HIGHLIGHT_DURATION);
    }

    setTimeout(() => {
      inputEl.classList.remove('tutordcf-input-highlight');
    }, HIGHLIGHT_DURATION);
  }

  function highlightRow(rowEl) {
    rowEl.classList.add('tutordcf-row-highlight');

    setTimeout(() => {
      rowEl.classList.remove('tutordcf-row-highlight');
    }, HIGHLIGHT_DURATION);
  }

  // Listen for the custom event
  window.addEventListener('tutordcf:focus', handleFocus);

  console.log('[ChatFocus] Focus event listener registered.');
})();
