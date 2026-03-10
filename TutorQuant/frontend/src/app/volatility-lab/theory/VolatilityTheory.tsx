"use client";

import { useState } from "react";
import { MathBlock, InlineMath } from "@/components/ui/MathBlock";
import { ChevronDown, ChevronRight } from "lucide-react";

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border-color)] last:border-b-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-0 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition-colors">
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{children}</p>;
}

function MathBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded border border-[var(--border-color)] bg-[#0a0a0f] px-3 py-2.5 my-2 overflow-x-auto">{children}</div>;
}

function SymDef({ symbol, desc }: { symbol: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-0.5">
      <span className="shrink-0 w-[60px]"><InlineMath tex={symbol} /></span>
      <span className="text-[11px] text-[var(--text-secondary)]">{desc}</span>
    </div>
  );
}

export function VolatilityTheory() {
  return (
    <div className="space-y-0">

      <Section title="BSM Constant Vol Limitation" defaultOpen={true}>
        <P>
          The Black-Scholes-Merton model assumes a single constant volatility
          <InlineMath tex="\sigma" /> across all strikes and maturities. In reality,
          if BSM were correct, implied volatility backed out from market prices
          at different strikes and expiries would be flat.
        </P>
        <P>
          Market observations consistently show that IV varies with both strike
          (the &quot;smile&quot; or &quot;skew&quot;) and maturity (the &quot;term structure&quot;).
          This empirical pattern is one of the most important stylised facts
          in options markets.
        </P>
      </Section>

      <Section title="Implied Volatility">
        <P>
          Given an observed market price <InlineMath tex="C_{\text{mkt}}" />, the
          implied volatility <InlineMath tex="\sigma_{\text{IV}}" /> is the unique
          volatility input that makes the BSM price match the market:
        </P>
        <MathBox>
          <MathBlock tex="C_{\text{BSM}}(S, K, T, r, \sigma_{\text{IV}}, q) = C_{\text{mkt}}" />
        </MathBox>
        <P>
          Since BSM price is strictly increasing in <InlineMath tex="\sigma" /> for
          options with positive time value, the IV is unique and well-defined whenever
          the market price lies within the no-arbitrage bounds.
        </P>
        <P>
          We solve this using Brent&apos;s method (guaranteed convergence for
          continuous monotonic functions) on the bracket
          <InlineMath tex="[\sigma_{\min}, \sigma_{\max}]" />.
        </P>
        <MathBox>
          <MathBlock tex="\text{No-arbitrage bounds (call): } \max(0,\; Se^{-qT} - Ke^{-rT}) \leq C \leq Se^{-qT}" />
        </MathBox>
      </Section>

      <Section title="Smile and Skew">
        <P>
          The <strong>volatility smile</strong> refers to the U-shaped pattern of
          IV across strikes for a given expiry. For equity indices, the pattern
          is typically a <strong>skew</strong> (monotonically decreasing IV from
          low to high strikes).
        </P>
        <P>
          Our parametric model uses:
        </P>
        <MathBox>
          <MathBlock tex="\sigma_{\text{IV}}(K, T) = \sigma_0 + \alpha \ln\!\left(\frac{K}{S}\right) + \beta \left[\ln\!\left(\frac{K}{S}\right)\right]^2 + \gamma \sqrt{T}" />
        </MathBox>
        <SymDef symbol="\sigma_0" desc="Base ATM volatility" />
        <SymDef symbol="\alpha" desc="Skew slope (negative for typical equity skew)" />
        <SymDef symbol="\beta" desc="Smile curvature (positive adds U-shape)" />
        <SymDef symbol="\gamma" desc="Term structure slope" />
        <P>
          The skew arises from several market mechanisms: crash risk (demand for
          OTM puts), leverage effect (negative correlation between returns and
          volatility), and stochastic volatility (e.g., Heston model generates skew
          through vol-of-vol and correlation parameters).
        </P>
      </Section>

      <Section title="Term Structure">
        <P>
          The <strong>ATM term structure</strong> plots the at-the-money implied
          volatility against time to expiry. It reflects the market&apos;s
          expectation of future realised volatility at different horizons.
        </P>
        <P>
          <strong>Forward implied variance</strong> between two expiries
          <InlineMath tex="T_1" /> and <InlineMath tex="T_2" />:
        </P>
        <MathBox>
          <MathBlock tex="\sigma_{T_1 \to T_2}^2 = \frac{\sigma_{T_2}^2 T_2 - \sigma_{T_1}^2 T_1}{T_2 - T_1}" />
        </MathBox>
        <P>
          Negative forward variance would indicate calendar spread arbitrage.
          In practice, the term structure is typically upward-sloping in calm
          markets (mean reversion) and inverted during stress events.
        </P>
      </Section>

      <Section title="Historical Volatility">
        <P>
          The close-to-close estimator computes the standard deviation of log
          returns and annualises:
        </P>
        <MathBox>
          <MathBlock tex="r_t = \ln\!\left(\frac{P_t}{P_{t-1}}\right), \qquad \hat\sigma = \sqrt{\frac{1}{n-1}\sum_{t=1}^{n}(r_t - \bar{r})^2} \cdot \sqrt{A}" />
        </MathBox>
        <SymDef symbol="A" desc="Annualisation factor: 252 (trading days), 365 (calendar), or 52 (weekly)" />
        <P>
          This estimator is unbiased but places equal weight on all observations,
          which can be slow to react to regime changes.
        </P>
      </Section>

      <Section title="EWMA Volatility">
        <P>
          The exponentially weighted moving average (EWMA) estimator, popularised
          by JP Morgan&apos;s RiskMetrics methodology, applies geometrically
          decaying weights:
        </P>
        <MathBox>
          <MathBlock tex="\hat\sigma_t^2 = \lambda\,\hat\sigma_{t-1}^2 + (1-\lambda)\,r_{t-1}^2" />
        </MathBox>
        <SymDef symbol="\lambda" desc="Decay factor, typically 0.94 for daily data (RiskMetrics)" />
        <P>
          The effective window is approximately <InlineMath tex="1/(1-\lambda)" /> observations.
          For <InlineMath tex="\lambda = 0.94" />, this is roughly 17 days.
          EWMA responds faster to volatility regime changes than equally-weighted
          estimators but is path-dependent and can overreact to single large moves.
        </P>
      </Section>

      <Section title="VIX Concept">
        <P>
          The CBOE Volatility Index (VIX) measures the market&apos;s expectation
          of 30-day forward-looking volatility. It is computed from a portfolio
          of OTM put and call options on the S&P 500, using a model-free
          replication of variance swaps:
        </P>
        <MathBox>
          <MathBlock tex="\text{VIX}^2 = \frac{2}{T}\sum_i \frac{\Delta K_i}{K_i^2}\,e^{rT}\,Q(K_i) - \frac{1}{T}\left(\frac{F}{K_0} - 1\right)^2" />
        </MathBox>
        <P>
          The VIX is often called the &quot;fear gauge&quot; because it tends to
          spike during market selloffs. It reflects the cost of portfolio insurance
          and typically trades at a premium to subsequent realised volatility
          (the variance risk premium).
        </P>
      </Section>

      <Section title="Realised vs Implied">
        <P>
          The <strong>volatility risk premium</strong> is the difference between
          implied and subsequent realised volatility:
        </P>
        <MathBox>
          <MathBlock tex="\text{VRP} = \sigma_{\text{IV}} - \sigma_{\text{realised}}" />
        </MathBox>
        <P>
          Empirically, VRP is positive on average for equity indices, meaning
          option sellers are compensated for bearing volatility risk. This is the
          economic basis for volatility selling strategies (e.g., covered calls,
          variance swaps).
        </P>
        <P>
          The comparison view in this module plots rolling realised volatility
          against a constant implied vol to illustrate this concept.
        </P>
      </Section>

    </div>
  );
}
