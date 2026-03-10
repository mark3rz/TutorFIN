"""Volatility analytics module.

Provides:
- Historical (close-to-close) volatility calculation with explicit annualisation
- EWMA volatility (RiskMetrics-style exponentially-weighted)
- Implied volatility solver via Brent's method with vega-guided initial bracket
- Volatility surface generation from demo / market quotes
- Realized vs implied volatility comparison utilities
"""
