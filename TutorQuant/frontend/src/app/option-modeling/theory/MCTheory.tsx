"use client";

import { useState } from "react";
import { MathBlock, InlineMath } from "@/components/ui/MathBlock";
import { ChevronDown, ChevronRight } from "lucide-react";

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

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{children}</p>;
}

function MathBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-[var(--border-color)] bg-[#0a0a0f] px-3 py-2.5 my-2 overflow-x-auto">
      {children}
    </div>
  );
}

export function MCTheory() {
  return (
    <div className="space-y-0">

      <Section title="Monte Carlo Pricing" defaultOpen={true}>
        <P>
          The option price under the risk-neutral measure is the discounted expected payoff:
        </P>
        <MathBox>
          <MathBlock tex="V_0 = e^{-rT}\,\mathbb{E}^{\mathbb{Q}}\!\left[\,h(S_T)\,\right]" />
        </MathBox>
        <P>
          Monte Carlo estimates this by simulating <InlineMath tex="N" /> independent paths
          of <InlineMath tex="S_T" /> and averaging:
        </P>
        <MathBox>
          <MathBlock tex="\hat{V}_N = e^{-rT}\,\frac{1}{N}\sum_{i=1}^{N} h(S_T^{(i)})" />
        </MathBox>
        <P>
          By the strong law of large numbers, <InlineMath tex="\hat{V}_N \to V_0" /> as <InlineMath tex="N \to \infty" />.
        </P>
      </Section>

      <Section title="GBM Path Simulation">
        <P>
          Under <InlineMath tex="\mathbb{Q}" />, the exact solution to the GBM SDE over a time step <InlineMath tex="\Delta t" />:
        </P>
        <MathBox>
          <MathBlock tex="S_{t+\Delta t} = S_t \cdot \exp\!\left[\left(r - q - \tfrac{\sigma^2}{2}\right)\Delta t + \sigma\sqrt{\Delta t}\,Z\right]" />
        </MathBox>
        <P>
          where <InlineMath tex="Z \sim \mathcal{N}(0,1)" />. This is the exact (not Euler-discretised) scheme —
          no discretisation bias.
        </P>
      </Section>

      <Section title="Standard Error & Confidence Interval">
        <P>The standard error of the MC estimator:</P>
        <MathBox>
          <MathBlock tex="\text{SE} = \frac{\hat{\sigma}_{\text{payoff}}}{\sqrt{N}}" />
        </MathBox>
        <P>
          A 95% confidence interval: <InlineMath tex="\hat{V}_N \pm 1.96 \cdot \text{SE}" />.
          Halving the SE requires <InlineMath tex="4\times" /> the paths.
        </P>
      </Section>

      <Section title="Antithetic Variates">
        <P>
          For each random draw <InlineMath tex="Z" />, also simulate with <InlineMath tex="-Z" />.
          The pair produces negatively correlated payoffs. The combined estimator:
        </P>
        <MathBox>
          <MathBlock tex="\hat{V} = e^{-rT}\frac{1}{N}\sum_{i=1}^{N/2}\frac{h(S_T^{(Z_i)}) + h(S_T^{(-Z_i)})}{2}" />
        </MathBox>
        <P>
          This typically reduces variance by a factor of 2–4 for smooth payoffs at zero
          additional computational cost (same number of random draws).
        </P>
      </Section>

      <Section title="Convergence Diagnostics">
        <P>
          The running mean chart shows <InlineMath tex="\hat{V}_n" /> as a function of <InlineMath tex="n" />.
          A well-behaved simulation shows the running mean stabilising with shrinking CI bands.
          Slow convergence suggests high payoff variance — consider variance reduction techniques
          (antithetic, control variates, importance sampling).
        </P>
      </Section>

      <Section title="Strengths & Limitations">
        <div className="space-y-2">
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Strengths</p>
            <ul className="list-inside list-disc space-y-0.5 text-[11px] text-[var(--text-secondary)] pl-1">
              <li>Works for any payoff, including path-dependent exotics</li>
              <li>Easy to extend to multi-factor models (Heston, jump-diffusion)</li>
              <li>Parallelisable — paths are independent</li>
              <li>Provides natural error estimates via SE</li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Limitations</p>
            <ul className="list-inside list-disc space-y-0.5 text-[11px] text-[var(--text-secondary)] pl-1">
              <li>Slow convergence: <InlineMath tex="O(1/\sqrt{N})" /></li>
              <li>Not ideal for American options (requires regression methods like LSM)</li>
              <li>Greeks require bump-and-revalue or pathwise differentiation</li>
              <li>Pseudorandom noise can introduce artifacts at low path counts</li>
            </ul>
          </div>
        </div>
      </Section>
    </div>
  );
}
