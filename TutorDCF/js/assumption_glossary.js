/* ============================================================
   Assumption Glossary — Tooltip & Guidance Content
   ==================================================
   Loaded before 07_assumptions_panel.js.
   Provides window.ASSUMPTION_HELP keyed by field.key.
============================================================ */

window.ASSUMPTION_HELP = {
  forecastYears: {
    label: "Forecast Years",
    tooltip: "Number of explicit years projected before applying the terminal value.",
    summary: [
      "Controls how long the model explicitly forecasts before terminal assumptions dominate.",
      "Longer horizons increase reliance on detailed operating assumptions."
    ],
    ranges: {
      general: "Typical range: 5 to 7 years (stable), 7 to 10 years (cyclical or transition).",
      tech: "Typical range: 5 to 7 years (scaled), 7 to 10 years (fast-changing business model)."
    },
    questions: [
      "Is the company in a stable phase or undergoing a transition that needs more explicit years?",
      "Do margins, reinvestment, or growth converge toward a steady state within this horizon?",
      "Would extending the horizon materially change terminal value reliance and credibility?",
      "Are you implicitly using the horizon to hide near-term volatility?",
      "Does the competitive and technology landscape change faster than your forecast horizon?",
      "Is there a known product cycle, capacity build, or regulation shift within the next 3 to 7 years?",
      "Will working capital and CapEx normalize within the horizon or remain in flux?",
      "If you shorten the horizon by 2 years, do results stay directionally consistent?",
      "If you lengthen the horizon by 2 years, are you still forecasting defensibly?"
    ],
    whereToLook: [
      "Review historical volatility and how long cycles typically last.",
      "Review management medium-term targets and strategy horizon.",
      "Review industry maturity and disruption pace."
    ]
  },
  currentPrice: {
    label: "Current Share Price",
    tooltip: "Latest market price per share used to compare implied value to the market.",
    summary: [
      "Anchors the valuation comparison and implied upside or downside.",
      "Use a clean, current reference point consistent with your other inputs."
    ],
    ranges: {
      general: "Sanity check: use a recent close or a short average if price is volatile.",
      tech: "Sanity check: consider a short average around earnings or major events if volatility is high."
    },
    questions: [
      "Is the price timestamp aligned with the financial statements and net debt date?",
      "Was there a recent earnings event or one-off headline distorting the price?",
      "Is the stock illiquid or unusually volatile, making a single print unreliable?",
      "Are you valuing on a specific date that needs consistency across inputs?",
      "Are there multiple share classes that affect the relevant price?",
      "Is there a large buyback or issuance that recently moved supply and demand?",
      "Are you using basic or diluted share count and does it match the price reference?",
      "Would a 30-day average change your conclusion materially?"
    ],
    whereToLook: [
      "Review recent price history and major event dates.",
      "Review earnings calendar and guidance updates.",
      "Review share class details and liquidity."
    ]
  },
  revenueGrowth: {
    label: "Revenue Growth",
    tooltip: "Expected annual revenue increase used to project top-line over the forecast period.",
    summary: [
      "Sets the top-line trajectory that drives the entire operating model.",
      "Use a rate you can defend with history, drivers, and market reality."
    ],
    ranges: {
      general: "Typical range: 2% to 8% (mature), 8% to 15% (growing).",
      tech: "Typical range: 5% to 15% (scaled), 15% to 30% (high growth)."
    },
    questions: [
      "What is the 3 to 5 year historical CAGR and what drove deviations?",
      "Are you forecasting share gains, pricing, volume, or mix and which is dominant?",
      "Does your growth imply realistic market share in the served market?",
      "Are you baking in a macro recovery or downturn and is it consistent with peers?",
      "Do you have capacity, headcount, or supply constraints that limit growth?",
      "How sensitive is valuation to growth versus margin or reinvestment changes?",
      "Does growth fade toward a steady state by the end of the forecast?",
      "Are there product launches, churn dynamics, or contract renewals that should shape the curve?",
      "If you haircut growth by 3 points, does the story still hold?",
      "If growth is high, what is the reinvestment needed to support it?"
    ],
    whereToLook: [
      "Review revenue history, segment growth, and geographic mix.",
      "Review management guidance and pipeline indicators.",
      "Compare to peer growth rates and consensus expectations.",
      "Review pricing, volume, churn, and retention metrics if disclosed."
    ]
  },
  ebitMargin: {
    label: "EBIT Margin",
    tooltip: "Operating profitability as EBIT divided by revenue, applied during projections.",
    summary: [
      "Drives operating income and cash generation, and is a core value lever.",
      "Margin assumptions must align with growth, mix, and reinvestment needs."
    ],
    ranges: {
      general: "Typical range: 8% to 20% (most sectors), 20%+ (high quality).",
      tech: "Typical range: 10% to 25% (scaled), 25% to 40% (best-in-class software)."
    },
    questions: [
      "What is the historical margin range and what explains the best and worst years?",
      "Are you assuming operating leverage and if so, what costs scale slower than revenue?",
      "Is gross margin stable and does it support your EBIT margin path?",
      "Are you implicitly assuming lower spend in R&D or sales and marketing?",
      "Does the margin converge toward peer levels and is that justified by moat and scale?",
      "If growth slows, does margin improve, hold, or deteriorate and why?",
      "Are there one-time items in history that should be normalized?",
      "Is stock-based compensation material and how does that affect comparability?",
      "Does your CapEx and working capital profile align with a margin expansion story?",
      "If you reduce margin by 3 points, how does implied value change?"
    ],
    whereToLook: [
      "Review margin bridges, cost structure, and fixed versus variable costs.",
      "Compare margins to peers and to the company's own peak margin years.",
      "Review management targets and efficiency initiatives.",
      "Review gross margin, operating expense ratios, and SBC disclosure."
    ]
  },
  taxRate: {
    label: "Tax Rate",
    tooltip: "Effective tax rate applied to EBIT to estimate after-tax operating profit.",
    summary: [
      "Impacts after-tax operating income and free cash flow directly.",
      "Use a sustainable rate that reflects geography and normal conditions."
    ],
    ranges: {
      general: "Typical range: 20% to 28% depending on jurisdiction and mix.",
      tech: "Typical range: 15% to 25% if international mix is favorable, otherwise 20% to 28%."
    },
    questions: [
      "What is the multi-year effective tax rate average and why did it fluctuate?",
      "Are there NOLs, credits, or one-time tax items that will roll off?",
      "Is there a meaningful geographic profit mix shift in your forecast?",
      "Are you using a cash tax rate or accounting effective tax rate?",
      "Does the company benefit from special regimes or incentives and are they durable?",
      "Are there pending tax law changes relevant to the company's footprint?",
      "Are you modeling any discrete items that should not recur?",
      "If the company matures, does the tax rate drift toward statutory levels?"
    ],
    whereToLook: [
      "Review tax footnote and effective tax rate reconciliation.",
      "Review geographic revenue and profit mix disclosures.",
      "Review NOL and deferred tax asset disclosures."
    ]
  },
  capexPct: {
    label: "CapEx (% Rev)",
    tooltip: "Capital spending as a percent of revenue, used to estimate reinvestment needs.",
    summary: [
      "Captures reinvestment required to sustain growth and operations.",
      "Too low can inflate value by understating the cost to grow."
    ],
    ranges: {
      general: "Typical range: 2% to 6% asset-light, 6% to 12% asset-heavy.",
      tech: "Typical range: 2% to 5% software, 5% to 10% infra and hardware-heavy."
    },
    questions: [
      "What is the historical CapEx as percent of revenue and what drove spikes?",
      "Is CapEx currently elevated due to expansion and does it normalize later?",
      "Are you separating maintenance CapEx from growth CapEx conceptually?",
      "Does your growth rate require higher CapEx, data centers, stores, or equipment?",
      "Are you ignoring capitalized software or other capitalization policies?",
      "How does depreciation compare to CapEx and is the gap reasonable?",
      "Does CapEx intensity differ by segment and is mix shifting?",
      "If CapEx rises 2 points, does the valuation thesis change?",
      "Are there known capacity projects or strategic investments planned?",
      "Are leases substituting for CapEx, shifting cash outflows elsewhere?"
    ],
    whereToLook: [
      "Review CapEx in cash flows and CapEx notes in filings.",
      "Compare CapEx intensity to peers and to the company's reinvestment cycle.",
      "Review depreciation trends and management commentary on investment."
    ]
  },
  nwcPct: {
    label: "NWC Change (% Rev)",
    tooltip: "Annual change in net working capital as a percent of revenue, affecting cash conversion.",
    summary: [
      "Measures how much cash is tied up in receivables, inventory, and payables as the business grows.",
      "Small changes can materially impact free cash flow."
    ],
    ranges: {
      general: "Typical range: 0% to 3% of revenue depending on working capital model.",
      tech: "Typical range: negative to 2% if deferred revenue helps, otherwise 0% to 2%."
    },
    questions: [
      "Is the company historically a source or use of working capital as it grows?",
      "Are receivables days stable and do you expect customer terms to change?",
      "Are inventory dynamics relevant or minimal for this business model?",
      "Are payables being stretched and is that sustainable?",
      "Does growth require more working capital or does deferred revenue offset it?",
      "Are there one-time working capital movements in the base year?",
      "Is seasonality material and does annual data hide swings?",
      "If NWC use increases by 1 point, how much does FCF drop?",
      "Do peers show structurally different working capital profiles?",
      "Are you consistent with margin and growth assumptions, since they drive billing and procurement?"
    ],
    whereToLook: [
      "Review change in NWC in cash flows and working capital line items.",
      "Review receivables, inventory, payables days trends.",
      "Review deferred revenue and contract liability disclosures."
    ]
  },
  costOfEquity: {
    label: "Cost of Equity",
    tooltip: "Expected return required by equity investors, often estimated using CAPM inputs.",
    summary: [
      "Higher cost of equity raises discount rate and lowers present value.",
      "Anchor to risk, leverage, and peer benchmarks rather than a gut feel."
    ],
    ranges: {
      general: "Typical range: 8% to 12% for stable large caps, 12% to 16% for higher risk.",
      tech: "Typical range: 9% to 13% for scaled, 13% to 18% for higher beta or earlier stage."
    },
    questions: [
      "What beta assumption are you using and does it match peers and history?",
      "Is the company small, cyclical, or concentrated enough to justify a size or risk premium?",
      "Are you using a reasonable equity risk premium for the market and region?",
      "Does leverage amplify equity risk relative to unlevered peers?",
      "How sensitive is value to a 100 bps change in cost of equity?",
      "Is the business model exposed to regulatory, commodity, or platform risks?",
      "Are you mixing currencies and risk-free rates consistently?",
      "Does the implied cost of equity align with observed returns in comparable assets?"
    ],
    whereToLook: [
      "Compare beta and cost of equity to peers and sector references.",
      "Review business risk drivers, cyclicality, and revenue concentration.",
      "Review capital structure and leverage stability."
    ]
  },
  costOfDebt: {
    label: "Cost of Debt",
    tooltip: "Effective borrowing rate on company debt before tax, based on credit risk and market rates.",
    summary: [
      "Drives after-tax interest cost in WACC and reflects credit risk.",
      "Use current borrowing reality, not stale historical coupons."
    ],
    ranges: {
      general: "Typical range: 4% to 7% investment grade, 7% to 11% sub-investment grade.",
      tech: "Typical range: 4% to 7% strong balance sheet, 7% to 12% if levered or speculative."
    },
    questions: [
      "What is the company's current credit profile and implied spread versus risk-free?",
      "Are current rates materially different from historical interest expense?",
      "Does the debt stack include secured, unsecured, convertibles, or leases with different costs?",
      "Is the company refinancing soon, changing the marginal cost of debt?",
      "Are you using pre-tax cost of debt and then applying the tax shield correctly?",
      "How sensitive is valuation to a 100 bps change in cost of debt?",
      "Is debt fixed or floating and how does that impact forward cost?",
      "Are there covenants or liquidity risks that raise the true cost of borrowing?"
    ],
    whereToLook: [
      "Review debt footnotes, maturities, and interest rate mix.",
      "Review credit ratings or leverage-based peer spreads.",
      "Review recent bond yields, loan pricing, and refinancing commentary."
    ]
  },
  equityWeight: {
    label: "Equity Weight",
    tooltip: "Proportion of enterprise financing attributed to equity in the WACC calculation.",
    summary: [
      "Sets the capital structure assumption used to blend cost of equity and debt.",
      "Should reflect a sustainable target structure, not a temporary snapshot."
    ],
    ranges: {
      general: "Typical range: 60% to 90% equity for many corporates.",
      tech: "Typical range: 70% to 95% equity for asset-light, lower leverage norms."
    },
    questions: [
      "Is the current capital structure stable or distorted by recent events?",
      "Is management targeting a leverage range that differs from today?",
      "Do peers operate with meaningfully different leverage norms?",
      "Would the business reasonably carry more debt without impairing flexibility?",
      "Are you implicitly double-counting risk by using high leverage and high cost of equity?",
      "Does your debt weight align with the company's rating goals or covenant limits?",
      "If you move weights by 10 points, does your conclusion change?",
      "Is market value weighting more appropriate than book value here?"
    ],
    whereToLook: [
      "Review peer capital structures and leverage targets.",
      "Review management commentary on leverage and credit rating priorities.",
      "Review historical leverage stability across cycles."
    ]
  },
  debtWeight: {
    label: "Debt Weight",
    tooltip: "Proportion of enterprise financing attributed to debt in the WACC calculation.",
    summary: [
      "Sets the leverage contribution in WACC and affects the tax shield impact.",
      "Must be coherent with credit risk, cash flow stability, and sector norms."
    ],
    ranges: {
      general: "Typical range: 10% to 40% debt for many corporates.",
      tech: "Typical range: 5% to 30% debt depending on stability and cash richness."
    },
    questions: [
      "Does the business have stable enough cash flows to support this debt weight?",
      "Would this leverage push the company into a different credit category?",
      "Are peers using more or less leverage and why?",
      "Is there hidden leverage via leases or off-balance-sheet commitments?",
      "Are you modeling an optimal structure or the current structure?",
      "Does the tax shield assumption make sense given profitability and tax profile?",
      "If rates rise, does this leverage remain sustainable?",
      "Are you relying on leverage to force a valuation outcome?"
    ],
    whereToLook: [
      "Review leverage ratios, coverage, and covenant headroom.",
      "Review lease commitments and other fixed obligations.",
      "Compare to peer leverage norms and rating thresholds."
    ]
  },
  wacc: {
    label: "WACC (override)",
    tooltip: "Directly sets the discount rate used for present value, bypassing component inputs.",
    summary: [
      "Useful for forcing a known discount rate, but can hide inconsistency.",
      "If you override, ensure it matches implied risk and capital structure."
    ],
    ranges: {
      general: "Typical range: 7% to 11% for stable, 11% to 15% for higher risk.",
      tech: "Typical range: 8% to 12% for scaled, 12% to 16% for higher beta."
    },
    questions: [
      "Why are you overriding instead of letting components determine WACC?",
      "Does the override align with your cost of equity and cost of debt inputs?",
      "Is the override consistent with peer discount rates used in practice?",
      "Are you mixing currencies, inflation assumptions, or risk-free rates incorrectly?",
      "How sensitive is value to 100 bps changes around this WACC?",
      "Are you implicitly embedding a margin of safety via a higher WACC?",
      "Would a component-based WACC produce a meaningfully different result?",
      "Are you keeping WACC constant even if leverage changes materially?"
    ],
    whereToLook: [
      "Compare to peer WACC assumptions and implied discount rates.",
      "Review CAPM inputs and credit spread logic.",
      "Stress test valuation across a WACC range."
    ]
  },
  terminalGrowth: {
    label: "Terminal Growth Rate",
    tooltip: "Perpetual growth rate used to estimate value beyond the explicit forecast period.",
    summary: [
      "Strongly influences terminal value, often the largest valuation component.",
      "Must be consistent with long-run economic growth and company maturity."
    ],
    ranges: {
      general: "Typical range: 1.5% to 3.0% in developed markets.",
      tech: "Typical range: 2.0% to 4.0% if durable tailwinds, otherwise 1.5% to 3.0%."
    },
    questions: [
      "Is the business mature enough to justify a steady perpetual growth rate?",
      "Does terminal growth exceed long-run nominal GDP assumptions?",
      "If growth is high, what prevents competitors from eroding returns?",
      "Does your terminal margin reflect steady-state competition and reinvestment?",
      "How much of enterprise value is coming from terminal value at this rate?",
      "If you reduce terminal growth by 50 bps, does the thesis still hold?",
      "Are you using a terminal growth rate inconsistent with your WACC level?",
      "Does the company face secular decline risk that should lower g?",
      "Does the company require ongoing reinvestment that reduces terminal cash flow?"
    ],
    whereToLook: [
      "Review long-run inflation and growth context for the operating region.",
      "Review industry maturity, disruption risk, and competitive intensity.",
      "Review long-term return on capital durability."
    ]
  },
  netDebt: {
    label: "Net Debt",
    tooltip: "Debt minus cash, used to bridge from enterprise value to equity value.",
    summary: [
      "Converts enterprise value into equity value and can swing implied price materially.",
      "Ensure the definition matches what is included in EV and cash flow."
    ],
    ranges: {
      general: "Sanity check: reconcile to latest balance sheet and include debt-like items consistently.",
      tech: "Sanity check: watch for large net cash positions and treatment of marketable securities."
    },
    questions: [
      "Is this net debt number aligned to the same date as your share price?",
      "Are you including leases, pensions, or other debt-like obligations?",
      "Are you excluding restricted cash or non-operating cash appropriately?",
      "Does the company hold marketable securities and how are they treated?",
      "Are there recent debt raises or repayments not captured in the base statements?",
      "Are you double counting interest-bearing liabilities already embedded elsewhere?",
      "Does the company have contingent liabilities or off-balance-sheet items?",
      "If net debt moves by 10%, does it change your conclusion meaningfully?"
    ],
    whereToLook: [
      "Review balance sheet debt and cash line items and footnotes.",
      "Review lease commitments and other financing-like obligations.",
      "Review subsequent events and recent financing announcements."
    ]
  },
  minorityInterest: {
    label: "Minority Interest",
    tooltip: "Non-controlling interest adjustment used when consolidating subsidiaries in enterprise value bridge.",
    summary: [
      "Prevents overstating equity value when financials include earnings not owned by shareholders.",
      "Include it when the income statement is consolidated but ownership is partial."
    ],
    ranges: {
      general: "Sanity check: include when material and consistent with how EV is defined.",
      tech: "Sanity check: watch for JV structures and partial ownership in key subsidiaries."
    },
    questions: [
      "Does the company consolidate subsidiaries with less than 100% ownership?",
      "Is minority interest material relative to enterprise value?",
      "Are there JVs where economics differ from accounting consolidation?",
      "Is minority interest already reflected in reported net debt definitions?",
      "Are you valuing operating assets that include non-owned portions?",
      "Has minority interest changed due to acquisitions or restructurings?",
      "Are there preferred securities or other quasi-equity claims misclassified?",
      "If you exclude it, are you overstating equity value?"
    ],
    whereToLook: [
      "Review equity section and non-controlling interest disclosures.",
      "Review consolidation notes and subsidiary ownership structure.",
      "Review M&A history and JV arrangements."
    ]
  },
  sharesOutstanding: {
    label: "Shares Outstanding",
    tooltip: "Number of shares used to convert equity value into implied value per share.",
    summary: [
      "Small share count differences can move implied price materially.",
      "Use a share count consistent with dilution and the valuation basis."
    ],
    ranges: {
      general: "Sanity check: prefer diluted shares if options and convertibles are material.",
      tech: "Sanity check: stock-based compensation can make dilution meaningful, consider diluted count."
    },
    questions: [
      "Are you using basic or diluted shares and why?",
      "Are options, RSUs, or convertibles material and should they be included?",
      "Is there an active buyback or issuance program changing the count?",
      "Are there multiple share classes with different economic rights?",
      "Is the share count aligned to the same date as net debt and price?",
      "Are you using a weighted average count or end-of-period count?",
      "Does the company have convertible debt that could increase shares at your implied price?",
      "If shares increase by 2% annually, how does that affect per-share value?"
    ],
    whereToLook: [
      "Review equity footnote and diluted EPS disclosures.",
      "Review SBC, option overhang, and convertibles.",
      "Review buyback authorizations and recent issuances."
    ]
  }
};
