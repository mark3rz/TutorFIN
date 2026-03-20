"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Three-Volatility-Concept Model                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

/** A single volatility assumption with its type, value, and provenance */
export interface VolAssumption {
  /** The vol concept this value represents */
  type: "user_assumed" | "market_implied" | "realized";
  /** Annualised volatility as a decimal (0.20 = 20%) */
  value: number;
  /** Human-readable label, e.g. "Vol Lab (25.3%)" */
  source: string;
  /** ISO timestamp of when this was set */
  timestamp: string;
  /** Additional context for realized vol */
  lookbackDays?: number;
  /** Method used for realized vol (close-to-close, ewma, etc.) */
  method?: string;
}

/**
 * A complete assumption profile that can be named, stored, and applied.
 * Contains all three vol concepts plus the risk-free rate.
 */
export interface AssumptionProfile {
  id: string;
  name: string;
  createdAt: string;
  /** The vol the user believes will prevail — their trading thesis */
  userAssumedVol: VolAssumption | null;
  /** Market-implied vol solved from option prices */
  marketImpliedVol: VolAssumption | null;
  /** Backward-looking realized vol computed from price data */
  realizedVol: VolAssumption | null;
  /** Risk-free rate assumption */
  riskFreeRate: number | null;
  riskFreeRateSource: string | null;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Existing Workbench Types                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * An option configuration sent from a lab section to the portfolio.
 * All rates/volatility are stored as decimals (0.05 = 5%).
 */
export interface WorkbenchOption {
  id: string;
  spot: number;
  strike: number;
  expiryYears: number;
  riskFreeRate: number;
  volatility: number;
  dividendYield: number;
  optionType: "call" | "put";
  side: "long" | "short";
  quantity: number;
  premium: number;
  source: string;
  /** Which vol concept was used to price this option */
  volType?: "user_assumed" | "market_implied" | "realized";
}

/**
 * A bond position sent from the Fixed Income lab.
 */
export interface WorkbenchBond {
  id: string;
  faceValue: number;
  couponRate: number;       // decimal (0.05 = 5%)
  couponFrequency: number;  // 1, 2, 4, 12
  maturityYears: number;
  ytm: number;              // decimal
  cleanPrice: number;
  dirtyPrice: number;
  modifiedDuration: number;
  convexity: number;
  dv01: number;
  quantity: number;
  side: "long" | "short";
  source: string;
}

/**
 * Legacy assumptions interface — still used for backward compat.
 * The new AssumptionProfile is the richer replacement.
 */
export interface WorkbenchAssumptions {
  /** Implied vol from Vol Lab — decimal (0.20 = 20%) */
  volatility: number | null;
  volatilitySource: string | null;

  /** Risk-free rate from Rates Lab — decimal (0.05 = 5%) */
  riskFreeRate: number | null;
  riskFreeRateSource: string | null;
}

interface WorkbenchContextValue {
  /* ── Options ── */
  options: WorkbenchOption[];
  addOption: (opt: WorkbenchOption) => void;
  removeOption: (id: string) => void;
  clearOptions: () => void;

  /* ── Bonds ── */
  bonds: WorkbenchBond[];
  addBond: (bond: WorkbenchBond) => void;
  removeBond: (id: string) => void;
  clearBonds: () => void;

  /* ── Legacy Assumptions (backward compat) ── */
  assumptions: WorkbenchAssumptions;
  setVolatilityAssumption: (vol: number, source: string) => void;
  setRateAssumption: (rate: number, source: string) => void;
  clearAssumptions: () => void;

  /* ── Three-Vol Assumption Profile ── */
  activeProfile: AssumptionProfile;
  setUserAssumedVol: (value: number, source: string) => void;
  setMarketImpliedVol: (value: number, source: string) => void;
  setRealizedVol: (value: number, source: string, lookbackDays?: number, method?: string) => void;
  setProfileRate: (rate: number, source: string) => void;
  clearProfile: () => void;
  /** Saved profiles for comparison */
  savedProfiles: AssumptionProfile[];
  saveCurrentProfile: (name: string) => void;
  removeSavedProfile: (id: string) => void;
}

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

let workbenchIdCounter = 0;

/** Generate a unique ID for workbench items */
export function generateWorkbenchId(): string {
  return `wb_${++workbenchIdCounter}_${Date.now()}`;
}

const EMPTY_ASSUMPTIONS: WorkbenchAssumptions = {
  volatility: null,
  volatilitySource: null,
  riskFreeRate: null,
  riskFreeRateSource: null,
};

function createEmptyProfile(): AssumptionProfile {
  return {
    id: generateWorkbenchId(),
    name: "Active Profile",
    createdAt: new Date().toISOString(),
    userAssumedVol: null,
    marketImpliedVol: null,
    realizedVol: null,
    riskFreeRate: null,
    riskFreeRateSource: null,
  };
}

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<WorkbenchOption[]>([]);
  const [bonds, setBonds] = useState<WorkbenchBond[]>([]);
  const [assumptions, setAssumptions] = useState<WorkbenchAssumptions>(EMPTY_ASSUMPTIONS);
  const [activeProfile, setActiveProfile] = useState<AssumptionProfile>(createEmptyProfile);
  const [savedProfiles, setSavedProfiles] = useState<AssumptionProfile[]>([]);

  /* ── Options ── */
  const addOption = useCallback((opt: WorkbenchOption) => {
    setOptions((prev) => [...prev, opt]);
  }, []);

  const removeOption = useCallback((id: string) => {
    setOptions((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const clearOptions = useCallback(() => {
    setOptions([]);
  }, []);

  /* ── Bonds ── */
  const addBond = useCallback((bond: WorkbenchBond) => {
    setBonds((prev) => [...prev, bond]);
  }, []);

  const removeBond = useCallback((id: string) => {
    setBonds((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const clearBonds = useCallback(() => {
    setBonds([]);
  }, []);

  /* ── Legacy Assumptions ── */
  const setVolatilityAssumption = useCallback((vol: number, source: string) => {
    setAssumptions((prev) => ({ ...prev, volatility: vol, volatilitySource: source }));
  }, []);

  const setRateAssumption = useCallback((rate: number, source: string) => {
    setAssumptions((prev) => ({ ...prev, riskFreeRate: rate, riskFreeRateSource: source }));
  }, []);

  const clearAssumptions = useCallback(() => {
    setAssumptions(EMPTY_ASSUMPTIONS);
  }, []);

  /* ── Three-Vol Profile ── */
  const setUserAssumedVol = useCallback((value: number, source: string) => {
    setActiveProfile((prev) => ({
      ...prev,
      userAssumedVol: {
        type: "user_assumed",
        value,
        source,
        timestamp: new Date().toISOString(),
      },
    }));
    // Also update legacy assumption for backward compat
    setAssumptions((prev) => ({ ...prev, volatility: value, volatilitySource: source }));
  }, []);

  const setMarketImpliedVol = useCallback((value: number, source: string) => {
    setActiveProfile((prev) => ({
      ...prev,
      marketImpliedVol: {
        type: "market_implied",
        value,
        source,
        timestamp: new Date().toISOString(),
      },
    }));
  }, []);

  const setRealizedVol = useCallback((value: number, source: string, lookbackDays?: number, method?: string) => {
    setActiveProfile((prev) => ({
      ...prev,
      realizedVol: {
        type: "realized",
        value,
        source,
        timestamp: new Date().toISOString(),
        lookbackDays,
        method,
      },
    }));
  }, []);

  const setProfileRate = useCallback((rate: number, source: string) => {
    setActiveProfile((prev) => ({
      ...prev,
      riskFreeRate: rate,
      riskFreeRateSource: source,
    }));
    // Also update legacy
    setAssumptions((prev) => ({ ...prev, riskFreeRate: rate, riskFreeRateSource: source }));
  }, []);

  const clearProfile = useCallback(() => {
    setActiveProfile(createEmptyProfile());
  }, []);

  const saveCurrentProfile = useCallback((name: string) => {
    setSavedProfiles((prev) => [
      ...prev,
      { ...activeProfile, id: generateWorkbenchId(), name, createdAt: new Date().toISOString() },
    ]);
  }, [activeProfile]);

  const removeSavedProfile = useCallback((id: string) => {
    setSavedProfiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <WorkbenchContext.Provider
      value={{
        options, addOption, removeOption, clearOptions,
        bonds, addBond, removeBond, clearBonds,
        assumptions, setVolatilityAssumption, setRateAssumption, clearAssumptions,
        activeProfile, setUserAssumedVol, setMarketImpliedVol, setRealizedVol,
        setProfileRate, clearProfile, savedProfiles, saveCurrentProfile, removeSavedProfile,
      }}
    >
      {children}
    </WorkbenchContext.Provider>
  );
}

export function useWorkbench(): WorkbenchContextValue {
  const ctx = useContext(WorkbenchContext);
  if (!ctx) {
    throw new Error("useWorkbench must be used within a WorkbenchProvider");
  }
  return ctx;
}
