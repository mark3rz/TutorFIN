/**
 * Market data types — mirrors backend Pydantic schemas from
 * `schemas/market_data.py`.
 */

/** Real-time quote snapshot */
export interface Quote {
  ticker: string;
  name: string;
  spot: number;
  currency: string;
  change: number;
  change_pct: number;
  volume: number;
  market_cap: number;
  timestamp: string;
}

/** Single OHLCV bar */
export interface HistoryBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Historical price series */
export interface HistoryResponse {
  ticker: string;
  period: string;
  interval: string;
  bars: HistoryBar[];
}

/** Single option quote from the chain */
export interface OptionQuote {
  strike: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  open_interest: number;
  implied_vol: number;
  option_type: string;
}

/** Full option chain for one expiration */
export interface OptionsChain {
  ticker: string;
  expiration: string;
  calls: OptionQuote[];
  puts: OptionQuote[];
}

/** Available option expiration dates */
export interface ExpirationList {
  ticker: string;
  expirations: string[];
}

/** Ticker search result */
export interface TickerSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  instrument_type: string;
}
