"use client";

import { useState } from "react";
import { SubTabBar } from "@/components/shell/SubTabBar";
import { PnlExplainTab } from "./PnlExplainTab";
import { HedgingTab } from "./HedgingTab";
import { GreeksVisualizerTab } from "./GreeksVisualizerTab";

const tabs = ["Visualizer", "P&L Explain", "Hedging Error"];

export default function GreeksPage() {
  const [activeTab, setActiveTab] = useState(tabs[0]);

  return (
    <div className="flex flex-col h-full">
      <SubTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-hidden p-4">
        {activeTab === "Visualizer" && <GreeksVisualizerTab />}
        {activeTab === "P&L Explain" && <PnlExplainTab />}
        {activeTab === "Hedging Error" && <HedgingTab />}
      </div>
    </div>
  );
}
