"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { GreekConfig } from "@/lib/greeksConfig";
import type { OptionState } from "@/lib/greeksEngine";
import { Info } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface GreekCardProps {
  config: GreekConfig;
  curveData: { x: number[]; y: number[] };
  currentX: number;
  currentY: number;
  optionState: OptionState;
}

export function GreekCard({
  config,
  curveData,
  currentX,
  currentY,
  optionState,
}: GreekCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Build hover template with formatted values
  const hovertemplate = useMemo(() => {
    const xLabel = config.xLabel;
    const yLabel = config.shortLabel;
    if (config.xVariable === "volatility" || config.xVariable === "riskFreeRate") {
      return `${xLabel}: %{customdata:.1f}%<br>${yLabel}: %{y:.6f}<extra></extra>`;
    }
    if (config.xVariable === "expiryYears") {
      return `${xLabel}: %{x:.3f}<br>${yLabel}: %{y:.6f}<extra></extra>`;
    }
    return `${xLabel}: %{x:.2f}<br>${yLabel}: %{y:.6f}<extra></extra>`;
  }, [config]);

  // Custom data for percentage display in hover
  const customdata = useMemo(() => {
    if (config.xVariable === "volatility" || config.xVariable === "riskFreeRate") {
      return curveData.x.map((v) => v * 100);
    }
    return undefined;
  }, [config.xVariable, curveData.x]);

  // Compute y-axis range with some padding
  const yRange = useMemo(() => {
    const ys = curveData.y.filter((v) => isFinite(v) && !isNaN(v));
    if (ys.length === 0) return [-1, 1];
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const span = max - min;
    if (span < 1e-12) return [min - 1, max + 1];
    const pad = span * 0.1;
    return [min - pad, max + pad];
  }, [curveData.y]);

  // Marker hover text
  const markerHoverText = useMemo(() => {
    const xFormatted =
      config.xVariable === "volatility" || config.xVariable === "riskFreeRate"
        ? `${(currentX * 100).toFixed(1)}%`
        : config.xVariable === "expiryYears"
          ? `${currentX.toFixed(3)}`
          : `${currentX.toFixed(2)}`;
    return `Current: ${config.shortLabel} = ${currentY.toFixed(6)}<br>${config.xLabel} = ${xFormatted}`;
  }, [config, currentX, currentY]);

  const moneyness =
    optionState.spot > optionState.strike * 1.02
      ? "ITM"
      : optionState.spot < optionState.strike * 0.98
        ? "OTM"
        : "ATM";

  const categoryBadgeColor =
    config.category === "first-order"
      ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
      : config.category === "second-order"
        ? "bg-[#2196f3]/15 text-[#2196f3]"
        : "bg-[#ab47bc]/15 text-[#ab47bc]";

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            {config.symbol}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">{config.label}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${categoryBadgeColor}`}>
            {config.category === "first-order" ? "1st" : config.category === "second-order" ? "2nd" : "3rd"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[var(--text-muted)]">
            {currentY.toFixed(4)}
          </span>
          <div
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <Info size={12} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-help" />
            {showTooltip && (
              <div className="absolute right-0 top-5 z-50 w-64 rounded border border-[var(--border-color)] bg-[#0e0e14] p-3 shadow-lg">
                <p className="text-[10px] font-semibold text-[var(--text-primary)] mb-1">
                  {config.label} ({config.symbol})
                </p>
                <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">
                  {config.explanation}
                </p>
                <div className="mt-2 flex items-center gap-2 text-[9px] text-[var(--text-muted)]">
                  <span>X-axis: {config.xLabel}</span>
                  <span>|</span>
                  <span>{moneyness}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <Plot
        data={[
          // Main curve
          {
            x: curveData.x,
            y: curveData.y,
            type: "scatter" as const,
            mode: "lines" as const,
            line: { color: config.lineColor, width: 1.5 },
            hovertemplate,
            customdata,
            showlegend: false,
          },
          // Current point marker
          {
            x: [currentX],
            y: [currentY],
            type: "scatter" as const,
            mode: "markers" as const,
            marker: {
              color: config.lineColor,
              size: 7,
              line: { color: "#0a0a0f", width: 1.5 },
            },
            hovertext: markerHoverText,
            hoverinfo: "text" as const,
            showlegend: false,
          },
        ]}
        layout={{
          paper_bgcolor: "#141420",
          plot_bgcolor: "#141420",
          font: { color: "#8888aa", family: "monospace", size: 9 },
          margin: { l: 45, r: 10, t: 5, b: 30 },
          xaxis: {
            gridcolor: "#1e1e3a",
            zerolinecolor: "#2a2a4a",
            tickfont: { size: 8 },
            tickformat:
              config.xVariable === "volatility" || config.xVariable === "riskFreeRate"
                ? ".0%"
                : config.xVariable === "expiryYears"
                  ? ".2f"
                  : ".0f",
          },
          yaxis: {
            gridcolor: "#1e1e3a",
            zerolinecolor: "#2a2a4a",
            tickfont: { size: 8 },
            range: yRange,
          },
          showlegend: false,
          hovermode: "closest" as const,
          hoverlabel: {
            bgcolor: "#0e0e14",
            bordercolor: config.lineColor,
            font: { size: 10, color: "#e0e0e0", family: "monospace" },
          },
        }}
        config={{
          responsive: true,
          displayModeBar: false,
          staticPlot: false,
        }}
        useResizeHandler
        style={{ width: "100%", height: "180px" }}
      />
    </div>
  );
}
