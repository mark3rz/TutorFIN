/** Position side */
export type PositionSide = "long" | "short";

/** A single position in the portfolio */
export interface PortfolioPosition {
  /** Unique identifier for the position */
  id: string;
  /** Instrument type */
  instrumentType: "option" | "stock" | "bond" | "swap";
  /** Ticker or name */
  ticker: string;
  /** Number of contracts / shares */
  quantity: number;
  /** Long or short */
  side: PositionSide;
  /** Entry price */
  entryPrice: number;
  /** Current market price */
  currentPrice: number;
  /** Additional instrument-specific parameters */
  params?: Record<string, number | string>;
}

/** Request to analyze a portfolio */
export interface PortfolioRequest {
  positions: PortfolioPosition[];
  /** Confidence level for VaR (e.g. 0.95 or 0.99) */
  confidenceLevel: number;
  /** Holding period in days */
  holdingPeriodDays: number;
  /** VaR method */
  varMethod: "historical" | "parametric" | "monte_carlo";
  /** Number of scenarios for MC VaR */
  numScenarios?: number;
}

/** Risk metrics for the portfolio */
export interface PortfolioRiskMetrics {
  /** Portfolio net value */
  portfolioValue: number;
  /** Unrealized P&L */
  unrealizedPnl: number;
  /** Value at Risk */
  valueAtRisk: number;
  /** Expected Shortfall (CVaR) */
  expectedShortfall: number;
  /** Portfolio delta */
  portfolioDelta: number;
  /** Portfolio gamma */
  portfolioGamma: number;
  /** Portfolio vega */
  portfolioVega: number;
  /** Portfolio theta */
  portfolioTheta: number;
  /** Sharpe ratio (if historical data available) */
  sharpeRatio?: number;
  /** Maximum drawdown */
  maxDrawdown?: number;
}

/** Response from portfolio analysis */
export interface PortfolioResponse {
  metrics: PortfolioRiskMetrics;
  /** Per-position P&L breakdown */
  positionPnl: {
    id: string;
    ticker: string;
    pnl: number;
    pnlPercent: number;
    contribution: number;
  }[];
  /** Stress test results if requested */
  stressTests?: {
    scenario: string;
    portfolioPnl: number;
    portfolioPnlPercent: number;
  }[];
  /** Computation time in milliseconds */
  computeTimeMs: number;
}
