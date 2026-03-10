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

export function TreeTheory() {
  return (
    <div className="space-y-0">

      <Section title="CRR Binomial Tree" defaultOpen={true}>
        <P>
          The Cox-Ross-Rubinstein (CRR, 1979) binomial model discretises the continuous
          GBM dynamics into an N-step recombining lattice. At each node, the underlying
          moves up by factor <InlineMath tex="u" /> or down by factor <InlineMath tex="d" />.
        </P>
        <MathBox>
          <MathBlock tex="u = e^{\sigma\sqrt{\Delta t}}, \quad d = \frac{1}{u}, \quad \Delta t = \frac{T}{N}" />
        </MathBox>
        <P>The risk-neutral probability of an up move:</P>
        <MathBox>
          <MathBlock tex="p = \frac{e^{(r-q)\Delta t} - d}{u - d}" />
        </MathBox>
        <P>
          At each terminal node <InlineMath tex="j = 0, 1, \ldots, N" />, the asset price is
          <InlineMath tex="S_j = S_0 \, u^j \, d^{N-j}" />. Option values are obtained by backward
          induction from the terminal payoffs.
        </P>
      </Section>

      <Section title="Backward Induction">
        <P>For European options, the value at each node is the discounted expected value:</P>
        <MathBox>
          <MathBlock tex="V_{i,j} = e^{-r\Delta t}\!\left[\,p\,V_{i+1,j+1} + (1-p)\,V_{i+1,j}\,\right]" />
        </MathBox>
        <P>For American options, at each node we take the maximum of continuation and immediate exercise:</P>
        <MathBox>
          <MathBlock tex="V_{i,j} = \max\!\left(\text{intrinsic}_{i,j},\; e^{-r\Delta t}\!\left[p\,V_{i+1,j+1} + (1-p)\,V_{i+1,j}\right]\right)" />
        </MathBox>
        <P>
          This is why tree models are essential for American options: the BSM closed-form
          does not account for early exercise.
        </P>
      </Section>

      <Section title="Trinomial Tree">
        <P>
          The trinomial tree adds a middle (stay) node. The Kamrad-Ritchken (1991)
          parameterisation uses <InlineMath tex="\lambda = \sqrt{3/2}" />:
        </P>
        <MathBox>
          <MathBlock tex="u = e^{\lambda\sigma\sqrt{\Delta t}}, \quad d = \frac{1}{u}, \quad m = 1" />
        </MathBox>
        <P>Transition probabilities:</P>
        <MathBox>
          <MathBlock tex="p_u = \frac{1}{2\lambda^2} + \frac{(r - q - \frac{\sigma^2}{2})\sqrt{\Delta t}}{2\lambda\sigma}" />
          <MathBlock tex="p_d = \frac{1}{2\lambda^2} - \frac{(r - q - \frac{\sigma^2}{2})\sqrt{\Delta t}}{2\lambda\sigma}" />
          <MathBlock tex="p_m = 1 - p_u - p_d" />
        </MathBox>
        <P>
          Trinomial trees typically converge faster than binomial trees for the same number
          of steps.
        </P>
      </Section>

      <Section title="Convergence to BSM">
        <P>
          Both binomial and trinomial trees converge to the BSM price as <InlineMath tex="N \to \infty" />,
          with convergence rate <InlineMath tex="O(1/N)" />. The CRR binomial exhibits
          oscillation between even and odd <InlineMath tex="N" /> due to whether the strike
          falls on a node. Richardson extrapolation (averaging even/odd) can improve convergence.
        </P>
        <P>
          For practical use, <InlineMath tex="N \geq 100" /> typically gives sub-penny accuracy
          for standard equity options.
        </P>
      </Section>

      <Section title="American Options">
        <P>Key results for American option pricing:</P>
        <ul className="list-inside list-disc space-y-1 text-[11px] text-[var(--text-secondary)] pl-1">
          <li>American call on non-dividend stock = European call (no early exercise)</li>
          <li>American put on non-dividend stock has early exercise premium</li>
          <li>High dividend yield can make American call early exercise optimal</li>
          <li>Early exercise boundary can be extracted from the tree</li>
        </ul>
      </Section>

      <Section title="Assumptions & Limitations">
        <div className="space-y-2">
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Recombining tree assumption</p>
            <P>CRR requires <InlineMath tex="ud = 1" />, which forces a recombining lattice.
            Non-recombining trees (e.g. for path-dependent options) have exponential growth in nodes.</P>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Constant volatility</p>
            <P>Standard tree models assume constant <InlineMath tex="\sigma" />. Implied binomial trees
            (Rubinstein, 1994) can match an arbitrary implied vol smile.</P>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Discrete vs continuous</p>
            <P>Trees are inherently discrete. Increasing <InlineMath tex="N" /> improves accuracy but
            increases computation time linearly.</P>
          </div>
        </div>
      </Section>
    </div>
  );
}
