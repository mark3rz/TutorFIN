"use client";

import { useState, useCallback } from "react";
import { SubTabBar } from "@/components/shell/SubTabBar";
import { PositionsTab, type Position, type BondPosition } from "./PositionsTab";
import { PerformanceTab } from "./PerformanceTab";
import type { AssumptionProfile } from "@/context/WorkbenchContext";

const TABS = ["Positions", "Performance"];

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState("Positions");

  // Shared state between Positions and Performance tabs
  const [sharedPositions, setSharedPositions] = useState<Position[]>([]);
  const [sharedBonds, setSharedBonds] = useState<BondPosition[]>([]);
  const [sharedRate, setSharedRate] = useState(5.0);
  const [sharedVol, setSharedVol] = useState(20.0);
  const [sharedProfile, setSharedProfile] = useState<AssumptionProfile | null>(null);

  const handlePositionsChange = useCallback(
    (positions: Position[], bonds: BondPosition[], riskFreeRate: number, volatility: number, profile: AssumptionProfile) => {
      setSharedPositions(positions);
      setSharedBonds(bonds);
      setSharedRate(riskFreeRate);
      setSharedVol(volatility);
      setSharedProfile(profile);
    },
    [],
  );

  return (
    <div className="flex h-full flex-col">
      <SubTabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex flex-1 overflow-hidden p-4">
        {activeTab === "Positions" && (
          <PositionsTab onPositionsChange={handlePositionsChange} />
        )}
        {activeTab === "Performance" && (
          <PerformanceTab
            positions={sharedPositions}
            bondPositions={sharedBonds}
            riskFreeRate={sharedRate}
            volatility={sharedVol}
            volProfile={sharedProfile}
          />
        )}
      </div>
    </div>
  );
}
