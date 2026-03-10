/* ============================================================
   CHAT SCRIPTS ENGINE -- Scripted dialogue for TutorDCF chat
   ============================================================

   HOW TO ADD NEW SCRIPTED TOPICS
   --------------------------------
   1. Add a new entry to TOPIC_KEYWORDS with the topic key and
      an array of keyword strings that should trigger it.
   2. Add a matching entry in TUTOR_SCRIPTS[sector][topicKey] with
      an array of response template strings. Use {{placeholder}}
      tokens for dynamic dcf.state values (see formatMetric helper).
   3. Add entries in BULL_SCRIPTS and BEAR_SCRIPTS for the same
      topic key and sector.
   4. Optionally set a focus target in TOPIC_FOCUS[topicKey] to
      highlight the relevant UI element when the topic fires.

   HOW TO REGENERATE EMPLOYEE MANIFEST
   ------------------------------------
   Run:  node tools/generate_employees_manifest.js
   This scans employees/*.png and writes employees_manifest.js.

============================================================ */

// ======================================================================
// TOPIC KEYWORD ROUTER
// ======================================================================

const TOPIC_KEYWORDS = {
  revenueGrowth:  ['revenue', 'growth', 'top line', 'topline', 'sales', 'top-line'],
  margin:         ['margin', 'ebit', 'ebitda', 'profitability', 'operating margin', 'profit'],
  nwc:            ['nwc', 'working capital', 'net working capital', 'receivable', 'payable', 'inventory'],
  wacc:           ['wacc', 'discount rate', 'cost of capital', 'weighted average', 'cost of equity', 'cost of debt'],
  terminalGrowth: ['terminal', 'perpetuity', 'gordon growth', 'terminal growth', 'terminal value', 'tv'],
  impact:         ['impact', 'what changed', 'delta', 'moved', 'difference', 'snapshot'],
};

// Map topic -> assumption focus target for tutordcf:focus events
const TOPIC_FOCUS = {
  wacc:           'assumption:wacc',
  terminalGrowth: 'assumption:terminalGrowth',
  nwc:            'assumption:nwcPct',
  revenueGrowth:  'assumption:revenueGrowth',
};

// ======================================================================
// METRIC FORMATTING HELPERS
// ======================================================================

function _safe(val, fallback) {
  if (val === null || val === undefined || isNaN(val)) return fallback;
  return val;
}

function _fmtDollar(val) {
  const v = _safe(val, null);
  if (v === null) return 'N/A';
  if (Math.abs(v) >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  return '$' + v.toFixed(2);
}

function _fmtPct(val) {
  const v = _safe(val, null);
  if (v === null) return 'N/A';
  return (v * 100).toFixed(1) + '%';
}

function _fmtPctRaw(val) {
  const v = _safe(val, null);
  if (v === null) return 'N/A';
  return v.toFixed(1) + '%';
}

function _fmtPrice(val) {
  const v = _safe(val, null);
  if (v === null) return 'N/A';
  return '$' + v.toFixed(2);
}

/**
 * Build a context object with formatted metrics from dcf.state.
 */
function buildChatContext(dcfState) {
  const s   = dcfState || {};
  const inp = s.inputs || {};
  const sum = (s.dcf && s.dcf.summary) ? s.dcf.summary : {};
  const hist = s.historical || {};

  // Terminal value contribution %
  let tvPct = null;
  if (sum.pvTerminal && sum.enterpriseValue && sum.enterpriseValue !== 0) {
    tvPct = (sum.pvTerminal / sum.enterpriseValue * 100).toFixed(1) + '%';
  }

  // Revenue CAGR from historical if available
  let revCAGR = null;
  if (hist.metrics && hist.metrics.revenue && hist.years && hist.years.length >= 2) {
    const revs = hist.metrics.revenue;
    const first = revs[0];
    const last  = revs[revs.length - 1];
    const n = hist.years.length - 1;
    if (first > 0 && last > 0 && n > 0) {
      revCAGR = ((Math.pow(last / first, 1 / n) - 1) * 100).toFixed(1) + '%';
    }
  }

  return {
    impliedPrice:   _fmtPrice(sum.impliedPrice),
    ev:             _fmtDollar(sum.enterpriseValue),
    irr:            _fmtPct(sum.irr),
    wacc:           _fmtPctRaw(inp.wacc),
    terminalGrowth: _fmtPctRaw(inp.terminalGrowth),
    tvContribution: tvPct || 'N/A',
    revenueGrowth:  _fmtPctRaw(inp.revenueGrowth),
    ebitMargin:     _fmtPctRaw(inp.ebitMargin),
    nwcPct:         _fmtPctRaw(inp.nwcPct),
    capexPct:       _fmtPctRaw(inp.capexPct),
    taxRate:        _fmtPctRaw(inp.taxRate),
    revCAGR:        revCAGR || 'N/A',
    costOfEquity:   _fmtPctRaw(inp.costOfEquity),
    costOfDebt:     _fmtPctRaw(inp.costOfDebt),
    npvFCF:         _fmtDollar(sum.npvFCF),
    pvTerminal:     _fmtDollar(sum.pvTerminal),
    equityValue:    _fmtDollar(sum.equityValue),
  };
}

/**
 * Build delta context comparing current state vs session-start snapshot.
 */
function buildDeltaContext(dcfState) {
  const snap = dcfState && dcfState.__chatSessionStartSnapshot;
  if (!snap) return null;

  const cur = buildChatContext(dcfState);
  const old = buildChatContext(snap);

  const curSum = (dcfState.dcf && dcfState.dcf.summary) || {};
  const oldSum = (snap.dcf && snap.dcf.summary) || {};
  const curInp = dcfState.inputs || {};
  const oldInp = snap.inputs || {};

  const priceDelta = _safe(curSum.impliedPrice, 0) - _safe(oldSum.impliedPrice, 0);
  const evDelta    = _safe(curSum.enterpriseValue, 0) - _safe(oldSum.enterpriseValue, 0);

  return {
    cur, old,
    priceDelta:  priceDelta.toFixed(2),
    priceDir:    priceDelta > 0.01 ? 'up' : priceDelta < -0.01 ? 'down' : 'flat',
    evDelta:     _fmtDollar(evDelta),
    evDir:       evDelta > 0 ? 'up' : evDelta < 0 ? 'down' : 'flat',
    waccChanged: Math.abs(_safe(curInp.wacc, 0) - _safe(oldInp.wacc, 0)) > 0.01,
    tgChanged:   Math.abs(_safe(curInp.terminalGrowth, 0) - _safe(oldInp.terminalGrowth, 0)) > 0.01,
    revChanged:  Math.abs(_safe(curInp.revenueGrowth, 0) - _safe(oldInp.revenueGrowth, 0)) > 0.01,
    marginChanged: Math.abs(_safe(curInp.ebitMargin, 0) - _safe(oldInp.ebitMargin, 0)) > 0.01,
  };
}

// ======================================================================
// INTENT DETECTION
// ======================================================================

function detectIntent(userText) {
  const lower = (userText || '').toLowerCase().trim();
  if (!lower) return 'general';

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return topic;
    }
  }
  return 'general';
}

// ======================================================================
// SECTOR DETECTION
// ======================================================================

function detectSector(dcfState) {
  // Check if advanced assumptions has a sector setting
  if (dcfState && dcfState._sector) return dcfState._sector;
  // Check company name for tech indicators
  const company = (dcfState && dcfState.rawData && dcfState.rawData.company) || '';
  const lower = company.toLowerCase();
  const techKeywords = ['tech', 'software', 'saas', 'cloud', 'digital', 'ai', 'data', 'cyber', 'net', 'app'];
  if (techKeywords.some(kw => lower.includes(kw))) return 'tech';
  return 'general';
}

// ======================================================================
// SCRIPTED RESPONSES -- TUTOR MODE
// ======================================================================

const TUTOR_SCRIPTS = {
  general: {
    revenueGrowth: [
      "Your model assumes {{revenueGrowth}} revenue growth. Historically this company posted a {{revCAGR}} CAGR. The key question is whether that trajectory is sustainable or mean-reverting. Look at end-market sizing and competitive dynamics.",
      "At {{revenueGrowth}} growth, you are projecting a fairly {{_growthAdj}} trajectory. Cross-check against sell-side consensus and the company's own guidance. Revenue assumptions drive everything downstream in a DCF.",
      "Revenue growth at {{revenueGrowth}} sits as the single largest driver in this model. One sanity check: does this growth rate imply market share gains? If so, what is the competitive moat?",
    ],
    margin: [
      "EBIT margin is set at {{ebitMargin}}. That flows directly into NOPAT and ultimately FCF. Consider whether operating leverage supports margin expansion, or if rising SGA/R&D pressure brings it down over the forecast horizon.",
      "At {{ebitMargin}} EBIT margin, the model implies decent operating efficiency. Check if CapEx at {{capexPct}} of revenue is consistent with maintaining that margin level -- sometimes growth capex erodes near-term margins.",
      "Your margin assumption of {{ebitMargin}} drives the bulk of the cash flow profile. Compare it to the 3-year historical trend. If you are projecting expansion, articulate the specific lever (pricing, mix shift, cost reduction).",
    ],
    nwc: [
      "NWC at {{nwcPct}} of revenue is a commonly overlooked line item that can materially swing FCF. A rising NWC drains cash; a declining NWC boosts it. Check the historical DSO/DIO/DPO pattern to see if your assumption is anchored.",
      "Working capital at {{nwcPct}} of revenue. This is one of those assumptions that analysts often leave on auto-pilot. If the company is scaling rapidly, NWC intensity tends to increase. If mature, it should stabilize or improve.",
    ],
    wacc: [
      "WACC is currently {{wacc}}, built from a {{costOfEquity}} cost of equity and {{costOfDebt}} cost of debt. Every 50bp move in WACC shifts the valuation meaningfully. Make sure the equity risk premium and beta assumptions are defensible.",
      "At {{wacc}}, you are discounting future cash flows at a rate that implies moderate risk. Terminal value accounts for {{tvContribution}} of the total EV ({{ev}}). Higher WACC compresses that terminal value significantly.",
      "Your discount rate of {{wacc}} is the gatekeeper for the entire valuation. The implied share price is {{impliedPrice}}. Stress-test this -- a 100bp increase in WACC will give you a materially different equity story.",
    ],
    terminalGrowth: [
      "Terminal growth at {{terminalGrowth}} is a perpetuity assumption -- it implies the company grows at this rate forever. The spread between WACC ({{wacc}}) and terminal growth is what anchors terminal value. Keep terminal growth at or below long-run nominal GDP (2-3%).",
      "You have {{terminalGrowth}} terminal growth against a {{wacc}} WACC. The terminal value contributes {{tvContribution}} of your total EV. That is a large share. Narrowing the WACC-to-terminal-growth spread amplifies TV non-linearly.",
    ],
    impact: null, // handled specially
    general: [
      "Looking at this model: implied share price is {{impliedPrice}} on an EV of {{ev}}. The IRR comes out to {{irr}}. Walk me through any specific assumption you want to pressure-test.",
      "Here is the snapshot: EV at {{ev}}, equity per share at {{impliedPrice}}, with a {{wacc}} WACC and {{terminalGrowth}} terminal growth. Terminal value is {{tvContribution}} of EV. Which lever do you want to dig into?",
      "The model looks internally consistent. Revenue growth at {{revenueGrowth}}, margins at {{ebitMargin}}, WACC at {{wacc}}. The implied price is {{impliedPrice}}. Want to walk through any of these in more detail?",
    ],
  },
  tech: {
    revenueGrowth: [
      "For a tech company, {{revenueGrowth}} revenue growth needs context around the Rule of 40 (growth + margin). Historical CAGR was {{revCAGR}}. High-growth tech names often decelerate -- model that deceleration curve explicitly.",
      "At {{revenueGrowth}} growth, check whether this is organic or includes M&A. Tech companies often use acquisitions to sustain topline. Organic growth rates are what matter for a standalone DCF.",
    ],
    margin: [
      "Tech EBIT margin at {{ebitMargin}} -- does this assume operating leverage from scaling? SaaS businesses typically see gross margins above 70%, but operating margins depend heavily on R&D and sales efficiency. Your CapEx at {{capexPct}} seems {{_capexAdj}} for tech.",
      "At {{ebitMargin}} operating margin, consider the software gross margin profile. If this is a platform business, operating leverage should drive margin expansion over the forecast. If services-heavy, margins stay flatter.",
    ],
    nwc: [
      "NWC at {{nwcPct}} of revenue for a tech company is worth scrutinizing. SaaS companies with annual prepaid contracts often have negative NWC (deferred revenue exceeds receivables). That is a cash flow tailwind you should capture.",
      "Working capital dynamics in tech differ from traditional industries. At {{nwcPct}}, check if deferred revenue is properly netted. Subscription businesses often generate cash before recognizing revenue.",
    ],
    wacc: [
      "WACC at {{wacc}} for a tech name. Growth-stage tech typically commands a higher cost of equity due to elevated beta and lower debt capacity. Your cost of equity at {{costOfEquity}} -- is the beta calibrated to the right peer set?",
      "Discount rate of {{wacc}} with {{costOfEquity}} cost of equity. Tech companies often have minimal debt, so equity dominates the capital structure. Make sure the CAPM inputs reflect the actual risk profile of this name.",
    ],
    terminalGrowth: [
      "Terminal growth at {{terminalGrowth}} for tech -- be careful here. Even dominant tech platforms mean-revert over very long horizons. Analysts sometimes use exit multiples instead of Gordon Growth for tech DCFs. Your TV is {{tvContribution}} of EV.",
      "At {{terminalGrowth}} terminal growth, you are assuming perpetual growth above (or at) GDP. For tech, that can be defensible if there is network effects or platform lock-in. But the spread to WACC ({{wacc}}) is what really matters for TV.",
    ],
    impact: null,
    general: [
      "Tech DCF: implied price {{impliedPrice}}, EV of {{ev}}, IRR at {{irr}}. Revenue growth at {{revenueGrowth}} with {{ebitMargin}} EBIT margin. For a tech name, the revenue durability and margin trajectory are the two biggest swing factors.",
      "Looking at a tech DCF with {{wacc}} WACC and {{terminalGrowth}} terminal growth. Terminal value is {{tvContribution}} of EV, which is typical for high-growth tech. Want to dig into unit economics or discount rate?",
    ],
  },
};

const BULL_SCRIPTS = {
  general: {
    revenueGrowth: [
      "I am constructive on the topline. At {{revenueGrowth}} growth, there is room for upside if the company executes on its pipeline. Historical CAGR of {{revCAGR}} shows the growth engine is intact. Operating leverage should amplify revenue gains into margin expansion.",
      "Revenue growth at {{revenueGrowth}} is achievable and potentially conservative. The addressable market is expanding, and this company has a defensible position. I would argue the risk is to the upside on topline.",
    ],
    margin: [
      "EBIT margin at {{ebitMargin}} has room to expand. As revenue scales, fixed cost absorption improves. We have seen this playbook work -- operating leverage is real. The FCF profile should inflect positively over the forecast period.",
      "At {{ebitMargin}}, the margin profile is solid. With CapEx at {{capexPct}} of revenue, the company is investing in growth while maintaining discipline. I expect margin tailwinds from mix shift and pricing power.",
    ],
    nwc: [
      "NWC at {{nwcPct}} of revenue is manageable. As the business matures, working capital efficiency typically improves through better inventory management and stronger payment terms with suppliers. This is a FCF tailwind.",
      "Working capital at {{nwcPct}} -- I see opportunity here. Companies at this stage often optimize their cash conversion cycle. Better receivables collection and leaner inventory could drive NWC down, boosting free cash flow.",
    ],
    wacc: [
      "WACC at {{wacc}} may be overstating the risk. If the company de-levers or if market risk premiums compress, the effective discount rate drops. A lower WACC would meaningfully lift the implied valuation from the current {{impliedPrice}}.",
      "I think {{wacc}} is arguably on the high side. The cost of equity at {{costOfEquity}} assumes elevated risk, but if execution improves and earnings visibility rises, the market will reward that with a lower required return.",
    ],
    terminalGrowth: [
      "Terminal growth at {{terminalGrowth}} is reasonable and potentially conservative. This company has durable competitive advantages that could sustain above-GDP growth in perpetuity. The WACC-terminal-growth spread provides a margin of safety.",
      "At {{terminalGrowth}} terminal growth, the terminal value contributes {{tvContribution}} of EV. That is typical. If anything, a case can be made for a slightly higher perpetuity rate given the company's market position and secular tailwinds.",
    ],
    impact: null,
    general: [
      "The bull case is compelling. At {{impliedPrice}} implied price with {{irr}} IRR, there is meaningful upside. Revenue growth at {{revenueGrowth}} is supported by market expansion, and margins at {{ebitMargin}} have room to run with operating leverage.",
      "I am constructive here. EV of {{ev}} on a {{wacc}} WACC feels reasonable to conservative. The cash flow profile improves over the forecast, and the terminal value at {{tvContribution}} of EV is well-anchored.",
    ],
  },
  tech: {
    revenueGrowth: [
      "For tech, {{revenueGrowth}} growth is the baseline. The digital transformation tailwind is multi-year. Historical CAGR of {{revCAGR}} validates the trajectory. Network effects and switching costs protect the topline.",
      "Revenue growth at {{revenueGrowth}} -- I see upside. Tech platforms compound. Customer acquisition costs decline at scale while lifetime value increases. The growth flywheel is intact.",
    ],
    margin: [
      "Tech at {{ebitMargin}} EBIT margin is poised for expansion. Software businesses have near-zero marginal cost of delivery. As the install base grows, operating leverage kicks in aggressively. This could surprise to the upside.",
    ],
    nwc: [
      "NWC at {{nwcPct}} for tech is a positive signal. Subscription businesses collect upfront, creating negative working capital dynamics. This is a structural cash flow advantage that the market often underappreciates.",
    ],
    wacc: [
      "WACC at {{wacc}} for a tech name with this growth profile feels elevated. As the business matures and cash flows become more predictable, the risk premium should compress. Lower WACC would drive significant upside to the {{impliedPrice}} implied price.",
    ],
    terminalGrowth: [
      "Terminal growth at {{terminalGrowth}} for a tech platform with network effects could be conservative. Digital businesses can sustain above-GDP growth longer than traditional companies. The terminal value at {{tvContribution}} of EV is reasonable.",
    ],
    impact: null,
    general: [
      "The bull case for this tech name is strong. {{impliedPrice}} implied price at {{irr}} IRR. Revenue compounding at {{revenueGrowth}} with expanding margins at {{ebitMargin}}. Platform economics support durable value creation.",
    ],
  },
};

const BEAR_SCRIPTS = {
  general: {
    revenueGrowth: [
      "I am skeptical on {{revenueGrowth}} growth. Competition is intensifying and the addressable market may be more saturated than bulls assume. The historical CAGR of {{revCAGR}} benefited from a favorable cycle that may not repeat. I would haircut this by 200-300bp.",
      "Revenue growth at {{revenueGrowth}} assumes strong execution, but execution risk is real. Customer concentration, pricing pressure, and macro headwinds could all compress the topline. I would model a deceleration curve.",
    ],
    margin: [
      "EBIT margin at {{ebitMargin}} is optimistic. Input costs are rising, competitive pressure limits pricing power, and the company needs to invest to maintain its position. I would expect margin compression, not expansion, over the forecast.",
      "At {{ebitMargin}} margin, the model assumes efficiency gains that may not materialize. If revenue disappoints, fixed cost deleverage kicks in and margins contract. The downside scenario on margins is asymmetric.",
    ],
    nwc: [
      "NWC at {{nwcPct}} of revenue could be understated. If the company faces slower collections or needs to build inventory buffers, working capital could consume more cash than modeled. This is a hidden risk to FCF.",
      "Working capital at {{nwcPct}} -- I would flag this as a risk. Rapid growth often strains working capital. Receivables balloon, inventory builds up. The cash conversion cycle could deteriorate, dragging down free cash flow.",
    ],
    wacc: [
      "WACC at {{wacc}} may be too low given the risk profile. If credit spreads widen or the equity risk premium normalizes higher, the true cost of capital exceeds what is modeled. A 100bp higher WACC drops the implied price well below {{impliedPrice}}.",
      "I think the {{wacc}} discount rate understates risk. The cost of equity at {{costOfEquity}} assumes a beta that may not capture tail risk. In a downturn, this name trades with higher volatility than the model suggests.",
    ],
    terminalGrowth: [
      "Terminal growth at {{terminalGrowth}} is aggressive for a perpetuity assumption. Most companies mean-revert to GDP growth or below. The terminal value at {{tvContribution}} of EV means small changes here have outsized impact. I would stress-test at 1.5-2.0%.",
      "At {{terminalGrowth}} perpetuity growth, you are assuming the company outgrows the economy forever. That is a strong claim. Competitive dynamics, disruption risk, and regulatory pressure all argue for a more conservative terminal assumption.",
    ],
    impact: null,
    general: [
      "The bear case: implied price of {{impliedPrice}} with {{irr}} IRR assumes everything goes right. Revenue at {{revenueGrowth}}, margins at {{ebitMargin}} -- these are best-case assumptions. Downside risk is not being priced in. The terminal value at {{tvContribution}} of EV is heavily reliant on a {{terminalGrowth}} perpetuity rate.",
      "I would push back on this valuation. EV of {{ev}} on a {{wacc}} WACC feels generous. The model does not adequately discount execution risk, competitive headwinds, or macro sensitivity. Stress the WACC higher and the growth rate lower.",
    ],
  },
  tech: {
    revenueGrowth: [
      "Tech at {{revenueGrowth}} growth -- this assumes the growth premium persists. But tech valuations get punished hardest when growth decelerates. The historical CAGR of {{revCAGR}} may reflect a peak cycle, not the new normal.",
      "Revenue growth at {{revenueGrowth}} for tech -- I would flag the law of large numbers. As the revenue base scales, maintaining this growth rate requires increasingly large absolute dollar gains. That gets harder every year.",
    ],
    margin: [
      "Tech EBIT at {{ebitMargin}} -- be cautious. Competition for talent drives R&D costs higher. Customer acquisition costs are rising across the sector. The margin expansion story requires sustained topline growth that may not materialize.",
    ],
    nwc: [
      "NWC at {{nwcPct}} for tech -- even with deferred revenue tailwinds, growth-stage tech companies can see working capital pressure from sales commissions, prepaid hosting costs, and vendor deposits. Do not assume this stays benign.",
    ],
    wacc: [
      "WACC at {{wacc}} for tech is arguably low. Tech betas often understate true risk because they are measured during bull markets. In a risk-off environment, this name's cost of capital spikes. Model the stress case.",
    ],
    terminalGrowth: [
      "Terminal growth at {{terminalGrowth}} for tech -- disruption cuts both ways. Today's platform leader can be tomorrow's legacy system. A 20-year DCF horizon in tech is speculative. The terminal value at {{tvContribution}} of EV carries enormous uncertainty.",
    ],
    impact: null,
    general: [
      "Bear case on this tech DCF: {{impliedPrice}} implied price assumes perfect execution. At {{revenueGrowth}} growth and {{ebitMargin}} margins, there is no margin for error. Tech multiples are compressing, and the {{wacc}} WACC does not capture the full risk.",
    ],
  },
};

// ======================================================================
// GREETING / OPENING SCRIPTS
// ======================================================================

const TUTOR_GREETINGS = [
  "Good to connect. I have your model pulled up -- implied share price at {{impliedPrice}}, EV of {{ev}}, IRR at {{irr}}. What would you like to walk through?",
  "I am looking at the model now. Key metrics: {{impliedPrice}} implied price, {{wacc}} WACC, {{terminalGrowth}} terminal growth. Terminal value is {{tvContribution}} of EV. Where do you want to start?",
  "Hi, I have the DCF open. Quick overview: EV at {{ev}}, equity per share at {{impliedPrice}}. Revenue growth at {{revenueGrowth}} with {{ebitMargin}} EBIT margin. What is on your mind?",
];

const CONFERENCE_GREETINGS = {
  bull: [
    "Let me start with the constructive case. At {{impliedPrice}} implied price and {{irr}} IRR, I see meaningful upside. The growth profile at {{revenueGrowth}} is supported by strong fundamentals, and margins at {{ebitMargin}} have room to expand.",
    "I like what I see in this model. EV of {{ev}} on {{revenueGrowth}} growth -- the market is underappreciating the cash flow trajectory. Implied price of {{impliedPrice}} with room to run.",
  ],
  bear: [
    "Let me push back. The implied price of {{impliedPrice}} assumes a lot goes right. Revenue at {{revenueGrowth}} is aggressive, and the {{wacc}} WACC does not fully capture downside risk. Terminal value at {{tvContribution}} of EV is a large bet on perpetuity assumptions.",
    "I am more cautious. At {{ev}} enterprise value, the model is pricing in optimistic execution. The {{ebitMargin}} margin assumption needs scrutiny, and {{terminalGrowth}} terminal growth is generous for a perpetuity.",
  ],
};

// ======================================================================
// IMPACT ANALYSIS RESPONSE BUILDER
// ======================================================================

function buildImpactResponse(dcfState, role) {
  const delta = buildDeltaContext(dcfState);
  if (!delta) {
    return "No session snapshot available. I cannot compute the impact since the call started. Try adjusting an assumption first.";
  }

  const parts = [];

  if (delta.priceDir === 'flat' && delta.evDir === 'flat') {
    parts.push("No material change since we started this call. The model inputs appear unchanged.");
    return parts.join(' ');
  }

  const dirWord = delta.priceDir === 'up' ? 'increased' : 'decreased';
  parts.push(`Since we started, the implied share price has ${dirWord} by $${Math.abs(parseFloat(delta.priceDelta)).toFixed(2)} (from ${delta.old.impliedPrice} to ${delta.cur.impliedPrice}). EV moved ${delta.evDir} by ${delta.evDelta}.`);

  const drivers = [];
  if (delta.waccChanged) drivers.push(`WACC shifted from ${delta.old.wacc} to ${delta.cur.wacc}`);
  if (delta.tgChanged) drivers.push(`terminal growth moved from ${delta.old.terminalGrowth} to ${delta.cur.terminalGrowth}`);
  if (delta.revChanged) drivers.push(`revenue growth changed from ${delta.old.revenueGrowth} to ${delta.cur.revenueGrowth}`);
  if (delta.marginChanged) drivers.push(`EBIT margin went from ${delta.old.ebitMargin} to ${delta.cur.ebitMargin}`);

  if (drivers.length > 0) {
    parts.push('Key drivers: ' + drivers.join('; ') + '.');
  }

  // Role-specific color
  if (role === 'bull') {
    if (delta.priceDir === 'up') {
      parts.push("This supports the constructive thesis. The revised assumptions strengthen the upside case.");
    } else {
      parts.push("The price moved down, but I would argue the fundamentals are still intact. This may be an opportunity to revisit growth or discount rate assumptions.");
    }
  } else if (role === 'bear') {
    if (delta.priceDir === 'down') {
      parts.push("This aligns with the cautious view. The revised inputs reveal downside risk that was previously masked.");
    } else {
      parts.push("Price moved up, but I remain skeptical. Check whether the new assumptions are defensible under stress conditions.");
    }
  }

  return parts.join(' ');
}

// ======================================================================
// TEMPLATE INTERPOLATION
// ======================================================================

function interpolateTemplate(template, ctx) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    // Special computed adjectives
    if (key === '_growthAdj') {
      const raw = parseFloat(ctx.revenueGrowth);
      if (isNaN(raw)) return 'moderate';
      return raw > 15 ? 'aggressive' : raw > 8 ? 'moderate' : raw > 3 ? 'modest' : 'conservative';
    }
    if (key === '_capexAdj') {
      const raw = parseFloat(ctx.capexPct);
      if (isNaN(raw)) return 'typical';
      return raw > 15 ? 'heavy' : raw > 8 ? 'moderate' : 'light';
    }
    return ctx[key] !== undefined ? ctx[key] : match;
  });
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ======================================================================
// PUBLIC API
// ======================================================================

/**
 * Get a tutor response for the given user text and state.
 * Returns { text: string, focus?: string }
 */
function getTutorResponse(userText, dcfState, context) {
  const intent = detectIntent(userText);
  const sector = detectSector(dcfState);
  const ctx    = buildChatContext(dcfState);

  // Impact analysis
  if (intent === 'impact') {
    return { text: buildImpactResponse(dcfState, 'tutor') };
  }

  // Pick sector scripts, fall back to general
  const sectorScripts = TUTOR_SCRIPTS[sector] || TUTOR_SCRIPTS.general;
  const topicScripts  = sectorScripts[intent] || sectorScripts.general || TUTOR_SCRIPTS.general.general;

  const template = pickRandom(topicScripts);
  if (!template) {
    return { text: "Interesting question. Walk me through your specific concern and I will dig into the numbers." };
  }

  const text  = interpolateTemplate(template, ctx);
  const focus = TOPIC_FOCUS[intent] || null;

  return { text, focus };
}

/**
 * Get a conference call turn for the given role (bull/bear).
 * Returns { text: string, focus?: string }
 */
function getConferenceTurn(role, userText, dcfState, context) {
  const intent = detectIntent(userText);
  const sector = detectSector(dcfState);
  const ctx    = buildChatContext(dcfState);

  // Impact analysis
  if (intent === 'impact') {
    return { text: buildImpactResponse(dcfState, role) };
  }

  const scripts = role === 'bull' ? BULL_SCRIPTS : BEAR_SCRIPTS;
  const sectorScripts = scripts[sector] || scripts.general;
  const topicScripts  = sectorScripts[intent] || sectorScripts.general || scripts.general.general;

  const template = pickRandom(topicScripts);
  if (!template) {
    const fallback = role === 'bull'
      ? "I remain constructive. The risk-reward here is favorable."
      : "I remain cautious. The downside risks are underappreciated.";
    return { text: fallback };
  }

  const text  = interpolateTemplate(template, ctx);
  const focus = TOPIC_FOCUS[intent] || null;

  return { text, focus };
}

/**
 * Get a greeting message for session start.
 * mode: 'tutor' | 'conference'
 * role: 'bull' | 'bear' (only for conference)
 */
function getGreeting(mode, dcfState, role) {
  const ctx = buildChatContext(dcfState);

  if (mode === 'tutor') {
    const template = pickRandom(TUTOR_GREETINGS);
    return interpolateTemplate(template, ctx);
  }

  // Conference greeting
  const templates = CONFERENCE_GREETINGS[role] || CONFERENCE_GREETINGS.bull;
  const template  = pickRandom(templates);
  return interpolateTemplate(template, ctx);
}
