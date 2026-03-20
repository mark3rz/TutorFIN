/**
 * Convenience hook for components that need live quote data.
 *
 * Pulls from MarketDataContext and provides a simple interface:
 *   const { quote, spot, isLoading, error, refetch } = useLiveQuote();
 */

"use client";

import { useMarketData } from "@/context/MarketDataContext";

export function useLiveQuote() {
  const { quote, activeTicker, isConnected, setTicker } = useMarketData();

  return {
    /** Full quote object (null if no ticker active) */
    quote,
    /** Current spot price (null if no quote) */
    spot: quote?.spot ?? null,
    /** Whether we have an active ticker but haven't received a quote yet */
    isLoading: activeTicker !== null && quote === null,
    /** Whether the market data backend is reachable */
    isConnected,
    /** Active ticker symbol */
    ticker: activeTicker,
    /** Manually set a new ticker (triggers quote fetch) */
    setTicker,
  };
}
