"use client";

import { useState } from "react";
import { SubTabBar } from "@/components/shell/SubTabBar";
import { ChartPlaceholder } from "@/components/charts/ChartPlaceholder";
import { TheoryPanel } from "@/components/panels/TheoryPanel";

const tabs = ["Option Models", "Rate Models", "Vol Models", "All Models"];

export default function EncyclopediaPage() {
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
                Model Encyclopedia
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                Coming in Phase 4
              </p>
            </div>
            <span className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1 text-xs text-[var(--accent-primary)]">
              {activeTab}
            </span>
          </div>

          {/* Model List Placeholder */}
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Searchable model reference cards will appear here.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {["Black-Scholes", "Binomial", "Monte Carlo", "Heston"].map(
                (model) => (
                  <div
                    key={model}
                    className="rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3"
                  >
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">
                      {model}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Model details and formulas coming soon.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Theory Panel */}
        <TheoryPanel title="Model Reference">
          <p className="text-sm text-[var(--text-secondary)]">
            Full mathematical derivations, assumptions, limitations, and
            implementation notes for each model will be rendered here with
            KaTeX.
          </p>
        </TheoryPanel>
      </div>
    </div>
  );
}
