"use client";

import { useState } from "react";
import { SubTabBar } from "@/components/shell/SubTabBar";
import { PricingTab } from "./PricingTab";
import { PayoffTab } from "./PayoffTab";
import { MonteCarloTab } from "./MonteCarloTab";
import { TreesTab } from "./TreesTab";

const tabs = ["Pricing", "Payoff Diagrams", "Monte Carlo", "Trees & Comparison"];

export default function OptionModelingPage() {
  const [activeTab, setActiveTab] = useState(tabs[0]);

  return (
    <div className="flex flex-col h-full">
      <SubTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-hidden p-4">
        {activeTab === "Pricing" && <PricingTab />}
        {activeTab === "Payoff Diagrams" && <PayoffTab />}
        {activeTab === "Monte Carlo" && <MonteCarloTab />}
        {activeTab === "Trees & Comparison" && <TreesTab />}
      </div>
    </div>
  );
}
