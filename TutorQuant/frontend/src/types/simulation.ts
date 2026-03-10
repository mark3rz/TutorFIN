/** Configuration for simulation engines */
export interface SimulationConfig {
  /** Number of simulation paths */
  numPaths: number;
  /** Number of time steps */
  numSteps: number;
  /** Time horizon in years */
  timeHorizon: number;
  /** Random seed for reproducibility */
  seed?: number;
  /** Variance reduction technique */
  varianceReduction?: "antithetic" | "control_variate" | "none";
}

/** Request for Monte Carlo option pricing */
export interface MonteCarloRequest {
  spot: number;
  strike: number;
  expiryYears: number;
  riskFreeRate: number;
  volatility: number;
  optionType: "call" | "put";
  simulation: SimulationConfig;
}

/** Single simulated path data */
export interface PathData {
  /** Time points */
  times: number[];
  /** Price values at each time point */
  values: number[];
}

/** Diagnostics about Monte Carlo convergence */
export interface ConvergenceDiagnostics {
  /** Running mean price as paths increase */
  runningMean: number[];
  /** Running standard error */
  runningStdError: number[];
  /** Path counts corresponding to each running stat */
  pathCounts: number[];
  /** Final standard error */
  standardError: number;
  /** 95% confidence interval */
  confidenceInterval: [number, number];
}

/** Response from Monte Carlo simulation */
export interface MonteCarloResponse {
  price: number;
  standardError: number;
  confidenceInterval: [number, number];
  /** Sample of simulated paths for visualization */
  samplePaths: PathData[];
  /** Convergence diagnostics */
  convergence: ConvergenceDiagnostics;
  /** Computation time in milliseconds */
  computeTimeMs: number;
}
