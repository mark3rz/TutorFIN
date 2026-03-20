"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "@/lib/api";
import type { Quote } from "@/types/market-data";

// ── Context shape ────────────────────────────────────────────────────────────

interface MarketDataContextValue {
  /** Currently selected ticker symbol (null = none) */
  activeTicker: string | null;
  /** Latest quote for the active ticker */
  quote: Quote | null;
  /** Whether the market data backend is reachable */
  isConnected: boolean;
  /** Set a new active ticker — triggers an immediate quote fetch */
  setTicker: (symbol: string) => void;
  /** Clear the active ticker and quote */
  clearTicker: () => void;
}

const MarketDataContext = createContext<MarketDataContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Connection check on mount ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.searchTickers("test");
        if (!cancelled) setIsConnected(true);
      } catch {
        if (!cancelled) setIsConnected(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Fetch quote for the active ticker ──────────────────────────────────
  const fetchQuote = useCallback(async (ticker: string) => {
    try {
      const q = await api.getQuote(ticker);
      setQuote(q);
      setIsConnected(true);
    } catch {
      // Don't clear the quote on transient failures — keep the last known
      setIsConnected(false);
    }
  }, []);

  // ── Polling: refresh quote every 30 s while a ticker is active ─────────
  useEffect(() => {
    // Clear any existing interval
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (!activeTicker) {
      setQuote(null);
      return;
    }

    // Fetch immediately, then poll
    fetchQuote(activeTicker);
    pollRef.current = setInterval(() => fetchQuote(activeTicker), POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeTicker, fetchQuote]);

  // ── Public API ─────────────────────────────────────────────────────────
  const setTicker = useCallback((symbol: string) => {
    const normalised = symbol.toUpperCase().trim();
    if (normalised) {
      setActiveTicker(normalised);
    }
  }, []);

  const clearTicker = useCallback(() => {
    setActiveTicker(null);
    setQuote(null);
  }, []);

  return (
    <MarketDataContext.Provider
      value={{ activeTicker, quote, isConnected, setTicker, clearTicker }}
    >
      {children}
    </MarketDataContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMarketData() {
  const ctx = useContext(MarketDataContext);
  if (!ctx) {
    throw new Error("useMarketData must be used within <MarketDataProvider>");
  }
  return ctx;
}
