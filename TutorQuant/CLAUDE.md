# Quant Terminal Project Instructions

## Project mission
Build a production-quality, desktop-first quant dashboard with a Bloomberg Terminal feel and a rigorous teaching layer. The platform should help advanced finance users understand, visualize, and compare theoretical pricing models, Monte Carlo simulation behavior, Greeks, portfolio risk, fixed-income pricing, interest-rate modeling, and swaps.

The product is not a toy. Every implementation decision should favor quantitative correctness, extensibility, clarity of assumptions, and professional-grade architecture.

## Core priorities
1. Correct quantitative engine
2. Pricing accuracy and numerical stability
3. Broad model coverage through modular architecture
4. Clear separation of instruments, models, market data, calibration, and UI
5. Bloomberg-style dark terminal UX
6. Strong derivation and pedagogy at MSc Quant Finance level
7. Reusable interfaces that allow later expansion into additional models and markets

## Users
Primary users:
- Finance students
- Traders
- Advanced self-study learners

The UX should feel professional first and educational second.

## Product scope for v1
The application should be a multi-page, desktop-first, dark-only app with a shared shell.

Core modules:
- Option Modeling
- Volatility Lab
- Greeks and P&L
- Portfolio Pricing
- Fixed Income
- Interest Rate Models
- Swaps
- Market Data / Demo Data Layer
- Model Encyclopedia / Theory

The v1 app should run in demo mode, but all data interfaces must be designed so real market data can be integrated later with minimal refactoring.

## Required technology philosophy
Recommended stack:
- Frontend: Next.js + React + TypeScript
- Backend: Python + FastAPI
- Quant engine: numpy, scipy, pandas, statsmodels when needed
- Charts: Plotly
- Formula rendering: KaTeX or MathJax
- Testing: pytest

The backend should own pricing, Greeks, simulation, calibration, and fixed-income logic. Keep the frontend focused on presentation, state management, and interaction.

## Design principles
- Dark-only Bloomberg-inspired visual language
- Dense but readable information layout
- Left navigation, top sub-tabs, large central chart area
- Dynamic formula and derivation panel
- Tooltips for quant terminology
- Prominent assumptions, limitations, and market interpretation panels
- Teaching layer should never replace quantitative rigor

## Quantitative conventions
Always make these explicit in code and UI:
- Time units and annualization assumptions
- Day-count conventions when relevant
- Compounding assumptions
- Measure distinction: real-world vs risk-neutral
- Pricing methodology: closed form vs numerical vs simulation
- Greeks methodology: analytical vs finite-difference vs other numerical method
- Calibration objective and parameter constraints

Never hide a convention implicitly in magic constants.

## Architecture rules
- Separate instruments from models
- Separate pricing from calibration
- Separate market data schemas from model parameters
- Separate deterministic analytics from stochastic simulation utilities
- Separate chart transforms from raw computational outputs
- Prefer composition over hard-coded branching
- Keep each model behind a common interface where possible
- Add a registry or factory pattern for models and instruments when it improves extensibility

## Numerical safety rules
- Validate all user inputs
- Guard against divide-by-zero, invalid square roots, negative variances, and unstable parameter regions
- Fail loudly and clearly when a model is not appropriate for an instrument
- Document approximations and limitations
- Add unit tests for all pricing engines and major utilities
- Benchmark closed-form models against known reference values
- Add convergence diagnostics where simulation is used

## Model coverage expectations
Include architecture support for:
- Black-Scholes-Merton
- Binomial tree
- Trinomial tree
- Local volatility
- Heston
- SABR
- Merton jump diffusion
- Vasicek
- CIR
- Hull-White
- LMM

Only present models that are appropriate to the chosen instrument. Always explain why a model is or is not suitable.

## Monte Carlo expectations
Monte Carlo should be used where natural, not forced everywhere.

Default expectations:
- 1000 paths
- User-selectable random seed
- Confidence intervals
- Convergence diagnostics
- Antithetic variates enabled where practical

Simulation outputs should support:
- Representative path
- Path fan
- Terminal value histogram
- Terminal payoff distribution
- Convergence chart

## Greeks and risk expectations
Required support:
- Delta, Gamma, Vega, Theta, Rho
- Higher-order Greeks where meaningful and feasible
- Scalar, heatmap, and surface views where appropriate
- Greek-based P&L explain
- Scenario shocks
- Distribution-based P&L views
- Transaction cost input for discrete hedging error demonstrations
- Portfolio VaR and Expected Shortfall

A full hedging simulator is v2, but the architecture should not block it.

## Fixed-income and rates expectations
Support architecture and educational content for:
- Zero-coupon and coupon bond pricing
- Clean and dirty price
- Accrued interest
- Yield to maturity
- Duration and convexity
- Bootstrapping and discount-factor logic
- Short-rate model comparison
- Swap pricing foundations
- OIS and discounting concepts

## Theory and pedagogy expectations
Every model page should aim to show:
- Main formula
- SDE or stochastic process
- Variable and parameter definitions
- Derivation steps
- Assumptions
- Practical interpretation
- Why desks use this model
- Known weaknesses and failure modes

Depth target: MSc Quant Finance.
Include stochastic calculus notation where helpful, but present it clearly.

## Code quality expectations
- Strong folder structure
- Typed interfaces and schemas
- Clear docstrings
- High-signal comments for quant logic
- No fake formulas
- No placeholder explanations disguised as theory
- Avoid premature complexity, but never at the cost of correctness
- Prefer module-by-module implementation over giant one-shot generation

## Delivery process
When asked to build, proceed in phases:
1. Propose folder architecture
2. Propose page and module architecture
3. Propose pricing engine architecture
4. Propose data schemas
5. Propose implementation roadmap
6. Implement one phase at a time

Recommended build phases:
- Phase 1: App shell, BSM, closed-form Greeks, payoff diagrams, GBM Monte Carlo, theory panel
- Phase 2: Binomial/trinomial, P&L explain, portfolio basics, VaR/ES, implied vol, smile/skew
- Phase 3: Fixed income, curves, bond pricing, duration/convexity, short-rate models
- Phase 4: Swaps, calibration scaffolding, advanced comparison layer, encyclopedia polish

## Communication style for generated output
When producing code or plans:
- Be direct and technical
- State assumptions clearly
- Keep explanations concise but rigorous
- Flag tradeoffs explicitly
- Do not oversell unfinished functionality
- Note what is production-ready vs scaffolded

## Definition of done
A feature is not done unless:
- It is quantitatively defensible
- It has coherent UI placement
- Its assumptions are documented
- Its outputs are validated or benchmarked where possible
- It is architecturally extendable
