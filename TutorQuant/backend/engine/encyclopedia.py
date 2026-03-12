"""Model encyclopedia — structured metadata for all platform models.

Provides a unified catalogue of quantitative models with their formulas,
assumptions, strengths, weaknesses, calibration burden, computational cost,
typical desk usage, and failure modes.
"""

from __future__ import annotations


# ═════════════════════════════════════════════════════════════════════════════
# Model catalogue — each entry is a self-contained reference card
# ═════════════════════════════════════════════════════════════════════════════

MODEL_CATALOGUE: list[dict] = [
    # ── Option Pricing Models ────────────────────────────────────────────
    {
        "id": "black_scholes",
        "name": "Black-Scholes-Merton",
        "category": "option",
        "formula": "C = Se^{-qT}N(d_1) - Ke^{-rT}N(d_2)",
        "process": "dS/S = (r-q)dt + \\sigma dW \\quad \\text{(GBM under }\\mathbb{Q}\\text{)}",
        "assumptions": [
            "Log-normal returns (constant volatility)",
            "Continuous hedging with no transaction costs",
            "Constant risk-free rate and dividend yield",
            "No jumps in the underlying price",
            "European exercise only",
            "Frictionless, liquid markets",
        ],
        "suitable_instruments": [
            "European equity options",
            "FX options (Garman-Kohlhagen extension)",
            "Options on futures (Black-76)",
        ],
        "strengths": [
            "Closed-form price and Greeks — sub-microsecond computation",
            "Provides the market's lingua franca via implied volatility",
            "Analytical Greeks enable precise delta-hedging",
            "Simple calibration: single parameter (sigma)",
        ],
        "weaknesses": [
            "Cannot capture volatility smile or skew",
            "Assumes constant vol — violated in practice",
            "No jump risk — underprices tail events",
            "European exercise only — no early exercise",
        ],
        "calibration_burden": "Minimal — single parameter (implied vol) per strike/expiry",
        "computational_cost": "Negligible — analytical formula",
        "desk_usage": "Universal benchmark. Every options desk uses BSM as the quoting convention. Traders think in implied vol, not in absolute prices. The model's 'incorrectness' is a feature: deviations from BSM (the smile) carry information.",
        "failure_modes": [
            "Significantly underprices OTM puts (fat tails / crash risk)",
            "Breaks down for very short or very long maturities",
            "Cannot handle discrete dividends correctly",
            "Hedging error increases in volatile or illiquid markets",
        ],
        "fragility_warning": "BSM is a linear approximation to a non-linear world. The model works best when vol is relatively stable. During market stress, realised vol can spike 3-5x, making delta hedges based on implied vol dangerously wrong.",
    },
    {
        "id": "binomial_tree",
        "name": "Binomial Tree (CRR)",
        "category": "option",
        "formula": "V_0 = e^{-r\\Delta t}[pV_u + (1-p)V_d]",
        "process": "S_{t+1} = S_t \\cdot u \\text{ or } S_t \\cdot d, \\quad u = e^{\\sigma\\sqrt{\\Delta t}}, \\; d = 1/u",
        "assumptions": [
            "Discrete time steps approximate continuous dynamics",
            "Two possible moves per step (up/down)",
            "Risk-neutral pricing via replication",
            "Constant volatility per step",
        ],
        "suitable_instruments": [
            "American options (early exercise)",
            "Options with discrete dividends",
            "Barrier options (with modifications)",
            "Bermudan options",
        ],
        "strengths": [
            "Handles American-style early exercise naturally",
            "Converges to BSM as steps increase",
            "Intuitive and easy to explain",
            "Can accommodate discrete dividends",
        ],
        "weaknesses": [
            "Slow for high accuracy (O(N^2) complexity)",
            "Oscillation in Greeks for low step counts",
            "Barrier options require careful tree construction",
            "No smile dynamics — flat vol per step",
        ],
        "calibration_burden": "Same as BSM — single volatility parameter",
        "computational_cost": "Moderate — O(N^2) for N steps; ~200 steps typical",
        "desk_usage": "Standard for American equity options. Used when early exercise premium matters. Most desks use ~200-500 steps. The tree is also used for pedagogical illustration of risk-neutral pricing.",
        "failure_modes": [
            "Greeks oscillate with odd/even step counts near barriers",
            "Barrier options require tree adjustment (shifted mesh)",
            "Very slow for path-dependent or multi-asset options",
        ],
        "fragility_warning": "The CRR tree converges to BSM, so it inherits all BSM limitations (constant vol, no jumps). Use it for exercise boundary analysis, not for smile modelling.",
    },
    {
        "id": "monte_carlo",
        "name": "Monte Carlo Simulation",
        "category": "option",
        "formula": "V_0 = e^{-rT} \\cdot \\frac{1}{N}\\sum_{i=1}^{N} g(S_T^{(i)})",
        "process": "S_T = S_0 \\exp\\!\\left[(r-q-\\tfrac{1}{2}\\sigma^2)T + \\sigma\\sqrt{T}\\,Z\\right], \\quad Z \\sim \\mathcal{N}(0,1)",
        "assumptions": [
            "Relies on the law of large numbers for convergence",
            "Assumes the underlying process is correctly specified",
            "Standard error decreases as 1/sqrt(N)",
        ],
        "suitable_instruments": [
            "Path-dependent options (Asian, lookback, barrier)",
            "Multi-asset / basket options",
            "Options under complex dynamics (stochastic vol, jumps)",
            "Any payoff that can be simulated",
        ],
        "strengths": [
            "Extremely flexible — any payoff, any process",
            "Scales well to high dimensions",
            "Variance reduction techniques (antithetic, control variate)",
            "Easy to add model complexity (jumps, stochastic vol)",
        ],
        "weaknesses": [
            "Slow convergence: O(1/sqrt(N))",
            "Noisy Greeks without special techniques",
            "Difficult for American options (requires regression)",
            "Not suitable for real-time pricing",
        ],
        "calibration_burden": "Depends on underlying model — can be minimal (GBM) to heavy (Heston + jumps)",
        "computational_cost": "High — 10K-1M paths typical; GPU acceleration for production",
        "desk_usage": "Exotics desks rely heavily on Monte Carlo. Used for pricing complex structured products, basket options, and anything beyond closed-form. Also used for model validation and stress testing.",
        "failure_modes": [
            "Bias from too few paths (increase N for convergence)",
            "Discretisation bias from too few time steps",
            "Variance explosion with wrong variance reduction",
            "American exercise requires Longstaff-Schwartz regression",
        ],
        "fragility_warning": "Monte Carlo is only as good as the model being simulated. 'Garbage in, garbage out' applies. The convergence rate is slow — doubling accuracy requires 4x the computation.",
    },
    # ── Rate Models ──────────────────────────────────────────────────────
    {
        "id": "vasicek",
        "name": "Vasicek",
        "category": "rate",
        "formula": "P(0,T) = A(T)e^{-B(T)r_0}",
        "process": "dr = \\kappa(\\theta - r)\\,dt + \\sigma\\,dW",
        "assumptions": [
            "Ornstein-Uhlenbeck process for the short rate",
            "Constant mean reversion speed, long-run level, and volatility",
            "Gaussian (normal) distribution — rates can go negative",
            "One-factor model — single source of randomness",
        ],
        "suitable_instruments": [
            "Zero-coupon bonds (analytical pricing)",
            "Interest rate caps/floors (analytical via Jamshidian)",
            "Simple interest rate swaps",
            "Negative-rate environments (EUR, JPY, CHF)",
        ],
        "strengths": [
            "Fully analytical bond prices and yield curves",
            "Simple closed-form for bond options",
            "Only 3 parameters — easy to calibrate",
            "Mean reversion captures rate behaviour well",
        ],
        "weaknesses": [
            "Rates can go negative (problematic for some markets)",
            "Cannot fit an arbitrary initial yield curve",
            "Constant volatility is unrealistic",
            "One factor — cannot capture curve dynamics",
        ],
        "calibration_burden": "Low — 3 parameters (kappa, theta, sigma) from yield curve or time series",
        "computational_cost": "Negligible — analytical formulas",
        "desk_usage": "Teaching and quick analytics. Some desks use it for negative-rate scenarios. Primarily a stepping stone to Hull-White.",
        "failure_modes": [
            "Poor fit to steep or humped yield curves",
            "Negative rate paths in Monte Carlo can cause issues in pricing",
            "Over-simplified for derivative pricing",
        ],
        "fragility_warning": "The Vasicek model is the 'BSM of rates' — elegant but over-simplified. Its Gaussian distribution means it assigns too much probability to extreme negative rates.",
    },
    {
        "id": "cir",
        "name": "Cox-Ingersoll-Ross",
        "category": "rate",
        "formula": "P(0,T) = A(T)e^{-B(T)r_0}, \\quad \\gamma = \\sqrt{\\kappa^2 + 2\\sigma^2}",
        "process": "dr = \\kappa(\\theta - r)\\,dt + \\sigma\\sqrt{r}\\,dW",
        "assumptions": [
            "Square-root diffusion — volatility proportional to sqrt(r)",
            "Rates stay positive when Feller condition holds (2*kappa*theta >= sigma^2)",
            "Non-central chi-squared distribution",
            "One-factor model",
        ],
        "suitable_instruments": [
            "Zero-coupon bonds in positive-rate environments",
            "Credit default intensity modelling",
            "Default probability term structures",
            "Scenario generation for risk management",
        ],
        "strengths": [
            "Rates stay non-negative (with Feller condition)",
            "Level-dependent vol matches empirical observation",
            "Analytical bond prices",
            "Widely used in credit risk modelling",
        ],
        "weaknesses": [
            "Cannot fit arbitrary yield curves",
            "Feller condition constrains parameter space",
            "Simulation requires care (full truncation scheme)",
            "One factor limits curve dynamics",
        ],
        "calibration_burden": "Low — 3 parameters, but Feller condition adds a constraint",
        "computational_cost": "Negligible for bonds; moderate for simulation (truncation needed)",
        "desk_usage": "Credit desks use CIR for default intensity. Rates desks prefer Hull-White. The sqrt(r) feature makes CIR natural for modelling quantities that should stay positive.",
        "failure_modes": [
            "Feller condition violation leads to zero-absorbing paths",
            "Euler discretisation can produce negative rates — use full truncation",
            "Poor fit to inverted or humped curves",
        ],
        "fragility_warning": "If the Feller condition is violated, simulated paths can hit zero and stay there, producing degenerate term structures. Always check 2*kappa*theta vs sigma^2.",
    },
    {
        "id": "hull_white",
        "name": "Hull-White (Extended Vasicek)",
        "category": "rate",
        "formula": "P(0,T) = \\frac{P^M(0,T)}{P^M(0,t)} \\exp\\!\\left[-B(T-t)f^M(0,t) - \\tfrac{\\sigma^2}{4a}B^2(T-t)(1-e^{-2at})\\right]",
        "process": "dr = [\\theta(t) - a\\,r]\\,dt + \\sigma\\,dW",
        "assumptions": [
            "Time-dependent drift theta(t) allows fitting the initial curve",
            "Gaussian (normal) distribution — like Vasicek with time-varying target",
            "Constant mean-reversion speed a and constant volatility sigma",
            "One-factor model",
        ],
        "suitable_instruments": [
            "Interest rate swaptions (Jamshidian decomposition)",
            "Callable bonds and Bermudan swaptions",
            "Caps, floors, and interest rate derivatives",
            "Any product requiring exact initial curve fit",
        ],
        "strengths": [
            "Exactly fits the initial yield curve (no-arbitrage)",
            "Analytical bond prices and swaption formulas",
            "Industry standard for interest rate derivatives",
            "Efficient tree and PDE implementations",
        ],
        "weaknesses": [
            "Gaussian — rates can go negative",
            "One factor — limited curve dynamics",
            "Constant vol — no vol skew/smile",
            "theta(t) calibration can be numerically sensitive",
        ],
        "calibration_burden": "Moderate — 2 free parameters (a, sigma) after stripping theta(t) from the curve",
        "computational_cost": "Low to moderate — analytical for vanillas, tree/PDE for exotics",
        "desk_usage": "The workhorse of rates desks. Used for swaption pricing, callable bond valuation, and regulatory capital models. Most banks use Hull-White (or its two-factor extension) for interest rate derivatives.",
        "failure_modes": [
            "Negative rates in high-vol scenarios",
            "Cannot capture vol smile — may misprice OTM swaptions",
            "One factor means all points on the curve move together (parallel shift)",
        ],
        "fragility_warning": "Hull-White is the industry default, but its single factor means it cannot capture steepener/flattener dynamics. For curve-dependent exotics, a two-factor model is essential.",
    },
    # ── Volatility Models ────────────────────────────────────────────────
    {
        "id": "svi",
        "name": "SVI (Stochastic Volatility Inspired)",
        "category": "volatility",
        "formula": "w(k) = a + b\\!\\left(\\rho(k-m) + \\sqrt{(k-m)^2 + \\sigma^2}\\right)",
        "process": "Parameterisation of total implied variance as a function of log-moneyness k = \\ln(K/F)",
        "assumptions": [
            "Total variance is a smooth function of log-moneyness",
            "Five parameters per expiry slice",
            "Motivated by large-time behaviour of stochastic vol models",
            "Requires arbitrage checks (butterfly, calendar spread)",
        ],
        "suitable_instruments": [
            "Equity implied volatility surfaces",
            "FX volatility smiles",
            "Variance swap term structure modelling",
            "Vol surface interpolation and extrapolation",
        ],
        "strengths": [
            "Excellent fit to market smiles with 5 parameters",
            "Analytically tractable — closed-form total variance",
            "Theoretical grounding from stochastic vol asymptotics",
            "Standard in the industry for vol surface construction",
        ],
        "weaknesses": [
            "Static model — no dynamics for forward vol",
            "Arbitrage constraints are complex to enforce",
            "Calendar spread arbitrage across expiries not automatic",
            "Needs re-calibration as market moves",
        ],
        "calibration_burden": "Moderate — 5 parameters per slice, but well-conditioned with good initial guesses",
        "computational_cost": "Low — analytical formula evaluation",
        "desk_usage": "Vol desks use SVI (or variants like SSVI) to build smooth, arbitrage-free vol surfaces from discrete market quotes. The surface is then used to price exotics and compute Greeks.",
        "failure_modes": [
            "Butterfly arbitrage if parameters are poorly chosen",
            "Negative total variance for extreme wings",
            "Poor extrapolation beyond observed strikes",
        ],
        "fragility_warning": "SVI is a static snapshot — it tells you nothing about how vol will evolve. For dynamic hedging or forward-starting options, a stochastic vol model (SABR, Heston) is needed.",
    },
    {
        "id": "historical_vol",
        "name": "Realised / Historical Volatility",
        "category": "volatility",
        "formula": "\\hat{\\sigma} = \\sqrt{\\frac{252}{N-1}\\sum_{i=1}^{N}(\\ln S_i/S_{i-1} - \\bar{r})^2}",
        "process": "Rolling-window estimator of annualised return standard deviation",
        "assumptions": [
            "Returns are i.i.d. (no autocorrelation)",
            "Constant volatility over the estimation window",
            "Close-to-close prices (ignores intraday dynamics)",
        ],
        "suitable_instruments": [
            "Realised vol vs implied vol analysis",
            "Variance risk premium estimation",
            "Hedging performance evaluation",
            "Risk management and VaR computation",
        ],
        "strengths": [
            "Simple and intuitive",
            "Model-free — uses only price data",
            "EWMA variant adapts to changing vol regimes",
        ],
        "weaknesses": [
            "Backward-looking — does not predict future vol",
            "Sensitive to window length",
            "Close-to-close estimator misses intraday moves",
            "Assumes stationarity within the window",
        ],
        "calibration_burden": "Minimal — choose window length and lambda for EWMA",
        "computational_cost": "Negligible",
        "desk_usage": "Every desk monitors realised vol. The spread between implied and realised (the volatility risk premium) is a key P&L driver for options market makers.",
        "failure_modes": [
            "Window too short → noisy estimate; too long → lagging",
            "Regime changes (e.g., financial crisis) distort the estimate",
            "Not forward-looking — poor for forecasting",
        ],
        "fragility_warning": "Historical vol tells you where you've been, not where you're going. During calm markets, it systematically underestimates tail risk.",
    },
    # ── Fixed Income ─────────────────────────────────────────────────────
    {
        "id": "bond_analytics",
        "name": "Bond Analytics (Yield Curve Framework)",
        "category": "fixed_income",
        "formula": "P = \\sum_{i=1}^{N} \\frac{c}{(1+y/m)^{i}} + \\frac{F}{(1+y/m)^{N}}",
        "process": "Discounted cashflow valuation with yield-to-maturity (YTM) or bootstrapped zero curve",
        "assumptions": [
            "Deterministic cashflows (no default risk)",
            "Flat or piecewise yield curve",
            "Semi-annual or annual compounding",
            "No embedded options (callable, putable bonds need tree models)",
        ],
        "suitable_instruments": [
            "Government and investment-grade bonds",
            "Bond duration, convexity, and DV01 analytics",
            "Yield curve bootstrapping",
            "Relative value analysis",
        ],
        "strengths": [
            "Exact for vanilla fixed-coupon bonds",
            "Duration and convexity provide clear risk measures",
            "Bootstrapping gives market-consistent zero rates",
            "Foundation for all fixed-income analytics",
        ],
        "weaknesses": [
            "Assumes flat yield curve when using YTM",
            "Cannot handle callable or structured bonds",
            "No credit risk or liquidity premium",
            "Duration is a first-order approximation",
        ],
        "calibration_burden": "None — uses market yields directly",
        "computational_cost": "Negligible",
        "desk_usage": "Government bond desks use duration/convexity for risk management. Curve traders use bootstrapped zero rates and forward rates to express views on the term structure.",
        "failure_modes": [
            "Duration hedging breaks down for large yield moves (need convexity)",
            "YTM assumes reinvestment at the same rate — unrealistic",
            "Ignoring credit spread can lead to mis-pricing",
        ],
        "fragility_warning": "Duration is a linearisation. For bonds with embedded options (callables), effective duration from an interest rate model (e.g., Hull-White tree) is required.",
    },
    # ── Swaps ────────────────────────────────────────────────────────────
    {
        "id": "vanilla_irs",
        "name": "Vanilla Interest Rate Swap",
        "category": "swap",
        "formula": "\\text{NPV} = \\text{Float Leg PV} - \\text{Fixed Leg PV}",
        "process": "Exchange of fixed for floating cashflows based on a notional, with par rate R_{\\text{par}} = \\frac{\\sum DF_i \\cdot f_i \\cdot \\tau_i}{\\sum DF_i \\cdot \\tau_i}",
        "assumptions": [
            "LIBOR/SOFR-based floating rate (known at period start, paid at end)",
            "No credit risk (collateralised / CSA agreement)",
            "Discount curve determines present values",
            "Single currency",
        ],
        "suitable_instruments": [
            "Plain vanilla fixed-for-floating IRS",
            "Par rate curve construction",
            "DV01 and swap spread analysis",
            "Hedge instrument for bond and loan portfolios",
        ],
        "strengths": [
            "Liquid and transparent — most liquid derivatives market",
            "Par rate is an intuitive breakeven concept",
            "DV01 provides precise duration hedge",
            "Foundation for yield curve construction",
        ],
        "weaknesses": [
            "Single-curve framework is outdated (need OIS discounting)",
            "No convexity adjustment for CMS-style swaps",
            "Assumes constant notional",
        ],
        "calibration_burden": "None — uses market swap rates and discount factors",
        "computational_cost": "Negligible — cashflow summation",
        "desk_usage": "Every rates desk trades swaps. They are the primary instrument for expressing rate views and hedging fixed-income portfolios. Swap rates define the term structure.",
        "failure_modes": [
            "Using single-curve discounting when OIS is standard → mis-pricing",
            "Ignoring day count conventions in production systems",
            "Par rate assumes flat forward rates — approximate for steep curves",
        ],
        "fragility_warning": "Post-2008, the single-curve framework is incorrect. Production systems must use dual-curve (OIS discounting + LIBOR/SOFR projection) for accurate pricing.",
    },
]


def get_encyclopedia() -> list[dict]:
    """Return the full model encyclopaedia."""
    return MODEL_CATALOGUE


def get_encyclopedia_by_category(category: str) -> list[dict]:
    """Return models filtered by category."""
    return [m for m in MODEL_CATALOGUE if m["category"] == category]


def get_model_detail(model_id: str) -> dict | None:
    """Return a single model's detail by ID."""
    for m in MODEL_CATALOGUE:
        if m["id"] == model_id:
            return m
    return None


CATEGORY_LABELS = {
    "option": "Option Pricing Models",
    "rate": "Interest Rate Models",
    "volatility": "Volatility Models",
    "fixed_income": "Fixed Income",
    "swap": "Swap Valuation",
}


def get_categories() -> list[dict]:
    """Return available categories with counts."""
    counts: dict[str, int] = {}
    for m in MODEL_CATALOGUE:
        cat = m["category"]
        counts[cat] = counts.get(cat, 0) + 1
    return [
        {"id": cat, "label": CATEGORY_LABELS.get(cat, cat), "count": n}
        for cat, n in counts.items()
    ]
