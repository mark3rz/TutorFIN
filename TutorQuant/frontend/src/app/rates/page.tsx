"use client";

import { useState } from "react";
import { SubTabBar } from "@/components/shell/SubTabBar";
import { ChartPlaceholder } from "@/components/charts/ChartPlaceholder";
import { TheoryPanel } from "@/components/panels/TheoryPanel";

const tabs = ["Short Rate Models", "Simulation", "Model Comparison"];

export default function RatesPage() {
  const [activeTab, setActiveTab] = useState(tabs[0]);

  return (
    <div className="flex flex-col h-full">
      <SubTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex flex-1 gap-4 p-6 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                Interest Rate Models
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                Coming in Phase 3
              </p>
            </div>
            <span className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1 text-xs text-[var(--accent-primary)]">
              {activeTab}
            </span>
          </div>

          <ChartPlaceholder
            title={`${activeTab} — Chart Area`}
            height="400px"
          />

          {/* Input Controls Placeholder */}
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
            <p className="text-sm text-[var(--text-muted)]">
              Short rate model parameters and simulation controls will appear
              here.
            </p>
          </div>
        </div>

        {/* Theory Panel */}
        <TheoryPanel title="Rate Model Theory">
          <p className="text-sm text-[var(--text-secondary)]">
            SDEs and closed-form solutions for Vasicek, CIR, Hull-White, and
            other short rate models will be rendered here with KaTeX.
          </p>
        </TheoryPanel>
      </div>
    </div>
  );
}
