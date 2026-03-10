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

export function VaRTheory() {
  return (
    <div className="space-y-0">

      <Section title="Value at Risk (VaR)" defaultOpen={true}>
        <P>
          VaR answers the question: what is the maximum loss over a given holding period
          at a given confidence level?
        </P>
        <MathBox>
          <MathBlock tex="\text{VaR}_\alpha = -\inf\{x : P(\text{P\&L} \leq x) > 1 - \alpha\}" />
        </MathBox>
        <P>
          Equivalently, VaR is the <InlineMath tex="(1-\alpha)" />-quantile of the P&L
          distribution, reported as a positive number (loss).
        </P>
        <div className="mt-2 space-y-0.5">
          <SymDef symbol="\alpha" desc="Confidence level (e.g. 0.95, 0.99)" />
          <SymDef symbol="h" desc="Holding period in days" />
          <SymDef symbol="\sigma_P" desc="Portfolio P&L standard deviation" />
        </div>
      </Section>

      <Section title="Parametric (Delta-Normal) VaR" defaultOpen={true}>
        <P>
          Under the assumption that portfolio P&L is normally distributed:
        </P>
        <MathBox>
          <MathBlock tex="\text{VaR}_\alpha = -\mu_P + z_\alpha \cdot \sigma_P" />
        </MathBox>
        <P>where:</P>
        <MathBox>
          <MathBlock tex="\sigma_P = |\Delta_P| \cdot S \cdot \sigma \cdot \sqrt{\Delta t}" />
          <MathBlock tex="\mu_P = \Delta_P \cdot S \cdot (r - q) \cdot \Delta t" />
        </MathBox>
        <P>
          <InlineMath tex="z_\alpha" /> is the standard normal quantile:
          <InlineMath tex="z_{0.95} = 1.645" />, <InlineMath tex="z_{0.99} = 2.326" />.
        </P>
        <P>
          This is a first-order (delta) approximation. For portfolios with significant
          gamma, the delta-gamma-normal approach captures curvature effects.
        </P>
      </Section>

      <Section title="Expected Shortfall (CVaR)">
        <P>
          Expected Shortfall (also called Conditional VaR or CVaR) measures the
          average loss in the tail beyond VaR:
        </P>
        <MathBox>
          <MathBlock tex="\text{ES}_\alpha = -\mathbb{E}\!\left[\text{P\&L} \;\big|\; \text{P\&L} \leq -\text{VaR}_\alpha\right]" />
        </MathBox>
        <P>For a normal distribution:</P>
        <MathBox>
          <MathBlock tex="\text{ES}_\alpha = -\mu_P + \sigma_P \cdot \frac{\phi(z_\alpha)}{1 - \alpha}" />
        </MathBox>
        <P>
          ES is always greater than or equal to VaR. It is a coherent risk measure
          (unlike VaR) and is preferred by regulators (Basel III/IV use ES at 97.5%).
        </P>
      </Section>

      <Section title="Monte Carlo VaR">
        <P>
          Monte Carlo VaR simulates many scenarios of the underlying, reprices the
          portfolio under each scenario, and computes VaR from the empirical P&L
          distribution:
        </P>
        <ol className="list-inside list-decimal space-y-1 text-[11px] text-[var(--text-secondary)] pl-1">
          <li>Simulate <InlineMath tex="N" /> scenarios of <InlineMath tex="S_T" /> under GBM</li>
          <li>Reprice all positions under each <InlineMath tex="S_i" /></li>
          <li>Compute P&L for each scenario: <InlineMath tex="\text{P\&L}_i = V(S_i) - V(S_0)" /></li>
          <li>Sort P&L values and find the <InlineMath tex="(1-\alpha)" /> percentile</li>
        </ol>
        <P>
          MC VaR captures non-linearity (gamma) naturally but requires many scenarios
          for stable estimates. 10,000 scenarios is a reasonable minimum.
        </P>
      </Section>

      <Section title="Portfolio Greeks">
        <P>
          Portfolio-level Greeks are the sum of position-level Greeks, weighted by
          signed quantity:
        </P>
        <MathBox>
          <MathBlock tex="\Delta_P = \sum_i q_i \cdot \Delta_i, \quad \Gamma_P = \sum_i q_i \cdot \Gamma_i" />
        </MathBox>
        <P>
          where <InlineMath tex="q_i" /> is the signed quantity (positive for long, negative
          for short). This linear aggregation is exact for first-order sensitivities.
        </P>
      </Section>

      <Section title="Assumptions & Limitations">
        <div className="space-y-2">
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Single underlying</p>
            <P>
              This implementation assumes all options are on the same underlying.
              Multi-asset VaR requires correlation modelling.
            </P>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Normal distribution</p>
            <P>
              Parametric VaR assumes normally distributed returns. In reality, returns
              have fat tails — VaR can underestimate tail risk. ES partially addresses
              this by focusing on tail average.
            </P>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Constant volatility</p>
            <P>
              VaR uses a single volatility estimate. Stochastic volatility models and
              GARCH can provide more realistic tail estimates.
            </P>
          </div>
        </div>
      </Section>
    </div>
  );
}
