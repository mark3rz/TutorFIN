"use client";

import { useState } from "react";
import { SubTabBar } from "@/components/shell/SubTabBar";
import { TheoryPanel } from "@/components/panels/TheoryPanel";
import { ImpliedVolTab } from "./ImpliedVolTab";
import { SmileSkewTab } from "./SmileSkewTab";
import { SurfaceTab } from "./SurfaceTab";
import { TermStructureTab } from "./TermStructureTab";
import { VolatilityTheory } from "./theory/VolatilityTheory";

const tabs = ["Implied Vol", "Smile & Skew", "Surface", "Term Structure"];

export default function VolatilityLabPage() {
  const [activeTab, setActiveTab] = useState(tabs[0]);

  return (
    <div className="flex flex-col h-full">
      <SubTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex flex-1 gap-4 p-6 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                Volatility Lab
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                Implied volatility, smile, surface, and term structure analysis
              </p>
            </div>
            <span className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1 text-xs text-[var(--accent-primary)]">
              {activeTab}
            </span>
          </div>

          {activeTab === "Implied Vol" && <ImpliedVolTab />}
          {activeTab === "Smile & Skew" && <SmileSkewTab />}
          {activeTab === "Surface" && <SurfaceTab />}
          {activeTab === "Term Structure" && <TermStructureTab />}
        </div>

        {/* Theory Panel */}
        <TheoryPanel title="Volatility Theory">
          <VolatilityTheory />
        </TheoryPanel>
      </div>
    </div>
  );
}
