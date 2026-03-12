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

export function RateModelTheory() {
  return (
    <div className="space-y-0">

      <Section title="Short-Rate Framework" defaultOpen={true}>
        <P>
          Short-rate models describe the instantaneous risk-free rate{" "}
          <InlineMath tex="r(t)" /> as a stochastic process. All three models
          here are <strong>one-factor affine</strong> models: bond prices take the
          form <InlineMath tex="P(t,T) = A(t,T)e^{-B(t,T)r(t)}" />, enabling
          fast analytical pricing.
        </P>
        <P>
          The short rate determines the entire term structure of interest rates.
          A zero-coupon bond paying $1 at time <InlineMath tex="T" /> has price:
        </P>
        <MathBox>
          <MathBlock tex="P(0,T) = \mathbb{E}^{\mathbb{Q}}\!\left[\exp\!\left(-\int_0^T r(s)\,ds\right)\right]" />
        </MathBox>
      </Section>

      <Section title="Vasicek Model">
        <P>
          The Vasicek model is the simplest mean-reverting short-rate model,
          driven by an Ornstein-Uhlenbeck process:
        </P>
        <MathBox>
          <MathBlock tex="dr(t) = \kappa\bigl(\theta - r(t)\bigr)\,dt + \sigma\,dW(t)" />
        </MathBox>
        <SymDef symbol="\kappa" desc="Speed of mean reversion" />
        <SymDef symbol="\theta" desc="Long-run equilibrium rate" />
        <SymDef symbol="\sigma" desc="Volatility (constant)" />
        <P>
          The transition distribution is Gaussian:
        </P>
        <MathBox>
          <MathBlock tex="r(T) \sim \mathcal{N}\!\left(r_0 e^{-\kappa T} + \theta(1-e^{-\kappa T}),\; \frac{\sigma^2}{2\kappa}(1-e^{-2\kappa T})\right)" />
        </MathBox>
        <P>
          <strong>Bond price:</strong>
        </P>
        <MathBox>
          <MathBlock tex="B(T) = \frac{1-e^{-\kappa T}}{\kappa}" />
        </MathBox>
        <MathBox>
          <MathBlock tex="\ln A(T) = \frac{(B-T)(\kappa^2\theta - \sigma^2/2)}{\kappa^2} - \frac{\sigma^2 B^2}{4\kappa}" />
        </MathBox>
      </Section>

      <Section title="CIR Model">
        <P>
          The Cox-Ingersoll-Ross model adds level-dependent volatility,
          ensuring rates stay positive (under the Feller condition):
        </P>
        <MathBox>
          <MathBlock tex="dr(t) = \kappa\bigl(\theta - r(t)\bigr)\,dt + \sigma\sqrt{r(t)}\,dW(t)" />
        </MathBox>
        <P>
          <strong>Feller condition:</strong> if{" "}
          <InlineMath tex="2\kappa\theta \geq \sigma^2" />, the origin is
          unattainable and rates remain strictly positive.
        </P>
        <P>
          The transition distribution follows a scaled non-central chi-squared
          distribution. Bond prices have the same affine form but with:
        </P>
        <MathBox>
          <MathBlock tex="\gamma = \sqrt{\kappa^2 + 2\sigma^2}" />
        </MathBox>
        <MathBox>
          <MathBlock tex="B(T) = \frac{2(e^{\gamma T}-1)}{(\gamma+\kappa)(e^{\gamma T}-1)+2\gamma}" />
        </MathBox>
        <MathBox>
          <MathBlock tex="A(T) = \left[\frac{2\gamma\, e^{(\kappa+\gamma)T/2}}{(\gamma+\kappa)(e^{\gamma T}-1)+2\gamma}\right]^{\!2\kappa\theta/\sigma^2}" />
        </MathBox>
      </Section>

      <Section title="Hull-White Model">
        <P>
          Hull-White extends Vasicek by allowing the drift target to be
          time-dependent, enabling an exact fit to the observed yield curve:
        </P>
        <MathBox>
          <MathBlock tex="dr(t) = \bigl[\theta(t) - a\,r(t)\bigr]\,dt + \sigma\,dW(t)" />
        </MathBox>
        <P>
          When <InlineMath tex="\theta(t)" /> is constant, this reduces to the
          Vasicek model with <InlineMath tex="\kappa=a" /> and long-run mean{" "}
          <InlineMath tex="\theta/a" />. In practice,{" "}
          <InlineMath tex="\theta(t)" /> is calibrated so that the model
          reproduces all observed zero-coupon bond prices exactly.
        </P>
        <P>
          This is the most widely used one-factor model in practice for
          swaption pricing and interest-rate risk management.
        </P>
      </Section>

      <Section title="Mean Reversion">
        <P>
          All three models exhibit mean reversion: when the short rate is
          above the long-run level, the drift pulls it down, and vice versa.
          The half-life of mean reversion is:
        </P>
        <MathBox>
          <MathBlock tex="t_{1/2} = \frac{\ln 2}{\kappa}" />
        </MathBox>
        <P>
          For <InlineMath tex="\kappa = 0.5" />, the half-life is about 1.4
          years. Higher <InlineMath tex="\kappa" /> means faster reversion.
        </P>
      </Section>

      <Section title="Simulation Methods">
        <P>
          <strong>Vasicek / Hull-White:</strong> exact simulation using the
          known Gaussian transition distribution (no discretisation error).
        </P>
        <P>
          <strong>CIR:</strong> full-truncation Euler scheme:{" "}
          <InlineMath tex="r^+ = \max(r, 0)" /> is used in both drift and
          diffusion to ensure non-negativity, with superior convergence
          properties compared to simple reflection or absorption schemes.
        </P>
      </Section>

      <Section title="Key Differences">
        <P>
          <strong>Positivity:</strong> Vasicek and Hull-White are Gaussian and
          can produce negative rates. CIR guarantees positive rates when the
          Feller condition holds.
        </P>
        <P>
          <strong>Volatility:</strong> Vasicek/HW have constant vol. CIR has
          level-dependent vol (<InlineMath tex="\sigma\sqrt{r}" />), meaning
          higher rates produce higher volatility — matching empirical
          observations.
        </P>
        <P>
          <strong>Calibration:</strong> Hull-White can fit any initial yield
          curve exactly via <InlineMath tex="\theta(t)" />. Vasicek and CIR
          have limited shape flexibility.
        </P>
      </Section>

    </div>
  );
}
