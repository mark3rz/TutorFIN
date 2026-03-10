"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { NumberInput } from "@/components/ui/NumberInput";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { Button } from "@/components/ui/Button";
import { TheoryPanel } from "@/components/panels/TheoryPanel";
import { VaRTheory } from "./theory/VaRTheory";
import { api } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const DARK_LAYOUT: Partial<Plotly.Layout> = {
  paper_bgcolor: "#0e0e14",
  plot_bgcolor: "#141420",
  font: { color: "#e0e0e0", family: "monospace", size: 11 },
  margin: { l: 60, r: 30, t: 40, b: 50 },
  xaxis: { gridcolor: "#1e1e3a", zerolinecolor: "#1e1e3a" },
  yaxis: { gridcolor: "#1e1e3a", zerolinecolor: "#1e1e3a" },
  showlegend: false,
};

interface Position {
  id: string;
  instrument_type: string;
  quantity: number;
  side: string;
  spot: number;
  strike: number;
  expiry_years: number;
  option_type: string;
  dividend_yield: number;
}

interface AnalyticsResult {
  total_value: number;
  positions_valued: Record<string, unknown>[];
  risk_metrics: Record<string, number>;
  var: number;
  es: number;
  var_method: string;
  pnl_distribution?: number[];
}

let posIdCounter = 1;
function newPosition(): Position {
  return {
    id: `pos_${posIdCounter++}`,
    instrument_type: "option",
    quantity: 10,
    side: "long",
    spot: 100,
    strike: 100,
    expiry_years: 1.0,
    option_type: "call",
    dividend_yield: 0,
  };
}

export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[]>([newPosition()]);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [volatility, setVolatility] = useState(20.0);
  const [confidence, setConfidence] = useState<string>("95%");
  const [holdingDays, setHoldingDays] = useState(1);
  const [varMethod, setVarMethod] = useState<string>("Parametric");

  const [result, setResult] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPosition = useCallback(() => {
    setPositions((prev) => [...prev, newPosition()]);
  }, []);

  const removePosition = useCallback((id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updatePosition = useCallback((id: string, field: string, value: unknown) => {
    setPositions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  }, []);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);

    const confLevel = confidence === "99%" ? 0.99 : 0.95;
    const method = varMethod === "Monte Carlo" ? "monte_carlo" : "parametric";

    try {
      const res = await api.analyzePortfolio({
        positions: positions.map((p) => ({
          instrument_id: p.id,
          instrument_type: p.instrument_type,
          quantity: p.quantity,
          side: p.side,
          spot: p.spot,
          strike: p.strike,
          expiry_years: p.expiry_years,
          option_type: p.option_type,
          dividend_yield: p.dividend_yield / 100,
        })),
        riskFreeRate: riskFreeRate / 100,
        volatility: volatility / 100,
        confidence: confLevel,
        holdingDays,
        varMethod: method,
        numScenarios: 10000,
        seed: 42,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  function fmtVal(v: number | undefined, decimals = 4): string {
    if (v === undefined) return "--";
    return v.toFixed(decimals);
  }

  function signColor(v: number): string {
    if (v > 0.01) return "text-[var(--accent-green)]";
    if (v < -0.01) return "text-[var(--accent-red)]";
    return "text-[var(--text-primary)]";
  }

  return (
    <div className="flex flex-1 gap-4 overflow-hidden h-full p-4">
      {/* ── LEFT: Positions & Config Panel ────────────────────── */}
      <div className="w-[320px] shrink-0 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--border-color)] px-4 py-2.5 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Portfolio Positions
          </h3>
          <button
            onClick={addPosition}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[var(--accent-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Plus size={12} /> Add
          </button>
        </div>

        <div className="p-3 space-y-3">
          {positions.map((pos, idx) => (
            <div key={pos.id} className="rounded border border-[var(--border-color)] bg-[#0a0a0f] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                  Position {idx + 1}
                </span>
                {positions.length > 1 && (
                  <button
                    onClick={() => removePosition(pos.id)}
                    className="text-[var(--accent-red)] hover:text-[var(--accent-red)]/80"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="Spot" value={pos.spot} onChange={(v) => updatePosition(pos.id, "spot", v)} min={0.01} step={1} />
                <NumberInput label="Strike" value={pos.strike} onChange={(v) => updatePosition(pos.id, "strike", v)} min={0.01} step={1} />
                <NumberInput label="Expiry (y)" value={pos.expiry_years} onChange={(v) => updatePosition(pos.id, "expiry_years", v)} min={0.01} step={0.25} />
                <NumberInput label="Qty" value={pos.quantity} onChange={(v) => updatePosition(pos.id, "quantity", v)} min={1} step={1} />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <span className="text-[9px] uppercase text-[var(--text-muted)]">Type</span>
                  <ToggleGroup
                    options={["call", "put"]}
                    value={pos.option_type}
                    onChange={(v) => updatePosition(pos.id, "option_type", v)}
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[9px] uppercase text-[var(--text-muted)]">Side</span>
                  <ToggleGroup
                    options={["long", "short"]}
                    value={pos.side}
                    onChange={(v) => updatePosition(pos.id, "side", v)}
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="border-t border-[var(--border-color)] pt-3 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Risk Config</p>
            <NumberInput label="Risk-Free Rate" value={riskFreeRate} onChange={setRiskFreeRate} step={0.25} suffix="%" />
            <NumberInput label="Volatility (σ)" value={volatility} onChange={setVolatility} min={0.01} step={1} suffix="%" />
            <NumberInput label="Holding Period" value={holdingDays} onChange={setHoldingDays} min={1} step={1} suffix="days" />

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Confidence</span>
              <ToggleGroup options={["95%", "99%"]} value={confidence} onChange={setConfidence} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">VaR Method</span>
              <ToggleGroup options={["Parametric", "Monte Carlo"]} value={varMethod} onChange={setVarMethod} />
            </div>
          </div>

          <Button onClick={handleAnalyze} loading={loading} className="w-full">
            Analyze Portfolio
          </Button>

          {error && (
            <div className="rounded border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER: Results ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {result ? (
          <>
            {/* Summary */}
            <div className="flex items-center gap-6 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-4">
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Portfolio Value</p>
                <p className="font-mono text-2xl font-bold text-[var(--accent-primary)]">{fmtVal(result.total_value, 2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">{confidence} VaR ({holdingDays}d)</p>
                <p className="font-mono text-xl font-bold text-[var(--accent-red)]">{fmtVal(result.var, 2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[var(--text-muted)]">{confidence} ES</p>
                <p className="font-mono text-xl font-bold text-[var(--accent-red)]">{fmtVal(result.es, 2)}</p>
              </div>
              <div className="ml-auto">
                <p className="text-[10px] uppercase text-[var(--text-muted)]">Method</p>
                <p className="font-mono text-sm text-[var(--text-muted)]">{result.var_method}</p>
              </div>
            </div>

            {/* Greeks Aggregation */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Delta", key: "total_delta" },
                { label: "Gamma", key: "total_gamma" },
                { label: "Vega", key: "total_vega" },
                { label: "Theta", key: "total_theta" },
              ].map((g) => {
                const v = result.risk_metrics[g.key];
                return (
                  <div key={g.key} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Portfolio {g.label}
                    </p>
                    <p className={`mt-1 font-mono text-xl font-bold ${signColor(v)}`}>
                      {fmtVal(v)}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Positions Table */}
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
              <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Position Detail
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      <th className="py-2 text-left text-[var(--text-muted)]">ID</th>
                      <th className="py-2 text-right text-[var(--text-muted)]">Price</th>
                      <th className="py-2 text-right text-[var(--text-muted)]">Value</th>
                      <th className="py-2 text-right text-[var(--text-muted)]">Delta</th>
                      <th className="py-2 text-right text-[var(--text-muted)]">Gamma</th>
                      <th className="py-2 text-right text-[var(--text-muted)]">Vega</th>
                      <th className="py-2 text-right text-[var(--text-muted)]">Theta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.positions_valued.map((pv, i) => (
                      <tr key={i} className="border-b border-[var(--border-color)]/50">
                        <td className="py-2 font-mono text-[var(--text-primary)]">{pv.instrument_id as string}</td>
                        <td className="py-2 text-right font-mono text-[var(--text-primary)]">{(pv.price as number)?.toFixed(4)}</td>
                        <td className={`py-2 text-right font-mono font-bold ${signColor(pv.position_value as number)}`}>
                          {(pv.position_value as number)?.toFixed(2)}
                        </td>
                        <td className={`py-2 text-right font-mono ${signColor(pv.delta as number)}`}>{(pv.delta as number)?.toFixed(4)}</td>
                        <td className={`py-2 text-right font-mono ${signColor(pv.gamma as number)}`}>{(pv.gamma as number)?.toFixed(4)}</td>
                        <td className={`py-2 text-right font-mono ${signColor(pv.vega as number)}`}>{(pv.vega as number)?.toFixed(4)}</td>
                        <td className={`py-2 text-right font-mono ${signColor(pv.theta as number)}`}>{(pv.theta as number)?.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* P&L Distribution (MC only) */}
            {result.pnl_distribution && result.pnl_distribution.length > 0 && (
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2">
                <Plot
                  data={[{
                    x: result.pnl_distribution,
                    type: "histogram" as const,
                    nbinsx: 60,
                    marker: { color: "rgba(255,152,0,0.6)", line: { color: "#ff9800", width: 0.5 } },
                    name: "P&L Distribution",
                  } as Plotly.Data]}
                  layout={{
                    ...DARK_LAYOUT,
                    title: { text: "Monte Carlo P&L Distribution", font: { size: 12, color: "#e0e0e0" } },
                    xaxis: { ...DARK_LAYOUT.xaxis, title: { text: "Portfolio P&L", font: { size: 10 } } },
                    yaxis: { ...DARK_LAYOUT.yaxis, title: { text: "Frequency", font: { size: 10 } } },
                    shapes: [
                      {
                        type: "line", x0: -result.var, x1: -result.var, y0: 0, y1: 1, yref: "paper",
                        line: { color: "#ff1744", width: 2, dash: "dash" },
                      },
                    ],
                    annotations: [
                      {
                        x: -result.var, y: 1.02, yref: "paper",
                        text: `VaR = ${result.var.toFixed(2)}`,
                        showarrow: false, font: { color: "#ff1744", size: 10 },
                      },
                    ],
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  useResizeHandler
                  style={{ width: "100%", height: "300px" }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="text-center">
              <p className="text-sm text-[var(--text-muted)]">Add positions and click &quot;Analyze Portfolio&quot;</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Portfolio valuation, Greeks aggregation, VaR, and ES will appear here
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Theory Panel ───────────────────────────────── */}
      <TheoryPanel title="Portfolio Risk Theory">
        <VaRTheory />
      </TheoryPanel>
    </div>
  );
}
