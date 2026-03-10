"use client";

import { useState } from "react";
import { MathBlock, InlineMath } from "@/components/ui/MathBlock";
import { ChevronDown, ChevronRight } from "lucide-react";

/* ── Collapsible section ──────────────────────────────────────────── */

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border-color)] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-0 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="pb-4 space-y-3">{children}</div>}
    </div>
  );
}

/* ── Styled paragraph ─────────────────────────────────────────────── */

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{children}</p>;
}

/* ── Math equation box ────────────────────────────────────────────── */

function MathBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-[var(--border-color)] bg-[#0a0a0f] px-3 py-2.5 my-2 overflow-x-auto">
      {children}
    </div>
  );
}

/* ── Symbol definition row ────────────────────────────────────────── */

function SymDef({ symbol, desc }: { symbol: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-0.5">
      <span className="shrink-0 w-[60px]">
        <InlineMath tex={symbol} />
      </span>
      <span className="text-[11px] text-[var(--text-secondary)]">{desc}</span>
    </div>
  );
}

/* ================================================================== */
/*  Main derivation component                                          */
/* ================================================================== */

export function BSMDerivation() {
  return (
    <div className="space-y-0">

      {/* ── 1. PRICING FORMULAS ─────────────────────────────────── */}
      <Section title="Pricing Formulas" defaultOpen={true}>
        <P>The BSM closed-form prices for European options with continuous dividend yield:</P>

        <MathBox>
          <MathBlock tex="C = S e^{-qT} N(d_1) - K e^{-rT} N(d_2)" />
          <MathBlock tex="P = K e^{-rT} N(-d_2) - S e^{-qT} N(-d_1)" />
        </MathBox>

        <P>where the d-parameters are:</P>
        <MathBox>
          <MathBlock tex="d_1 = \frac{\ln(S/K) + (r - q + \tfrac{1}{2}\sigma^2)\,T}{\sigma\sqrt{T}}" />
          <MathBlock tex="d_2 = d_1 - \sigma\sqrt{T}" />
        </MathBox>

        <P>
          <InlineMath tex="N(\cdot)" /> is the standard normal CDF.
          Put-call parity holds: <InlineMath tex="C - P = Se^{-qT} - Ke^{-rT}" />.
        </P>
      </Section>

      {/* ── 2. SYMBOL DEFINITIONS ───────────────────────────────── */}
      <Section title="Symbol Definitions" defaultOpen={true}>
        <div className="space-y-0.5">
          <SymDef symbol="S" desc="Current spot price of the underlying asset" />
          <SymDef symbol="K" desc="Strike (exercise) price of the option" />
          <SymDef symbol="T" desc="Time to expiration in years" />
          <SymDef symbol="r" desc="Continuously compounded risk-free interest rate (annualised)" />
          <SymDef symbol="\sigma" desc="Volatility of the underlying (annualised, constant)" />
          <SymDef symbol="q" desc="Continuous dividend yield (annualised)" />
          <SymDef symbol="N(x)" desc="CDF of the standard normal distribution" />
          <SymDef symbol="n(x)" desc="PDF of the standard normal distribution" />
          <SymDef symbol="W_t" desc="Standard Brownian motion under the relevant measure" />
          <SymDef symbol="\mathbb{Q}" desc="Risk-neutral (equivalent martingale) measure" />
        </div>
      </Section>

      {/* ── 3. GBM SETUP ────────────────────────────────────────── */}
      <Section title="Geometric Brownian Motion">
        <P>
          Under the physical (real-world) measure <InlineMath tex="\mathbb{P}" />, the asset price follows:
        </P>
        <MathBox>
          <MathBlock tex="\frac{dS}{S} = \mu\,dt + \sigma\,dW_t^{\mathbb{P}}" />
        </MathBox>

        <P>
          where <InlineMath tex="\mu" /> is the expected return and <InlineMath tex="\sigma" /> is the
          constant volatility. Applying Itô&apos;s lemma to <InlineMath tex="\ln S" />:
        </P>
        <MathBox>
          <MathBlock tex="d(\ln S) = \left(\mu - \tfrac{1}{2}\sigma^2\right)dt + \sigma\,dW_t^{\mathbb{P}}" />
        </MathBox>

        <P>Integrating gives the exact solution:</P>
        <MathBox>
          <MathBlock tex="S_T = S_0 \exp\!\left[\left(\mu - \tfrac{1}{2}\sigma^2\right)T + \sigma W_T^{\mathbb{P}}\right]" />
        </MathBox>

        <P>
          Log-returns are normally distributed: <InlineMath tex="\ln(S_T/S_0) \sim \mathcal{N}\!\left((\mu - \frac{\sigma^2}{2})T,\; \sigma^2 T\right)" />.
          This implies <InlineMath tex="S_T" /> is log-normally distributed — prices cannot go negative.
        </P>
      </Section>

      {/* ── 4. SELF-FINANCING HEDGE ─────────────────────────────── */}
      <Section title="Self-Financing Hedge Intuition">
        <P>
          Consider a portfolio of one option <InlineMath tex="V(S,t)" /> and <InlineMath tex="-\Delta" /> shares
          of the underlying:
        </P>
        <MathBox>
          <MathBlock tex="\Pi = V - \Delta\,S" />
        </MathBox>

        <P>
          The change in portfolio value over <InlineMath tex="dt" /> is:
        </P>
        <MathBox>
          <MathBlock tex="d\Pi = dV - \Delta\,dS" />
        </MathBox>

        <P>
          Applying Itô&apos;s lemma to <InlineMath tex="V(S,t)" />:
        </P>
        <MathBox>
          <MathBlock tex="dV = \frac{\partial V}{\partial t}\,dt + \frac{\partial V}{\partial S}\,dS + \frac{1}{2}\frac{\partial^2 V}{\partial S^2}\sigma^2 S^2\,dt" />
        </MathBox>

        <P>
          Choosing <InlineMath tex="\Delta = \frac{\partial V}{\partial S}" /> (delta-hedging) eliminates the
          stochastic <InlineMath tex="dW" /> term, making the portfolio locally riskless:
        </P>
        <MathBox>
          <MathBlock tex="d\Pi = \left(\frac{\partial V}{\partial t} + \frac{1}{2}\sigma^2 S^2 \frac{\partial^2 V}{\partial S^2}\right)dt" />
        </MathBox>

        <P>
          By no-arbitrage, a riskless portfolio must earn the risk-free rate: <InlineMath tex="d\Pi = r\Pi\,dt" />.
          This leads directly to the Black-Scholes PDE.
        </P>
      </Section>

      {/* ── 5. BLACK-SCHOLES PDE ────────────────────────────────── */}
      <Section title="Black-Scholes PDE">
        <P>
          Equating the riskless return with the hedged portfolio change yields the
          Black-Scholes partial differential equation (with continuous dividends):
        </P>
        <MathBox>
          <MathBlock tex="\frac{\partial V}{\partial t} + (r-q)\,S\frac{\partial V}{\partial S} + \frac{1}{2}\sigma^2 S^2 \frac{\partial^2 V}{\partial S^2} - rV = 0" />
        </MathBox>

        <P>Key observations:</P>
        <ul className="list-inside list-disc space-y-1 text-[11px] text-[var(--text-secondary)] pl-1">
          <li>The expected return <InlineMath tex="\mu" /> does not appear — pricing is preference-free</li>
          <li>Only <InlineMath tex="\sigma" />, <InlineMath tex="r" />, and <InlineMath tex="q" /> matter</li>
          <li>This is a backward parabolic PDE with terminal condition at <InlineMath tex="t = T" /></li>
          <li>Boundary conditions depend on the payoff (call vs put)</li>
        </ul>

        <P>Terminal condition for a European call:</P>
        <MathBox>
          <MathBlock tex="V(S, T) = \max(S - K, 0)" />
        </MathBox>
      </Section>

      {/* ── 6. RISK-NEUTRAL PRICING ─────────────────────────────── */}
      <Section title="Risk-Neutral Pricing">
        <P>
          By Girsanov&apos;s theorem, there exists a measure <InlineMath tex="\mathbb{Q}" /> under which
          the discounted asset price is a martingale. Under <InlineMath tex="\mathbb{Q}" />:
        </P>
        <MathBox>
          <MathBlock tex="\frac{dS}{S} = (r - q)\,dt + \sigma\,dW_t^{\mathbb{Q}}" />
        </MathBox>

        <P>The Feynman-Kac theorem connects the PDE solution to the expectation:</P>
        <MathBox>
          <MathBlock tex="V(S, t) = e^{-r(T-t)}\,\mathbb{E}^{\mathbb{Q}}\!\left[\,\text{payoff}(S_T)\;\big|\;S_t = S\,\right]" />
        </MathBox>

        <P>
          This is the fundamental theorem of asset pricing: the no-arbitrage price equals the
          discounted expected payoff under the risk-neutral measure. For a European call:
        </P>
        <MathBox>
          <MathBlock tex="C = e^{-rT}\,\mathbb{E}^{\mathbb{Q}}\!\left[\max(S_T - K,\; 0)\right]" />
        </MathBox>

        <P>
          Since <InlineMath tex="\ln S_T \sim \mathcal{N}\!\left(\ln S + (r - q - \frac{\sigma^2}{2})T,\;\sigma^2 T\right)" /> under <InlineMath tex="\mathbb{Q}" />,
          evaluating this expectation analytically yields the BSM closed-form formula.
        </P>
      </Section>

      {/* ── 7. GREEKS ───────────────────────────────────────────── */}
      <Section title="Analytical Greeks">
        <P>
          First-order sensitivities of the BSM price (European call, with continuous dividend yield):
        </P>

        <MathBox>
          <MathBlock tex="\Delta_C = e^{-qT} N(d_1)" />
          <MathBlock tex="\Gamma = \frac{e^{-qT}\, n(d_1)}{S\sigma\sqrt{T}}" />
          <MathBlock tex="\mathcal{V} = S\,e^{-qT}\,n(d_1)\sqrt{T}" />
          <MathBlock tex="\Theta_C = -\frac{S\sigma e^{-qT} n(d_1)}{2\sqrt{T}} - rKe^{-rT}N(d_2) + qSe^{-qT}N(d_1)" />
          <MathBlock tex="\rho_C = KTe^{-rT}N(d_2)" />
        </MathBox>

        <P>Higher-order Greeks:</P>
        <MathBox>
          <MathBlock tex="\text{Vanna} = -e^{-qT}\frac{n(d_1)\,d_2}{\sigma}" />
          <MathBlock tex="\text{Volga} = S\,e^{-qT}\,n(d_1)\sqrt{T}\,\frac{d_1\,d_2}{\sigma}" />
        </MathBox>

        <P>
          Gamma and Vega are identical for calls and puts. Theta convention: per annum
          (divide by 365 for per calendar day).
          Vega is per unit change in <InlineMath tex="\sigma" />, not per percentage point.
        </P>
      </Section>

      {/* ── 8. ASSUMPTIONS ──────────────────────────────────────── */}
      <Section title="Assumptions & Limitations">
        <div className="space-y-2">
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Log-normal dynamics</p>
            <P>
              Returns are normally distributed, prices are log-normal. This excludes jumps,
              stochastic volatility, and fat tails observed in real markets.
            </P>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Constant volatility</p>
            <P>
              <InlineMath tex="\sigma" /> is fixed over the option&apos;s life. In reality, implied volatility
              varies by strike (smile/skew) and expiry (term structure). This is the model&apos;s
              most significant limitation.
            </P>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Constant risk-free rate</p>
            <P>
              <InlineMath tex="r" /> is constant and known. For short-dated options this is reasonable;
              for longer tenors, stochastic rates matter.
            </P>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Frictionless markets</p>
            <P>
              No transaction costs, no bid-ask spread, no margin requirements, unlimited
              borrowing/lending at the risk-free rate, continuous trading possible, unlimited
              short selling.
            </P>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">European exercise only</p>
            <P>
              BSM applies only to European options. American options require numerical methods
              (binomial trees, finite differences) or analytical approximations (Barone-Adesi-Whaley).
            </P>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">No dividends or continuous yield</p>
            <P>
              The basic model assumes no dividends. The Merton extension uses a continuous
              dividend yield <InlineMath tex="q" />, which is an approximation — real dividends are discrete.
            </P>
          </div>
        </div>
      </Section>

      {/* ── 9. PRACTICAL USE ────────────────────────────────────── */}
      <Section title="Practical Market Use">
        <div className="space-y-2">
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Why desks still use BSM</p>
            <P>
              BSM is the lingua franca of options markets. Traders quote options in terms of
              BSM implied volatility, not price. The model provides a common reference frame,
              even though everyone knows the assumptions are violated.
              Greeks from BSM are fast to compute and intuitive for hedging.
            </P>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Where BSM breaks</p>
            <ul className="list-inside list-disc space-y-0.5 text-[11px] text-[var(--text-secondary)] pl-1">
              <li>Volatility smile/skew — deep OTM puts are mispriced under flat vol</li>
              <li>Jump risk — crash events (1987, 2008, 2020) produce fat tails</li>
              <li>Discrete hedging — in practice you can only rebalance periodically</li>
              <li>Transaction costs — each rebalance incurs bid-ask and commissions</li>
              <li>Early exercise — American-style options have early exercise premium</li>
              <li>Liquidity — deep OTM/ITM options may have wide spreads</li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Why implied volatility</p>
            <P>
              Since BSM assumes constant <InlineMath tex="\sigma" /> but market prices imply different
              volatilities for different strikes and expiries, traders invert the BSM formula to extract
              the &quot;implied vol&quot; — the <InlineMath tex="\sigma" /> that makes BSM match the market price.
              Implied vol is a more stable and intuitive quoting convention than raw price.
              The vol surface (smile × term structure) encodes the market&apos;s view of the true
              dynamics beyond BSM.
            </P>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Beyond BSM</p>
            <P>
              Models that address BSM limitations include: local volatility (Dupire),
              stochastic volatility (Heston, SABR), jump-diffusion (Merton), and
              rough volatility. Each makes different trade-offs between calibration quality,
              computational cost, and hedge stability.
            </P>
          </div>
        </div>
      </Section>
    </div>
  );
}
