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

export function FixedIncomeTheory() {
  return (
    <div className="space-y-0">

      <Section title="Bond Pricing" defaultOpen={true}>
        <P>
          A fixed-coupon bond pays periodic coupons and returns face value
          at maturity. Its price equals the present value of all future cash flows,
          discounted at the yield to maturity <InlineMath tex="y" />:
        </P>
        <MathBox>
          <MathBlock tex="P = \sum_{i=1}^{N} \frac{C/m}{(1 + y/m)^{n_i}} + \frac{F}{(1 + y/m)^{n_N}}" />
        </MathBox>
        <SymDef symbol="C" desc="Annual coupon (= coupon rate x face value)" />
        <SymDef symbol="m" desc="Coupon frequency (e.g., 2 for semi-annual)" />
        <SymDef symbol="F" desc="Face (par) value" />
        <SymDef symbol="n_i" desc="Periods to cash flow i" />
        <P>
          The price is inversely related to yield: as yields rise, the present value
          of future cash flows falls, and vice versa. This convex relationship is
          central to fixed-income risk management.
        </P>
      </Section>

      <Section title="Clean vs Dirty Price">
        <P>
          The <strong>dirty price</strong> (or full price) is what the buyer
          actually pays. The <strong>clean price</strong> strips out accrued
          interest, which compensates the seller for holding the bond between
          coupon dates:
        </P>
        <MathBox>
          <MathBlock tex="P_{\text{dirty}} = P_{\text{clean}} + \text{AI}" />
        </MathBox>
        <MathBox>
          <MathBlock tex="\text{AI} = \frac{C}{m} \times \frac{\text{days since last coupon}}{\text{days in coupon period}}" />
        </MathBox>
        <P>
          Bonds are quoted at clean prices (to remove the sawtooth pattern from
          accruing interest) but settle at dirty prices. The settlement offset
          parameter <InlineMath tex="\alpha \in [0,1)" /> represents the fraction
          of the current coupon period that has elapsed.
        </P>
      </Section>

      <Section title="Yield to Maturity">
        <P>
          The YTM is the single discount rate that equates the present value
          of all remaining cash flows to the dirty market price:
        </P>
        <MathBox>
          <MathBlock tex="P_{\text{dirty}} = \sum_{i=1}^{N} \frac{CF_i}{(1 + y/m)^{n_i}}" />
        </MathBox>
        <P>
          This is solved numerically using Brent&apos;s method, which guarantees
          convergence for monotone functions. YTM assumes all coupons can be
          reinvested at the same rate (a simplifying assumption).
        </P>
        <P>
          Key property: when YTM equals the coupon rate, the bond prices at par.
          When YTM exceeds the coupon rate, the bond trades at a discount (below
          par), and vice versa for premium bonds.
        </P>
      </Section>

      <Section title="Macaulay Duration">
        <P>
          The Macaulay duration is the weighted average time to receipt of cash
          flows, where weights are proportional to present values:
        </P>
        <MathBox>
          <MathBlock tex="D_{\text{Mac}} = \frac{1}{P} \sum_{i=1}^{N} t_i \cdot \frac{CF_i}{(1 + y/m)^{n_i}}" />
        </MathBox>
        <P>
          For a zero-coupon bond, Macaulay duration equals the time to maturity.
          For coupon bonds, duration is always less than maturity because earlier
          cash flows pull the weighted average forward.
        </P>
        <P>
          Higher coupon rates reduce duration (more cash flow arrives earlier),
          while longer maturities increase it.
        </P>
      </Section>

      <Section title="Modified Duration">
        <P>
          Modified duration measures the percentage price sensitivity to a
          parallel yield shift:
        </P>
        <MathBox>
          <MathBlock tex="D_{\text{mod}} = \frac{D_{\text{Mac}}}{1 + y/m}" />
        </MathBox>
        <MathBox>
          <MathBlock tex="\frac{\Delta P}{P} \approx -D_{\text{mod}} \cdot \Delta y" />
        </MathBox>
        <P>
          The linear approximation works well for small yield changes but
          underestimates price increases and overestimates price decreases due to
          the convex price-yield relationship.
        </P>
      </Section>

      <Section title="DV01">
        <P>
          Dollar Value of a Basis Point (DV01) measures the dollar price change
          for a 1 basis point (0.01%) yield move:
        </P>
        <MathBox>
          <MathBlock tex="\text{DV01} = D_{\text{mod}} \times P \times 0.0001" />
        </MathBox>
        <P>
          DV01 is the most commonly used risk metric in bond trading. It allows
          direct comparison of interest rate exposure across bonds with different
          prices and face values.
        </P>
      </Section>

      <Section title="Convexity">
        <P>
          Convexity captures the curvature of the price-yield relationship and
          improves the duration-based linear approximation:
        </P>
        <MathBox>
          <MathBlock tex="C = \frac{1}{P} \sum_{i=1}^{N} t_i \left(t_i + \frac{1}{m}\right) \frac{CF_i}{(1 + y/m)^{n_i + 2}}" />
        </MathBox>
        <MathBox>
          <MathBlock tex="\frac{\Delta P}{P} \approx -D_{\text{mod}} \cdot \Delta y + \tfrac{1}{2} C \cdot (\Delta y)^2" />
        </MathBox>
        <P>
          Positive convexity is beneficial: the bond price increases more than
          duration predicts when yields fall, and decreases less when yields rise.
          All vanilla fixed-coupon bonds have positive convexity.
        </P>
      </Section>

      <Section title="Discount Factors">
        <P>
          A discount factor <InlineMath tex="D(T)" /> gives the present value of
          $1 received at time <InlineMath tex="T" />:
        </P>
        <MathBox>
          <MathBlock tex="D(T) = \frac{1}{(1 + r_T)^T} \quad \text{(annual)}" />
        </MathBox>
        <MathBox>
          <MathBlock tex="D(T) = e^{-r_T \cdot T} \quad \text{(continuous)}" />
        </MathBox>
        <P>
          Discount factors must be positive and monotonically decreasing:
          <InlineMath tex="D(0) = 1" /> and <InlineMath tex="D(T_1) > D(T_2)" /> for{" "}
          <InlineMath tex="T_1 < T_2" />. Violation of this would imply negative
          forward rates and arbitrage opportunities.
        </P>
      </Section>

      <Section title="Bootstrapping">
        <P>
          The <strong>bootstrap method</strong> constructs a zero-rate curve from
          observed par bond prices. Starting from the shortest maturity (where the
          zero rate equals the par rate), each successive zero rate is solved
          iteratively:
        </P>
        <MathBox>
          <MathBlock tex="100 = \sum_{i=1}^{n-1} \frac{C/m}{(1 + z_i/m)^{m \cdot T_i}} + \frac{100 + C/m}{(1 + z_n/m)^{m \cdot T_n}}" />
        </MathBox>
        <P>
          Since all earlier zero rates are known, the equation has a single
          unknown <InlineMath tex="z_n" /> which can be solved analytically.
        </P>
      </Section>

      <Section title="Forward Rates">
        <P>
          The forward rate between times <InlineMath tex="T_1" /> and{" "}
          <InlineMath tex="T_2" /> is implied by the no-arbitrage relationship
          between discount factors:
        </P>
        <MathBox>
          <MathBlock tex="f(T_1, T_2) = \frac{D(T_1)/D(T_2) - 1}{T_2 - T_1}" />
        </MathBox>
        <P>
          Forward rates represent the market&apos;s implied future borrowing cost.
          An upward-sloping yield curve implies rising forward rates, while an
          inverted curve implies the market expects rates to fall.
        </P>
      </Section>

      <Section title="Conventions">
        <P>
          This module uses the following conventions:
        </P>
        <SymDef symbol="m" desc="Compounding frequency = coupon frequency" />
        <SymDef symbol="y" desc="Yields are annualised, compounded at coupon frequency" />
        <SymDef symbol="D" desc="Duration is in years" />
        <SymDef symbol="C" desc="Convexity is in years squared" />
        <P>
          Day-count convention: simplified (actual/actual approximation using
          fractional years). The settlement offset parameter captures the fraction
          of the current coupon period that has elapsed.
        </P>
      </Section>

    </div>
  );
}
