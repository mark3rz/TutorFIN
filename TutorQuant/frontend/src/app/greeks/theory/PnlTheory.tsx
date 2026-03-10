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

export function PnlTheory() {
  return (
    <div className="space-y-0">

      <Section title="Taylor Expansion" defaultOpen={true}>
        <P>
          The change in option value under small parameter moves can be approximated by a
          Taylor expansion around the current state:
        </P>
        <MathBox>
          <MathBlock tex="\delta V \approx \Delta\,\delta S + \tfrac{1}{2}\Gamma\,(\delta S)^2 + \mathcal{V}\,\delta\sigma + \Theta\,\delta t" />
        </MathBox>
        <P>
          Each term corresponds to a Greek-based P&L attribution. Higher-order terms
          (vanna, volga, charm) and cross terms are captured in the &quot;unexplained&quot;
          residual.
        </P>
      </Section>

      <Section title="P&L Attribution" defaultOpen={true}>
        <P>The decomposition assigns P&L to each risk factor:</P>
        <ul className="list-inside list-disc space-y-1.5 text-[11px] text-[var(--text-secondary)] pl-1">
          <li><InlineMath tex="\Delta \cdot \delta S" /> — directional spot exposure</li>
          <li><InlineMath tex="\tfrac{1}{2}\Gamma \cdot (\delta S)^2" /> — convexity / gamma P&L</li>
          <li><InlineMath tex="\mathcal{V} \cdot \delta\sigma" /> — volatility sensitivity</li>
          <li><InlineMath tex="\Theta \cdot \delta t" /> — time decay (negative for long options)</li>
        </ul>
        <P>
          The actual P&L is computed by full repricing under the shocked parameters.
          The unexplained residual is: actual P&L minus the sum of Greek P&L contributions.
        </P>
      </Section>

      <Section title="Why Unexplained Arises">
        <P>
          The Taylor expansion is only a local approximation. The residual captures:
        </P>
        <ul className="list-inside list-disc space-y-1 text-[11px] text-[var(--text-secondary)] pl-1">
          <li>Third-order terms (speed, colour, etc.)</li>
          <li>Cross-gamma: vanna (<InlineMath tex="\partial\Delta/\partial\sigma" />) interaction between <InlineMath tex="\delta S" /> and <InlineMath tex="\delta\sigma" /></li>
          <li>Volga (<InlineMath tex="\partial\mathcal{V}/\partial\sigma" />) for large vol moves</li>
          <li>Non-linearity of Greeks over the shock size</li>
        </ul>
        <P>
          For small shocks (1-day, normal market conditions), the unexplained is typically
          less than 5% of total P&L. For large moves (crash scenarios), it can be substantial.
        </P>
      </Section>

      <Section title="Scenario Grid">
        <P>
          The scenario grid shows option P&L across a matrix of simultaneous spot and
          volatility shocks. This is a standard risk tool used by options desks to
          visualise the joint sensitivity of a position to the two primary risk factors.
        </P>
        <P>
          The heatmap reveals important features: long gamma positions profit from large
          spot moves regardless of direction, while long vega positions profit from
          vol increases.
        </P>
      </Section>

      <Section title="Practical Use">
        <div className="space-y-2">
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Daily P&L explain</p>
            <P>
              Trading desks decompose daily P&L into delta, gamma, vega, and theta
              contributions. This helps identify whether P&L came from market moves
              (delta/gamma), vol changes (vega), or time passing (theta).
            </P>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Risk limits</p>
            <P>
              Risk limits are often expressed in Greek terms: maximum delta, maximum gamma,
              maximum vega exposure. P&L explain validates that the position behaves as
              the Greeks predict.
            </P>
          </div>
        </div>
      </Section>
    </div>
  );
}
