"use client";

import { useState } from "react";
import { SubTabBar } from "@/components/shell/SubTabBar";
import { TheoryPanel } from "@/components/panels/TheoryPanel";
import { BondPricingTab } from "./BondPricingTab";
import { YieldCurvesTab } from "./YieldCurvesTab";
import { DurationConvexityTab } from "./DurationConvexityTab";
import { FixedIncomeTheory } from "./theory/FixedIncomeTheory";

const tabs = ["Bond Pricing", "Yield Curves", "Duration & Convexity"];

export default function FixedIncomePage() {
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
                Fixed Income
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                Bond pricing, yield curves, duration, convexity, and DV01 analytics
              </p>
            </div>
            <span className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1 text-xs text-[var(--accent-primary)]">
              {activeTab}
            </span>
          </div>

          {activeTab === "Bond Pricing" && <BondPricingTab />}
          {activeTab === "Yield Curves" && <YieldCurvesTab />}
          {activeTab === "Duration & Convexity" && <DurationConvexityTab />}
        </div>

        {/* Theory Panel */}
        <TheoryPanel title="Fixed Income Theory">
          <FixedIncomeTheory />
        </TheoryPanel>
      </div>
    </div>
  );
}
