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

export function SwapTheory() {
  return (
    <div className="space-y-0">

      <Section title="Swap Fundamentals" defaultOpen={true}>
        <P>
          An interest rate swap (IRS) is an agreement between two parties to
          exchange periodic interest payments on a notional principal{" "}
          <InlineMath tex="N" />. The most common structure is a{" "}
          <strong>fixed-for-floating</strong> (vanilla) swap.
        </P>
        <P>
          The <strong>payer</strong> pays fixed and receives floating.
          The <strong>receiver</strong> pays floating and receives fixed.
        </P>
        <SymDef symbol="N" desc="Notional principal (not exchanged)" />
        <SymDef symbol="c" desc="Fixed coupon rate (annualised)" />
        <SymDef symbol="L_i" desc="Floating rate for period i" />
        <SymDef symbol="\tau_i" desc="Year fraction (day count) for period i" />
      </Section>

      <Section title="Fixed Leg Valuation">
        <P>
          The fixed leg pays{" "}
          <InlineMath tex="N \cdot c \cdot \tau_i" /> at each payment date.
          Its present value is:
        </P>
        <MathBox>
          <MathBlock tex="PV_{\text{fixed}} = N \cdot c \sum_{i=1}^{n} \tau_i \cdot D(t_i)" />
        </MathBox>
        <P>
          where <InlineMath tex="D(t_i) = e^{-r_i \cdot t_i}" /> is the
          discount factor at payment date <InlineMath tex="t_i" />.
        </P>
      </Section>

      <Section title="Floating Leg Valuation">
        <P>
          The floating leg pays{" "}
          <InlineMath tex="N \cdot L_i \cdot \tau_i" /> where{" "}
          <InlineMath tex="L_i" /> is the forward rate for period{" "}
          <InlineMath tex="[t_{i-1}, t_i]" />:
        </P>
        <MathBox>
          <MathBlock tex="L_i = F(t_{i-1}, t_i) = \frac{1}{\tau_i}\ln\frac{D(t_{i-1})}{D(t_i)}" />
        </MathBox>
        <P>
          The floating leg PV simplifies to a telescoping sum:
        </P>
        <MathBox>
          <MathBlock tex="PV_{\text{float}} = N \bigl(D(0) - D(T_n)\bigr) = N \bigl(1 - D(T_n)\bigr)" />
        </MathBox>
        <P>
          This elegant result means the floating leg PV equals the difference
          between the initial and final discount factors.
        </P>
      </Section>

      <Section title="Par Swap Rate">
        <P>
          The <strong>par swap rate</strong> is the fixed rate{" "}
          <InlineMath tex="c^*" /> that makes the swap NPV zero at inception:
        </P>
        <MathBox>
          <MathBlock tex="c^* = \frac{1 - D(T_n)}{\sum_{i=1}^{n} \tau_i \cdot D(t_i)} = \frac{1 - D(T_n)}{A}" />
        </MathBox>
        <P>
          where <InlineMath tex="A = \sum \tau_i D(t_i)" /> is the{" "}
          <strong>annuity factor</strong> (or PV01 per unit notional). The par
          swap rate is the fundamental building block of the swap curve.
        </P>
      </Section>

      <Section title="DV01 & Sensitivity">
        <P>
          The <strong>DV01</strong> (dollar value of one basis point) measures
          the change in NPV for a 1 bp parallel shift in rates:
        </P>
        <MathBox>
          <MathBlock tex="\text{DV01} = N \cdot A \cdot 0.0001" />
        </MathBox>
        <P>
          For a $100M 5-year swap with annuity factor 4.5, DV01 is approximately
          $45,000 — a 1 bp rate move changes the NPV by $45k.
        </P>
        <P>
          <strong>Convexity:</strong> the second-order sensitivity captures
          the curvature of the NPV-rate relationship. Positive convexity means
          the swap gains more from falling rates than it loses from rising rates.
        </P>
      </Section>

      <Section title="OIS Discounting">
        <P>
          <strong>Pre-crisis:</strong> LIBOR was used for both forward projection
          and discounting, assuming banks could borrow at LIBOR risk-free.
        </P>
        <P>
          <strong>Post-crisis:</strong> the market moved to a{" "}
          <strong>dual-curve framework</strong> where:
        </P>
        <P>
          1. The <strong>OIS curve</strong> (based on overnight rates like SOFR)
          is used for discounting — reflecting the collateral rate under CSA.
        </P>
        <P>
          2. A separate <strong>projection curve</strong> (SOFR term rates) is
          used to estimate forward rates for the floating leg.
        </P>
        <P>
          This separation recognises that the discount rate should reflect the
          cost of funding collateral, not the interbank credit risk embedded in
          LIBOR.
        </P>
      </Section>

      <Section title="Basis Swaps">
        <P>
          A <strong>basis swap</strong> exchanges two floating rates — typically
          at different tenors (e.g. 3M vs 1M SOFR) or different indices.
        </P>
        <P>
          The <strong>basis spread</strong> compensates for differences in credit
          risk, liquidity, and supply-demand dynamics between the two indices.
          The par basis spread makes the swap NPV zero at inception.
        </P>
        <P>
          <strong>Tenor basis:</strong> longer-tenor fixings embed more credit
          risk, so the 3M rate trades above 1M by a tenor basis of 5-20 bps.
        </P>
      </Section>

      <Section title="Cross-Currency Swaps">
        <P>
          A <strong>cross-currency swap</strong> (XCCY) exchanges payments in
          two currencies. Unlike single-currency swaps, there is an exchange of
          notionals at inception and maturity.
        </P>
        <P>
          The <strong>XCCY basis</strong> spread on the non-USD leg reflects
          relative funding costs. A negative USD/EUR basis means EUR-based
          entities pay a premium to borrow USD synthetically.
        </P>
        <MathBox>
          <MathBlock tex="\text{NPV} = PV_{\text{dom}} - S_0 \cdot PV_{\text{for}}" />
        </MathBox>
        <P>
          where <InlineMath tex="S_0" /> is the spot FX rate (domestic per
          foreign unit).
        </P>
      </Section>

      <Section title="Market Conventions">
        <P>
          <strong>Day count:</strong> Fixed legs typically use 30/360 or
          ACT/365. Floating legs use ACT/360 (USD) or ACT/365 (GBP).
        </P>
        <P>
          <strong>Payment frequency:</strong> Fixed leg is typically semi-annual
          (USD, GBP) or annual (EUR). Floating leg resets quarterly (3M) or
          semi-annually (6M).
        </P>
        <P>
          <strong>SOFR transition:</strong> Since LIBOR cessation in June 2023,
          USD swaps reference SOFR. The market convention is
          SOFR-compounded-in-arrears with a 2-day lookback.
        </P>
      </Section>

    </div>
  );
}
