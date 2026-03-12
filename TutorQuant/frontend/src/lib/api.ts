/**
 * TutorQuant API client.
 *
 * Typed fetch wrapper for all backend endpoints. URLs match the FastAPI
 * router prefixes exactly (no /v1/ — that will be added when we version).
 */

/** API error with status code and message */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Typed API client for the TutorQuant backend */
export class TutorQuantApi {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:8000") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /** Internal fetch wrapper with error handling */
  private async request<T>(endpoint: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ApiError(
        response.status,
        `API error ${response.status}: ${errorBody}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /** Internal GET wrapper with error handling */
  private async requestGet<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ApiError(
        response.status,
        `API error ${response.status}: ${errorBody}`,
      );
    }

    return response.json() as Promise<T>;
  }

  // ── Option Pricing ───────────────────────────────────────────────

  /**
   * Price an option using the specified model.
   *
   * Backend expects snake_case fields matching OptionPricingRequest:
   *   { option: { spot, strike, expiry_years, option_type, exercise_style, dividend_yield },
   *     model, risk_free_rate, volatility, model_params? }
   */
  async priceOption(params: {
    spot: number;
    strike: number;
    expiryYears: number;
    optionType: "call" | "put";
    exerciseStyle?: "european" | "american";
    riskFreeRate: number;
    volatility: number;
    dividendYield?: number;
    model?: string;
    modelParams?: Record<string, unknown>;
  }): Promise<{
    price: number;
    model_used: string;
    computation_time_ms: number;
    metadata?: Record<string, unknown>;
  }> {
    return this.request("/api/options/price", {
      option: {
        spot: params.spot,
        strike: params.strike,
        expiry_years: params.expiryYears,
        option_type: params.optionType,
        exercise_style: params.exerciseStyle ?? "european",
        dividend_yield: params.dividendYield ?? 0,
      },
      model: params.model ?? "black_scholes",
      risk_free_rate: params.riskFreeRate,
      volatility: params.volatility,
      model_params: params.modelParams,
    });
  }

  // ── Greeks ───────────────────────────────────────────────────────

  async computeGreeks(params: {
    spot: number;
    strike: number;
    expiryYears: number;
    optionType: "call" | "put";
    riskFreeRate: number;
    volatility: number;
    dividendYield?: number;
    method?: "analytical" | "finite_difference";
  }): Promise<{
    delta: number;
    gamma: number;
    vega: number;
    theta: number;
    rho: number;
    vanna?: number;
    volga?: number;
    charm?: number;
    method_used: string;
    metadata?: Record<string, unknown>;
  }> {
    return this.request("/api/greeks/compute", {
      option: {
        spot: params.spot,
        strike: params.strike,
        expiry_years: params.expiryYears,
        option_type: params.optionType,
        exercise_style: "european",
        dividend_yield: params.dividendYield ?? 0,
      },
      model: "black_scholes",
      risk_free_rate: params.riskFreeRate,
      volatility: params.volatility,
      method: params.method ?? "analytical",
    });
  }

  // ── Monte Carlo ──────────────────────────────────────────────────

  async runMonteCarlo(params: {
    spot: number;
    strike: number;
    expiryYears: number;
    optionType: "call" | "put";
    riskFreeRate: number;
    volatility: number;
    dividendYield?: number;
    numPaths?: number;
    numSteps?: number;
    seed?: number | null;
    antithetic?: boolean;
  }): Promise<{
    price: number;
    std_error: number;
    confidence_interval_95: [number, number];
    paths: {
      representative_path: number[];
      path_fan: number[][];
      terminal_values: number[];
    };
    convergence: {
      running_mean: number[];
      running_std: number[];
      confidence_interval_95: [number, number];
    };
    computation_time_ms: number;
  }> {
    return this.request("/api/monte-carlo/simulate", {
      option: {
        spot: params.spot,
        strike: params.strike,
        expiry_years: params.expiryYears,
        option_type: params.optionType,
        exercise_style: "european",
        dividend_yield: params.dividendYield ?? 0,
      },
      risk_free_rate: params.riskFreeRate,
      volatility: params.volatility,
      simulation_config: {
        num_paths: params.numPaths ?? 1000,
        num_steps: params.numSteps ?? 252,
        seed: params.seed ?? null,
        antithetic: params.antithetic ?? true,
      },
      model: "gbm",
    });
  }

  // ── Model Comparison ────────────────────────────────────────────

  async compareModels(params: {
    spot: number;
    strike: number;
    expiryYears: number;
    optionType: "call" | "put";
    exerciseStyle?: "european" | "american";
    riskFreeRate: number;
    volatility: number;
    dividendYield?: number;
    models: string[];
    steps?: number;
  }): Promise<{
    results: {
      model: string;
      model_name: string;
      price: number;
      computation_time_ms: number;
      metadata?: Record<string, unknown>;
    }[];
    reference_model: string;
  }> {
    return this.request("/api/risk/model-comparison", {
      option: {
        spot: params.spot,
        strike: params.strike,
        expiry_years: params.expiryYears,
        option_type: params.optionType,
        exercise_style: params.exerciseStyle ?? "european",
        dividend_yield: params.dividendYield ?? 0,
      },
      risk_free_rate: params.riskFreeRate,
      volatility: params.volatility,
      models: params.models,
      steps: params.steps ?? 200,
    });
  }

  // ── P&L Explain ───────────────────────────────────────────────────

  async pnlExplain(params: {
    spot: number;
    strike: number;
    expiryYears: number;
    optionType: "call" | "put";
    riskFreeRate: number;
    volatility: number;
    dividendYield?: number;
    dS: number;
    dsigma: number;
    dt: number;
    positionSize?: number;
  }): Promise<{
    delta_pnl: number;
    gamma_pnl: number;
    vega_pnl: number;
    theta_pnl: number;
    total_greek_pnl: number;
    actual_pnl: number;
    unexplained: number;
    old_price: number;
    new_price: number;
    position_size: number;
    greeks: Record<string, number>;
    scenario: Record<string, number>;
  }> {
    return this.request("/api/risk/pnl-explain", {
      option: {
        spot: params.spot,
        strike: params.strike,
        expiry_years: params.expiryYears,
        option_type: params.optionType,
        exercise_style: "european",
        dividend_yield: params.dividendYield ?? 0,
      },
      risk_free_rate: params.riskFreeRate,
      volatility: params.volatility,
      dS: params.dS,
      dsigma: params.dsigma,
      dt: params.dt,
      position_size: params.positionSize ?? 1,
    });
  }

  // ── Scenario Grid ─────────────────────────────────────────────────

  async scenarioGrid(params: {
    spot: number;
    strike: number;
    expiryYears: number;
    optionType: "call" | "put";
    riskFreeRate: number;
    volatility: number;
    dividendYield?: number;
    spotShocks?: number[];
    volShocks?: number[];
  }): Promise<{
    spot_shocks: number[];
    vol_shocks: number[];
    pnl_grid: number[][];
    base_price: number;
  }> {
    return this.request("/api/risk/scenario-grid", {
      option: {
        spot: params.spot,
        strike: params.strike,
        expiry_years: params.expiryYears,
        option_type: params.optionType,
        exercise_style: "european",
        dividend_yield: params.dividendYield ?? 0,
      },
      risk_free_rate: params.riskFreeRate,
      volatility: params.volatility,
      spot_shocks: params.spotShocks,
      vol_shocks: params.volShocks,
    });
  }

  // ── Hedging Simulation ────────────────────────────────────────────

  async hedgingSim(params: {
    spot: number;
    strike: number;
    expiryYears: number;
    optionType: "call" | "put";
    riskFreeRate: number;
    volatility: number;
    dividendYield?: number;
    rebalanceSteps?: number;
    transactionCostRate?: number;
    numPaths?: number;
    seed?: number | null;
  }): Promise<{
    bsm_price: number;
    paths: {
      spot_path: number[];
      delta_path: number[];
      cash_path: number[];
      total_transaction_costs: number;
      final_hedge_error: number;
      option_payoff: number;
      hedge_portfolio_value: number;
    }[];
    summary: {
      mean_hedge_error: number;
      std_hedge_error: number;
      min_hedge_error: number;
      max_hedge_error: number;
    };
    rebalance_steps: number;
    transaction_cost_rate: number;
  }> {
    return this.request("/api/risk/hedging-sim", {
      option: {
        spot: params.spot,
        strike: params.strike,
        expiry_years: params.expiryYears,
        option_type: params.optionType,
        exercise_style: "european",
        dividend_yield: params.dividendYield ?? 0,
      },
      risk_free_rate: params.riskFreeRate,
      volatility: params.volatility,
      rebalance_steps: params.rebalanceSteps ?? 50,
      transaction_cost_rate: params.transactionCostRate ?? 0,
      num_paths: params.numPaths ?? 1,
      seed: params.seed ?? null,
    });
  }

  // ── Portfolio Analytics ───────────────────────────────────────────

  async analyzePortfolio(params: {
    positions: {
      instrument_id: string;
      instrument_type: string;
      quantity: number;
      side: string;
      spot: number;
      strike: number;
      expiry_years: number;
      option_type: string;
      dividend_yield?: number;
    }[];
    riskFreeRate: number;
    volatility: number;
    confidence?: number;
    holdingDays?: number;
    varMethod?: string;
    numScenarios?: number;
    seed?: number | null;
  }): Promise<{
    total_value: number;
    positions_valued: Record<string, unknown>[];
    risk_metrics: Record<string, number>;
    var: number;
    es: number;
    var_method: string;
    pnl_distribution?: number[];
    metadata?: Record<string, unknown>;
  }> {
    return this.request("/api/portfolio/analyze", {
      positions: params.positions,
      risk_free_rate: params.riskFreeRate,
      volatility: params.volatility,
      confidence: params.confidence ?? 0.95,
      holding_days: params.holdingDays ?? 1,
      var_method: params.varMethod ?? "parametric",
      num_scenarios: params.numScenarios ?? 10000,
      seed: params.seed ?? null,
    });
  }

  // ── Volatility Lab ──────────────────────────────────────────────

  /** Solve for BSM implied volatility from a market price */
  async solveImpliedVol(params: {
    spot: number;
    strike: number;
    expiryYears: number;
    marketPrice: number;
    riskFreeRate?: number;
    dividendYield?: number;
    optionType?: "call" | "put";
  }): Promise<{
    implied_vol: number;
    bsm_price: number;
    moneyness: number;
    log_moneyness: number;
    time_value: number;
    delta: number;
    gamma: number;
    vega: number;
    theta: number;
    rho: number;
    vanna: number;
    volga: number;
    charm: number;
  }> {
    return this.request("/api/volatility/implied-vol", {
      spot: params.spot,
      strike: params.strike,
      expiry_years: params.expiryYears,
      market_price: params.marketPrice,
      risk_free_rate: params.riskFreeRate ?? 0.05,
      dividend_yield: params.dividendYield ?? 0,
      option_type: params.optionType ?? "call",
    });
  }

  /** Generate a parametric demo IV surface */
  async demoSurface(params: {
    spot?: number;
    riskFreeRate?: number;
    dividendYield?: number;
    baseVol?: number;
    skewSlope?: number;
    smileCurvature?: number;
    termSlope?: number;
    expiries?: number[];
    strikes?: number[];
  }): Promise<{
    spot: number;
    risk_free_rate: number;
    dividend_yield: number;
    expiries: number[];
    strikes: number[];
    surface: {
      strike: number;
      expiry_years: number;
      implied_vol: number;
      market_price: number;
      option_type: string;
      moneyness: number;
      log_moneyness: number;
    }[];
  }> {
    return this.request("/api/volatility/demo-surface", {
      spot: params.spot ?? 100,
      risk_free_rate: params.riskFreeRate ?? 0.05,
      dividend_yield: params.dividendYield ?? 0,
      base_vol: params.baseVol ?? 0.20,
      skew_slope: params.skewSlope ?? -0.10,
      smile_curvature: params.smileCurvature ?? 0.05,
      term_slope: params.termSlope ?? 0.02,
      expiries: params.expiries,
      strikes: params.strikes,
    });
  }

  /** Get a single-expiry smile/skew slice */
  async smileSlice(params: {
    spot?: number;
    riskFreeRate?: number;
    dividendYield?: number;
    expiryYears?: number;
    baseVol?: number;
    skewSlope?: number;
    smileCurvature?: number;
    termSlope?: number;
    strikes?: number[];
  }): Promise<{
    expiry_years: number;
    strikes: number[];
    implied_vols: number[];
    moneyness: number[];
    spot: number;
  }> {
    return this.request("/api/volatility/smile-slice", {
      spot: params.spot ?? 100,
      risk_free_rate: params.riskFreeRate ?? 0.05,
      dividend_yield: params.dividendYield ?? 0,
      expiry_years: params.expiryYears ?? 0.25,
      base_vol: params.baseVol ?? 0.20,
      skew_slope: params.skewSlope ?? -0.10,
      smile_curvature: params.smileCurvature ?? 0.05,
      term_slope: params.termSlope ?? 0.02,
      strikes: params.strikes,
    });
  }

  /** Get ATM implied vol term structure */
  async termStructure(params: {
    spot?: number;
    riskFreeRate?: number;
    dividendYield?: number;
    baseVol?: number;
    skewSlope?: number;
    smileCurvature?: number;
    termSlope?: number;
    expiries?: number[];
  }): Promise<{
    expiries: number[];
    atm_vols: number[];
    spot: number;
  }> {
    return this.request("/api/volatility/term-structure", {
      spot: params.spot ?? 100,
      risk_free_rate: params.riskFreeRate ?? 0.05,
      dividend_yield: params.dividendYield ?? 0,
      base_vol: params.baseVol ?? 0.20,
      skew_slope: params.skewSlope ?? -0.10,
      smile_curvature: params.smileCurvature ?? 0.05,
      term_slope: params.termSlope ?? 0.02,
      expiries: params.expiries,
    });
  }

  /** Compute historical and EWMA volatility from a price series */
  async historicalVol(params: {
    prices: number[];
    window?: number;
    ewmaLambda?: number;
    annFactor?: number;
  }): Promise<{
    historical_vol: number;
    ewma_vol: number;
    rolling_indices: number[];
    rolling_vol: number[];
    ewma_indices: number[];
    ewma_vol_series: number[];
    log_returns: number[];
    ann_factor: number;
    window: number;
    ewma_lambda: number;
  }> {
    return this.request("/api/volatility/historical", {
      prices: params.prices,
      window: params.window ?? 21,
      ewma_lambda: params.ewmaLambda ?? 0.94,
      ann_factor: params.annFactor ?? 252,
    });
  }

  /** Compare realized vs implied volatility */
  async realizedVsImplied(params: {
    prices: number[];
    impliedVol: number;
    window?: number;
    annFactor?: number;
  }): Promise<{
    indices: number[];
    realized_vol: number[];
    implied_vol: number;
    mean_realized: number;
    vol_risk_premium: number;
  }> {
    return this.request("/api/volatility/realized-vs-implied", {
      prices: params.prices,
      implied_vol: params.impliedVol,
      window: params.window ?? 21,
      ann_factor: params.annFactor ?? 252,
    });
  }

  // ── Fixed Income ────────────────────────────────────────────────

  /** Comprehensive bond analytics: pricing, duration, convexity, DV01 */
  async bondAnalytics(params: {
    faceValue?: number;
    couponRate?: number;
    couponFrequency?: number;
    maturityYears?: number;
    ytm?: number;
    settlementOffset?: number;
  }): Promise<{
    dirty_price: number;
    clean_price: number;
    accrued_interest: number;
    ytm: number;
    macaulay_duration: number;
    modified_duration: number;
    convexity: number;
    dv01: number;
    cashflow_times: number[];
    cashflow_amounts: number[];
    n_remaining_coupons: number;
  }> {
    return this.request("/api/fixed-income/analytics", {
      face_value: params.faceValue ?? 100,
      coupon_rate: params.couponRate ?? 0.05,
      coupon_frequency: params.couponFrequency ?? 2,
      maturity_years: params.maturityYears ?? 10,
      ytm: params.ytm ?? 0.05,
      settlement_offset: params.settlementOffset ?? 0,
    });
  }

  /** Solve for YTM from a market dirty price */
  async solveYTM(params: {
    dirtyPrice: number;
    faceValue?: number;
    couponRate?: number;
    couponFrequency?: number;
    maturityYears?: number;
    settlementOffset?: number;
  }): Promise<{
    ytm: number;
    dirty_price: number;
    clean_price: number;
    accrued_interest: number;
    macaulay_duration: number;
    modified_duration: number;
    convexity: number;
    dv01: number;
  }> {
    return this.request("/api/fixed-income/ytm-solve", {
      dirty_price: params.dirtyPrice,
      face_value: params.faceValue ?? 100,
      coupon_rate: params.couponRate ?? 0.05,
      coupon_frequency: params.couponFrequency ?? 2,
      maturity_years: params.maturityYears ?? 10,
      settlement_offset: params.settlementOffset ?? 0,
    });
  }

  /** Generate price vs yield sensitivity data */
  async priceYieldCurve(params: {
    faceValue?: number;
    couponRate?: number;
    couponFrequency?: number;
    maturityYears?: number;
    settlementOffset?: number;
    yieldMin?: number;
    yieldMax?: number;
    nPoints?: number;
  }): Promise<{
    yields: number[];
    dirty_prices: number[];
    clean_prices: number[];
    face_value: number;
    coupon_rate: number;
  }> {
    return this.request("/api/fixed-income/price-yield-curve", {
      face_value: params.faceValue ?? 100,
      coupon_rate: params.couponRate ?? 0.05,
      coupon_frequency: params.couponFrequency ?? 2,
      maturity_years: params.maturityYears ?? 10,
      settlement_offset: params.settlementOffset ?? 0,
      yield_min: params.yieldMin ?? 0,
      yield_max: params.yieldMax ?? 0.15,
      n_points: params.nPoints ?? 50,
    });
  }

  /** Generate a demo yield curve and bootstrap zero rates */
  async demoCurve(params: {
    style?: string;
  }): Promise<{
    maturities: number[];
    par_rates: number[];
    zero_rates: number[];
    discount_factors: number[];
    forward_labels: string[];
    forward_rates: number[];
    description: string;
  }> {
    return this.request("/api/fixed-income/demo-curve", {
      style: params.style ?? "normal",
    });
  }

  /** Bootstrap a zero-rate curve from par bond yields */
  async bootstrapCurve(params: {
    parRates: number[];
    maturities: number[];
    couponFrequency?: number;
    faceValue?: number;
  }): Promise<{
    maturities: number[];
    zero_rates: number[];
    discount_factors: number[];
    par_rates: number[];
    forward_labels: string[];
    forward_rates: number[];
  }> {
    return this.request("/api/fixed-income/bootstrap-curve", {
      par_rates: params.parRates,
      maturities: params.maturities,
      coupon_frequency: params.couponFrequency ?? 2,
      face_value: params.faceValue ?? 100,
    });
  }

  /** Compare price-yield profiles of multiple bonds */
  async bondComparison(params: {
    bonds: {
      label: string;
      faceValue?: number;
      couponRate?: number;
      couponFrequency?: number;
      maturityYears?: number;
    }[];
    yieldMin?: number;
    yieldMax?: number;
    nPoints?: number;
  }): Promise<{
    series: {
      label: string;
      yields: number[];
      prices: number[];
      duration: number;
      convexity: number;
    }[];
  }> {
    return this.request("/api/fixed-income/bond-comparison", {
      bonds: params.bonds.map((b) => ({
        label: b.label,
        face_value: b.faceValue ?? 100,
        coupon_rate: b.couponRate ?? 0.05,
        coupon_frequency: b.couponFrequency ?? 2,
        maturity_years: b.maturityYears ?? 10,
      })),
      yield_min: params.yieldMin ?? 0,
      yield_max: params.yieldMax ?? 0.15,
      n_points: params.nPoints ?? 50,
    });
  }

  /** Legacy bond pricing endpoint */
  async priceBond(request: unknown): Promise<unknown> {
    return this.request("/api/fixed-income/price-bond", request);
  }

  // ── Interest Rate Models ────────────────────────────────────────

  /** Simulate short-rate paths under a chosen model */
  async simulateRates(params: {
    model: string;
    r0: number;
    params: Record<string, number>;
    horizonYears?: number;
    nPaths?: number;
    nSteps?: number;
    seed?: number | null;
  }): Promise<{
    model: string;
    times: number[];
    paths: number[][];
    mean_rate: number[];
    std_rate: number[];
    terminal_distribution: number[];
    metadata?: Record<string, unknown>;
  }> {
    return this.request("/api/rates/simulate", {
      model: params.model,
      r0: params.r0,
      params: params.params,
      horizon_years: params.horizonYears ?? 1.0,
      simulation_config: {
        num_paths: params.nPaths ?? 100,
        num_steps: params.nSteps ?? 252,
        seed: params.seed ?? null,
      },
    });
  }

  /** Get analytical yield curve implied by a rate model */
  async rateModelYieldCurve(params: {
    model: string;
    r0: number;
    params: Record<string, number>;
    maturities?: number[];
  }): Promise<{
    model: string;
    maturities: number[];
    bond_prices: number[];
    zero_rates: number[];
  }> {
    return this.request("/api/rates/yield-curve", {
      model: params.model,
      r0: params.r0,
      params: params.params,
      maturities: params.maturities ?? null,
    });
  }

  /** Get structured model comparison table */
  async getModelComparison(): Promise<{
    model_id: string;
    name: string;
    sde: string;
    mean_reversion: string;
    positivity: string;
    volatility_structure: string;
    analytical_bond_price: boolean;
    practical_intuition: string;
    common_use_cases: string;
    limitations: string;
    distribution: string;
  }[]> {
    const res = await this.requestGet<{
      models: {
        model_id: string;
        name: string;
        sde: string;
        mean_reversion: string;
        positivity: string;
        volatility_structure: string;
        analytical_bond_price: boolean;
        practical_intuition: string;
        common_use_cases: string;
        limitations: string;
        distribution: string;
      }[];
    }>("/api/rates/comparison");
    return res.models;
  }

  /** Compare yield curves from multiple models */
  async compareCurves(params: {
    r0: number;
    models: {
      model: string;
      params: Record<string, number>;
      label: string;
    }[];
    maturities?: number[];
  }): Promise<{
    series: {
      model: string;
      label: string;
      maturities: number[];
      bond_prices: number[];
      zero_rates: number[];
    }[];
  }> {
    return this.request("/api/rates/compare-curves", {
      r0: params.r0,
      models: params.models,
      maturities: params.maturities ?? null,
    });
  }

  // ── Swaps ──────────────────────────────────────────────────────────

  /** Price a vanilla fixed-for-floating interest rate swap */
  async priceSwap(params: {
    notional?: number;
    fixedRate: number;
    tenorYears: number;
    discountRate?: number;
    discountCurve?: { tenor: number; rate: number }[];
    payFreq?: number;
    recFreq?: number;
    floatSpread?: number;
    isPayer?: boolean;
  }): Promise<{
    npv: number;
    fixed_leg_pv: number;
    float_leg_pv: number;
    par_rate: number;
    fixed_cashflows: {
      time: number;
      tau: number;
      amount: number;
      df: number;
      pv: number;
    }[];
    float_cashflows: {
      time: number;
      tau: number;
      forward_rate: number;
      spread: number;
      all_in_rate: number;
      amount: number;
      df: number;
      pv: number;
    }[];
    annuity: number;
    dv01: number;
    notional: number;
    tenor_years: number;
    fixed_rate: number;
    is_payer: boolean;
  }> {
    return this.request("/api/swaps/price", {
      notional: params.notional ?? 1_000_000,
      fixed_rate: params.fixedRate,
      tenor_years: params.tenorYears,
      discount_rate: params.discountRate ?? 0.04,
      discount_curve: params.discountCurve ?? null,
      pay_freq: params.payFreq ?? 2,
      rec_freq: params.recFreq ?? 4,
      float_spread: params.floatSpread ?? 0,
      is_payer: params.isPayer ?? true,
    });
  }

  /** Compute swap rate sensitivities (DV01, convexity) */
  async swapSensitivity(params: {
    notional?: number;
    fixedRate: number;
    tenorYears: number;
    discountRate: number;
    payFreq?: number;
    recFreq?: number;
    floatSpread?: number;
    bumpBps?: number;
  }): Promise<{
    base_npv: number;
    dv01: number;
    convexity: number;
    par_rate: number;
    rate_bumps: number[];
    npvs: number[];
  }> {
    return this.request("/api/swaps/sensitivity", {
      notional: params.notional ?? 1_000_000,
      fixed_rate: params.fixedRate,
      tenor_years: params.tenorYears,
      discount_rate: params.discountRate,
      pay_freq: params.payFreq ?? 2,
      rec_freq: params.recFreq ?? 4,
      float_spread: params.floatSpread ?? 0,
      bump_bps: params.bumpBps ?? 1.0,
    });
  }

  /** Compute par swap rate curve across tenors */
  async swapParCurve(params: {
    discountRate?: number;
    discountCurve?: { tenor: number; rate: number }[];
    payFreq?: number;
    tenors?: number[];
  }): Promise<{
    tenors: number[];
    par_rates: number[];
  }> {
    return this.request("/api/swaps/par-curve", {
      discount_rate: params.discountRate ?? 0.04,
      discount_curve: params.discountCurve ?? null,
      pay_freq: params.payFreq ?? 2,
      tenors: params.tenors ?? null,
    });
  }

  /** Price swap under dual-curve (OIS discounting) framework */
  async priceDualCurve(params: {
    notional?: number;
    fixedRate: number;
    tenorYears: number;
    projectionRate: number;
    discountRate: number;
    payFreq?: number;
    recFreq?: number;
    floatSpread?: number;
  }): Promise<{
    npv: number;
    fixed_leg_pv: number;
    float_leg_pv: number;
    par_rate: number;
    single_curve_npv: number;
    single_curve_par_rate: number;
    basis_adjustment: number;
    projection_rate: number;
    discount_rate: number;
  }> {
    return this.request("/api/swaps/dual-curve", {
      notional: params.notional ?? 1_000_000,
      fixed_rate: params.fixedRate,
      tenor_years: params.tenorYears,
      projection_rate: params.projectionRate,
      discount_rate: params.discountRate,
      pay_freq: params.payFreq ?? 2,
      rec_freq: params.recFreq ?? 4,
      float_spread: params.floatSpread ?? 0,
    });
  }

  /** Get OIS discounting educational concepts */
  async getOISConcepts(): Promise<{ concept: string; description: string }[]> {
    const res = await this.requestGet<{
      concepts: { concept: string; description: string }[];
    }>("/api/swaps/ois-concepts");
    return res.concepts;
  }

  // ── Calibration ────────────────────────────────────────────────────

  /** Calibrate SVI implied volatility surface */
  async calibrateSVI(params: {
    spot?: number;
    riskFreeRate?: number;
    dividendYield?: number;
    slices: {
      expiry: number;
      strikes: number[];
      market_ivs: number[];
    }[];
    method?: string;
  }): Promise<{
    slices: {
      expiry: number;
      forward: number;
      params: Record<string, number>;
      fitted_ivs: number[];
      market_ivs: number[];
      strikes: number[];
      log_moneyness: number[];
      residuals: number[];
      diagnostics: Record<string, number>;
      converged: boolean;
      elapsed_ms: number;
      iterations: number;
      method: string;
    }[];
    aggregate_diagnostics: Record<string, number>;
    n_slices: number;
  }> {
    return this.request("/api/calibration/svi", {
      spot: params.spot ?? 100,
      risk_free_rate: params.riskFreeRate ?? 0.05,
      dividend_yield: params.dividendYield ?? 0,
      slices: params.slices,
      method: params.method ?? "L-BFGS-B",
    });
  }

  /** Check SVI parameters for butterfly arbitrage */
  async checkSVIArbitrage(params: {
    a: number;
    b: number;
    rho: number;
    m: number;
    sigma: number;
  }): Promise<{
    has_negative_variance: boolean;
    min_variance: number;
    is_likely_arbitrage_free: boolean;
    lee_bound_satisfied: boolean;
  }> {
    return this.request("/api/calibration/svi/arbitrage-check", params);
  }

  /** Calibrate a rate model (Vasicek / CIR) to an observed yield curve */
  async calibrateRateModel(params: {
    model?: string;
    r0?: number;
    maturities: number[];
    targetRates: number[];
    method?: string;
  }): Promise<{
    model: string;
    params: Record<string, number>;
    r0: number;
    maturities: number[];
    target_rates: number[];
    fitted_rates: number[];
    residuals: number[];
    diagnostics: Record<string, number>;
    converged: boolean;
    elapsed_ms: number;
    iterations: number;
    method: string;
  }> {
    return this.request("/api/calibration/rate-model", {
      model: params.model ?? "vasicek",
      r0: params.r0 ?? 0.04,
      maturities: params.maturities,
      target_rates: params.targetRates,
      method: params.method ?? "L-BFGS-B",
    });
  }

  // ── Encyclopedia ──────────────────────────────────────────────────────

  /** Get all model encyclopedia entries, optionally filtered by category */
  async getEncyclopediaModels(category?: string): Promise<{
    models: {
      id: string;
      name: string;
      category: string;
      formula: string;
      process: string;
      assumptions: string[];
      suitable_instruments: string[];
      strengths: string[];
      weaknesses: string[];
      calibration_burden: string;
      computational_cost: string;
      desk_usage: string;
      failure_modes: string[];
      fragility_warning: string;
    }[];
    total: number;
  }> {
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    return this.requestGet(`/api/encyclopedia/models${query}`);
  }

  /** Get encyclopedia categories with model counts */
  async getEncyclopediaCategories(): Promise<{
    categories: { id: string; label: string; count: number }[];
  }> {
    return this.requestGet("/api/encyclopedia/categories");
  }
}

/** Default singleton API client instance */
export const api = new TutorQuantApi(
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
);
