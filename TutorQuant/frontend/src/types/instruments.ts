/** Option type: call or put */
export type OptionType = "call" | "put";

/** Exercise style of an option contract */
export type ExerciseStyle = "european" | "american" | "bermudan";

/** Full specification for an option contract */
export interface OptionContract {
  /** Current spot price of the underlying */
  spot: number;
  /** Strike price */
  strike: number;
  /** Time to expiry in years */
  expiryYears: number;
  /** Call or put */
  optionType: OptionType;
  /** Exercise style */
  exerciseStyle: ExerciseStyle;
  /** Continuous dividend yield (annualized) */
  dividendYield: number;
}

/** Day count convention for fixed income instruments */
export type DayCountConvention =
  | "ACT/360"
  | "ACT/365"
  | "ACT/ACT"
  | "30/360"
  | "30E/360";

/** Full specification for a bond */
export interface BondSpec {
  /** Face / par value */
  faceValue: number;
  /** Annual coupon rate (e.g. 0.05 for 5%) */
  couponRate: number;
  /** Number of coupon payments per year */
  couponFrequency: number;
  /** Time to maturity in years */
  maturityYears: number;
  /** Day count convention */
  dayCountConvention: DayCountConvention;
}

/** Full specification for an interest rate swap */
export interface SwapSpec {
  /** Notional principal */
  notional: number;
  /** Fixed leg rate (annualized) */
  fixedRate: number;
  /** Spread over the floating index (bps expressed as decimal) */
  floatSpread: number;
  /** Swap tenor in years */
  tenorYears: number;
  /** Payment frequency per year */
  paymentFrequency: number;
  /** Day count convention */
  dayCountConvention: DayCountConvention;
}
