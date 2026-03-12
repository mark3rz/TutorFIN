"use client";

import { useState } from "react";
import { SubTabBar } from "@/components/shell/SubTabBar";
import { TheoryPanel } from "@/components/panels/TheoryPanel";
import { SVISurfaceTab } from "./SVISurfaceTab";
import { RateCalibrationTab } from "./RateCalibrationTab";
import { CalibrationTheory } from "./theory/CalibrationTheory";

const tabs = ["SVI Surface Fitting", "Rate Model Calibration"];

export default function CalibrationPage() {
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
                Calibration Lab
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                SVI surface fitting, rate model calibration, and diagnostics
              </p>
            </div>
            <span className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1 text-xs text-[var(--accent-primary)]">
              {activeTab}
            </span>
          </div>

          {activeTab === "SVI Surface Fitting" && <SVISurfaceTab />}
          {activeTab === "Rate Model Calibration" && <RateCalibrationTab />}
        </div>

        {/* Theory Panel */}
        <TheoryPanel title="Calibration Theory">
          <CalibrationTheory />
        </TheoryPanel>
      </div>
    </div>
  );
}
