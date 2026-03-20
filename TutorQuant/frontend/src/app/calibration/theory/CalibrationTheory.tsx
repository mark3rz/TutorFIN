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

export function CalibrationTheory() {
  return (
    <div className="space-y-0">

      <Section title="Calibration Overview" defaultOpen={true}>
        <P>
          Model calibration is the process of finding parameter values that best
          reproduce observed market prices. The general problem is:
        </P>
        <MathBox>
          <MathBlock tex="\hat{\boldsymbol{\theta}} = \arg\min_{\boldsymbol{\theta}} \sum_{i=1}^{N} \bigl(y_i^{\text{model}}(\boldsymbol{\theta}) - y_i^{\text{market}}\bigr)^2" />
        </MathBox>
        <P>
          where <InlineMath tex="\boldsymbol{\theta}" /> is the parameter vector,{" "}
          <InlineMath tex="y_i^{\text{model}}" /> is the model output, and{" "}
          <InlineMath tex="y_i^{\text{market}}" /> is the observed market value.
        </P>
      </Section>

      <Section title="SVI Parameterisation">
        <P>
          The SVI (Stochastic Volatility Inspired) model parameterises total
          implied variance <InlineMath tex="w(k) = \sigma_{\text{BS}}^2 T" /> as
          a function of log-moneyness <InlineMath tex="k = \ln(K/F)" />:
        </P>
        <MathBox>
          <MathBlock tex="w(k) = a + b\!\left(\rho(k-m) + \sqrt{(k-m)^2 + \sigma^2}\right)" />
        </MathBox>
        <SymDef symbol="a" desc="Overall level of variance (vertical shift)" />
        <SymDef symbol="b" desc="Slope of the wings" />
        <SymDef symbol="\rho" desc="Skew parameter (-1 < rho < 1)" />
        <SymDef symbol="m" desc="Horizontal shift of the smile minimum" />
        <SymDef symbol="\sigma" desc="ATM curvature / smoothness" />
        <P>
          The SVI form is analytically tractable and fits equity smiles well.
          At <InlineMath tex="k=m" />, the total variance equals{" "}
          <InlineMath tex="a + b\sigma" />.
        </P>
      </Section>

      <Section title="SVI Arbitrage Conditions">
        <P>
          A valid SVI surface must be free of static arbitrage. Key conditions:
        </P>
        <P>
          <strong>Butterfly arbitrage:</strong> The implied density{" "}
          <InlineMath tex="g(k) \geq 0" /> everywhere. This requires{" "}
          <InlineMath tex="w(k) \geq 0" /> and sufficient convexity.
        </P>
        <P>
          <strong>Roger Lee bound:</strong> The wing growth rate is constrained:
        </P>
        <MathBox>
          <MathBlock tex="b(1 + |\rho|) < 4" />
        </MathBox>
        <P>
          <strong>Calendar spread:</strong> Total variance must be non-decreasing
          in maturity: <InlineMath tex="w(k, T_1) \leq w(k, T_2)" /> for{" "}
          <InlineMath tex="T_1 < T_2" />.
        </P>
      </Section>

      <Section title="Rate Model Calibration">
        <P>
          For short-rate models (Vasicek, CIR), calibration matches model-implied
          zero rates to the observed yield curve. The model bond price is:
        </P>
        <MathBox>
          <MathBlock tex="P(0,T) = A(T)e^{-B(T)r_0}" />
        </MathBox>
        <P>
          and the model zero rate is:
        </P>
        <MathBox>
          <MathBlock tex="R(0,T) = -\frac{\ln P(0,T)}{T} = \frac{B(T)r_0 - \ln A(T)}{T}" />
        </MathBox>
        <P>
          The objective minimises the SSE between model and market zero rates
          across all maturities, optimising over{" "}
          <InlineMath tex="(\kappa, \theta, \sigma)" />.
        </P>
      </Section>

      <Section title="Error Diagnostics">
        <P>
          Calibration quality is assessed via several error metrics:
        </P>
        <SymDef symbol="\text{RMSE}" desc="Root mean squared error" />
        <SymDef symbol="\text{MAE}" desc="Mean absolute error" />
        <SymDef symbol="\text{MAPE}" desc="Mean absolute percentage error" />
        <SymDef symbol="R^2" desc="Coefficient of determination" />
        <MathBox>
          <MathBlock tex="R^2 = 1 - \frac{\text{SSE}}{\text{SS}_{\text{tot}}} = 1 - \frac{\sum(y_i - \hat{y}_i)^2}{\sum(y_i - \bar{y})^2}" />
        </MathBox>
        <P>
          An <InlineMath tex="R^2" /> close to 1 indicates the model captures
          nearly all variation in the market data.
        </P>
      </Section>

      <Section title="Optimisation Methods">
        <P>
          The framework supports multiple optimisation algorithms:
        </P>
        <P>
          <strong>L-BFGS-B:</strong> Quasi-Newton method with box constraints.
          Fast for smooth objectives. Uses gradient approximation.
        </P>
        <P>
          <strong>Nelder-Mead:</strong> Simplex-based derivative-free method.
          Robust but slower. Good for non-smooth or noisy objectives.
        </P>
        <P>
          <strong>Differential Evolution:</strong> Global optimiser that explores
          the full parameter space. Avoids local minima but much slower.
        </P>
      </Section>

      <Section title="Extension Notes">
        <P>
          Future production calibration could include:
        </P>
        <P>
          &bull; SABR and Heston stochastic volatility calibration<br />
          &bull; Nelson-Siegel / Svensson yield curve fitting<br />
          &bull; Joint calibration across instruments<br />
          &bull; Regularisation terms to penalise extreme parameters<br />
          &bull; Weighted objectives (Vega-weighted for vol surfaces)<br />
          &bull; Real-time re-calibration with streaming market data
        </P>
      </Section>

    </div>
  );
}
