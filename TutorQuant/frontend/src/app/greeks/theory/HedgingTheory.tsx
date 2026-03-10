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

export function HedgingTheory() {
  return (
    <div className="space-y-0">

      <Section title="BSM Replication Argument" defaultOpen={true}>
        <P>
          The BSM price equals the cost of a self-financing replicating portfolio that
          continuously delta-hedges the short option position. At each instant, the
          hedge holds <InlineMath tex="\Delta = \partial V / \partial S" /> shares.
        </P>
        <P>
          In continuous time with zero transaction costs, the hedge perfectly replicates
          the option payoff, and the hedge error is identically zero. The option price
          equals the initial cost of setting up this hedge.
        </P>
      </Section>

      <Section title="Discrete Hedging Error" defaultOpen={true}>
        <P>
          In practice, hedging can only occur at discrete intervals. The hedge error
          from discrete rebalancing over one period is approximately:
        </P>
        <MathBox>
          <MathBlock tex="\epsilon_i \approx \frac{1}{2}\Gamma_i\,S_i^2\left[(\delta W_i)^2 - \Delta t\right] \cdot e^{-r(T - t_i)}" />
        </MathBox>
        <P>
          where <InlineMath tex="(\delta W_i)^2 - \Delta t" /> is the discretisation error.
          This has mean zero but positive variance. Over the option&apos;s life, these
          errors accumulate. The variance of the total hedge error scales as
          <InlineMath tex="O(\Delta t)" />, so more frequent rebalancing reduces it.
        </P>
      </Section>

      <Section title="Transaction Costs">
        <P>
          Each rebalance incurs a cost proportional to the notional traded:
        </P>
        <MathBox>
          <MathBlock tex="\text{TC}_i = c \cdot |\Delta_{i} - \Delta_{i-1}| \cdot S_i" />
        </MathBox>
        <P>
          where <InlineMath tex="c" /> is the cost rate (e.g. 10 bps). This creates a
          fundamental trade-off:
        </P>
        <ul className="list-inside list-disc space-y-1 text-[11px] text-[var(--text-secondary)] pl-1">
          <li>More frequent rebalancing reduces gamma hedging error</li>
          <li>But increases cumulative transaction costs</li>
          <li>The optimal rebalancing frequency depends on <InlineMath tex="\Gamma" />, <InlineMath tex="\sigma" />, and <InlineMath tex="c" /></li>
        </ul>
      </Section>

      <Section title="Hedge Error Distribution">
        <P>
          The distribution of hedge errors across many simulated paths shows:
        </P>
        <ul className="list-inside list-disc space-y-1 text-[11px] text-[var(--text-secondary)] pl-1">
          <li>Mean near zero (with no txn costs) — the BSM price is unbiased</li>
          <li>Positive standard deviation — hedging is inherently noisy</li>
          <li>Slight positive skew from gamma (long gamma benefits from large moves)</li>
          <li>With txn costs, the mean shifts negative (hedging costs more than BSM predicts)</li>
        </ul>
      </Section>

      <Section title="Practical Implications">
        <div className="space-y-2">
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Why option prices include txn cost premium</p>
            <P>
              Market makers add a spread to the BSM price to account for expected hedging
              costs. The Leland (1985) adjustment modifies the BSM volatility to include
              transaction costs.
            </P>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Volatility mismatch risk</p>
            <P>
              If realised volatility differs from the implied volatility used for hedging,
              the hedger earns or loses the gamma P&L difference. This is the basis of
              volatility trading.
            </P>
          </div>
        </div>
      </Section>
    </div>
  );
}
