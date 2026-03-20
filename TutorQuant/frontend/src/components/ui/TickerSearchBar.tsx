"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Wifi, WifiOff, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { useMarketData } from "@/context/MarketDataContext";
import type { TickerSearchResult } from "@/types/market-data";

export function TickerSearchBar() {
  const { activeTicker, quote, isConnected, setTicker, clearTicker } =
    useMarketData();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TickerSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Debounced search ──────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setSearching(true);
    try {
      const r = await api.searchTickers(q);
      setResults(r);
      setIsOpen(r.length > 0);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // ── Close dropdown on outside click ───────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Select ticker ─────────────────────────────────────────────────────
  function handleSelect(symbol: string) {
    setTicker(symbol);
    setQuery("");
    setIsOpen(false);
    setResults([]);
  }

  // ── Format change ─────────────────────────────────────────────────────
  const changeColor =
    quote && quote.change >= 0
      ? "text-[var(--accent-green)]"
      : "text-[var(--accent-red)]";
  const changeArrow = quote && quote.change >= 0 ? "\u25B2" : "\u25BC";

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-2"
    >
      {/* Connection indicator */}
      <div className="flex items-center" title={isConnected ? "Market data connected" : "Market data offline"}>
        {isConnected ? (
          <Wifi size={12} className="text-[var(--accent-green)]" />
        ) : (
          <WifiOff size={12} className="text-[var(--text-muted)]" />
        )}
      </div>

      {/* Active ticker chip */}
      {activeTicker && quote ? (
        <div className="flex items-center gap-2 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1">
          <span className="font-mono text-xs font-bold text-[var(--accent-primary)]">
            {activeTicker}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">|</span>
          <span className="font-mono text-xs text-[var(--text-primary)]">
            ${quote.spot.toFixed(2)}
          </span>
          <span className={`font-mono text-[10px] ${changeColor}`}>
            {changeArrow}{Math.abs(quote.change_pct).toFixed(1)}%
          </span>
          <button
            onClick={clearTicker}
            className="ml-1 rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            title="Clear ticker"
          >
            <X size={12} />
          </button>
        </div>
      ) : activeTicker && !quote ? (
        <div className="flex items-center gap-2 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1">
          <span className="font-mono text-xs font-bold text-[var(--accent-primary)]">
            {activeTicker}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] animate-pulse">Loading...</span>
          <button
            onClick={clearTicker}
            className="ml-1 rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X size={12} />
          </button>
        </div>
      ) : null}

      {/* Search input */}
      <div className="relative">
        <div className="flex items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1">
          <Search size={12} className="text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setIsOpen(true)}
            placeholder="Search ticker..."
            className="w-[140px] bg-transparent font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          />
          {searching && (
            <div className="h-3 w-3 animate-spin rounded-full border border-[var(--text-muted)] border-t-transparent" />
          )}
          {!searching && query.length > 0 && (
            <ChevronDown size={12} className="text-[var(--text-muted)]" />
          )}
        </div>

        {/* Dropdown results */}
        {isOpen && results.length > 0 && (
          <div className="absolute left-0 top-full z-50 mt-1 max-h-[240px] w-[320px] overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-lg">
            {results.map((r) => (
              <button
                key={r.symbol}
                onClick={() => handleSelect(r.symbol)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
              >
                <span className="font-mono text-xs font-bold text-[var(--accent-primary)] min-w-[48px]">
                  {r.symbol}
                </span>
                <span className="truncate text-xs text-[var(--text-secondary)]">
                  {r.name}
                </span>
                <span className="ml-auto text-[10px] text-[var(--text-muted)]">
                  {r.exchange}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
