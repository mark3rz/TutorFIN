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

export function EncyclopediaTheory() {
  return (
    <div className="space-y-0">

      <Section title="Model Selection Guide" defaultOpen={true}>
        <P>
          Choosing the right model depends on the <strong>instrument</strong>,
          the <strong>market regime</strong>, and the required{" "}
          <strong>accuracy vs speed</strong> trade-off.
        </P>
        <P>
          <strong>Rule of thumb:</strong> Start with the simplest model that
          captures the essential risk factor, then add complexity only if the
          pricing error exceeds the bid-ask spread.
        </P>
      </Section>

      <Section title="When to Use BSM">
        <P>
          Black-Scholes is correct to use when:
        </P>
        <P>
          &bull; Quoting European options in implied vol space<br />
          &bull; Computing delta/gamma hedges for liquid underlyings<br />
          &bull; Quick screening and relative value<br />
          &bull; The smile is moderate and time to expiry is not extreme
        </P>
        <P>
          BSM is <strong>not</strong> a model of reality — it is a{" "}
          <strong>translation device</strong> from prices to implied vol.
          The real information is in the vol surface, not in BSM.
        </P>
      </Section>

      <Section title="Monte Carlo vs Trees">
        <P>
          <strong>Trees</strong> excel at low-dimensional problems with early
          exercise (American options). They are exact for BSM dynamics and
          converge smoothly.
        </P>
        <P>
          <strong>Monte Carlo</strong> excels at high-dimensional problems
          (baskets, path-dependent payoffs) and complex dynamics (stochastic
          vol, jumps). Convergence is slow (<InlineMath tex="O(1/\sqrt{N})" />)
          but dimension-independent.
        </P>
        <MathBox>
          <MathBlock tex="\text{Standard error} = \frac{\sigma_{\text{payoff}}}{\sqrt{N}}" />
        </MathBox>
        <P>
          Doubling accuracy requires <InlineMath tex="4\times" /> more paths.
          Variance reduction (antithetic, control variate, importance sampling)
          is essential for production Monte Carlo.
        </P>
      </Section>

      <Section title="Rate Model Hierarchy">
        <P>
          Short-rate models form a natural progression:
        </P>
        <P>
          <strong>Vasicek</strong> → simplest, Gaussian, allows negative rates<br />
          <strong>CIR</strong> → adds positivity via <InlineMath tex="\sqrt{r}" /> diffusion<br />
          <strong>Hull-White</strong> → adds exact initial curve fit via{" "}
          <InlineMath tex="\theta(t)" />
        </P>
        <P>
          In practice, <strong>Hull-White is the industry standard</strong> for
          interest rate derivatives because it fits the initial term structure
          exactly (no-arbitrage). Vasicek and CIR are primarily teaching tools.
        </P>
      </Section>

      <Section title="Vol Surface Models">
        <P>
          The vol surface is the bridge between market prices and model
          parameters. Three approaches:
        </P>
        <P>
          <strong>1. Parametric (SVI):</strong> Fit a functional form to
          observed IVs. Fast, smooth, but static — no dynamics.
        </P>
        <P>
          <strong>2. Stochastic vol (Heston, SABR):</strong> Model vol as a
          random process. Captures smile dynamics but requires calibration.
        </P>
        <P>
          <strong>3. Local vol (Dupire):</strong> Infer a deterministic vol
          surface from market prices. Exact fit but poor forward-vol dynamics.
        </P>
        <MathBox>
          <MathBlock tex="\sigma_{\text{loc}}^2(K,T) = \frac{\partial w / \partial T}{1 - \frac{k}{w}\frac{\partial w}{\partial k} + \frac{1}{4}\left(-\frac{1}{4} - \frac{1}{w} + \frac{k^2}{w^2}\right)\!\left(\frac{\partial w}{\partial k}\right)^{\!2} + \frac{1}{2}\frac{\partial^2 w}{\partial k^2}}" />
        </MathBox>
      </Section>

      <Section title="Calibration Philosophy">
        <P>
          <strong>No model is correct.</strong> Calibration is the process of
          finding the <em>least wrong</em> parameters. Key principles:
        </P>
        <P>
          &bull; Calibrate to <strong>liquid instruments</strong> (avoid stale
          quotes)<br />
          &bull; Use <strong>vega-weighted</strong> objectives for vol
          calibration<br />
          &bull; Check for <strong>arbitrage</strong> (butterfly, calendar
          spread)<br />
          &bull; Monitor <strong>parameter stability</strong> over time —
          unstable params signal model mis-specification
        </P>
      </Section>

      <Section title="Risk Management View">
        <P>
          From a risk perspective, the key question is not &quot;which model is
          best?&quot; but &quot;what is the model risk?&quot;
        </P>
        <P>
          <strong>Model risk</strong> is the potential loss from using an
          incorrect model. It is highest when:
        </P>
        <P>
          &bull; Pricing illiquid or exotic instruments<br />
          &bull; Extrapolating beyond calibrated ranges<br />
          &bull; Using a model outside its intended regime<br />
          &bull; Hedging with Greeks from a mis-specified model
        </P>
        <P>
          <strong>Best practice:</strong> Run P&amp;L attribution using
          multiple models. If they disagree significantly, the model risk is
          high and additional reserves may be warranted.
        </P>
      </Section>

    </div>
  );
}
